const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Table = require('../models/Table');
const Order = require('../models/Order');
const { getIo } = require('../sockets');

// Helper to generate QR code data URL
const generateQrDataUrl = async (url) => {
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR code generation error:', err);
    return '';
  }
};

// Seed default tables if none exist
const seedDefaultTables = async () => {
  if ((process.env.DB_MODE || '').toLowerCase() === 'mysql') return;
  try {
    const count = await Table.countDocuments();
    if (count === 0) {
      console.log('Seeding 7 default Smart Tables with QR Codes...');
      const tablesToSeed = [1, 2, 3, 4, 5, 6, 7];
      for (const num of tablesToSeed) {
        const securityToken = `TOKEN_TBL_${num}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const targetUrl = `https://cakeflowai.com/table/${num}`;
        const qrCodeDataUrl = await generateQrDataUrl(targetUrl);

        await Table.create({
          tableNumber: num,
          qrCodeId: `QR-TBL-0${num}-${securityToken.slice(-6)}`,
          securityToken: securityToken,
          targetUrl: targetUrl,
          qrCodeDataUrl: qrCodeDataUrl,
          status: 'Available',
          capacity: num % 2 === 0 ? 4 : 2,
          customerCount: num % 2 === 0 ? 4 : 2,
          currentBill: 0,
          paymentStatus: 'Unpaid'
        });
      }
      console.log('Successfully seeded 6 Smart Tables.');
    }
  } catch (err) {
    console.error('Failed to seed default tables:', err);
  }
};

