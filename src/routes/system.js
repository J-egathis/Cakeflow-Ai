const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getIo } = require('../sockets');
const { staffOnly, adminOnly } = require('../middleware/auth');

const SETTINGS_FILE = path.join(__dirname, '../../datas/settings.json');
const CATEGORIES_FILE = path.join(__dirname, '../../datas/categories.json');

// Configure Multer for Uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cat-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

const DEFAULT_CATEGORIES_MAP = {
  'Cakes': ['Birthday Cakes', 'Wedding Cakes', 'Cup Cakes', 'Pastries', 'Brownies', 'Cookies', 'Special'],
  'Snacks': ['Veg Snacks', 'Non-Veg Snacks', 'Quick Bites'],
  'Juice': ['Cold Drinks', 'Hot Drinks', 'Fresh Juice', 'Mocktails'],
  'Chats': ['Spicy Chats', 'Sweet Chats']
};

const getGstRate = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (data && typeof data.gstRate === 'number') {
        return data.gstRate;
      }
    }
  } catch (e) {}
  return 5;
};

const saveSettings = (settings) => {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {}
};

const getCategoriesData = () => {
  try {
    if (fs.existsSync(CATEGORIES_FILE)) {
      const data = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
      if (data && data.subCategoriesMap) {
        return data;
      }
    }
  } catch (e) {}
  return {
    categories: ['Cakes', 'Snacks', 'Juice', 'Chats'],
    subCategoriesMap: DEFAULT_CATEGORIES_MAP,
    categoryImages: {} // New field
  };
};

const saveCategoriesData = (data) => {
  try {
    const dir = path.dirname(CATEGORIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
};

// Upload endpoint
router.post('/upload', staffOnly, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const imageUrl = '/uploads/' + req.file.filename;
  res.json({ url: imageUrl });
});

router.get('/gst', (req, res) => {
  res.json({ gstRate: getGstRate() });
});

router.put('/gst', staffOnly, async (req, res) => {
  const { gstRate } = req.body;
  const parsed = parseFloat(gstRate);
  if (isNaN(parsed) || parsed < 0 || parsed > 50) {
    return res.status(400).json({ message: 'Invalid GST' });
  }
  saveSettings({ gstRate: parsed, updatedAt: new Date().toISOString() });

  // Update all currently UNPAID (pending/active) orders to the new GST rate.
  // Already PAID / SERVED bills remain permanently locked at their settled GST rate.
  try {
    const { Order, OrderItem, Product, Op } = require('../config/mysql');
    const unpaidOrders = await Order.findAll({
      where: {
        paymentStatus: 'unpaid',
        status: { [Op.notIn]: ['served', 'cancelled'] }
      },
      include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }]
    });
    for (const order of unpaidOrders) {
      const items = order.items || [];
      const itemsSubtotal = items.reduce((sum, item) => {
        const price = Number(item.price ?? (item.product && item.product.price) ?? 0);
        const qty = Number(item.quantity ?? 1);
        return sum + price * qty;
      }, 0);
      order.gstRate = parsed;
      order.totalAmount = Math.round((itemsSubtotal + itemsSubtotal * (parsed / 100)) * 100) / 100;
      await order.save();
    }
  } catch (e) {
    console.error('Failed to sync unpaid orders with updated GST:', e.message);
  }

  try { getIo().emit('gst_rate_updated', { gstRate: parsed }); } catch(e){}
  res.json({ success: true, gstRate: parsed });
});

router.get('/categories', (req, res) => {
  res.json(getCategoriesData());
});

router.put('/categories', staffOnly, (req, res) => {
  const { categories, subCategoriesMap, categoryImages } = req.body;
  if (!subCategoriesMap) return res.status(400).json({ message: 'Invalid payload' });

  const cats = Array.isArray(categories) && categories.length > 0 ? categories : Object.keys(subCategoriesMap);
  const currentData = getCategoriesData();
  
  const payload = {
    categories: cats,
    subCategoriesMap: subCategoriesMap,
    categoryImages: categoryImages || currentData.categoryImages || {},
    updatedAt: new Date().toISOString()
  };

  saveCategoriesData(payload);
  try { getIo().emit('categories_updated', payload); } catch(e){}
  res.json({ success: true, ...payload });
});

router.get('/lan-ip', (req, res) => {
  try {
    const ifaces = os.networkInterfaces();
    let lanIp = null;
    for (const ifaceName of Object.keys(ifaces)) {
      for (const iface of ifaces[ifaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address; break;
        }
      }
      if (lanIp) break;
    }
    const clientPort = process.env.CLIENT_PORT || 5173;
    res.json({ ip: lanIp, url: lanIp ? `http://${lanIp}:${clientPort}` : null });
  } catch (err) { res.json({ ip: null, url: null }); }
});

