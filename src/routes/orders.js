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
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }

      let category = 'Drink'; // default
      const cat = product.category.toLowerCase();
      if (cat.includes('cake') || cat.includes('pastr') || cat.includes('brownie') || cat.includes('cookie')) {
        category = 'Cake';
      } else if (cat.includes('snack')) {
        category = 'Snack';
      }

      populatedItems.push({
        product: product._id,
        quantity: item.quantity,
        instructions: item.instructions || '',
        category,
        status: 'pending'
      });
    }

    const order = new Order({
      tableNumber,
      customerName,
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
    // Find active orders (unserved or unpaid)
    const orders = await Order.find({
      tableNumber,
      $or: [
        { status: { $ne: 'served' } },
        { paymentStatus: 'unpaid' }
      ]
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
      items // Array of items with their individual preparation status updates
    } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

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
    const wasAlreadyServed = order.status === 'served' || order.status === 'delivered';
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
        } else if (order.status === 'served') {
          if (order.paymentStatus === 'paid') {
            table.status = 'Completed';
            table.paymentStatus = 'Paid';
            table.orderProgress = 100;
          } else {
            table.status = 'Payment Pending';
            table.paymentStatus = 'Pending';
            table.orderProgress = 95;
          }
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

// Close Table (Marks table as closed, sets payment to paid, and marks order served if not already)
router.post('/:id/close', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.paymentStatus = 'paid';
    if (order.status !== 'served') {
      order.status = 'served';
      await deductInventoryForOrder(order);
    }

    await order.save();
    const populatedOrder = await Order.findById(order._id).populate('items.product');
    
    notifyOrderUpdate(populatedOrder);
    res.json(populatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
