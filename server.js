const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
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

// Connect Database
connectDB().then(() => {
  // Seed Database with initial mock data
  seedDB();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from Vite client in production
app.use(express.static(path.join(__dirname, 'client/dist')));

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/inventory', require('./src/routes/inventory'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/tables', require('./src/routes/tables'));

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
