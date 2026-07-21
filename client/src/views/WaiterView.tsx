import React, { useState, useEffect } from 'react';
import { Order, Product } from '../types';
import { orderApi, productApi, getSocket } from '../services/api';
import { 
  Users, DollarSign, Clock, CheckCircle, AlertCircle, 
  ChevronRight, Plus, HelpCircle, Utensils, Printer, LogOut, RefreshCw 
} from 'lucide-react';

interface WaiterViewProps {
  user: { username: string };
  onLogout: () => void;
}

export const WaiterView: React.FC<WaiterViewProps> = ({ user, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  
  // States for taking/modifying orders
  const [activeTable, setActiveTable] = useState<number | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [modalCustomerName, setModalCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ [productId: string]: number }>({});
  const [specialInstructions, setSpecialInstructions] = useState<{ [productId: string]: string }>({});

  const fetchWaiterData = async () => {
    setLoading(true);
    try {
      const ordersData = await orderApi.getAll();
      // Keep active (non-delivered or unpaid) orders
      setOrders(ordersData);
      const productsData = await productApi.getAll();
      setProducts(productsData.filter((p: Product) => p.inStock));
    } catch (err) {
      console.error('Failed to load waiter data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaiterData();

    // Sockets setup
    const socket = getSocket();
    socket.emit('join_room', 'waiters');

    socket.on('new_order', () => {
      fetchWaiterData();
    });

    socket.on('order_updated', () => {
      fetchWaiterData();
    });

    return () => {
      socket.emit('leave_room', 'waiters');
      socket.off('new_order');
      socket.off('order_updated');
    };
  }, []);

  // Map 1-6 tables to active orders
  const getTableInfo = (tableNum: number) => {
    // An active order is one that is unpaid or not served
    const activeOrder = orders.find(o => o.tableNumber === tableNum && (o.status !== 'served' || o.paymentStatus === 'unpaid'));
    return activeOrder || null;
  };

  // Serve food
  const handleServe = async (orderId: string) => {
    try {
      await orderApi.update(orderId, { status: 'served' });
      fetchWaiterData();
    } catch (err) {
      alert('Failed to serve food: ' + err);
    }
  };

  // Close table
  const handleCloseTable = async (orderId: string) => {
    try {
      await orderApi.closeTable(orderId);
      fetchWaiterData();
    } catch (err) {
      alert('Failed to close table: ' + err);
    }
  };

  // Place order from modal
  const handlePlaceModalOrder = async () => {
    if (!activeTable) return;
    try {
      const itemsToOrder = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([prodId, qty]) => ({
          productId: prodId,
          quantity: qty,
          instructions: specialInstructions[prodId] || ''
        }));

      if (itemsToOrder.length === 0) {
        alert('Please select at least one item');
        return;
      }

      // Calculate total
      const totalAmount = itemsToOrder.reduce((sum, item) => {
        const product = products.find(p => p._id === item.productId);
        if (!product) return sum;
        const price = product.isOffer && product.discountPrice ? product.discountPrice : product.price;
        return sum + (price * item.quantity);
      }, 0);

      await orderApi.create({
        tableNumber: activeTable,
        customerName: modalCustomerName || `Table ${activeTable} Guest`,
        items: itemsToOrder,
        totalAmount
      });

      setShowOrderModal(false);
      setSelectedItems({});
      setSpecialInstructions({});
      setModalCustomerName('');
      fetchWaiterData();
    } catch (err) {
      alert('Failed to place order: ' + err);
    }
  };

  const updateItemQty = (prodId: string, val: number) => {
    setSelectedItems(prev => {
      const current = prev[prodId] || 0;
      const next = current + val;
      return { ...prev, [prodId]: Math.max(0, next) };
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      {/* Background gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-rose-500 text-white shadow-md">
            <Utensils size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">
              Waiter Service Floor
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Table Status and Ordering Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchWaiterData}
            className="p-2 rounded-xl bg-slate-800/85 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          
          <button 
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-rose-400 bg-slate-800/35 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Interactive Floor Layout */}
      <main className="max-w-5xl w-full mx-auto p-6 z-10 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <h3 className="font-bold text-md text-slate-200">Table Overview</h3>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">6 Total Tables</span>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(num => {
            const order = getTableInfo(num);
            const isOccupied = !!order;
            const isReady = order?.status === 'ready';

            return (
              <div 
                key={num}
                className={`p-6 rounded-3xl border backdrop-blur-md transition-all flex flex-col justify-between space-y-5 relative overflow-hidden group ${
                  isReady 
                    ? 'bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/5' 
                    : isOccupied 
                      ? 'bg-indigo-500/5 border-indigo-500/30' 
                      : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                {/* Flashing Ready Glow */}
                {isReady && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 blur-md rounded-full -mr-4 -mt-4 animate-pulse pointer-events-none" />
                )}

                {/* Table Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-slate-100 tracking-tight">Table {num}</h3>
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold">
                      <span className={`h-1.5 w-1.5 rounded-full ${isOccupied ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                      <span className={isOccupied ? 'text-indigo-400' : 'text-slate-500'}>
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </div>
                  </div>

                  {isReady && (
                    <span className="text-[9px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full animate-bounce">
                      Ready
                    </span>
                  )}
                </div>

                {/* Table details */}
                {order ? (
                  <div className="space-y-2 text-xs border-t border-b border-slate-900 py-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1"><Users size={12} /> Customer</span>
                      <span className="font-semibold text-slate-200">{order.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1"><DollarSign size={12} /> Current Bill</span>
                      <span className="font-bold text-rose-400">₹{order.totalAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1"><Clock size={12} /> Status</span>
                      <span className="font-semibold text-amber-400 capitalize">{order.status}</span>
                    </div>
                    
                    {/* Items preparation breakdown */}
                    <div className="mt-2 pt-2 border-t border-slate-900/60">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Cooking details</p>
                      <div className="mt-1 space-y-0.5">
                        {order.items.map(item => (
                          <div key={item._id} className="flex justify-between text-[10px]">
                            <span className="text-slate-350 truncate max-w-[140px]">{item.product?.name}</span>
                            <span className={`font-semibold ${
                              item.status === 'ready' ? 'text-emerald-400' :
                              item.status === 'preparing' ? 'text-purple-400' : 'text-slate-500'
                            }`}>{item.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-28 flex items-center justify-center border border-dashed border-slate-800/80 rounded-2xl text-[10px] text-slate-600">
                    No active bills or guests.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {order ? (
                    <>
                      {order.status !== 'served' && (
                        <button
                          onClick={() => handleServe(order._id)}
                          className="flex-1 py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-md"
                        >
                          Serve Food
                        </button>
                      )}
                      
                      {order.paymentStatus === 'unpaid' && (
                        <button
                          onClick={() => handleCloseTable(order._id)}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700/50"
                        >
                          Close Table
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => { setActiveTable(num); setShowOrderModal(true); }}
                      className="w-full py-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl border border-slate-850 hover:border-slate-750 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} />
                      <span>Take Order</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Place Order Modal */}
      {showOrderModal && activeTable && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-850">
              <h3 className="font-bold text-md text-slate-100">Take Order - Table {activeTable}</h3>
              <button 
                onClick={() => { setShowOrderModal(false); setSelectedItems({}); }}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Close
              </button>
            </div>

            {/* Customer name */}
            <div className="mb-4">
              <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wide mb-1.5">Customer Name</label>
              <input 
                type="text" 
                placeholder="e.g. Clark Devil"
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-200"
                value={modalCustomerName}
                onChange={(e) => setModalCustomerName(e.target.value)}
              />
            </div>

            {/* Menu scroll area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {products.map(p => {
                const qty = selectedItems[p._id] || 0;
                return (
                  <div key={p._id} className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-850 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} className="w-10 h-10 object-cover rounded-lg bg-slate-800" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{p.name}</h4>
                        <p className="text-[10px] text-rose-400 font-semibold mt-0.5">₹{p.price}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {qty > 0 && (
                        <input 
                          type="text" 
                          placeholder="Special instructions..."
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[9px] w-28 text-slate-350 focus:outline-none focus:border-rose-500"
                          value={specialInstructions[p._id] || ''}
                          onChange={(e) => setSpecialInstructions({ ...specialInstructions, [p._id]: e.target.value })}
                        />
                      )}
                      
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
                        <button 
                          onClick={() => updateItemQty(p._id, -1)}
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{qty}</span>
                        <button 
                          onClick={() => updateItemQty(p._id, 1)}
                          className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-850 flex justify-end gap-2">
              <button
                onClick={() => { setShowOrderModal(false); setSelectedItems({}); }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-850/80 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceModalOrder}
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white rounded-xl text-xs font-bold"
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
