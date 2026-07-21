const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  tableNumber: {
    type: Number,
    required: true,
    unique: true
  },
  qrCodeId: {
    type: String,
    required: true,
    unique: true
  },
  qrCodeDataUrl: {
    type: String,
    default: ''
  },
  securityToken: {
    type: String,
    required: true
  },
  targetUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: [
      'Available',
      'Occupied',
      'Ordering',
      'Order Confirmed',
      'Preparing',
      'Ready To Serve',
      'Serving',
      'Payment Pending',
      'Completed',
      'Cleaning'
    ],
    default: 'Available'
  },
  currentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  currentOrderNumber: {
    type: String,
    default: ''
  },
  customerCount: {
    type: Number,
    default: 2
  },
  currentBill: {
    type: Number,
    default: 0
  },
  capacity: {
    type: Number,
    default: 4
  },
  sessionStartedAt: {
    type: Date,
    default: null
  },
  elapsedTimeMins: {
    type: Number,
    default: 0
  },
  estimatedRemainingMins: {
    type: Number,
    default: 0
  },
  orderProgress: {
    type: Number,
    default: 0 // 0 to 100 percentage
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Pending', 'Paid'],
    default: 'Unpaid'
  },
  waiterAssigned: {
    type: String,
    default: 'Unassigned'
  },
  history: [
    {
      orderId: String,
      customerName: String,
      totalAmount: Number,
      completedAt: Date
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Table', TableSchema);
