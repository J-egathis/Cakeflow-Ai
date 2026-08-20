-- ============================================================================
-- CakeFlow AI - Real-Time Smart Bakery & Cafe Management System
-- Database Export File for MySQL Workbench
-- Target Database: cakeflow
-- Created: 2026-07-28
-- ============================================================================
SET @old_sql_notes = @@SESSION.sql_notes;
SET SESSION sql_notes = 0;
SET FOREIGN_KEY_CHECKS = 0;
CREATE DATABASE IF NOT EXISTS `cakeflow` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cakeflow`;
-- ----------------------------------------------------------------------------
-- Table structure for `Users`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `Users`;
CREATE TABLE `Users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'staff',
  `name` VARCHAR(100) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO `Users` (
    `id`,
    `username`,
    `password`,
    `role`,
    `name`,
    `createdAt`,
    `updatedAt`
  )
VALUES (
    1,
    'admin',
    '$2a$10$w6O4xR6tT2q/6m/6A45.hO1z.c.yD3zS56v6G5v6w6v6v6v6v6v6v',
    'admin',
    'Store Owner',
    NOW(),
    NOW()
  ),
  (
    2,
    'chef',
    '$2a$10$w6O4xR6tT2q/6m/6A45.hO1z.c.yD3zS56v6G5v6w6v6v6v6v6v6v',
    'chef',
    'Head Pastry Chef',
    NOW(),
    NOW()
  ),
  (
    3,
    'cashier',
    '$2a$10$w6O4xR6tT2q/6m/6A45.hO1z.c.yD3zS56v6G5v6w6v6v6v6v6v6v',
    'cashier',
    'Front Desk Cashier',
    NOW(),
    NOW()
  );
-- ----------------------------------------------------------------------------
-- Table structure for `Products`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `Products`;
CREATE TABLE `Products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `price` DOUBLE NOT NULL,
  `description` TEXT DEFAULT NULL,
  `image` VARCHAR(500) DEFAULT NULL,
  `inStock` BOOLEAN NOT NULL DEFAULT TRUE,
  `stockQuantity` INT NOT NULL DEFAULT 100,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO `Products` (
    `id`,
    `name`,
    `category`,
    `price`,
    `description`,
    `image`,
    `inStock`,
    `stockQuantity`,
    `createdAt`,
    `updatedAt`
  )
VALUES (
    1,
    'Red Velvet Premium Cake',
    'Cakes',
    799,
    'Rich cream cheese frosted velvet sponge cake',
    'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=500',
    1,
    50,
    NOW(),
    NOW()
  ),
  (
    2,
    'Dark Chocolate Truffle Cake',
    'Cakes',
    899,
    'Pure Belgian dark chocolate ganache glaze cake',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
    1,
    50,
    NOW(),
    NOW()
  ),
  (
    3,
    'Fresh Mango Cream Cake',
    'Cakes',
    699,
    'Alphonso mango pulp infused fluffy cream cake',
    'https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=500',
    1,
    40,
    NOW(),
    NOW()
  ),
  (
    4,
    'Crispy Veg Puff Pastry',
    'Snacks',
    40,
    'Flaky baked pastry filled with spiced vegetables',
    'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500',
    1,
    100,
    NOW(),
    NOW()
  ),
  (
    5,
    'Paneer Tikka Roll',
    'Snacks',
    120,
    'Grilled marinated cottage cheese cubes in tortilla',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
    1,
    80,
    NOW(),
    NOW()
  ),
  (
    6,
    'Double Cheese Pizza Slice',
    'Snacks',
    150,
    'Loaded mozzarella and cheddar cheese slice',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
    1,
    60,
    NOW(),
    NOW()
  ),
  (
    7,
    'Fresh Cold Pressed Orange Juice',
    'Juice',
    90,
    '100% natural orange juice without added sugar',
    'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500',
    1,
    100,
    NOW(),
    NOW()
  ),
  (
    8,
    'Berry Blast Smoothie',
    'Juice',
    140,
    'Strawberry, blueberry and yogurt blend',
    'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500',
    1,
    70,
    NOW(),
    NOW()
  ),
  (
    9,
    'Pani Puri Platter (6 pcs)',
    'Chats',
    60,
    'Crispy puris filled with potato and mint water',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
    1,
    150,
    NOW(),
    NOW()
  ),
  (
    10,
    'Special Sev Puri',
    'Chats',
    80,
    'Flat puris topped with onions, chutneys and sev',
    'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500',
    1,
    120,
    NOW(),
    NOW()
  );
-- ----------------------------------------------------------------------------
-- Table structure for `SmartTables`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `SmartTables`;
CREATE TABLE `SmartTables` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableNumber` INT NOT NULL UNIQUE,
  `qrCodeId` VARCHAR(100) DEFAULT NULL,
  `securityToken` VARCHAR(255) DEFAULT NULL,
  `targetUrl` TEXT DEFAULT NULL,
  `qrCodeDataUrl` LONGTEXT DEFAULT NULL,
  `capacity` INT NOT NULL DEFAULT 4,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Available',
  `customerCount` INT NOT NULL DEFAULT 2,
  `currentBill` DOUBLE NOT NULL DEFAULT 0,
  `currentOrderNumber` VARCHAR(100) DEFAULT '',
  `currentOrderId` VARCHAR(100) DEFAULT NULL,
  `orderProgress` INT NOT NULL DEFAULT 0,
  `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
  `waiterAssigned` VARCHAR(100) DEFAULT 'Unassigned',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO `SmartTables` (
    `id`,
    `tableNumber`,
    `qrCodeId`,
    `securityToken`,
    `targetUrl`,
    `capacity`,
    `status`,
    `customerCount`,
    `currentBill`,
    `paymentStatus`,
    `createdAt`,
    `updatedAt`
  )
VALUES (
    1,
    1,
    'QR-TBL-01-FL6UCI',
    'TOKEN_TBL_1_FL6UCI',
    'http://localhost:5173/table/1',
    2,
    'Available',
    2,
    0,
    'Paid',
    NOW(),
    NOW()
  ),
  (
    2,
    2,
    'QR-TBL-02-DC3JBS',
    'TOKEN_TBL_2_DC3JBS',
    'http://localhost:5173/table/2',
    4,
    'Available',
    4,
    0,
    'Unpaid',
    NOW(),
    NOW()
  ),
  (
    3,
    3,
    'QR-TBL-03-E93EPC',
    'TOKEN_TBL_3_E93EPC',
    'http://localhost:5173/table/3',
    2,
    'Available',
    2,
    0,
    'Paid',
    NOW(),
    NOW()
  ),
  (
    4,
    4,
    'QR-TBL-04-A4FPGQ',
    'TOKEN_TBL_4_A4FPGQ',
    'http://localhost:5173/table/4',
    4,
    'Available',
    4,
    0,
    'Paid',
    NOW(),
    NOW()
  ),
  (
    5,
    5,
    'QR-TBL-05-TJ4G01',
    'TOKEN_TBL_5_TJ4G01',
    'http://localhost:5173/table/5',
    2,
    'Available',
    2,
    0,
    'Paid',
    NOW(),
    NOW()
  ),
  (
    6,
    6,
    'QR-TBL-06-XU00BG',
    'TOKEN_TBL_6_XU00BG',
    'http://localhost:5173/table/6',
    4,
    'Available',
    4,
    0,
    'Paid',
    NOW(),
    NOW()
  ),
  (
    7,
    7,
    'QR-TBL-07-GP6IH8',
    'TOKEN_TBL_7_GP6IH8',
    'http://localhost:5173/table/7',
    6,
    'Available',
    6,
    0,
    'Paid',
    NOW(),
    NOW()
  );
-- ----------------------------------------------------------------------------
-- Table structure for `Orders` & `OrderItems`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `OrderItems`;
DROP TABLE IF EXISTS `Orders`;
CREATE TABLE `Orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableNumber` INT NOT NULL,
  `customerName` VARCHAR(255) DEFAULT 'Guest',
  `totalAmount` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  `paymentMethod` VARCHAR(50) DEFAULT '',
  `rejectionReason` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE TABLE `OrderItems` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orderId` INT NOT NULL,
  `productId` INT DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `price` DOUBLE NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `round` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `kitchenDepartment` VARCHAR(50) DEFAULT 'cakes',
  `orderedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`orderId`) REFERENCES `Orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`productId`) REFERENCES `Products` (`id`) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO `Orders` (
    `id`,
    `tableNumber`,
    `customerName`,
    `totalAmount`,
    `status`,
    `paymentStatus`,
    `paymentMethod`,
    `createdAt`,
    `updatedAt`
  )
