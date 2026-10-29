const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Order, OrderItem, Product, Inventory, Expense } = require('../config/mysql');
const { staffOnly } = require('../middleware/auth');
const { getIo } = require('../sockets');

const SETTINGS_FILE = path.join(__dirname, '../../datas/settings.json');

const getSystemGstRate = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (data && typeof data.gstRate === 'number') {
        return data.gstRate;
      }
    }
  } catch (e) {}
  return 5;
};

// GET /api/accounts - Complete Financial & Accounting Dashboard Data
router.get('/', staffOnly, async (req, res) => {
  try {
    const filter = (req.query.dateFilter || 'today').toLowerCase();
    const { startDate: qStartDate, endDate: qEndDate, gstRate: qGstRate } = req.query;

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    let startDate = new Date(startOfToday);
    let endDate = new Date(endOfToday);
    let periodLabel = 'Today';

    if (filter === 'yesterday') {
      startDate = new Date(startOfToday);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = 'Yesterday';
    } else if (filter === '7days') {
      startDate = new Date(startOfToday);
      startDate.setDate(startDate.getDate() - 6);
      periodLabel = 'Last 7 Days';
    } else if (filter === '30days') {
      startDate = new Date(startOfToday);
      startDate.setDate(startDate.getDate() - 29);
      periodLabel = 'Last 30 Days';
    } else if (filter === 'lastmonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      periodLabel = 'Last Month';
    } else if (filter === 'all') {
      startDate = new Date(0);
      endDate = new Date(2099, 11, 31, 23, 59, 59, 999);
      periodLabel = 'All Time';
    } else if (filter === 'custom' || qStartDate || qEndDate) {
      startDate = qStartDate ? new Date(`${qStartDate}T00:00:00`) : new Date(0);
      endDate = qEndDate ? new Date(`${qEndDate}T23:59:59.999`) : new Date(endOfToday);
      periodLabel = qStartDate && qEndDate ? `${qStartDate} to ${qEndDate}` : 'Custom Date Range';
    }

    // Fetch Orders, Inventory, and Expenses in parallel
    const [allOrders, allInventory, allExpenses] = await Promise.all([
      Order.findAll({
        include: [{ model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }],
        order: [['createdAt', 'DESC']]
      }),
      Inventory.findAll({ order: [['name', 'ASC']] }),
      Expense.findAll({ order: [['expenseDate', 'DESC'], ['createdAt', 'DESC']] })
    ]);

    // Filter Orders by period
    const filteredOrders = allOrders.filter(o => {
      const d = new Date(o.createdAt || Date.now());
      return d >= startDate && d <= endDate;
    });

    // Filter Expenses by period
    const filteredExpenses = allExpenses.filter(exp => {
      const d = new Date(exp.expenseDate || exp.createdAt || Date.now());
      return d >= startDate && d <= endDate;
    });

    // Calculate active days count for accurate daily averages
    let activeDaysCount = 1;
    if (filter === 'today' || filter === 'yesterday') {
      activeDaysCount = 1;
    } else if (filter === '7days') {
      activeDaysCount = 7;
    } else if (filter === '30days') {
      activeDaysCount = 30;
    } else if (filter === 'lastmonth') {
      activeDaysCount = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    } else if (filter === 'custom' && qStartDate && qEndDate) {
      activeDaysCount = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    } else {
      // 'all' time: days since earliest order or expense up to today
      const timestamps = [
        ...filteredOrders.map(o => new Date(o.createdAt || Date.now()).getTime()),
        ...filteredExpenses.map(e => new Date(e.expenseDate || e.createdAt || Date.now()).getTime())
      ].filter(Boolean);
      if (timestamps.length > 0) {
        const earliest = Math.min(...timestamps);
        activeDaysCount = Math.max(1, Math.ceil((endOfToday.getTime() - earliest) / (1000 * 60 * 60 * 24)));
      }
    }

    // Separate valid orders vs cancelled orders
    const validOrders = filteredOrders.filter(o => o.status !== 'cancelled' && Number(o.totalAmount || 0) > 0);
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');

    const grossRevenue = validOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    // Cancelled orders value (use totalAmount if > 0, else sum of items)
    const cancelledOrdersValue = cancelledOrders.reduce((sum, o) => {
      const amt = Number(o.totalAmount || 0);
      if (amt > 0) return sum + amt;
      const itemsSum = (o.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0);
      return sum + itemsSum;
    }, 0);

    // Paid vs Unpaid Orders
    const paidOrders = validOrders.filter(o =>
      o.status === 'served' ||
      (o.paymentStatus || '').toLowerCase() === 'paid'
    );
    const unpaidOrders = validOrders.filter(o =>
      o.status !== 'served' &&
      (o.paymentStatus || '').toLowerCase() !== 'paid'
    );

    const paidRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const unpaidRevenue = unpaidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    // Payment Mode Tally (Cash / UPI / Card)
    let cashCollection = 0;
    let cashOrdersCount = 0;
    let upiCollection = 0;
    let upiOrdersCount = 0;
    let cardCollection = 0;
    let cardOrdersCount = 0;

    paidOrders.forEach(o => {
      const method = (o.paymentMethod || 'Cash').toLowerCase();
      const amt = Number(o.totalAmount || 0);
      if (method.includes('upi') || method.includes('gpay') || method.includes('phonepe') || method.includes('qr')) {
        upiCollection += amt;
        upiOrdersCount++;
      } else if (method.includes('card') || method.includes('credit') || method.includes('debit')) {
        cardCollection += amt;
        cardOrdersCount++;
      } else {
        cashCollection += amt;
        cashOrdersCount++;
      }
    });

    // GST / Tax Summary (Uses each order's locked gstRate if present, fallback to global gstRate)
    const parsedGst = qGstRate !== undefined ? parseFloat(qGstRate) : getSystemGstRate();
    const gstRate = !isNaN(parsedGst) && parsedGst >= 0 ? parsedGst : 5;

    const getOrderItemsSubtotal = (o) => {
      if (Array.isArray(o.items) && o.items.length > 0) {
        return o.items.reduce((s, it) => s + Number(it.price ?? it.product?.price ?? 0) * Number(it.quantity ?? 1), 0);
      }
      return Number(o.totalAmount || 0);
    };
    const getOrderGstRate = (o) => {
      if (o.gstRate !== null && o.gstRate !== undefined && !isNaN(Number(o.gstRate))) {
        return Number(o.gstRate);
      }
      return gstRate;
    };

    const taxableSubtotal = validOrders.reduce((sum, o) => sum + getOrderItemsSubtotal(o), 0);
    const totalGstCollected = validOrders.reduce((sum, o) => sum + getOrderItemsSubtotal(o) * (getOrderGstRate(o) / 100), 0);
    const cgstCollected = totalGstCollected / 2;
    const sgstCollected = totalGstCollected / 2;

    const paidTaxableSubtotal = paidOrders.reduce((sum, o) => sum + getOrderItemsSubtotal(o), 0);
    const paidGstCollected = paidOrders.reduce((sum, o) => sum + getOrderItemsSubtotal(o) * (getOrderGstRate(o) / 100), 0);

    // Inventory Financials
    let inventoryPurchaseCost = 0;
    let inventorySalesRevenue = 0;
    let inventoryWastageCost = 0;

    const inventorySummary = allInventory.map(inv => {
      const pCost = Number(inv.purchaseCost || 0);
      const sRev = Number(inv.salesRevenue || 0);
      const wCost = Number(inv.wastageCost || 0);
      const initQty = Number(inv.initialQuantity || 0);
      const remQty = Number(inv.quantity || 0);
      const soldU = Number(inv.soldUnits || 0);
      const netPL = sRev - pCost;

      inventoryPurchaseCost += pCost;
      inventorySalesRevenue += sRev;
      inventoryWastageCost += wCost;

      return {
        id: String(inv.id),
        name: inv.name,
        unit: inv.unit,
        initialQuantity: initQty,
        remainingQuantity: remQty,
        soldUnits: soldU,
        purchaseCost: pCost,
        salesRevenue: sRev,
        wastageCost: wCost,
        netProfitLoss: netPL,
        lastUpdated: inv.lastUpdated
      };
    });

    // Shop Expenses Breakdown
    let shopExpensesTotal = 0;
    let cashExpensesTotal = 0;
    const expensesByCategoryMap = {};

    filteredExpenses.forEach(exp => {
      const amt = Number(exp.amount || 0);
      const cat = exp.category || 'Other';
      shopExpensesTotal += amt;
      if ((exp.paymentMode || 'Cash').toLowerCase() === 'cash') {
        cashExpensesTotal += amt;
      }
      expensesByCategoryMap[cat] = (expensesByCategoryMap[cat] || 0) + amt;
    });

    const expensesByCategory = Object.entries(expensesByCategoryMap)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        percent: shopExpensesTotal > 0 ? Math.round((amount / shopExpensesTotal) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Overall Profit & Loss Calculation
    const totalExpensesAndCosts = inventoryPurchaseCost + shopExpensesTotal;
    const grossProfit = grossRevenue - inventoryPurchaseCost;
    const netProfit = grossRevenue - totalExpensesAndCosts;
    const profitMarginPercent = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;
    const roiPercent = totalExpensesAndCosts > 0 ? Number(((netProfit / totalExpensesAndCosts) * 100).toFixed(1)) : 0;
    const totalWastageAndCancelLoss = inventoryWastageCost + cancelledOrdersValue;

    // Net Cash in Drawer (Cash sales received minus Cash expenses paid)
    const netCashInDrawer = cashCollection - cashExpensesTotal;

    // Averages Calculation
    let totalItemsSold = 0;
    const itemSalesMap = {};
    const categorySalesMap = {};

    validOrders.forEach(o => {
      (o.items || []).forEach(item => {
        if (item.status === 'cancelled') return;
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || item.product?.price || 0);
        const lineTotal = qty * price;
        const itemName = item.product?.name || item.name || 'Food Item';
        const catName = item.product?.category || item.category || 'General';

        totalItemsSold += qty;

        if (!itemSalesMap[itemName]) {
          itemSalesMap[itemName] = {
            name: itemName,
            category: catName,
            quantitySold: 0,
            revenue: 0,
            unitPrice: price
          };
        }
        itemSalesMap[itemName].quantitySold += qty;
        itemSalesMap[itemName].revenue += lineTotal;

        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = {
            category: catName,
            quantitySold: 0,
            revenue: 0
          };
        }
        categorySalesMap[catName].quantitySold += qty;
        categorySalesMap[catName].revenue += lineTotal;
      });
    });

    const uniqueTablesCount = new Set(validOrders.map(o => Number(o.tableNumber))).size;
    const avgOrderValue = validOrders.length > 0 ? grossRevenue / validOrders.length : 0;
    const avgDailyRevenue = grossRevenue / activeDaysCount;
    const avgDailyProfit = netProfit / activeDaysCount;
    const avgSpendPerTable = uniqueTablesCount > 0 ? grossRevenue / uniqueTablesCount : 0;
    const avgItemsPerOrder = validOrders.length > 0 ? Number((totalItemsSold / validOrders.length).toFixed(1)) : 0;

    // Top Selling Items List
    const topSellingItems = Object.values(itemSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(it => ({
        ...it,
        revenue: Math.round(it.revenue * 100) / 100,
        sharePercent: grossRevenue > 0 ? Number(((it.revenue / grossRevenue) * 100).toFixed(1)) : 0
      }));

    // Category Breakdown List
    const categorySales = Object.values(categorySalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(cat => ({
        ...cat,
        revenue: Math.round(cat.revenue * 100) / 100,
        sharePercent: grossRevenue > 0 ? Number(((cat.revenue / grossRevenue) * 100).toFixed(1)) : 0
      }));

    // Day-by-Day Financial Ledger
    const ledgerMap = {};
    const getDayKey = (d) => {
      const dt = new Date(d);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    validOrders.forEach(o => {
      const key = getDayKey(o.createdAt || Date.now());
      if (!ledgerMap[key]) {
        ledgerMap[key] = {
          date: key,
          ordersCount: 0,
          grossSales: 0,
          paidSales: 0,
          cashSales: 0,
          upiSales: 0,
          cardSales: 0,
          gstCollected: 0,
          shopExpenses: 0
        };
      }
      const amt = Number(o.totalAmount || 0);
      const isPaid = o.status === 'served' || (o.paymentStatus || '').toLowerCase() === 'paid';
      const method = (o.paymentMethod || 'Cash').toLowerCase();
      const orderGst = getOrderItemsSubtotal(o) * (getOrderGstRate(o) / 100);

      ledgerMap[key].ordersCount += 1;
      ledgerMap[key].grossSales += amt;
      ledgerMap[key].gstCollected += orderGst;

      if (isPaid) {
        ledgerMap[key].paidSales += amt;
        if (method.includes('upi') || method.includes('gpay') || method.includes('phonepe')) {
          ledgerMap[key].upiSales += amt;
        } else if (method.includes('card') || method.includes('credit') || method.includes('debit')) {
          ledgerMap[key].cardSales += amt;
        } else {
          ledgerMap[key].cashSales += amt;
        }
      }
    });

    filteredExpenses.forEach(exp => {
      const key = getDayKey(exp.expenseDate || exp.createdAt || Date.now());
      if (!ledgerMap[key]) {
        ledgerMap[key] = {
          date: key,
          ordersCount: 0,
          grossSales: 0,
          paidSales: 0,
          cashSales: 0,
          upiSales: 0,
          cardSales: 0,
          gstCollected: 0,
          shopExpenses: 0
        };
      }
      ledgerMap[key].shopExpenses += Number(exp.amount || 0);
    });

    const dailyLedger = Object.values(ledgerMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(row => ({
        ...row,
        grossSales: Math.round(row.grossSales * 100) / 100,
        paidSales: Math.round(row.paidSales * 100) / 100,
        cashSales: Math.round(row.cashSales * 100) / 100,
        upiSales: Math.round(row.upiSales * 100) / 100,
        cardSales: Math.round(row.cardSales * 100) / 100,
        gstCollected: Math.round(row.gstCollected * 100) / 100,
        shopExpenses: Math.round(row.shopExpenses * 100) / 100,
        netDayIncome: Math.round((row.grossSales - row.shopExpenses) * 100) / 100
      }));

    res.json({
      periodLabel,
      activeDaysCount,
      gstRate,
      summary: {
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        paidRevenue: Math.round(paidRevenue * 100) / 100,
        unpaidRevenue: Math.round(unpaidRevenue * 100) / 100,
        totalOrdersCount: validOrders.length,
        paidOrdersCount: paidOrders.length,
        unpaidOrdersCount: unpaidOrders.length,
        cancelledOrdersCount: cancelledOrders.length,
        cancelledOrdersValue: Math.round(cancelledOrdersValue * 100) / 100,
        inventoryPurchaseCost: Math.round(inventoryPurchaseCost * 100) / 100,
        inventorySalesRevenue: Math.round(inventorySalesRevenue * 100) / 100,
        inventoryWastageCost: Math.round(inventoryWastageCost * 100) / 100,
        shopExpensesTotal: Math.round(shopExpensesTotal * 100) / 100,
        totalExpensesAndCosts: Math.round(totalExpensesAndCosts * 100) / 100,
        totalWastageAndCancelLoss: Math.round(totalWastageAndCancelLoss * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        isProfit: netProfit >= 0,
        profitMarginPercent,
        roiPercent,
        totalItemsSold,
        uniqueTablesCount
      },
      averages: {
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
        avgDailyProfit: Math.round(avgDailyProfit * 100) / 100,
        avgSpendPerTable: Math.round(avgSpendPerTable * 100) / 100,
        avgItemsPerOrder
      },
      paymentTally: {
        cashCollection: Math.round(cashCollection * 100) / 100,
        cashOrdersCount,
        upiCollection: Math.round(upiCollection * 100) / 100,
        upiOrdersCount,
        cardCollection: Math.round(cardCollection * 100) / 100,
        cardOrdersCount,
        unpaidCollection: Math.round(unpaidRevenue * 100) / 100,
        unpaidOrdersCount: unpaidOrders.length,
        cashExpensesTotal: Math.round(cashExpensesTotal * 100) / 100,
        netCashInDrawer: Math.round(netCashInDrawer * 100) / 100
      },
      gstSummary: {
        gstRate,
        taxableSubtotal: Math.round(taxableSubtotal * 100) / 100,
        totalGstCollected: Math.round(totalGstCollected * 100) / 100,
        cgstCollected: Math.round(cgstCollected * 100) / 100,
        sgstCollected: Math.round(sgstCollected * 100) / 100,
        paidTaxableSubtotal: Math.round(paidTaxableSubtotal * 100) / 100,
        paidGstCollected: Math.round(paidGstCollected * 100) / 100
      },
      expenses: filteredExpenses,
      expensesByCategory,
      inventorySummary,
      topSellingItems,
      categorySales,
      dailyLedger
    });
  } catch (error) {
    console.error('Accounts route error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/accounts/expenses - Add a Daily Shop Expense
router.post('/expenses', staffOnly, async (req, res) => {
  try {
    const { title, category, amount, paymentMode, notes, expenseDate } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Expense title is required' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid expense amount greater than 0' });
    }

    const newExpense = await Expense.create({
      title: String(title).trim(),
      category: category || 'Raw Materials',
      amount: parsedAmount,
      paymentMode: paymentMode || 'Cash',
      notes: notes ? String(notes).trim() : '',
      expenseDate: expenseDate ? new Date(expenseDate) : new Date()
    });

    try {
      getIo().to('admins').emit('accounts_updated', { type: 'expense_added', expense: newExpense });
    } catch (e) {}

    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/accounts/expenses/:id - Update a Shop Expense
router.put('/expenses/:id', staffOnly, async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense record not found' });
    }

    const { title, category, amount, paymentMode, notes, expenseDate } = req.body;
    if (title !== undefined) expense.title = String(title).trim();
    if (category !== undefined) expense.category = category;
    if (amount !== undefined) {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed) && parsed > 0) expense.amount = parsed;
    }
    if (paymentMode !== undefined) expense.paymentMode = paymentMode;
    if (notes !== undefined) expense.notes = String(notes).trim();
    if (expenseDate !== undefined && expenseDate) expense.expenseDate = new Date(expenseDate);

    await expense.save();

    try {
      getIo().to('admins').emit('accounts_updated', { type: 'expense_updated', expense });
    } catch (e) {}

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/accounts/expenses/:id - Delete a Shop Expense
router.delete('/expenses/:id', staffOnly, async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense record not found' });
    }

    await expense.destroy();

    try {
      getIo().to('admins').emit('accounts_updated', { type: 'expense_deleted', id: req.params.id });
    } catch (e) {}

    res.json({ message: 'Expense deleted successfully', id: req.params.id });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