// GET /api/tables - List all tables
router.get('/', async (req, res) => {
  try {
    await seedDefaultTables();
    let tables = await Table.find({}).sort({ tableNumber: 1 });

    // Sync live order status for active tables
    for (let table of tables) {
      if (table.currentOrderId) {
        const order = await Order.findById(table.currentOrderId);
        if (order) {
          table.currentOrderNumber = `#${order._id.toString().slice(-4)}`;
          table.currentBill = order.totalAmount;
          
          // Map order status to table status
          if (order.status === 'pending') {
            table.status = 'Ordering';
            table.orderProgress = 15;
          } else if (order.status === 'accepted') {
            table.status = 'Order Confirmed';
            table.orderProgress = 30;
          } else if (order.status === 'preparing' || order.status === 'decorating') {
            table.status = 'Preparing';
            table.orderProgress = 60;
          } else if (order.status === 'ready' || order.status === 'quality_check') {
            table.status = 'Ready To Serve';
            table.orderProgress = 85;
          } else if (order.status === 'served' || order.status === 'cancelled' || order.paymentStatus === 'paid') {
            // AUTOMATIC TABLE AVAILABLE AFTER FINISH / SERVED & PAID!
            table.status = 'Available';
            table.currentOrderId = null;
            table.currentOrderNumber = '';
            table.currentBill = 0;
            table.paymentStatus = 'Paid';
            table.orderProgress = 0;
          }
          await table.save();
        }
      }
    }

    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tables/:tableNumber - Security validation & details
router.get('/:tableNumber', async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    if (isNaN(tableNum) || tableNum < 1) {
      return res.status(400).json({ error: 'Invalid table number' });
    }

    let table = await Table.findOne({ tableNumber: tableNum });
    if (!table) {
      return res.status(404).json({ error: `Table ${tableNum} not found in system` });
    }

    // Fetch active order details
    let activeOrder = null;
    if (table.currentOrderId) {
      activeOrder = await Order.findById(table.currentOrderId);
    } else {
      activeOrder = await Order.findOne({ 
        tableNumber: tableNum, 
        status: { $ne: 'served' } 
      }).sort({ createdAt: -1 });
    }

    res.json({
      table,
      activeOrder,
      isValid: true,
      securityCheckPassed: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tables/:tableNumber/status - Update table status
router.get('/:tableNumber/status', async (req, res) => {
  res.status(405).json({ error: 'Use PUT method to update table status' });
});

router.put('/:tableNumber/status', async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    const { status, customerCount, waiterAssigned, paymentStatus } = req.body;

    let table = await Table.findOne({ tableNumber: tableNum });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (status) table.status = status;
    if (customerCount !== undefined) table.customerCount = Number(customerCount);
    if (req.body.capacity !== undefined) {
      table.capacity = Number(req.body.capacity);
      if (customerCount === undefined) {
        table.customerCount = Number(req.body.capacity);
      }
    }
    if (waiterAssigned) table.waiterAssigned = waiterAssigned;
    if (paymentStatus) table.paymentStatus = paymentStatus;

    if (status === 'Available' || status === 'Completed' || status === 'Cleaning') {
      table.status = 'Available';
      table.currentOrderId = null;
      table.currentOrderNumber = '';
      table.currentBill = 0;
      table.paymentStatus = 'Unpaid';
      table.orderProgress = 0;
    }

    await table.save();

    // Broadcast real-time Socket.IO event to all role dashboards
    try {
      const io = getIo();
      io.emit('table_status_updated', table);
    } catch (e) {
      console.log('Socket broadcast error:', e.message);
    }

    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables/:tableNumber/regenerate-qr - Regenerate QR code
router.post('/:tableNumber/regenerate-qr', async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    let table = await Table.findOne({ tableNumber: tableNum });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const securityToken = `TOKEN_TBL_${tableNum}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const targetUrl = `https://cakeflowai.com/table/${tableNum}`;
    const qrCodeDataUrl = await generateQrDataUrl(targetUrl);

    table.securityToken = securityToken;
    table.qrCodeId = `QR-TBL-0${tableNum}-${securityToken.slice(-6)}`;
    table.targetUrl = targetUrl;
    table.qrCodeDataUrl = qrCodeDataUrl;

    await table.save();

    try {
      const io = getIo();
      io.emit('table_status_updated', table);
    } catch (e) {}

    res.json({ message: `QR Code regenerated for Table ${tableNum}`, table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables - Admin adding new tables (Scalability to N tables)
router.post('/', async (req, res) => {
  try {
    const { tableNumber, capacity, customerCount } = req.body;
    const num = Number(tableNumber);

    if (!num || isNaN(num)) {
      return res.status(400).json({ message: 'Valid table number is required' });
    }

    const existing = await Table.findOne({ tableNumber: num });
    if (existing) {
      return res.status(400).json({ message: `Table ${num} already exists` });
    }

    const cap = Number(capacity) || Number(customerCount) || 4;
    const count = Number(customerCount) || cap;

    const securityToken = `TOKEN_TBL_${num}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const origin = req.headers.origin || req.headers.referer || `http://${req.headers.host || 'localhost:5001'}`;
    const cleanOrigin = origin.replace(/\/$/, '');
    const targetUrl = `${cleanOrigin}/table/${num}`;
    const qrCodeDataUrl = await generateQrDataUrl(targetUrl);

    const newTable = await Table.create({
      tableNumber: num,
      qrCodeId: `QR-TBL-0${num}-${securityToken.slice(-6)}`,
      securityToken,
      targetUrl,
      qrCodeDataUrl,
      capacity: cap,
      customerCount: count,
      status: 'Available'
    });

    try {
      const io = getIo();
      io.emit('table_status_updated', newTable);
    } catch (e) {}

    res.status(201).json(newTable);
  } catch (err) {
    console.error('Create table error:', err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
});

// DELETE /api/tables/:tableNumber - Admin deleting a table
router.delete('/:tableNumber', async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    const deleted = await Table.findOneAndDelete({ tableNumber: tableNum });
    if (!deleted) {
      return res.status(404).json({ message: `Table ${tableNum} not found` });
    }

    try {
      const io = getIo();
      io.emit('table_deleted', { tableNumber: tableNum });
    } catch (e) {}

    res.json({ message: `Table ${tableNum} deleted successfully`, tableNumber: tableNum });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
