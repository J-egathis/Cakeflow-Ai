const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const auth = require('../middleware/auth');
const { notifyNewOrder, notifyOrderUpdate, notifyInventoryUpdate } = require('../sockets');

// Helper to deduct ingredients from inventory when order is completed (served)
const deductInventoryForOrder = async (order) => {
  try {
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      const qty = item.quantity;
      const updates = {};

      const prodName = product.name.toLowerCase();
      const catName = product.category.toLowerCase();

      // Deduct based on category and product names
      if (catName.includes('cake') || catName.includes('pastr') || catName.includes('brownie') || catName.includes('cookie')) {
        updates['Flour'] = 150 * qty;
        updates['Sugar'] = 100 * qty;
        updates['Cream'] = 80 * qty;
        updates['Butter'] = 50 * qty;
        updates['Eggs'] = 2 * qty;

        if (prodName.includes('choco') || prodName.includes('truffle') || prodName.includes('brownie')) {
          updates['Chocolate'] = 90 * qty;
        }
      } else if (catName.includes('snack')) {
        updates['Flour'] = 50 * qty;
        updates['Butter'] = 20 * qty;

        if (prodName.includes('cheese') || prodName.includes('cheesy') || prodName.includes('paneer')) {
          updates['Cheese'] = 60 * qty;
        }
        if (catName.includes('non-veg')) {
          updates['Eggs'] = 1 * qty;
        }
      } else if (catName.includes('drink')) {
        if (prodName.includes('latte') || prodName.includes('cappuccino') || prodName.includes('macchiato') || prodName.includes('milk')) {
          updates['Milk'] = 180 * qty;
          updates['Sugar'] = 15 * qty;
        }
      }

      // Apply updates to database
      for (const [ingredientName, amountToDeduct] of Object.entries(updates)) {
        const invItem = await Inventory.findOne({ name: ingredientName });
        if (invItem) {
          invItem.quantity = Math.max(0, invItem.quantity - amountToDeduct);
          invItem.lastUpdated = Date.now();
          await invItem.save();
          notifyInventoryUpdate(invItem);
        }
      }
    }
  } catch (error) {
    console.error('Failed to deduct inventory:', error);
  }
};