// ==========================================
// EMERGENCY DEMO RESET ENDPOINT
// ==========================================
router.get('/reset-demo', adminOnly, async (req, res) => {
  try {
    const { Product, CategoryMeta } = require('../config/mysql');
    
    // Wipe existing
    await Product.destroy({ where: {} });
    await CategoryMeta.destroy({ where: {} });

    const meals = {
      Breakfast: ["Dosa", "Idli", "Pongal", "Beverages"],
      Lunch: ["Meals", "Biryani", "Rice", "Curries"],
      Dinner: ["Chapati", "Parotta", "Fried Rice", "Starters"]
    };

    const foods = {
      "Dosa": [
        { name: "Masala Dosa", price: 60, desc: "Crispy dosa with spicy potato filling" },
        { name: "Ghee Roast Dosa", price: 80, desc: "Golden dosa roasted in pure ghee" },
        { name: "Onion Rava Dosa", price: 70, desc: "Thin rava crepe roasted with onions" }
      ],
      "Idli": [
        { name: "Sambar Idli", price: 45, desc: "Soft idlis soaked in delicious sambar" },
        { name: "Mini Ghee Idli", price: 55, desc: "Bite-sized idlis tossed with podi and ghee" },
        { name: "Thatte Idli", price: 40, desc: "Large flat soft idli served with chutney" }
      ],
      "Pongal": [
        { name: "Ven Pongal", price: 50, desc: "Classic South Indian breakfast with ghee and cashews" },
        { name: "Sweet Pongal", price: 60, desc: "Sweetened rice and lentil dish with jaggery" },
        { name: "Millet Pongal", price: 65, desc: "Healthy alternative made with millets" }
      ],
      "Beverages": [
        { name: "Filter Coffee", price: 25, desc: "Authentic Kumbakonam degree filter coffee" },
        { name: "Masala Tea", price: 20, desc: "Hot tea brewed with aromatic spices" },
        { name: "Fresh Juice", price: 50, desc: "Freshly squeezed seasonal fruit juice" }
      ],
      "Meals": [
        { name: "South Indian Thali", price: 120, desc: "Complete meal with rice, sambar, rasam, kootu, poriyal" },
        { name: "Mini Meals", price: 80, desc: "Quick meal combo for a light lunch" },
        { name: "Special Veg Thali", price: 150, desc: "Extensive meal with sweet, payasam and special curries" }
      ],
      "Biryani": [
        { name: "Veg Dum Biryani", price: 130, desc: "Aromatic basmati rice cooked with mixed vegetables" },
        { name: "Mushroom Biryani", price: 140, desc: "Spicy biryani with fresh mushrooms" },
        { name: "Paneer Biryani", price: 150, desc: "Rich biryani layered with soft paneer cubes" }
      ],
      "Rice": [
        { name: "Lemon Rice", price: 60, desc: "Tangy rice tempered with mustard and peanuts" },
        { name: "Curd Rice", price: 55, desc: "Cooling curd rice served with pickle" },
        { name: "Tomato Rice", price: 60, desc: "Spicy tomato flavored rice" }
      ],
      "Curries": [
        { name: "Paneer Butter Masala", price: 140, desc: "Soft paneer in rich creamy tomato gravy" },
        { name: "Dal Makhani", price: 120, desc: "Slow cooked black lentils with butter and cream" },
        { name: "Mixed Veg Curry", price: 110, desc: "Assorted vegetables in flavorful onion-tomato gravy" }
      ],
      "Chapati": [
        { name: "Soft Chapati (2 pcs)", price: 40, desc: "Soft whole wheat flatbreads" },
        { name: "Butter Roti", price: 30, desc: "Tandoori roti topped with butter" },
        { name: "Phulka (3 pcs)", price: 45, desc: "Light, oil-free puffed wheat breads" }
      ],
      "Parotta": [
        { name: "Kerala Parotta (2 pcs)", price: 50, desc: "Flaky, layered traditional parotta" },
        { name: "Kothu Parotta", price: 90, desc: "Minced parotta tossed with spices and vegetables" },
        { name: "Chilli Parotta", price: 100, desc: "Fried parotta pieces in spicy Indo-Chinese sauce" }
      ],
      "Fried Rice": [
        { name: "Veg Fried Rice", price: 110, desc: "Classic wok-tossed fried rice with veggies" },
        { name: "Schezwan Fried Rice", price: 120, desc: "Spicy fried rice with schezwan sauce" },
        { name: "Paneer Fried Rice", price: 130, desc: "Fried rice with soft paneer cubes" }
      ],
      "Starters": [
        { name: "Gobi 65", price: 90, desc: "Crispy fried cauliflower florets tossed in spices" },
        { name: "Paneer Tikka", price: 140, desc: "Marinated paneer cubes grilled in tandoor" },
        { name: "Mushroom Pepper Fry", price: 110, desc: "Spicy pan-roasted mushrooms with black pepper" }
      ]
    };

    for (const [meal, categories] of Object.entries(meals)) {
      for (const cat of categories) {
        await CategoryMeta.upsert({ name: cat, image: null, isHidden: false });
        const items = foods[cat] || [];
        for (const item of items) {
          await Product.create({
            name: item.name,
            mealType: meal,
            category: cat,
            subCategory: "General",
            price: item.price,
            description: item.desc,
            image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500",
            inStock: true,
            isHidden: false,
            stockQuantity: 100
          });
        }
      }
    }
    
    res.send(`<h1>Demo Data Successfully Reset!</h1><p>36 food items have been seeded.</p><a href="/">Go back to app</a>`);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

module.exports = router;
