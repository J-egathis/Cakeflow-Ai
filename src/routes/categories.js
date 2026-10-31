const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { CategoryMeta, Product, OrderItem, Inventory, Op } = require('../config/mysql');
const { getIo } = require('../sockets');
const { staffOnly, adminOnly } = require('../middleware/auth');
const { isDataUrlImage, saveDataUrlImage } = require('../utils/imageStore');

// Convert an uploaded base64 category image into a fast static file URL before saving
const normalizeCategoryImage = async (body) => {
  if (body && isDataUrlImage(body.image)) {
    body.image = await saveDataUrlImage(body.image, 'categories');
  }
  return body;
};

const CATEGORIES_FILE = path.join(__dirname, '../../datas/categories.json');

const readCategoriesConfig = () => {
  try {
    if (fs.existsSync(CATEGORIES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
      return {
        mealCategories: Array.isArray(parsed.mealCategories) && parsed.mealCategories.length > 0
          ? parsed.mealCategories
          : ['Breakfast', 'Lunch', 'Dinner'],
        hiddenMealCategories: Array.isArray(parsed.hiddenMealCategories) ? parsed.hiddenMealCategories : [],
        categoryMealMap: parsed.categoryMealMap && typeof parsed.categoryMealMap === 'object' ? parsed.categoryMealMap : {},
        ...parsed
      };
    }
  } catch (e) {}
  return {
    mealCategories: ['Breakfast', 'Lunch', 'Dinner'],
    hiddenMealCategories: [],
    categoryMealMap: {}
  };
};

const writeCategoriesConfig = (data) => {
  try {
    const dir = path.dirname(CATEGORIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
};

// Permanently delete categories and all products inside them (plus any legacy 'Uncategorized' items)
const permanentlyDeleteCategories = async (categoryNames = []) => {
  const names = [...new Set([...categoryNames, 'Uncategorized'].map(n => (n || '').trim()).filter(Boolean))];
  if (names.length === 0) return;

  // Find all products matching these categories
  const productsToDelete = await Product.findAll({
    where: { category: { [Op.in]: names } },
    attributes: ['id']
  });
  const productIds = productsToDelete.map(p => p.id).filter(Boolean);

  if (productIds.length > 0) {
    if (OrderItem) {
      await OrderItem.update(
        { productId: null },
        { where: { productId: { [Op.in]: productIds } } }
      );
    }
    if (Inventory) {
      try {
        await Inventory.update(
          { linkedProductId: null },
          { where: { linkedProductId: { [Op.in]: productIds } } }
        );
      } catch (e) {}
    }
    await Product.destroy({ where: { id: { [Op.in]: productIds } } });
  }

  // Delete category metadata permanently
  await CategoryMeta.destroy({ where: { name: { [Op.in]: names } } });

  // Also clean from datas/categories.json if present
  try {
    if (fs.existsSync(CATEGORIES_FILE)) {
      const data = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
      let changed = false;
      if (Array.isArray(data.categories)) {
        const filtered = data.categories.filter(c => !names.includes(c));
        if (filtered.length !== data.categories.length) {
          data.categories = filtered;
          changed = true;
        }
      }
      if (data.subCategoriesMap && typeof data.subCategoriesMap === 'object') {
        for (const n of names) {
          if (n in data.subCategoriesMap) {
            delete data.subCategoriesMap[n];
            changed = true;
          }
        }
      }
      if (data.categoryImages && typeof data.categoryImages === 'object') {
        for (const n of names) {
          if (n in data.categoryImages) {
            delete data.categoryImages[n];
            changed = true;
          }
        }
      }
      if (changed) {
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2));
      }
    }
  } catch (e) {}
};

// Get all meal categories
router.get('/meals', async (req, res) => {
  try {
    const config = readCategoriesConfig();
    const products = await Product.findAll({ attributes: ['mealType'], group: ['mealType'] });
    const productMeals = products.map(p => (p.mealType || '').trim()).filter(Boolean);
    const allMeals = Array.from(new Set([...(config.mealCategories || ['Breakfast', 'Lunch', 'Dinner']), ...productMeals]));
    if (allMeals.length !== (config.mealCategories || []).length) {
      config.mealCategories = allMeals;
      writeCategoriesConfig(config);
    }
    const hiddenSet = new Set(config.hiddenMealCategories || []);
    res.json({
      mealCategories: allMeals,
      hiddenMealCategories: config.hiddenMealCategories || [],
      items: allMeals.map(m => ({ name: m, isHidden: hiddenSet.has(m) }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new meal category
router.post('/meals', staffOnly, async (req, res) => {
  try {
    const cleanName = (req.body.name || '').trim();
    if (!cleanName) return res.status(400).json({ message: 'Meal category name is required' });

    const config = readCategoriesConfig();
    const meals = Array.isArray(config.mealCategories) ? config.mealCategories : ['Breakfast', 'Lunch', 'Dinner'];
    if (!meals.some(m => m.toLowerCase() === cleanName.toLowerCase())) {
      meals.push(cleanName);
      config.mealCategories = meals;
      writeCategoriesConfig(config);
    }

    try { const io = getIo(); if (io) { io.emit('category:updated'); io.emit('product:updated'); } } catch (e) {}
    res.json({ message: 'Meal category added', mealCategories: config.mealCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Edit / Rename or Hide / Unhide a meal category
router.put('/meals/:name', staffOnly, async (req, res) => {
  try {
    const oldName = (req.params.name || '').trim();
    const { newName, isHidden } = req.body;
    const config = readCategoriesConfig();
    let meals = Array.isArray(config.mealCategories) ? [...config.mealCategories] : ['Breakfast', 'Lunch', 'Dinner'];
    let hidden = Array.isArray(config.hiddenMealCategories) ? [...config.hiddenMealCategories] : [];
    const catMealMap = { ...(config.categoryMealMap || {}) };

    const targetName = newName && newName.trim() ? newName.trim() : oldName;

    if (newName && targetName !== oldName) {
      meals = meals.map(m => (m === oldName ? targetName : m));
      if (!meals.includes(targetName)) meals.push(targetName);
      hidden = hidden.map(m => (m === oldName ? targetName : m));
      Object.keys(catMealMap).forEach(cat => {
        if (catMealMap[cat] === oldName) catMealMap[cat] = targetName;
      });
      await Product.update({ mealType: targetName }, { where: { mealType: oldName } });
    }

    if (isHidden !== undefined) {
      if (isHidden) {
        if (!hidden.includes(targetName)) hidden.push(targetName);
      } else {
        hidden = hidden.filter(m => m !== targetName);
      }
    }

    config.mealCategories = Array.from(new Set(meals));
    config.hiddenMealCategories = hidden;
    config.categoryMealMap = catMealMap;
    writeCategoriesConfig(config);

    try { const io = getIo(); if (io) { io.emit('category:updated'); io.emit('product:updated'); } } catch (e) {}
    res.json({ message: 'Meal category updated', mealCategories: config.mealCategories, hiddenMealCategories: config.hiddenMealCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a meal category
router.delete('/meals/:name', staffOnly, async (req, res) => {
  try {
    const mealName = (req.params.name || '').trim();
    if (!mealName) return res.status(400).json({ message: 'Meal category name is required' });

    const config = readCategoriesConfig();
    config.mealCategories = (config.mealCategories || []).filter(m => m !== mealName);
    config.hiddenMealCategories = (config.hiddenMealCategories || []).filter(m => m !== mealName);

    // Find products belonging specifically to this mealType
    const mealProducts = await Product.findAll({ where: { mealType: mealName }, attributes: ['id', 'category'] });
    const mealProductIds = mealProducts.map(p => p.id).filter(Boolean);
    const candidateCats = new Set(mealProducts.map(p => (p.category || '').trim()).filter(Boolean));

    if (config.categoryMealMap) {
      Object.keys(config.categoryMealMap).forEach(c => {
        if (config.categoryMealMap[c] === mealName) {
          candidateCats.add(c);
          delete config.categoryMealMap[c];
        }
      });
    }
    writeCategoriesConfig(config);

    // Delete only products that belong to this deleted mealType
    if (mealProductIds.length > 0) {
      if (OrderItem) {
        await OrderItem.update({ productId: null }, { where: { productId: { [Op.in]: mealProductIds } } });
      }
      if (Inventory) {
        try {
          await Inventory.update({ linkedProductId: null }, { where: { linkedProductId: { [Op.in]: mealProductIds } } });
        } catch (e) {}
      }
      await Product.destroy({ where: { id: { [Op.in]: mealProductIds } } });
    }

    // Only delete CategoryMeta for categories that have NO remaining products in other meal types
    if (candidateCats.size > 0) {
      const catArray = Array.from(candidateCats);
      const remainingProducts = await Product.findAll({
        where: { category: { [Op.in]: catArray } },
        attributes: ['category']
      });
      const stillUsedCats = new Set(remainingProducts.map(p => (p.category || '').trim()).filter(Boolean));
      const unusedCats = catArray.filter(c => !stillUsedCats.has(c));
      if (unusedCats.length > 0) {
        await permanentlyDeleteCategories(unusedCats);
      }
    }

    try { const io = getIo(); if (io) { io.emit('category:updated'); io.emit('product:updated'); } } catch (e) {}
    res.json({ message: `Meal category "${mealName}" deleted`, mealCategories: config.mealCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get daily item targets (for Sold & Unsold Tracker)
router.get('/targets', async (req, res) => {
  try {
    const config = readCategoriesConfig();
    res.json(config.dailyTargets && typeof config.dailyTargets === 'object' ? config.dailyTargets : {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update daily item targets (single item or full map)
router.put('/targets', staffOnly, async (req, res) => {
  try {
    const config = readCategoriesConfig();
    const currentTargets = config.dailyTargets && typeof config.dailyTargets === 'object' ? { ...config.dailyTargets } : {};

    if (req.body.resetAll) {
      config.dailyTargets = {};
    } else if (req.body.targets && typeof req.body.targets === 'object') {
      config.dailyTargets = req.body.targets;
    } else if (req.body.key) {
      const { key, target, manualSold, clear } = req.body;
      if (clear) {
        delete currentTargets[key];
      } else {
        currentTargets[key] = {
          ...(currentTargets[key] || {}),
          ...(target !== undefined ? { target: Math.max(0, Number(target) || 0) } : {}),
          ...(manualSold !== undefined ? { manualSold: manualSold === null ? null : Math.max(0, Number(manualSold) || 0) } : {}),
          updatedAt: new Date().toISOString()
        };
      }
      config.dailyTargets = currentTargets;
    }

    writeCategoriesConfig(config);
    try { const io = getIo(); if (io) io.emit('targets:updated', config.dailyTargets || {}); } catch (e) {}
    res.json(config.dailyTargets || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all Chef Unsold Food Reports
router.get('/unsold-reports', async (req, res) => {
  try {
    const config = readCategoriesConfig();
    res.json(Array.isArray(config.unsoldReports) ? config.unsoldReports : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Chef reports unsold food directly to Admin
router.post('/unsold-reports', staffOnly, async (req, res) => {
  try {
    const { productId, foodName, category, mealType, price, unsoldQty, reportedBy, note } = req.body;
    const cleanName = (foodName || '').trim();
    const qty = Math.max(1, parseInt(unsoldQty, 10) || 0);
    if (!cleanName || qty <= 0) {
      return res.status(400).json({ message: 'Food name and unsold quantity are required' });
    }

    const config = readCategoriesConfig();
    const reports = Array.isArray(config.unsoldReports) ? [...config.unsoldReports] : [];

    const newReport = {
      id: `unsold_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: productId || null,
      foodName: cleanName,
      category: category || 'General',
      mealType: mealType || 'Breakfast',
      price: Number(price) || 0,
      unsoldQty: qty,
      reportedBy: reportedBy || 'Kitchen Chef',
      note: (note || '').trim(),
      createdAt: new Date().toISOString()
    };

    reports.unshift(newReport);
    config.unsoldReports = reports;
    writeCategoriesConfig(config);

    try {
      const io = getIo();
      if (io) {
        io.emit('chef_unsold_report', newReport);
        io.emit('unsold_reports_updated', reports);
      }
    } catch (e) {}

    res.status(201).json(newReport);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a single unsold report or clear all
router.delete('/unsold-reports/:id', staffOnly, async (req, res) => {
  try {
    const reportId = req.params.id;
    const config = readCategoriesConfig();
    const reports = Array.isArray(config.unsoldReports) ? config.unsoldReports : [];
    config.unsoldReports = reportId === 'all' ? [] : reports.filter(r => r.id !== reportId);
    writeCategoriesConfig(config);

    try {
      const io = getIo();
      if (io) io.emit('unsold_reports_updated', config.unsoldReports);
    } catch (e) {}

    res.json({ success: true, unsoldReports: config.unsoldReports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all category metadata - syncs with active product categories & cleans up legacy 'Uncategorized'
router.get('/', async (req, res) => {
  try {
    // Clean up any legacy 'Uncategorized' products/categories (only when they actually exist)
    const legacyCount = await Product.count({ where: { category: 'Uncategorized' } });
    const legacyMeta = await CategoryMeta.count({ where: { name: 'Uncategorized' } });
    if (legacyCount > 0 || legacyMeta > 0) {
      await permanentlyDeleteCategories(['Uncategorized']);
    }

    let metas = await CategoryMeta.findAll();
    const products = await Product.findAll({ attributes: ['category', 'mealType'] });
    const prodMealByCat = {};
    products.forEach(p => {
      const c = (p.category || '').trim();
      if (c && c !== 'Uncategorized' && !prodMealByCat[c] && p.mealType) {
        prodMealByCat[c] = p.mealType;
      }
    });
    const uniqueCats = [...new Set(products.map(p => (p.category || '').trim()).filter(c => c && c !== 'Uncategorized'))];

    const existingMetaNames = new Set(metas.map(m => m.name));
    let added = false;
    for (const name of uniqueCats) {
      if (!existingMetaNames.has(name)) {
        await CategoryMeta.upsert({ name, image: null, isHidden: false });
        added = true;
      }
    }
    if (added) {
      metas = await CategoryMeta.findAll();
    }

    const config = readCategoriesConfig();
    const catMealMap = config.categoryMealMap || {};
    const enriched = metas.map(m => {
      const plain = m.toJSON ? m.toJSON() : m;
      return {
        ...plain,
        mealType: catMealMap[plain.name] || prodMealByCat[plain.name] || 'Breakfast'
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upsert a category image or create new
router.post('/', staffOnly, async (req, res) => {
  try {
    await normalizeCategoryImage(req.body);
    const { name, image, isHidden, mealType } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name required' });
    const cleanName = name.trim();

    const [meta] = await CategoryMeta.upsert({
      name: cleanName,
      image: image || null,
      isHidden: isHidden || false
    });

    if (mealType && mealType.trim()) {
      const cleanMeal = mealType.trim();
      const config = readCategoriesConfig();
      config.categoryMealMap = { ...(config.categoryMealMap || {}), [cleanName]: cleanMeal };
      if (!config.mealCategories.includes(cleanMeal)) {
        config.mealCategories.push(cleanMeal);
      }
      writeCategoriesConfig(config);
      await Product.update({ mealType: cleanMeal }, { where: { category: cleanName } });
    }

    try { const io = getIo(); if (io) { io.emit('product:updated'); io.emit('category:updated'); } } catch (e) {}
    res.json({ message: 'Category updated', meta });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update/Rename a category
router.put('/:name', staffOnly, async (req, res) => {
  try {
    const oldName = req.params.name;
    await normalizeCategoryImage(req.body);
    const { newName, isHidden, image, mealType } = req.body;

    const category = await CategoryMeta.findByPk(oldName);
    if (!category && !newName) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const finalCatName = (newName && newName.trim()) ? newName.trim() : oldName;

    // If renaming
    if (newName && finalCatName !== oldName) {
      // 1. Upsert new category meta
      await CategoryMeta.upsert({
        name: finalCatName,
        image: image !== undefined ? image : (category ? category.image : null),
        isHidden: isHidden !== undefined ? isHidden : (category ? category.isHidden : false)
      });
      // 2. Update all products to new category (and mealType if provided)
      const updatePayload = { category: finalCatName };
      if (mealType && mealType.trim()) {
        updatePayload.mealType = mealType.trim();
      }
      await Product.update(updatePayload, { where: { category: oldName } });
      // 3. Delete old category meta
      if (category) {
        await category.destroy();
      }
    } else {
      // Just updating visibility, image, or mealType
      if (category) {
        if (isHidden !== undefined) category.isHidden = isHidden;
        if (image !== undefined) category.image = image;
        await category.save();
      } else {
        await CategoryMeta.create({ name: oldName, isHidden, image });
      }
      if (mealType && mealType.trim()) {
        await Product.update({ mealType: mealType.trim() }, { where: { category: oldName } });
      }
    }

    // Update categoryMealMap in config
    const config = readCategoriesConfig();
    config.categoryMealMap = { ...(config.categoryMealMap || {}) };
    if (finalCatName !== oldName && config.categoryMealMap[oldName]) {
      const prevMeal = config.categoryMealMap[oldName];
      delete config.categoryMealMap[oldName];
      config.categoryMealMap[finalCatName] = prevMeal;
    }
    if (mealType && mealType.trim()) {
      const cleanMeal = mealType.trim();
      config.categoryMealMap[finalCatName] = cleanMeal;
      if (!config.mealCategories.includes(cleanMeal)) {
        config.mealCategories.push(cleanMeal);
      }
    }
    writeCategoriesConfig(config);

    try { const io = getIo(); if (io) { io.emit('product:updated'); io.emit('category:updated'); } } catch (e) {}
    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Permanently delete a category and all food items in that category
router.delete('/:name', staffOnly, async (req, res) => {
  try {
    const name = (req.params.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    await permanentlyDeleteCategories([name]);

    try {
      const io = getIo();
      if (io) {
        io.emit('product:updated', { deletedCategory: name });
        io.emit('product:deleted', { deletedCategory: name });
        io.emit('category:updated', { deletedCategory: name });
      }
    } catch (e) {}

    res.json({ message: `Category "${name}" and its products were permanently deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
