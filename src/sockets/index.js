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

  // Broadcast to Admins and Waiters
  io.to('admins').emit('new_order', order);
  io.to('waiters').emit('new_order', order);

  // Broadcast items to respective kitchens
  const hasCakes = order.items.some(item => item.category === 'Cake');
  const hasSnacks = order.items.some(item => item.category === 'Snack');
  const hasDrinks = order.items.some(item => item.category === 'Drink');

  if (hasCakes) {
    io.to('cake_kitchen').emit('new_kitchen_items', {
      orderId: order._id,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: order.items.filter(item => item.category === 'Cake'),
      createdAt: order.createdAt
    });
  }

  if (hasSnacks) {
    io.to('snacks_kitchen').emit('new_kitchen_items', {
      orderId: order._id,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: order.items.filter(item => item.category === 'Snack'),
      createdAt: order.createdAt
    });
  }

  if (hasDrinks) {
    io.to('beverage_counter').emit('new_kitchen_items', {
      orderId: order._id,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      items: order.items.filter(item => item.category === 'Drink'),
      createdAt: order.createdAt
    });
  }
};

const notifyOrderUpdate = (order) => {
  if (!io) return;

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
