const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectMySQL } = require('./src/config/mysql');
const seedMySQL = require('./src/config/seed_mysql');
const { initSockets } = require('./src/sockets');
const { UPLOADS_ROOT, restoreMissingUpload, migrateBase64Images } = require('./src/utils/imageStore');

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
initSockets(io);

// Initialize MySQL Database
connectMySQL().then((success) => {
  if (success) {
    seedMySQL();
    // Move any legacy base64 images out of the DB rows into fast static files
    migrateBase64Images();
  } else {
    console.error('⚠️ MySQL Connection failed. Please check MySQL server and .env credentials.');
  }
});

// Middleware
// Gzip all responses (JS bundle, API JSON) for fast loading. Safe fallback if module missing.
try {
  const compression = require('compression');
  app.use(compression());
} catch (e) {
  console.warn('⚠️ compression module not installed - responses will not be gzipped.');
}
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve uploaded images statically (filenames are content-hashed, so cache them long-term)
app.use('/uploads', express.static(UPLOADS_ROOT, { maxAge: '365d', immutable: true }));
// If an image file is missing on disk (e.g. after a fresh redeploy), restore it from the DB backup
app.get('/uploads/:folder/:file', restoreMissingUpload);
app.use('/uploads', (req, res) => res.status(404).end());

// Serve static assets from Vite client in production
// Hashed files in /assets are cached long-term; index.html is always revalidated so updates show instantly.
app.use(express.static(path.join(__dirname, 'client/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Never return index.html for missing static asset chunks
app.use('/assets', (req, res) => res.status(404).end());

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/inventory', require('./src/routes/inventory'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/accounts', require('./src/routes/accounts'));
app.use('/api/tables', require('./src/routes/tables'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/system', require('./src/routes/system'));

// Fallback to React index.html for SPA routing in client (never cache HTML so new builds load immediately)
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'client/dist/index.html'), (err) => {
    if (err) {
      res.status(200).send('CakeFlow AI Server is running (MySQL Backend).');
    }
  });
});

// Define Port
const PORT = process.env.PORT || 5001;

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CakeFlow AI Backend running on port ${PORT} with pure MySQL Database!`);
});