// Create a new order (Placed by customer or waiter)
router.post('/', async (req, res) => {
  const { tableNumber, customerName, items, totalAmount } = req.body;

  try {
    // Populate routing categories for each item
    const populatedItems = [];
    for (const item of items) {
      let product = null;
      if (item.productId) {
        try {
          product = await Product.findById(item.productId);
        } catch (e) {}
      }
      
      // Fallback search by product name if ID changed during re-seed
      if (!product && item.name) {
        product = await Product.findOne({ name: item.name });
      }

      if (!product) {
        // Fallback to first available product if catalog was reseeded
        product = await Product.findOne();
      }

      if (!product) {
        return res.status(400).json({ message: 'Catalog item not found. Please refresh menu.' });
      }

      let category = 'Drink'; // default
      const cat = (product.category || '').toLowerCase();
      if (cat.includes('cake') || cat.includes('pastr') || cat.includes('brownie') || cat.includes('cookie')) {
        category = 'Cake';
      } else if (cat.includes('snack')) {
        category = 'Snack';
      }

      populatedItems.push({
        product: product._id,
        quantity: item.quantity || 1,
        instructions: item.instructions || '',
        category,
        status: 'pending'
      });
    }

    const tblNum = parseInt(tableNumber) || 1;

    // Check if an active unpaid order already exists for this table (MUST NOT BE SERVED OR CANCELLED)
    let existingOrder = await Order.findOne({
      tableNumber: tblNum,
      paymentStatus: 'unpaid',
      status: { $nin: ['served', 'cancelled'] }
    });

    if (existingOrder) {
      // Determine round number for these newly added items
      const currentMaxRound = existingOrder.items.reduce((max, i) => Math.max(max, i.round || 1), 1);
      const nextRound = currentMaxRound + 1;

      const itemsForNextRound = populatedItems.map(item => ({
        ...item,
        round: nextRound,
        orderedAt: new Date()
      }));

      // Append items to the existing order
      existingOrder.items.push(...itemsForNextRound);
      existingOrder.totalAmount += totalAmount;
      
      // If the order was fully ready, revert it back to preparing so the new items are processed
      if (existingOrder.status === 'ready') {
        existingOrder.status = 'preparing';
      }

      const savedOrder = await existingOrder.save();
      const fullOrder = await Order.findById(savedOrder._id).populate('items.product');

      // Update Table's current bill
      try {
        const Table = require('../models/Table');
        let table = await Table.findOne({ tableNumber: Number(tableNumber) });
        if (table) {
          table.currentBill = existingOrder.totalAmount;
          if (table.status === 'Ready To Serve') {
            table.status = 'Preparing';
            table.orderProgress = 60;
          }
          await table.save();

          const { getIo } = require('../sockets');
          const io = getIo();
          io.emit('table_status_updated', table);
        }
      } catch (tblErr) {
        console.error('Failed to sync table on appended order:', tblErr.message);
      }

      // Notify that the order was updated (with new items)
      notifyNewOrder(fullOrder); 
      const { notifyOrderUpdate } = require('../sockets');
      notifyOrderUpdate(fullOrder);

      return res.status(200).json(fullOrder);
    }

    const order = new Order({
      tableNumber: Number(tableNumber) || 1,
      customerName: customerName || `Table ${tableNumber} Guest`,
      items: populatedItems,
      totalAmount,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    const savedOrder = await order.save();
    
    // Populate product details before sending real-time notification
    const fullOrder = await Order.findById(savedOrder._id).populate('items.product');

    // Automatically update Table status
    try {
      const Table = require('../models/Table');
      let table = await Table.findOne({ tableNumber: Number(tableNumber) });
      if (table) {
        table.status = 'Ordering';
        table.currentOrderId = savedOrder._id;
        table.currentOrderNumber = `#${savedOrder._id.toString().slice(-4)}`;
        table.currentBill = totalAmount;
        table.orderProgress = 15;
        table.sessionStartedAt = new Date();
        table.paymentStatus = 'Unpaid';
        await table.save();

        const { getIo } = require('../sockets');
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
    res.status(400).json({ message: error.message });
  }
});

// Get all orders (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { status, tableNumber, category } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (tableNumber) {
      query.tableNumber = parseInt(tableNumber);
    }

    // Filter by item category (e.g. only get orders containing 'Cake' for Cake Chef)
    if (category) {
      query['items.category'] = category;
    }

    const orders = await Order.find(query)
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get active orders for a specific table
router.get('/table/:tableNumber', async (req, res) => {
  try {
    const tableNumber = parseInt(req.params.tableNumber);
    // Find active orders (must NOT be cancelled or served)
    const orders = await Order.find({
      tableNumber,
      status: { $nin: ['served', 'cancelled'] }
    })
    .populate('items.product')
    .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status or details
router.put('/:id', async (req, res) => {
  try {
    const {
      status,
      chefNotes,
      rejectionReason,
      estimatedCompletionTime,
      paymentStatus,
      paymentMethod,
      items, // Array of items with their individual preparation status updates
      deleteItemIds // Array of item IDs to delete (single or multi item deletion)
    } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Handle Item Deletion (Single or Multi-item deletion from live order)
    if (deleteItemIds && Array.isArray(deleteItemIds) && deleteItemIds.length > 0) {
      // Check if any requested item to delete is already in preparation or ready
      const nonDeletableItems = order.items.filter(item => 
        deleteItemIds.includes(String(item._id)) && 
        ['preparing', 'decorating', 'quality_check', 'ready', 'served', 'delivered'].includes(item.status)
      );

      if (nonDeletableItems.length > 0) {
        const itemNames = nonDeletableItems.map(i => i.name).join(', ');
        return res.status(400).json({ 
          message: `Chef preparation has already started for "${itemNames}". Items in preparing or ready state cannot be deleted!` 
        });
      }

      // Remove specified items from order.items
      order.items = order.items.filter(item => !deleteItemIds.includes(String(item._id)));

      // Recalculate totalAmount from remaining items
      let updatedTotal = 0;
      for (const item of order.items) {
        let product = null;
        if (item.product) {
          try {
            product = await Product.findById(item.product);
          } catch (e) {}
        }
        const price = product?.isOffer && product?.discountPrice ? product.discountPrice : (product?.price || 0);
        updatedTotal += price * item.quantity;
      }
      order.totalAmount = updatedTotal;

      // If all items were deleted, mark order as cancelled
      if (order.items.length === 0) {
        order.status = 'cancelled';
      }
    }

    // Handle preparation timer start
    if (status === 'preparing' && order.status !== 'preparing') {
      order.preparationTimerStartedAt = Date.now();
    }

    // Set fields if provided
    if (status) order.status = status;
    if (chefNotes !== undefined) order.chefNotes = chefNotes;
    if (rejectionReason !== undefined) order.rejectionReason = rejectionReason;
    if (estimatedCompletionTime !== undefined) order.estimatedCompletionTime = estimatedCompletionTime;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentMethod) order.paymentMethod = paymentMethod;

    // Handle individual item statuses (Chef updating single items)
    if (items && Array.isArray(items)) {
      items.forEach(itemUpdate => {
        const dbItem = order.items.id(itemUpdate.itemId);
        if (dbItem) {
          dbItem.status = itemUpdate.status;
        }
      });

      // Auto update overall order status based on item statuses
      const allItemStatuses = order.items.map(i => i.status);
      const uniqueStatuses = [...new Set(allItemStatuses)];

      if (uniqueStatuses.every(s => s === 'ready')) {
        order.status = 'ready';
      } else if (uniqueStatuses.every(s => s === 'delivered')) {
        order.status = 'served';
      } else if (uniqueStatuses.some(s => s === 'preparing' || s === 'decorating' || s === 'quality_check')) {
        order.status = 'preparing';
      } else if (uniqueStatuses.some(s => s === 'accepted')) {
        order.status = 'accepted';
      }
    }

    // Check if order was just served (completed) -> Deduct stock
    const isNowServed = status === 'served' || order.status === 'served';

    await order.save();

    if (isNowServed) {
      await deductInventoryForOrder(order);
    }

    // Sync Table status
    try {
      const Table = require('../models/Table');
      let table = await Table.findOne({ tableNumber: Number(order.tableNumber) });
      if (table) {
        if (order.status === 'pending') {
          table.status = 'Ordering';
          table.orderProgress = 15;
        } else if (order.status === 'accepted') {
          table.status = 'Order Confirmed';
          table.orderProgress = 30;
        } else if (order.status === 'preparing') {
          table.status = 'Preparing';
          table.orderProgress = 60;
        } else if (order.status === 'ready') {
          table.status = 'Ready To Serve';
          table.orderProgress = 85;
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

        const { getIo } = require('../sockets');
        const io = getIo();
        io.emit('table_status_updated', table);
      }
    } catch (tblErr) {
      console.error('Failed to sync table on order PUT:', tblErr.message);
    }

    const populatedOrder = await Order.findById(order._id).populate('items.product');

    // Notify clients real-time
    notifyOrderUpdate(populatedOrder);

    res.json(populatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Close Table (Marks table as closed, sets payment to paid, marks order served, AND AUTOMATICALLY SETS TABLE TO AVAILABLE!)
router.post('/:id/close', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.paymentStatus = 'paid';
    order.paymentMethod = req.body.paymentMethod || 'Cash';
    if (order.status !== 'served') {
      order.status = 'served';
      // Background non-blocking inventory deduction for 0ms fast response
      deductInventoryForOrder(order).catch(e => console.error('Background inventory deduct error:', e.message));
    }
    await order.save();

    // Automatically set Table status to Available & reset table session!
    try {
      const Table = require('../models/Table');
      let table = await Table.findOne({ tableNumber: Number(order.tableNumber) });
      if (table) {
        table.status = 'Available';
        table.currentOrderId = null;
        table.currentOrderNumber = '';
        table.currentBill = 0;
        table.orderProgress = 0;
        table.paymentStatus = 'Paid';
        await table.save();

        const { getIo } = require('../sockets');
        const io = getIo();
        io.emit('table_status_updated', table);
      }
    } catch (tblErr) {
      console.error('Failed to set table available on order close:', tblErr.message);
    }

    const populatedOrder = await Order.findById(order._id).populate('items.product');
    notifyOrderUpdate(populatedOrder);
    res.json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/orders/bulk-delete - Admin deleting multiple orders
router.post('/bulk-delete', async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'No order IDs provided for deletion' });
    }

    await Order.deleteMany({ _id: { $in: orderIds } });

    res.json({ message: `${orderIds.length} order(s) deleted successfully`, deletedCount: orderIds.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove / Delete order by ID (Cancel order or Permanent deletion)
router.delete('/:id', async (req, res) => {
  try {
    const { permanent } = req.query;

    if (permanent === 'true') {
      const deleted = await Order.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Order not found' });
      return res.json({ message: 'Order permanently deleted', orderId: req.params.id });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (permanent !== 'true') {
      const inPreparationItems = order.items.filter(item => 
        ['preparing', 'decorating', 'quality_check', 'ready', 'served', 'delivered'].includes(item.status)
      );
      if (inPreparationItems.length > 0) {
        return res.status(400).json({ 
          message: 'Chef preparation has already started in the kitchen! Order cannot be cancelled.' 
        });
      }
    }

    order.status = 'cancelled';
    order.rejectionReason = 'Order removed / cancelled by customer/staff';
    await order.save();

    // Sync Table status to Available if no active orders remain
    try {
      const Table = require('../models/Table');
      let table = await Table.findOne({ tableNumber: Number(order.tableNumber) });
      if (table) {
        const remainingActive = await Order.find({
          tableNumber: Number(order.tableNumber),
          _id: { $ne: order._id },
          status: { $nin: ['served', 'cancelled'] }
        });
        if (remainingActive.length === 0) {
          table.status = 'Available';
          table.currentOrderId = null;
          table.currentOrderNumber = '';
          table.currentBill = 0;
          table.orderProgress = 0;
          table.paymentStatus = 'Pending';
          await table.save();

          const { getIo } = require('../sockets');
          const io = getIo();
          io.emit('table_status_updated', table);
        }
      }
    } catch (tblErr) {
      console.error('Failed to sync table status on order delete:', tblErr.message);
    }

    const populatedOrder = await Order.findById(order._id).populate('items.product');
    notifyOrderUpdate(populatedOrder);

    res.json({ message: 'Order removed successfully', order: populatedOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
