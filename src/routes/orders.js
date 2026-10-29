const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Order, OrderItem, Product, SmartTable, Inventory, Op } = require('../config/mysql');
const auth = require('../middleware/auth');
const { staffOnly, optionalAuth, isStaff } = require('../middleware/auth');
const { notifyNewOrder, notifyOrderUpdate, notifyInventoryUpdate, getIo } = require('../sockets');

const SETTINGS_FILE = path.join(__dirname, '../../datas/settings.json');
const getSystemGstRate = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (data && typeof data.gstRate === 'number' && !isNaN(data.gstRate)) {
        return data.gstRate;
      }
    }
  } catch (e) {}
  return 0;
};

// Keep any active UNPAID order's GST and totalAmount synced with the current system GST rate.
// Once an order is PAID / SERVED, its gstRate and totalAmount remain permanently locked.
const syncUnpaidOrderGst = async (order, currentGstRate = getSystemGstRate()) => {
  if (!order) return order;
  const isSettled =
    order.paymentStatus === 'paid' ||
    order.paymentStatus === 'Paid' ||
    order.status === 'served' ||
    order.status === 'cancelled';
  if (isSettled) return order;

  const items = order.items || [];
  if (!Array.isArray(items) || items.length === 0) return order;

  const itemsSubtotal = items.reduce((sum, item) => {
    const price = Number(item.price ?? (item.product && item.product.price) ?? 0);
    const qty = Number(item.quantity ?? 1);
    return sum + price * qty;
  }, 0);

  const expectedTotal = Math.round((itemsSubtotal + itemsSubtotal * (currentGstRate / 100)) * 100) / 100;
  const savedGst = order.gstRate !== null && order.gstRate !== undefined ? Number(order.gstRate) : NaN;
  const savedTotal = Number(order.totalAmount || 0);

  if (savedGst !== currentGstRate || Math.abs(savedTotal - expectedTotal) > 0.009) {
    order.gstRate = currentGstRate;
    order.totalAmount = expectedTotal;
    try {
      await order.save();
    } catch (e) {}
  }
  return order;
};

// Item states after which a QR customer may no longer delete / cancel
const KITCHEN_STARTED_STATES = ['preparing', 'decorating', 'quality_check', 'ready', 'served', 'delivered'];

// Helper to parse JSON safely
const parseInvJson = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return fallback; }
  }
  return val;
};

