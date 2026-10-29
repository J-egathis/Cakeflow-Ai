import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { SmartTable, TableStatus } from '../types';
import { tableApi, getSocket } from '../services/api';
import { 
  QrCode, Download, Printer, RefreshCw, Plus, Users, 
  Clock, DollarSign, CheckCircle2, AlertCircle, Eye, 
  Sparkles, Layers, ShieldCheck, Play, RotateCcw, Utensils,
  Wifi, Edit2, Check, Trash2
} from 'lucide-react';

interface TableManagementProps {
  onSelectTableForOrder?: (tableNumber: number) => void;
}

export const TableManagement: React.FC<TableManagementProps> = ({ onSelectTableForOrder }) => {
  const [tables, setTables] = useState<SmartTable[]>(() => {
    try {
      const cached = localStorage.getItem('cakeflow_tables_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(tables.length === 0);
  const [activeTab, setActiveTab] = useState<'floor' | 'cards'>('floor');
  const [selectedTable, setSelectedTable] = useState<SmartTable | null>(null);
  const [qrModalTable, setQrModalTable] = useState<SmartTable | null>(null);
  const [historyModalTable, setHistoryModalTable] = useState<SmartTable | null>(null);
  const [tableDetailsModal, setTableDetailsModal] = useState<SmartTable | null>(null);
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<number, string>>({});
  const [showAddTableModal, setShowAddTableModal] = useState<boolean>(false);
  const [newTableNum, setNewTableNum] = useState<number>(() => {
    return tables.length > 0 ? Math.max(...tables.map(t => Number(t.tableNumber) || 0), 0) + 1 : 8;
  });
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const STORAGE_KEY = 'cakeflow_qr_base_url';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTableNumbers, setSelectedTableNumbers] = useState<number[]>([]);
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

  // Generate QR code for a single table (fast, non-blocking)
  const generateSingleQrCode = async (tableNumber: number, baseUrl: string) => {
    let validUrl = baseUrl.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = `http://${validUrl}`;
    }
    const target = `${validUrl}/table/${tableNumber}`;
    try {
      const url = await QRCode.toDataURL(target, {
        width: 300,
        margin: 2,
        color: { dark: '#1F2937', light: '#ffffff' }
      });
      setQrCodeDataUrls(prev => ({ ...prev, [tableNumber]: url }));
    } catch (e) {}
  };

  // Re-generate all QR codes in parallel without blocking UI
  const regenerateAllQrCodes = async (tableList: SmartTable[], baseUrl: string) => {
    let validUrl = baseUrl.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = `http://${validUrl}`;
    }
    const entries = await Promise.all(
      tableList.map(async (t) => {
        const target = `${validUrl}/table/${t.tableNumber}`;
        try {
          const url = await QRCode.toDataURL(target, {
            width: 300,
            margin: 2,
            color: { dark: '#1F2937', light: '#ffffff' }
          });
          return [t.tableNumber, url] as const;
        } catch (e) {
          return [t.tableNumber, t.qrCodeDataUrl || ''] as const;
        }
      })
    );
    setQrCodeDataUrls(Object.fromEntries(entries));
  };

  // Load all tables
  const fetchTables = async () => {
    try {
      if (tables.length === 0) setLoading(true);
      const data = await tableApi.getAll();
      if (data && Array.isArray(data) && data.length > 0) {
        setTables(data);
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(data));
        setNewTableNum(Math.max(...data.map(t => Number(t.tableNumber) || 0), 0) + 1);
      }
      setLoading(false);
      // Run LAN IP + QR generation in background without blocking table cards display
      fetchAndApplyLanIp(data || []);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
      setLoading(false);
    }
  };

  // Silent load for auto-refresh without loading spinner
  const fetchTablesSilent = async () => {
    try {
      const data = await tableApi.getAll();
      if (data && Array.isArray(data) && data.length > 0) {
        setTables(data);
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Silent table refresh error:', err);
    }
  };

  useEffect(() => {
    fetchTables();

    const socket = getSocket();
    socket.emit('join_room', 'admins');

    const handleTableUpdate = (updatedTable: SmartTable) => {
      setTables(prev => {
        const index = prev.findIndex(t => t.tableNumber === updatedTable.tableNumber || (updatedTable._id && t._id === updatedTable._id));
        let updatedList: SmartTable[];
        if (index >= 0) {
          updatedList = [...prev];
          updatedList[index] = updatedTable;
        } else {
          updatedList = [...prev, updatedTable].sort((a, b) => a.tableNumber - b.tableNumber);
          generateSingleQrCode(updatedTable.tableNumber, networkBaseUrl);
        }
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(updatedList));
        setNewTableNum(Math.max(...updatedList.map(t => Number(t.tableNumber) || 0), 0) + 1);
        return updatedList;
      });
    };

    const handleTableDeleted = (data: { tableNumber: number }) => {
      setTables(prev => {
        const updatedList = prev.filter(t => t.tableNumber !== data.tableNumber);
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(updatedList));
        setNewTableNum(Math.max(...updatedList.map(t => Number(t.tableNumber) || 0), 0) + 1);
        return updatedList;
      });
      setQrCodeDataUrls(prev => {
        const next = { ...prev };
        delete next[data.tableNumber];
        return next;
      });
    };

    socket.on('table_status_updated', handleTableUpdate);
    socket.on('table_deleted', handleTableDeleted);

    // 4-second silent background auto-refresh interval for Table Management
    const intervalId = setInterval(fetchTablesSilent, 4000);

    return () => {
      clearInterval(intervalId);
      socket.off('table_status_updated', handleTableUpdate);
      socket.off('table_deleted', handleTableDeleted);
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
        const newUrl = await QRCode.toDataURL(target, { width: 400, margin: 2, color: { dark: '#1F2937', light: '#ffffff' } });
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
    a.download = `VPN_Table_${table.tableNumber}_QR.png`;
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
              background-color: #FFFFFF;
            }
            .qr-card {
              width: 320px;
              padding: 32px;
              background: #ffffff;
              border-radius: 24px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.08);
              text-align: center;
              border: 3px solid #4C1D95;
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              color: #4C1D95;
              margin-bottom: 4px;
            }
            .sub {
              font-size: 12px;
              color: #4B5563;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 24px;
            }
            .table-badge {
              display: inline-block;
              background: #4C1D95;
              color: #ffffff;
              padding: 6px 20px;
              border-radius: 999px;
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .capacity-badge {
              font-size: 13px;
              font-weight: 700;
              color: #1F2937;
              margin-bottom: 16px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              border-radius: 16px;
              border: 2px solid #FBBF24;
              padding: 10px;
              margin-bottom: 20px;
            }
            .cta {
              font-size: 16px;
              font-weight: 700;
              color: #1F2937;
              margin-bottom: 4px;
            }
            .desc {
              font-size: 12px;
              color: #4B5563;
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo" style="display:flex; align-items:center; gap:8px; justify-content:center;"><img src="/logo.png" style="width:24px; height:24px; border-radius:50%;" alt="logo" /> VPN Restaurant</div>
            <div class="sub">Smart Dining & Instant Order</div>
            <div class="table-badge">TABLE ${table.tableNumber}</div>
            <div class="capacity-badge">👥 Capacity: ${table.capacity || table.customerCount || 2} Members</div>
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
    const numToCreate = Number(newTableNum);
    const capToCreate = Number(newTableCapacity) || 4;
    if (!numToCreate || isNaN(numToCreate) || numToCreate < 1) {
      alert('Please enter a valid table number');
      return;
    }
    if (tables.some(t => Number(t.tableNumber) === numToCreate)) {
      alert(`Table ${numToCreate} already exists!`);
      return;
    }

    // 1. INSTANT 0ms OPTIMISTIC UI UPDATE
    const optimisticTable: SmartTable = {
      _id: `temp_${numToCreate}_${Date.now()}`,
      tableNumber: numToCreate,
      qrCodeId: `QR-TBL-0${numToCreate}`,
      securityToken: `TOKEN_TBL_${numToCreate}`,
      targetUrl: `${networkBaseUrl.replace(/\/$/, '')}/table/${numToCreate}`,
      qrCodeDataUrl: '',
      waiterAssigned: 'Unassigned',
      capacity: capToCreate,
      customerCount: capToCreate,
      status: 'Available',
      currentBill: 0,
      paymentStatus: 'Unpaid',
      orderProgress: 0
    };

    setShowAddTableModal(false);
    setNewTableNum(numToCreate + 1);
    setNewTableCapacity(4);

    setTables(prev => {
      const filtered = prev.filter(t => Number(t.tableNumber) !== numToCreate);
      const updatedList = [...filtered, optimisticTable].sort((a, b) => a.tableNumber - b.tableNumber);
      localStorage.setItem('cakeflow_tables_cache', JSON.stringify(updatedList));
      return updatedList;
    });
    generateSingleQrCode(numToCreate, networkBaseUrl);

    // 2. Background API sync
    try {
      const created = await tableApi.createTable({
        tableNumber: numToCreate,
        capacity: capToCreate,
        customerCount: capToCreate
      });
      setTables(prev => {
        const index = prev.findIndex(t => Number(t.tableNumber) === Number(created.tableNumber));
        let updatedList: SmartTable[];
        if (index >= 0) {
          updatedList = [...prev];
          updatedList[index] = created;
        } else {
          updatedList = [...prev, created].sort((a, b) => a.tableNumber - b.tableNumber);
        }
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(updatedList));
        return updatedList;
      });
    } catch (err: any) {
      // Rollback optimistic add if backend failed
      setTables(prev => {
        const rolledBack = prev.filter(t => Number(t.tableNumber) !== numToCreate);
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(rolledBack));
        return rolledBack;
      });
      alert(err.message || 'Failed to add table');
    }
  };

  const handleDeleteTable = async (tableNumber: number) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Table ${tableNumber}? This will permanently remove its QR code and card.`);
    if (!confirmDelete) return;

    // 1. INSTANT 0ms OPTIMISTIC UI REMOVAL
    const previousTables = [...tables];
    setTables(prev => {
      const updatedList = prev.filter(t => t.tableNumber !== tableNumber);
      localStorage.setItem('cakeflow_tables_cache', JSON.stringify(updatedList));
      setNewTableNum(Math.max(...updatedList.map(t => Number(t.tableNumber) || 0), 0) + 1);
      return updatedList;
    });
    if (selectedTable?.tableNumber === tableNumber) setSelectedTable(null);
    if (qrModalTable?.tableNumber === tableNumber) setQrModalTable(null);
    setSelectedTableNumbers(prev => prev.filter(n => n !== tableNumber));

    // 2. Background API delete
    try {
      await tableApi.deleteTable(tableNumber);
    } catch (err: any) {
      setTables(previousTables);
      localStorage.setItem('cakeflow_tables_cache', JSON.stringify(previousTables));
      alert(err.message || 'Failed to delete table');
    }
  };

  const toggleSelectTable = (tableNumber: number) => {
    setSelectedTableNumbers(prev =>
      prev.includes(tableNumber) ? prev.filter(n => n !== tableNumber) : [...prev, tableNumber]
    );
  };

  const toggleSelectAllTables = (tableList: SmartTable[]) => {
    const allNums = tableList.map(t => t.tableNumber);
    const allSelected = allNums.length > 0 && allNums.every(n => selectedTableNumbers.includes(n));
    if (allSelected) {
      setSelectedTableNumbers(prev => prev.filter(n => !allNums.includes(n)));
    } else {
      setSelectedTableNumbers(prev => Array.from(new Set([...prev, ...allNums])));
    }
  };

  const handleBulkDeleteTables = async () => {
    const count = selectedTableNumbers.length;
    if (count === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete these ${count} selected table(s)?`
    );
    if (!confirmDelete) return;

    const numsToDelete = [...selectedTableNumbers];
    const previousTables = [...tables];

    // 1. INSTANT 0ms OPTIMISTIC UI REMOVAL
    setTables(prev => {
      const updatedList = prev.filter(t => !numsToDelete.includes(t.tableNumber));
      localStorage.setItem('cakeflow_tables_cache', JSON.stringify(updatedList));
      setNewTableNum(Math.max(...updatedList.map(t => Number(t.tableNumber) || 0), 0) + 1);
      return updatedList;
    });
    setSelectedTableNumbers([]);
    if (selectedTable && numsToDelete.includes(selectedTable.tableNumber)) setSelectedTable(null);
    if (qrModalTable && numsToDelete.includes(qrModalTable.tableNumber)) setQrModalTable(null);

    // 2. Background API bulk delete (with fallback to individual deletes)
    try {
      await tableApi.bulkDeleteTables(numsToDelete);
    } catch (err) {
      try {
        await Promise.all(numsToDelete.map(num => tableApi.deleteTable(num)));
      } catch (fallbackErr: any) {
        setTables(previousTables);
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(previousTables));
        alert(fallbackErr.message || 'Failed to bulk delete tables');
      }
    }
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'Available':
          return { bg: 'bg-white', border: 'border-[#E5E7EB]', text: 'text-[#4B5563]', badge: 'bg-[#4B5563]' };
      case 'Preparing':
      case 'Ordering':
      case 'Order Confirmed':
        return { bg: 'bg-neutral-50', border: 'border-neutral-300', text: 'text-neutral-700', badge: 'bg-[#FBBF24]' };
      case 'Ready To Serve':
      case 'Serving':
        return { bg: 'bg-neutral-50', border: 'border-neutral-300', text: 'text-neutral-700', badge: 'bg-[#FBBF24]' };
      case 'Payment Pending':
        return { bg: 'bg-neutral-50', border: 'border-neutral-300', text: 'text-neutral-700', badge: 'bg-[#FBBF24]' };
      case 'Occupied':
        return { bg: 'bg-neutral-50', border: 'border-neutral-300', text: 'text-neutral-700', badge: 'bg-[#FBBF24]' };
      case 'Completed':
      case 'Cleaning':
      default:
        return { bg: 'bg-white', border: 'border-[#E5E7EB]', text: 'text-[#4B5563]', badge: 'bg-[#4B5563]' };
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
    <div className="space-y-4 sm:space-y-6 text-[#1F2937]">

      {/* QR Phone Status Banner (Hidden per user preference) */}
      {false && (() => {
        const isPhoneReady = autoDetectedUrl && !isLocalhost(autoDetectedUrl);
        const isCurrentLan = networkBaseUrl && !isLocalhost(networkBaseUrl);
        const ready = isPhoneReady || isCurrentLan;
        const displayUrl = autoDetectedUrl || networkBaseUrl;

        return (
          <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-sm ${
            ready
              ? 'bg-[#F3F4F6] border-[#E5E7EB]'
              : 'bg-neutral-50 border-neutral-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  ready ? 'bg-[#4C1D95] text-white' : 'bg-[#4C1D95] text-white'
                }`}>
                  <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-extrabold uppercase tracking-wider ${ready ? 'text-[#4C1D95]' : 'text-[#4C1D95]'}`}>
                    {ready ? '✅ Phone QR Ready' : '❌ QR Not Phone-Ready'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-[#4B5563]">
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
                      className="flex-1 min-w-[140px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1.5 sm:py-2 text-xs text-[#1F2937] font-mono focus:outline-none focus:border-[#4C1D95]"
                      onKeyDown={(e) => e.key === 'Enter' && applyNetworkUrl(networkUrlInput, tables)}
                    />
                    <button
                      onClick={() => applyNetworkUrl(networkUrlInput, tables)}
                      className="px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#4C1D95] text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      onClick={() => setEditingNetworkUrl(false)}
                      className="px-3 py-1.5 sm:py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#4B5563] text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs px-2.5 sm:px-3 py-1.5 rounded-xl border flex-1 truncate max-w-xs bg-white border-[#E5E7EB] text-[#1F2937]">
                      {ready ? `${displayUrl}/table/` : 'localhost'}
                      {ready && <span className="text-[#4C1D95] font-bold">N</span>}
                    </span>
                    {ready && (
                      <button
                        onClick={() => { setNetworkUrlInput(networkBaseUrl); setEditingNetworkUrl(true); }}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-[#4B5563] text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-[#4C1D95]" /> Edit
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
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold flex items-center justify-center gap-2 whitespace-nowrap shadow-md cursor-pointer disabled:opacity-60"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  {applyingIp ? 'Detecting...' : '🔧 Fix QR Now'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#E5E7EB] shadow-sm">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0 flex items-center justify-center">
              <QrCode size={24} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-[#1F2937] flex items-center flex-wrap gap-1.5 sm:gap-2">
                <span>Smart Table & QR Code System</span>
                <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-full bg-[#4C1D95]/10 text-neutral-700 border border-[#4C1D95]/30">
                  {tables.length} Tables Active
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[#4B5563] leading-tight">Automated QR Ordering, Live Status Floor Layout & Instant Sync</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full xl:w-auto">
          <button
            onClick={() => setShowAddTableModal(true)}
            className="w-full sm:w-auto px-4 py-2 sm:py-2.5 rounded-2xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE RESTAURANT FLOOR PLAN */}
      {activeTab === 'floor' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#E5E7EB] shadow-sm relative overflow-hidden space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
                <span>Visual Restaurant Floor Map</span>
                <span className="text-[10px] sm:text-xs text-[#4C1D95] font-mono bg-[#4C1D95]/10 px-2 py-0.5 rounded-md border border-[#4C1D95]/20">
                  LIVE SYNC
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-[#4B5563]">Live dining table status, capacity, and current bill overview</p>
            </div>

            {/* Bulk Selection Controls */}
            {filteredTables.length > 0 && (
              <div className="flex items-center flex-wrap gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-[#F9FAFB] hover:bg-violet-50 border border-[#E5E7EB] text-xs font-extrabold text-[#1F2937] flex items-center gap-2 cursor-pointer select-none shadow-2xs transition-colors">
                  <input
                    type="checkbox"
                    checked={filteredTables.length > 0 && filteredTables.every(t => selectedTableNumbers.includes(t.tableNumber))}
                    onChange={() => toggleSelectAllTables(filteredTables)}
                    className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
                  />
                  <span>
                    {filteredTables.every(t => selectedTableNumbers.includes(t.tableNumber))
                      ? 'Deselect All'
                      : `Select All (${filteredTables.length})`}
                  </span>
                </label>

                {selectedTableNumbers.length > 0 && (
                  <>
                    <button
                      onClick={handleBulkDeleteTables}
                      className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedTableNumbers.length})</span>
                    </button>
                    <button
                      onClick={() => setSelectedTableNumbers([])}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-[#4B5563] border border-[#E5E7EB] text-xs font-bold transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2D Floor Layout Grid */}
          <div className="min-h-[340px] sm:min-h-[420px] bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-8 relative flex flex-col justify-between">
            <div className="text-[10px] font-extrabold tracking-widest text-[#4B5563] uppercase flex items-center gap-1.5 mb-3 sm:mb-0">
              <Utensils className="w-3.5 h-3.5 text-[#4C1D95]" /> Main Kitchen & Counter Zone
            </div>

            {/* Tables Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-6 my-auto py-3 sm:pt-6">
              {filteredTables.map((table) => {
                const style = getStatusColor(table.status);
                const isSelected = selectedTableNumbers.includes(table.tableNumber);
                return (
                  <div
                    key={table.tableNumber}
                    onClick={() => toggleSelectTable(table.tableNumber)}
                    className={`p-3.5 sm:p-5 rounded-2xl border transition-all group relative shadow-sm cursor-pointer ${
                      isSelected
                        ? 'bg-violet-50/50 border-[#4C1D95] ring-2 ring-[#4C1D95]/20'
                        : `${style.bg} ${style.border}`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectTable(table.tableNumber)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
                          title={`Select Table ${table.tableNumber}`}
                        />
                        <span className="text-xs font-black tracking-wider text-[#1F2937] uppercase bg-white px-2.5 sm:px-3 py-1 rounded-xl border border-[#E5E7EB] flex items-center gap-1.5 shadow-xs">
                          <span className={`w-2 h-2 rounded-full ${style.badge} animate-ping`} />
                          TABLE {table.tableNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] sm:text-[11px] font-extrabold px-2 sm:px-2.5 py-0.5 rounded-full border ${style.text} ${style.bg} ${style.border}`}>
                          {table.status}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTable(table.tableNumber);
                          }}
                          title={`Delete Table ${table.tableNumber}`}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[#1F2937]">
                        <span className="flex items-center gap-1 text-[#4B5563] text-[11px] sm:text-xs">
                          <Users className="w-3.5 h-3.5" /> Capacity:
                        </span>
                        <span className="font-bold text-[11px] sm:text-xs">{table.capacity || table.customerCount || 4} Members</span>
                      </div>

                      {table.currentOrderNumber && (
                        <div className="flex justify-between items-center text-[#1F2937]">
                          <span className="flex items-center gap-1 text-[#4B5563] text-[11px] sm:text-xs">
                            <Clock className="w-3.5 h-3.5" /> Order:
                          </span>
                          <span className="font-mono font-bold text-[#4C1D95] text-[11px] sm:text-xs">{table.currentOrderNumber}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[#1F2937]">
                        <span className="flex items-center gap-1 text-[#4B5563] text-[11px] sm:text-xs">
                          <DollarSign className="w-3.5 h-3.5 text-[#4C1D95]" /> Current Bill:
                        </span>
                        <span className="font-black text-neutral-700 text-[11px] sm:text-xs">₹{table.currentBill || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[10px] font-extrabold tracking-widest text-[#4B5563] uppercase text-right mt-2 sm:mt-0">
              🚪 Main Entrance
            </div>
          </div>
        </div>
      )}

      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-[#E5E7EB] w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 space-y-3.5 sm:space-y-4 shadow-2xl relative text-[#1F2937]">
            <button
              onClick={() => setShowAddTableModal(false)}
              className="absolute top-3.5 sm:top-4 right-3.5 sm:right-4 text-[#4B5563] hover:text-[#1F2937] p-1.5 rounded-full bg-white cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-base sm:text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#4C1D95]" /> Expand Dining Floor (Add Table)
            </h3>
            <p className="text-xs text-[#4B5563]">Configure new dining table and automatically generate dedicated QR code.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#4B5563] font-bold block mb-1">Table Number:</label>
                <input
                  type="number"
                  min="1"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:border-[#4C1D95] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#4B5563] font-bold block mb-1">Guest / Member Capacity:</label>
                <input
                  type="number"
                  min="1"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 1)}
                  placeholder="e.g. 10"
                  className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1F2937] focus:border-[#4C1D95] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5 sm:gap-3 pt-2 sm:pt-3">
              <button
                onClick={handleAddNewTable}
                className="flex-1 py-2.5 sm:py-3 rounded-2xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs transition-all shadow-md cursor-pointer"
              >
                Create Table & QR
              </button>
              <button
                onClick={() => setShowAddTableModal(false)}
                className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-white text-[#4B5563] font-bold text-xs border border-[#E5E7EB] cursor-pointer"
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white border border-[#E5E7EB] w-full max-w-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative animate-scale-in text-[#1F2937] my-auto">
              {/* Close Button */}
              <button
                onClick={() => {
                  setQrModalTable(null);
                  setSelectedTable(null);
                }}
                className="absolute top-3 sm:top-4 right-3 sm:right-4 text-[#4B5563] hover:text-[#1F2937] p-1.5 rounded-full bg-white cursor-pointer z-10"
              >
                ✕
              </button>

              {/* QR Card Printable Standee Layout */}
              <div id={`qr-standee-card-${table.tableNumber}`} className="bg-white border border-[#E5E7EB] p-4 sm:p-6 rounded-xl sm:rounded-2xl text-center space-y-3 sm:space-y-4 shadow-sm">
                <div className="space-y-1.5 sm:space-y-2">
                  <span className="bg-[#4C1D95] text-white text-[9px] sm:text-[10px] font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider">
                    VPN Restaurant Smart Menu
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-[#1F2937] tracking-tight pt-0.5">
                    TABLE {table.tableNumber}
                  </h3>
                  <div className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-white border border-[#E5E7EB] rounded-full text-[11px] sm:text-xs font-extrabold text-[#1F2937]">
                    <Users className="w-3.5 h-3.5 text-[#4C1D95]" />
                    <span>Capacity: {table.capacity || table.customerCount || 2} Members</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#4B5563] font-semibold">Scan QR Code to View Menu & Place Order</p>
                </div>

                {/* Big QR Code Image */}
                <div className="w-44 h-44 sm:w-52 sm:h-52 mx-auto bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E5E7EB] shadow-md flex items-center justify-center">
                  {qrUrl ? (
                    <img 
                      src={qrUrl} 
                      alt={`Table ${table.tableNumber} QR Code`} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-[#4B5563] space-y-2">
                      <QrCode className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#4C1D95] animate-pulse" />
                      <p className="text-xs font-bold">Generating QR Code...</p>
                    </div>
                  )}
                </div>

                <div className="space-y-1 pt-0.5">
                  <p className="text-[9px] sm:text-[10px] text-[#4B5563] font-mono break-all bg-white px-2 sm:px-2.5 py-1 rounded-xl border border-[#E5E7EB]">
                    {targetUrl}
                  </p>
                  <p className="text-[9px] text-[#4B5563] font-semibold">
                    No App Download Required • Instant Ordering
                  </p>
                </div>
              </div>

              {/* Download & Print Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDownloadQr(table)}
                  className="py-2.5 sm:py-3 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-xl sm:rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={() => handlePrintQr(table)}
                  className="py-2.5 sm:py-3 bg-white border border-[#E5E7EB] hover:border-[#4C1D95] hover:bg-white text-[#1F2937] font-extrabold rounded-xl sm:rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Printer size={14} className="text-[#4C1D95]" />
                  <span>Print Standee</span>
                </button>
              </div>

              <button
                onClick={() => handleDeleteTable(table.tableNumber)}
                className="w-full py-2 sm:py-2.5 bg-neutral-50 hover:bg-neutral-600 text-neutral-600 hover:text-white border border-neutral-200 font-extrabold rounded-xl sm:rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete Table {table.tableNumber}</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};


