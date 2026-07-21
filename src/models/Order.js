const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  instructions: {
    type: String,
    default: ''
  },
  category: {
    type: String, // e.g. "Cake", "Snack", "Drink"
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'preparing', 'decorating', 'quality_check', 'ready', 'delivered'],
    default: 'pending'
  }
});

const OrderSchema = new mongoose.Schema({
  tableNumber: {
    type: Number,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  items: [OrderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'pending'
  },
  chefNotes: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    enum: ['', 'Out of Stock', 'Machine Issue', 'Kitchen Busy', 'Ingredient Missing'],
    default: ''
  },
  estimatedCompletionTime: {
    type: Date
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Split'],
    default: 'Cash'
  },
  preparationTimerStartedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