// Check if an OrderItem matches any of the linked foods on an Inventory item
const doesInvMatchItem = (inv, item) => {
  const itemProductId = item.productId ? Number(item.productId) : null;
  const itemNameLower = (item.name || (item.product && item.product.name) || '').trim().toLowerCase();
  if (!itemNameLower && !itemProductId) return false;

  const linkedList = parseInvJson(inv.linkedProducts, []);
  if (Array.isArray(linkedList) && linkedList.length > 0) {
    for (const lp of linkedList) {
      if (!lp) continue;
      const lpId = typeof lp === 'object' && lp.productId ? Number(lp.productId) : null;
      const lpName = (typeof lp === 'string' ? lp : (lp.name || '')).trim().toLowerCase();
      if (lpId && itemProductId && lpId === itemProductId) return true;
      if (lpName && itemNameLower && lpName === itemNameLower) return true;
    }
  }

  const linkedId = inv.linkedProductId ? Number(inv.linkedProductId) : null;
  if (linkedId && itemProductId && linkedId === itemProductId) return true;

  const rawNames = (inv.linkedProductName || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (rawNames.length > 0 && itemNameLower && rawNames.includes(itemNameLower)) return true;

  const invNameLower = (inv.name || '').trim().toLowerCase();
  if (!linkedId && rawNames.length === 0 && (!Array.isArray(linkedList) || linkedList.length === 0)) {
    if (itemNameLower && invNameLower === itemNameLower) return true;
  }

  return false;
};

// Helper to deduct ingredients & track sold units/revenue/breakdown when an item reaches Ready or Bill Settled
const deductInventoryForOrder = async (order) => {
  try {
    if (!order || order.status === 'cancelled') return;
    const items = order.items || [];
    const orderIsReadyOrPaid =
      ['ready', 'served'].includes(order.status) ||
      order.paymentStatus === 'paid' ||
      order.paymentStatus === 'Paid';

    // Quick check: if no items need deduction right now, skip DB query completely
    const itemsNeedingDeduction = items.filter(item => {
      if (item.inventoryDeducted) return false;
      return orderIsReadyOrPaid || ['ready', 'delivered', 'served'].includes(item.status);
    });
    if (itemsNeedingDeduction.length === 0) return;

    const allInventories = await Inventory.findAll();
    const dirtyInventories = new Set();
    const deductedItemIds = [];

    for (const item of itemsNeedingDeduction) {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || (item.product ? Number(item.product.price) : 0) || 0;
      const itemRevenue = Number((unitPrice * qty).toFixed(2));
      const displayItemName = (item.name || (item.product && item.product.name) || 'Item').trim();

      if (allInventories && allInventories.length > 0) {
        for (const inv of allInventories) {
          if (doesInvMatchItem(inv, item)) {
            const initQty = Number(inv.initialQuantity) || Number(inv.quantity) || 0;
            const expUnits = Number(inv.expectedUnits) || 0;
            const usagePerUnit = (initQty > 0 && expUnits > 0) ? (initQty / expUnits) : 0;

            if (usagePerUnit > 0) {
              inv.quantity = Math.max(0, Number((Number(inv.quantity) - usagePerUnit * qty).toFixed(4)));
            }
            inv.soldUnits = (Number(inv.soldUnits) || 0) + qty;
            inv.salesRevenue = Number(((Number(inv.salesRevenue) || 0) + itemRevenue).toFixed(2));

            const breakdown = Object.assign({}, parseInvJson(inv.soldBreakdown, {}));
            const prev = breakdown[displayItemName] || { count: 0, revenue: 0 };
            breakdown[displayItemName] = {
              count: (Number(prev.count) || 0) + qty,
              revenue: Number(((Number(prev.revenue) || 0) + itemRevenue).toFixed(2))
            };
            inv.soldBreakdown = breakdown;
            inv.changed('soldBreakdown', true);
            inv.lastUpdated = new Date();
            dirtyInventories.add(inv);
          }
        }
      }

      // Mark item as deducted in memory & queue for single bulk SQL update
      item.inventoryDeducted = true;
      if (item.id) deductedItemIds.push(item.id);
    }

    if (dirtyInventories.size > 0) {
      await Promise.all(
        Array.from(dirtyInventories).map(async (inv) => {
          await inv.save();
          notifyInventoryUpdate(inv);
        })
      );
    }

    if (deductedItemIds.length > 0) {
      await OrderItem.update(
        { inventoryDeducted: true },
        { where: { id: { [Op.in]: deductedItemIds } } }
      );
    }
  } catch (error) {
    console.error('Failed to deduct inventory:', error);
  }
};

// Helper to reverse inventory deduction if an already-Ready item is deleted or order is cancelled
const reverseInventoryForItems = async (itemsToReverse) => {
  try {
    if (!itemsToReverse || itemsToReverse.length === 0) return;
    const deductedItems = itemsToReverse.filter(item => item && item.inventoryDeducted);
    if (deductedItems.length === 0) return;

    const allInventories = await Inventory.findAll();
    const dirtyInventories = new Set();
    const reversedItemIds = [];

    for (const item of deductedItems) {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || 0;
      const itemRevenue = Number((unitPrice * qty).toFixed(2));
      const displayItemName = (item.name || 'Item').trim();

      if (allInventories && allInventories.length > 0) {
        for (const inv of allInventories) {
          if (doesInvMatchItem(inv, item)) {
            const initQty = Number(inv.initialQuantity) || 0;
            const expUnits = Number(inv.expectedUnits) || 0;
            const usagePerUnit = (initQty > 0 && expUnits > 0) ? (initQty / expUnits) : 0;

            if (usagePerUnit > 0) {
              const maxCap = initQty > 0 ? initQty : Infinity;
              inv.quantity = Math.min(maxCap, Number((Number(inv.quantity) + usagePerUnit * qty).toFixed(4)));
            }
            inv.soldUnits = Math.max(0, (Number(inv.soldUnits) || 0) - qty);
            inv.salesRevenue = Math.max(0, Number(((Number(inv.salesRevenue) || 0) - itemRevenue).toFixed(2)));

            const breakdown = Object.assign({}, parseInvJson(inv.soldBreakdown, {}));
            if (breakdown[displayItemName]) {
              const nextCount = Math.max(0, (Number(breakdown[displayItemName].count) || 0) - qty);
              const nextRev = Math.max(0, Number(((Number(breakdown[displayItemName].revenue) || 0) - itemRevenue).toFixed(2)));
              if (nextCount <= 0) {
                delete breakdown[displayItemName];
              } else {
                breakdown[displayItemName] = { count: nextCount, revenue: nextRev };
              }
              inv.soldBreakdown = breakdown;
              inv.changed('soldBreakdown', true);
            }

            inv.lastUpdated = new Date();
            dirtyInventories.add(inv);
          }
        }
      }

      item.inventoryDeducted = false;
      if (item.id) reversedItemIds.push(item.id);
    }

    if (dirtyInventories.size > 0) {
      await Promise.all(
        Array.from(dirtyInventories).map(async (inv) => {
          await inv.save();
          notifyInventoryUpdate(inv);
        })
      );
    }

    if (reversedItemIds.length > 0) {
      try {
        await OrderItem.update(
          { inventoryDeducted: false },
          { where: { id: { [Op.in]: reversedItemIds } } }
        );
      } catch (e) {}
    }
  } catch (error) {
    console.error('Failed to reverse inventory:', error);
  }
};

// Create a new order (Placed by customer or waiter)
router.post('/', async (req, res) => {
  // NOTE: client-sent totalAmount is intentionally ignored; the total is calculated here from DB prices.
  const { tableNumber, customerName, items, mealType } = req.body;

  try {
    const tblNum = parseInt(tableNumber) || 1;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // 1. Resolve all products in a single batch query instead of N sequential queries
    const allProducts = await Product.findAll();
    const productById = new Map();
    const productByName = new Map();
    for (const p of allProducts) {
      productById.set(String(p.id), p);
      if (p.name) productByName.set(p.name.trim().toLowerCase(), p);
    }

    const resolvedItems = [];
    let itemsTotal = 0;
    for (const item of items) {
      let product = null;
      if (item.productId) {
        product = productById.get(String(item.productId)) || null;
      }
      if (!product && item.name) {
        product = productByName.get(String(item.name).trim().toLowerCase()) || null;
      }
      if (!product) {
        return res.status(400).json({ message: `Menu item not found: ${item.name || item.productId || 'unknown'}. Please refresh the menu.` });
      }

      const quantity = Number(item.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
        return res.status(400).json({ message: `Invalid quantity for ${product.name}` });
      }

      const unitPrice = product.isOffer && product.discountPrice ? product.discountPrice : product.price;
      itemsTotal += (unitPrice || 0) * quantity;
      resolvedItems.push({ item, product, quantity, unitPrice });
    }

    // Check if an active unpaid order already exists for this table
    let order = await Order.findOne({
      where: {
        tableNumber: tblNum,
        paymentStatus: 'unpaid',
        status: { [Op.ne]: 'cancelled' },
        mealType: mealType || 'Breakfast'
      }
    });

    const currentGstRate = getSystemGstRate();

    if (order) {
      order.gstRate = currentGstRate;
      const addedWithGst = Math.round((itemsTotal + itemsTotal * (currentGstRate / 100)) * 100) / 100;
      order.totalAmount = Math.round((Number(order.totalAmount || 0) + addedWithGst) * 100) / 100;
      if (order.status === 'served' || order.status === 'ready') {
        order.status = 'pending';
      }
      await order.save();
    } else {
      const totalWithGst = Math.round((itemsTotal + itemsTotal * (currentGstRate / 100)) * 100) / 100;
      order = await Order.create({
        tableNumber: tblNum,
        customerName: customerName || `Table ${tblNum} Guest`,
        totalAmount: totalWithGst,
        gstRate: currentGstRate,
        status: 'pending',
        paymentStatus: 'unpaid',
        mealType: mealType || 'Breakfast'
      });
    }

    const now = new Date();
    const orderItemsPayload = resolvedItems.map(({ item, product, quantity, unitPrice }) => {
      let category = 'Drink';
      const cat = (product.category || '').toLowerCase();
      if (cat.includes('cake') || cat.includes('pastr') || cat.includes('brownie') || cat.includes('cookie')) {
        category = 'Cake';
      } else if (cat.includes('snack')) {
        category = 'Snack';
      }

      return {
        orderId: order.id,
        productId: product.id,
        name: product.name,
        price: unitPrice,
        quantity,
        instructions: item.instructions || '',
        category,
        round: 1,
        status: 'pending',
        kitchenDepartment: category.toLowerCase(),
        orderedAt: now,
        memberId: item.memberId || 'M1'
      };
    });

    await OrderItem.bulkCreate(orderItemsPayload);

    const fullOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    await syncUnpaidOrderGst(fullOrder, currentGstRate);

    // Automatically update Table status
    try {
      let table = await SmartTable.findOne({ where: { tableNumber: tblNum } });
      if (table) {
        table.status = 'Ordering';
        table.currentOrderId = String(order.id);
        table.currentOrderNumber = `#${String(order.id).padStart(4, '0')}`;
        table.currentBill = order.totalAmount;
        table.orderProgress = 15;
        table.sessionStartedAt = table.sessionStartedAt || new Date();
        table.paymentStatus = 'Unpaid';
        await table.save();

        const io = getIo();
        io.emit('table_status_updated', table);
      }
    } catch (tblErr) {
      console.error('Failed to sync table status on new order:', tblErr.message);
    }

    // Notify chefs/waiters/admins in real time
    notifyNewOrder(fullOrder);

    res.status(201).json(fullOrder);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get all orders (with optional filters)
// Public QR customers (no token) only get active unpaid orders; full history needs a staff login.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, tableNumber, category, paymentStatus, mealType } = req.query;
    let { timeframe } = req.query;
    let where = {};

    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (!isStaff(req)) {
      where.paymentStatus = 'unpaid';
      if (timeframe === 'all') timeframe = undefined;
    }
    if (mealType) {
      where.mealType = mealType;
    }

    if (tableNumber) {
      where.tableNumber = parseInt(tableNumber);
    }

        if (timeframe !== 'all') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
  
      where[Op.or] = [
        { createdAt: { [Op.between]: [todayStart, todayEnd] } },
        { status: { [Op.notIn]: ['served', 'cancelled'] } }
      ];
    }

    let include = [{
      model: OrderItem,
      as: 'items',
      include: [{ model: Product, as: 'product' }]
    }];

    if (category) {
      include[0].where = { category };
    }

    const orders = await Order.findAll({
      where,
      include,
      order: [['createdAt', 'DESC']]
    });

    const currentGstRate = getSystemGstRate();
    await Promise.all(orders.map(o => syncUnpaidOrderGst(o, currentGstRate)));

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get active orders for a specific table
router.get('/table/:tableNumber', async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.tableNumber);
    const orders = await Order.findAll({
      where: {
        tableNumber,
        status: { [Op.notIn]: ['served', 'cancelled'] }
      },
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }],
      order: [['createdAt', 'DESC']]
    });

    const currentGstRate = getSystemGstRate();
    await Promise.all(orders.map(o => syncUnpaidOrderGst(o, currentGstRate)));

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single order by ID (public: used by the QR digital receipt page /receipt/:orderId)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    await syncUnpaidOrderGst(order, getSystemGstRate());
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status or details
// Staff: full access. QR customers (no token): may only delete their own not-yet-started items or cancel the order.
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const {
      status,
      chefNotes,
      rejectionReason,
      estimatedCompletionTime,
      paymentStatus,
      paymentMethod,
      items,
      deleteItemIds,
      updateItemQuantity
    } = req.body;

    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!isStaff(req)) {
      const guestAllowedKeys = ['deleteItemIds', 'updateItemQuantity', 'status', 'rejectionReason'];
      const sentKeys = Object.keys(req.body || {});
      const onlyAllowedKeys = sentKeys.every(k => guestAllowedKeys.includes(k));
      const statusOk = status === undefined || status === 'cancelled';
      if (!onlyAllowedKeys || !statusOk || order.paymentStatus !== 'unpaid') {
        return res.status(401).json({ message: 'Staff login required for this action' });
      }
    }

    // Handle Single Item Quantity Change (e.g., removing 1 unit when quantity > 1)
    if (updateItemQuantity && updateItemQuantity.itemId) {
      const targetItem = await OrderItem.findOne({
        where: {
          id: updateItemQuantity.itemId,
          orderId: order.id
        }
      });
      if (targetItem) {
        const oldQty = Number(targetItem.quantity) || 1;
        const newQty = updateItemQuantity.quantity !== undefined
          ? Number(updateItemQuantity.quantity)
          : oldQty + (Number(updateItemQuantity.delta) || 0);

        if (newQty <= 0) {
          await reverseInventoryForItems([targetItem]);
          await targetItem.destroy();
        } else {
          const diff = oldQty - newQty;
          if (diff > 0 && targetItem.inventoryDeducted) {
            await reverseInventoryForItems([{
              productId: targetItem.productId,
              name: targetItem.name,
              price: targetItem.price,
              quantity: diff,
              inventoryDeducted: true
            }]);
          }
          targetItem.quantity = newQty;
          await targetItem.save();
        }

        // Recalculate remaining items and update bill total + order status
        const remainingItems = await OrderItem.findAll({ where: { orderId: order.id } });
        let updatedSubtotal = 0;
        for (const remItem of remainingItems) {
          updatedSubtotal += (remItem.price || 0) * (remItem.quantity || 1);
        }
        const orderGst = (order.gstRate !== null && order.gstRate !== undefined) ? Number(order.gstRate) : getSystemGstRate();
        order.totalAmount = Math.round((updatedSubtotal + updatedSubtotal * (orderGst / 100)) * 100) / 100;

        if (remainingItems.length === 0) {
          order.status = 'cancelled';
        }
      }
    }

    // Handle Item Deletion (allowed in all stages: pending, preparing, ready, etc.)
    if (deleteItemIds && Array.isArray(deleteItemIds) && deleteItemIds.length > 0) {
      const itemsToDelete = await OrderItem.findAll({
        where: {
          id: { [Op.in]: deleteItemIds },
          orderId: order.id
        }
      });
      await reverseInventoryForItems(itemsToDelete);

      await OrderItem.destroy({
        where: {
          id: { [Op.in]: deleteItemIds },
          orderId: order.id
        }
      });

      // Recalculate remaining items and update bill total + order status
      const remainingItems = await OrderItem.findAll({ where: { orderId: order.id } });
      let updatedSubtotal = 0;
      for (const remItem of remainingItems) {
        updatedSubtotal += (remItem.price || 0) * (remItem.quantity || 1);
      }
      const orderGst = (order.gstRate !== null && order.gstRate !== undefined) ? Number(order.gstRate) : getSystemGstRate();
      order.totalAmount = Math.round((updatedSubtotal + updatedSubtotal * (orderGst / 100)) * 100) / 100;

      if (remainingItems.length === 0) {
        order.status = 'cancelled';
      } else {
        const allStatuses = remainingItems.map(i => i.status);
        const uniqueStatuses = [...new Set(allStatuses)];
        if (uniqueStatuses.every(s => s === 'ready')) {
          order.status = 'ready';
        } else if (uniqueStatuses.every(s => s === 'delivered')) {
          order.status = 'served';
        } else if (uniqueStatuses.some(s => ['preparing', 'decorating', 'quality_check'].includes(s))) {
          order.status = 'preparing';
        } else if (uniqueStatuses.some(s => s === 'accepted')) {
          order.status = 'accepted';
        } else {
          order.status = 'pending';
        }
      }
    }

    // Handle preparation timer start
    if (status === 'preparing' && order.status !== 'preparing') {
      order.preparationTimerStartedAt = new Date();
    }

    // Set fields if provided
    if (status) order.status = status;
    if (chefNotes !== undefined) order.chefNotes = chefNotes;
    if (rejectionReason !== undefined) order.rejectionReason = rejectionReason;
    if (estimatedCompletionTime !== undefined) order.estimatedCompletionTime = estimatedCompletionTime;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentMethod) order.paymentMethod = paymentMethod;

    // Handle individual item statuses in bulk (fast even for 85+ items)
    if (items && Array.isArray(items) && items.length > 0) {
      const statusGroups = {};
      const itemStatusById = new Map();

      for (const itemUpdate of items) {
        const itemId = itemUpdate.itemId || itemUpdate.id || itemUpdate._id;
        if (itemId && itemUpdate.status) {
          if (!statusGroups[itemUpdate.status]) statusGroups[itemUpdate.status] = [];
          statusGroups[itemUpdate.status].push(itemId);
          itemStatusById.set(String(itemId), itemUpdate.status);
        }
      }

      if (Object.keys(statusGroups).length > 0) {
        await Promise.all(
          Object.entries(statusGroups).map(([newStatus, ids]) =>
            OrderItem.update(
              { status: newStatus },
              { where: { id: { [Op.in]: ids }, orderId: order.id } }
            )
          )
        );
      }

      // Update in-memory items so we can compute overall order status without an extra DB round-trip
      const currentItems = Array.isArray(order.items) ? order.items : [];
      for (const it of currentItems) {
        const nextSt = itemStatusById.get(String(it.id));
        if (nextSt) it.status = nextSt;
      }

      const allStatuses = currentItems.map(i => i.status);
      const uniqueStatuses = [...new Set(allStatuses)];

      if (uniqueStatuses.length > 0) {
        if (uniqueStatuses.every(s => s === 'ready')) {
          order.status = 'ready';
        } else if (uniqueStatuses.every(s => s === 'delivered')) {
          order.status = 'served';
        } else if (uniqueStatuses.some(s => ['preparing', 'decorating', 'quality_check'].includes(s))) {
          if (order.status !== 'preparing' && !order.preparationTimerStartedAt) {
            order.preparationTimerStartedAt = new Date();
          }
          order.status = 'preparing';
        } else if (uniqueStatuses.some(s => s === 'accepted')) {
          order.status = 'accepted';
        }
      }
    }

    await order.save();

    const populatedOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });

    if (order.status === 'cancelled') {
      await reverseInventoryForItems(populatedOrder.items);
    } else {
      await deductInventoryForOrder(populatedOrder);
    }

    // Sync Table status
    try {
      let table = await SmartTable.findOne({ where: { tableNumber: Number(order.tableNumber) } });
      if (table) {
        if (order.status === 'pending') {
          table.status = 'Ordering';
          table.orderProgress = 15;
          table.currentBill = order.totalAmount;
        } else if (order.status === 'accepted') {
          table.status = 'Order Confirmed';
          table.orderProgress = 30;
          table.currentBill = order.totalAmount;
        } else if (order.status === 'preparing') {
          table.status = 'Preparing';
          table.orderProgress = 60;
          table.currentBill = order.totalAmount;
        } else if (order.status === 'ready') {
          table.status = 'Ready To Serve';
          table.orderProgress = 85;
          table.currentBill = order.totalAmount;
        } else if (order.status === 'cancelled') {
          table.status = 'Available';
          table.currentOrderId = null;
          table.currentOrderNumber = '';
          table.currentBill = 0;
          table.orderProgress = 0;
          table.paymentStatus = 'Pending';
        } else if (order.status === 'served' || order.paymentStatus === 'paid') {
          table.status = 'Available';
          table.currentOrderId = null;
          table.currentOrderNumber = '';
          table.currentBill = 0;
          table.orderProgress = 0;
          table.paymentStatus = 'Paid';
        }
        if (paymentStatus) table.paymentStatus = paymentStatus === 'paid' ? 'Paid' : 'Pending';

        await table.save();

        const io = getIo();
        io.emit('table_status_updated', table);
      }
    } catch (tblErr) {
      console.error('Failed to sync table on order PUT:', tblErr.message);
    }

    // Notify clients real-time
    notifyOrderUpdate(populatedOrder);

    res.json(populatedOrder);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(400).json({ message: error.message });
  }
});

