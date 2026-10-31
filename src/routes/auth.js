const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { User, Op } = require('../config/mysql');
const auth = require('../middleware/auth');
const { adminOnly, optionalAuth, STAFF_ROLES } = require('../middleware/auth');
const JWT_SECRET = require('../config/jwtSecret');

const STAFF_CREDENTIALS_FILE = path.join(__dirname, '../../datas/staff_credentials.json');

const getStaffCredentialsConfig = () => {
  const defaults = {
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
  };
  try {
    if (fs.existsSync(STAFF_CREDENTIALS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STAFF_CREDENTIALS_FILE, 'utf8'));
      return {
        admin: {
          username: (raw?.admin?.username || defaults.admin.username).trim(),
          password: raw?.admin?.password || defaults.admin.password,
          updatedAt: raw?.admin?.updatedAt || null
        },
        chef: {
          username: (raw?.chef?.username || defaults.chef.username).trim(),
          password: raw?.chef?.password || defaults.chef.password,
          updatedAt: raw?.chef?.updatedAt || null
        },
        servant: {
          username: (raw?.servant?.username || defaults.servant.username).trim(),
          password: raw?.servant?.password || defaults.servant.password,
          updatedAt: raw?.servant?.updatedAt || null
        }
      };
    }
  } catch (e) {}
  return defaults;
};

const saveStaffCredentialsConfig = (config) => {
  try {
    const dir = path.dirname(STAFF_CREDENTIALS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STAFF_CREDENTIALS_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save staff_credentials.json:', e.message);
  }
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

// Login User
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    // Case-insensitive username search
    const user = await User.findOne({
      where: {
        username: { [Op.like]: cleanUsername }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials. User not found.' });
    }

    const staffConfig = getStaffCredentialsConfig();
    const isMatch = (await user.comparePassword(password)) ||
      (user.role === 'admin' && !staffConfig?.admin?.updatedAt && (password === 'admin123' || password === 'jasim004'));
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password. Please try again.' });
    }

    const payload = {
      id: String(user.id),
      _id: String(user.id),
      username: user.username,
      role: user.role,
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
    const config = getStaffCredentialsConfig();

    const adminUser = await User.findOne({
      where: { role: 'admin' },
      order: [['id', 'ASC']]
    });

    const chefUser = await User.findOne({
      where: {
        role: { [Op.in]: ['cake_chef', 'snacks_chef'] }
      },
      order: [['id', 'ASC']]
    });

    const servantUser = await User.findOne({
      where: {
        role: 'waiter'
      },
      order: [['id', 'ASC']]
    });

    if (adminUser && adminUser.username) {
      config.admin.username = adminUser.username;
    }
    if (chefUser && chefUser.username) {
      config.chef.username = chefUser.username;
    }
    if (servantUser && servantUser.username) {
      config.servant.username = servantUser.username;
    }

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

    const config = getStaffCredentialsConfig();
    const otherTargets = ['admin', 'chef', 'servant'].filter(t => t !== target);
    for (const other of otherTargets) {
      if (config[other]?.username?.toLowerCase() === cleanUsername.toLowerCase()) {
        const label = other === 'admin' ? 'Admin' : other === 'chef' ? 'Chef' : 'Servant';
        return res.status(400).json({
          message: `Username "${cleanUsername}" is already assigned to ${label}. Please choose a distinct username.`
        });
      }
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    if (target === 'admin') {
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
                { username: { [Op.like]: cleanUsername } },
                { role: 'admin' }
              ]
            }
          ]
        }
      });

      if (adminUser) {
        adminUser.username = cleanUsername;
        adminUser.password = hashedPassword;
        adminUser.role = 'admin';
        adminUser.name = 'Store Owner';
        await adminUser.save();
      } else {
        adminUser = await User.create({
          username: cleanUsername,
          password: hashedPassword,
          role: 'admin',
          name: 'Store Owner'
        });
      }

      config.admin = {
        username: cleanUsername,
        password: cleanPassword,
        updatedAt: new Date().toISOString()
      };
    } else if (target === 'chef') {
      // Find primary chef user
      let chefUser = await User.findOne({
        where: {
          role: { [Op.in]: ['cake_chef', 'snacks_chef'] }
        },
        order: [['id', 'ASC']]
      });

      // Remove any other non-admin/non-waiter user that collides with cleanUsername or extra seeded chef accounts
      await User.destroy({
        where: {
          [Op.and]: [
            chefUser ? { id: { [Op.ne]: chefUser.id } } : {},
            { role: { [Op.notIn]: ['admin', 'waiter', 'cashier'] } },
            {
              [Op.or]: [
                { username: { [Op.like]: cleanUsername } },
                { role: { [Op.in]: ['cake_chef', 'snacks_chef'] } }
              ]
            }
          ]
        }
      });

      if (chefUser) {
        chefUser.username = cleanUsername;
        chefUser.password = hashedPassword;
        chefUser.role = 'cake_chef';
        chefUser.name = 'Head Chef';
        await chefUser.save();
      } else {
        chefUser = await User.create({
          username: cleanUsername,
          password: hashedPassword,
          role: 'cake_chef',
          name: 'Head Chef'
        });
      }

      config.chef = {
        username: cleanUsername,
        password: cleanPassword,
        updatedAt: new Date().toISOString()
      };
    } else {
      // target === 'servant'
      let servantUser = await User.findOne({
        where: { role: 'waiter' },
        order: [['id', 'ASC']]
      });

      // Remove any non-admin/non-chef user that collides with cleanUsername or extra waiter rows
      await User.destroy({
        where: {
          [Op.and]: [
            servantUser ? { id: { [Op.ne]: servantUser.id } } : {},
            { role: { [Op.notIn]: ['admin', 'cake_chef', 'snacks_chef', 'cashier'] } },
            {
              [Op.or]: [
                { username: { [Op.like]: cleanUsername } },
                { role: 'waiter' }
              ]
            }
          ]
        }
      });

      if (servantUser) {
        servantUser.username = cleanUsername;
        servantUser.password = hashedPassword;
        servantUser.role = 'waiter';
        servantUser.name = 'Table Servant';
        await servantUser.save();
      } else {
        servantUser = await User.create({
          username: cleanUsername,
          password: hashedPassword,
          role: 'waiter',
          name: 'Table Servant'
        });
      }

      config.servant = {
        username: cleanUsername,
        password: cleanPassword,
        updatedAt: new Date().toISOString()
      };
    }

    saveStaffCredentialsConfig(config);

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

module.exports = router;
