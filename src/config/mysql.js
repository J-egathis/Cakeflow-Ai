const { Sequelize, DataTypes, Op } = require('sequelize');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
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
  logging: false,
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true
  }
});

// ==========================================
// 1. USER MODEL
// ==========================================
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'customer' // 'admin', 'cake_chef', 'snacks_chef', 'waiter', 'cashier', 'customer'
  },
  name: {
    type: DataTypes.STRING(100),
    defaultValue: null
  }
}, {
  tableName: 'Users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ==========================================
// 2. PRODUCT MODEL
// ==========================================
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mealType: {
      type: DataTypes.STRING(50),
      defaultValue: 'Breakfast'
    },
    category: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  subCategory: {
    type: DataTypes.STRING(100),
    defaultValue: 'General'
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ingredients: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image: { type: DataTypes.TEXT('long'), allowNull: true },
  estimatedPrepTime: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  isBestseller: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isTrending: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isOffer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  discountPrice: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  isChefRecommended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  inStock: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isHidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  stockQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  }
}, {
  tableName: 'Products',
  getterMethods: {
    _id() {
      return String(this.id);
    }
  }
});

// ==========================================
// 3. SMART TABLE MODEL
// ==========================================
const SmartTable = sequelize.define('SmartTable', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  tableNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  qrCodeId: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  securityToken: {
    type: DataTypes.STRING(255),
    defaultValue: ''
  },
  targetUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  qrCodeDataUrl: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    defaultValue: 4
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'Available'
  },
  customerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 2
  },
  currentBill: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  currentOrderNumber: {
    type: DataTypes.STRING(100),
    defaultValue: ''
  },
  currentOrderId: {
    type: DataTypes.STRING(100),
    defaultValue: null
  },
  sessionStartedAt: {
    type: DataTypes.DATE,
    defaultValue: null
  },
  elapsedTimeMins: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  estimatedRemainingMins: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  orderProgress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  paymentStatus: {
    type: DataTypes.STRING(50),
    defaultValue: 'Unpaid'
  },
  waiterAssigned: {
    type: DataTypes.STRING(100),
    defaultValue: 'Unassigned'
  },
  history: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'SmartTables',
  getterMethods: {
    _id() {
      return String(this.id);
    }
  }
});

// ==========================================
// 4. ORDER MODEL
// ==========================================
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  tableNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  customerName: {
    type: DataTypes.STRING(255),
    defaultValue: 'Guest'
  },
  totalAmount: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending' // 'pending', 'accepted', 'preparing', 'ready', 'served', 'cancelled'
  },
  chefNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejectionReason: {
    type: DataTypes.STRING(255),
    defaultValue: ''
  },
  estimatedCompletionTime: {
    type: DataTypes.DATE,
    defaultValue: null
  },
  paymentStatus: {
    type: DataTypes.STRING(50),
    defaultValue: 'unpaid' // 'unpaid', 'paid'
  },
  paymentMethod: {
      type: DataTypes.STRING(50),
      defaultValue: 'Cash'
    },
    mealType: {
      type: DataTypes.STRING(50),
      defaultValue: 'Breakfast'
    },
    gstRate: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null
    },
  preparationTimerStartedAt: {
    type: DataTypes.DATE,
    defaultValue: null
  }
}, {
  tableName: 'Orders',
  getterMethods: {
    _id() {
      return String(this.id);
    }
  }
});

// ==========================================
// 5. ORDER ITEM MODEL
// ==========================================
const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  productId: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    defaultValue: 'Cake'
  },
  round: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending' // 'pending', 'accepted', 'preparing', 'decorating', 'quality_check', 'ready', 'delivered'
  },
  kitchenDepartment: {
    type: DataTypes.STRING(50),
    defaultValue: 'cakes'
  },
  orderedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  memberId: {
    type: DataTypes.STRING(50),
    defaultValue: 'M1'
  },
  inventoryDeducted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'OrderItems',
  getterMethods: {
    _id() {
      return String(this.id);
    }
  }
});

// ==========================================
// 6. INVENTORY MODEL
// ==========================================
const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  initialQuantity: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  quantity: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  unit: {
    type: DataTypes.STRING(50),
    defaultValue: 'kg'
  },
  minThreshold: {
    type: DataTypes.FLOAT,
    defaultValue: 2
  },
  purchaseCost: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  linkedProductId: {
    type: DataTypes.INTEGER,
    defaultValue: null
  },
  linkedProductName: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  linkedProducts: {
    type: DataTypes.JSON,
    allowNull: true
  },
  expectedUnits: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  soldUnits: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  salesRevenue: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  soldBreakdown: {
    type: DataTypes.JSON,
    allowNull: true
  },
  wastageCost: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Inventories',
  getterMethods: {
    _id() {
      return String(this.id);
    }
  }
});

// ==========================================
// 7. EXPENSE MODEL (Daily Shop Expenses for Accounts & Finance)
// ==========================================
const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    defaultValue: 'Raw Materials'
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  paymentMode: {
    type: DataTypes.STRING(50),
    defaultValue: 'Cash'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expenseDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Expenses',
  getterMethods: {
    _id() {
      return String(this.id);
    }
  }
});

// ==========================================
// ASSOCIATIONS
// ==========================================
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Ensure JSON serialization always contains `_id` alongside `id` for frontend React compatibility
[User, Product, SmartTable, Order, OrderItem, Inventory, Expense].forEach(model => {
  const originalToJSON = model.prototype.toJSON;
  model.prototype.toJSON = function () {
    const values = Object.assign({}, originalToJSON ? originalToJSON.call(this) : this.get());
    if (values.id !== undefined && values._id === undefined) {
      values._id = String(values.id);
    }
    return values;
  };
});

