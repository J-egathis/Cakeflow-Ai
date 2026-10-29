const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { SmartTable, Order, OrderItem, Product, Op } = require('../config/mysql');
const { getIo } = require('../sockets');
const { staffOnly, adminOnly } = require('../middleware/auth');

// Helper to generate QR code data URL
const generateQrDataUrl = async (url) => {
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
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

// GET /api/tables - List all tables
router.get('/', async (req, res) => {
  try {
    let tables = await SmartTable.findAll({ order: [['tableNumber', 'ASC']] });

    // Batch-sync live order status for active tables
    const activeOrderIds = tables.map(t => t.currentOrderId).filter(Boolean);
    if (activeOrderIds.length > 0) {
      const orders = await Order.findAll({ where: { id: activeOrderIds } });
      const orderMap = new Map(orders.map(o => [String(o.id), o]));

      await Promise.all(
        tables.map(async (table) => {
          if (!table.currentOrderId) return;
          const order = orderMap.get(String(table.currentOrderId));
          if (!order) return;

          table.currentOrderNumber = `#${String(order.id).padStart(4, '0')}`;
          table.currentBill = order.totalAmount;

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
            table.status = 'Available';
            table.currentOrderId = null;
            table.currentOrderNumber = '';
            table.currentBill = 0;
            table.paymentStatus = 'Paid';
            table.orderProgress = 0;
          }
          if (table.changed()) {
            await table.save();
          }
        })
      );
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

    let table = await SmartTable.findOne({ where: { tableNumber: tableNum } });
    if (!table) {
      return res.status(404).json({ error: `Table ${tableNum} not found in system` });
    }

    // Fetch active order details
    let activeOrder = null;
    if (table.currentOrderId) {
      activeOrder = await Order.findByPk(table.currentOrderId, {
        include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
      });
    } else {
      activeOrder = await Order.findOne({
        where: {
          tableNumber: tableNum,
          status: { [Op.notIn]: ['served', 'cancelled'] }
        },
        include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }],
        order: [['createdAt', 'DESC']]
      });
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

router.put('/:tableNumber/status', staffOnly, async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    const { status, customerCount, waiterAssigned, paymentStatus } = req.body;

    let table = await SmartTable.findOne({ where: { tableNumber: tableNum } });
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
router.post('/:tableNumber/regenerate-qr', staffOnly, async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    let table = await SmartTable.findOne({ where: { tableNumber: tableNum } });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const securityToken = `TOKEN_TBL_${tableNum}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const origin = req.headers.origin || req.headers.referer || `http://${req.headers.host || 'localhost:5173'}`;
    const cleanOrigin = origin.replace(/\/$/, '');
    const targetUrl = `${cleanOrigin}/table/${tableNum}`;
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

// POST /api/tables - Admin adding new tables
router.post('/', staffOnly, async (req, res) => {
  try {
    const { tableNumber, capacity, customerCount } = req.body;
    const num = Number(tableNumber);

    if (!num || isNaN(num)) {
      return res.status(400).json({ message: 'Valid table number is required' });
    }

    const existing = await SmartTable.findOne({ where: { tableNumber: num } });
    if (existing) {
      return res.status(400).json({ message: `Table ${num} already exists` });
    }

    const cap = Number(capacity) || Number(customerCount) || 4;
    const count = Number(customerCount) || cap;

    const securityToken = `TOKEN_TBL_${num}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const origin = req.headers.origin || req.headers.referer || `http://${req.headers.host || 'localhost:5173'}`;
    const cleanOrigin = origin.replace(/\/$/, '');
    const targetUrl = `${cleanOrigin}/table/${num}`;
    const qrCodeDataUrl = await generateQrDataUrl(targetUrl);

    const newTable = await SmartTable.create({
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

// POST /api/tables/bulk-delete - Admin bulk deleting multiple tables
router.post('/bulk-delete', staffOnly, async (req, res) => {
  try {
    const { tableNumbers } = req.body;
    if (!Array.isArray(tableNumbers) || tableNumbers.length === 0) {
      return res.status(400).json({ message: 'No table numbers provided for bulk delete' });
    }

    const nums = tableNumbers.map(n => parseInt(n)).filter(n => !isNaN(n));
    if (nums.length === 0) {
      return res.status(400).json({ message: 'Invalid table numbers' });
    }

    await SmartTable.destroy({ where: { tableNumber: { [Op.in]: nums } } });

    try {
      const io = getIo();
      nums.forEach(num => io.emit('table_deleted', { tableNumber: num }));
    } catch (e) {}

    res.json({ message: `${nums.length} tables deleted successfully`, tableNumbers: nums });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/tables/:tableNumber - Admin deleting a table
router.delete('/:tableNumber', staffOnly, async (req, res) => {
  try {
    const tableNum = parseInt(req.params.tableNumber);
    const table = await SmartTable.findOne({ where: { tableNumber: tableNum } });
    if (!table) {
      return res.status(404).json({ message: `Table ${tableNum} not found` });
    }

    await table.destroy();

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
