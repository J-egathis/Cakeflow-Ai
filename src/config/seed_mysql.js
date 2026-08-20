const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { User, Product, SmartTable, Inventory } = require('./mysql');

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
    // Seed Users
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('Seeding default users in MySQL...');
      const adminPass = await bcrypt.hash('admin123', 10);
      const chefPass = await bcrypt.hash('chef123', 10);
      const cashierPass = await bcrypt.hash('cashier123', 10);

      await User.bulkCreate([
        { username: 'admin', password: adminPass, role: 'admin', name: 'Store Owner' },
        { username: 'chef', password: chefPass, role: 'chef', name: 'Head Pastry Chef' },
        { username: 'cashier', password: cashierPass, role: 'cashier', name: 'Front Desk Cashier' }
      ]);
      console.log('✅ Default users seeded in MySQL.');
    }

    // Seed Products
    const productCount = await Product.count();
    if (productCount === 0) {
      console.log('Seeding default products in MySQL...');
      await Product.bulkCreate([
        { name: 'Red Velvet Premium Cake', category: 'Cakes', price: 799, description: 'Rich cream cheese frosted velvet sponge cake', image: 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=500', inStock: true, stockQuantity: 50 },
        { name: 'Dark Chocolate Truffle Cake', category: 'Cakes', price: 899, description: 'Pure Belgian dark chocolate ganache glaze cake', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500', inStock: true, stockQuantity: 50 },
        { name: 'Fresh Mango Cream Cake', category: 'Cakes', price: 699, description: 'Alphonso mango pulp infused fluffy cream cake', image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=500', inStock: true, stockQuantity: 40 },
        { name: 'Crispy Veg Puff Pastry', category: 'Snacks', price: 40, description: 'Flaky baked pastry filled with spiced vegetables', image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500', inStock: true, stockQuantity: 100 },
        { name: 'Paneer Tikka Roll', category: 'Snacks', price: 120, description: 'Grilled marinated cottage cheese cubes in tortilla', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500', inStock: true, stockQuantity: 80 },
        { name: 'Double Cheese Pizza Slice', category: 'Snacks', price: 150, description: 'Loaded mozzarella and cheddar cheese slice', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500', inStock: true, stockQuantity: 60 },
        { name: 'Fresh Cold Pressed Orange Juice', category: 'Juice', price: 90, description: '100% natural orange juice without added sugar', image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', inStock: true, stockQuantity: 100 },
        { name: 'Berry Blast Smoothie', category: 'Juice', price: 140, description: 'Strawberry, blueberry and yogurt blend', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500', inStock: true, stockQuantity: 70 },
        { name: 'Pani Puri Platter (6 pcs)', category: 'Chats', price: 60, description: 'Crispy puris filled with potato and mint water', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500', inStock: true, stockQuantity: 150 },
        { name: 'Special Sev Puri', category: 'Chats', price: 80, description: 'Flat puris topped with onions, chutneys and sev', image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500', inStock: true, stockQuantity: 120 }
      ]);
      console.log('✅ Default products seeded in MySQL.');
    }

    // Seed Tables
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
          capacity: 4,
          status: 'Available'
        });
      }
      console.log('✅ Default Smart Tables seeded in MySQL.');
    }

    // Seed Inventory
    const invCount = await Inventory.count();
    if (invCount === 0) {
      console.log('Seeding default inventory items in MySQL...');
      await Inventory.bulkCreate([
        { name: 'All-Purpose Flour (Maida)', quantity: 150, unit: 'kg', minThreshold: 20 },
        { name: 'Granulated Sugar', quantity: 200, unit: 'kg', minThreshold: 25 },
        { name: 'Belgian Dark Chocolate', quantity: 45, unit: 'kg', minThreshold: 10 },
        { name: 'Unsalted Butter', quantity: 60, unit: 'kg', minThreshold: 15 },
        { name: 'Fresh Cream', quantity: 80, unit: 'liters', minThreshold: 20 }
      ]);
      console.log('✅ Default inventory seeded in MySQL.');
    }
  } catch (err) {
    console.error('MySQL Seed Error:', err.message);
  }
};

module.exports = seedMySQL;
