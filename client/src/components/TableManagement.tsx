import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { SmartTable, TableStatus } from '../types';
import { tableApi, getSocket } from '../services/api';
import { 
  QrCode, Download, Printer, RefreshCw, Plus, Users, 
  Clock, DollarSign, CheckCircle2, AlertCircle, Eye, 
  Sparkles, Layers, ShieldCheck, Play, RotateCcw, Utensils,
  Wifi, Edit2, Check
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
  const STORAGE_KEY = 'cakeflow_qr_base_url';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoDetectedUrl, setAutoDetectedUrl] = useState<string>('');
  const [applyingIp, setApplyingIp] = useState<boolean>(false);

  const isLocalhost = (url: string) =>
    url.includes('localhost') || url.includes('127.0.0.1');

  // Get initial URL
  const getInitialUrl = (): string => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim() && !isLocalhost(saved)) return saved.trim();
    return window.location.origin;
  };

  const [networkBaseUrl, setNetworkBaseUrl] = useState<string>(getInitialUrl());
  const [editingNetworkUrl, setEditingNetworkUrl] = useState<boolean>(false);
  const [networkUrlInput, setNetworkUrlInput] = useState<string>(getInitialUrl());

  // Fetch real LAN IP from server
  const fetchAndApplyLanIp = async (tableList: SmartTable[]) => {
    try {
      const res = await fetch('/api/system/lan-ip');
      const data = await res.json();
      if (data.url && !isLocalhost(data.url)) {
        const lanUrl = data.url.replace(/\/$/, '');
        setAutoDetectedUrl(lanUrl);
        localStorage.setItem(STORAGE_KEY, lanUrl);
        setNetworkBaseUrl(lanUrl);
        setNetworkUrlInput(lanUrl);
        setEditingNetworkUrl(false);
        await regenerateAllQrCodes(tableList, lanUrl);
        return lanUrl;
      }
    } catch (e) {
      console.log('LAN IP auto-detect failed:', e);
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    const fallback = (saved && !isLocalhost(saved)) ? saved : null;
    if (fallback) {
      setAutoDetectedUrl(fallback);
      await regenerateAllQrCodes(tableList, fallback);
    }
    return fallback;
  };

  // Apply custom URL
  const applyNetworkUrl = async (url: string, tableList: SmartTable[]) => {
    const clean = url.replace(/\/$/, '');
    localStorage.setItem(STORAGE_KEY, clean);
    setNetworkBaseUrl(clean);
    setNetworkUrlInput(clean);
    setEditingNetworkUrl(false);
    await regenerateAllQrCodes(tableList, clean);
  };

  // Re-generate all QR codes
  const regenerateAllQrCodes = async (tableList: SmartTable[], baseUrl: string) => {
    const qrMap: Record<number, string> = {};
    for (const t of tableList) {
      let validUrl = baseUrl.trim();
      if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
        validUrl = `http://${validUrl}`;
      }
      const target = `${validUrl}/table/${t.tableNumber}`;
      try {
        const url = await QRCode.toDataURL(target, {
          width: 400,
          margin: 2,
          color: { dark: '#1E1818', light: '#ffffff' }
        });
        qrMap[t.tableNumber] = url;
      } catch (e) {
        qrMap[t.tableNumber] = t.qrCodeDataUrl || '';
      }
    }
    setQrCodeDataUrls(qrMap);
  };

  // Load all tables
  const fetchTables = async () => {
    try {
      setLoading(true);
      const data = await tableApi.getAll();
      setTables(data);
      await fetchAndApplyLanIp(data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();

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

  const handleRegenerateQr = async (tableNumber: number) => {
    try {
      const res = await tableApi.regenerateQr(tableNumber);
      if (res.table) {
        let validUrl = networkBaseUrl.trim();
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
          validUrl = `http://${validUrl}`;
        }
        const target = `${validUrl}/table/${tableNumber}`;
        const newUrl = await QRCode.toDataURL(target, { width: 400, margin: 2, color: { dark: '#1E1818', light: '#ffffff' } });
        setQrCodeDataUrls(prev => ({ ...prev, [tableNumber]: newUrl }));
        setTables(prev => prev.map(t => t.tableNumber === tableNumber ? res.table : t));
      }
    } catch (err) {
      console.error('QR Regeneration failed:', err);
    }
  };

  const handleDownloadQr = (table: SmartTable) => {
    const dataUrl = qrCodeDataUrls[table.tableNumber] || table.qrCodeDataUrl;
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `CakeFlow_Table_${table.tableNumber}_QR.png`;
    a.click();
  };

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
              background-color: #F7F5F2;
            }
            .qr-card {
              width: 320px;
              padding: 32px;
              background: #ffffff;
              border-radius: 24px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.08);
              text-align: center;
              border: 3px solid #CD0D0D;
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #CD0D0D;
              margin-bottom: 4px;
            }
            .sub {
              font-size: 12px;
              color: #6E6262;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            .table-badge {
              display: inline-block;
              background: #CD0D0D;
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
              border: 2px solid #D0C0C0;
              padding: 10px;
              margin-bottom: 20px;
            }
            .cta {
              font-size: 16px;
              font-weight: 700;
              color: #1E1818;
              margin-bottom: 4px;
            }
            .desc {
              font-size: 12px;
              color: #6E6262;
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

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'Available':
        return { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-500' };
      case 'Preparing':
      case 'Ordering':
      case 'Order Confirmed':
        return { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-500' };
      case 'Ready To Serve':
      case 'Serving':
        return { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', badge: 'bg-sky-500' };
      case 'Payment Pending':
        return { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', badge: 'bg-rose-500' };
      case 'Occupied':
        return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-500' };
      case 'Completed':
      case 'Cleaning':
      default:
        return { bg: 'bg-[#FAF8F8]', border: 'border-[#D0C0C0]', text: 'text-[#6E6262]', badge: 'bg-[#6E6262]' };
    }
  };

  const isStatusMatch = (status: TableStatus, filter: string) => {
    if (filter === 'all') return true;
    const s = (status || '').toLowerCase();
    const f = filter.toLowerCase();
    if (f === 'preparing') return ['preparing', 'ordering', 'order confirmed'].includes(s);
    if (f === 'ready to serve') return ['ready to serve', 'serving'].includes(s);
    if (f === 'cleaning') return ['cleaning', 'completed'].includes(s);
    return s.includes(f);
  };

  const filteredTables = tables.filter(t => isStatusMatch(t.status, statusFilter));

  return (
    <div className="space-y-6 text-[#1E1818]">

      {/* QR Phone Status Banner */}
      {(() => {
        const isPhoneReady = autoDetectedUrl && !isLocalhost(autoDetectedUrl);
        const isCurrentLan = networkBaseUrl && !isLocalhost(networkBaseUrl);
        const ready = isPhoneReady || isCurrentLan;
        const displayUrl = autoDetectedUrl || networkBaseUrl;

        return (
          <div className={`p-4 rounded-3xl border shadow-sm ${
            ready
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-rose-50 border-rose-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  ready ? 'bg-emerald-500 text-white' : 'bg-[#CD0D0D] text-white'
                }`}>
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-xs font-extrabold uppercase tracking-wider ${ready ? 'text-emerald-800' : 'text-[#CD0D0D]'}`}>
                    {ready ? '✅ Phone QR Ready' : '❌ QR Not Phone-Ready'}
                  </p>
                  <p className="text-[10px] text-[#6E6262]">
                    {ready ? 'Phone scan will open direct menu' : 'Phone scan -> copy text only'}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {editingNetworkUrl ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={networkUrlInput}
                      onChange={(e) => setNetworkUrlInput(e.target.value)}
                      placeholder="http://192.168.x.x:5173"
                      className="flex-1 min-w-[160px] bg-white border border-[#D0C0C0] rounded-xl px-3 py-2 text-xs text-[#1E1818] font-mono focus:outline-none focus:border-[#CD0D0D]"
                      onKeyDown={(e) => e.key === 'Enter' && applyNetworkUrl(networkUrlInput, tables)}
                    />
                    <button
                      onClick={() => applyNetworkUrl(networkUrlInput, tables)}
                      className="px-4 py-2 rounded-xl bg-[#CD0D0D] text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      onClick={() => setEditingNetworkUrl(false)}
                      className="px-3 py-2 rounded-xl bg-[#FAF8F8] border border-[#D0C0C0] text-[#6E6262] text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs px-3 py-1.5 rounded-xl border flex-1 truncate max-w-xs bg-white border-[#D0C0C0] text-[#1E1818]">
                      {ready ? `${displayUrl}/table/` : 'localhost'}
                      {ready && <span className="text-[#CD0D0D] font-bold">N</span>}
                    </span>
                    {ready && (
                      <button
                        onClick={() => { setNetworkUrlInput(networkBaseUrl); setEditingNetworkUrl(true); }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#D0C0C0] text-[#6E6262] text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-[#CD0D0D]" /> Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!ready && !editingNetworkUrl && (
                <button
                  onClick={async () => {
                    setApplyingIp(true);
                    await fetchAndApplyLanIp(tables);
                    setApplyingIp(false);
                  }}
                  disabled={applyingIp}
                  className="px-5 py-2.5 rounded-xl bg-[#CD0D0D] hover:bg-[#A60A0A] text-white text-xs font-extrabold flex items-center gap-2 whitespace-nowrap shadow-md cursor-pointer disabled:opacity-60"
                >
                  <Wifi className="w-4 h-4" />
                  {applyingIp ? 'Detecting...' : '🔧 Fix QR Now'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#D0C0C0] shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#CD0D0D]/10 text-[#CD0D0D]">
              <QrCode className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#1E1818] flex items-center gap-2">
                Smart Table & QR Code System
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
                  {tables.length} Tables Active
                </span>
              </h2>
              <p className="text-xs text-[#6E6262]">Automated QR Ordering, Live Status Floor Layout & Instant Socket.IO Sync</p>
            </div>
          </div>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[#FAF8F8] p-1 rounded-2xl border border-[#D0C0C0]">
            <button
              onClick={() => setActiveTab('floor')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'floor' 
                  ? 'bg-[#CD0D0D] text-white shadow-md' 
                  : 'text-[#6E6262] hover:text-[#1E1818]'
              }`}
            >
              <Layers className="w-4 h-4" />
              Interactive Floor
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'cards' 
                  ? 'bg-[#CD0D0D] text-white shadow-md' 
                  : 'text-[#6E6262] hover:text-[#1E1818]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Table Cards & QR
            </button>
          </div>

          <button
            onClick={() => setShowAddTableModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-[#CD0D0D] hover:bg-[#A60A0A] text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE RESTAURANT FLOOR PLAN */}
      {activeTab === 'floor' && (
        <div className="bg-white p-6 rounded-3xl border border-[#D0C0C0] shadow-sm relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-[#1E1818] flex items-center gap-2">
                Visual Restaurant Floor Map
                <span className="text-xs text-[#CD0D0D] font-mono bg-[#CD0D0D]/10 px-2 py-0.5 rounded-md border border-[#CD0D0D]/20">
                  LIVE SYNC
                </span>
              </h3>
              <p className="text-xs text-[#6E6262]">Click any dining table to view live order details, change status, or download QR Code</p>
            </div>
          </div>

          {/* 2D Floor Layout Grid */}
          <div className="min-h-[420px] bg-[#FAF8F8] rounded-2xl border border-[#D0C0C0] p-8 relative flex flex-col justify-between">
            <div className="absolute top-4 left-8 text-[10px] font-extrabold tracking-widest text-[#6E6262] uppercase flex items-center gap-2">
              <Utensils className="w-3.5 h-3.5 text-[#CD0D0D]" /> Main Kitchen & Counter Zone
            </div>
            <div className="absolute bottom-4 right-8 text-[10px] font-extrabold tracking-widest text-[#6E6262] uppercase">
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
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group relative hover:scale-[1.02] shadow-sm ${style.bg} ${style.border}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black tracking-wider text-[#1E1818] uppercase bg-white px-3 py-1 rounded-xl border border-[#D0C0C0] flex items-center gap-1.5 shadow-xs">
                        <span className={`w-2 h-2 rounded-full ${style.badge} animate-ping`} />
                        TABLE {table.tableNumber}
                      </span>
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.text} ${style.bg} ${style.border}`}>
                        {table.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[#1E1818]">
                        <span className="flex items-center gap-1 text-[#6E6262]">
                          <Users className="w-3.5 h-3.5" /> Capacity:
                        </span>
                        <span className="font-bold">{table.customerCount || table.capacity} Seats</span>
                      </div>

                      {table.currentOrderNumber && (
                        <div className="flex justify-between items-center text-[#1E1818]">
                          <span className="flex items-center gap-1 text-[#6E6262]">
                            <Clock className="w-3.5 h-3.5" /> Order:
                          </span>
                          <span className="font-mono font-bold text-[#CD0D0D]">{table.currentOrderNumber}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[#1E1818]">
                        <span className="flex items-center gap-1 text-[#6E6262]">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Current Bill:
                        </span>
                        <span className="font-black text-emerald-700">₹{table.currentBill || 0}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#D0C0C0]/60 flex items-center justify-between text-[11px] text-[#6E6262] group-hover:text-[#CD0D0D] transition-colors">
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
                className="bg-white p-5 rounded-3xl border border-[#D0C0C0] flex flex-col justify-between hover:border-[#CD0D0D] transition-all shadow-sm group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-black text-[#1E1818]">TABLE {table.tableNumber}</span>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.text} ${style.bg} ${style.border}`}>
                          {table.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#6E6262] font-mono">ID: {table.qrCodeId}</p>
                    </div>

                    {qrUrl ? (
                      <div 
                        onClick={() => setQrModalTable(table)}
                        className="w-16 h-16 bg-white p-1 rounded-xl shadow-sm cursor-pointer hover:scale-105 transition-transform flex items-center justify-center border border-[#D0C0C0]"
                        title="Click to view full printable QR card"
                      >
                        <img src={qrUrl} alt={`Table ${table.tableNumber} QR`} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-[#FAF8F8] rounded-xl flex items-center justify-center text-[#6E6262]">
                        <QrCode className="w-6 h-6 animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF8F8] p-3 rounded-2xl border border-[#D0C0C0] mb-4">
                    <div>
                      <span className="text-[#6E6262] text-[10px]">Active Order:</span>
                      <p className="font-bold text-[#1E1818]">{table.currentOrderNumber || 'None'}</p>
                    </div>
                    <div>
                      <span className="text-[#6E6262] text-[10px]">Guests:</span>
                      <p className="font-bold text-[#1E1818]">{table.customerCount || 2} People</p>
                    </div>
                    <div>
                      <span className="text-[#6E6262] text-[10px]">Current Bill:</span>
                      <p className="font-extrabold text-emerald-700">₹{table.currentBill || 0}</p>
                    </div>
                    <div>
                      <span className="text-[#6E6262] text-[10px]">Payment:</span>
                      <p className={`font-bold ${table.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-[#CD0D0D]'}`}>
                        {table.paymentStatus || 'Unpaid'}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-[10px] text-[#6E6262] font-bold block mb-1">Quick Status Override:</label>
                    <select
                      value={table.status}
                      onChange={(e) => handleUpdateStatus(table.tableNumber, e.target.value as TableStatus)}
                      className="w-full bg-[#FAF8F8] border border-[#D0C0C0] rounded-xl px-3 py-2 text-xs font-bold text-[#1E1818] focus:outline-none focus:border-[#CD0D0D] cursor-pointer"
                    >
                      <option value="Available">Available (Green)</option>
                      <option value="Ordering">Ordering (Yellow)</option>
                      <option value="Order Confirmed">Order Confirmed (Yellow)</option>
                      <option value="Preparing">Preparing (Yellow)</option>
                      <option value="Ready To Serve">Ready To Serve (Blue)</option>
                      <option value="Serving">Serving (Blue)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#E8E0E0] text-xs">
                  <button
                    onClick={() => setQrModalTable(table)}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F8] hover:bg-white border border-[#D0C0C0] text-[#1E1818] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#CD0D0D]" />
                    QR Card
                  </button>

                  <button
                    onClick={() => handleDownloadQr(table)}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F8] hover:bg-white border border-[#D0C0C0] text-[#1E1818] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    PNG
                  </button>

                  <button
                    onClick={() => handlePrintQr(table)}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F8] hover:bg-white border border-[#D0C0C0] text-[#1E1818] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-600" />
                    Print Standee
                  </button>

                  <button
                    onClick={() => handleRegenerateQr(table.tableNumber)}
                    className="px-3 py-2 rounded-xl bg-[#FAF8F8] hover:bg-white border border-[#D0C0C0] text-[#1E1818] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#CD0D0D]" />
                    Refresh
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD NEW TABLE */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#D0C0C0] w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl relative text-[#1E1818]">
            <button
              onClick={() => setShowAddTableModal(false)}
              className="absolute top-4 right-4 text-[#6E6262] hover:text-[#1E1818] p-1.5 rounded-full bg-[#FAF8F8] cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-lg font-extrabold text-[#1E1818] flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#CD0D0D]" /> Expand Dining Floor (Add Table)
            </h3>
            <p className="text-xs text-[#6E6262]">Configure new dining table and automatically generate dedicated QR code.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6E6262] font-bold block mb-1">Table Number:</label>
                <input
                  type="number"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] rounded-xl px-3 py-2 text-sm text-[#1E1818] focus:border-[#CD0D0D] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#6E6262] font-bold block mb-1">Seating Capacity:</label>
                <input
                  type="number"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 2)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] rounded-xl px-3 py-2 text-sm text-[#1E1818] focus:border-[#CD0D0D] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={handleAddNewTable}
                className="flex-1 py-3 rounded-2xl bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold text-xs transition-all shadow-md cursor-pointer"
              >
                Create Table & QR
              </button>
              <button
                onClick={() => setShowAddTableModal(false)}
                className="px-5 py-3 rounded-2xl bg-[#FAF8F8] text-[#6E6262] font-bold text-xs border border-[#D0C0C0] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: QR CODE STANDEE PREVIEW & DETAILS */}
      {(qrModalTable || selectedTable) && (() => {
        const table = qrModalTable || selectedTable!;
        const qrUrl = qrCodeDataUrls[table.tableNumber] || table.qrCodeDataUrl;
        const targetUrl = `${networkBaseUrl.replace(/\/$/, '')}/table/${table.tableNumber}`;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#D0C0C0] w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl relative animate-scale-in text-[#1E1818]">
              {/* Close Button */}
              <button
                onClick={() => {
                  setQrModalTable(null);
                  setSelectedTable(null);
                }}
                className="absolute top-4 right-4 text-[#6E6262] hover:text-[#1E1818] p-1.5 rounded-full bg-[#FAF8F8] cursor-pointer"
              >
                ✕
              </button>

              {/* QR Card Printable Standee Layout */}
              <div id={`qr-standee-card-${table.tableNumber}`} className="bg-[#FAF8F8] border border-[#D0C0C0] p-6 rounded-2xl text-center space-y-4 shadow-sm">
                <div className="space-y-1">
                  <span className="bg-[#CD0D0D] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    CakeFlow AI Smart Menu
                  </span>
                  <h3 className="text-xl font-black text-[#1E1818] tracking-tight pt-2">
                    TABLE {table.tableNumber}
                  </h3>
                  <p className="text-xs text-[#6E6262] font-semibold">Scan QR Code to View Menu & Place Order</p>
                </div>

                {/* Big QR Code Image */}
                <div className="w-52 h-52 mx-auto bg-white p-3 rounded-2xl border border-[#D0C0C0] shadow-md flex items-center justify-center">
                  {qrUrl ? (
                    <img 
                      src={qrUrl} 
                      alt={`Table ${table.tableNumber} QR Code`} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-[#6E6262] space-y-2">
                      <QrCode className="w-12 h-12 mx-auto text-[#CD0D0D] animate-pulse" />
                      <p className="text-xs font-bold">Generating QR Code...</p>
                    </div>
                  )}
                </div>

                <div className="space-y-1 pt-1">
                  <p className="text-[10px] text-[#6E6262] font-mono break-all bg-white px-2.5 py-1 rounded-xl border border-[#D0C0C0]">
                    {targetUrl}
                  </p>
                  <p className="text-[9px] text-[#6E6262] font-semibold">
                    No App Download Required • Instant Ordering
                  </p>
                </div>
              </div>

              {/* Download & Print Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDownloadQr(table)}
                  className="py-3 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={() => handlePrintQr(table)}
                  className="py-3 bg-white border border-[#D0C0C0] hover:border-[#CD0D0D] hover:bg-[#FAF8F8] text-[#1E1818] font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Printer size={15} className="text-[#CD0D0D]" />
                  <span>Print Standee</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
