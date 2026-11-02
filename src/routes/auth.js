const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { User, StoredImage, Op } = require('../config/mysql');
const auth = require('../middleware/auth');
const { adminOnly, optionalAuth, STAFF_ROLES } = require('../middleware/auth');
const JWT_SECRET = require('../config/jwtSecret');

const STAFF_CREDENTIALS_FILE = path.join(__dirname, '../../datas/staff_credentials.json');
const STAFF_CONFIG_DB_KEY = '__staff_credentials_config__';

const getDefaultStaffCredentials = () => ({
  admin: {
    username: 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    updatedAt: null
  },
  chef: {
    username: 'chef',
    password: process.env.CHEF_PASSWORD || 'chef123',
    updatedAt: null
  },
  servant: {
    username: 'waiter',
    password: process.env.WAITER_PASSWORD || 'waiter123',
    updatedAt: null
  }
});

const readStaffCredentialsFile = () => {
  try {
    if (fs.existsSync(STAFF_CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(STAFF_CREDENTIALS_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
};

const writeStaffCredentialsFile = (config) => {
  try {
    const dir = path.dirname(STAFF_CREDENTIALS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const nextJson = JSON.stringify(config, null, 2);
    if (fs.existsSync(STAFF_CREDENTIALS_FILE)) {
      const currentJson = fs.readFileSync(STAFF_CREDENTIALS_FILE, 'utf8').trim();
      if (currentJson === nextJson.trim()) return;
    }
    fs.writeFileSync(STAFF_CREDENTIALS_FILE, nextJson);
  } catch (e) {
    console.error('Failed to save staff_credentials.json:', e.message);
  }
};

const pickLatestRoleCreds = (dbEntry, fileEntry, defaultEntry) => {
  const dbTime = dbEntry?.updatedAt ? new Date(dbEntry.updatedAt).getTime() : 0;
  const fileTime = fileEntry?.updatedAt ? new Date(fileEntry.updatedAt).getTime() : 0;

  let chosen = defaultEntry;
  if (dbTime > 0 && dbTime >= fileTime && dbEntry?.username && dbEntry?.password) {
    chosen = dbEntry;
  } else if (fileTime > 0 && fileTime > dbTime && fileEntry?.username && fileEntry?.password) {
    chosen = fileEntry;
  } else if (dbEntry?.username && dbEntry?.password) {
    chosen = dbEntry;
  } else if (fileEntry?.username && fileEntry?.password) {
    chosen = fileEntry;
  }

  return {
    username: String(chosen.username || defaultEntry.username).trim(),
    password: String(chosen.password || defaultEntry.password).trim(),
    updatedAt: chosen.updatedAt || null
  };
};

const loadStaffCredentialsConfig = async () => {
  const defaults = getDefaultStaffCredentials();
  const fileData = readStaffCredentialsFile();
  let dbData = null;

  try {
    const dbRecord = await StoredImage.findOne({ where: { path: STAFF_CONFIG_DB_KEY } });
    if (dbRecord && dbRecord.data) {
      dbData = JSON.parse(dbRecord.data);
    }
  } catch (e) {}

  const merged = {
    admin: pickLatestRoleCreds(dbData?.admin, fileData?.admin, defaults.admin),
    chef: pickLatestRoleCreds(dbData?.chef, fileData?.chef, defaults.chef),
    servant: pickLatestRoleCreds(dbData?.servant, fileData?.servant, defaults.servant)
  };

  return merged;
};

const saveStaffCredentialsConfig = async (config) => {
  writeStaffCredentialsFile(config);
  try {
    await StoredImage.upsert({
      path: STAFF_CONFIG_DB_KEY,
      mimeType: 'application/json',
      data: JSON.stringify(config)
    });
  } catch (e) {
    console.error('Failed to persist staff credentials in MySQL:', e.message);
  }
};

const syncStaffUsersToConfig = async (config) => {
  // 1. Sync Admin User
  let adminUser = await User.findOne({
    where: { role: 'admin' },
    order: [['id', 'ASC']]
  });

  await User.destroy({
    where: {
      [Op.and]: [
        adminUser ? { id: { [Op.ne]: adminUser.id } } : {},
        { role: { [Op.notIn]: ['cake_chef', 'snacks_chef', 'waiter', 'cashier'] } },
        {
          [Op.or]: [
            { username: { [Op.like]: config.admin.username } },
            { role: 'admin' }
          ]
        }
      ]
    }
  });

  if (adminUser) {
    const passMatches = await adminUser.comparePassword(config.admin.password);
    if (
      adminUser.username !== config.admin.username ||
      !passMatches ||
      adminUser.role !== 'admin'
    ) {
      adminUser.username = config.admin.username;
      adminUser.password = await bcrypt.hash(config.admin.password, 10);
      adminUser.role = 'admin';
      adminUser.name = 'Store Owner';
      await adminUser.save();
    }
  } else {
    const hashedPassword = await bcrypt.hash(config.admin.password, 10);
    adminUser = await User.create({
      username: config.admin.username,
      password: hashedPassword,
      role: 'admin',
      name: 'Store Owner'
    });
  }

  // 2. Sync Chef User
  let chefUser = await User.findOne({
    where: { role: { [Op.in]: ['cake_chef', 'snacks_chef'] } },
    order: [['id', 'ASC']]
  });

  await User.destroy({
    where: {
      [Op.and]: [
        chefUser ? { id: { [Op.ne]: chefUser.id } } : {},
        { role: { [Op.notIn]: ['admin', 'waiter', 'cashier'] } },
        {
          [Op.or]: [
            { username: { [Op.like]: config.chef.username } },
            { role: { [Op.in]: ['cake_chef', 'snacks_chef'] } }
          ]
        }
      ]
    }
  });

  if (chefUser) {
    const passMatches = await chefUser.comparePassword(config.chef.password);
    if (
      chefUser.username !== config.chef.username ||
      !passMatches ||
      chefUser.role !== 'cake_chef'
    ) {
      chefUser.username = config.chef.username;
      chefUser.password = await bcrypt.hash(config.chef.password, 10);
      chefUser.role = 'cake_chef';
      chefUser.name = 'Head Chef';
      await chefUser.save();
    }
  } else {
    const hashedPassword = await bcrypt.hash(config.chef.password, 10);
    chefUser = await User.create({
      username: config.chef.username,
      password: hashedPassword,
      role: 'cake_chef',
      name: 'Head Chef'
    });
  }

  // 3. Sync Servant (Waiter) User
  let servantUser = await User.findOne({
    where: { role: 'waiter' },
    order: [['id', 'ASC']]
  });

  await User.destroy({
    where: {
      [Op.and]: [
        servantUser ? { id: { [Op.ne]: servantUser.id } } : {},
        { role: { [Op.notIn]: ['admin', 'cake_chef', 'snacks_chef', 'cashier'] } },
        {
          [Op.or]: [
            { username: { [Op.like]: config.servant.username } },
            { role: 'waiter' }
          ]
        }
      ]
    }
  });

  if (servantUser) {
    const passMatches = await servantUser.comparePassword(config.servant.password);
    if (
      servantUser.username !== config.servant.username ||
      !passMatches ||
      servantUser.role !== 'waiter'
    ) {
      servantUser.username = config.servant.username;
      servantUser.password = await bcrypt.hash(config.servant.password, 10);
      servantUser.role = 'waiter';
      servantUser.name = 'Table Servant';
      await servantUser.save();
    }
  } else {
    const hashedPassword = await bcrypt.hash(config.servant.password, 10);
    servantUser = await User.create({
      username: config.servant.username,
      password: hashedPassword,
      role: 'waiter',
      name: 'Table Servant'
    });
  }

  return { adminUser, chefUser, servantUser };
};

// Register a new user (Admin only - prevents anyone creating their own admin account)
router.post('/register', adminOnly, async (req, res) => {
  const { username, password, role, name } = req.body;

  try {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    if (role && ![...STAFF_ROLES, 'customer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    let user = await User.findOne({
      where: {
        username: { [Op.like]: cleanUsername }
      }
    });

    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = await User.create({
      username: cleanUsername,
      password,
      role: role || 'customer',
      name: name || cleanUsername
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        _id: String(user.id),
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login User - Strictly validates against the exact Staff Logins configuration (Admin, Chef, Servant)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const cleanUsername = (username || '').trim();
    const cleanPassword = (password || '').trim();
    if (!cleanUsername || !cleanPassword) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const staffConfig = await loadStaffCredentialsConfig();

    let matchedTarget = null;
    if (
      cleanUsername.toLowerCase() === staffConfig.admin.username.toLowerCase() &&
      (password === staffConfig.admin.password || cleanPassword === staffConfig.admin.password)
    ) {
      matchedTarget = 'admin';
    } else if (
      cleanUsername.toLowerCase() === staffConfig.chef.username.toLowerCase() &&
      (password === staffConfig.chef.password || cleanPassword === staffConfig.chef.password)
    ) {
      matchedTarget = 'chef';
    } else if (
      cleanUsername.toLowerCase() === staffConfig.servant.username.toLowerCase() &&
      (password === staffConfig.servant.password || cleanPassword === staffConfig.servant.password)
    ) {
      matchedTarget = 'servant';
    } else {
      // Check if username matched one of the roles but password was wrong
      const usernameMatchedRole =
        cleanUsername.toLowerCase() === staffConfig.admin.username.toLowerCase() ||
        cleanUsername.toLowerCase() === staffConfig.chef.username.toLowerCase() ||
        cleanUsername.toLowerCase() === staffConfig.servant.username.toLowerCase();

      if (usernameMatchedRole) {
        return res.status(400).json({ message: 'Invalid password. Please enter the exact password set in Staff Logins.' });
      }
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const { adminUser, chefUser, servantUser } = await syncStaffUsersToConfig(staffConfig);
    const user =
      matchedTarget === 'admin'
        ? adminUser
        : matchedTarget === 'chef'
        ? chefUser
        : servantUser;

    const assignedRole =
      matchedTarget === 'admin'
        ? 'admin'
        : matchedTarget === 'chef'
        ? 'cake_chef'
        : 'waiter';

    const payload = {
      id: String(user.id),
      _id: String(user.id),
      username: staffConfig[matchedTarget].username,
      role: assignedRole,
      name: user.name
    };

    const token = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: payload
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get current Admin, Chef & Servant credentials (Admin Dashboard)
router.get('/staff-credentials', optionalAuth, async (req, res) => {
  try {
    const config = await loadStaffCredentialsConfig();
    await saveStaffCredentialsConfig(config);
    await syncStaffUsersToConfig(config);
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Admin, Chef or Servant username & password individually (Admin Dashboard)
router.put('/staff-credentials', optionalAuth, async (req, res) => {
  const { target, username, password } = req.body;

  try {
    if (target !== 'admin' && target !== 'chef' && target !== 'servant') {
      return res.status(400).json({ message: 'Invalid target. Must be admin, chef, or servant.' });
    }

    const cleanUsername = (username || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername || !cleanPassword) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const config = await loadStaffCredentialsConfig();
    const otherTargets = ['admin', 'chef', 'servant'].filter(t => t !== target);
    for (const other of otherTargets) {
      if (config[other]?.username?.toLowerCase() === cleanUsername.toLowerCase()) {
        const label = other === 'admin' ? 'Admin' : other === 'chef' ? 'Chef' : 'Servant';
        return res.status(400).json({
          message: `Username "${cleanUsername}" is already assigned to ${label}. Please choose a distinct username.`
        });
      }
    }

    config[target] = {
      username: cleanUsername,
      password: cleanPassword,
      updatedAt: new Date().toISOString()
    };

    await saveStaffCredentialsConfig(config);
    await syncStaffUsersToConfig(config);

    const roleLabel = target === 'admin' ? 'Admin' : target === 'chef' ? 'Chef' : 'Servant';
    res.json({
      message: `${roleLabel} credentials updated successfully!`,
      admin: config.admin,
      chef: config.chef,
      servant: config.servant
    });
  } catch (error) {
    console.error('Update staff credentials error:', error);
    res.status(500).json({ message: error.message || 'Failed to update credentials' });
  }
});

// Get current user details
router.get('/me', auth(), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.loadStaffCredentialsConfig = loadStaffCredentialsConfig;
router.saveStaffCredentialsConfig = saveStaffCredentialsConfig;
router.syncStaffUsersToConfig = syncStaffUsersToConfig;

module.exports = router;
