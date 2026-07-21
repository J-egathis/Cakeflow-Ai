const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const auth = require('../middleware/auth');
const { getAIPredictions } = require('../utils/aiService');

// Get Admin Analytics Dashboard Data (Admin only)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const orders = await Order.find().populate('items.product');
    const products = await Product.find();
    const inventory = await Inventory.find();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Cards stats
    const todayOrders = orders.filter(o => o.createdAt >= startOfToday);
    const revenue = orders
      .filter(o => o.paymentStatus === 'paid' || o.status === 'served')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const pendingOrders = orders.filter(o => ['pending', 'accepted', 'preparing'].includes(o.status)).length;
    const completedOrders = orders.filter(o => o.status === 'served').length;

    // Prep time calculations
    let totalPrepTime = 0;
    let prepCount = 0;
    orders.forEach(o => {
      if (o.status === 'served' && o.preparationTimerStartedAt && o.estimatedCompletionTime) {
        const prepTime = Math.round((new Date(o.estimatedCompletionTime) - new Date(o.preparationTimerStartedAt)) / 60000);
        totalPrepTime += prepTime;
        prepCount++;
      }
    });
    const avgPrepTime = prepCount > 0 ? Math.round(totalPrepTime / prepCount) : 18; // default 18 mins

    // AI Predictions
    const aiPredictions = await getAIPredictions();

    // Chart Data: Weekly Sales (last 7 days)
    const weeklySales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayOrders = orders.filter(o => o.createdAt >= d && o.createdAt < nextD);
      const dayRevenue = dayOrders
        .filter(o => o.paymentStatus === 'paid' || o.status === 'served')
        .reduce((sum, o) => sum + o.totalAmount, 0);

      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      weeklySales.push({
        day: dayName,
        revenue: dayRevenue,
        orders: dayOrders.length
      });
    }

    // Chart Data: Popular categories sales
    const categorySales = {};
    orders.forEach(o => {
      if (o.status !== 'cancelled') {
        o.items.forEach(item => {
          if (item.product) {
            const cat = item.product.category;
            categorySales[cat] = (categorySales[cat] || 0) + item.quantity * item.product.price;
          }
        });
      }
    });

    const popularCategoriesChart = Object.entries(categorySales).map(([category, value]) => ({
      name: category,
      value
    }));

    // Kitchen performance
    const cakeOrders = orders.filter(o => o.items.some(i => i.category === 'Cake')).length;
    const snackOrders = orders.filter(o => o.items.some(i => i.category === 'Snack')).length;
    const drinkOrders = orders.filter(o => o.items.some(i => i.category === 'Drink')).length;

    const kitchenPerformance = [
      { name: 'Cake Kitchen', orders: cakeOrders, avgMins: aiPredictions.aiPrepTimes.Cake },
      { name: 'Snacks Kitchen', orders: snackOrders, avgMins: aiPredictions.aiPrepTimes.Snack },
      { name: 'Beverage Counter', orders: drinkOrders, avgMins: aiPredictions.aiPrepTimes.Drink }
    ];

    // Live Activity Feed (Latest 10 actions)
    const liveActivity = [];
    orders.slice(0, 10).forEach(order => {
      let message = `Order #${order._id.toString().slice(-4)} placed by customer for Table ${order.tableNumber}`;
      let type = 'info';

      if (order.status === 'cancelled') {
        message = `Order #${order._id.toString().slice(-4)} cancelled. Reason: ${order.rejectionReason || 'Customer requested'}`;
        type = 'error';
      } else if (order.status === 'served') {
        message = `Order #${order._id.toString().slice(-4)} served to Table ${order.tableNumber}`;
        type = 'success';
      } else if (order.status === 'preparing') {
        message = `Chef started preparing Order #${order._id.toString().slice(-4)}`;
        type = 'warning';
      }

      liveActivity.push({
        id: order._id,
        message,
        time: order.createdAt,
        type
      });
    });

    // Append low stock alerts to feed
    inventory.forEach(item => {
      if (item.quantity < item.minThreshold) {
        liveActivity.unshift({
          id: item._id,
          message: `ALERT: Low Stock! ${item.name} is down to ${item.quantity}${item.unit}`,
          time: item.lastUpdated,
          type: 'danger'
        });
      }
    });

    res.json({
      cards: {
        todayOrders: todayOrders.length,
        revenue,
        cancelledOrders,
        pendingOrders,
        completedOrders,
        avgPrepTime,
        bestSellingCake: aiPredictions.bestSellingForecast.cake,
        bestSellingSnack: aiPredictions.bestSellingForecast.snack,
        peakHours: aiPredictions.peakHour
      },
      charts: {
        weeklySales,
        popularCategories: popularCategoriesChart.slice(0, 5),
        kitchenPerformance
      },
      activityFeed: liveActivity.slice(0, 8),
      ai: aiPredictions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Explicit endpoint to fetch just the AI forecasts
router.get('/ai-forecasts', auth(), async (req, res) => {
  try {
    const aiPredictions = await getAIPredictions();
    res.json(aiPredictions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
