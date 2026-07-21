const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['Flour', 'Chocolate', 'Cream', 'Milk', 'Sugar', 'Eggs', 'Butter', 'Cheese']
  },
  quantity: {
    type: Number, // in grams or pieces
    required: true,
    default: 10000
  },
  unit: {
    type: String, // g, ml, units
    required: true,
    default: 'g'
  },
  minThreshold: {
    type: Number,
    required: true,
    default: 2000
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Inventory', InventorySchema);
