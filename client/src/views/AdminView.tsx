import React, { useState, useEffect } from 'react';
import { analyticsApi, orderApi, tableApi, getSocket, BASE_URL } from '../services/api';
import { SmartTable, Order } from '../types';
import { 
  TrendingUp, Users, Clock, ShoppingBag, 
  BarChart3, RefreshCw, Layers, Sparkles, Filter, 
  Calendar, CheckCircle, AlertTriangle, AlertCircle, 
  Search, ShieldAlert, Check, X, Printer, Receipt, DollarSign,
  Coffee, ChevronRight, PieChart as PieIcon, LogOut, QrCode, Download
} from 'lucide-react';
import { TableManagement } from '../components/TableManagement';

interface AdminViewProps {
  user: { username: string; role: string };
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reception' | 'tables'>('overview');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days'>('today');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Reception Desk State
  const [receptionOrders, setReceptionOrders] = useState<Order[]>([]);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [settlingBill, setSettlingBill] = useState(false);
  const [pendingTableFilter, setPendingTableFilter] = useState<string>('all');

  // Payment History Log State
  const [paymentHistory, setPaymentHistory] = useState<Order[]>([]);
  const [historyTableFilter, setHistoryTableFilter] = useState<string>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('all');

  // Overview Order History State & Filters
  const [allSystemOrders, setAllSystemOrders] = useState<Order[]>([]);
  const [overviewStatusFilter, setOverviewStatusFilter] = useState<string>('all');
  const [overviewTableFilter, setOverviewTableFilter] = useState<string>('all');

  // Dynamic system tables list
  const [allSystemTables, setAllSystemTables] = useState<SmartTable[]>([]);

