const express = require('express');
const router = express.Router();
const { Inventory, Product, Order, OrderItem, Op } = require('../config/mysql');
const auth = require('../middleware/auth');
const { staffOnly } = require('../middleware/auth');
const { notifyInventoryUpdate } = require('../sockets');

// Get all inventory items (Staff)
router.get('/', staffOnly, async (req, res) => {
  try {
    const items = await Inventory.findAll({ order: [['id', 'DESC']] });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper to parse JSON safely
const parseJsonField = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return fallback; }
  }
  return val;
};

// Helper to check if an OrderItem matches an Inventory item's linked food list
const matchesInventoryLinkedFood = (inv, ordItem) => {
  const ordItemId = ordItem.productId ? Number(ordItem.productId) : null;
  const ordItemName = (ordItem.name || '').trim().toLowerCase();
  if (!ordItemName && !ordItemId) return false;

  const linkedList = parseJsonField(inv.linkedProducts, []);
  if (Array.isArray(linkedList) && linkedList.length > 0) {
    for (const lp of linkedList) {
      if (!lp) continue;
      const lpId = typeof lp === 'object' && lp.productId ? Number(lp.productId) : null;
      const lpName = (typeof lp === 'string' ? lp : (lp.name || '')).trim().toLowerCase();
      if (lpId && ordItemId && lpId === ordItemId) return true;
      if (lpName && ordItemName && lpName === ordItemName) return true;
    }
  }

  if (inv.linkedProductId && ordItemId && Number(inv.linkedProductId) === ordItemId) {
    return true;
  }

  const rawNames = (inv.linkedProductName || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (rawNames.length > 0 && ordItemName && rawNames.includes(ordItemName)) {
    return true;
  }

  const invName = (inv.name || '').trim().toLowerCase();
  if (!inv.linkedProductId && rawNames.length === 0 && (!Array.isArray(linkedList) || linkedList.length === 0)) {
    if (invName && ordItemName && invName === ordItemName) return true;
  }

  return false;
};

// Create new inventory item (Admin / Staff)
router.post('/', staffOnly, async (req, res) => {
  try {
    const {
      name,
      quantity,
      initialQuantity,
      unit,
      minThreshold,
      purchaseCost,
      linkedProductId,
      linkedProductName,
      linkedProducts,
      expectedUnits
    } = req.body;

    if (!name || quantity === undefined) {
      return res.status(400).json({ message: 'Material name and stock quantity are required' });
    }

    const existing = await Inventory.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ message: `Material '${name}' already exists in inventory! You can edit or refill it.` });
    }

    let normalizedLinkedProducts = [];
    if (Array.isArray(linkedProducts) && linkedProducts.length > 0) {
      normalizedLinkedProducts = linkedProducts
        .map(lp => {
          if (typeof lp === 'string') return { productId: null, name: lp.trim(), price: 0 };
          return {
            productId: lp.productId ? Number(lp.productId) : null,
            name: (lp.name || '').trim(),
            price: Number(lp.price) || 0
          };
        })
        .filter(lp => lp.name);
    }

    let resolvedProductName = (linkedProductName || '').trim();
    let resolvedProductId = linkedProductId ? Number(linkedProductId) : null;

    if (normalizedLinkedProducts.length > 0) {
      resolvedProductName = normalizedLinkedProducts.map(p => p.name).join(', ');
      resolvedProductId = normalizedLinkedProducts[0].productId || null;
    } else if (resolvedProductId && !resolvedProductName) {
      const prod = await Product.findByPk(resolvedProductId);
      if (prod) {
        resolvedProductName = prod.name;
        normalizedLinkedProducts = [{ productId: prod.id, name: prod.name, price: Number(prod.price) || 0 }];
      }
    } else if (resolvedProductName) {
      normalizedLinkedProducts = resolvedProductName
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(n => ({ productId: null, name: n, price: 0 }));
    }

    const initQty = Number(initialQuantity !== undefined ? initialQuantity : quantity) || 0;
    const currQty = Number(quantity) || 0;

    const newItem = await Inventory.create({
      name: name.trim(),
      initialQuantity: initQty > 0 ? initQty : currQty,
      quantity: currQty,
      unit: unit || 'kg',
      minThreshold: minThreshold !== undefined ? Number(minThreshold) : 1,
      purchaseCost: Number(purchaseCost) || 0,
      linkedProductId: resolvedProductId,
      linkedProductName: resolvedProductName,
      linkedProducts: normalizedLinkedProducts,
      expectedUnits: Number(expectedUnits) || 0,
      soldUnits: 0,
      salesRevenue: 0,
      soldBreakdown: {},
      wastageCost: 0,
      lastUpdated: new Date()
    });

    notifyInventoryUpdate(newItem);

    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update specific inventory item or perform batch action (Staff)
router.put('/:id', staffOnly, async (req, res) => {
  const {
    name,
    quantity,
    initialQuantity,
    unit,
    minThreshold,
    purchaseCost,
    linkedProductId,
    linkedProductName,
    linkedProducts,
    expectedUnits,
    soldUnits,
    salesRevenue,
    soldBreakdown,
    wastageCost,
    action
  } = req.body;

  try {
    const item = await Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });

    if (action === 'new_batch') {
      const freshQty = initialQuantity !== undefined ? Number(initialQuantity) : (Number(item.initialQuantity) || Number(item.quantity) || 0);
      item.initialQuantity = freshQty;
      item.quantity = freshQty;
      if (purchaseCost !== undefined) item.purchaseCost = Number(purchaseCost);
      if (expectedUnits !== undefined) item.expectedUnits = Number(expectedUnits);
      item.soldUnits = 0;
      item.salesRevenue = 0;
      item.soldBreakdown = {};
      item.changed('soldBreakdown', true);
      item.wastageCost = 0;
      item.lastUpdated = new Date();
      await item.save();
      notifyInventoryUpdate(item);
      return res.json(item);
    }

    if (action === 'mark_wastage') {
      const initQ = Number(item.initialQuantity) || 0;
      const remQ = Number(item.quantity) || 0;
      const cost = Number(item.purchaseCost) || 0;
      const wastedValue = initQ > 0 ? Number(((remQ / initQ) * cost).toFixed(2)) : 0;
      item.wastageCost = Number(((Number(item.wastageCost) || 0) + wastedValue).toFixed(2));
      item.quantity = 0;
      item.lastUpdated = new Date();
      await item.save();
      notifyInventoryUpdate(item);
      return res.json(item);
    }

    if (action === 'sync_today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = await Order.findAll({
        where: {
          createdAt: { [Op.gte]: todayStart },
          status: { [Op.ne]: 'cancelled' },
          [Op.or]: [
            { status: { [Op.in]: ['ready', 'served'] } },
            { paymentStatus: 'paid' }
          ]
        },
        include: [{ model: OrderItem, as: 'items' }]
      });

      const initQ = Number(item.initialQuantity) || Number(item.quantity) || 0;
      const expU = Number(item.expectedUnits) || 0;
      const usagePerUnit = (initQ > 0 && expU > 0) ? (initQ / expU) : 0;
      const breakdown = Object.assign({}, parseJsonField(item.soldBreakdown, {}));

      for (const ord of todayOrders) {
        for (const ordItem of (ord.items || [])) {
          if (ordItem.inventoryDeducted) continue;
          if (matchesInventoryLinkedFood(item, ordItem)) {
            const q = Number(ordItem.quantity) || 1;
            const rev = (Number(ordItem.price) || 0) * q;
            if (usagePerUnit > 0) {
              item.quantity = Math.max(0, Number((Number(item.quantity) - usagePerUnit * q).toFixed(4)));
            }
            item.soldUnits = (Number(item.soldUnits) || 0) + q;
            item.salesRevenue = Number(((Number(item.salesRevenue) || 0) + rev).toFixed(2));

            const displayKey = (ordItem.name || 'Item').trim();
            const prev = breakdown[displayKey] || { count: 0, revenue: 0 };
            breakdown[displayKey] = {
              count: (Number(prev.count) || 0) + q,
              revenue: Number(((Number(prev.revenue) || 0) + rev).toFixed(2))
            };

            ordItem.inventoryDeducted = true;
            await ordItem.save();
          }
        }
      }
      item.soldBreakdown = breakdown;
      item.changed('soldBreakdown', true);
      item.lastUpdated = new Date();
      await item.save();
      notifyInventoryUpdate(item);
      return res.json(item);
    }

    if (name !== undefined && name.trim()) item.name = name.trim();
    if (initialQuantity !== undefined) item.initialQuantity = Number(initialQuantity);
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (unit !== undefined) item.unit = unit;
    if (minThreshold !== undefined) item.minThreshold = Number(minThreshold);
    if (purchaseCost !== undefined) item.purchaseCost = Number(purchaseCost);

    if (Array.isArray(linkedProducts)) {
      const cleaned = linkedProducts
        .map(lp => {
          if (typeof lp === 'string') return { productId: null, name: lp.trim(), price: 0 };
          return {
            productId: lp.productId ? Number(lp.productId) : null,
            name: (lp.name || '').trim(),
            price: Number(lp.price) || 0
          };
        })
        .filter(lp => lp.name);
      item.linkedProducts = cleaned;
      item.changed('linkedProducts', true);
      item.linkedProductName = cleaned.map(p => p.name).join(', ');
      item.linkedProductId = cleaned.length > 0 ? (cleaned[0].productId || null) : null;
    } else {
      if (linkedProductId !== undefined) {
        item.linkedProductId = linkedProductId ? Number(linkedProductId) : null;
      }
      if (linkedProductName !== undefined) item.linkedProductName = linkedProductName.trim();
    }

    if (expectedUnits !== undefined) item.expectedUnits = Number(expectedUnits);
    if (soldUnits !== undefined) item.soldUnits = Number(soldUnits);
    if (salesRevenue !== undefined) item.salesRevenue = Number(salesRevenue);
    if (soldBreakdown !== undefined) {
      item.soldBreakdown = soldBreakdown;
      item.changed('soldBreakdown', true);
    }
    if (wastageCost !== undefined) item.wastageCost = Number(wastageCost);

    item.lastUpdated = new Date();
    await item.save();

    notifyInventoryUpdate(item);
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete inventory item
router.delete('/:id', staffOnly, async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });
    const deletedId = item.id;
    await item.destroy();
    notifyInventoryUpdate({ id: deletedId, _id: String(deletedId), deleted: true });
    res.json({ message: 'Inventory item deleted successfully', id: deletedId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Batch refill all ingredients to their initialQuantity (Staff)
router.post('/refill', staffOnly, async (req, res) => {
  try {
    const items = await Inventory.findAll();
    for (const item of items) {
      const targetQty = Number(item.initialQuantity) > 0 ? Number(item.initialQuantity) : (item.unit === 'g' ? 10000 : 10);
      item.initialQuantity = targetQty;
      item.quantity = targetQty;
      item.soldUnits = 0;
      item.salesRevenue = 0;
      item.soldBreakdown = {};
      item.changed('soldBreakdown', true);
      item.wastageCost = 0;
      item.lastUpdated = new Date();
      await item.save();
      notifyInventoryUpdate(item);
    }
    res.json({ message: 'All inventory batches reset & refilled successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
