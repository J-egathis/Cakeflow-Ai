import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { orderApi, getSocket } from '../services/api';
import { 
  Play, Check, Ban, Clock, ChevronRight, 
  ChefHat, AlertCircle, RefreshCw, LogOut, Utensils
} from 'lucide-react';

interface ChefViewProps {
  user: { username: string; role: 'cake_chef' | 'snacks_chef' };
  onLogout: () => void;
}

export const ChefView: React.FC<ChefViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('All');
  const tabs = ['All', 'Juice', 'Snacks', 'Cakes', 'Chats'];
  
  // Mobile Column Selector (all | pending | accepted | ready)
  const [mobileColFilter, setMobileColFilter] = useState<string>('all');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  
  // States for modals/notes
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [chefNotes, setChefNotes] = useState<{ [orderId: string]: string }>({});
  const [estTime, setEstTime] = useState<{ [orderId: string]: number }>({});

  const columns = [
    { id: 'pending', name: 'Pending' },
    { id: 'preparing', name: 'Preparing' },
    { id: 'ready', name: 'Ready' }
  ];

  // Fetch orders (showLoading=false for background silent polls)
  const fetchChefOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await orderApi.getAll();
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

  useEffect(() => {
    fetchChefOrders(true);

    const socket = getSocket();
    socket.emit('join_room', 'cake_kitchen');
    socket.emit('join_room', 'snacks_kitchen');

    const handleNewOrder = () => {
      fetchChefOrders(false);
      playKitchenNotificationSound();
    };

    socket.on('new_order', handleNewOrder);
    socket.on('new_kitchen_items', handleNewOrder);
    socket.on('order_updated', () => fetchChefOrders(false));
    socket.on('table_status_updated', () => fetchChefOrders(false));

    // Silent background poll every 4s for instant kitchen auto-refresh
    const intervalId = setInterval(() => fetchChefOrders(false), 4000);

    return () => {
      clearInterval(intervalId);
      socket.emit('leave_room', 'cake_kitchen');
      socket.emit('leave_room', 'snacks_kitchen');
      socket.off('new_order', handleNewOrder);
      socket.off('new_kitchen_items', handleNewOrder);
      socket.off('order_updated');
      socket.off('table_status_updated');
    };
  }, []);

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
    try {
      const notes = chefNotes[orderId] || '';
      const estimatedMinutes = estTime[orderId] || 20;
      
      const estimatedTime = new Date();
      estimatedTime.setMinutes(estimatedTime.getMinutes() + Number(estimatedMinutes));

      const order = orders.find(o => o._id === orderId);
      if (!order) return;

      const itemsToUpdate = order.items
        .filter(item => itemMatchesTab(item, activeTab) && isItemInColumn(item, fromColId))
        .map(item => ({
          itemId: item._id,
          status: nextStatus
        }));

      await orderApi.update(orderId, {
        status: undefined, // Let backend calculate overall order status from item statuses
        chefNotes: notes || undefined,
        estimatedCompletionTime: nextStatus === 'accepted' ? estimatedTime.toISOString() : undefined,
        items: itemsToUpdate,
        ...extras
      });
      fetchChefOrders();
    } catch (err) {
      alert('Failed to update status: ' + err);
    }
  };

  const handleRejectClick = (order: Order) => {
    setSelectedOrder(order);
    setRejectionReason('Out of Stock');
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!selectedOrder) return;
    try {
      await orderApi.update(selectedOrder._id, {
        status: 'cancelled',
        rejectionReason: rejectionReason
      });
      setShowRejectModal(false);
      setSelectedOrder(null);
      fetchChefOrders();
    } catch (err) {
      alert('Failed to reject order: ' + err);
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

  return (
    <div id="chefPage" data-testid="chefPage" className="min-h-screen md:h-screen md:max-h-screen bg-[#F7F5F2] text-[#1E1818] flex flex-col relative overflow-x-hidden">
      {/* Header */}
      <header id="chefHeader" data-testid="chefHeader" className="bg-white/95 backdrop-blur-md border-b border-[#D0C0C0] px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between z-10 shrink-0 gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
              <ChefHat size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base md:text-lg tracking-tight text-[#CD0D0D]">
                  Chef Kitchen
                </h1>
                <span className="text-[9px] font-extrabold bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/20 px-2 py-0.5 rounded-full">
                  Live Board
                </span>
              </div>
              <p className="text-[10px] md:text-xs text-[#6E6262] font-semibold">Real-Time Kitchen Operations</p>
            </div>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={() => fetchChefOrders(true)}
              className="p-2 rounded-xl bg-white border border-[#D0C0C0] text-[#6E6262] hover:text-[#CD0D0D] transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onLogout}
              className="p-2 rounded-xl bg-white border border-[#D0C0C0] text-[#6E6262] hover:text-[#CD0D0D] transition-colors cursor-pointer shadow-sm"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Category Tabs & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          {/* Mobile Category Tabs */}
          <div className="flex bg-[#FAF8F8] border border-[#D0C0C0] p-1 rounded-xl overflow-x-auto scrollbar-none max-w-full">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#CD0D0D] text-white shadow-sm'
                    : 'text-[#6E6262] hover:text-[#1E1818]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 border-l border-[#D0C0C0] pl-4">
            <button 
              onClick={() => fetchChefOrders(true)}
              className="p-2 rounded-xl bg-white border border-[#D0C0C0] text-[#6E6262] hover:text-[#CD0D0D] transition-colors cursor-pointer shadow-sm"
              title="Refresh Board"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            
            <button 
              onClick={onLogout}
              className="text-xs text-[#6E6262] hover:text-[#CD0D0D] bg-white border border-[#D0C0C0] px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Column Quick Switcher */}
        <div className="flex md:hidden bg-white border border-[#D0C0C0] p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setMobileColFilter('all')}
            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-extrabold text-center transition-all ${
              mobileColFilter === 'all' ? 'bg-[#CD0D0D] text-white' : 'text-[#6E6262]'
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
                  mobileColFilter === c.id ? 'bg-[#CD0D0D] text-white' : 'text-[#6E6262]'
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
          <div className="w-full h-64 flex flex-col items-center justify-center text-[#6E6262] space-y-3">
            <RefreshCw size={36} className="animate-spin text-[#CD0D0D]" />
            <p className="text-xs font-bold">Fetching kitchen tickets...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full h-full pb-6 md:pb-0">
            {visibleColumns.map((col) => {
              const colOrders = getOrdersInColumn(col.id);

              return (
                <div 
                  key={col.id} 
                  className="bg-white border border-[#D0C0C0] p-3.5 md:p-4 rounded-3xl flex flex-col min-h-[380px] md:h-[calc(100vh-140px)] shadow-sm overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#E8E0E0] shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        col.id === 'pending' ? 'bg-amber-500 animate-ping' :
                        col.id === 'accepted' ? 'bg-sky-500' :
                        col.id === 'ready' ? 'bg-emerald-500' : 'bg-[#CD0D0D]'
                      }`} />
                      <h3 className="font-extrabold text-xs text-[#1E1818] uppercase tracking-wider">{col.name}</h3>
                    </div>
                    <span className="text-[10px] font-black bg-[#FAF8F8] border border-[#D0C0C0] text-[#CD0D0D] px-2.5 py-0.5 rounded-full">
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Column Body */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {colOrders.length === 0 ? (
                      <div className="h-40 md:h-full flex items-center justify-center border border-dashed border-[#D0C0C0] rounded-2xl text-xs text-[#6E6262] font-semibold">
                        No orders in {col.name}
                      </div>
                    ) : (
                      colOrders.map(order => {
                        const colItems = order.items.filter(item => itemMatchesTab(item, activeTab) && isItemInColumn(item, col.id));
                        const nextCol = getNextColumnId(col.id);

                        return (
                          <div 
                            key={`${order._id}-${col.id}`} 
                            className="bg-[#FAF8F8] border border-[#D0C0C0] hover:border-[#CD0D0D] p-3.5 rounded-2xl space-y-3 transition-all shadow-sm group"
                          >
                            {/* Order Header */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-black text-[#CD0D0D]">
                                  TABLE {order.tableNumber} - {order.customerName}
                                </h4>
                                <p className="text-[10px] text-[#6E6262] font-mono mt-0.5">Order #{order._id.slice(-4)}</p>
                              </div>
                              <span className="text-[10px] text-[#6E6262] font-semibold flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-[#D0C0C0]">
                                <Clock size={10} className="text-[#CD0D0D]" />
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Items List grouped by Order Round / Batch */}
                            {(() => {
                              const roundsMap: { [r: number]: typeof colItems } = {};
                              colItems.forEach(item => {
                                const r = (item as any).round || 1;
                                if (!roundsMap[r]) roundsMap[r] = [];
                                roundsMap[r].push(item);
                              });
                              const roundNumbers = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

                              return (
                                <div className="bg-white p-2.5 rounded-xl border border-[#E8E0E0] space-y-2.5">
                                  {roundNumbers.map(rNum => (
                                    <div key={rNum} className="space-y-1.5 border-b border-[#E8E0E0]/60 last:border-b-0 pb-2 last:pb-0">
                                      {roundNumbers.length > 1 && (
                                        <div className="flex items-center justify-between bg-[#FAF8F8] px-2 py-0.5 rounded border border-[#E8E0E0]">
                                          <span className="text-[10px] font-black text-[#CD0D0D]">
                                            🔔 Order Round #{rNum}
                                          </span>
                                          <span className="text-[9px] font-bold text-[#6E6262]">
                                            {rNum === 1 ? 'First Batch' : `Add-on Batch #${rNum - 1}`}
                                          </span>
                                        </div>
                                      )}
                                      {roundsMap[rNum].map(item => (
                                        <div key={item._id} className="text-xs space-y-1">
                                          <div className="flex justify-between items-center">
                                            <span className="font-bold text-[#1E1818] text-[11px]">
                                              {(item.product as any)?.name || (item as any)?.name || 'Food Item'}
                                            </span>
                                            <span className="text-[#CD0D0D] font-extrabold bg-[#CD0D0D]/10 px-2 py-0.5 rounded text-[10px]">x{item.quantity}</span>
                                          </div>
                                          {item.instructions && (
                                            <div className="text-[10px] font-black text-[#CD0D0D] bg-[#CD0D0D]/10 border border-[#CD0D0D]/30 px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
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
                                  <label className="block text-[9px] uppercase font-bold tracking-wider text-[#6E6262] mb-0.5">Est. Mins</label>
                                  <input
                                    type="number"
                                    placeholder="20"
                                    className="w-full bg-white border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-2.5 py-1 text-xs text-[#1E1818] focus:outline-none"
                                    value={estTime[order._id] || ''}
                                    onChange={(e) => setEstTime({ ...estTime, [order._id]: parseInt(e.target.value) })}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] uppercase font-bold tracking-wider text-[#6E6262] mb-0.5">Chef Note</label>
                                  <input
                                    type="text"
                                    placeholder="Baking..."
                                    className="w-full bg-white border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-2.5 py-1 text-xs text-[#1E1818] focus:outline-none"
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
                                    className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-colors cursor-pointer"
                                    title="Reject Order"
                                  >
                                    <Ban size={14} />
                                  </button>
                                  
                                  <button
                                    onClick={() => updateStatus(order._id, col.id, 'preparing')}
                                    className="flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold transition-colors cursor-pointer flex shadow-sm active:scale-[0.98]"
                                  >
                                    <Check size={14} />
                                    <span>Accept & Start Cooking</span>
                                  </button>
                                </>
                              ) : nextCol ? (
                                <button
                                  onClick={() => updateStatus(order._id, col.id, nextCol)}
                                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#CD0D0D] hover:bg-[#A60A0A] text-white text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-[0.98]"
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

      {/* Rejection Modal */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl text-[#1E1818]">
            <div className="flex items-center gap-2 text-[#CD0D0D]">
              <AlertCircle size={20} />
              <h3 className="font-extrabold text-sm">Select Reject Reason</h3>
            </div>
            
            <p className="text-xs text-[#6E6262] font-semibold">
              Choose a reason for rejecting Table {selectedOrder.tableNumber}'s order:
            </p>

            <div className="space-y-2">
              {['Out of Stock', 'Machine Issue', 'Kitchen Busy', 'Ingredient Missing'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  className={`w-full p-3 rounded-2xl border text-left text-xs transition-colors flex justify-between items-center cursor-pointer ${
                    rejectionReason === reason 
                      ? 'bg-[#CD0D0D]/10 border-[#CD0D0D] text-[#CD0D0D] font-extrabold' 
                      : 'bg-[#FAF8F8] border-[#D0C0C0] text-[#1E1818] hover:bg-white'
                  }`}
                >
                  <span>{reason}</span>
                  {rejectionReason === reason && <Check size={14} />}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowRejectModal(false); setSelectedOrder(null); }}
                className="px-4 py-2.5 bg-[#FAF8F8] hover:bg-white text-[#6E6262] border border-[#D0C0C0] rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                className="px-4 py-2.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Reject Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