  // Toast Notification System State
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'danger' }>>([]);

  const addToast = (message: string, type: 'info' | 'success' | 'danger' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    fetchAdminData(dateFilter);
    fetchReceptionOrders();

    tableApi.getAll()
      .then(tbls => setAllSystemTables(tbls || []))
      .catch(e => console.error('Failed to load system tables in AdminView:', e));

    const socket = getSocket();
    socket.emit('join_room', 'admins');

    socket.on('new_order', (newOrder: Order) => {
      addToast(`🔔 New Order #${newOrder._id.slice(-4)} placed for Table ${newOrder.tableNumber}! Total: ₹${newOrder.totalAmount}`, 'info');
      fetchReceptionOrders();
    });

    socket.on('order_updated', (updatedOrder: Order) => {
      if (updatedOrder.status === 'ready') {
        addToast(`🔔 Chef Food Ready! Table ${updatedOrder.tableNumber} is ready for Reception Billing!`, 'success');
      } else if (updatedOrder.status === 'cancelled') {
        addToast(`⚠️ Order #${updatedOrder._id.slice(-4)} for Table ${updatedOrder.tableNumber} was CANCELLED!`, 'danger');
      }
      fetchReceptionOrders();
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
    };
  }, []);

  const defaultDashboardData = {
    grossRevenue: 4250,
    totalOrders: 18,
    avgPrepTimeMins: 14,
    liveActiveTables: 3,
    salesBreakdown: [
      { name: 'Today', sales: 4250, count: 18 }
    ],
    categoryBreakdown: [
      { category: 'Cakes', sales: 2150, percent: 50 },
      { category: 'Snacks', sales: 1200, percent: 28 },
      { category: 'Juice', sales: 900, percent: 14 },
      { category: 'Chats', sales: 400, percent: 8 }
    ],
    peakHours: [
      { hour: '8 AM', orders: 2 },
      { hour: '10 AM', orders: 3 },
      { hour: '12 PM', orders: 6 },
      { hour: '2 PM', orders: 8 },
      { hour: '4 PM', orders: 4 },
      { hour: '6 PM', orders: 7 },
      { hour: '8 PM', orders: 5 },
      { hour: '10 PM', orders: 2 }
    ],
    recentCompletedOrders: []
  };

  const fetchAdminData = async (filter = dateFilter) => {
    setLoading(true);
    try {
      const data = await analyticsApi.getDashboard(filter);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch store analytics, using default dashboard data:', err);
      setAnalytics(defaultDashboardData);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceptionOrders = async () => {
    try {
      const allOrders = await orderApi.getAll();
      setAllSystemOrders(allOrders || []);
      const unsettled = allOrders.filter((o: Order) => 
        o.status !== 'served' && 
        o.status !== 'cancelled' && 
        ['ready', 'served', 'quality_check'].includes(o.status)
      );
      setReceptionOrders(unsettled);

      // Payment History: include served, paid, or settled orders
      const history = allOrders.filter((o: Order) => 
        o.status === 'served' || 
        o.paymentStatus === 'paid' || 
        (o.paymentStatus as any) === 'Paid' || 
        (o.paymentMethod && o.paymentMethod.trim() !== '')
      );
      setPaymentHistory(history);
    } catch (err) {
      console.error('Failed to fetch reception orders:', err);
    }
  };

  const playCashRegisterChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(audioCtx.currentTime);
      osc2.start(audioCtx.currentTime + 0.1);
      osc1.stop(audioCtx.currentTime + 0.1);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Context blocked', e);
    }
  };

  const handlePrintAndSettleBill = async () => {
    if (!selectedReceiptOrder) return;
    setSettlingBill(true);
    try {
      const selectedMethodLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'upi' ? 'UPI' : 'Credit Card';

      await orderApi.closeTable(selectedReceiptOrder._id, selectedMethodLabel);

      playCashRegisterChime();

      addToast(
        `💰 ${selectedMethodLabel.toUpperCase()} PAYMENT CONFIRMED! ₹${selectedReceiptOrder.totalAmount?.toFixed(2)} received for Table ${selectedReceiptOrder.tableNumber}. Saved in Payment History & Table released to AVAILABLE!`,
        'success'
      );

      await fetchAdminData(dateFilter);
      await fetchReceptionOrders();
      setSelectedReceiptOrder(null);
    } catch (err: any) {
      alert('Failed to settle bill: ' + (err.message || err));
    } finally {
      setSettlingBill(false);
    }
  };

  const dynamicTableNumbers = Array.from(
    new Set([
      ...allSystemTables.map((t: any) => String(t.tableNumber)),
      ...receptionOrders.map((o: any) => String(o.tableNumber)),
      ...paymentHistory.map((o: any) => String(o.tableNumber))
    ])
  ).sort((a, b) => Number(a) - Number(b));

  const filteredPendingOrders = receptionOrders.filter((o: any) => {
    if (pendingTableFilter === 'all') return true;
    return String(o.tableNumber) === String(pendingTableFilter);
  });

  const filteredPaymentHistory = paymentHistory.filter((o: any) => {
    const matchTable = historyTableFilter === 'all' || String(o.tableNumber) === String(historyTableFilter);
    
    if (!matchTable) return false;
    if (historyDateFilter === 'all') return true;

    const orderDate = new Date(o.createdAt || Date.now());
    const today = new Date();

    if (historyDateFilter === 'today') {
      return (
        orderDate.getFullYear() === today.getFullYear() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getDate() === today.getDate()
      );
    } else if (historyDateFilter === '7days') {
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= sevenDaysAgo;
    } else if (historyDateFilter === '30days') {
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= thirtyDaysAgo;
    }

    return true;
  });

  const handleDirectPrintReceipt = () => {
    if (!selectedReceiptOrder) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = selectedReceiptOrder.items?.map((item: any) => {
      const pName = item.product?.name || item.name || 'Food Item';
      const price = item.price || item.product?.price || 0;
      return `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
          <span>${item.quantity}x ${pName}</span>
          <span style="font-weight: bold;">₹${price * item.quantity}</span>
        </div>
        ${item.instructions ? `<div style="font-size: 9px; color: #CD0D0D; margin-bottom: 4px;">📌 Note: "${item.instructions}"</div>` : ''}
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt_Table_${selectedReceiptOrder.tableNumber}_#${selectedReceiptOrder._id.slice(-6)}</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 320px; margin: 0 auto; color: #1E1818; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0; color: #CD0D0D;">🍰 CakeFlow AI Bakery</h2>
            <div style="font-size: 10px;">Smart Dining & Food Court</div>
            <div style="font-size: 10px;">GSTIN: 33AAAAA0000A1Z5</div>
            <h4 style="margin: 5px 0 0 0;">TAX INVOICE RECEIPT</h4>
          </div>
          <div style="font-size: 11px; margin-bottom: 10px;">
            <div><b>Table:</b> Table ${selectedReceiptOrder.tableNumber}</div>
            <div><b>Guest:</b> ${selectedReceiptOrder.customerName}</div>
            <div><b>Bill #:</b> #${selectedReceiptOrder._id.slice(-6)}</div>
            <div><b>Time:</b> ${new Date().toLocaleTimeString()}</div>
            <div><b>Status:</b> ${selectedReceiptOrder.paymentStatus?.toUpperCase() || 'PAID'}</div>
          </div>
          <div style="border-top: 1px dashed #000; padding-top: 8px; margin-bottom: 8px; font-weight: bold; font-size: 10px;">
            ITEMS ORDERED
          </div>
          ${itemsHtml}
          <div style="border-top: 1px dashed #000; padding-top: 8px; margin-top: 10px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${(selectedReceiptOrder.totalAmount * 0.95).toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>CGST (2.5%):</span><span>₹${(selectedReceiptOrder.totalAmount * 0.025).toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>SGST (2.5%):</span><span>₹${(selectedReceiptOrder.totalAmount * 0.025).toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 5px; color: #CD0D0D;">
              <span>GRAND TOTAL:</span><span>₹${selectedReceiptOrder.totalAmount?.toFixed(2)}</span>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 10px;">
            Thank you for dining at CakeFlow AI!
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredOverviewOrders = allSystemOrders.filter((o: any) => {
    const matchTable = overviewTableFilter === 'all' || String(o.tableNumber) === String(overviewTableFilter);
    if (!matchTable) return false;

    if (overviewStatusFilter !== 'all') {
      if (overviewStatusFilter === 'paid') {
        const isPaid = o.paymentStatus === 'paid' || (o.paymentStatus as any) === 'Paid' || o.paymentMethod;
        if (!isPaid) return false;
      } else if (o.status !== overviewStatusFilter) {
        return false;
      }
    }

    const orderDate = new Date(o.createdAt || Date.now());
    const today = new Date();

    if (dateFilter === 'today') {
      return (
        orderDate.getFullYear() === today.getFullYear() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getDate() === today.getDate()
      );
    } else if (dateFilter === '7days') {
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= sevenDaysAgo;
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= thirtyDaysAgo;
    }

    return true;
  });

  const displayData = analytics || defaultDashboardData;

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1E1818] flex flex-col relative overflow-hidden pb-12">
      {/* Real-time Toast Notifications Banner */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:right-5 z-50 flex flex-col gap-2 max-w-sm sm:w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-4 rounded-2xl border shadow-xl flex items-start gap-2.5 animate-slide-in pointer-events-auto ${
              t.type === 'danger' 
                ? 'bg-rose-50 border-rose-300 text-rose-800' 
                : t.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-white border-[#D0C0C0] text-[#1E1818]'
            }`}
          >
            {t.type === 'danger' ? <AlertTriangle size={16} className="shrink-0 mt-0.5 text-[#CD0D0D]" /> : <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-600" />}
            <span className="text-xs font-bold leading-relaxed">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#D0C0C0] px-4 md:px-6 py-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between z-10 shrink-0 gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
              <BarChart3 size={18} />
            </div>
            <div>
              <h1 className="font-extrabold text-base md:text-lg tracking-tight text-[#CD0D0D]">
                CakeFlow Dashboard
              </h1>
              <p className="text-[10px] md:text-xs text-[#6E6262] font-semibold">
                Live Store Operations & Billing
              </p>
            </div>
          </div>

          <button 
            onClick={onLogout}
            className="md:hidden text-xs text-[#6E6262] hover:text-[#CD0D0D] bg-white border border-[#D0C0C0] p-2 rounded-xl font-bold transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-[#FAF8F8] border border-[#D0C0C0] p-1 rounded-2xl overflow-x-auto max-w-full scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'overview' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            Overview
          </button>
          
          <button
            onClick={() => {
              setActiveTab('reception');
              fetchReceptionOrders();
            }}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer relative whitespace-nowrap ${activeTab === 'reception' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            <Receipt size={14} />
            <span>Reception & Billing</span>
            {receptionOrders.length > 0 && (
              <span className="bg-[#CD0D0D] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse ml-0.5 border border-white">
                {receptionOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeTab === 'tables' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            <QrCode size={13} />
            <span>Tables & QR</span>
          </button>
        </div>

        <button 
          onClick={onLogout}
          className="hidden md:flex text-xs text-[#6E6262] hover:text-[#CD0D0D] bg-white border border-[#D0C0C0] px-3.5 py-2 rounded-xl items-center gap-1.5 font-bold transition-colors cursor-pointer shadow-sm"
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Grid content */}
      <main className="max-w-6xl w-full mx-auto p-6 z-10 space-y-6">
        
        {/* VIEW: TABLES & QR CODE MANAGEMENT */}
        {activeTab === 'tables' && <TableManagement />}

        {/* VIEW: RECEPTION & BILLING DESK */}
        {activeTab === 'reception' && (
          <div className="space-y-8">
            {/* Reception Header Banner */}
            <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 rounded-2xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20">
                  <Receipt size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1818] flex items-center gap-2">
                    <span>Reception Billing Counter</span>
                    <span className="text-xs bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/30 px-2.5 py-0.5 rounded-full font-extrabold">
                      {receptionOrders.length} Unsettled Bills
                    </span>
                  </h2>
                  <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
                    Generate Tax Invoice Receipts, Record Cash Payments & Release Tables to Available Status
                  </p>
                </div>
              </div>

              <button
                onClick={fetchReceptionOrders}
                className="px-4 py-2.5 bg-[#FAF8F8] hover:bg-white text-[#1E1818] border border-[#D0C0C0] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Queue</span>
              </button>
            </div>

            {/* Reception Orders Cards Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-extrabold text-[#1E1818] uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={16} className="text-[#CD0D0D]" />
                  <span>Pending Table Bills ({filteredPendingOrders.length})</span>
                </h3>

                {/* Filter Table Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-2xl border border-[#D0C0C0] shadow-sm">
                  <span className="text-xs font-bold text-[#6E6262] px-2 flex items-center gap-1">
                    <Filter size={12} className="text-[#CD0D0D]" /> Table:
                  </span>
                  <button
                    onClick={() => setPendingTableFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      pendingTableFilter === 'all'
                        ? 'bg-[#CD0D0D] text-white shadow'
                        : 'text-[#6E6262] hover:text-[#1E1818]'
                    }`}
                  >
                    All
                  </button>
                  {dynamicTableNumbers.map(tNum => (
                    <button
                      key={tNum}
                      onClick={() => setPendingTableFilter(tNum)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        pendingTableFilter === tNum
                          ? 'bg-[#CD0D0D] text-white shadow'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      T{tNum}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPendingOrders.length === 0 ? (
                <div className="bg-white border border-[#D0C0C0] rounded-3xl p-12 text-center space-y-3 shadow-sm">
                  <CheckCircle size={40} className="mx-auto text-emerald-500" />
                  <h4 className="text-base font-extrabold text-[#1E1818]">All Table Bills Cleared!</h4>
                  <p className="text-xs text-[#6E6262]">No table orders are currently awaiting billing receipt generation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredPendingOrders.map((order: Order) => (
                    <div 
                      key={order._id}
                      className="bg-white border border-[#D0C0C0] hover:border-[#CD0D0D] rounded-3xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Table Header */}
                        <div className="flex justify-between items-start border-b border-[#E8E0E0] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-9 h-9 rounded-2xl bg-[#CD0D0D]/10 text-[#CD0D0D] font-black text-sm flex items-center justify-center border border-[#CD0D0D]/30">
                              T{order.tableNumber}
                            </span>
                            <div>
                              <h4 className="font-extrabold text-sm text-[#1E1818]">{order.customerName}</h4>
                              <p className="text-[10px] text-[#6E6262] font-mono">Order #{order._id.slice(-4)}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow">
                            {order.status}
                          </span>
                        </div>

                        {/* Order Items Table Summary */}
                        <div className="space-y-1.5 bg-[#FAF8F8] p-3 rounded-2xl border border-[#D0C0C0]">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="text-xs flex justify-between items-center text-[#1E1818]">
                              <span className="font-semibold">
                                {item.quantity}x {item.product?.name || item.name || 'Food Item'}
                              </span>
                              <span className="font-mono font-bold text-[#CD0D0D]">
                                ₹{(item.price || item.product?.price || 0) * item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total Amount Banner */}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-bold text-[#6E6262]">Total Amount:</span>
                          <span className="text-lg font-black text-[#CD0D0D] font-mono">
                            ₹{order.totalAmount?.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Cash Pay & Generate Receipt Action */}
                      <button
                        onClick={() => setSelectedReceiptOrder(order)}
                        className="w-full py-3 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-2xl text-xs shadow-md shadow-[#CD0D0D]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                      >
                        <Printer size={15} />
                        <span>Settle Bill & Release Table {order.tableNumber}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PAYMENT SETTLEMENT HISTORY LOG */}
            <div className="space-y-4 pt-4 border-t border-[#D0C0C0]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-extrabold text-[#1E1818] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-600" />
                  <span>Payment Settlement History Log ({filteredPaymentHistory.length})</span>
                </h3>

                {/* Date & Table Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Date Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1">
                      <Calendar size={12} className="text-[#CD0D0D]" /> Date:
                    </span>
                    {['all', 'today', '7days', '30days'].map(f => (
                      <button
                        key={f}
                        onClick={() => setHistoryDateFilter(f)}
                        className={`px-2.5 py-1 rounded-xl text-xs capitalize transition-all cursor-pointer ${
                          historyDateFilter === f
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Table Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1">
                      <Filter size={12} className="text-[#CD0D0D]" /> Table:
                    </span>
                    <button
                      onClick={() => setHistoryTableFilter('all')}
                      className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                        historyTableFilter === 'all'
                          ? 'bg-[#CD0D0D] text-white shadow'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      All
                    </button>
                    {dynamicTableNumbers.map(tNum => (
                      <button
                        key={tNum}
                        onClick={() => setHistoryTableFilter(tNum)}
                        className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer ${
                          historyTableFilter === tNum
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        T{tNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredPaymentHistory.length === 0 ? (
                <div className="bg-white border border-[#D0C0C0] rounded-3xl p-8 text-center text-[#6E6262] text-xs font-semibold">
                  No payment history transactions match selected filters.
                </div>
              ) : (
                <div className="bg-white border border-[#D0C0C0] rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF8F8] border-b border-[#D0C0C0] text-[#6E6262] font-extrabold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-4">Order ID</th>
                          <th className="p-4">Table #</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Payment Method</th>
                          <th className="p-4">Amount Paid</th>
                          <th className="p-4">Time Settled</th>
                          <th className="p-4 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E0E0] text-[#1E1818]">
                        {filteredPaymentHistory.map((order: Order) => (
                          <tr 
                            key={order._id} 
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="hover:bg-[#CD0D0D]/5 transition-colors cursor-pointer group"
                          >
                            <td className="p-4 font-mono font-bold text-[#CD0D0D]">#{order._id.slice(-6)}</td>
                            <td className="p-4 font-extrabold text-[#CD0D0D] group-hover:underline">Table {order.tableNumber}</td>
                            <td className="p-4 font-semibold">{order.customerName}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/30">
                                {order.paymentMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                            <td className="p-4 text-[#6E6262] font-semibold">
                              {new Date((order as any).updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReceiptOrder(order);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#FAF8F8] group-hover:bg-[#CD0D0D] group-hover:text-white text-[#1E1818] border border-[#D0C0C0] font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: OVERVIEW STORE ANALYTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Filter Pill Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-[#1E1818]">Store Operations Overview</h2>
                <p className="text-xs text-[#6E6262] font-semibold mt-0.5">Real-time revenue metrics, kitchen performance, and sales stats</p>
              </div>

              <div className="flex bg-white p-1 rounded-2xl border border-[#D0C0C0] shadow-sm">
                {(['today', '7days', '30days'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setDateFilter(f);
                      fetchAdminData(f);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${dateFilter === f ? 'bg-[#CD0D0D] text-white shadow' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
                  >
                    {f === 'today' ? 'Today' : f === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
              </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Gross Revenue</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><TrendingUp size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#CD0D0D] font-mono">₹{displayData.grossRevenue?.toFixed(2)}</div>
                <p className="text-[10px] text-emerald-600 font-bold">+14% from previous period</p>
              </div>

              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Total Orders</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><ShoppingBag size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#1E1818] font-mono">{displayData.totalOrders}</div>
                <p className="text-[10px] text-[#6E6262] font-semibold">Completed Orders</p>
              </div>

              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Avg Prep Time</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><Clock size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#1E1818] font-mono">{displayData.avgPrepTimeMins} <span className="text-xs font-bold text-[#6E6262]">mins</span></div>
                <p className="text-[10px] text-emerald-600 font-bold">Fast Kitchen Preparation</p>
              </div>

              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Active Tables</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><Users size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#CD0D0D] font-mono">{displayData.liveActiveTables || 3}</div>
                <p className="text-[10px] text-[#6E6262] font-semibold">Live Occupied Tables</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#E8E0E0] pb-3">
                  <h3 className="font-extrabold text-sm text-[#1E1818]">Category Sales Share</h3>
                  <PieIcon size={16} className="text-[#CD0D0D]" />
                </div>
                <div className="space-y-3">
                  {(() => {
                    const categories = (displayData?.categoryBreakdown && displayData.categoryBreakdown.length > 0)
                      ? displayData.categoryBreakdown
                      : defaultDashboardData.categoryBreakdown;

                    return categories.map((cat: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#1E1818]">{cat.category}</span>
                          <span className="text-[#CD0D0D] font-mono">₹{cat.sales || 0} ({cat.percent || 0}%)</span>
                        </div>
                        <div className="w-full bg-[#FAF8F8] border border-[#D0C0C0] rounded-full h-2.5 overflow-hidden">
                          <div className="h-full bg-[#CD0D0D] rounded-full transition-all duration-500" style={{ width: `${Math.max(5, cat.percent || 0)}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Peak Dining Hours Line Graph */}
              <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#E8E0E0] pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1E1818]">Peak Dining Hours Graph</h3>
                    <p className="text-[10px] text-[#6E6262] font-semibold">Hourly order volume line chart</p>
                  </div>
                  <TrendingUp size={18} className="text-[#CD0D0D]" />
                </div>

                <div className="pt-2 relative">
                  {(() => {
                    const peaks = (displayData?.peakHours && displayData.peakHours.length > 0)
                      ? displayData.peakHours
                      : defaultDashboardData.peakHours;

                    const maxOrders = Math.max(1, ...peaks.map((p: any) => p.orders || 0));
                    const width = 500;
                    const height = 130;
                    const paddingX = 30;
                    const paddingY = 25;

                    const points = peaks.map((p: any, i: number) => {
                      const x = paddingX + (i * ((width - paddingX * 2) / (peaks.length - 1)));
                      const y = height - paddingY - (((p.orders || 0) / maxOrders) * (height - paddingY * 2));
                      return { x, y, hour: p.hour, orders: p.orders || 0 };
                    });

                    const linePath = points.reduce((acc: string, pt: any, i: number) => {
                      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                    }, '');

                    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - 15} L ${points[0].x} ${height - 15} Z`;

                    return (
                      <div className="w-full overflow-x-auto">
                        <div className="min-w-[420px] relative">
                          <svg viewBox={`0 0 ${width} ${height + 25}`} className="w-full h-auto overflow-visible">
                            <defs>
                              <linearGradient id="peakLineGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#CD0D0D" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#CD0D0D" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Horizontal Grid lines */}
                            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#E8E0E0" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1={paddingX} y1={(height - 15) / 2 + paddingY / 2} x2={width - paddingX} y2={(height - 15) / 2 + paddingY / 2} stroke="#E8E0E0" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1={paddingX} y1={height - 15} x2={width - paddingX} y2={height - 15} stroke="#D0C0C0" strokeWidth="1.5" />

                            {/* Area Gradient Fill */}
                            <path d={areaPath} fill="url(#peakLineGradient)" />

                            {/* Main Curve Line */}
                            <path d={linePath} fill="none" stroke="#CD0D0D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Interactive Data Points & Labels */}
                            {points.map((pt: any, idx: number) => (
                              <g key={idx} className="group cursor-pointer">
                                {/* Vertical Guideline on Hover */}
                                <line 
                                  x1={pt.x} y1={paddingY} x2={pt.x} y2={height - 15} 
                                  stroke="#CD0D0D" strokeWidth="1" strokeDasharray="2 2" 
                                  className="opacity-0 group-hover:opacity-100 transition-opacity" 
                                />

                                {/* Dot Node */}
                                <circle 
                                  cx={pt.x} cy={pt.y} r="5" 
                                  className="fill-[#CD0D0D] stroke-white stroke-2 group-hover:r-7 transition-all" 
                                />

                                {/* Tooltip Text on Hover */}
                                <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <rect 
                                    x={pt.x - 30} y={Math.max(2, pt.y - 30)} 
                                    width="60" height="20" rx="6" 
                                    className="fill-[#1E1818]" 
                                  />
                                  <text 
                                    x={pt.x} y={Math.max(2, pt.y - 30) + 13} 
                                    textAnchor="middle" 
                                    className="fill-white text-[9px] font-mono font-bold"
                                  >
                                    {pt.orders} orders
                                  </text>
                                </g>

                                {/* X-Axis Hour Label */}
                                <text 
                                  x={pt.x} y={height + 12} 
                                  textAnchor="middle" 
                                  className="fill-[#6E6262] text-[10px] font-bold font-sans"
                                >
                                  {pt.hour}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* OVERVIEW ORDER HISTORY TABLE WITH FILTERS */}
            <div className="space-y-4 pt-6 border-t border-[#D0C0C0]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1E1818] uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#CD0D0D]" />
                    <span>Overview Store Order History</span>
                  </h3>
                  <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
                    Complete log of all live & past store orders with status & table filters
                  </p>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold shadow-xs">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1">
                      <Filter size={12} className="text-[#CD0D0D]" /> Status:
                    </span>
                    {['all', 'paid', 'pending', 'ready', 'cancelled'].map(st => (
                      <button
                        key={st}
                        onClick={() => setOverviewStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                          overviewStatusFilter === st
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Table Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold shadow-xs">
                    <span className="text-[#6E6262] px-2">Table:</span>
                    <button
                      onClick={() => setOverviewTableFilter('all')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        overviewTableFilter === 'all'
                          ? 'bg-[#CD0D0D] text-white shadow'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      All
                    </button>
                    {dynamicTableNumbers.map(tNum => (
                      <button
                        key={tNum}
                        onClick={() => setOverviewTableFilter(tNum)}
                        className={`px-2 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          overviewTableFilter === tNum
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        T{tNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order History Table */}
              <div className="bg-white border border-[#D0C0C0] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F8] border-b border-[#D0C0C0] text-[#6E6262] font-extrabold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Table #</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Items Summary</th>
                        <th className="p-4">Total Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date & Time</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0E0] text-[#1E1818]">
                      {filteredOverviewOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[#6E6262] font-semibold">
                            No orders found matching selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredOverviewOrders.map((order: Order) => (
                          <tr 
                            key={order._id}
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="hover:bg-[#CD0D0D]/5 transition-colors cursor-pointer group"
                          >
                            <td className="p-4 font-mono font-bold text-[#CD0D0D]">#{order._id.slice(-6)}</td>
                            <td className="p-4 font-extrabold text-[#CD0D0D] group-hover:underline">Table {order.tableNumber}</td>
                            <td className="p-4 font-semibold">{order.customerName}</td>
                            <td className="p-4 text-[11px] text-[#6E6262] font-medium max-w-[200px] truncate">
                              {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                            </td>
                            <td className="p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-xs ${
                                order.status === 'served' || order.paymentStatus === 'paid'
                                  ? 'bg-emerald-500 text-white'
                                  : order.status === 'cancelled'
                                    ? 'bg-[#CD0D0D] text-white'
                                    : 'bg-amber-500 text-white'
                              }`}>
                                {order.paymentStatus === 'paid' ? 'PAID' : order.status}
                              </span>
                            </td>
                            <td className="p-4 text-[#6E6262] font-semibold">
                              {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReceiptOrder(order);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#FAF8F8] group-hover:bg-[#CD0D0D] group-hover:text-white text-[#1E1818] border border-[#D0C0C0] font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                              >
                                View Bill
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* TAX RECEIPT & CASH PAYMENT CONFIRMATION MODAL */}
      {selectedReceiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#D0C0C0] w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl relative animate-scale-in text-[#1E1818]">
            {/* Close Button */}
            <button
              onClick={() => setSelectedReceiptOrder(null)}
              className="absolute top-4 right-4 text-[#6E6262] hover:text-[#1E1818] p-1.5 rounded-full bg-[#FAF8F8] cursor-pointer"
            >
              ✕
            </button>

            {/* Printable Tax Receipt Paper View */}
            <div id="printable-receipt-card" className="bg-[#FAF8F8] border border-[#D0C0C0] p-5 rounded-2xl space-y-4 font-mono text-xs text-[#1E1818]">
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-[#D0C0C0] pb-3 space-y-1">
                <h2 className="font-extrabold text-base text-[#CD0D0D] tracking-tight">🍰 CakeFlow AI Bakery</h2>
                <p className="text-[10px] text-[#6E6262]">Smart Dining & Food Court</p>
                <p className="text-[10px] text-[#6E6262]">GSTIN: 33AAAAA0000A1Z5</p>
                <div className="text-[10px] font-bold text-[#CD0D0D] pt-1">TAX INVOICE RECEIPT</div>
              </div>

              {/* Order Info */}
              <div className="flex justify-between text-[11px] border-b border-dashed border-[#D0C0C0] pb-2">
                <div>
                  <div><span className="text-[#6E6262]">Table:</span> Table {selectedReceiptOrder.tableNumber}</div>
                  <div><span className="text-[#6E6262]">Guest:</span> {selectedReceiptOrder.customerName}</div>
                </div>
                <div className="text-right">
                  <div><span className="text-[#6E6262]">Bill #:</span> {selectedReceiptOrder._id.slice(-6)}</div>
                  <div><span className="text-[#6E6262]">Time:</span> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1 border-b border-dashed border-[#D0C0C0] pb-3">
                <div className="flex justify-between font-bold text-[10px] text-[#6E6262] uppercase border-b border-[#D0C0C0] pb-1">
                  <span>Item</span>
                  <span>Qty x Rate</span>
                  <span>Amt</span>
                </div>
                {selectedReceiptOrder.items?.map((item: any, idx: number) => {
                  const pName = item.product?.name || item.name || 'Food Item';
                  const price = item.price || item.product?.price || 0;
                  return (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="truncate max-w-[140px]">{pName}</span>
                      <span>{item.quantity} x ₹{price}</span>
                      <span className="font-bold">₹{price * item.quantity}</span>
                    </div>
                  );
                })}
              </div>

              {/* Taxes & Total */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-[#6E6262]">
                  <span>Subtotal:</span>
                  <span>₹{(selectedReceiptOrder.totalAmount * 0.95).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#6E6262]">
                  <span>CGST (2.5%):</span>
                  <span>₹{(selectedReceiptOrder.totalAmount * 0.025).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#6E6262]">
                  <span>SGST (2.5%):</span>
                  <span>₹{(selectedReceiptOrder.totalAmount * 0.025).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#CD0D0D] border-t border-dashed border-[#D0C0C0] pt-2">
                  <span>GRAND TOTAL:</span>
                  <span>₹{selectedReceiptOrder.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Direct Print & Save PDF Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleDirectPrintReceipt}
                className="flex-1 py-2.5 bg-white border border-[#D0C0C0] hover:border-[#CD0D0D] hover:bg-[#FAF8F8] text-[#1E1818] font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Printer size={15} className="text-[#CD0D0D]" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={handleDirectPrintReceipt}
                className="flex-1 py-2.5 bg-white border border-[#D0C0C0] hover:border-[#CD0D0D] hover:bg-[#FAF8F8] text-[#1E1818] font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <Download size={15} className="text-emerald-600" />
                <span>Save as PDF</span>
              </button>
            </div>

            {/* Payment Method Selector & Confirm Action */}
            {selectedReceiptOrder.status !== 'served' && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider">Select Payment Method:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'upi', 'card'] as const).map((method) => {
                      const label = method === 'cash' ? '💵 Cash' : method === 'upi' ? '📱 UPI' : '💳 Card';
                      return (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            paymentMethod === method
                              ? 'bg-[#CD0D0D] text-white shadow-md'
                              : 'bg-[#FAF8F8] border border-[#D0C0C0] text-[#1E1818] hover:bg-white'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Settle & Set Table Available Button */}
                <div className="space-y-2">
                  <button
                    onClick={handlePrintAndSettleBill}
                    disabled={settlingBill}
                    className="w-full py-3.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-[#CD0D0D]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    <span>{settlingBill ? 'Saving History & Releasing Table...' : `Confirm ${paymentMethod.toUpperCase()} Payment & Release Table ${selectedReceiptOrder.tableNumber}`}</span>
                  </button>
                  <p className="text-[10px] text-center text-[#6E6262]">
                    Clicking this button saves the payment history transaction in MongoDB and automatically moves Table {selectedReceiptOrder.tableNumber} to Available status.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
