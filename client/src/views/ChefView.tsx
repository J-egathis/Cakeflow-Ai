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
  const [activeKitchen, setActiveKitchen] = useState<'cake_chef' | 'snacks_chef'>(user.role || 'cake_chef');
  
  const isCakeKitchen = activeKitchen === 'cake_chef';
  const categoryFilter = isCakeKitchen ? 'Cake' : 'Snack';
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  
  // States for modals/notes
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [chefNotes, setChefNotes] = useState<{ [orderId: string]: string }>({});
  const [estTime, setEstTime] = useState<{ [orderId: string]: number }>({});

  const columns = isCakeKitchen ? [
    { id: 'pending', name: 'Pending' },
    { id: 'accepted', name: 'Accepted' },
    { id: 'preparing', name: 'Preparing' },
    { id: 'decorating', name: 'Decorating' },
    { id: 'quality_check', name: 'Quality Check' },
    { id: 'ready', name: 'Ready' }
  ] : [
    { id: 'pending', name: 'Pending' },
    { id: 'accepted', name: 'Accepted' },
    { id: 'preparing', name: 'Preparing' },
    { id: 'quality_check', name: 'Quality Check' },
    { id: 'ready', name: 'Ready' },
    { id: 'summary', name: 'Kitchen Summary' }
  ];

  // Fetch orders matching this chef's category
  const fetchChefOrders = async () => {
    setLoading(true);
    try {
      const data = await orderApi.getAll({ category: categoryFilter });
      // Filter out delivered or cancelled orders to keep dashboard clean
      const activeOrders = data.filter((order: Order) => 
        order.status !== 'served' && order.status !== 'cancelled'
      );
      setOrders(activeOrders);
    } catch (err) {
      console.error('Failed to load chef orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChefOrders();

    // Sockets setup
    const socket = getSocket();
    const roomName = isCakeKitchen ? 'cake_kitchen' : 'snacks_kitchen';
    socket.emit('join_room', roomName);

    // Listen for new orders
    socket.on('new_kitchen_items', () => {
      fetchChefOrders();
      playKitchenNotificationSound();
    });

    // Listen for general order updates
    socket.on('order_updated', () => {
      fetchChefOrders();
    });

    return () => {
      socket.emit('leave_room', roomName);
      socket.off('new_kitchen_items');
      socket.off('order_updated');
    };
  }, [activeKitchen]);

  const playKitchenNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      
      osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.2); // A4
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Context block', e);
    }
  };

  // Move order step
  const updateStatus = async (orderId: string, nextStatus: string, extras = {}) => {
    try {
      const notes = chefNotes[orderId] || '';
      const estimatedMinutes = estTime[orderId] || 20;
      
      const estimatedTime = new Date();
      estimatedTime.setMinutes(estimatedTime.getMinutes() + Number(estimatedMinutes));

      const order = orders.find(o => o._id === orderId);
      if (!order) return;

      const itemsToUpdate = order.items
        .filter(item => item.category === categoryFilter)
        .map(item => ({
          itemId: item._id,
          status: nextStatus
        }));

      await orderApi.update(orderId, {
        status: nextStatus === 'ready' ? undefined : nextStatus,
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

  const getOrdersInColumn = (colId: string) => {
    if (colId === 'summary') return [];
    return orders.filter(order => {
      const domainItems = order.items.filter(item => item.category === categoryFilter);
      if (domainItems.length === 0) return false;
      
      if (colId === 'pending') {
        return domainItems.some(i => i.status === 'pending');
      }
      
      return domainItems.some(i => i.status === colId);
    });
  };

  const getNextColumnId = (current: string) => {
    const idx = columns.findIndex(c => c.id === current);
    if (idx !== -1 && idx < columns.length - 1 && columns[idx + 1].id !== 'summary') {
      return columns[idx + 1].id;
    }
    return '';
  };

  return (
    <div className="h-screen max-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md cursor-pointer">
            <ChefHat size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight text-slate-100">
                {isCakeKitchen ? 'Cake Chef Kitchen' : 'Snacks Chef Kitchen'}
              </h1>
              <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full cursor-pointer">
                Single Page Board (3x2 Grid)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Real-time Order Preparation Board</p>
          </div>
        </div>

        {/* Kitchen Switcher & Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Switcher */}
          <div className="flex bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveKitchen('cake_chef')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isCakeKitchen
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ChefHat size={13} />
              <span>Cake Chef</span>
            </button>
            <button
              onClick={() => setActiveKitchen('snacks_chef')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                !isCakeKitchen
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Utensils size={13} />
              <span>Snacks Chef</span>
            </button>
          </div>

          <button 
            onClick={fetchChefOrders}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh Board"
          >
            <RefreshCw size={15} />
          </button>
          
          <button 
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-rose-400 bg-slate-800/35 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Single Page 3x2 Grid Container without page scrollbar */}
      <main className="flex-1 p-4 z-10 max-w-7xl mx-auto w-full overflow-hidden select-none flex flex-col justify-between">
        {loading && orders.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <RefreshCw size={36} className="animate-spin text-rose-500" />
            <p className="text-sm">Fetching chef orders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full h-full">
            {columns.map((col, idx) => {
              const colOrders = getOrdersInColumn(col.id);

              if (col.id === 'summary') {
                return (
                  <div key="summary" className="bg-slate-900/30 border border-slate-800/50 p-3.5 rounded-2xl flex flex-col justify-between h-[calc(43vh-15px)] backdrop-blur-md">
                    <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <h3 className="font-bold text-sm text-slate-200">Kitchen Summary</h3>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full cursor-pointer">
                        Active
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 p-2">
                      <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
                        <ChefHat size={28} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Snacks Kitchen Status</h4>
                        <p className="text-[10px] text-slate-400 mt-1">All {orders.length} active snack orders loaded cleanly.</p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={col.id} 
                  className="bg-slate-900/40 border border-slate-800/60 p-3.5 rounded-2xl flex flex-col h-[calc(43vh-15px)] backdrop-blur-md transition-all hover:border-slate-700/80 overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-800/50 shrink-0">
                    <div className="flex items-center gap-2 cursor-pointer">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        col.id === 'pending' ? 'bg-amber-400 animate-ping' :
                        col.id === 'accepted' ? 'bg-blue-400' :
                        col.id === 'preparing' ? 'bg-purple-400' :
                        col.id === 'ready' ? 'bg-emerald-400' : 'bg-pink-400'
                      }`} />
                      <h3 className="font-bold text-xs text-slate-200">{col.name}</h3>
                      {idx < 3 ? (
                        <span className="text-[8px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded cursor-pointer">
                          Row 1
                        </span>
                      ) : (
                        <span className="text-[8px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded cursor-pointer">
                          Row 2
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full cursor-pointer">
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Column Body with single vibrant scrollbar */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5">
                    {colOrders.length === 0 ? (
                      <div className="h-full flex items-center justify-center border border-dashed border-slate-800/50 rounded-xl text-[10px] text-slate-500">
                        No orders in {col.name}
                      </div>
                    ) : (
                      colOrders.map(order => {
                        const domainItems = order.items.filter(item => item.category === categoryFilter);
                        const displayStatus = domainItems[0]?.status || 'pending';
                        const nextCol = getNextColumnId(displayStatus);

                        return (
                          <div 
                            key={order._id} 
                            className="bg-slate-950/70 border border-slate-800 hover:border-rose-500/40 p-3 rounded-xl space-y-2.5 transition-all shadow-md cursor-pointer group"
                          >
                            {/* Order Header */}
                            <div className="flex justify-between items-start">
                              <div className="cursor-pointer">
                                <h4 className="text-xs font-extrabold text-rose-400 group-hover:text-rose-300 transition-colors">
                                  T{order.tableNumber} - {order.customerName}
                                </h4>
                                <p className="text-[9px] text-slate-500 mt-0.5">Order #{order._id.slice(-4)}</p>
                              </div>
                              <span className="text-[9px] text-slate-400 flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 cursor-pointer">
                                <Clock size={9} />
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Items List */}
                            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 space-y-1 cursor-pointer">
                              {domainItems.map(item => (
                                <div key={item._id} className="text-xs cursor-pointer">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold text-slate-200 text-[11px]">{item.product?.name}</span>
                                    <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded text-[9px]">x{item.quantity}</span>
                                  </div>
                                  {item.instructions && (
                                    <p className="text-[9px] text-amber-400/90 italic mt-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                      "{item.instructions}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Preparation inputs */}
                            {(displayStatus === 'pending' || displayStatus === 'accepted') && (
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[8px] uppercase font-bold tracking-wider text-slate-400 mb-0.5 cursor-pointer">Est. Mins</label>
                                  <input
                                    type="number"
                                    placeholder="20"
                                    className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none cursor-text"
                                    value={estTime[order._id] || ''}
                                    onChange={(e) => setEstTime({ ...estTime, [order._id]: parseInt(e.target.value) })}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] uppercase font-bold tracking-wider text-slate-400 mb-0.5 cursor-pointer">Chef Note</label>
                                  <input
                                    type="text"
                                    placeholder="Baking..."
                                    className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none cursor-text"
                                    value={chefNotes[order._id] || ''}
                                    onChange={(e) => setChefNotes({ ...chefNotes, [order._id]: e.target.value })}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-1.5 justify-end pt-0.5">
                              {displayStatus === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleRejectClick(order)}
                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-colors cursor-pointer"
                                    title="Reject Order"
                                  >
                                    <Ban size={12} />
                                  </button>
                                  
                                  <button
                                    onClick={() => updateStatus(order._id, 'accepted')}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    <Check size={12} />
                                    <span>Accept</span>
                                  </button>
                                </>
                              ) : nextCol ? (
                                <button
                                  onClick={() => updateStatus(order._id, nextCol)}
                                  className="w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white text-[11px] font-bold transition-all shadow cursor-pointer"
                                >
                                  <Play size={11} />
                                  <span>Move to {columns.find(c => c.id === nextCol)?.name}</span>
                                  <ChevronRight size={11} />
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              <h3 className="font-bold text-md">Select Reject Reason</h3>
            </div>
            
            <p className="text-xs text-slate-400 cursor-pointer">
              Please choose a reason for rejecting Table {selectedOrder.tableNumber}'s order:
            </p>

            <div className="space-y-2">
              {['Out of Stock', 'Machine Issue', 'Kitchen Busy', 'Ingredient Missing'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  className={`w-full p-3 rounded-xl border text-left text-xs transition-colors flex justify-between items-center cursor-pointer ${
                    rejectionReason === reason 
                      ? 'bg-red-500/10 border-red-500/40 text-red-400 font-semibold' 
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900'
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
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