// Close Table (Marks table as closed, sets payment to paid, marks order served, sets table Available)
router.post('/:id/close', staffOnly, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const requestedGst = req.body.gstRate !== undefined ? parseFloat(req.body.gstRate) : NaN;
    const lockedGstRate = !isNaN(requestedGst) && requestedGst >= 0
      ? requestedGst
      : (order.gstRate !== null && order.gstRate !== undefined ? Number(order.gstRate) : getSystemGstRate());

    const itemsSubtotal = Array.isArray(order.items) && order.items.length > 0
      ? order.items.reduce((sum, item) => {
          const price = Number(item.price ?? item.product?.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + price * qty;
        }, 0)
      : Number(order.totalAmount || 0);

    order.gstRate = lockedGstRate;
    order.totalAmount = Math.round((itemsSubtotal + itemsSubtotal * (lockedGstRate / 100)) * 100) / 100;
    order.paymentStatus = 'paid';
    order.paymentMethod = req.body.paymentMethod || 'Cash';
    order.status = 'served';
    await order.save();
    await deductInventoryForOrder(order);

    // Automatically set Table status to Available
    try {
      let table = await SmartTable.findOne({ where: { tableNumber: Number(order.tableNumber) } });
      if (table) {
        table.status = 'Available';
        table.currentOrderId = null;
        table.currentOrderNumber = '';
        table.currentBill = 0;
        table.orderProgress = 0;
        table.paymentStatus = 'Paid';
        await table.save();

        const io = getIo();
        io.emit('table_status_updated', table);
      }
    } catch (tblErr) {
      console.error('Failed to set table available on order close:', tblErr.message);
    }

    const populatedOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    notifyOrderUpdate(populatedOrder);
    res.json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/orders/bulk-delete - Admin deleting multiple orders
router.post('/bulk-delete', staffOnly, async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'No order IDs provided for deletion' });
    }

    const count = await Order.destroy({
      where: {
        id: { [Op.in]: orderIds }
      }
    });

    res.json({ message: `${count} order(s) deleted successfully`, deletedCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove / Delete order by ID (Cancel order or Permanent deletion)
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    // Only staff can permanently delete. A QR customer's delete is treated as a normal cancel (kitchen-start check below).
    const permanent = isStaff(req) ? req.query.permanent : undefined;

    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items' }]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!isStaff(req) && order.paymentStatus !== 'unpaid') {
      return res.status(401).json({ message: 'Staff login required for this action' });
    }

    if (permanent === 'true') {
      if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'Paid') {
        await reverseInventoryForItems(order.items);
      }
      const tableNumber = order.tableNumber;
      const orderId = order.id;
      await order.destroy();

      // Sync Table status to Available if no active orders remain
      try {
        let table = await SmartTable.findOne({ where: { tableNumber: Number(tableNumber) } });
        if (table) {
          const remainingActive = await Order.findAll({
            where: {
              tableNumber: Number(tableNumber),
              status: { [Op.notIn]: ['served', 'cancelled'] }
            }
          });
          if (remainingActive.length === 0) {
            table.status = 'Available';
            table.currentOrderId = null;
            table.currentOrderNumber = '';
            table.currentBill = 0;
            table.orderProgress = 0;
            table.paymentStatus = 'Pending';
            await table.save();

            const io = getIo();
            io.emit('table_status_updated', table);
          }
        }
      } catch (tblErr) {}

      return res.json({ message: 'Order permanently deleted', orderId });
    }

    await reverseInventoryForItems(order.items);
    order.status = 'cancelled';
    order.rejectionReason = 'Order removed / cancelled by customer/staff';
    await order.save();

    // Sync Table status to Available if no active orders remain
    try {
      let table = await SmartTable.findOne({ where: { tableNumber: Number(order.tableNumber) } });
      if (table) {
        const remainingActive = await Order.findAll({
          where: {
            tableNumber: Number(order.tableNumber),
            id: { [Op.ne]: order.id },
            status: { [Op.notIn]: ['served', 'cancelled'] }
          }
        });
        if (remainingActive.length === 0) {
          table.status = 'Available';
          table.currentOrderId = null;
          table.currentOrderNumber = '';
          table.currentBill = 0;
          table.orderProgress = 0;
          table.paymentStatus = 'Pending';
          await table.save();

          const io = getIo();
          io.emit('table_status_updated', table);
        }
      }
    } catch (tblErr) {
      console.error('Failed to sync table status on order delete:', tblErr.message);
    }

    const populatedOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    notifyOrderUpdate(populatedOrder);

    res.json({ message: 'Order removed successfully', order: populatedOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

