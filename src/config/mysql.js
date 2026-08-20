const { Sequelize, DataTypes } = require('sequelize');
const mysql = require('mysql2/promise');
require('dotenv').config();

const host = process.env.MYSQL_HOST || 'localhost';
const port = parseInt(process.env.MYSQL_PORT) || 3306;
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || '';
const database = process.env.MYSQL_DATABASE || 'cakeflow';

// Create Sequelize instance
const sequelize = new Sequelize(database, user, password, {
  host,
  port,
  dialect: 'mysql',
  logging: false, // Set to console.log for SQL debug
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define Models
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'staff' },
  name: { type: DataTypes.STRING }
});

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.TEXT },
  image: { type: DataTypes.STRING },
  inStock: { type: DataTypes.BOOLEAN, defaultValue: true },
  stockQuantity: { type: DataTypes.INTEGER, defaultValue: 100 }
});

const SmartTable = sequelize.define('SmartTable', {
  tableNumber: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  qrCodeId: { type: DataTypes.STRING },
  securityToken: { type: DataTypes.STRING },
  targetUrl: { type: DataTypes.TEXT },
  qrCodeDataUrl: { type: DataTypes.TEXT('long') },
  capacity: { type: DataTypes.INTEGER, defaultValue: 4 },
  status: { type: DataTypes.STRING, defaultValue: 'Available' },
  customerCount: { type: DataTypes.INTEGER, defaultValue: 2 },
  currentBill: { type: DataTypes.FLOAT, defaultValue: 0 },
  currentOrderNumber: { type: DataTypes.STRING, defaultValue: '' },
  currentOrderId: { type: DataTypes.STRING, defaultValue: null },
  orderProgress: { type: DataTypes.INTEGER, defaultValue: 0 },
  paymentStatus: { type: DataTypes.STRING, defaultValue: 'Unpaid' },
  waiterAssigned: { type: DataTypes.STRING, defaultValue: 'Unassigned' }
});

const Order = sequelize.define('Order', {
  tableNumber: { type: DataTypes.INTEGER, allowNull: false },
  customerName: { type: DataTypes.STRING, defaultValue: 'Guest' },
  totalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  paymentStatus: { type: DataTypes.STRING, defaultValue: 'unpaid' },
  paymentMethod: { type: DataTypes.STRING, defaultValue: '' },
  rejectionReason: { type: DataTypes.STRING }
});

const OrderItem = sequelize.define('OrderItem', {
  productId: { type: DataTypes.INTEGER },
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  round: { type: DataTypes.INTEGER, defaultValue: 1 },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  kitchenDepartment: { type: DataTypes.STRING, defaultValue: 'cakes' },
  orderedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const Inventory = sequelize.define('Inventory', {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  quantity: { type: DataTypes.FLOAT, defaultValue: 0 },
  unit: { type: DataTypes.STRING, defaultValue: 'kg' },
  minThreshold: { type: DataTypes.FLOAT, defaultValue: 10 }
});

// Associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Function to initialize MySQL DB
const connectMySQL = async () => {
  try {
    console.log(`Connecting to MySQL Server at ${host}:${port}...`);
    
    // Step 1: Create Database if not exists using raw mysql2
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await connection.end();

    // Step 2: Authenticate & Sync Sequelize
    await sequelize.authenticate();
    console.log(`✅ MySQL Server Connected Successfully! Database: ${database}`);

    await sequelize.sync({ alter: true });
    console.log(`✅ MySQL Tables Synced Successfully!`);

    return true;
  } catch (error) {
    console.error(`❌ MySQL Connection Error: ${error.message}`);
    console.log(`💡 Tip: Make sure your MySQL Windows Service (MySQL80) is running, or set MYSQL_PASSWORD in .env!`);
    return false;
  }
};

module.exports = {
  sequelize,
  connectMySQL,
  User,
  Product,
  SmartTable,
  Order,
  OrderItem,
  Inventory
};
