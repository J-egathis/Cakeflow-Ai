const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Birthday Cakes',
      'Wedding Cakes',
      'Cup Cakes',
      'Pastries',
      'Brownies',
      'Cookies',
      'Veg Snacks',
      'Non-Veg Snacks',
      'Hot Drinks',
      'Cold Drinks',
      'Combos'
    ]
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String, // Base64 or Image URL
    required: true
  },
  estimatedPrepTime: {
    type: Number, // in minutes
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
