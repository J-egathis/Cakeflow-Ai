import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { accountsApi, getSocket } from '../services/api';
import {
  DollarSign, TrendingUp, Calendar, Plus, Trash2, Edit2,
  RefreshCw, Download, Printer, Receipt, AlertTriangle,
  PieChart, BarChart3, Wallet, CreditCard, Smartphone, Package, X,
  FileText, ArrowUpRight, ArrowDownRight, Layers, Search
} from 'lucide-react';

interface AccountsManagementProps {
  gstRate: number;
  addToast: (msg: string, type?: 'info' | 'danger' | 'success') => void;
  mode?: 'accounts' | 'expenses';
  onSwitchToExpenses?: () => void;
}

const EXPENSE_CATEGORIES = [
  'Raw Materials',
  'Gas & Fuel',
  'Staff Salary',
  'Electricity (EB)',
  'Shop Rent',
  'Packaging',
  'Maintenance',
  'Other'
];

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Card'];

export const AccountsManagement: React.FC<AccountsManagementProps> = ({
  gstRate,
  addToast,
  mode = 'accounts',
  onSwitchToExpenses
}) => {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'lastmonth' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [accountData, setAccountData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Expenses Filter & Search State
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [expTitle, setExpTitle] = useState<string>('');
  const [expCategory, setExpCategory] = useState<string>('Raw Materials');
  const [isCustomExpCategory, setIsCustomExpCategory] = useState<boolean>(false);
  const [customExpCategory, setCustomExpCategory] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expPaymentMode, setExpPaymentMode] = useState<string>('Cash');
  const [expDate, setExpDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expNotes, setExpNotes] = useState<string>('');
  const [savingExpense, setSavingExpense] = useState<boolean>(false);

  const fetchAccountSummary = async (
    filter = dateFilter,
    start = customStartDate,
    end = customEndDate,
    silent = false
  ) => {
    if (!silent) setLoading(true);
    try {
      const data = await accountsApi.getSummary(filter, start, end, gstRate);
      setAccountData(data);
    } catch (err: any) {
      console.error('Failed to load accounts summary:', err);
      if (!silent) addToast('Failed to load account statement data', 'danger');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFilter !== 'custom') {
      fetchAccountSummary(dateFilter, '', '');
    }
  }, [dateFilter, gstRate]);

  useEffect(() => {
    const socket = getSocket();
    // Debounced silent refresh: socket bursts update numbers once, with no loading flash
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const handleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        fetchAccountSummary(dateFilter, customStartDate, customEndDate, true);
      }, 300);
    };

    socket.on('accounts_updated', handleRefresh);
    socket.on('new_order', handleRefresh);
    socket.on('order_updated', handleRefresh);
    socket.on('table_updated', handleRefresh);
    socket.on('inventory_alert', handleRefresh);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.off('accounts_updated', handleRefresh);
      socket.off('new_order', handleRefresh);
      socket.off('order_updated', handleRefresh);
      socket.off('table_updated', handleRefresh);
      socket.off('inventory_alert', handleRefresh);
    };
  }, [dateFilter, customStartDate, customEndDate, gstRate]);

  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setExpTitle('');
    setExpCategory('Raw Materials');
    setIsCustomExpCategory(false);
    setCustomExpCategory('');
    setExpAmount('');
    setExpPaymentMode('Cash');
    setExpDate(new Date().toISOString().split('T')[0]);
    setExpNotes('');
    setShowExpenseModal(true);
  };

  const openEditExpenseModal = (exp: any) => {
    setEditingExpense(exp);
    setExpTitle(exp.title || '');
    const cat = exp.category || 'Raw Materials';
    if (EXPENSE_CATEGORIES.includes(cat)) {
      setExpCategory(cat);
      setIsCustomExpCategory(false);
      setCustomExpCategory('');
    } else {
      setExpCategory('Custom');
      setIsCustomExpCategory(true);
      setCustomExpCategory(cat);
    }
    setExpAmount(String(exp.amount || ''));
    setExpPaymentMode(exp.paymentMode || 'Cash');
    const dt = exp.expenseDate ? new Date(exp.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setExpDate(dt);
    setExpNotes(exp.notes || '');
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) {
      addToast('Please enter an expense title', 'danger');
      return;
    }
    const finalCategory = isCustomExpCategory ? customExpCategory.trim() : expCategory;
    if (!finalCategory) {
      addToast('Please select or enter an expense category', 'danger');
      return;
    }
    const parsedAmt = parseFloat(expAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      addToast('Please enter a valid amount greater than 0', 'danger');
      return;
    }

    setSavingExpense(true);
    try {
      const payload = {
        title: expTitle.trim(),
        category: finalCategory,
        amount: parsedAmt,
        paymentMode: expPaymentMode,
        expenseDate: expDate,
        notes: expNotes.trim()
      };

      if (editingExpense) {
        await accountsApi.updateExpense(editingExpense._id || editingExpense.id, payload);
        addToast(`Updated expense "${payload.title}" (₹${parsedAmt})`, 'success');
      } else {
        await accountsApi.addExpense(payload);
        addToast(`Added shop expense "${payload.title}" (₹${parsedAmt})`, 'success');
      }
      setShowExpenseModal(false);
      fetchAccountSummary(dateFilter, customStartDate, customEndDate);
    } catch (err: any) {
      addToast(err.message || 'Failed to save expense', 'danger');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (exp: any) => {
    if (!window.confirm(`Delete expense "${exp.title}" (₹${exp.amount})?`)) return;
    try {
      await accountsApi.deleteExpense(exp._id || exp.id);
      addToast(`Deleted expense "${exp.title}"`, 'info');
      fetchAccountSummary(dateFilter, customStartDate, customEndDate);
    } catch (err: any) {
      addToast(err.message || 'Failed to delete expense', 'danger');
    }
  };

  const summary = accountData?.summary || {
    grossRevenue: 0,
    paidRevenue: 0,
    unpaidRevenue: 0,
    totalOrdersCount: 0,
    paidOrdersCount: 0,
    unpaidOrdersCount: 0,
    cancelledOrdersCount: 0,
    cancelledOrdersValue: 0,
    inventoryPurchaseCost: 0,
    inventorySalesRevenue: 0,
    inventoryWastageCost: 0,
    shopExpensesTotal: 0,
    totalExpensesAndCosts: 0,
    totalWastageAndCancelLoss: 0,
    grossProfit: 0,
    netProfit: 0,
    isProfit: true,
    profitMarginPercent: 0,
    roiPercent: 0,
    totalItemsSold: 0,
    uniqueTablesCount: 0
  };

  const averages = accountData?.averages || {
    avgOrderValue: 0,
    avgDailyRevenue: 0,
    avgDailyProfit: 0,
    avgSpendPerTable: 0,
    avgItemsPerOrder: 0
  };

  const paymentTally = accountData?.paymentTally || {
    cashCollection: 0,
    cashOrdersCount: 0,
    upiCollection: 0,
    upiOrdersCount: 0,
    cardCollection: 0,
    cardOrdersCount: 0,
    unpaidCollection: 0,
    unpaidOrdersCount: 0,
    cashExpensesTotal: 0,
    netCashInDrawer: 0
  };

  const gstSummary = accountData?.gstSummary || {
    gstRate: gstRate || 5,
    taxableSubtotal: 0,
    totalGstCollected: 0,
    cgstCollected: 0,
    sgstCollected: 0,
    paidTaxableSubtotal: 0,
    paidGstCollected: 0
  };

  const expenses: any[] = accountData?.expenses || [];
  const expensesByCategory: any[] = accountData?.expensesByCategory || [];
  const inventorySummary: any[] = accountData?.inventorySummary || [];
  const topSellingItems: any[] = accountData?.topSellingItems || [];
  const dailyLedger: any[] = accountData?.dailyLedger || [];
  const periodLabel = accountData?.periodLabel || 'Today';
  const activeDaysCount = accountData?.activeDaysCount || 1;

  // Filtered expenses for the Dedicated Expenses View
  const filteredExpensesList = expenses.filter(exp => {
    const matchesCat = expenseCategoryFilter === 'all' || exp.category === expenseCategoryFilter;
    if (!matchesCat) return false;
    if (!expenseSearch.trim()) return true;
    const q = expenseSearch.toLowerCase();
    return (
      (exp.title || '').toLowerCase().includes(q) ||
      (exp.category || '').toLowerCase().includes(q) ||
      (exp.notes || '').toLowerCase().includes(q) ||
      (exp.paymentMode || '').toLowerCase().includes(q)
    );
  });

  const nonCashExpensesTotal = Math.max(0, summary.shopExpensesTotal - paymentTally.cashExpensesTotal);
  const avgDailyExpense = activeDaysCount > 0 ? Math.round((summary.shopExpensesTotal / activeDaysCount) * 100) / 100 : 0;

  // Export CSV Handler
  const handleExportCSV = () => {
    const lines: string[] = [];
    if (mode === 'expenses') {
      lines.push(`"CAKEFLOW AI - DAILY SHOP EXPENSES STATEMENT (${periodLabel})"`);
      lines.push(`"Generated On","${new Date().toLocaleString()}"`);
      lines.push(`"Total Shop Expenses","${summary.shopExpensesTotal}"`);
      lines.push(`"Paid via Cash","${paymentTally.cashExpensesTotal}"`);
      lines.push(`"Paid via UPI / Bank / Card","${nonCashExpensesTotal}"`);
      lines.push('');
      lines.push('"Date","Expense Title","Category","Payment Mode","Amount (INR)","Notes"');
      expenses.forEach(exp => {
        const dt = exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString() : '';
        lines.push(`"${dt}","${exp.title}","${exp.category}","${exp.paymentMode}","${exp.amount}","${(exp.notes || '').replace(/"/g, '""')}"`);
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `CakeFlow_Expenses_${periodLabel.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Shop Expenses CSV downloaded!', 'success');
      return;
    }

    lines.push(`"CAKEFLOW AI - COMPLETE FINANCIAL & ACCOUNTS STATEMENT (${periodLabel})"`);
    lines.push(`"Generated On","${new Date().toLocaleString()}"`);
    lines.push('');

    lines.push('"1. PROFIT & LOSS SUMMARY"');
    lines.push('"Metric","Amount (INR)"');
    lines.push(`"Total Sales Revenue (Gross)","${summary.grossRevenue}"`);
    lines.push(`"Settled / Paid Sales","${summary.paidRevenue}"`);
    lines.push(`"Unsettled / Active Table Bills","${summary.unpaidRevenue}"`);
    lines.push(`"Inventory Batch Purchase Cost","${summary.inventoryPurchaseCost}"`);
    lines.push(`"Daily Shop Expenses","${summary.shopExpensesTotal}"`);
    lines.push(`"Total Investment & Expenses","${summary.totalExpensesAndCosts}"`);
    lines.push(`"Net Profit / Loss","${summary.netProfit}"`);
    lines.push(`"Profit Margin (%)","${summary.profitMarginPercent}%"`);
    lines.push(`"Inventory Wastage Loss","${summary.inventoryWastageCost}"`);
    lines.push(`"Cancelled Orders Value (${summary.cancelledOrdersCount} orders)","${summary.cancelledOrdersValue}"`);
    lines.push('');

    lines.push('"2. BUSINESS AVERAGES"');
    lines.push(`"Average Order Value (Per Bill)","${averages.avgOrderValue}"`);
    lines.push(`"Average Daily Sales (${activeDaysCount} Days)","${averages.avgDailyRevenue}"`);
    lines.push(`"Average Daily Net Profit","${averages.avgDailyProfit}"`);
    lines.push(`"Average Spend Per Table","${averages.avgSpendPerTable}"`);
    lines.push(`"Average Items Per Order","${averages.avgItemsPerOrder}"`);
    lines.push('');

    lines.push('"3. PAYMENT MODE & CASH DRAWER TALLY"');
    lines.push(`"Cash Sales (${paymentTally.cashOrdersCount} bills)","${paymentTally.cashCollection}"`);
    lines.push(`"UPI / QR Sales (${paymentTally.upiOrdersCount} bills)","${paymentTally.upiCollection}"`);
    lines.push(`"Card Sales (${paymentTally.cardOrdersCount} bills)","${paymentTally.cardCollection}"`);
    lines.push(`"Cash Expenses Paid Out","${paymentTally.cashExpensesTotal}"`);
    lines.push(`"Net Cash Balance in Drawer","${paymentTally.netCashInDrawer}"`);
    lines.push('');

    lines.push(`"4. GST & TAX BREAKDOWN (${gstSummary.gstRate}%)"`);
    lines.push(`"Net Taxable Subtotal","${gstSummary.taxableSubtotal}"`);
    lines.push(`"CGST (${(gstSummary.gstRate / 2).toFixed(1)}%)","${gstSummary.cgstCollected}"`);
    lines.push(`"SGST (${(gstSummary.gstRate / 2).toFixed(1)}%)","${gstSummary.sgstCollected}"`);
    lines.push(`"Total GST Collected","${gstSummary.totalGstCollected}"`);
    lines.push('');

    lines.push('"5. DAY-BY-DAY FINANCIAL LEDGER"');
    lines.push('"Date","Orders","Gross Sales","Cash","UPI","Card","GST Included","Shop Expenses","Net Day Balance"');
    dailyLedger.forEach(row => {
      lines.push(`"${row.date}","${row.ordersCount}","${row.grossSales}","${row.cashSales}","${row.upiSales}","${row.cardSales}","${row.gstCollected}","${row.shopExpenses}","${row.netDayIncome}"`);
    });
    lines.push('');

    lines.push('"6. ITEM-WISE SALES BREAKDOWN"');
    lines.push('"Food Item","Category","Qty Sold","Unit Price","Total Revenue","Share %"');
    topSellingItems.forEach(it => {
      lines.push(`"${it.name}","${it.category}","${it.quantitySold}","${it.unitPrice}","${it.revenue}","${it.sharePercent}%"`);
    });
    lines.push('');

    lines.push('"7. DAILY SHOP EXPENSES LOG"');
    lines.push('"Date","Expense Title","Category","Payment Mode","Amount","Notes"');
    expenses.forEach(exp => {
      const dt = exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString() : '';
      lines.push(`"${dt}","${exp.title}","${exp.category}","${exp.paymentMode}","${exp.amount}","${(exp.notes || '').replace(/"/g, '""')}"`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `CakeFlow_Accounts_${periodLabel.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Accounts CSV report downloaded!', 'success');
  };

  // Print Financial Statement Handler
  const handlePrintStatement = () => {
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (!printWin) {
      alert('Please allow popups to print the Statement.');
      return;
    }

    if (mode === 'expenses') {
      const expRowsHtml = expenses.map(exp => `
        <tr>
          <td>${exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString('en-IN') : '-'}</td>
          <td style="font-weight:bold;">${exp.title}</td>
          <td>${exp.category}</td>
          <td>${exp.paymentMode || 'Cash'}</td>
          <td>${exp.notes || '-'}</td>
          <td style="text-align:right;font-weight:bold;color:#b91c1c;">₹${Number(exp.amount || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>CakeFlow Shop Expenses Report - ${periodLabel}</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
              h1 { color: #4C1D95; margin: 0 0 4px 0; font-size: 22px; }
              .sub { color: #4B5563; font-size: 12px; margin-bottom: 20px; }
              .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
              .card { border: 1px solid #D1D5DB; border-radius: 10px; padding: 12px; }
              .card-label { font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: bold; }
              .card-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; }
              th { background: #F3F4F6; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>CAKEFLOW AI — DAILY SHOP EXPENSES REPORT</h1>
            <div class="sub">Period: <b>${periodLabel}</b> | Printed: ${new Date().toLocaleString()}</div>
            <div class="grid">
              <div class="card"><div class="card-label">Total Shop Expenses</div><div class="card-val" style="color:#b91c1c;">₹${summary.shopExpensesTotal.toLocaleString('en-IN')}</div></div>
              <div class="card"><div class="card-label">Cash Expenses</div><div class="card-val">₹${paymentTally.cashExpensesTotal.toLocaleString('en-IN')}</div></div>
              <div class="card"><div class="card-label">UPI / Bank / Card</div><div class="card-val">₹${nonCashExpensesTotal.toLocaleString('en-IN')}</div></div>
              <div class="card"><div class="card-label">Avg Daily Expense</div><div class="card-val">₹${avgDailyExpense.toLocaleString('en-IN')}</div></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense Description</th>
                  <th>Category</th>
                  <th>Paid Via</th>
                  <th>Notes</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expRowsHtml || '<tr><td colspan="6" style="text-align:center;">No expenses recorded in this period</td></tr>'}
              </tbody>
            </table>
            <script>window.onload = function() { window.print(); };</script>
          </body>
        </html>
      `);
      printWin.document.close();
      return;
    }

    const ledgerRowsHtml = dailyLedger.map(r => `
      <tr>
        <td>${r.date}</td>
        <td style="text-align:center;">${r.ordersCount}</td>
        <td style="text-align:right;">₹${r.grossSales.toLocaleString('en-IN')}</td>
        <td style="text-align:right;">₹${r.cashSales.toLocaleString('en-IN')}</td>
        <td style="text-align:right;">₹${r.upiSales.toLocaleString('en-IN')}</td>
        <td style="text-align:right;">₹${r.cardSales.toLocaleString('en-IN')}</td>
        <td style="text-align:right;">₹${r.gstCollected.toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:#b91c1c;">₹${r.shopExpenses.toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:bold;color:${r.netDayIncome >= 0 ? '#047857' : '#b91c1c'};">
          ${r.netDayIncome >= 0 ? '+' : '-'}₹${Math.abs(r.netDayIncome).toLocaleString('en-IN')}
        </td>
      </tr>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CakeFlow Financial Statement - ${periodLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { color: #4C1D95; margin: 0 0 4px 0; font-size: 22px; }
            .sub { color: #4B5563; font-size: 12px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .card { border: 1px solid #D1D5DB; border-radius: 10px; padding: 12px; }
            .card-label { font-size: 11px; color: #6B7280; text-transform: uppercase; font-weight: bold; }
            .card-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; }
            th { background: #F3F4F6; font-weight: bold; }
            h2 { font-size: 15px; color: #4C1D95; margin-top: 24px; margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <h1>CAKEFLOW AI — FINANCIAL & ACCOUNTS STATEMENT</h1>
          <div class="sub">Period: <b>${periodLabel}</b> (${activeDaysCount} Day${activeDaysCount > 1 ? 's' : ''}) | Printed: ${new Date().toLocaleString()}</div>
          <div class="grid">
            <div class="card">
              <div class="card-label">Total Sales Revenue</div>
              <div class="card-val">₹${summary.grossRevenue.toLocaleString('en-IN')}</div>
              <div style="font-size:11px;color:#4B5563;">${summary.totalOrdersCount} Orders (${summary.paidOrdersCount} Paid)</div>
            </div>
            <div class="card">
              <div class="card-label">Total Costs & Expenses</div>
              <div class="card-val">₹${summary.totalExpensesAndCosts.toLocaleString('en-IN')}</div>
              <div style="font-size:11px;color:#4B5563;">Inv: ₹${summary.inventoryPurchaseCost} | Exp: ₹${summary.shopExpensesTotal}</div>
            </div>
            <div class="card">
              <div class="card-label">${summary.isProfit ? 'Net Profit' : 'Net Loss'}</div>
              <div class="card-val" style="color:${summary.isProfit ? '#047857' : '#b91c1c'};">
                ${summary.isProfit ? '+' : '-'}₹${Math.abs(summary.netProfit).toLocaleString('en-IN')}
              </div>
              <div style="font-size:11px;color:#4B5563;">Margin: ${summary.profitMarginPercent}%</div>
            </div>
            <div class="card">
              <div class="card-label">Net Cash In Drawer</div>
              <div class="card-val">₹${paymentTally.netCashInDrawer.toLocaleString('en-IN')}</div>
              <div style="font-size:11px;color:#4B5563;">UPI: ₹${paymentTally.upiCollection} | Card: ₹${paymentTally.cardCollection}</div>
            </div>
          </div>

          <h2>Business Averages</h2>
          <div class="grid">
            <div class="card"><div class="card-label">Avg Order Value</div><div class="card-val">₹${averages.avgOrderValue.toLocaleString('en-IN')}</div></div>
            <div class="card"><div class="card-label">Avg Daily Sales</div><div class="card-val">₹${averages.avgDailyRevenue.toLocaleString('en-IN')}</div></div>
            <div class="card"><div class="card-label">Avg Daily Profit</div><div class="card-val">₹${averages.avgDailyProfit.toLocaleString('en-IN')}</div></div>
            <div class="card"><div class="card-label">Total GST (${gstSummary.gstRate}%)</div><div class="card-val">₹${gstSummary.totalGstCollected.toLocaleString('en-IN')}</div></div>
          </div>

          <h2>Day-by-Day Financial Ledger</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align:center;">Orders</th>
                <th style="text-align:right;">Gross Sales</th>
                <th style="text-align:right;">Cash</th>
                <th style="text-align:right;">UPI</th>
                <th style="text-align:right;">Card</th>
                <th style="text-align:right;">GST</th>
                <th style="text-align:right;">Shop Expenses</th>
                <th style="text-align:right;">Net Balance</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerRowsHtml || '<tr><td colspan="9" style="text-align:center;">No transactions in this period</td></tr>'}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* TOP BAR: TITLE, DATE FILTERS & ACTION BUTTONS */}
      <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 w-full xl:w-auto min-w-0">
            <div className="p-3 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0">
              {mode === 'expenses' ? <Wallet size={24} /> : <DollarSign size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base sm:text-lg md:text-xl font-black text-[#111827] tracking-tight">
                    {mode === 'expenses' ? 'Daily Shop Expenses Tracker' : 'Accounts & Financial Statement'}
                  </h2>
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-100 text-[#4C1D95] border border-violet-200">
                    {periodLabel} ({activeDaysCount} {activeDaysCount === 1 ? 'Day' : 'Days'})
                  </span>
                </div>
                <button
                  onClick={() => fetchAccountSummary(dateFilter, customStartDate, customEndDate)}
                  className="sm:hidden p-2 rounded-xl bg-white hover:bg-gray-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] transition-all cursor-pointer shrink-0"
                  title="Refresh"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin text-[#4C1D95]' : ''} />
                </button>
              </div>
              <p className="text-xs text-[#4B5563] font-medium mt-1">
                {mode === 'expenses'
                  ? 'Add & manage daily shop expenses (Gas, Staff Salary, EB, Rent, Milk, Vegetables, Packaging) — automatically deducted in Accounts & Profit.'
                  : 'Complete business accounting: Sales Revenue, Inventory Costs, Shop Expenses, Profit & Loss, Averages, GST & Cash Tally.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
            {mode === 'expenses' ? (
              <button
                onClick={openAddExpenseModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-[#4C1D95]/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Plus size={15} />
                <span>Add Expense</span>
              </button>
            ) : (
              onSwitchToExpenses && (
                <button
                  onClick={onSwitchToExpenses}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-[#4C1D95] border border-violet-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <Wallet size={14} />
                  <span>Manage Shop Expenses (₹{summary.shopExpensesTotal.toLocaleString('en-IN')})</span>
                </button>
              )
            )}

            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrintStatement}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-[#111827] border border-[#D1D5DB] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Printer size={14} className="text-[#4C1D95]" />
              <span>Print Report</span>
            </button>

            <button
              onClick={() => fetchAccountSummary(dateFilter, customStartDate, customEndDate)}
              className="hidden sm:flex p-2.5 rounded-xl bg-white hover:bg-gray-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] transition-all cursor-pointer shrink-0"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-[#4C1D95]' : ''} />
            </button>
          </div>
        </div>

        {/* DATE PERIOD SELECTOR */}
        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap max-w-full min-w-0">
            <span className="text-[11px] font-extrabold text-[#4B5563] uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
              <Calendar size={13} className="text-[#4C1D95]" />
              Period:
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'lastmonth', label: 'Last Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: '📅 CR' }
            ].map(tab => (
              <button
                key={tab.id}
                title={tab.id === 'custom' ? 'Custom Date Range' : undefined}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  dateFilter === tab.id
                    ? 'bg-[#4C1D95] text-white shadow-sm'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="w-full bg-[#FFFFFF] border border-[#D1D5DB] p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5 sm:gap-4 mt-1">
              <div className="w-full sm:flex-1 space-y-1.5">
                <label className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#4C1D95] shrink-0" /> Start Date:
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2.5 text-xs text-[#111827] font-semibold outline-none"
                />
              </div>
              <div className="w-full sm:flex-1 space-y-1.5">
                <label className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#4C1D95] shrink-0" /> End Date:
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2.5 text-xs text-[#111827] font-semibold outline-none"
                />
              </div>
              <button
                onClick={() => fetchAccountSummary('custom', customStartDate, customEndDate)}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 h-[40px] active:scale-[0.98]"
              >
                <Calendar size={14} />
                <span>Apply Date Filter</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW MODE 1: DEDICATED SHOP EXPENSES INDIVIDUAL TAB                   */}
      {/* ===================================================================== */}
      {mode === 'expenses' && (
        <>
          {/* EXPENSES KPI SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Total Shop Expenses
                </span>
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl font-black text-rose-600">
                  ₹{summary.shopExpensesTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-[#4B5563] mt-1">
                  {expenses.length} Expense {expenses.length === 1 ? 'Entry' : 'Entries'} in {periodLabel}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Paid via Cash Drawer
                </span>
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl font-black text-[#111827]">
                  ₹{paymentTally.cashExpensesTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-emerald-700 mt-1">
                  Net Cash Left in Drawer: ₹{paymentTally.netCashInDrawer.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Paid via UPI / Bank / Card
                </span>
                <div className="p-2 rounded-xl bg-violet-100 text-[#4C1D95]">
                  <Smartphone size={18} />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl font-black text-[#111827]">
                  ₹{nonCashExpensesTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-[#4B5563] mt-1">
                  Digital & Bank Transfers
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Average Daily Expense
                </span>
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <BarChart3 size={18} />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl font-black text-[#111827]">
                  ₹{avgDailyExpense.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-[#4B5563] mt-1">
                  Across {activeDaysCount} {activeDaysCount === 1 ? 'Day' : 'Days'}
                </div>
              </div>
            </div>
          </div>

          {/* DAILY SHOP EXPENSES TABLE CARD */}
          <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-[#4C1D95]" />
                  <h3 className="text-sm md:text-base font-black text-[#111827]">
                    Shop Expenses Log
                  </h3>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    Total: ₹{summary.shopExpensesTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-[#4B5563] mt-0.5">
                  Track Gas, Staff Salary, EB, Rent, Milk, Vegetables & Packaging costs to calculate accurate Net Profit.
                </p>
              </div>

              <button
                onClick={openAddExpenseModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>Add Expense</span>
              </button>
            </div>

            {/* Category Breakdown Pills */}
            {expensesByCategory.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => setExpenseCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    expenseCategoryFilter === 'all'
                      ? 'bg-[#4C1D95] text-white border-[#4C1D95]'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#4B5563] hover:border-[#4C1D95]'
                  }`}
                >
                  All Categories ({expenses.length})
                </button>
                {expensesByCategory.map(cat => (
                  <button
                    key={cat.category}
                    onClick={() =>
                      setExpenseCategoryFilter(
                        expenseCategoryFilter === cat.category ? 'all' : cat.category
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      expenseCategoryFilter === cat.category
                        ? 'bg-violet-100 border-[#4C1D95] text-[#4C1D95]'
                        : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#111827] hover:border-violet-300'
                    }`}
                  >
                    <span className="text-[#4B5563]">{cat.category}:</span>
                    <span className="font-black text-[#111827]">₹{cat.amount.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-100 text-[#4C1D95] font-black">
                      {cat.percent}%
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search expense by title, category, payment mode or notes..."
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#D1D5DB] text-xs font-semibold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
              />
            </div>

            {/* Expenses Table */}
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-black uppercase text-[#4B5563]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Expense Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredExpensesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#6B7280] font-semibold">
                        No shop expenses recorded for {periodLabel}. Click &ldquo;+ Add Expense&rdquo; to record daily shop costs.
                      </td>
                    </tr>
                  ) : (
                    filteredExpensesList.map(exp => (
                      <tr key={exp._id || exp.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4 font-bold text-[#4B5563] whitespace-nowrap">
                          {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-[#111827]">{exp.title}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-violet-50 text-[#4C1D95] border border-violet-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#4B5563]">{exp.paymentMode || 'Cash'}</td>
                        <td className="py-3 px-4 text-[#6B7280] max-w-xs truncate">{exp.notes || '-'}</td>
                        <td className="py-3 px-4 text-right font-black text-rose-600 whitespace-nowrap">
                          -₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEditExpenseModal(exp)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-violet-100 text-[#4B5563] hover:text-[#4C1D95] transition-colors cursor-pointer"
                              title="Edit Expense"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-rose-100 text-[#4B5563] hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Expense"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* VIEW MODE 2: ACCOUNTS & FINANCIAL STATEMENT TAB                       */}
      {/* ===================================================================== */}
      {mode === 'accounts' && (
        <>
          {/* SECTION 1: MAIN PROFIT, LOSS & REVENUE KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Card 1: Total Gross Sales Revenue */}
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Total Sales Revenue
                </span>
                <div className="p-2 rounded-xl bg-violet-100 text-[#4C1D95]">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="my-3">
                <div className="text-2xl font-black text-[#111827]">
                  ₹{summary.grossRevenue.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-emerald-700 mt-1">
                  Paid: ₹{summary.paidRevenue.toLocaleString('en-IN')} ({summary.paidOrdersCount} bills)
                </div>
              </div>
              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-[#4B5563]">
                <span>Unsettled Bills:</span>
                <span className="text-amber-700 font-black">
                  ₹{summary.unpaidRevenue.toLocaleString('en-IN')} ({summary.unpaidOrdersCount})
                </span>
              </div>
            </div>

            {/* Card 2: Total Investment & Shop Expenses */}
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Total Costs & Expenses
                </span>
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="my-3">
                <div className="text-2xl font-black text-[#111827]">
                  ₹{summary.totalExpensesAndCosts.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-[#4B5563] mt-1">
                  Inventory Batch Cost: ₹{summary.inventoryPurchaseCost.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-[#4B5563]">
                <span>Shop Expenses ({expenses.length}):</span>
                <span className="text-rose-700 font-black">
                  ₹{summary.shopExpensesTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Card 3: Net Profit / Net Loss */}
            <div
              className={`rounded-3xl border p-5 shadow-sm flex flex-col justify-between ${
                summary.isProfit
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : 'bg-rose-50/70 border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-black uppercase tracking-wider ${
                    summary.isProfit ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {summary.isProfit ? 'Net Profit (Earned)' : 'Net Loss (Deficit)'}
                </span>
                <div
                  className={`p-2 rounded-xl ${
                    summary.isProfit
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {summary.isProfit ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
              </div>
              <div className="my-3">
                <div
                  className={`text-2xl font-black ${
                    summary.isProfit ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {summary.isProfit ? '+' : '-'}₹{Math.abs(summary.netProfit).toLocaleString('en-IN')}
                </div>
                <div
                  className={`text-[11px] font-extrabold mt-1 ${
                    summary.isProfit ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  Gross Profit (Before Exp): {summary.grossProfit >= 0 ? '+' : '-'}₹{Math.abs(summary.grossProfit).toLocaleString('en-IN')}
                </div>
              </div>
              <div
                className={`pt-2.5 border-t flex items-center justify-between text-[11px] font-extrabold ${
                  summary.isProfit
                    ? 'border-emerald-200 text-emerald-900'
                    : 'border-rose-200 text-rose-900'
                }`}
              >
                <span>Profit Margin: {summary.profitMarginPercent}%</span>
                <span>ROI: {summary.roiPercent}%</span>
              </div>
            </div>

            {/* Card 4: Wastage & Cancellation Loss */}
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  Wastage & Cancel Loss
                </span>
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="my-3">
                <div className="text-2xl font-black text-rose-600">
                  ₹{summary.totalWastageAndCancelLoss.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-[#4B5563] mt-1">
                  Stock Wastage Loss: ₹{summary.inventoryWastageCost.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-[#4B5563]">
                <span>Cancelled Orders ({summary.cancelledOrdersCount}):</span>
                <span className="text-rose-700 font-black">
                  ₹{summary.cancelledOrdersValue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Card 5: GST & Tax Breakdown */}
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                  GST Tax Summary ({gstSummary.gstRate}%)
                </span>
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Receipt size={18} />
                </div>
              </div>
              <div className="my-3">
                <div className="text-2xl font-black text-[#111827]">
                  ₹{gstSummary.totalGstCollected.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-bold text-[#4B5563] mt-1">
                  Taxable Subtotal: ₹{gstSummary.taxableSubtotal.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-[#4B5563]">
                <span>CGST: ₹{gstSummary.cgstCollected.toLocaleString('en-IN')}</span>
                <span>SGST: ₹{gstSummary.sgstCollected.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: BUSINESS AVERAGES & PERFORMANCE METRICS */}
          <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-[#4C1D95]" />
                <h3 className="text-sm md:text-base font-black text-[#111827]">
                  Business Averages & Performance Metrics
                </h3>
              </div>
              <span className="text-xs font-bold text-[#4B5563]">
                Calculated across {summary.totalOrdersCount} orders & {activeDaysCount} {activeDaysCount === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] font-extrabold text-[#4B5563] uppercase">
                  Avg Order Value (Per Bill)
                </div>
                <div className="text-xl font-black text-[#4C1D95] mt-1">
                  ₹{averages.avgOrderValue.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-semibold text-[#6B7280] mt-1">
                  Avg {averages.avgItemsPerOrder} food items / order
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] font-extrabold text-[#4B5563] uppercase">
                  Avg Daily Sales Revenue
                </div>
                <div className="text-xl font-black text-[#111827] mt-1">
                  ₹{averages.avgDailyRevenue.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-semibold text-[#6B7280] mt-1">
                  Per day average ({activeDaysCount}d period)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] font-extrabold text-[#4B5563] uppercase">
                  Avg Daily Net Profit / Loss
                </div>
                <div
                  className={`text-xl font-black mt-1 ${
                    averages.avgDailyProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {averages.avgDailyProfit >= 0 ? '+' : '-'}₹{Math.abs(averages.avgDailyProfit).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-semibold text-[#6B7280] mt-1">
                  Net earnings per day after costs
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] font-extrabold text-[#4B5563] uppercase">
                  Avg Spend Per Table
                </div>
                <div className="text-xl font-black text-[#111827] mt-1">
                  ₹{averages.avgSpendPerTable.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] font-semibold text-[#6B7280] mt-1">
                  Across {summary.uniqueTablesCount} active table(s)
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] font-extrabold text-[#4B5563] uppercase">
                  Total Units / Plates Sold
                </div>
                <div className="text-xl font-black text-emerald-700 mt-1">
                  {summary.totalItemsSold} Units
                </div>
                <div className="text-[11px] font-semibold text-[#6B7280] mt-1">
                  From {summary.totalOrdersCount} valid customer orders
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: CASH DRAWER & PAYMENT MODE TALLY */}
          <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-[#4C1D95]" />
                <h3 className="text-sm md:text-base font-black text-[#111827]">
                  Cash Register & Payment Mode Tally
                </h3>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-black text-emerald-800">
                <span>Net Cash in Drawer (Cash Sales − Cash Expenses):</span>
                <span className="text-sm">₹{paymentTally.netCashInDrawer.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase text-emerald-800">Cash Collection</span>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    ₹{paymentTally.cashCollection.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700">
                    {paymentTally.cashOrdersCount} Settled Cash Bills
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-600 text-white">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase text-[#4C1D95]">UPI / QR Collection</span>
                  <div className="text-xl font-black text-[#4C1D95] mt-1">
                    ₹{paymentTally.upiCollection.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] font-bold text-violet-700">
                    {paymentTally.upiOrdersCount} Settled UPI Bills
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#4C1D95] text-white">
                  <Smartphone size={20} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase text-blue-800">Card Collection</span>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    ₹{paymentTally.cardCollection.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] font-bold text-blue-700">
                    {paymentTally.cardOrdersCount} Settled Card Bills
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-blue-600 text-white">
                  <CreditCard size={20} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black uppercase text-amber-800">Unpaid / Active Tables</span>
                  <div className="text-xl font-black text-amber-900 mt-1">
                    ₹{paymentTally.unpaidCollection.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] font-bold text-amber-700">
                    {paymentTally.unpaidOrdersCount} Pending Table Bills
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500 text-white">
                  <Receipt size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: TWO-COLUMN BREAKDOWN (TOP SELLING FOODS & INVENTORY BATCH PROFIT/LOSS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Item-Wise Sales Breakdown */}
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart size={18} className="text-[#4C1D95]" />
                  <h3 className="text-sm md:text-base font-black text-[#111827]">
                    Item-Wise Sales & Revenue Breakdown
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#4B5563]">
                  {topSellingItems.length} Menu Items Sold
                </span>
              </div>

              <div className="overflow-x-auto max-h-96 border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-black uppercase text-[#4B5563]">
                    <tr>
                      <th className="py-2.5 px-3.5">Food Item</th>
                      <th className="py-2.5 px-3.5 text-center">Qty Sold</th>
                      <th className="py-2.5 px-3.5 text-right">Revenue</th>
                      <th className="py-2.5 px-3.5 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {topSellingItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#6B7280] font-semibold">
                          No food sales recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      topSellingItems.map((item, idx) => (
                        <tr key={item.name + idx} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3.5">
                            <div className="font-extrabold text-[#111827]">{item.name}</div>
                            <div className="text-[10px] font-bold text-[#6B7280]">{item.category} • ₹{item.unitPrice}/unit</div>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-black text-[#4C1D95]">
                            {item.quantitySold}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-black text-[#111827]">
                            ₹{item.revenue.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {item.sharePercent}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Inventory Batch Cost vs Profit Summary */}
            <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-[#4C1D95]" />
                  <h3 className="text-sm md:text-base font-black text-[#111827]">
                    Inventory Batch Investment vs Return
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#4B5563]">
                  {inventorySummary.length} Batches Tracked
                </span>
              </div>

              <div className="overflow-x-auto max-h-96 border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-black uppercase text-[#4B5563]">
                    <tr>
                      <th className="py-2.5 px-3.5">Material / Batch</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Batch Cost</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Sales Return</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {inventorySummary.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#6B7280] font-semibold">
                          No inventory batches added yet.
                        </td>
                      </tr>
                    ) : (
                      inventorySummary.map(inv => {
                        const isBatchProfit = inv.netProfitLoss >= 0;
                        return (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3.5">
                              <div className="font-extrabold text-[#111827]">{inv.name}</div>
                              <div className="text-[10px] font-bold text-[#6B7280]">
                                Sold: {inv.soldUnits} | Stock Left: {inv.remainingQuantity} {inv.unit}
                              </div>
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-bold text-[#4B5563] whitespace-nowrap">
                              ₹{inv.purchaseCost.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-extrabold text-[#111827] whitespace-nowrap">
                              ₹{inv.salesRevenue.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center justify-end px-2.5 py-1 rounded-lg text-[11px] font-black border whitespace-nowrap leading-none ${
                                  isBatchProfit
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {isBatchProfit ? '+' : '−'}₹{Math.abs(inv.netProfitLoss).toLocaleString('en-IN')}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 5: DAY-BY-DAY FINANCIAL LEDGER TABLE */}
          <div className="bg-white rounded-3xl border border-[#D1D5DB] p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[#4C1D95]" />
                <h3 className="text-sm md:text-base font-black text-[#111827]">
                  Day-by-Day Financial Ledger (Daily Account Book)
                </h3>
              </div>
              <span className="text-xs font-bold text-[#4B5563]">
                {dailyLedger.length} Active {dailyLedger.length === 1 ? 'Day' : 'Days'}
              </span>
            </div>

            <div className="overflow-x-auto border border-[#E5E7EB] rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-black uppercase text-[#4B5563]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">Cash</th>
                    <th className="py-3 px-4 text-right">UPI</th>
                    <th className="py-3 px-4 text-right">Card</th>
                    <th className="py-3 px-4 text-right">GST Included</th>
                    <th className="py-3 px-4 text-right">Shop Expenses</th>
                    <th className="py-3 px-4 text-right">Net Day Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {dailyLedger.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#6B7280] font-semibold">
                        No ledger entries found for {periodLabel}.
                      </td>
                    </tr>
                  ) : (
                    dailyLedger.map(row => (
                      <tr key={row.date} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4 font-extrabold text-[#111827] whitespace-nowrap">{row.date}</td>
                        <td className="py-3 px-4 text-center font-bold text-[#4C1D95]">{row.ordersCount}</td>
                        <td className="py-3 px-4 text-right font-black text-[#111827]">
                          ₹{row.grossSales.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          ₹{row.cashSales.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#4C1D95]">
                          ₹{row.upiSales.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700">
                          ₹{row.cardSales.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#4B5563]">
                          ₹{row.gstCollected.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">
                          -₹{row.shopExpenses.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap leading-none ${
                              row.netDayIncome >= 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {row.netDayIncome >= 0 ? '+' : '-'}₹{Math.abs(row.netDayIncome).toLocaleString('en-IN')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ADD / EDIT SHOP EXPENSE MODAL (PORTAL) */}
      {showExpenseModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white border border-[#D1D5DB] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto">
              <div className="bg-[#4C1D95] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wallet size={20} />
                  <h3 className="font-black text-base">
                    {editingExpense ? 'Edit Shop Expense' : 'Add Daily Shop Expense'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-[#111827] uppercase mb-1.5">
                    Expense Title / Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Commercial Gas Cylinder, Milk & Curd, Staff Salary Advance"
                    value={expTitle}
                    onChange={e => setExpTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-extrabold text-[#111827] uppercase">
                        Category *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomExpCategory(!isCustomExpCategory)}
                        className="text-[11px] font-extrabold text-[#4C1D95] hover:underline cursor-pointer"
                      >
                        {isCustomExpCategory ? 'Select Preset' : '+ Custom Option'}
                      </button>
                    </div>
                    {isCustomExpCategory ? (
                      <input
                        type="text"
                        required
                        placeholder="Enter custom category..."
                        value={customExpCategory}
                        onChange={e => setCustomExpCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#4C1D95] text-sm font-bold text-[#111827] bg-violet-50/30 focus:outline-none"
                      />
                    ) : (
                      <select
                        value={expCategory}
                        onChange={e => setExpCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-bold text-[#111827] bg-white focus:outline-none focus:border-[#4C1D95]"
                      >
                        {EXPENSE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#111827] uppercase mb-1.5">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="e.g., 1100"
                      value={expAmount}
                      onChange={e => setExpAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-black text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-[#111827] uppercase mb-1.5">
                      Paid Via *
                    </label>
                    <select
                      value={expPaymentMode}
                      onChange={e => setExpPaymentMode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-bold text-[#111827] bg-white focus:outline-none focus:border-[#4C1D95]"
                    >
                      {PAYMENT_MODES.map(modeOption => (
                        <option key={modeOption} value={modeOption}>
                          {modeOption}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#111827] uppercase mb-1.5">
                      Expense Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={e => setExpDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-bold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#111827] uppercase mb-1.5">
                    Notes / Bill Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Paid to vendor Ramesh / Bill #402"
                    value={expNotes}
                    onChange={e => setExpNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#111827] focus:outline-none focus:border-[#4C1D95]"
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-extrabold text-[#4B5563] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="px-5 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold shadow-md shadow-[#4C1D95]/20 cursor-pointer disabled:opacity-50"
                  >
                    {savingExpense ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
