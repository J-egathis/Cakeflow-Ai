import React, { useState, useEffect, useMemo } from 'react';
import { Product, Order } from '../types';
import { categoryApi, orderApi, getSocket } from '../services/api';
import {
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Trash2,
  Receipt,
  ChefHat,
  TrendingUp,
  PackageCheck,
  Flame,
  Plus,
  Send,
  Calendar,
  Filter
} from 'lucide-react';

interface SoldUnsoldTrackerProps {
  products: Product[];
  orders: Order[];
  onRefresh: () => void;
}

export interface UnsoldReportItem {
  id: string;
  productId?: string | number | null;
  name?: string;
  foodName?: string;
  category?: string;
  mealType?: string;
  price?: number;
  unsoldQty: number;
  reportedBy?: string;
  note?: string;
  reportedAt?: string;
  createdAt?: string;
}

export const SoldUnsoldTracker: React.FC<SoldUnsoldTrackerProps> = ({
  products,
  orders,
  onRefresh,
}) => {
  const [activeSubTab, setActiveSubTabState] = useState<'sold' | 'unsold' | 'all'>(() => {
    const saved = localStorage.getItem('admin_sold_unsold_subtab');
    if (saved === 'sold' || saved === 'unsold' || saved === 'all') return saved;
    return 'all';
  });
  const setActiveSubTab = (tab: 'sold' | 'unsold' | 'all') => {
    setActiveSubTabState(tab);
    localStorage.setItem('admin_sold_unsold_subtab', tab);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'lastmonth' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [unsoldReports, setUnsoldReports] = useState<UnsoldReportItem[]>([]);
  const [liveOrders, setLiveOrders] = useState<Order[]>(orders || []);
  const [loadingUnsold, setLoadingUnsold] = useState(false);

  // Optional quick-add unsold form for Admin if Admin also wants to log unsold food
  const [showAdminReportModal, setShowAdminReportModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodPrice, setCustomFoodPrice] = useState('');
  const [isCustomFood, setIsCustomFood] = useState(false);
  const [unsoldQtyInput, setUnsoldQtyInput] = useState('20');
  const [unsoldNoteInput, setUnsoldNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUnsoldReports = async () => {
    setLoadingUnsold(true);
    try {
      const [res, freshOrders] = await Promise.all([
        categoryApi.getUnsoldReports().catch(() => []),
        orderApi.getAll().catch(() => []),
      ]);
      const itemsList = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.items)
        ? (res as any).items
        : [];
      setUnsoldReports(itemsList);
      if (Array.isArray(freshOrders) && freshOrders.length > 0) {
        setLiveOrders(freshOrders);
      }
    } catch (err) {
      console.error('Failed to load unsold reports:', err);
    } finally {
      setLoadingUnsold(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(orders) && orders.length > 0) {
      setLiveOrders(orders);
    }
  }, [orders]);

  useEffect(() => {
    fetchUnsoldReports();

    const socket = getSocket();
    const handleUnsoldUpdated = (items: UnsoldReportItem[]) => {
      if (Array.isArray(items)) {
        setUnsoldReports(items);
      } else {
        fetchUnsoldReports();
      }
    };

    const handleOrderChange = () => {
      orderApi.getAll().then(data => {
        if (Array.isArray(data)) setLiveOrders(data);
      }).catch(() => {});
    };

    socket.on('unsold_reports_updated', handleUnsoldUpdated);
    socket.on('chef_unsold_report', () => fetchUnsoldReports());
    socket.on('order_updated', handleOrderChange);
    socket.on('table_status_updated', handleOrderChange);
    socket.on('new_order', handleOrderChange);

    return () => {
      socket.off('unsold_reports_updated', handleUnsoldUpdated);
      socket.off('chef_unsold_report');
      socket.off('order_updated', handleOrderChange);
      socket.off('table_status_updated', handleOrderChange);
      socket.off('new_order', handleOrderChange);
    };
  }, []);

  const checkDateMatch = (createdAtStr: any) => {
    if (dateFilter === 'all') return true;
    if (!createdAtStr) return true;

    const itemDate = new Date(createdAtStr);
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    if (dateFilter === 'today') {
      return itemDate >= startOfToday && itemDate <= endOfToday;
    } else if (dateFilter === '7days') {
      const startOf7Days = new Date(startOfToday);
      startOf7Days.setDate(startOf7Days.getDate() - 6);
      return itemDate >= startOf7Days && itemDate <= endOfToday;
    } else if (dateFilter === '30days') {
      const startOf30Days = new Date(startOfToday);
      startOf30Days.setDate(startOf30Days.getDate() - 29);
      return itemDate >= startOf30Days && itemDate <= endOfToday;
    } else if (dateFilter === 'lastmonth') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return itemDate >= startOfLastMonth && itemDate <= endOfLastMonth;
    } else if (dateFilter === 'custom') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : new Date();
      return itemDate >= start && itemDate <= end;
    }
    return true;
  };

  // Filter Paid Bills Only (paymentStatus === 'paid' and status !== 'cancelled')
  const paidOrders = useMemo(() => {
    const sourceOrders = liveOrders.length > 0 ? liveOrders : orders;

    return sourceOrders.filter(order => {
      if (order.status === 'cancelled') return false;
      if (order.paymentStatus !== 'paid') return false;
      return checkDateMatch(order.createdAt);
    });
  }, [liveOrders, orders, dateFilter, customStartDate, customEndDate]);

  // Filter Unsold Reports by Time Range
  const filteredUnsoldReports = useMemo(() => {
    return unsoldReports.filter(rep => {
      const timeStr = rep.createdAt || rep.reportedAt;
      if (!checkDateMatch(timeStr)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const rName = (rep.foodName || rep.name || '').toLowerCase();
        const matchName = rName.includes(q);
        const matchCat = (rep.category || '').toLowerCase().includes(q);
        const matchChef = (rep.reportedBy || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchChef) return false;
      }
      return true;
    });
  }, [unsoldReports, dateFilter, customStartDate, customEndDate, searchQuery]);

  // Aggregate SOLD items strictly from PAID bills
  const soldItemsList = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        category: string;
        mealType: string;
        unitPrice: number;
        soldQty: number;
        totalRevenue: number;
        billCount: number;
        tables: string[];
        lastSoldAt?: string;
      }
    >();

    paidOrders.forEach(order => {
      const seenInThisOrder = new Set<string>();
      (order.items || []).forEach((item: any) => {
        const itemName = (item.name || item.product?.name || '').trim();
        if (!itemName) return;
        const key = itemName.toLowerCase();
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price || item.product?.price) || 0;
        const itemProdId = item.productId || item.product?._id;

        // Match product metadata if available
        const matchedProd = products.find(
          p =>
            (itemProdId && String(p._id) === String(itemProdId)) ||
            p.name.trim().toLowerCase() === key
        );

        const existing = map.get(key);
        const tableLabel = order.tableNumber ? `Table ${order.tableNumber}` : 'Counter Bill';

        if (existing) {
          existing.soldQty += qty;
          existing.totalRevenue += qty * price;
          if (!seenInThisOrder.has(key)) {
            existing.billCount += 1;
            seenInThisOrder.add(key);
          }
          if (!existing.tables.includes(tableLabel)) {
            existing.tables.push(tableLabel);
          }
          if (order.createdAt && (!existing.lastSoldAt || order.createdAt > existing.lastSoldAt)) {
            existing.lastSoldAt = order.createdAt;
          }
        } else {
          seenInThisOrder.add(key);
          map.set(key, {
            key,
            name: matchedProd?.name || itemName,
            category: matchedProd?.category || 'General',
            mealType: matchedProd?.mealType || 'All Day',
            unitPrice: price || Number(matchedProd?.price) || 0,
            soldQty: qty,
            totalRevenue: qty * price,
            billCount: 1,
            tables: [tableLabel],
            lastSoldAt: order.createdAt,
          });
        }
      });
    });

    let list = Array.from(map.values()).sort((a, b) => b.soldQty - a.soldQty);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        it =>
          it.name.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.mealType.toLowerCase().includes(q)
      );
    }

    return list;
  }, [paidOrders, products, searchQuery]);

  // Combined Summary (All Tab: Paid Sold vs Chef Reported Unsold side-by-side)
  const combinedItemsList = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        category: string;
        unitPrice: number;
        soldQty: number;
        soldRevenue: number;
        billCount: number;
        unsoldQty: number;
        unsoldValue: number;
        reportedBy: string[];
        lastNote?: string;
      }
    >();

    // 1. Add all Paid Bill Sold items
    soldItemsList.forEach(s => {
      map.set(s.key, {
        key: s.key,
        name: s.name,
        category: s.category,
        unitPrice: s.unitPrice,
        soldQty: s.soldQty,
        soldRevenue: s.totalRevenue,
        billCount: s.billCount,
        unsoldQty: 0,
        unsoldValue: 0,
        reportedBy: [],
      });
    });

    // 2. Merge Chef Reported Unsold items
    filteredUnsoldReports.forEach(r => {
      const rName = (r.foodName || r.name || '').trim();
      const key = rName.toLowerCase();
      if (!key) return;
      const qty = Number(r.unsoldQty) || 0;
      const price = Number(r.price) || 0;
      const existing = map.get(key);

      if (existing) {
        existing.unsoldQty += qty;
        existing.unsoldValue += qty * (price || existing.unitPrice);
        if (r.reportedBy && !existing.reportedBy.includes(r.reportedBy)) {
          existing.reportedBy.push(r.reportedBy);
        }
        if (r.note) existing.lastNote = r.note;
      } else {
        map.set(key, {
          key,
          name: rName,
          category: r.category || 'Snacks & Food',
          unitPrice: price,
          soldQty: 0,
          soldRevenue: 0,
          billCount: 0,
          unsoldQty: qty,
          unsoldValue: qty * price,
          reportedBy: r.reportedBy ? [r.reportedBy] : ['Chef'],
          lastNote: r.note,
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.soldQty + b.unsoldQty - (a.soldQty + a.unsoldQty)
    );
  }, [soldItemsList, filteredUnsoldReports]);

  // Top Summary KPI Totals
  const totals = useMemo(() => {
    const totalSoldQty = soldItemsList.reduce((sum, i) => sum + i.soldQty, 0);
    const totalSoldRevenue = soldItemsList.reduce((sum, i) => sum + i.totalRevenue, 0);
    const totalUnsoldQty = filteredUnsoldReports.reduce(
      (sum, r) => sum + (Number(r.unsoldQty) || 0),
      0
    );
    const totalUnsoldValue = filteredUnsoldReports.reduce(
      (sum, r) => sum + (Number(r.unsoldQty) || 0) * (Number(r.price) || 0),
      0
    );
    return {
      totalSoldQty,
      totalSoldRevenue,
      totalPaidBills: paidOrders.length,
      totalUnsoldQty,
      totalUnsoldValue,
      totalUnsoldReports: filteredUnsoldReports.length,
    };
  }, [soldItemsList, filteredUnsoldReports, paidOrders]);

  const handleDeleteReport = async (id: string) => {
    setUnsoldReports(prev => prev.filter(r => r.id !== id));
    await categoryApi.deleteUnsoldReport(id);
  };

  const handleClearAllReports = async () => {
    if (!window.confirm('Clear all unsold food reports?')) return;
    setUnsoldReports([]);
    await categoryApi.deleteUnsoldReport('all');
  };

  const handleAdminAddUnsold = async () => {
    const qty = parseInt(unsoldQtyInput, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid Unsold Quantity');
      return;
    }

    let selectedProd: Product | undefined;
    if (!isCustomFood) {
      selectedProd = products.find(p => p._id === selectedProductId);
      if (!selectedProd) {
        alert('Please select a food item');
        return;
      }
    } else if (!customFoodName.trim()) {
      alert('Please enter a food name');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: isCustomFood ? `custom_${Date.now()}` : selectedProd!._id,
        foodName: isCustomFood ? customFoodName.trim() : selectedProd!.name,
        category: isCustomFood ? 'Snacks & Food' : selectedProd!.category,
        mealType: isCustomFood ? 'All Day' : selectedProd!.mealType || 'All Day',
        price: isCustomFood ? parseFloat(customFoodPrice) || 0 : Number(selectedProd!.price) || 0,
        unsoldQty: qty,
        reportedBy: 'Admin',
        note: unsoldNoteInput.trim(),
      };
      const created = await categoryApi.addUnsoldReport(payload);
      setUnsoldReports(prev => [created, ...prev.filter(r => r.id !== created?.id)]);
      setShowAdminReportModal(false);
      setCustomFoodName('');
      setUnsoldNoteInput('');
    } catch (e: any) {
      alert('Failed to add unsold report: ' + (e.message || 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#D1D5DB] shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0 flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Sold & Unsold Food Report
                </h2>
                <div className="text-xs font-semibold text-slate-500 space-y-0.5 mt-0.5">
                  <p>
                    🟢 <span className="text-emerald-700 font-bold">Sold</span> auto-updates when table bills are <span className="underline">Paid</span>
                  </p>
                  <p>
                    🔴 <span className="text-rose-600 font-bold">Unsold</span> updates live when <span className="underline">Chef reports remaining food</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls: Time Range Pills + Add Unsold + Icon-Only Refresh */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto max-w-full min-w-0">
            <div className="flex items-center flex-wrap bg-[#FFFFFF] p-1 sm:p-1.5 rounded-2xl border border-[#D1D5DB] shadow-xs gap-1 w-full sm:w-auto max-w-full min-w-0">
              {(['today', '7days', '30days', 'lastmonth', 'all', 'custom'] as const).map((f) => (
                <button
                  key={f}
                  title={f === 'custom' ? 'Custom Date Range' : undefined}
                  onClick={() => setDateFilter(f)}
                  className={`px-2 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs tracking-tight sm:tracking-normal font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    dateFilter === f
                      ? 'bg-[#4C1D95] text-white shadow-md'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {f === 'today'
                    ? 'Today'
                    : f === '7days'
                    ? 'Last 7 Days'
                    : f === '30days'
                    ? 'Last 30 Days'
                    : f === 'lastmonth'
                    ? 'Last Month'
                    : f === 'all'
                    ? 'All Time'
                    : '📅 CR'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAdminReportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition-all cursor-pointer"
            >
              <Plus size={15} />
              Log Unsold Food
            </button>

            <button
              onClick={() => {
                onRefresh();
                fetchUnsoldReports();
              }}
              title="Refresh"
              aria-label="Refresh"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer flex items-center justify-center"
            >
              <RefreshCw size={16} className={loadingUnsold ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker Section */}
        {dateFilter === 'custom' && (
          <div className="pt-4 border-t border-[#E5E7EB] animate-fade-in">
            <div className="bg-[#FFFFFF] border border-[#D1D5DB] p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5 sm:gap-4 w-full">
              <div className="w-full sm:flex-1 space-y-1.5">
                <label className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#4C1D95] shrink-0" /> Start Date:
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
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
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2.5 text-xs text-[#111827] font-semibold outline-none"
                />
              </div>

              <button
                onClick={() => fetchUnsoldReports()}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 h-[40px] active:scale-[0.98]"
              >
                <Filter size={14} />
                <span>Apply Date Filter</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Sold (Paid Bills) */}
        <div
          onClick={() => setActiveSubTab('sold')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer ${
            activeSubTab === 'sold'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
              🟢 Sold (Paid Bills)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700">{totals.totalSoldQty}</div>
          <p className="text-xs font-bold text-emerald-600/80 mt-1">
            From {totals.totalPaidBills} paid {totals.totalPaidBills === 1 ? 'bill' : 'bills'}
          </p>
        </div>

        {/* Card 2: Total Sold Revenue */}
        <div
          onClick={() => setActiveSubTab('sold')}
          className="p-5 rounded-3xl bg-white border border-emerald-200 hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
              💰 Sold Bill Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <Receipt size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            ₹{totals.totalSoldRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {soldItemsList.length} food items sold
          </p>
        </div>

        {/* Card 3: Chef Reported Unsold */}
        <div
          onClick={() => setActiveSubTab('unsold')}
          className={`p-5 rounded-3xl border transition-all cursor-pointer ${
            activeSubTab === 'unsold'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20'
              : 'bg-white border-rose-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700">
              🔴 Unsold (Chef Report)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">{totals.totalUnsoldQty}</div>
          <p className="text-xs font-bold text-rose-600/80 mt-1">
            {totals.totalUnsoldReports} {totals.totalUnsoldReports === 1 ? 'report' : 'reports'} from Kitchen Chef
          </p>
        </div>

        {/* Card 4: Unsold Food Value */}
        <div
          onClick={() => setActiveSubTab('unsold')}
          className="p-5 rounded-3xl bg-white border border-rose-200 hover:border-rose-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700">
              👨‍🍳 Unsold Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center">
              <ChefHat size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            ₹{totals.totalUnsoldValue.toLocaleString('en-IN')}
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Remaining food value
          </p>
        </div>
      </div>

      {/* Sub-Tabs & Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-between sm:justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span>📊 Sold & Unsold Overview</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
              activeSubTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
            }`}>
              {combinedItemsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('sold')}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-between sm:justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'sold'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>🟢 Sold Only (Paid Bills)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                activeSubTab === 'sold' ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {totals.totalSoldQty}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('unsold')}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-between sm:justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'unsold'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>🔴 Unsold Only (Chef Reports)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                activeSubTab === 'unsold' ? 'bg-white/20 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {totals.totalUnsoldQty}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full xl:w-auto xl:min-w-[240px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search food name (e.g. Vada)..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* TAB 1: COMBINED SOLD & UNSOLD OVERVIEW */}
      {activeSubTab === 'all' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                📊 Sold (Paid Bills) vs Unsold (Chef Reports)
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Every item sold through paid table bills & remaining items reported by Kitchen Chef
              </p>
            </div>
          </div>

          {combinedItemsList.length === 0 ? (
            <div className="p-12 text-center">
              <PackageCheck size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-extrabold text-slate-700">
                No Sold Bills or Chef Unsold Reports yet
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                When a customer table bill is marked as <b>Paid</b>, sold items appear here automatically. When the Kitchen Chef clicks <b>Report Unsold Food</b>, unsold counts appear here live.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-3 sm:px-5 align-middle whitespace-nowrap">Food Item</th>
                    <th className="py-3.5 px-2.5 sm:px-4 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                        <span>🟢</span>
                        <span>Sold</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold whitespace-nowrap mt-0.5">
                        (Paid Bills)
                      </div>
                    </th>
                    <th className="py-3.5 px-2.5 sm:px-4 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                        <span>🔴</span>
                        <span>Unsold</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold whitespace-nowrap mt-0.5">
                        (Chef Report)
                      </div>
                    </th>
                    <th className="py-3.5 px-2.5 sm:px-4 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                        <span>Total</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold whitespace-nowrap mt-0.5">
                        (Sold + Unsold)
                      </div>
                    </th>
                    <th className="py-3.5 px-4 sm:px-5 align-middle whitespace-nowrap">Sold vs Unsold Ratio</th>
                    <th className="py-3.5 px-4 sm:px-5 text-right align-middle whitespace-nowrap">Sold Bill Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {combinedItemsList.map(item => {
                    const totalPrepared = item.soldQty + item.unsoldQty;
                    const soldPct =
                      totalPrepared > 0 ? Math.round((item.soldQty / totalPrepared) * 100) : 0;

                    return (
                      <tr key={item.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 sm:px-5 align-middle min-w-[115px]">
                          <div className="font-extrabold text-slate-900 leading-snug">{item.name}</div>
                          <div className="text-[11px] sm:text-xs font-semibold text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                            <span className="whitespace-nowrap">{item.category}</span>
                            {item.unitPrice > 0 && <span className="whitespace-nowrap">• ₹{item.unitPrice}/unit</span>}
                            {item.lastNote && (
                              <span className="text-rose-600 font-bold">
                                • Note: "{item.lastNote}"
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-2.5 sm:px-4 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <span className="inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                              {item.soldQty} Sold
                            </span>
                            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-1 whitespace-nowrap">
                              {item.billCount} paid {item.billCount === 1 ? 'bill' : 'bills'}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-2.5 sm:px-4 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            {item.unsoldQty > 0 ? (
                              <>
                                <span className="inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 whitespace-nowrap">
                                  {item.unsoldQty} Unsold
                                </span>
                                <div className="text-[10px] sm:text-[11px] font-bold text-rose-500 mt-1 whitespace-nowrap">
                                  By {item.reportedBy.join(', ')}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center justify-center px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-slate-50 text-slate-400 border border-slate-200 whitespace-nowrap">
                                  0 Unsold
                                </span>
                                <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 mt-1 whitespace-nowrap">
                                  0 reports
                                </div>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-2.5 sm:px-4 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <span className="inline-flex items-center justify-center px-2.5 sm:px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-black text-[11px] sm:text-xs whitespace-nowrap">
                              {totalPrepared} Total
                            </span>
                            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-1 whitespace-nowrap">
                              {soldPct}% sold
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-5 align-middle min-w-[180px]">
                          <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
                            <span className="text-emerald-700">{soldPct}% Sold</span>
                            <span className="text-rose-600">{100 - soldPct}% Unsold</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-rose-100 overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${soldPct}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-5 text-right align-middle font-black text-slate-900 whitespace-nowrap">
                          ₹{item.soldRevenue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 🟢 SOLD ONLY (PAID BILLS) */}
      {activeSubTab === 'sold' && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50/60 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                🟢 Sold Food Items (Strictly from Paid Table Bills)
              </h3>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                When a table orders (e.g. 10 Vada) and pays the bill, it is automatically added here as Sold.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold">
              {totals.totalSoldQty} Total Units Sold
            </span>
          </div>

          {soldItemsList.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt size={40} className="mx-auto text-emerald-300 mb-3" />
              <p className="text-sm font-extrabold text-slate-700">
                No paid bills recorded {dateFilter === 'today' ? 'today' : 'yet'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Once a customer bill is settled as <b>Paid</b> at Reception, those food items will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
              {soldItemsList.map(item => (
                <div
                  key={item.key}
                  className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {item.category} • {item.mealType}
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1.5">{item.name}</h4>
                      <p className="text-xs font-bold text-slate-500">₹{item.unitPrice} per unit</p>
                    </div>
                    <div className="text-right">
                      <div className="px-3 py-1.5 rounded-2xl bg-emerald-600 text-white font-black text-base shadow-sm">
                        {item.soldQty} Sold
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-emerald-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-500">Paid Bills: </span>
                      <span className="font-extrabold text-slate-800">{item.billCount}</span>
                      <div className="text-[11px] text-slate-400 font-semibold truncate max-w-[170px]">
                        {item.tables.join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-400 block">Billed Total</span>
                      <span className="text-sm font-black text-emerald-700">
                        ₹{item.totalRevenue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 🔴 UNSOLD ONLY (CHEF REPORTS) */}
      {activeSubTab === 'unsold' && (
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-rose-50/60 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-rose-950 flex items-center gap-2">
                <Flame size={18} className="text-rose-600" />
                🔴 Unsold Food Items (Reported by Kitchen Chef)
              </h3>
              <p className="text-xs text-rose-700 font-semibold mt-0.5">
                Direct reports from the Kitchen Display when prepared food remains unsold (e.g. 20 Vada Unsold).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {filteredUnsoldReports.length > 0 && (
                <button
                  onClick={handleClearAllReports}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
              <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-extrabold">
                {totals.totalUnsoldQty} Total Units Unsold
              </span>
            </div>
          </div>

          {filteredUnsoldReports.length === 0 ? (
            <div className="p-12 text-center">
              <ChefHat size={40} className="mx-auto text-rose-300 mb-3" />
              <p className="text-sm font-extrabold text-slate-700">
                No unsold food reported by Chef {dateFilter === 'today' ? 'today' : 'yet'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                In the <b>Kitchen Chef View</b>, the Chef can click <b>"Report Unsold Food"</b>, enter the remaining quantity (e.g. 20 Vada), and send it directly to Admin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
              {filteredUnsoldReports.map(rep => {
                const unsoldVal = (Number(rep.unsoldQty) || 0) * (Number(rep.price) || 0);
                return (
                  <div
                    key={rep.id}
                    className="p-5 rounded-2xl bg-gradient-to-br from-rose-50/70 to-white border border-rose-200 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                          {rep.category || 'Snacks & Food'}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1.5">{rep.foodName || rep.name}</h4>
                        <p className="text-xs font-bold text-slate-500">
                          Reported by <span className="text-rose-700">{rep.reportedBy || 'Chef'}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="px-3 py-1.5 rounded-2xl bg-rose-600 text-white font-black text-base shadow-sm">
                          {rep.unsoldQty} Unsold
                        </div>
                        <button
                          onClick={() => handleDeleteReport(rep.id)}
                          className="p-1.5 rounded-xl text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Delete report"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {rep.note && (
                      <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                        📝 "{rep.note}"
                      </div>
                    )}

                    <div className="pt-3 border-t border-rose-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">
                        {(rep.createdAt || rep.reportedAt)
                          ? new Date((rep.createdAt || rep.reportedAt)!).toLocaleString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: 'short',
                            })
                          : 'Just now'}
                      </span>
                      {unsoldVal > 0 && (
                        <span className="font-black text-rose-700">
                          Value: ₹{unsoldVal.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Admin Quick-Log Unsold Modal */}
      {showAdminReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Log Unsold Food</h3>
              <button
                onClick={() => setShowAdminReportModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setIsCustomFood(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                  !isCustomFood ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                Select Menu Item
              </button>
              <button
                type="button"
                onClick={() => setIsCustomFood(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                  isCustomFood ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                Custom Food (e.g. Vada)
              </button>
            </div>

            {!isCustomFood ? (
              <div>
                <label className="block text-xs font-extrabold text-slate-600 mb-1">
                  Select Food Item
                </label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900"
                >
                  <option value="">-- Choose Food --</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-extrabold text-slate-600 mb-1">
                    Food Name
                  </label>
                  <input
                    type="text"
                    value={customFoodName}
                    onChange={e => setCustomFoodName(e.target.value)}
                    placeholder="e.g. Vada"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={customFoodPrice}
                    onChange={e => setCustomFoodPrice(e.target.value)}
                    placeholder="15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">
                Unsold Quantity
              </label>
              <input
                type="number"
                min="1"
                value={unsoldQtyInput}
                onChange={e => setUnsoldQtyInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-rose-300 bg-rose-50/40 text-base font-black text-rose-700"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={unsoldNoteInput}
                onChange={e => setUnsoldNoteInput(e.target.value)}
                placeholder="e.g. Evening batch remaining"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
              />
            </div>

            <button
              onClick={handleAdminAddUnsold}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={14} />
              {submitting ? 'Saving...' : 'Save Unsold Food'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
