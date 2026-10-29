let io;

const initSockets = (socketIoInstance) => {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Kitchen Stock Alert & Real-time Broadcast
    socket.on('kitchen_stock_alert', (data) => {
      console.log(`[Socket] Kitchen stock alert from ${socket.id}:`, data);
      socket.broadcast.emit('kitchen_stock_alert', data);
      socket.broadcast.emit('product:updated', data);
    });

    socket.on('product:updated', (data) => {
      socket.broadcast.emit('product:updated', data);
    });

    // Join room based on role or table
    socket.on('join_room', (roomName) => {
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('leave_room', (roomName) => {
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left room: ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Helper methods to broadcast updates exactly once
const notifyNewOrder = (order) => {
  if (!io) return;
  // Broadcast globally to all connected clients once
  io.emit('new_order', order);
  io.emit('new_kitchen_items', order);
};

const notifyOrderUpdate = (order) => {
  if (!io) return;
  // Broadcast globally to all connected clients once
  io.emit('order_updated', order);
  io.emit('order_status_changed', order);
};

const notifyInventoryUpdate = (inventoryItem) => {
  if (!io) return;
  io.emit('inventory_updated', inventoryItem);
  if (inventoryItem && !inventoryItem.deleted && inventoryItem.quantity < inventoryItem.minThreshold) {
    io.emit('low_stock_alert', {
      name: inventoryItem.name,
      quantity: inventoryItem.quantity,
      unit: inventoryItem.unit,
      minThreshold: inventoryItem.minThreshold
    });
  }
};

module.exports = {
  initSockets,
  getIo,
  notifyNewOrder,
  notifyOrderUpdate,
  notifyInventoryUpdate
};
