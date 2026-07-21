const User = require('../models/User');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

const users = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'cakechef', password: 'chef123', role: 'cake_chef' },
  { username: 'snackschef', password: 'chef123', role: 'snacks_chef' },
  { username: 'waiter', password: 'waiter123', role: 'waiter' },
  { username: 'cashier', password: 'cashier123', role: 'cashier' }
];

const products = [
  // Birthday Cakes
  {
    name: 'Midnight Chocolate Truffle Cake',
    category: 'Birthday Cakes',
    price: 850,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 30,
    isBestseller: true,
    isTrending: true,
    isOffer: false,
    inStock: true
  },
  {
    name: 'Classic Red Velvet Cake',
    category: 'Birthday Cakes',
    price: 900,
    image: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 25,
    isBestseller: false,
    isTrending: true,
    isOffer: true,
    discountPrice: 799,
    inStock: true
  },
  // Wedding Cakes
  {
    name: 'Golden Lace Elegant 3-Tier',
    category: 'Wedding Cakes',
    price: 4500,
    image: 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 120,
    isChefRecommended: true,
    inStock: true
  },
  // Cup Cakes
  {
    name: 'Belgian Choco Lava Cupcake',
    category: 'Cup Cakes',
    price: 120,
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 10,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Strawberry Dream Cupcake',
    category: 'Cup Cakes',
    price: 95,
    image: 'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 8,
    inStock: true
  },
  // Pastries
  {
    name: 'Blueberry Glazed Cheesecake Pastry',
    category: 'Pastries',
    price: 180,
    image: 'https://images.unsplash.com/photo-1524351199679-46cddf530c04?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  // Brownies
  {
    name: 'Fudge Walnut Brownie with Hot Fudge',
    category: 'Brownies',
    price: 220,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    isTrending: true,
    inStock: true
  },
  // Cookies
  {
    name: 'Double Chocolate Chunk Cookie',
    category: 'Cookies',
    price: 80,
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  // Veg Snacks
  {
    name: 'Paneer Tikka Gourmet Puff',
    category: 'Veg Snacks',
    price: 110,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 15,
    isBestseller: true,
    inStock: true
  },
  {
    name: 'Cheesy Garlic Breadsticks',
    category: 'Veg Snacks',
    price: 150,
    image: 'https://images.unsplash.com/photo-1574085733277-851d9d856a3a?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 12,
    inStock: true
  },
  // Non-Veg Snacks
  {
    name: 'Spicy Crispy Chicken Burger',
    category: 'Non-Veg Snacks',
    price: 240,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 18,
    isBestseller: true,
    isTrending: true,
    inStock: true
  },
  // Hot Drinks
  {
    name: 'Hazelnut Latte Macchiato',
    category: 'Hot Drinks',
    price: 190,
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    isBestseller: true,
    inStock: true
  },
  // Cold Drinks
  {
    name: 'Sparkling Mint Mojito',
    category: 'Cold Drinks',
    price: 140,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 5,
    inStock: true
  },
  // Combos
  {
    name: 'Celebration Sweet & Savory Combo',
    category: 'Combos',
    price: 999,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=60',
    estimatedPrepTime: 25,
    isChefRecommended: true,
    isOffer: true,
    discountPrice: 899,
    inStock: true
  }
];

const inventory = [
  { name: 'Flour', quantity: 15000, unit: 'g', minThreshold: 3000 },
  { name: 'Chocolate', quantity: 8000, unit: 'g', minThreshold: 2000 },
  { name: 'Cream', quantity: 10000, unit: 'ml', minThreshold: 2500 },
  { name: 'Milk', quantity: 12000, unit: 'ml', minThreshold: 3000 },
  { name: 'Sugar', quantity: 14000, unit: 'g', minThreshold: 3000 },
  { name: 'Eggs', quantity: 200, unit: 'units', minThreshold: 50 },
  { name: 'Butter', quantity: 6000, unit: 'g', minThreshold: 1500 },
  { name: 'Cheese', quantity: 5000, unit: 'g', minThreshold: 1200 }
];

const seedDB = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Seeding default users...');
      for (const u of users) {
        const newUser = new User(u);
        await newUser.save();
      }
      console.log('Default users seeded successfully.');
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('Seeding default products...');
      await Product.insertMany(products);
      console.log('Default products seeded successfully.');
    }

    const inventoryCount = await Inventory.countDocuments();
    if (inventoryCount === 0) {
      console.log('Seeding default inventory items...');
      await Inventory.insertMany(inventory);
      console.log('Default inventory seeded successfully.');
    }
  } catch (error) {
    console.error(`Seeding database failed: ${error.message}`);
  }
};

module.exports = seedDB;
