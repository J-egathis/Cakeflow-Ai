import React, { useState, useEffect } from 'react';
import { Product, Order, OrderItem } from '../types';
import { productApi, orderApi, getSocket, BASE_URL } from '../services/api';
import { 
  Search, ShoppingBag, Clock, Heart, Minus, Plus, 
  Send, Sparkles, AlertTriangle, CheckCircle, ChefHat, 
  Coffee, HelpCircle, AlertCircle, ShoppingCart 
} from 'lucide-react';

interface CustomerViewProps {
  user: { username: string; id: string; tableNumber?: number };
  onLogout: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  instructions: string;
}

export const CustomerView: React.FC<CustomerViewProps> = ({ user, onLogout }) => {
  const tableNum = user.tableNumber || parseInt(user.id.replace(/\D/g, '')) || 1;
  const [currentTable, setCurrentTable] = useState(tableNum);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState<{[key: string]: string}>({});

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [aiCombos, setAiCombos] = useState<any[]>([]);
  const [aiPrepTime, setAiPrepTime] = useState<number>(15);

  const categories = [
    'All',
    'Birthday Cakes',
    'Wedding Cakes',
    'Cup Cakes',
    'Pastries',
    'Brownies',
    'Cookies',
    'Veg Snacks',
    'Non-Veg Snacks',
    'Hot Drinks',
    'Cold Drinks',
    'Combos'
  ];

  // Fetch products and active order
  useEffect(() => {
    fetchProducts();
    fetchActiveOrder();
    fetchAIRecommendation();

    // Sockets setup
    const socket = getSocket();
    socket.emit('join_room', `table_${currentTable}`);

    socket.on('order_status_changed', (updatedOrder: Order) => {
      if (updatedOrder.tableNumber === currentTable) {
        setActiveOrder(updatedOrder);
        playStatusSound(updatedOrder.status);
      }
    });

    return () => {
      socket.emit('leave_room', `table_${currentTable}`);
      socket.off('order_status_changed');
    };
  }, [currentTable]);

  const fetchProducts = async () => {
    try {
      const data = await productApi.getAll();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load menu:', err);
    }
  };

  const fetchActiveOrder = async () => {
    try {
      const data = await orderApi.getTableActiveOrders(currentTable);
      if (data && data.length > 0) {
        // Get the latest active order
        setActiveOrder(data[0]);
      } else {
        setActiveOrder(null);
      }
    } catch (err) {
      console.error('Failed to load active orders:', err);
    }
  };

  const fetchAIRecommendation = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/analytics/ai-forecasts`);
      const data = await res.json();
      if (data) {
        setAiCombos(data.smartCombos || []);
        // Determine AI Prep Time based on cart / general
        setAiPrepTime(data.aiPrepTimes ? data.aiPrepTimes.Cake : 20);
      }
    } catch (e) {
      console.error('Failed to load AI combos', e);
    }
  };

  const playStatusSound = (status: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (status === 'cancelled') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      } else if (status === 'served' || status === 'ready') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } else {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      }
    } catch (e) {
      console.log('Audio Context block', e);
    }
  };

  // Add to cart
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        return prev.map(item => 
          item.product._id === product._id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1, instructions: '' }];
    });
  };

  const updateQuantity = (productId: string, val: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product._id === productId) {
          const newQty = item.quantity + val;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const updateInstructions = (productId: string, notes: string) => {
    setSpecialInstructions(prev => ({ ...prev, [productId]: notes }));
    setCart(prev => 
      prev.map(item => 
        item.product._id === productId 
          ? { ...item, instructions: notes } 
          : item
      )
    );
  };

  // Calculate cart total
  const getCartTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const orderItems = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity,
        instructions: item.instructions
      }));

      const newOrder = await orderApi.create({
        tableNumber: currentTable,
        customerName: `Table ${currentTable} Guest`,
        items: orderItems,
        totalAmount: getCartTotal()
      });

      setActiveOrder(newOrder);
      setCart([]);
      setShowCart(false);
      playStatusSound('pending');
    } catch (err) {
      alert('Failed to place order: ' + err);
    }
  };

  // Filter items
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Timeline preparation tracker mapping
  const orderTrackerSteps = [
    { label: 'Order Received', status: 'pending', percent: 10 },
    { label: 'Chef Accepted', status: 'accepted', percent: 25 },
    { label: 'Ingredients Ready', status: 'preparing_prep', percent: 40 },
    { label: 'Baking & Preparing', status: 'preparing', percent: 60 },
    { label: 'Decorating', status: 'decorating', percent: 75 },
    { label: 'Quality Check', status: 'quality_check', percent: 85 },
    { label: 'Ready', status: 'ready', percent: 95 },
    { label: 'Served', status: 'served', percent: 100 }
  ];

  const getTrackerProgress = () => {
    if (!activeOrder) return 0;
    
    // Check if rejected/cancelled
    if (activeOrder.status === 'cancelled') return 0;

    // Check individual items to refine steps
    const anyPreparing = activeOrder.items.some(i => i.status === 'preparing');
    const anyDecorating = activeOrder.items.some(i => i.status === 'decorating');
    const anyQualityCheck = activeOrder.items.some(i => i.status === 'quality_check');

    if (activeOrder.status === 'served') return 100;
    if (activeOrder.status === 'ready') return 95;
    if (anyQualityCheck) return 85;
    if (anyDecorating) return 75;
    if (anyPreparing) return 60;
    if (activeOrder.status === 'preparing') return 50;
    if (activeOrder.status === 'accepted') return 25;
    
    return 10;
  };

  const getActiveStepLabel = () => {
    if (!activeOrder) return '';
    if (activeOrder.status === 'cancelled') return 'Cancelled';
    if (activeOrder.status === 'served') return 'Served';
    if (activeOrder.status === 'ready') return 'Ready to Serve!';
    
    const anyQuality = activeOrder.items.some(i => i.status === 'quality_check');
    const anyDecorating = activeOrder.items.some(i => i.status === 'decorating');
    const anyPreparing = activeOrder.items.some(i => i.status === 'preparing');

    if (anyQuality) return 'Chef Performing Quality Check';
    if (anyDecorating) return 'Cake Decorator Sculpting Drizzle';
    if (anyPreparing) return 'Baking & Preparing in Kitchen';
    if (activeOrder.status === 'preparing') return 'Cooking Started';
    if (activeOrder.status === 'accepted') return 'Chef Accepted Order';
    
    return 'Pending Review';
  };

  const currentPercent = getTrackerProgress();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 relative">
      {/* Header */}
      <header className="sticky top-0 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md">
            <Coffee size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-amber-400">
              CakeFlow AI
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Table</span>
              <select 
                value={currentTable} 
                onChange={(e) => setCurrentTable(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-rose-400 focus:outline-none"
              >
                {[1,2,3,4,5,6].map(num => (
                  <option key={num} value={num}>T{num}</option>
                ))}
              </select>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] text-emerald-400">Live Connection</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCart(true)} 
            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 hover:text-white transition-colors relative"
          >
            <ShoppingBag size={18} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-bounce">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
          
          <button 
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-rose-400 bg-slate-800/30 px-3 py-1.5 rounded-lg border border-slate-800/80"
          >
            Exit Table
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto p-4 flex-1 space-y-6">
        {/* Active Order Live Tracker */}
        {activeOrder && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl shadow-xl space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-rose-400">Live Order Status</span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">Order #{activeOrder._id.slice(-4)}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Est. Ready in: ~{aiPrepTime} mins</p>
              </div>

              {activeOrder.status === 'cancelled' ? (
                <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>Rejected / Cancelled</span>
                </div>
              ) : activeOrder.status === 'served' ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle size={14} />
                  <span>Served & Closed</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5">
                  <ChefHat size={14} className="animate-spin" />
                  <span>{getActiveStepLabel()}</span>
                </div>
              )}
            </div>

            {/* Rejection Alert */}
            {activeOrder.status === 'cancelled' && activeOrder.rejectionReason && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2">
                <AlertTriangle size={18} className="shrink-0" />
                <div>
                  <p className="font-bold">Order Rejected by Kitchen Chef</p>
                  <p className="mt-1 text-slate-300">Reason: <span className="font-semibold text-red-300">{activeOrder.rejectionReason}</span></p>
                  <p className="mt-0.5 text-slate-400">Please choose an alternative item or speak to a waiter.</p>
                </div>
              </div>
            )}

            {/* Preparation Notes */}
            {activeOrder.chefNotes && (
              <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-rose-400 block mb-0.5">Chef's Update:</span>
                "{activeOrder.chefNotes}"
              </div>
            )}

            {/* Progress bar */}
            {activeOrder.status !== 'cancelled' && (
              <div className="space-y-3">
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-1000 ease-out"
                    style={{ width: `${currentPercent}%` }}
                  />
                </div>

                {/* Timeline icons/dots */}
                <div className="grid grid-cols-4 text-center text-[10px] text-slate-500 font-medium">
                  <div className={currentPercent >= 10 ? 'text-rose-400 font-bold' : ''}>Received</div>
                  <div className={currentPercent >= 50 ? 'text-rose-400 font-bold' : ''}>Preparing</div>
                  <div className={currentPercent >= 95 ? 'text-rose-400 font-bold' : ''}>Ready</div>
                  <div className={currentPercent >= 100 ? 'text-emerald-400 font-bold' : ''}>Served</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Recommendations Header */}
        {aiCombos.length > 0 && cart.length === 0 && (
          <div className="bg-gradient-to-r from-rose-950/20 via-slate-900/60 to-amber-950/20 border border-rose-950/40 p-5 rounded-3xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400">AI Smart Combo Suggestions</h4>
            </div>
            
            <div className="grid md:grid-cols-2 gap-3">
              {aiCombos.slice(0, 2).map((combo, idx) => (
                <div key={idx} className="bg-slate-950/40 border border-slate-800 p-3 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">{combo.name}</h5>
                    <p className="text-[10px] text-slate-400 mt-1">{combo.items.join(' + ')}</p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">"{combo.reason}"</p>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-rose-400">₹{combo.comboPrice}</span>
                      <span className="text-[9px] text-slate-500 line-through">₹{combo.originalPrice}</span>
                    </div>
                    <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">Save ₹{combo.discount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search cakes, snacks, hot drinks..."
              className="w-full bg-slate-900/60 border border-slate-800/80 focus:border-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-colors text-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Categories Bar */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                  selectedCategory === cat 
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white border-transparent' 
                    : 'bg-slate-900/40 text-slate-400 border-slate-850 hover:bg-slate-900/80 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const isOffer = product.isOffer && product.discountPrice;
            const priceToDisplay = isOffer ? product.discountPrice : product.price;

            return (
              <div 
                key={product._id} 
                className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700/80 transition-all flex flex-col group"
              >
                {/* Image */}
                <div className="h-36 overflow-hidden relative bg-slate-950">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {product.isBestseller && (
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full shadow">Bestseller</span>
                    )}
                    {product.isTrending && (
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded-full shadow">Trending</span>
                    )}
                    {product.isChefRecommended && (
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full shadow">Chef Choice</span>
                    )}
                  </div>

                  {!product.inStock && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="text-xs font-bold text-red-400 uppercase tracking-widest border border-red-500/30 px-3 py-1 rounded">Sold Out</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{product.category}</span>
                    <h4 className="font-bold text-slate-200 text-sm mt-0.5 line-clamp-1 group-hover:text-rose-400 transition-colors">{product.name}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                      <Clock size={12} className="text-rose-500/70" />
                      <span>~{product.estimatedPrepTime} mins</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-900/60">
                    <div>
                      {isOffer ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-extrabold text-rose-400">₹{product.discountPrice}</span>
                          <span className="text-[9px] text-slate-500 line-through">₹{product.price}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-extrabold text-slate-200">₹{product.price}</span>
                      )}
                    </div>

                    <button
                      disabled={!product.inStock}
                      onClick={() => addToCart(product)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-gradient-to-r hover:from-rose-500 hover:to-amber-500 text-slate-300 hover:text-white transition-all disabled:opacity-40"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Cart Slider Overlay */}
      {showCart && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-850 h-full flex flex-col justify-between">
            {/* Cart Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-rose-400" />
                <h3 className="font-bold text-lg text-slate-200">Your Basket</h3>
              </div>
              <button 
                onClick={() => setShowCart(false)}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
                  <ShoppingBag size={48} className="text-slate-700 animate-bounce" />
                  <p className="text-sm">Your cart is empty.</p>
                  <p className="text-xs max-w-xs">Scan the digital menu, choose your favorite items, and add them here to start!</p>
                </div>
              ) : (
                cart.map(item => {
                  const price = item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price;
                  return (
                    <div key={item.product._id} className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex gap-3">
                          <img src={item.product.image} className="w-12 h-12 object-cover rounded-lg bg-slate-800" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{item.product.name}</h4>
                            <p className="text-[10px] text-rose-400 font-semibold mt-0.5">₹{price} each</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
                          <button 
                            onClick={() => updateQuantity(item.product._id, -1)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold text-slate-350">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product._id, 1)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <input 
                          type="text" 
                          placeholder="Add special instructions (e.g. Less sugar, Eggless, Extra cheese...)" 
                          className="w-full bg-slate-900/60 border border-slate-850 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-rose-500/50 text-slate-300"
                          value={specialInstructions[item.product._id] || ''}
                          onChange={(e) => updateInstructions(item.product._id, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-slate-800 bg-slate-900/80 space-y-4">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-slate-400">Total Price</span>
                  <span className="text-lg font-bold text-rose-400">₹{getCartTotal()}</span>
                </div>

                <button
                  onClick={placeOrder}
                  className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 active:scale-[0.98] text-white font-bold rounded-xl text-sm transition-all flex justify-center items-center gap-2 shadow-lg shadow-rose-500/25"
                >
                  <Send size={15} />
                  <span>Send to Chef Kitchen</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
