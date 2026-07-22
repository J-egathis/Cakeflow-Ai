let io;

const initSockets = (socketIoInstance) => {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

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

// Helper methods to broadcast updates
const notifyNewOrder = (order) => {
  if (!io) return;

  // Broadcast globally to all connected clients (Admins, Kitchens, Waiters, Tables)
  io.emit('new_order', order);
  io.emit('new_kitchen_items', order);

  // Broadcast to specific rooms
  io.to('admins').emit('new_order', order);
  io.to('waiters').emit('new_order', order);
  io.to('cake_kitchen').emit('new_kitchen_items', order);
  io.to('snacks_kitchen').emit('new_kitchen_items', order);
  io.to('beverage_counter').emit('new_kitchen_items', order);
};

const notifyOrderUpdate = (order) => {
  if (!io) return;

  // Broadcast globally to all connected clients
  io.emit('order_updated', order);
  io.emit('order_status_changed', order);

  // Notify Admins, Waiters, and the specific Customer Table
  io.to('admins').emit('order_updated', order);
  io.to('waiters').emit('order_updated', order);
  io.to(`table_${order.tableNumber}`).emit('order_status_changed', order);
};

const notifyInventoryUpdate = (inventoryItem) => {
  if (!io) return;
  io.to('admins').emit('inventory_updated', inventoryItem);
  if (inventoryItem.quantity < inventoryItem.minThreshold) {
    io.to('admins').emit('low_stock_alert', {
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