VALUES (
    1,
    1,
    'Table 1 Guest',
    939,
    'served',
    'paid',
    'Cash',
    NOW(),
    NOW()
  ),
  (
    2,
    2,
    'Table 2 Guest',
    1019,
    'served',
    'paid',
    'UPI',
    NOW(),
    NOW()
  );
INSERT INTO `OrderItems` (
    `id`,
    `orderId`,
    `productId`,
    `name`,
    `price`,
    `quantity`,
    `round`,
    `status`,
    `kitchenDepartment`,
    `orderedAt`,
    `createdAt`,
    `updatedAt`
  )
VALUES (
    1,
    1,
    1,
    'Red Velvet Premium Cake',
    799,
    1,
    1,
    'served',
    'cakes',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    2,
    1,
    8,
    'Berry Blast Smoothie',
    140,
    1,
    1,
    'served',
    'juice',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    3,
    2,
    2,
    'Dark Chocolate Truffle Cake',
    899,
    1,
    1,
    'served',
    'cakes',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    4,
    2,
    5,
    'Paneer Tikka Roll',
    120,
    1,
    1,
    'served',
    'snacks',
    NOW(),
    NOW(),
    NOW()
  );
-- ----------------------------------------------------------------------------
-- Table structure for `Inventories`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `Inventories`;
CREATE TABLE `Inventories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `quantity` DOUBLE NOT NULL DEFAULT 0,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'kg',
  `minThreshold` DOUBLE NOT NULL DEFAULT 10,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
INSERT INTO `Inventories` (
    `id`,
    `name`,
    `quantity`,
    `unit`,
    `minThreshold`,
    `createdAt`,
    `updatedAt`
  )
VALUES (
    1,
    'All-Purpose Flour (Maida)',
    150,
    'kg',
    20,
    NOW(),
    NOW()
  ),
  (
    2,
    'Granulated Sugar',
    200,
    'kg',
    25,
    NOW(),
    NOW()
  ),
  (
    3,
    'Belgian Dark Chocolate',
    45,
    'kg',
    10,
    NOW(),
    NOW()
  ),
  (4, 'Unsalted Butter', 60, 'kg', 15, NOW(), NOW()),
  (5, 'Fresh Cream', 80, 'liters', 20, NOW(), NOW());
SET FOREIGN_KEY_CHECKS = 1;
SET SESSION sql_notes = @old_sql_notes;
-- ============================================================================
-- END OF SCRIPT
-- ============================================================================