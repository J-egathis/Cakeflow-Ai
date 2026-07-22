const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const auth = require('../middleware/auth');
const { notifyInventoryUpdate } = require('../sockets');

// Get all inventory items (Admin or Chefs)
router.get('/', auth(['admin', 'cake_chef', 'snacks_chef']), async (req, res) => {
  try {
    const items = await Inventory.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new inventory item (Admin only)
router.post('/', auth(['admin']), async (req, res) => {
  try {
    const { name, quantity, unit, minThreshold } = req.body;
    if (!name || quantity === undefined) {
      return res.status(400).json({ message: 'Name and quantity are required' });
    }

    const existing = await Inventory.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: `Ingredient '${name}' already exists in inventory!` });
    }

    const newItem = new Inventory({
      name,
      quantity: Number(quantity),
      unit: unit || 'g',
      minThreshold: Number(minThreshold) || 1000,
      lastUpdated: Date.now()
    });

    await newItem.save();
    notifyInventoryUpdate(newItem);

    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update specific inventory item quantity (Admin or Chefs)
router.put('/:id', auth(['admin', 'cake_chef', 'snacks_chef']), async (req, res) => {
  const { quantity, minThreshold } = req.body;

  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Ingredient not found' });

    if (quantity !== undefined) item.quantity = quantity;
    if (minThreshold !== undefined) item.minThreshold = minThreshold;
    item.lastUpdated = Date.now();
    await item.save();

    // Notify real-time socket
    notifyInventoryUpdate(item);

    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Batch refill all ingredients to 15,000g / 200 units (Admin only)
router.post('/refill', auth(['admin']), async (req, res) => {
  try {
    const items = await Inventory.find();
    for (const item of items) {
      if (item.name === 'Eggs') {
        item.quantity = 250;
      } else {
        item.quantity = 15000;
      }
      item.lastUpdated = Date.now();
      await item.save();
      notifyInventoryUpdate(item);
    }
    res.json({ message: 'All ingredients refilled successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
