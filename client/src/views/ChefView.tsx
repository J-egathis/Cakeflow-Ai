import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Order, Product } from '../types';
import { orderApi, productApi, categoryApi, getSocket } from '../services/api';
import { 
  Play, Check, Ban, Clock, ChevronRight, 
  ChefHat, AlertCircle, RefreshCw, LogOut, Utensils,
  Package, Search, CheckCircle2, XCircle, X, AlertTriangle, Trash2, Send
} from 'lucide-react';

interface ChefViewProps {
  user: { username: string; role: 'cake_chef' | 'snacks_chef' };
  onLogout: () => void;
}

export const ChefView: React.FC<ChefViewProps> = ({ user, onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || localStorage.getItem('chef_active_tab') || 'All';
  const setActiveTab = (tab: string) => {
    localStorage.setItem('chef_active_tab', tab);
    setSearchParams(prev => { prev.set('tab', tab); return prev; }, { replace: true });
  };
  const tabs = ['All', 'Juice', 'Snacks', 'Cakes', 'Chats'];
  
  // Mobile Column Selector (all | pending | accepted | ready)
  const [mobileColFilter, setMobileColFilterState] = useState<string>(() => {
    return localStorage.getItem('chef_mobile_col_filter') || 'all';
  });
  const setMobileColFilter = (col: string) => {
    setMobileColFilterState(col);
    localStorage.setItem('chef_mobile_col_filter', col);
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlightUpdatesRef = useRef(0);

  // Products & Kitchen Stock Management
  const [products, setProducts] = useState<Product[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('All');
  const [togglingStockId, setTogglingStockId] = useState<string | null>(null);
  const [stockToast, setStockToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null);
  
  // States for modals/notes
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [autoMarkItemOutOfStock, setAutoMarkItemOutOfStock] = useState(true);
  
  const [chefNotes, setChefNotes] = useState<{ [orderId: string]: string }>({});
  const [estTime, setEstTime] = useState<{ [orderId: string]: number }>({});

  // Unsold Food Report to Admin State
  const [showUnsoldModal, setShowUnsoldModal] = useState(false);
  const [unsoldReports, setUnsoldReports] = useState<any[]>([]);
  const [unsoldProductId, setUnsoldProductId] = useState<string>('');
  const [isCustomUnsoldFood, setIsCustomUnsoldFood] = useState<boolean>(false);
  const [customUnsoldName, setCustomUnsoldName] = useState<string>('');
  const [customUnsoldPrice, setCustomUnsoldPrice] = useState<string>('10');
  const [unsoldQtyInput, setUnsoldQtyInput] = useState<string>('20');
  const [unsoldNoteInput, setUnsoldNoteInput] = useState<string>('');
  const [sendingUnsold, setSendingUnsold] = useState<boolean>(false);

  const fetchUnsoldReports = async () => {
    try {
      const list = await categoryApi.getUnsoldReports();
      if (Array.isArray(list)) setUnsoldReports(list);
    } catch {}
  };

  const handleSendUnsoldReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, parseInt(unsoldQtyInput, 10) || 0);
    if (qty <= 0) return;

    const selectedProd = !isCustomUnsoldFood
      ? products.find(p => String(p._id) === unsoldProductId) || products[0]
      : null;

    const foodName = isCustomUnsoldFood
      ? customUnsoldName.trim()
      : (selectedProd?.name || '').trim();

    if (!foodName) {
      alert('Please select or enter a food item name');
      return;
    }

    setSendingUnsold(true);
    try {
      const payload = {
        productId: selectedProd ? selectedProd._id : null,
        foodName,
        category: selectedProd ? selectedProd.category : 'Snacks',
        mealType: (selectedProd as any)?.mealType || 'Breakfast',
        price: isCustomUnsoldFood ? (parseFloat(customUnsoldPrice) || 0) : (Number(selectedProd?.price) || 0),
        unsoldQty: qty,
        reportedBy: user.username || (user.role === 'cake_chef' ? 'Cake Chef' : 'Snacks Chef'),
        note: unsoldNoteInput.trim()
      };

      const created = await categoryApi.addUnsoldReport(payload);
      setUnsoldReports(prev => [created, ...prev.filter(r => r.id !== created?.id)]);
      setUnsoldNoteInput('');
      setCustomUnsoldName('');
      showChefStockToast(`📢 Sent to Admin: ${qty}x "${foodName}" reported as Unsold!`, 'success');
    } catch (err: any) {
      alert('Failed to send unsold report: ' + (err.message || 'Error'));
    } finally {
      setSendingUnsold(false);
    }
  };

  const handleDeleteUnsoldReport = async (id: string) => {
    setUnsoldReports(prev => prev.filter(r => r.id !== id));
    await categoryApi.deleteUnsoldReport(id);
  };

  const columns = [
    { id: 'pending', name: 'Pending' },
    { id: 'preparing', name: 'Preparing' },
    { id: 'ready', name: 'Ready' }
  ];

  // Fetch orders (showLoading=false for background silent polls)
  const fetchChefOrders = async (showLoading = true) => {
    // Skip silent background poll if an optimistic status update is currently in-flight
    if (!showLoading && inFlightUpdatesRef.current > 0) return;
    if (showLoading) setLoading(true);
    try {
      const data = await orderApi.getAll();
      // Do not overwrite optimistic state if another update started while getAll() was in flight
      if (!showLoading && inFlightUpdatesRef.current > 0) return;
      const activeOrders = data.filter((order: Order) =>
        order.status !== 'served' && order.status !== 'cancelled'
      );
      setOrders(activeOrders);
    } catch (err) {
      console.error('Failed to load chef orders:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch all menu products for kitchen stock management
  const fetchProducts = async () => {
    try {
      const data = await productApi.getAll();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load products for chef stock control:', err);
    }
  };

  useEffect(() => {
    fetchChefOrders(true);
    fetchProducts();
    fetchUnsoldReports();

    const socket = getSocket();
    socket.emit('join_room', 'cake_kitchen');
    socket.emit('join_room', 'snacks_kitchen');

    const handleNewOrder = () => {
      fetchChefOrders(false);
      playKitchenNotificationSound();
    };

    const handleProductChange = () => {
      fetchProducts();
    };

    const handleUnsoldReportsUpdated = (items: any[]) => {
      if (Array.isArray(items)) setUnsoldReports(items);
      else fetchUnsoldReports();
    };

    const handleOrderUpdated = (updatedOrder?: Order) => {
      if (updatedOrder && updatedOrder._id) {
        if (updatedOrder.status === 'served' || updatedOrder.status === 'cancelled') {
          setOrders(prev => prev.filter(o => o._id !== updatedOrder._id));
        } else {
          setOrders(prev => {
            const exists = prev.some(o => o._id === updatedOrder._id);
            return exists
              ? prev.map(o => o._id === updatedOrder._id ? updatedOrder : o)
              : [updatedOrder, ...prev];
          });
        }
      } else {
        fetchChefOrders(false);
      }
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_updated', handleOrderUpdated);
    socket.on('table_status_updated', () => fetchChefOrders(false));
    socket.on('product:updated', handleProductChange);
    socket.on('product:created', handleProductChange);
    socket.on('product:deleted', handleProductChange);
    socket.on('unsold_reports_updated', handleUnsoldReportsUpdated);

    // Silent background poll every 4s for instant kitchen auto-refresh
    const intervalId = setInterval(() => {
      fetchChefOrders(false);
    }, 4000);

    return () => {
      clearInterval(intervalId);
      socket.emit('leave_room', 'cake_kitchen');
      socket.emit('leave_room', 'snacks_kitchen');
      socket.off('new_order', handleNewOrder);
      socket.off('order_updated');
      socket.off('table_status_updated');
      socket.off('product:updated', handleProductChange);
      socket.off('product:created', handleProductChange);
      socket.off('product:deleted', handleProductChange);
      socket.off('unsold_reports_updated', handleUnsoldReportsUpdated);
    };
  }, []);

  const showChefStockToast = (msg: string, type: 'success' | 'danger') => {
    setStockToast({ msg, type });
    setTimeout(() => setStockToast(null), 3000);
  };

  // Toggle inStock state and broadcast live to Admin & Customers
  const handleToggleProductStock = async (product: Product) => {
    const newStockState = !product.inStock;
    setTogglingStockId(product._id);

    // Optimistic UI update
    setProducts(prev => prev.map(p => p._id === product._id ? { ...p, inStock: newStockState } : p));

    try {
      await productApi.update(product._id, {
        inStock: newStockState,
        updatedBy: user.username || (user.role === 'cake_chef' ? 'Cake Chef' : 'Snacks Chef')
      });

      showChefStockToast(
        newStockState 
          ? `✅ "${product.name}" marked IN STOCK. Synced live with Admin & Customers!` 
          : `🚨 "${product.name}" marked OUT OF STOCK. Synced live with Admin & Customers!`,
        newStockState ? 'success' : 'danger'
      );
    } catch (err: any) {
      // Revert optimistic update
      setProducts(prev => prev.map(p => p._id === product._id ? { ...p, inStock: !newStockState } : p));
      alert('Failed to update stock: ' + (err.message || 'Error'));
    } finally {
      setTogglingStockId(null);
    }
  };

  const playKitchenNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      
      osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.2);
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Context block', e);
    }
  };

  const isItemInColumn = (item: any, colId: string) => {
    const s = item.status || 'pending';
    if (colId === 'pending') {
      return s === 'pending';
    }
    if (colId === 'preparing') {
      return s === 'accepted' || s === 'preparing' || s === 'decorating' || s === 'quality_check';
    }
    if (colId === 'ready') {
      return s === 'ready';
    }
    return false;
  };

  const updateStatus = async (orderId: string, fromColId: string, nextStatus: string, extras = {}) => {
    const order = orders.find(o => o._id === orderId);
    if (!order) return;

    const notes = chefNotes[orderId] || '';
    const estimatedMinutes = estTime[orderId] || 20;
    const estimatedTime = new Date();
    estimatedTime.setMinutes(estimatedTime.getMinutes() + Number(estimatedMinutes));

    const matchingItemIds = new Set(
      order.items
        .filter(item => itemMatchesTab(item, activeTab) && isItemInColumn(item, fromColId))
        .map(item => String(item._id))
    );

    const itemsToUpdate = Array.from(matchingItemIds).map(itemId => ({
      itemId,
      status: nextStatus
    }));

    const previousOrders = orders;

    // 1. Instant 0ms Optimistic UI Update: move items & order to the next column immediately
    setOrders(prev =>
      prev.map(o => {
        if (o._id !== orderId) return o;
        const updatedItems = o.items.map(item =>
          matchingItemIds.has(String(item._id))
            ? { ...item, status: nextStatus as any }
            : item
        );
        const allStatuses = updatedItems.map(i => i.status || 'pending');
        let computedOrderStatus = o.status;
        if (allStatuses.every(s => s === 'ready')) {
          computedOrderStatus = 'ready';
        } else if (allStatuses.some(s => ['preparing', 'decorating', 'quality_check'].includes(s))) {
          computedOrderStatus = 'preparing';
        } else if (allStatuses.some(s => s === 'accepted')) {
          computedOrderStatus = 'accepted';
        }
        return {
          ...o,
          status: computedOrderStatus,
          chefNotes: notes || o.chefNotes,
          items: updatedItems
        };
      })
    );

    inFlightUpdatesRef.current += 1;
    try {
      const updatedOrder = await orderApi.update(orderId, {
        status: undefined, // Let backend calculate overall order status from item statuses
        chefNotes: notes || undefined,
        estimatedCompletionTime: (nextStatus === 'accepted' || nextStatus === 'preparing') ? estimatedTime.toISOString() : undefined,
        items: itemsToUpdate,
        ...extras
      });
      if (updatedOrder && updatedOrder._id) {
        setOrders(prev =>
          prev
            .map(o => (o._id === updatedOrder._id ? updatedOrder : o))
            .filter(o => o.status !== 'served' && o.status !== 'cancelled')
        );
      }
    } catch (err) {
      setOrders(previousOrders);
      alert('Failed to update status: ' + err);
    } finally {
      inFlightUpdatesRef.current = Math.max(0, inFlightUpdatesRef.current - 1);
    }
  };

  const handleRejectClick = (order: Order) => {
    setSelectedOrder(order);
    setRejectionReason('Out of Stock');
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!selectedOrder) return;
    const targetOrder = selectedOrder;
    const previousOrders = orders;

    // Instant 0ms optimistic removal of rejected order & modal close
    setOrders(prev => prev.filter(o => o._id !== targetOrder._id));
    setShowRejectModal(false);
    setSelectedOrder(null);

    inFlightUpdatesRef.current += 1;
    try {
      await orderApi.update(targetOrder._id, {
        status: 'cancelled',
        rejectionReason: rejectionReason
      });

      // If rejected due to Out of Stock and auto-mark is enabled, mark unique items out of stock in parallel
      if (rejectionReason === 'Out of Stock' && autoMarkItemOutOfStock) {
        const uniqueProdIds = Array.from(
          new Set(
            targetOrder.items
              .map(item => item.product?._id || (item as any).productId)
              .filter(Boolean)
              .map(String)
          )
        );
        if (uniqueProdIds.length > 0) {
          const uniqueSet = new Set(uniqueProdIds);
          setProducts(prev => prev.map(p => uniqueSet.has(String(p._id)) ? { ...p, inStock: false } : p));
          await Promise.all(
            uniqueProdIds.map(prodId =>
              productApi.update(prodId, {
                inStock: false,
                updatedBy: user.username || (user.role === 'cake_chef' ? 'Cake Chef' : 'Snacks Chef')
              }).catch(e => console.error('Failed to auto-mark item out of stock:', e))
            )
          );
          showChefStockToast(`🚨 Order items marked OUT OF STOCK & live alert sent to Admin!`, 'danger');
        }
      }
    } catch (err) {
      setOrders(previousOrders);
      alert('Failed to reject order: ' + err);
    } finally {
      inFlightUpdatesRef.current = Math.max(0, inFlightUpdatesRef.current - 1);
    }
  };

  const itemMatchesTab = (item: any, tab: string) => {
    if (tab === 'All') return true;
    const cat = (item.product?.category || item.category || '').toLowerCase();
    const prodName = (item.product?.name || item.name || '').toLowerCase();
    
    if (tab === 'Cakes') return cat.includes('cake') || cat.includes('pastr') || cat.includes('brownie') || cat.includes('cookie') || cat.includes('dessert') || prodName.includes('cake');
    if (tab === 'Snacks') return cat.includes('snack') || cat.includes('veg') || cat.includes('burger') || cat.includes('puff') || prodName.includes('snack');
    if (tab === 'Juice') return cat.includes('drink') || cat.includes('juice') || cat.includes('cold') || cat.includes('hot') || cat.includes('latte') || cat.includes('mojito');
    if (tab === 'Chats') return cat.includes('chat') || cat.includes('chaat');
    
    return true;
  };

  const getOrdersInColumn = (colId: string) => {
    return orders.filter(order => {
      const colItems = order.items.filter(item => itemMatchesTab(item, activeTab) && isItemInColumn(item, colId));
      return colItems.length > 0;
    });
  };

  const getNextColumnId = (current: string) => {
    const idx = columns.findIndex(c => c.id === current);
    if (idx !== -1 && idx < columns.length - 1) {
      return columns[idx + 1].id;
    }
    return '';
  };

  const visibleColumns = mobileColFilter === 'all' 
    ? columns 
    : columns.filter(c => c.id === mobileColFilter);

  // Filtered products in Kitchen Stock Modal
  const filteredStockProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(stockSearchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (stockCategoryFilter === 'All') return true;
    if (stockCategoryFilter === 'OutOfStock') return !p.inStock;
    if (stockCategoryFilter === 'InStock') return p.inStock;
    return p.category.toLowerCase().includes(stockCategoryFilter.toLowerCase());
  });

  const outOfStockCount = products.filter(p => !p.inStock).length;

  return (
    <div id="chefPage" data-testid="chefPage" className="min-h-screen md:h-screen md:max-h-screen bg-[#FFFFFF] text-[#111827] flex flex-col relative overflow-x-hidden">
      
      {/* Live Kitchen Stock Toast */}
      {stockToast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-black flex items-center gap-2 animate-slide-in ${
          stockToast.type === 'success' 
            ? 'bg-[#F3F4F6] border-[#D1D5DB] text-[#4C1D95]' 
            : 'bg-neutral-50 border-neutral-300 text-[#4C1D95]'
        }`}>
          {stockToast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{stockToast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header id="chefHeader" data-testid="chefHeader" className="bg-white/95 backdrop-blur-md border-b border-[#D1D5DB] px-3.5 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between z-10 shrink-0 gap-2.5 shadow-sm">
        {/* Top Row: Brand Title + Mobile Refresh/Logout Icons */}
        <div className="flex items-center justify-between gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
              <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-nowrap">
                <h1 className="font-extrabold text-base md:text-lg tracking-tight text-[#4C1D95] whitespace-nowrap leading-tight">
                  Chef Kitchen
                </h1>
                <span className="text-[10px] font-extrabold bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/20 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                  Live Board
                </span>
              </div>
              <p className="text-[11px] md:text-xs text-[#4B5563] font-semibold whitespace-nowrap truncate mt-0.5">
                Real-Time Kitchen Operations
              </p>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <button 
              onClick={() => fetchChefOrders(true)}
              className="p-2 rounded-xl bg-white border border-[#D1D5DB] text-[#4B5563] hover:text-[#4C1D95] transition-colors cursor-pointer shadow-sm"
              title="Refresh Board"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onLogout}
              className="p-2 rounded-xl bg-white border border-[#D1D5DB] text-[#4B5563] hover:text-[#4C1D95] transition-colors cursor-pointer shadow-sm"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Mobile Second Row: Balanced Unsold & Stock Action Buttons */}
        <div className="grid grid-cols-2 md:hidden gap-2 w-full">
          <button
            onClick={() => {
              if (!unsoldProductId && products.length > 0) setUnsoldProductId(String(products[0]._id));
              fetchUnsoldReports();
              setShowUnsoldModal(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span>Report Unsold</span>
          </button>
          <button 
            onClick={() => setShowStockModal(true)}
            className="w-full py-2 px-3 rounded-xl bg-neutral-50 border border-neutral-300 text-[#4C1D95] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Package size={14} className="shrink-0" />
            <span>Stock / 86 Items</span>
            {outOfStockCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#4C1D95] text-white text-[9px] flex items-center justify-center font-black shrink-0">
                {outOfStockCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Tabs (Hidden per user preference) & Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Desktop Actions */}
          <div className="flex items-center gap-2">
            {/* Report Unsold Food to Admin Button */}
            <button
              onClick={() => {
                if (!unsoldProductId && products.length > 0) setUnsoldProductId(String(products[0]._id));
                fetchUnsoldReports();
                setShowUnsoldModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap quick-touch"
              title="Report unsold food directly to Admin"
            >
              <AlertTriangle size={14} />
              <span>Report Unsold Food</span>
            </button>

            {/* Quick Kitchen Stock & 86 Item Button */}
            <button 
              onClick={() => setShowStockModal(true)}
              className="px-3.5 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-[#4C1D95] border border-neutral-300 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap quick-touch"
              title="View & update food item availability / out-of-stock live with Admin & Customer Menu"
            >
              <Package size={14} className="text-[#4C1D95]" />
              <span>Stock / 86 Items</span>
              {outOfStockCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#4C1D95] text-white text-[10px] font-black animate-pulse">
                  {outOfStockCount} Out
                </span>
              )}
            </button>

            <button 
              onClick={() => fetchChefOrders(true)}
              className="p-2 rounded-xl bg-white border border-[#D1D5DB] text-[#4B5563] hover:text-[#4C1D95] transition-colors cursor-pointer shadow-sm"
              title="Refresh Board"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            
            <button 
              onClick={onLogout}
              className="text-xs text-[#4B5563] hover:text-[#4C1D95] bg-white border border-[#D1D5DB] px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Column Quick Switcher */}
        <div className="flex md:hidden bg-white border border-[#D1D5DB] p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setMobileColFilter('all')}
            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-extrabold text-center transition-all ${
              mobileColFilter === 'all' ? 'bg-[#4C1D95] text-white' : 'text-[#4B5563]'
            }`}
          >
            All ({orders.length})
          </button>
          {columns.map(c => {
            const count = getOrdersInColumn(c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setMobileColFilter(c.id)}
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-extrabold text-center transition-all ${
                  mobileColFilter === c.id ? 'bg-[#4C1D95] text-white' : 'text-[#4B5563]'
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </header>

      {/* Grid Container */}
      <main className="flex-1 p-3 md:p-4 z-10 max-w-7xl mx-auto w-full overflow-y-auto md:overflow-hidden select-none flex flex-col justify-between">
        {loading && orders.length === 0 ? (
          <div className="w-full h-64 flex flex-col items-center justify-center text-[#4B5563] space-y-3">
            <RefreshCw size={36} className="animate-spin text-[#4C1D95]" />
            <p className="text-xs font-bold">Fetching kitchen tickets...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full h-full pb-6 md:pb-0">
            {visibleColumns.map((col) => {
              const colOrders = getOrdersInColumn(col.id);

              return (
                <div 
                  key={col.id} 
                  className="bg-white border border-[#D1D5DB] p-3.5 md:p-4 rounded-3xl flex flex-col min-h-[380px] md:h-[calc(100vh-140px)] shadow-sm overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#F3F4F6] shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        col.id === 'pending' ? 'bg-[#D1D5DB] animate-ping' :
                        col.id === 'accepted' ? 'bg-[#D1D5DB]' :
                        col.id === 'ready' ? 'bg-[#4C1D95]' : 'bg-[#4C1D95]'
                      }`} />
                      <h3 className="font-extrabold text-xs text-[#111827] uppercase tracking-wider">{col.name}</h3>
                    </div>
                    <span className="text-[10px] font-black bg-[#F9FAFB] border border-[#D1D5DB] text-[#4C1D95] px-2.5 py-0.5 rounded-full">
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Column Body */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {colOrders.length === 0 ? (
                      <div className="h-40 md:h-full flex items-center justify-center border border-dashed border-[#D1D5DB] rounded-2xl text-xs text-[#4B5563] font-semibold">
                        No orders in {col.name}
                      </div>
                    ) : (
                      colOrders.map(order => {
                        const colItems = order.items.filter(item => itemMatchesTab(item, activeTab) && isItemInColumn(item, col.id));
                        const nextCol = getNextColumnId(col.id);

                        return (
                          <div 
                            key={`${order._id}-${col.id}`} 
                            className="bg-[#F9FAFB] border border-[#D1D5DB] hover:border-[#4C1D95] p-3.5 rounded-2xl space-y-3 transition-all shadow-sm group"
                          >
                            {/* Order Header */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-black text-[#4C1D95]">
                                  TABLE {order.tableNumber} - {order.customerName}
                                </h4>
                                <p className="text-[10px] text-[#4B5563] font-mono mt-0.5">Order #{order._id.slice(-4)}</p>
                              </div>
                              <span className="text-[10px] text-[#4B5563] font-semibold flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-[#D1D5DB]">
                                <Clock size={10} className="text-[#4C1D95]" />
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Items List grouped by Member ID */}
                            {(() => {
                              const membersMap: { [m: string]: typeof colItems } = {};
                              colItems.forEach(item => {
                                const m = (item as any).memberId || 'M1';
                                if (!membersMap[m]) membersMap[m] = [];
                                membersMap[m].push(item);
                              });
                              const memberIds = Object.keys(membersMap).sort();

                              return (
                                <div className="bg-white p-2.5 rounded-xl border border-[#F3F4F6] space-y-2.5">
                                  {memberIds.map(mId => (
                                    <div key={mId} className="space-y-1.5 border-b border-[#F3F4F6]/60 last:border-b-0 pb-2 last:pb-0">
                                      <div className="flex items-center justify-between bg-[#F9FAFB] px-2 py-0.5 rounded border border-[#F3F4F6]">
                                        <span className="text-[10px] font-black text-[#4C1D95]">
                                          Seat / Member: {mId}
                                        </span>
                                      </div>
                                      {membersMap[mId].map(item => (
                                        <div key={item._id} className="text-xs space-y-1">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-[#111827] text-[11px]">
                                              {(item.product as any)?.name || (item as any)?.name || 'Food Item'}
                                            </span>
                                            <span className="text-[#4C1D95] font-extrabold bg-[#4C1D95]/10 px-2 py-0.5 rounded text-[10px]">x{item.quantity}</span>
                                          </div>
                                          {item.instructions && (
                                            <div className="text-[10px] font-black text-[#4C1D95] bg-[#4C1D95]/10 border border-[#4C1D95]/30 px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                                              <span>📌 Note: "{item.instructions}"</span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Preparation inputs */}
                            {(col.id === 'pending' || col.id === 'accepted') && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] uppercase font-bold tracking-wider text-[#4B5563] mb-0.5">Est. Mins</label>
                                  <input
                                    type="number"
                                    placeholder="20"
                                    className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-2.5 py-1 text-xs text-[#111827] focus:outline-none"
                                    value={estTime[order._id] || ''}
                                    onChange={(e) => setEstTime({ ...estTime, [order._id]: parseInt(e.target.value) })}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] uppercase font-bold tracking-wider text-[#4B5563] mb-0.5">Chef Note</label>
                                  <input
                                    type="text"
                                    placeholder="Baking..."
                                    className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-2.5 py-1 text-xs text-[#111827] focus:outline-none"
                                    value={chefNotes[order._id] || ''}
                                    onChange={(e) => setChefNotes({ ...chefNotes, [order._id]: e.target.value })}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 justify-end pt-1">
                              {col.id === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleRejectClick(order)}
                                    className="p-2.5 rounded-xl bg-[#D1D5DB]/10 hover:bg-[#D1D5DB] text-[#D1D5DB] hover:text-white border border-neutral-500/20 transition-colors cursor-pointer"
                                    title="Reject Order"
                                  >
                                    <Ban size={14} />
                                  </button>
                                  
                                  <button
                                    onClick={() => updateStatus(order._id, col.id, 'preparing')}
                                    className="flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#4C1D95] text-white text-xs font-extrabold transition-colors cursor-pointer flex shadow-sm active:scale-[0.98]"
                                  >
                                    <Check size={14} />
                                    <span>Accept & Start Cooking</span>
                                  </button>
                                </>
                              ) : nextCol ? (
                                <button
                                  onClick={() => updateStatus(order._id, col.id, nextCol)}
                                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-[0.98]"
                                >
                                  <Play size={13} />
                                  <span>Move to {columns.find(c => c.id === nextCol)?.name}</span>
                                  <ChevronRight size={13} />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 📦 KITCHEN STOCK & 86 ITEM MANAGER MODAL */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in text-[#111827]">
          <div className="bg-white border border-[#D1D5DB] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#4C1D95] via-[#5B21B6] to-[#4C1D95] text-white p-4 sm:p-5 flex justify-between items-center shadow-md shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                  <Package size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                    <span>Kitchen Stock & 86 Item Control</span>
                    <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                      Live Admin Sync
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-100 font-semibold">
                    Toggle items In/Out of Stock • Instant Live Update to Admin & Customer Menu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-Header / Search & Filter Controls */}
            <div className="p-3.5 sm:p-4 bg-[#F9FAFB] border-b border-[#F3F4F6] space-y-2.5 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                {/* Search */}
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
                  <input
                    type="text"
                    placeholder="Search food item by name or category..."
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl text-xs text-[#111827] outline-none"
                  />
                </div>

                {/* Stock KPI Pills */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-neutral-100 text-[#4C1D95] border border-[#D1D5DB] text-[11px] font-bold">
                    ✓ {products.filter(p => p.inStock).length} In Stock
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-neutral-100 text-[#4C1D95] border border-neutral-300 text-[11px] font-bold">
                    ❌ {outOfStockCount} Out of Stock (86)
                  </span>
                </div>
              </div>

              {/* Category Quick Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {['All', 'OutOfStock', 'InStock', 'Cakes', 'Snacks', 'Juice', 'Chats'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setStockCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      stockCategoryFilter === cat
                        ? 'bg-[#4C1D95] text-white shadow-xs'
                        : 'bg-white border border-[#D1D5DB] text-[#4B5563] hover:text-[#111827]'
                    }`}
                  >
                    {cat === 'OutOfStock' ? '⚠️ Out of Stock (86)' : cat === 'InStock' ? '✅ In Stock Only' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products List Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5 divide-y divide-[#F3F4F6]/60">
              {filteredStockProducts.length === 0 ? (
                <div className="text-center py-10 space-y-2 text-[#4B5563]">
                  <Package size={32} className="mx-auto text-[#D1D5DB]" />
                  <p className="text-xs font-bold">No food items match the search/filter.</p>
                </div>
              ) : (
                filteredStockProducts.map(prod => (
                  <div key={prod._id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-[#D1D5DB] shrink-0 shadow-xs">
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200')} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs sm:text-sm text-[#111827] truncate flex items-center gap-1.5">
                          <span>{prod.name}</span>
                          {!prod.inStock && (
                            <span className="text-[9px] font-black bg-[#4C1D95] text-white px-1.5 py-0.2 rounded uppercase">
                              86 OUT
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-[#4B5563]">
                          <span className="font-semibold">{prod.category}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-[#4C1D95]">₹{prod.price}</span>
                        </div>
                      </div>
                    </div>

                    {/* 1-Tap Toggle Stock Button */}
                    <button
                      onClick={() => handleToggleProductStock(prod)}
                      disabled={togglingStockId === prod._id}
                      className={`px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                        prod.inStock
                          ? 'bg-[#4C1D95] hover:bg-[#4C1D95] text-white'
                          : 'bg-[#4C1D95] hover:bg-[#5B21B6] text-white'
                      }`}
                    >
                      {togglingStockId === prod._id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : prod.inStock ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>In Stock</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          <span>Out of Stock</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-3 bg-[#F9FAFB] border-t border-[#D1D5DB] flex items-center justify-between text-xs font-semibold text-[#4B5563] shrink-0">
              <span>⚡ Live Sync: Changes update Admin Dashboard & Customer Menu instantly.</span>
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#4C1D95] text-white font-extrabold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#D1D5DB] p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl text-[#111827] animate-scale-in">
            <div className="flex items-center gap-2 text-[#4C1D95]">
              <AlertCircle size={20} />
              <h3 className="font-extrabold text-sm">Select Reject Reason</h3>
            </div>
            
            <p className="text-xs text-[#4B5563] font-semibold">
              Choose a reason for rejecting Table {selectedOrder.tableNumber}'s order:
            </p>

            <div className="space-y-2">
              {['Out of Stock', 'Machine Issue', 'Kitchen Busy', 'Ingredient Missing'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  className={`w-full p-3 rounded-2xl border text-left text-xs transition-colors flex justify-between items-center cursor-pointer ${
                    rejectionReason === reason 
                      ? 'bg-[#4C1D95]/10 border-[#4C1D95] text-[#4C1D95] font-extrabold' 
                      : 'bg-[#F9FAFB] border-[#D1D5DB] text-[#111827] hover:bg-white'
                  }`}
                >
                  <span>{reason}</span>
                  {rejectionReason === reason && <Check size={14} />}
                </button>
              ))}
            </div>

            {/* Auto mark out of stock checkbox if reason is Out of Stock */}
            {rejectionReason === 'Out of Stock' && (
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-bold text-[#4C1D95] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMarkItemOutOfStock}
                  onChange={(e) => setAutoMarkItemOutOfStock(e.target.checked)}
                  className="rounded text-[#4C1D95] focus:ring-[#4C1D95]"
                />
                <span>Also mark item as OUT OF STOCK & alert Admin live</span>
              </label>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowRejectModal(false); setSelectedOrder(null); }}
                className="px-4 py-2.5 bg-[#F9FAFB] hover:bg-white text-[#4B5563] border border-[#D1D5DB] rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                className="px-4 py-2.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Reject Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Unsold Food Modal (Chef -> Direct to Admin) */}
      {showUnsoldModal && (
        <div className="fixed inset-0 bg-[#111827]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-rose-500 to-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight">Report Unsold Food</h3>
                  <p className="text-xs text-white/90 font-semibold">Send unsold food count directly to Admin Dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setShowUnsoldModal(false)}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Toggle: Choose Menu Item vs Type Custom Food Name */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsCustomUnsoldFood(false)}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    !isCustomUnsoldFood ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Select Menu Food
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomUnsoldFood(true)}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    isCustomUnsoldFood ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Type Custom Food (e.g. Vada)
                </button>
              </div>

              {!isCustomUnsoldFood ? (
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                    Select Food Item
                  </label>
                  <select
                    value={unsoldProductId}
                    onChange={(e) => setUnsoldProductId(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">-- Choose Food Item --</option>
                    {products.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} (₹{p.price} • {p.category})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                      Food Name
                    </label>
                    <input
                      type="text"
                      value={customUnsoldName}
                      onChange={(e) => setCustomUnsoldName(e.target.value)}
                      placeholder="e.g. Vada, Samosa, Puff..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={customUnsoldPrice}
                      onChange={(e) => setCustomUnsoldPrice(e.target.value)}
                      placeholder="15"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Unsold Quantity + Quick Presets */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Unsold Quantity (Remaining / Not Sold)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={unsoldQtyInput}
                    onChange={(e) => setUnsoldQtyInput(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-32 px-4 py-2.5 rounded-xl border-2 border-rose-300 bg-rose-50/40 text-lg font-black text-rose-700 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20, 25, 30, 50].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUnsoldQtyInput(String(preset))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                          unsoldQtyInput === String(preset)
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Note for Admin (Optional)
                </label>
                <input
                  type="text"
                  value={unsoldNoteInput}
                  onChange={(e) => setUnsoldNoteInput(e.target.value)}
                  placeholder="e.g. Evening batch remaining, Morning leftover..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSendUnsoldReport}
                disabled={sendingUnsold}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Send size={16} />
                {sendingUnsold ? 'Sending to Admin...' : 'Send Unsold Report to Admin'}
              </button>

              {/* Recent Reports List */}
              {unsoldReports.length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      Reported Unsold Items ({unsoldReports.length})
                    </span>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {unsoldReports.map((rep: any) => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-200"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900">{rep.foodName || rep.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white">
                              {rep.unsoldQty} Unsold
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            By {rep.reportedBy || 'Chef'} • {(rep.createdAt || rep.reportedAt) ? new Date(rep.createdAt || rep.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            {rep.note ? ` • "${rep.note}"` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteUnsoldReport(rep.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Remove report"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