// Function to initialize MySQL DB
// Invalidate the fast response cache on ANY write so cached lists are never stale
const { bumpDataVersion } = require('../utils/responseCache');
[Product, SmartTable, Order, OrderItem, Inventory, Expense].forEach(model => {
  ['afterCreate', 'afterUpdate', 'afterSave', 'afterDestroy', 'afterUpsert',
   'afterBulkCreate', 'afterBulkUpdate', 'afterBulkDestroy'].forEach(hookName => {
    model.addHook(hookName, () => bumpDataVersion());
  });
});

const connectMySQL = async () => {
  try {
    console.log(`Connecting to MySQL Server at ${host}:${port}...`);
    
    // Step 1: Create Database if not exists using raw mysql2
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();

    // Step 2: Authenticate & Sync Sequelize
    await sequelize.authenticate();
    console.log(`✅ MySQL Server Connected Successfully! Database: ${database}`);

    await sequelize.sync();

    
    // Manually add mealType column if it doesn't exist to prevent alter:true crashes
    try {
      await sequelize.query("ALTER TABLE Orders ADD COLUMN mealType VARCHAR(50) DEFAULT 'Breakfast';");
      console.log("✅ Added mealType column to Orders table");
    } catch (e) {
      if (!e.message.includes("Duplicate column name")) {
        console.error("Warning adding mealType column:", e.message);
      }
    }

    try {
      await sequelize.query("ALTER TABLE Products MODIFY COLUMN image LONGTEXT;");
      console.log("✅ Altered Products image column to LONGTEXT");
    } catch (e) {
      console.error("Warning altering Products image column:", e.message);
    }

    // Safe migrations for Smart Inventory & Profit/Loss Tracking + Order GST Rate Lock
    const inventoryMigrations = [
      "ALTER TABLE Orders ADD COLUMN gstRate FLOAT DEFAULT NULL;",
      "ALTER TABLE OrderItems ADD COLUMN inventoryDeducted TINYINT(1) DEFAULT 0;",
      "ALTER TABLE Inventories ADD COLUMN initialQuantity FLOAT DEFAULT 0;",
      "ALTER TABLE Inventories ADD COLUMN purchaseCost FLOAT DEFAULT 0;",
      "ALTER TABLE Inventories ADD COLUMN linkedProductId INT DEFAULT NULL;",
      "ALTER TABLE Inventories ADD COLUMN linkedProductName TEXT;",
      "ALTER TABLE Inventories MODIFY COLUMN linkedProductName TEXT;",
      "ALTER TABLE Inventories ADD COLUMN linkedProducts JSON DEFAULT NULL;",
      "ALTER TABLE Inventories ADD COLUMN expectedUnits INT DEFAULT 0;",
      "ALTER TABLE Inventories ADD COLUMN soldUnits INT DEFAULT 0;",
      "ALTER TABLE Inventories ADD COLUMN salesRevenue FLOAT DEFAULT 0;",
      "ALTER TABLE Inventories ADD COLUMN soldBreakdown JSON DEFAULT NULL;",
      "ALTER TABLE Inventories ADD COLUMN wastageCost FLOAT DEFAULT 0;"
    ];
    for (const sql of inventoryMigrations) {
      try {
        await sequelize.query(sql);
      } catch (e) {
        if (!e.message.includes("Duplicate column name")) {
          console.error("Inventory migration warning:", e.message);
        }
      }
    }

    // Performance indexes (safe to re-run; duplicates are ignored) so order/history lookups stay fast as data grows
    const indexStatements = [
      "CREATE INDEX idx_orders_createdAt ON Orders (createdAt);",
      "CREATE INDEX idx_orders_status ON Orders (status);",
      "CREATE INDEX idx_orders_payment ON Orders (paymentStatus);",
      "CREATE INDEX idx_orders_table ON Orders (tableNumber, paymentStatus, mealType);",
      "CREATE INDEX idx_orderitems_orderId ON OrderItems (orderId);",
      "CREATE INDEX idx_orderitems_productId ON OrderItems (productId);",
      "CREATE INDEX idx_expenses_date ON Expenses (expenseDate);"
    ];
    for (const sql of indexStatements) {
      try {
        await sequelize.query(sql);
      } catch (e) {
        if (!/Duplicate key name|already exists/i.test(e.message)) {
          console.error("Index migration warning:", e.message);
        }
      }
    }

    console.log(`✅ MySQL Tables Synced Successfully!`);

    return true;
  } catch (error) {
    console.error(`❌ MySQL Connection Error: ${error.message}`);
    console.log(`💡 Tip: Ensure MySQL service is running on port ${port} and MYSQL_PASSWORD in .env is correct.`);
    return false;
  }
};


const CategoryMeta = sequelize.define('CategoryMeta', { 
  name: { type: DataTypes.STRING(255), primaryKey: true }, 
  image: { type: DataTypes.TEXT('long') },
  isHidden: { type: DataTypes.BOOLEAN, defaultValue: false } 
});
// Backup copy of uploaded images (files live in /uploads; this restores them if missing)
const StoredImage = sequelize.define('StoredImage', {
  path: { type: DataTypes.STRING(255), primaryKey: true },
  mimeType: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'image/jpeg' },
  data: { type: DataTypes.TEXT('long'), allowNull: false }
}, {
  tableName: 'StoredImages'
});

module.exports = {
  StoredImage,
  CategoryMeta,
  sequelize,
  connectMySQL,
  Op,
  User,
  Product,
  SmartTable,
  Order,
  OrderItem,
  Inventory,
  Expense
};


