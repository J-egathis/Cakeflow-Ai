import React, { useState, useEffect } from 'react';
import { AIPredictions, InventoryItem } from '../types';
import { analyticsApi, inventoryApi, getSocket } from '../services/api';
import { TableManagement } from '../components/TableManagement';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, Package, Clock, AlertTriangle, 
  Sparkles, RefreshCw, Layers, BrainCircuit, Activity, CheckCircle, 
  HelpCircle, ShieldCheck, Flame, Ban, LogOut, QrCode 
} from 'lucide-react';

interface AdminViewProps {
  user: { username: string };
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [data, setData] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'inventory' | 'ai'>('overview');
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: string }>>([]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const dashboardData = await analyticsApi.getDashboard();
      setData(dashboardData);
      
      const invData = await inventoryApi.getAll();
      setInventory(invData);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    // Sockets setup
    const socket = getSocket();
    socket.emit('join_room', 'admins');

    // Live events
    socket.on('new_order', (order) => {
      addToast(`New Order #${order._id.slice(-4)} placed for Table ${order.tableNumber}`, 'info');
      fetchAdminData();
    });

    socket.on('order_updated', (order) => {
      addToast(`Order #${order._id.slice(-4)} updated: ${order.status}`, 'success');
      fetchAdminData();
    });

    socket.on('low_stock_alert', (item) => {
      addToast(`ALERT: Ingredient ${item.name} is running extremely low!`, 'danger');
      fetchAdminData();
    });

    socket.on('inventory_updated', () => {
      // Re-fetch inventory levels
      inventoryApi.getAll().then(setInventory).catch(console.error);
    });

    return () => {
      socket.emit('leave_room', 'admins');
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('low_stock_alert');
      socket.off('inventory_updated');
    };
  }, []);

  const addToast = (message: string, type: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Play alert sound for admin
    playAdminAlertSound(type);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const playAdminAlertSound = (type: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'danger') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      console.log('Audio Context blocked', e);
    }
  };

  const handleRefillInventory = async () => {
    try {
      const res = await inventoryApi.refill();
      addToast(res.message, 'success');
      const invData = await inventoryApi.getAll();
      setInventory(invData);
    } catch (err) {
      alert('Failed to refill inventory: ' + err);
    }
  };

  const handleUpdateStock = async (id: string, newQty: number) => {
    try {
      await inventoryApi.update(id, newQty);
      addToast('Ingredient quantity updated', 'success');
      const invData = await inventoryApi.getAll();
      setInventory(invData);
    } catch (err) {
      alert('Failed to update stock: ' + err);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center">
        <RefreshCw size={32} className="animate-spin text-rose-500 mb-3" />
        <p className="text-xs text-slate-400">Loading AI Dashboard Insights...</p>
      </div>
    );
  }

  // Pie Chart Colors
  const COLORS = ['#FF6B6B', '#FFB347', '#FFDA77', '#4D96FF', '#6BCB77'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative pb-10">
      {/* Toast Notification Container */}
      <div className="fixed top-6 right-6 z-50 space-y-3 w-80 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-4 rounded-2xl border backdrop-blur-xl shadow-xl flex items-start gap-2.5 animate-slide-in pointer-events-auto ${
              t.type === 'danger' 
                ? 'bg-red-500/15 border-red-500/30 text-red-400' 
                : t.type === 'success' 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-450' 
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
            }`}
          >
            {t.type === 'danger' ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle size={16} className="shrink-0 mt-0.5" />}
            <span className="text-xs font-semibold leading-relaxed">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Background radial overlays */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-rose-500/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[50%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md">
            <BrainCircuit size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-amber-400">
              CakeFlow AI
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Enterprise Dashboard & Smart Engine</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-950 border border-slate-850 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === 'overview' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'tables' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <QrCode size={13} />
            <span>Tables & QR</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === 'inventory' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === 'ai' ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            AI Engine
          </button>
        </div>

        <button 
          onClick={onLogout}
          className="text-xs text-slate-400 hover:text-rose-400 bg-slate-800/35 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Grid content */}
      <main className="max-w-6xl w-full mx-auto p-6 z-10 space-y-6">
        
        {/* VIEW: TABLES & QR CODE MANAGEMENT */}
        {activeTab === 'tables' && <TableManagement />}

        {/* VIEW: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Gross Revenue</span>
                  <DollarSign size={16} className="text-rose-400" />
                </div>
                <h2 className="text-2xl font-black mt-2 text-slate-100">₹{data.cards.revenue}</h2>
                <p className="text-[9px] text-emerald-400 mt-1">Live updates active</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Today's Orders</span>
                  <Package size={16} className="text-amber-400" />
                </div>
                <h2 className="text-2xl font-black mt-2 text-slate-100">{data.cards.todayOrders}</h2>
                <p className="text-[9px] text-slate-500 mt-1">Includes active checkouts</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Avg Preparation Time</span>
                  <Clock size={16} className="text-yellow-400" />
                </div>
                <h2 className="text-2xl font-black mt-2 text-slate-100">~{data.cards.avgPrepTime}m</h2>
                <p className="text-[9px] text-rose-400 mt-1">AI Optimized target: 15m</p>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl backdrop-blur-md">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Peak Hour</span>
                  <Flame size={16} className="text-purple-400" />
                </div>
                <h2 className="text-md font-bold mt-3 text-slate-100 truncate">{data.cards.peakHours}</h2>
                <p className="text-[9px] text-slate-500 mt-1">High volume window</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid md:grid-cols-12 gap-6">
              {/* Sales Chart (7 days Area) */}
              <div className="md:col-span-8 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-200">Revenue Velocity</h3>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Weekly performance</span>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.weeklySales}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#FF6B6B" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart Popular Categories */}
              <div className="md:col-span-4 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <h3 className="font-bold text-sm text-slate-200">Popular Categories</h3>
                <div className="h-48 w-full flex justify-center items-center">
                  {data.charts.popularCategories.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.charts.popularCategories}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {data.charts.popularCategories.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500">No category sales recorded yet</p>
                  )}
                </div>
                
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
                  {data.charts.popularCategories.map((cat: any, index: number) => (
                    <div key={cat.name} className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="truncate">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row: Kitchen Performance & Activity Feed */}
            <div className="grid md:grid-cols-12 gap-6">
              {/* Bar Chart Kitchen Performance */}
              <div className="md:col-span-6 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <h3 className="font-bold text-sm text-slate-200">Kitchen Division Preparation Loads</h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.kitchenPerformance}>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px' }} />
                      <Bar dataKey="orders" fill="#FFB347" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="md:col-span-6 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                    <Activity size={15} className="text-rose-500 animate-pulse" />
                    <span>Live Audit Log</span>
                  </h3>
                  <span className="text-[8px] uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-black">Admin room active</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[220px] scrollbar-thin scrollbar-thumb-slate-800">
                  {data.activityFeed.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No recent store activities</p>
                  ) : (
                    data.activityFeed.map((act: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start gap-3 text-xs p-1">
                        <div className="flex gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                            act.type === 'success' ? 'bg-emerald-500' :
                            act.type === 'error' || act.type === 'danger' ? 'bg-red-500' :
                            act.type === 'warning' ? 'bg-amber-400 animate-pulse' : 'bg-indigo-400'
                          }`} />
                          <p className="text-slate-300 leading-relaxed">{act.message}</p>
                        </div>
                        <span className="text-[9px] text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
                          {new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* VIEW: INVENTORY */}
        {activeTab === 'inventory' && (
          <section className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-md text-slate-200">Raw Ingredient Store</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tracks Flour, Chocolate, Cream, Butter, Milk, Sugar, Eggs, Cheese</p>
              </div>

              <button
                onClick={handleRefillInventory}
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10"
              >
                Refill All Stocks (Standard)
              </button>
            </div>

            {/* Inventory Table */}
            <div className="overflow-x-auto bg-slate-950/40 border border-slate-850 rounded-2xl">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Ingredient</th>
                    <th className="p-4">Stock Level</th>
                    <th className="p-4">Alert Threshold</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Quick Restock</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => {
                    const isLow = item.quantity < item.minThreshold;
                    return (
                      <tr key={item._id} className="border-b border-slate-850 hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 font-semibold text-slate-200">{item.name}</td>
                        <td className="p-4 text-slate-350">{item.quantity}{item.unit}</td>
                        <td className="p-4 text-slate-500">{item.minThreshold}{item.unit}</td>
                        <td className="p-4">
                          {isLow ? (
                            <span className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase tracking-wide animate-pulse">Low Stock</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase tracking-wide">Healthy</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleUpdateStock(item._id, item.quantity + 2000)}
                              className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-[10px] text-slate-300"
                            >
                              +2 kg
                            </button>
                            <button
                              onClick={() => handleUpdateStock(item._id, Math.max(0, item.quantity - 1000))}
                              className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded text-[10px] text-slate-400"
                            >
                              -1 kg
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* VIEW: AI ENGINE */}
        {activeTab === 'ai' && (
          <section className="space-y-6">
            
            {/* AI Tomorrow Forecast Header */}
            <div className="bg-gradient-to-r from-rose-950/20 via-slate-900/60 to-amber-950/20 border border-rose-950/40 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles size={20} className="animate-pulse" />
                <h3 className="font-extrabold text-md uppercase tracking-wider">AI Forecast & Demand Engine</h3>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-850">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Predicted Orders (24h)</span>
                  <h4 className="text-3xl font-black mt-2 text-slate-100">{data.ai.tomorrowDemand.predictedOrders}</h4>
                  <p className="text-[9px] text-slate-400 mt-1">Based on weekly transaction cycles</p>
                </div>

                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-850">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Confidence Rating</span>
                  <h4 className="text-lg font-extrabold mt-3 text-slate-200">{data.ai.tomorrowDemand.confidence}</h4>
                  <p className="text-[9px] text-slate-400 mt-1">Standard deviation confidence score</p>
                </div>

                <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-850">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Weekend Surge multiplier</span>
                  <h4 className="text-xl font-black mt-2 text-rose-450">{data.ai.tomorrowDemand.demandFactor}</h4>
                  <p className="text-[9px] text-slate-400 mt-1">Reflects holiday cake shopping velocity</p>
                </div>
              </div>
            </div>

            {/* Runout forecast */}
            <div className="grid md:grid-cols-12 gap-6">
              
              {/* Inventory Forecast */}
              <div className="md:col-span-7 bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <h4 className="font-bold text-sm text-slate-200">AI Inventory Runout Forecast</h4>
                <p className="text-xs text-slate-400">Calculates average consumption velocity per order to estimate runout timelines.</p>

                <div className="space-y-3">
                  {data.ai.inventoryForecast.map((item: any) => (
                    <div key={item.name} className="flex justify-between items-center text-xs p-2 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <div>
                        <span className="font-semibold text-slate-250">{item.name}</span>
                        <span className="text-[9px] text-slate-500 block">Daily Usage: ~{item.dailyUsage}{item.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold block ${
                          item.status === 'Critical' ? 'text-red-400' :
                          item.status === 'Warning' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {item.daysRemaining} days remaining
                        </span>
                        <span className="text-[9px] text-slate-500">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Combos & Recommendations */}
              <div className="md:col-span-5 space-y-6">
                
                {/* AI Combos */}
                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
                  <h4 className="font-bold text-sm text-slate-200">AI Suggested Combos</h4>
                  <div className="space-y-3">
                    {data.ai.smartCombos.map((combo: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl space-y-1.5">
                        <h5 className="text-xs font-bold text-rose-400">{combo.name}</h5>
                        <p className="text-[10px] text-slate-400">{combo.items.join(' + ')}</p>
                        <p className="text-[9px] text-slate-500 italic">"{combo.reason}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Auto Recommendations */}
                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-md space-y-4">
                  <h4 className="font-bold text-sm text-slate-200">AI Auto Menu Booster</h4>
                  <p className="text-[11px] text-slate-400">Items matching target stock levels with highest customer velocity score:</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {data.ai.autoMenuRecommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="p-2 bg-slate-950/40 border border-slate-850 rounded-xl text-center">
                        <img src={rec.image} className="w-full h-12 object-cover rounded-lg bg-slate-800 mb-1.5" />
                        <h6 className="text-[10px] font-bold text-slate-350 truncate">{rec.name}</h6>
                        <span className="text-[9px] text-rose-455 font-bold">₹{rec.price}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </section>
        )}

      </main>
    </div>
  );
};
