const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  ingredients: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  estimatedPrepTime: {
    type: Number,
    default: 15
  },
  isBestseller: {
    type: Boolean,
    default: false
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  isOffer: {
    type: Boolean,
    default: false
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  isChefRecommended: {
    type: Boolean,
    default: false
  },
  inStock: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', ProductSchema);
