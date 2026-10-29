const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Image Store
 * -----------
 * Converts base64 data-URL images (sent by the Admin upload UI) into real image files
 * served from /uploads/<folder>/<file>. The database then stores only a short URL,
 * which keeps product/order/category API responses tiny and fast.
 *
 * Durability: a backup copy of every image is kept in the `StoredImages` MySQL table.
 * If the file is ever missing on disk (e.g. after a fresh Hostinger redeploy), it is
 * restored automatically from the database on the first request.
 */

const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

const DATA_URL_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp'
};

const SAFE_FOLDERS = new Set(['products', 'categories']);

const isDataUrlImage = (value) => typeof value === 'string' && value.startsWith('data:image/');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const getStoredImageModel = () => {
  try {
    return require('../config/mysql').StoredImage || null;
  } catch (e) {
    return null;
  }
};

/**
 * Save a base64 data-URL image to disk (+ DB backup) and return its public URL.
 * Non data-URL values (existing URLs, empty strings, null) are returned unchanged.
 */
const saveDataUrlImage = async (value, folder = 'products') => {
  if (!isDataUrlImage(value)) return value;

  const match = value.match(DATA_URL_REGEX);
  if (!match) return value;

  const mimeType = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mimeType] || 'img';
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return value;

  const safeFolder = SAFE_FOLDERS.has(folder) ? folder : 'products';
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16);
  const fileName = `${hash}.${ext}`;
  const relativePath = `${safeFolder}/${fileName}`;

  try {
    const dir = path.join(UPLOADS_ROOT, safeFolder);
    ensureDir(dir);
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }
  } catch (e) {
    console.error('⚠️ Image file write failed, keeping DB backup only:', e.message);
  }

  // DB backup so the image survives redeploys / missing uploads folder
  const StoredImage = getStoredImageModel();
  if (StoredImage) {
    try {
      await StoredImage.findOrCreate({
        where: { path: relativePath },
        defaults: { mimeType, data: match[2] }
      });
    } catch (e) {
      console.error('⚠️ Image DB backup failed:', e.message);
    }
  }

  return `/uploads/${relativePath}`;
};

/**
 * Express handler: if a requested /uploads/<folder>/<file> is missing on disk,
 * restore it from the StoredImages DB backup and serve it.
 */
const restoreMissingUpload = async (req, res, next) => {
  try {
    const folder = String(req.params.folder || '');
    const file = path.basename(String(req.params.file || ''));
    if (!SAFE_FOLDERS.has(folder) || !file) return next();

    const StoredImage = getStoredImageModel();
    if (!StoredImage) return next();

    const relativePath = `${folder}/${file}`;
    const record = await StoredImage.findByPk(relativePath);
    if (!record) return next();

    const buffer = Buffer.from(record.data, 'base64');
    try {
      const dir = path.join(UPLOADS_ROOT, folder);
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, file), buffer);
    } catch (e) {
      // Disk not writable - still serve directly from DB
    }

    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  } catch (e) {
    return next();
  }
};

/**
 * One-time startup migration: moves all existing base64 product & category images
 * out of the main tables into files (+ DB backup), replacing them with short URLs.
 */
const migrateBase64Images = async () => {
  try {
    const { Product, CategoryMeta, Op } = require('../config/mysql');
    let moved = 0;

    const products = await Product.findAll({
      where: { image: { [Op.like]: 'data:image/%' } },
      attributes: ['id', 'image']
    });
    for (const p of products) {
      const url = await saveDataUrlImage(p.image, 'products');
      if (url && url !== p.image) {
        await Product.update({ image: url }, { where: { id: p.id }, silent: true });
        moved++;
      }
    }

    if (CategoryMeta) {
      const metas = await CategoryMeta.findAll({
        where: { image: { [Op.like]: 'data:image/%' } },
        attributes: ['name', 'image']
      });
      for (const m of metas) {
        const url = await saveDataUrlImage(m.image, 'categories');
        if (url && url !== m.image) {
          await CategoryMeta.update({ image: url }, { where: { name: m.name }, silent: true });
          moved++;
        }
      }
    }

    if (moved > 0) {
      console.log(`✅ Image optimization: moved ${moved} base64 image(s) to /uploads files.`);
    }
  } catch (e) {
    console.error('⚠️ Image migration warning:', e.message);
  }
};

module.exports = {
  UPLOADS_ROOT,
  isDataUrlImage,
  saveDataUrlImage,
  restoreMissingUpload,
  migrateBase64Images
};
