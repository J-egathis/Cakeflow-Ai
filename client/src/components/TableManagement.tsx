import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { SmartTable, TableStatus } from '../types';
import { tableApi, getSocket } from '../services/api';
import { 
  QrCode, Download, Printer, RefreshCw, Plus, Users, 
  Clock, DollarSign, CheckCircle2, AlertCircle, Eye, 
  Sparkles, Layers, ShieldCheck, Play, RotateCcw, Utensils
} from 'lucide-react';

interface TableManagementProps {
  onSelectTableForOrder?: (tableNumber: number) => void;
}

export const TableManagement: React.FC<TableManagementProps> = ({ onSelectTableForOrder }) => {
  const [tables, setTables] = useState<SmartTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'floor' | 'cards'>('floor');
  const [selectedTable, setSelectedTable] = useState<SmartTable | null>(null);
  const [qrModalTable, setQrModalTable] = useState<SmartTable | null>(null);
  const [historyModalTable, setHistoryModalTable] = useState<SmartTable | null>(null);
  const [tableDetailsModal, setTableDetailsModal] = useState<SmartTable | null>(null);
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<number, string>>({});
  const [showAddTableModal, setShowAddTableModal] = useState<boolean>(false);
  const [newTableNum, setNewTableNum] = useState<number>(7);
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load all tables
  const fetchTables = async () => {
    try {
      setLoading(true);
      const data = await tableApi.getAll();
      setTables(data);
      
      // Generate frontend high-res QR codes for each table
      const qrMap: Record<number, string> = {};
      for (const t of data) {
        const target = t.targetUrl || `${window.location.origin}/table/${t.tableNumber}`;
        try {
          const url = await QRCode.toDataURL(target, {
            width: 400,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
          qrMap[t.tableNumber] = url;
        } catch (e) {
          qrMap[t.tableNumber] = t.qrCodeDataUrl || '';
        }
      }
      setQrCodeDataUrls(qrMap);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();

    // Listen for real-time table status updates via Socket.IO
    const socket = getSocket();
    socket.emit('join_room', 'admins');

    const handleTableUpdate = (updatedTable: SmartTable) => {
      setTables(prev => {
        const index = prev.findIndex(t => t.tableNumber === updatedTable.tableNumber);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = updatedTable;
          return newArr;
        }
        return [...prev, updatedTable].sort((a, b) => a.tableNumber - b.tableNumber);
      });
    };

    socket.on('table_status_updated', handleTableUpdate);

    return () => {
      socket.off('table_status_updated', handleTableUpdate);
    };
  }, []);

  // Update table status
  const handleUpdateStatus = async (tableNumber: number, newStatus: TableStatus) => {
    try {
      const updated = await tableApi.updateStatus(tableNumber, { status: newStatus });
      setTables(prev => prev.map(t => t.tableNumber === tableNumber ? updated : t));
      if (selectedTable?.tableNumber === tableNumber) {
        setSelectedTable(updated);
      }
      if (tableDetailsModal?.tableNumber === tableNumber) {
        setTableDetailsModal(updated);
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Regenerate QR Code
  const handleRegenerateQr = async (tableNumber: number) => {
    try {
      const res = await tableApi.regenerateQr(tableNumber);
      if (res.table) {
        const target = res.table.targetUrl || `${window.location.origin}/table/${tableNumber}`;
        const newUrl = await QRCode.toDataURL(target, { width: 400, margin: 2 });
        setQrCodeDataUrls(prev => ({ ...prev, [tableNumber]: newUrl }));
        setTables(prev => prev.map(t => t.tableNumber === tableNumber ? res.table : t));
      }
    } catch (err) {
      console.error('QR Regeneration failed:', err);
    }
  };

  // Download QR Code PNG
  const handleDownloadQr = (table: SmartTable) => {
    const dataUrl = qrCodeDataUrls[table.tableNumber] || table.qrCodeDataUrl;
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `CakeFlow_Table_${table.tableNumber}_QR.png`;
    a.click();
  };

  // Print QR Code Card Layout
  const handlePrintQr = (table: SmartTable) => {
    const dataUrl = qrCodeDataUrls[table.tableNumber] || table.qrCodeDataUrl;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Table ${table.tableNumber} - QR Code Standee</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #f8fafc;
            }
            .qr-card {
              width: 320px;
              padding: 32px;
              background: #ffffff;
              border-radius: 24px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              border: 3px solid #0f172a;
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #f43f5e;
              margin-bottom: 4px;
            }
            .sub {
              font-size: 12px;
              color: #64748b;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            .table-badge {
              display: inline-block;
              background: #0f172a;
              color: #ffffff;
              padding: 6px 20px;
              border-radius: 999px;
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 20px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              border-radius: 16px;
              border: 2px solid #e2e8f0;
              padding: 10px;
              margin-bottom: 20px;
            }
            .cta {
              font-size: 16px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 4px;
            }
            .desc {
              font-size: 12px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo">🍰 CakeFlow AI</div>
            <div class="sub">Smart Dining & Instant Order</div>
            <div class="table-badge">TABLE ${table.tableNumber}</div>
            <br/>
            <img src="${dataUrl}" class="qr-img" alt="QR Code" />
            <div class="cta">SCAN TO ORDER</div>
            <div class="desc">Point your camera to view menu & place instant order</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Add new table (Scalability to N tables)
  const handleAddNewTable = async () => {
    try {
      const created = await tableApi.createTable({
        tableNumber: newTableNum,
        capacity: newTableCapacity
      });
      setTables(prev => [...prev, created].sort((a, b) => a.tableNumber - b.tableNumber));
      setShowAddTableModal(false);
      setNewTableNum(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to add table');
    }
  };

  // Status Color Helper
  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'Available':
        return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500', hex: '#10b981' };
      case 'Preparing':
      case 'Ordering':
      case 'Order Confirmed':
        return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500', hex: '#f59e0b' };
      case 'Ready To Serve':
      case 'Serving':
        return { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400', badge: 'bg-sky-500', hex: '#0ea5e9' };
      case 'Payment Pending':
        return { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', badge: 'bg-rose-500', hex: '#f43f5e' };
      case 'Occupied':
        return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500', hex: '#ef4444' };
      case 'Completed':
      case 'Cleaning':
      default:
        return { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', badge: 'bg-slate-500', hex: '#64748b' };
    }
  };

  const filteredTables = statusFilter === 'all' 
    ? tables 
    : tables.filter(t => t.status.toLowerCase().includes(statusFilter.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400">
              <QrCode className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Smart Table & QR Code System
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tables.length} Tables Configured
                </span>
              </h2>
              <p className="text-xs text-slate-400">Automated QR Ordering, Live Status Floor Layout & Instant Socket.IO Sync</p>
            </div>
          </div>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('floor')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'floor' 
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              Interactive Floor
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'cards' 
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Table Cards & QR
            </button>
          </div>

          <button
            onClick={() => setShowAddTableModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            Add Table
          </button>
        </div>
      </div>

      {/* Quick Status Legend & Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Available', color: 'emerald', count: tables.filter(t => t.status === 'Available').length },
          { label: 'Preparing', color: 'amber', count: tables.filter(t => ['Preparing', 'Ordering', 'Order Confirmed'].includes(t.status)).length },
          { label: 'Ready To Serve', color: 'sky', count: tables.filter(t => ['Ready To Serve', 'Serving'].includes(t.status)).length },
          { label: 'Payment Pending', color: 'rose', count: tables.filter(t => t.status === 'Payment Pending').length },
          { label: 'Occupied', color: 'red', count: tables.filter(t => t.status === 'Occupied').length },
          { label: 'Cleaning', color: 'slate', count: tables.filter(t => ['Cleaning', 'Completed'].includes(t.status)).length },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => setStatusFilter(statusFilter === item.label ? 'all' : item.label)}
            className={`p-3 rounded-2xl border backdrop-blur-md transition-all text-left flex items-center justify-between ${
              statusFilter === item.label
                ? 'bg-slate-800 border-slate-600 ring-2 ring-rose-500/50'
                : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(item.label as any).badge} animate-pulse`} />
              <span className="text-xs font-medium text-slate-300">{item.label}</span>
            </div>
            <span className="text-xs font-bold text-slate-100 bg-slate-950 px-2 py-0.5 rounded-full">
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* VIEW 1: INTERACTIVE RESTAURANT FLOOR PLAN */}
      {activeTab === 'floor' && (
        <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Visual Restaurant Floor Map
                <span className="text-xs text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  LIVE SOCKET.IO SYNC
                </span>
              </h3>
              <p className="text-xs text-slate-400">Click any dining table to view live order details, change status, or download QR Code</p>
            </div>
          </div>

          {/* 2D Floor Layout Grid */}
          <div className="min-h-[420px] bg-slate-950/80 rounded-2xl border border-slate-850 p-8 relative flex flex-col justify-between">
            {/* Restaurant Structural Elements */}
            <div className="absolute top-4 left-8 text-[10px] font-bold tracking-widest text-slate-600 uppercase flex items-center gap-2">
              <Utensils className="w-3.5 h-3.5" /> Main Kitchen & Counter Zone
            </div>
            <div className="absolute bottom-4 right-8 text-[10px] font-bold tracking-widest text-slate-600 uppercase">
              🚪 Main Entrance
            </div>

            {/* Tables Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 my-auto pt-6">
              {filteredTables.map((table) => {
                const style = getStatusColor(table.status);
                return (
                  <div
                    key={table.tableNumber}
                    onClick={() => setSelectedTable(table)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group relative hover:scale-[1.02] shadow-xl ${style.bg} ${style.border}`}
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black tracking-wider text-slate-200 uppercase bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-800 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${style.badge} animate-ping`} />
                        TABLE {table.tableNumber}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${style.text} ${style.bg} ${style.border}`}>
                        {table.status}
                      </span>
                    </div>

                    {/* Table Details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Users className="w-3.5 h-3.5" /> Capacity:
                        </span>
                        <span className="font-semibold">{table.customerCount || table.capacity} Seats</span>
                      </div>

                      {table.currentOrderNumber && (
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3.5 h-3.5" /> Order:
                          </span>
                          <span className="font-mono font-bold text-amber-400">{table.currentOrderNumber}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1 text-slate-400">
                          <DollarSign className="w-3.5 h-3.5" /> Current Bill:
                        </span>
                        <span className="font-bold text-emerald-400">₹{table.currentBill || 0}</span>
                      </div>

                      {/* Progress bar if active */}
                      {table.orderProgress > 0 && table.orderProgress < 100 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Order Progress</span>
                            <span>{table.orderProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${style.badge} transition-all duration-500`}
                              style={{ width: `${table.orderProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hover Hint */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-rose-400 transition-colors">
                      <span className="flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> Scan URL: /table/{table.tableNumber}
                      </span>
                      <Eye className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SMART TABLE CARDS LIST */}
      {activeTab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTables.map((table) => {
            const style = getStatusColor(table.status);
            const qrUrl = qrCodeDataUrls[table.tableNumber] || table.qrCodeDataUrl;

            return (
              <div 
                key={table.tableNumber}
                className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/80 backdrop-blur-md flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-xl group"
              >
                <div>
                  {/* Card Top: Table # and QR thumbnail */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-black text-slate-100">TABLE {table.tableNumber}</span>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.text} ${style.bg} ${style.border}`}>
                          {table.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">ID: {table.qrCodeId}</p>
                    </div>

                    {/* QR Code Thumbnail */}
                    {qrUrl ? (
                      <div 
                        onClick={() => setQrModalTable(table)}
                        className="w-16 h-16 bg-white p-1 rounded-xl shadow-md cursor-pointer hover:scale-105 transition-transform flex items-center justify-center border border-slate-700"
                        title="Click to view full printable QR card"
                      >
                        <img src={qrUrl} alt={`Table ${table.tableNumber} QR`} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-slate-950 rounded-xl flex items-center justify-center text-slate-600">
                        <QrCode className="w-6 h-6 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Table Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-2xl border border-slate-850/80 mb-4">
                    <div>
                      <span className="text-slate-400 text-[10px]">Active Order:</span>
                      <p className="font-bold text-slate-200">{table.currentOrderNumber || 'None'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Guests:</span>
                      <p className="font-bold text-slate-200">{table.customerCount || 2} People</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Current Bill:</span>
                      <p className="font-bold text-emerald-400">₹{table.currentBill || 0}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Payment:</span>
                      <p className={`font-bold ${table.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {table.paymentStatus || 'Unpaid'}
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="mb-4">
                    <label className="text-[10px] text-slate-400 font-medium block mb-1">Quick Status Override:</label>
                    <select
                      value={table.status}
                      onChange={(e) => handleUpdateStatus(table.tableNumber, e.target.value as TableStatus)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      <option value="Available">Available (Green)</option>
                      <option value="Occupied">Occupied (Red)</option>
                      <option value="Ordering">Ordering (Yellow)</option>
                      <option value="Order Confirmed">Order Confirmed (Yellow)</option>
                      <option value="Preparing">Preparing (Yellow)</option>
                      <option value="Ready To Serve">Ready To Serve (Blue)</option>
                      <option value="Serving">Serving (Blue)</option>
                      <option value="Payment Pending">Payment Pending (Orange)</option>
                      <option value="Completed">Completed (Grey)</option>
                      <option value="Cleaning">Cleaning (Grey)</option>
                    </select>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/60 text-xs">
                  <button
                    onClick={() => setQrModalTable(table)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-rose-400" />
                    QR Card
                  </button>

                  <button
                    onClick={() => handleDownloadQr(table)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    PNG
                  </button>

                  <button
                    onClick={() => handlePrintQr(table)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-400" />
                    Print Standee
                  </button>

                  <button
                    onClick={() => handleRegenerateQr(table.tableNumber)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors flex items-center justify-center gap-1.5"
                    title="Generate fresh security token"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    Refresh
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: FULL TABLE DETAILS & LIVE ORDER MODAL */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setSelectedTable(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-full bg-slate-800/80"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-black text-xl">
                T{selectedTable.tableNumber}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Table {selectedTable.tableNumber} Details</h3>
                <p className="text-xs text-slate-400 font-mono">QR ID: {selectedTable.qrCodeId}</p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-850 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-bold text-emerald-400">{selectedTable.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Target URL:</span>
                <span className="font-mono text-rose-400">{selectedTable.targetUrl}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Active Order #:</span>
                <span className="font-bold text-amber-400">{selectedTable.currentOrderNumber || 'No active order'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Bill Amount:</span>
                <span className="font-bold text-emerald-400">₹{selectedTable.currentBill || 0}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Payment Status:</span>
                <span className="font-bold text-slate-200">{selectedTable.paymentStatus}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedTable(null);
                  handlePrintQr(selectedTable);
                }}
                className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25"
              >
                <Printer className="w-4 h-4" /> Print QR Standee
              </button>
              <button
                onClick={() => setSelectedTable(null)}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE QR CODE STANDEE PREVIEW */}
      {qrModalTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setQrModalTable(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-full bg-slate-800/80"
            >
              ✕
            </button>

            {/* QR Standee Card Mockup */}
            <div className="bg-white p-6 rounded-2xl text-slate-900 shadow-xl border-2 border-slate-900 mx-auto max-w-[280px]">
              <div className="text-xl font-extrabold text-rose-500 mb-0.5">🍰 CakeFlow AI</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Smart Dining</div>
              <div className="inline-block bg-slate-950 text-white font-black px-4 py-1 rounded-full text-xs mb-3">
                TABLE {qrModalTable.tableNumber}
              </div>

              {qrCodeDataUrls[qrModalTable.tableNumber] && (
                <img 
                  src={qrCodeDataUrls[qrModalTable.tableNumber]} 
                  alt="QR Code" 
                  className="w-48 h-48 mx-auto border border-slate-300 p-2 rounded-xl mb-3"
                />
              )}

              <div className="font-extrabold text-sm text-slate-900">SCAN TO ORDER</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Point camera to open instant menu</div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleDownloadQr(qrModalTable)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download PNG
              </button>
              <button
                onClick={() => handlePrintQr(qrModalTable)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW TABLE (Scalability to N Tables) */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowAddTableModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-full bg-slate-800/80"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" /> Expand Dining Floor (Add Table)
            </h3>
            <p className="text-xs text-slate-400">Configure new dining table and automatically generate dedicated QR code.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Table Number:</label>
                <input
                  type="number"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Seating Capacity:</label>
                <input
                  type="number"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 2)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={handleAddNewTable}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-500/25"
              >
                Create Table & QR
              </button>
              <button
                onClick={() => setShowAddTableModal(false)}
                className="px-5 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
