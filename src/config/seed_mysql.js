const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { User, Product, SmartTable, Inventory, Op } = require('./mysql');

const STAFF_CREDENTIALS_FILE = path.join(__dirname, '../../datas/staff_credentials.json');

const generateQrDataUrl = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      width: 400,
      margin: 2,
      color: { dark: '#1E1818', light: '#ffffff' }
    });
  } catch (err) {
    return '';
  }
};

const seedMySQL = async () => {
  try {
    // 1. Seed Users
    let savedStaffCreds = null;
    try {
      if (fs.existsSync(STAFF_CREDENTIALS_FILE)) {
        savedStaffCreds = JSON.parse(fs.readFileSync(STAFF_CREDENTIALS_FILE, 'utf8'));
      }
    } catch (e) {}

    const envPasswords = {
      admin: process.env.ADMIN_PASSWORD,
      chef: process.env.CHEF_PASSWORD,
      waiter: process.env.WAITER_PASSWORD,
      cashier: process.env.CASHIER_PASSWORD,
      customer: process.env.CUSTOMER_PASSWORD
    };
    const demoPasswords = { admin: 'admin123', chef: 'chef123', waiter: 'waiter123', cashier: 'cashier123', customer: 'customer123' };

    const defaultUsers = [
      { username: savedStaffCreds?.admin?.username || 'admin', group: 'admin', role: 'admin', name: 'Store Owner' },
      { username: savedStaffCreds?.chef?.username || 'chef', group: 'chef', role: 'cake_chef', name: 'Head Chef' },
      { username: savedStaffCreds?.servant?.username || 'waiter', group: 'waiter', role: 'waiter', name: 'Table Servant' },
      { username: 'cashier', group: 'cashier', role: 'cashier', name: 'Front Desk Cashier' },
      { username: 'customer', group: 'customer', role: 'customer', name: 'Table 1 Guest' }
    ];

    for (const { group, ...u } of defaultUsers) {
      if (group === 'admin' && savedStaffCreds?.admin?.username && savedStaffCreds?.admin?.password) {
        const existingAdmin = await User.findOne({ where: { role: 'admin' }, order: [['id', 'ASC']] });
        if (!existingAdmin) {
          const password = await bcrypt.hash(savedStaffCreds.admin.password, 10);
          await User.create({ ...u, username: savedStaffCreds.admin.username, password });
        }
        continue;
      }
      if (group === 'chef' && savedStaffCreds?.chef?.username && savedStaffCreds?.chef?.password) {
        const existingChef = await User.findOne({ where: { role: { [Op.in]: ['cake_chef', 'snacks_chef'] } }, order: [['id', 'ASC']] });
        if (!existingChef) {
          const password = await bcrypt.hash(savedStaffCreds.chef.password, 10);
          await User.create({ ...u, username: savedStaffCreds.chef.username, password });
        }
        continue;
      }
      if (group === 'waiter' && savedStaffCreds?.servant?.username && savedStaffCreds?.servant?.password) {
        const existingServant = await User.findOne({ where: { role: 'waiter' }, order: [['id', 'ASC']] });
        if (!existingServant) {
          const password = await bcrypt.hash(savedStaffCreds.servant.password, 10);
          await User.create({ ...u, username: savedStaffCreds.servant.username, password });
        }
        continue;
      }

      const envPass = envPasswords[group];
      const existing = await User.findOne({ where: { username: u.username } });
      if (!existing) {
        const password = await bcrypt.hash(envPass || demoPasswords[group], 10);
        await User.create({ ...u, password });
      } else if (envPass && !(await existing.comparePassword(envPass))) {
        existing.password = await bcrypt.hash(envPass, 10);
        await existing.save();
        console.log(`🔑 Password updated from .env for user: ${u.username}`);
      }
    }
    if (!envPasswords.admin) {
      console.warn('⚠️ ADMIN_PASSWORD not set in .env. Default demo admin password may still be active!');
    }
    console.log('✅ Default users verified in MySQL.');

    // 2. Seed Products
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('Seeding demo categories and products in MySQL...');
      
      const { CategoryMeta } = require('./mysql');
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
      console.log('✅ Demo products and categories seeded.');
    }

    // 3. Seed Tables
    const tableCount = await SmartTable.count();
    if (tableCount === 0) {
      console.log('Seeding default Smart Tables in MySQL...');
      const tablesToSeed = [1, 2, 3, 4, 5, 6, 7];
      for (const num of tablesToSeed) {
        const securityToken = `TOKEN_TBL_${num}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const targetUrl = `http://localhost:5173/table/${num}`;
        const qrCodeDataUrl = await generateQrDataUrl(targetUrl);

        await SmartTable.create({
          tableNumber: num,
          qrCodeId: `QR-TBL-0${num}-${securityToken.slice(-6)}`,
          securityToken,
          targetUrl,
          qrCodeDataUrl,
          capacity: num % 2 === 0 ? 4 : 2,
          customerCount: num % 2 === 0 ? 4 : 2,
          status: 'Available',
          currentBill: 0,
          paymentStatus: 'Unpaid'
        });
      }
      console.log('✅ Default Smart Tables seeded in MySQL.');
    }

    // 4. Seed Inventory
    const invCount = await Inventory.count();
    if (invCount === 0) {
      console.log('Seeding default inventory items in MySQL...');
      await Inventory.bulkCreate([
        { name: 'Flour', quantity: 25000, unit: 'g', minThreshold: 5000 },
        { name: 'Sugar', quantity: 20000, unit: 'g', minThreshold: 4000 },
        { name: 'Belgian Dark Chocolate', quantity: 15000, unit: 'g', minThreshold: 2000 },
        { name: 'Chocolate', quantity: 15000, unit: 'g', minThreshold: 2000 },
        { name: 'Unsalted Butter', quantity: 10000, unit: 'g', minThreshold: 2000 },
        { name: 'Butter', quantity: 10000, unit: 'g', minThreshold: 2000 },
        { name: 'Fresh Cream', quantity: 12000, unit: 'ml', minThreshold: 2000 },
        { name: 'Cream', quantity: 12000, unit: 'ml', minThreshold: 2000 },
        { name: 'Milk', quantity: 15000, unit: 'ml', minThreshold: 3000 },
        { name: 'Cheese', quantity: 8000, unit: 'g', minThreshold: 1500 },
        { name: 'Eggs', quantity: 200, unit: 'units', minThreshold: 40 }
      ]);
      console.log('✅ Default inventory seeded in MySQL.');
    }
  } catch (err) {
    console.error('MySQL Seed Error:', err.message);
  }
};

module.exports = seedMySQL;
