const express = require('express');
const router = express.Router();
const { Product, OrderItem, Inventory, CategoryMeta, Op } = require('../config/mysql');
const { getIo } = require('../sockets');
const { staffOnly, adminOnly } = require('../middleware/auth');
const { isDataUrlImage, saveDataUrlImage } = require('../utils/imageStore');

// Convert an uploaded base64 image into a fast static file URL before saving
const normalizeImageField = async (body) => {
  if (body && isDataUrlImage(body.image)) {
    body.image = await saveDataUrlImage(body.image, 'products');
  }
  return body;
};

// Get all products with search and filter options
router.get('/', async (req, res) => {
  try {
    // Auto-clean any legacy 'Uncategorized' products left behind from previous category deletions
    const uncategorizedCount = await Product.count({ where: { category: 'Uncategorized' } });
    const uncategorizedProducts = uncategorizedCount > 0
      ? await Product.findAll({ where: { category: 'Uncategorized' }, attributes: ['id'] })
      : [];
    if (uncategorizedProducts.length > 0) {
      const uncatIds = uncategorizedProducts.map(p => p.id).filter(Boolean);
      if (OrderItem) {
        await OrderItem.update({ productId: null }, { where: { productId: { [Op.in]: uncatIds } } });
      }
      if (Inventory) {
        try {
          await Inventory.update({ linkedProductId: null }, { where: { linkedProductId: { [Op.in]: uncatIds } } });
        } catch (e) {}
      }
      await Product.destroy({ where: { id: { [Op.in]: uncatIds } } });
      if (CategoryMeta) {
        await CategoryMeta.destroy({ where: { name: 'Uncategorized' } });
      }
    }

    const { category, search, trending, bestseller, offer } = req.query;
    let where = {};

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    if (trending === 'true') {
      where.isTrending = true;
    }

    if (bestseller === 'true') {
      where.isBestseller = true;
    }

    if (offer === 'true') {
      where.isOffer = true;
    }

    const products = await Product.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create product (Admin only / Live broadcast)
router.post('/', staffOnly, async (req, res) => {
  try {
    await normalizeImageField(req.body);
    const savedProduct = await Product.create(req.body);
    
    // Auto-create category meta if it's a new category
    if (savedProduct.category) {
      await CategoryMeta.findOrCreate({ where: { name: savedProduct.category }, defaults: { isHidden: false } });
    }

    try {
      const io = getIo();
      io.emit('product:created', savedProduct);
      io.emit('product:updated', savedProduct);
    } catch (e) {
      console.log('Socket emit error on product create:', e.message);
    }

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update product (Hide/Unhide, Stock, Price, Details, etc.)
router.put('/:id', staffOnly, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    await normalizeImageField(req.body);
    await product.update(req.body);

    if (req.body.category) {
      await CategoryMeta.findOrCreate({ where: { name: req.body.category }, defaults: { isHidden: false } });
    }

    try {
      const io = getIo();
      io.emit('product:updated', product);

      if (req.body.inStock !== undefined) {
        const alertData = {
          productId: product.id,
          productName: product.name,
          category: product.category,
          inStock: product.inStock,
          updatedBy: req.body.updatedBy || 'Kitchen Chef',
          timestamp: new Date().toISOString()
        };
        io.emit('kitchen_stock_alert', alertData);
      }
    } catch (e) {
      console.log('Socket emit error on product update:', e.message);
    }

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete product (Admin only / Live broadcast)
router.delete('/:id', staffOnly, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Remove reference from OrderItems & Inventory to prevent Foreign Key constraint error
    if (OrderItem) {
      await OrderItem.update(
        { productId: null },
        { where: { productId: req.params.id } }
      );
    }
    if (Inventory) {
      try {
        await Inventory.update(
          { linkedProductId: null },
          { where: { linkedProductId: req.params.id } }
        );
      } catch (e) {}
    }

    await product.destroy();

    try {
      const io = getIo();
      io.emit('product:deleted', { id: req.params.id, _id: String(req.params.id) });
      io.emit('product:updated', { id: req.params.id, _id: String(req.params.id), isDeleted: true });
    } catch (e) {
      console.log('Socket emit error on product delete:', e.message);
    }

    res.json({ message: 'Product deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
