const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
require('dotenv').config();

const connectDB = require('./src/config/db');
const seedDB = require('./src/config/seed');
const { initSockets } = require('./src/sockets');

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

// Connect Database based on DB_MODE in .env ('mysql' or 'mongodb')
const dbMode = (process.env.DB_MODE || 'mongodb').toLowerCase();

if (dbMode === 'mysql') {
  const { connectMySQL } = require('./src/config/mysql');
  const seedMySQL = require('./src/config/seed_mysql');
  connectMySQL().then((success) => {
    if (success) {
      seedMySQL();
    } else {
      console.log('⚠️ MySQL connection unverified. Falling back to MongoDB...');
      connectDB().then(() => seedDB());
    }
  });
} else {
  connectDB().then(() => {
    seedDB();
  });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static assets from Vite client in production
app.use(express.static(path.join(__dirname, 'client/dist')));

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/inventory', require('./src/routes/inventory'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/tables', require('./src/routes/tables'));

// Auto-detect LAN IP for QR code generation (WiFi/Ethernet)
app.get('/api/system/lan-ip', (req, res) => {
  try {
    const ifaces = os.networkInterfaces();
    let lanIp = null;
    for (const ifaceName of Object.keys(ifaces)) {
      for (const iface of ifaces[ifaceName]) {
        // Pick first non-internal IPv4 (WiFi/Ethernet)
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
      if (lanIp) break;
    }
    const clientPort = process.env.CLIENT_PORT || 5173;
    res.json({ ip: lanIp, url: lanIp ? `http://${lanIp}:${clientPort}` : null });
  } catch (err) {
    res.json({ ip: null, url: null });
  }
});

// Fallback to React index.html for SPA routing in client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'), (err) => {
    if (err) {
      res.status(200).send('CakeFlow AI Server is running. Please build client using: npm run build');
    }
  });
});

// Define Port
const PORT = process.env.PORT || 5000;

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
