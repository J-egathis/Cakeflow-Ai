import React, { useState, useEffect } from 'react';
import { Product, Order, OrderItem } from '../types';
import { productApi, orderApi, tableApi, getSocket, BASE_URL } from '../services/api';
import { SmartReceiptModal } from '../components/SmartReceiptModal';
import { 
  Search, ShoppingBag, Clock, Heart, Minus, Plus, 
  Send, Sparkles, AlertTriangle, CheckCircle, ChefHat, 
  Coffee, HelpCircle, AlertCircle, ShoppingCart, Trash2, ChevronRight, Filter, Check, Lock
} from 'lucide-react';

interface CustomerViewProps {
  user: { username: string; id: string; tableNumber?: number };
  onLogout: () => void;
  isQrMode?: boolean; // true when arriving via QR scan — locks table number
}

interface CartItem {
  product: Product;
  quantity: number;
  instructions: string;
}

export const CustomerView: React.FC<CustomerViewProps> = ({ user, onLogout, isQrMode = false }) => {
  const tableNum = user.tableNumber || parseInt(user.id.replace(/\D/g, '')) || 1;
  const [currentTable, setCurrentTable] = useState<number>(tableNum);
  const [qrScanConfirmed, setQrScanConfirmed] = useState<boolean>(isQrMode);

  // Auto-dismiss the QR welcome splash after 1.5s — goes straight to menu
  useEffect(() => {
    if (isQrMode && qrScanConfirmed) {
      const timer = setTimeout(() => setQrScanConfirmed(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isQrMode, qrScanConfirmed]);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [selectedPriceTier, setSelectedPriceTier] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState<{[key: string]: string}>({});

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [selectedDeleteItems, setSelectedDeleteItems] = useState<string[]>([]);
  const [aiCombos, setAiCombos] = useState<any[]>([]);
  const [aiPrepTime, setAiPrepTime] = useState<number>(15);

  // Food Details Modal State
  const [detailProductModal, setDetailProductModal] = useState<Product | null>(null);
  const [modalItemQty, setModalItemQty] = useState<number>(1);
  const [showCustomerReceiptModal, setShowCustomerReceiptModal] = useState<boolean>(false);

  // Dynamic Categories derived from store menu items
  const dynamicCatList = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const mainCategories = ['All', ...Array.from(new Set(['Juice', 'Snacks', 'Cakes', 'Chats', ...dynamicCatList]))];
  
  const subCategoriesMap: Record<string, string[]> = {
    'All': [],
    'Juice': ['All', 'Cold Drinks', 'Hot Drinks', 'Fresh Juice'],
    'Snacks': ['All', 'Veg Snacks', 'Non-Veg Snacks'],
    'Cakes': ['All', 'Birthday Cakes', 'Wedding Cakes', 'Cup Cakes', 'Pastries', 'Brownies', 'Cookies'],
    'Chats': ['All', 'Spicy Chats', 'Sweet Chats']
  };

  const [customerTablesList, setCustomerTablesList] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  // Fetch products and active order
  useEffect(() => {
    fetchProducts();
    fetchActiveOrder();
    fetchAIRecommendation();

    tableApi.getAll()
      .then((tbls: any[]) => {
        if (tbls && tbls.length > 0) {
          const nums = tbls.map((t: any) => Number(t.tableNumber)).sort((a: number, b: number) => a - b);
          setCustomerTablesList(nums);
        }
      })
      .catch(err => console.error('Failed to load tables list for CustomerView:', err));

    // Sockets setup
    const socket = getSocket();
    socket.emit('join_room', `table_${currentTable}`);

    const handleOrderChange = (updatedOrder: any) => {
      if (!updatedOrder || Number(updatedOrder.tableNumber) === Number(currentTable)) {
        if (updatedOrder && updatedOrder.status) {
          setActiveOrder(updatedOrder);
          playStatusSound(updatedOrder.status);
        }
        fetchActiveOrder();
      }
    };

    const handleProductChange = () => {
      fetchProducts();
    };

    socket.on('order_status_changed', handleOrderChange);
    socket.on('order_updated', handleOrderChange);
    socket.on('table_status_updated', fetchActiveOrder);
    socket.on('product:updated', handleProductChange);
    socket.on('product:created', handleProductChange);
    socket.on('product:deleted', handleProductChange);

    // Fast 3-second polling fallback for active order and product menu updates
    const intervalId = setInterval(() => {
      fetchActiveOrder();
      fetchProducts();
    }, 3000);

    return () => {
      clearInterval(intervalId);
      socket.emit('leave_room', `table_${currentTable}`);
      socket.off('order_status_changed', handleOrderChange);
      socket.off('order_updated', handleOrderChange);
      socket.off('table_status_updated', fetchActiveOrder);
      socket.off('product:updated', handleProductChange);
      socket.off('product:created', handleProductChange);
      socket.off('product:deleted', handleProductChange);
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
      console.error('Failed to load active order:', err);
    }
  };

  const fetchAIRecommendation = async () => {
    try {
      const res = await fetch(`${BASE_URL}/ai/recommendations`, {
        method: 'POST',
        headers: { 'Content-[#1E1818]': 'application/json' },
        body: JSON.stringify({
          timeOfDay: 'afternoon',
          tableNumber: currentTable
        })
      });
      const data = await res.json();
      if (data.combos) setAiCombos(data.combos);
      if (data.estimatedPrepTime) setAiPrepTime(data.estimatedPrepTime);
    } catch (e) {
      console.log('AI recommendation fallback:', e);
    }
  };

  const playStatusSound = (status: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (status === 'served') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else if (status === 'ready') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {}
  };

  // Cart operations
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
      return [...prev, { product, quantity: 1, instructions: specialInstructions[product._id] || '' }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product._id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const updateInstructions = (productId: string, instructions: string) => {
    setSpecialInstructions(prev => ({ ...prev, [productId]: instructions }));
    setCart(prev =>
      prev.map(item =>
        item.product._id === productId ? { ...item, instructions } : item
      )
    );
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const handlePlaceOrder = async () => {
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
        totalAmount: calculateTotal()
      });

      setActiveOrder(newOrder);
      setCart([]);
      setShowCart(false);
      
      // Fetch AI prep time
      fetchAIRecommendation();
    } catch (error: any) {
      console.error('Failed to place order:', error);
      alert(error.message || 'Failed to place order. Please try again.');
    }
  };

  const isItemInPreparationOrReady = (itemStatus?: string) => {
    if (!itemStatus) return false;
    return ['preparing', 'decorating', 'quality_check', 'ready', 'served', 'delivered'].includes(itemStatus);
  };

  const handleRemoveOrder = async (orderId: string) => {
    if (!orderId) return;

    // Block cancellation if chef has started preparing any food item
    const cookingItems = activeOrder?.items?.filter((item: any) => isItemInPreparationOrReady(item.status));
    if (cookingItems && cookingItems.length > 0) {
      alert('Chef kitchen-la preparation start pannitaar! Entire live order-a cancel panna mudiyadhu.\n(Chef has already started preparing food in the kitchen! Live order cannot be cancelled now).');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel and remove this entire live order?')) {
      return;
    }
    const targetOrderId = orderId;

    // Instant UI Reset (0ms delay)
    setActiveOrder(null);
    setSelectedDeleteItems([]);

    try {
      await orderApi.remove(targetOrderId);
    } catch (err: any) {
      console.warn('Remove order primary attempt failed, attempting fallback status cancellation:', err);
      try {
        await orderApi.update(targetOrderId, { status: 'cancelled', rejectionReason: 'Order cancelled by customer' });
      } catch (fallbackErr) {
        console.error('Failed to cancel order on backend:', fallbackErr);
      }
    }
  };

  const handleDeleteItems = async (itemIdsToDelete: string[]) => {
    if (!activeOrder || itemIdsToDelete.length === 0) return;

    // Block deletion if any selected item is in preparation/ready
    const cookingItems = activeOrder.items?.filter((item: any) => 
      itemIdsToDelete.includes(item._id) && isItemInPreparationOrReady(item.status)
    );

    if (cookingItems && cookingItems.length > 0) {
      const names = cookingItems.map((i: any) => i.product?.name || i.name || 'Item').join(', ');
      alert(`Chef preparation start pannitaar! "${names}" item-a delete panna mudiyadhu.\n(Preparation has already started for this item in the kitchen and cannot be deleted).`);
      return;
    }

    const count = itemIdsToDelete.length;
    const confirmMsg = count === 1
      ? 'Are you sure you want to delete this item from your live order?'
      : `Are you sure you want to delete these ${count} selected items from your live order?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const updatedOrder = await orderApi.update(activeOrder._id, {
        deleteItemIds: itemIdsToDelete
      });

      if (!updatedOrder.items || updatedOrder.items.length === 0 || updatedOrder.status === 'cancelled') {
        setActiveOrder(null);
      } else {
        setActiveOrder(updatedOrder);
      }
      setSelectedDeleteItems([]);
    } catch (err: any) {
      alert('Failed to delete item(s): ' + (err.message || err));
    }
  };

  const toggleSelectItemForDelete = (itemId: string) => {
    setSelectedDeleteItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const getCategoryCount = (mainCat: string) => {
    if (mainCat === 'All') return products.length;
    return products.filter(p => {
      const safeCat = p.category || '';
      const lowerCat = safeCat.toLowerCase();
      if (mainCat === 'Cakes') return lowerCat.includes('cake') || lowerCat.includes('pastr') || lowerCat.includes('brownie') || lowerCat.includes('cookie');
      if (mainCat === 'Snacks') return lowerCat.includes('snack') || lowerCat.includes('fries') || lowerCat.includes('burger');
      if (mainCat === 'Juice') return lowerCat.includes('juice') || lowerCat.includes('drink') || lowerCat.includes('coffee') || lowerCat.includes('tea');
      if (mainCat === 'Chats') return lowerCat.includes('chat') || lowerCat.includes('puri');
      return safeCat === mainCat;
    }).length;
  };

  // Filter items
  const filteredProducts = products.filter(p => {
    if (p.isHidden) return false;
    const safeName = p.name || '';
    const safeCat = p.category || '';
    const lowerCat = safeCat.toLowerCase();

    let pMainCat = 'All';
    if (
      ['Birthday Cakes', 'Wedding Cakes', 'Cup Cakes', 'Pastries', 'Brownies', 'Cookies', 'Cakes'].includes(safeCat) ||
      lowerCat.includes('cake') || lowerCat.includes('pastr') || lowerCat.includes('brownie') || lowerCat.includes('cookie')
    ) pMainCat = 'Cakes';
    else if (
      ['Veg Snacks', 'Non-Veg Snacks', 'Snacks'].includes(safeCat) ||
      lowerCat.includes('snack') || lowerCat.includes('fries') || lowerCat.includes('burger')
    ) pMainCat = 'Snacks';
    else if (
      ['Hot Drinks', 'Cold Drinks', 'Fresh Juice', 'Juice'].includes(safeCat) ||
      lowerCat.includes('juice') || lowerCat.includes('drink') || lowerCat.includes('coffee') || lowerCat.includes('tea')
    ) pMainCat = 'Juice';
    else if (
      ['Spicy Chats', 'Sweet Chats', 'Chats'].includes(safeCat) ||
      lowerCat.includes('chat') || lowerCat.includes('puri')
    ) pMainCat = 'Chats';

    const matchesMain = selectedMainCategory === 'All' || pMainCat === selectedMainCategory;
    const matchesSub = selectedSubCategory === 'All' || safeCat === selectedSubCategory;
    const matchesSearch = safeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          safeCat.toLowerCase().includes(searchQuery.toLowerCase());

    const itemPrice = p.isOffer && p.discountPrice ? p.discountPrice : p.price;
    let matchesPrice = true;
    if (selectedPriceTier === 'under100') matchesPrice = itemPrice < 100;
    else if (selectedPriceTier === '100-250') matchesPrice = itemPrice >= 100 && itemPrice <= 250;
    else if (selectedPriceTier === '250-500') matchesPrice = itemPrice >= 250 && itemPrice <= 500;
    else if (selectedPriceTier === 'above500') matchesPrice = itemPrice > 500;

    return matchesMain && matchesSub && matchesSearch && matchesPrice;
  });

  const getTrackerProgress = () => {
    if (!activeOrder) return 0;
    if (activeOrder.status === 'served' || activeOrder.status === 'ready') return 100;

    const items = activeOrder.items || [];
    const totalItems = items.length;
    if (totalItems === 0) return 20;

    let readyCount = 0;
    let prepCount = 0;

    items.forEach((item: any) => {
      const st = item.status || 'pending';
      if (st === 'ready' || st === 'delivered' || st === 'served') readyCount++;
      else if (st === 'preparing' || st === 'decorating' || st === 'quality_check') prepCount++;
    });

    if (readyCount === totalItems) return 100;
    
    // Weight calculation
    const score = (readyCount * 1.0) + (prepCount * 0.5);
    let progress = Math.min(95, Math.round(25 + (score / totalItems) * 65));
    
    // Ensure "Preparing" step is highlighted if there are preparing items
    if (prepCount > 0 && progress < 60) {
      progress = 60;
    }
    
    return progress;
  };

  const getStepStatusText = () => {
    if (!activeOrder) return '';
    if (activeOrder.status === 'served') return 'Food Served at Table! Enjoy!';
    if (activeOrder.status === 'ready') return 'All Items Ready! Serving now...';
    
    const items = activeOrder.items || [];
    const anyPreparing = items.some((i: any) => i.status === 'preparing' || i.status === 'accepted');
    const anyDecorating = items.some((i: any) => i.status === 'decorating');
    const anyQuality = items.some((i: any) => i.status === 'quality_check');

    if (anyQuality) return 'Chef Performing Quality Check';
    if (anyDecorating) return 'Cake Decorator Sculpting Drizzle';
    if (anyPreparing || activeOrder.status === 'preparing' || activeOrder.status === 'accepted') return 'Baking & Preparing in Kitchen';
    
    return 'Pending Review';
  };

  const currentPercent = getTrackerProgress();

  // QR Scan Welcome Screen
  if (isQrMode && qrScanConfirmed) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6 text-[#1E1818]">
        <div className="text-center space-y-6 max-w-sm w-full">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-[#CD0D0D] flex items-center justify-center shadow-xl shadow-[#CD0D0D]/30 animate-bounce">
              <Coffee size={36} className="text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-black text-[#CD0D0D]">
              CakeFlow AI
            </h1>
            <p className="text-[#6E6262] text-sm mt-1 font-medium">Smart Dining Experience</p>
          </div>

          {/* Table Badge */}
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-[#D0C0C0] shadow-md">
            <div className="w-10 h-10 rounded-xl bg-[#CD0D0D]/10 flex items-center justify-center">
              <span className="text-[#CD0D0D] font-black text-lg">{currentTable}</span>
            </div>
            <div className="text-left">
              <p className="text-xs text-[#6E6262] uppercase tracking-wider font-semibold">Your Table</p>
              <p className="text-[#1E1818] font-bold">Table {currentTable}</p>
            </div>
            <CheckCircle size={20} className="text-emerald-500 ml-2" />
          </div>

          <p className="text-[#6E6262] text-sm">
            QR Scan Verified! Loading your menu now...
          </p>

          <button
            onClick={() => setQrScanConfirmed(false)}
            className="w-full py-4 rounded-2xl bg-[#CD0D0D] text-white font-extrabold text-base shadow-lg shadow-[#CD0D0D]/30 hover:bg-[#A60A0A] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag size={20} />
            Tap to Enter Menu Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="customerPage" data-testid="customerPage" className="h-screen w-full bg-[#F7F5F2] text-[#1E1818] flex flex-col overflow-hidden">

      {/* ═══════════ TOP HEADER (Responsive for all screens) ═══════════ */}
      <header id="customerHeader" data-testid="customerHeader" className="shrink-0 bg-white border-b border-[#E0D4D4] px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between z-40 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
            <Coffee size={15} className="sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-xs sm:text-sm tracking-tight text-[#CD0D0D] leading-none truncate">CakeFlow AI</h1>
            <div className="flex items-center gap-1 mt-0.5">
              {isQrMode ? (
                <>
                  <span className="px-1 py-0.2 rounded bg-[#CD0D0D]/10 text-[#CD0D0D] font-bold border border-[#CD0D0D]/30 text-[8px] sm:text-[9px]">
                    Table {currentTable}
                  </span>
                  <CheckCircle size={9} className="text-emerald-500 shrink-0" />
                  <span className="text-[8px] sm:text-[9px] text-emerald-600 font-semibold truncate">QR Verified</span>
                </>
              ) : (
                <>
                  <span className="text-[8px] sm:text-[9px] text-[#6E6262] font-semibold">Table</span>
                  <select
                    value={currentTable}
                    onChange={(e) => setCurrentTable(Number(e.target.value))}
                    className="bg-[#FAF8F8] border border-[#D0C0C0] rounded px-1 py-0.5 text-[8px] sm:text-[9px] text-[#CD0D0D] font-black focus:outline-none cursor-pointer"
                  >
                    {customerTablesList.map(num => (
                      <option key={num} value={num}>T{num}</option>
                    ))}
                  </select>
                </>
              )}
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <span className="text-[8px] text-emerald-600 font-bold hidden xs:inline">Live</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeOrder && (
            <button
              onClick={() => setShowCustomerReceiptModal(true)}
              className="px-2 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-[#CD0D0D] font-extrabold text-[9px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              title="View Digital Invoice Receipt"
            >
              <span>🧾 Bill</span>
            </button>
          )}

          <button
            onClick={() => setShowCart(true)}
            className="relative p-1.5 sm:p-2 rounded-xl bg-[#FAF8F8] border border-[#D0C0C0] hover:border-[#CD0D0D] transition-colors cursor-pointer"
          >
            <ShoppingBag size={15} className="text-[#CD0D0D] sm:w-4 sm:h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#CD0D0D] text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
          <button
            onClick={onLogout}
            className="text-[8px] sm:text-[9px] text-[#6E6262] hover:text-[#CD0D0D] bg-[#FAF8F8] px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-[#D0C0C0] font-bold cursor-pointer"
          >
            Exit
          </button>
        </div>
      </header>

      {/* ═══════════ BODY — sidebar + scrollable content ═══════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT SIDEBAR (Fluid Responsive Width: 132px phone -> 160px sm -> 185px md) ─── */}
        <aside className="shrink-0 bg-white border-r border-[#E8DDD0] flex flex-col overflow-y-auto w-[132px] sm:w-[160px] md:w-[185px]">

          {/* Search */}
          <div className="p-2 sm:p-3 border-b border-[#F0E8DF]">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#8A6A27] mb-1">Search</p>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#B09880]" size={11} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-[#FAF6F2] border border-[#DDD0C0] rounded-xl pl-6 pr-1.5 py-1 text-[10px] sm:text-xs text-[#2A201A] focus:outline-none focus:border-[#CD0D0D] placeholder:text-[#B09880]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Categories */}
          <div className="p-2 sm:p-3 border-b border-[#F0E8DF]">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#8A6A27] mb-1.5">Categories</p>
            <div className="space-y-1">
              {mainCategories.map(cat => {
                const isSelected = selectedMainCategory === cat;
                const count = getCategoryCount(cat);
                const subs = subCategoriesMap[cat] || [];
                return (
                  <div key={cat}>
                    <button
                      onClick={() => {
                        setSelectedMainCategory(cat);
                        setSelectedSubCategory('All');
                      }}
                      className={`w-full flex items-center justify-between py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#CD0D0D] text-white shadow-sm font-bold'
                          : 'hover:bg-[#FFF0F0] text-[#3A2820]'
                      }`}
                    >
                      <span className={`text-[11px] sm:text-xs font-bold truncate ${isSelected ? 'text-white' : ''}`}>
                        {cat === 'All' ? 'All Items' : cat}
                      </span>
                      <span className={`text-[9px] sm:text-[10px] font-mono ml-1 shrink-0 ${isSelected ? 'text-white/80' : 'text-[#A09080]'}`}>
                        {count}
                      </span>
                    </button>

                    {/* Smooth accordion sub-categories */}
                    {isSelected && subs.length > 0 && (
                      <div className="animate-accordion-down mt-1 ml-1 pl-1.5 sm:pl-2 border-l-2 border-[#CD0D0D]/30 space-y-1">
                        {subs.map(sub => {
                          const isSubSel = selectedSubCategory === sub;
                          return (
                            <button
                              key={sub}
                              onClick={() => setSelectedSubCategory(sub)}
                              className={`w-full text-left py-1 px-1.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer truncate ${
                                isSubSel ? 'bg-[#7A5A20] text-white' : 'text-[#6A4A30] hover:bg-[#FAF0E8]'
                              }`}
                            >
                              {sub === 'All' ? `All ${cat}` : sub}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price Tiers */}
          <div className="p-2 sm:p-3 border-b border-[#F0E8DF]">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#8A6A27] mb-1.5">Price</p>
            <div className="space-y-0.5 sm:space-y-1">
              {[
                { id: 'All', label: 'All Prices' },
                { id: 'under100', label: '< ₹100' },
                { id: '100-250', label: '₹100 - 250' },
                { id: '250-500', label: '₹250 - 500' },
                { id: 'above500', label: '₹500+' },
              ].map(tier => {
                const isSel = selectedPriceTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedPriceTier(tier.id)}
                    className={`w-full text-left py-1 sm:py-1.5 px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-semibold transition-all cursor-pointer truncate ${
                      isSel
                        ? 'bg-[#F5EAD8] text-[#7A5A20] border border-[#C8A060] font-bold'
                        : 'text-[#4A3828] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Filters */}
          {(selectedMainCategory !== 'All' || selectedSubCategory !== 'All' || selectedPriceTier !== 'All' || searchQuery !== '') && (
            <div className="p-2 sm:p-3">
              <button
                onClick={() => {
                  setSelectedMainCategory('All');
                  setSelectedSubCategory('All');
                  setSelectedPriceTier('All');
                  setSearchQuery('');
                }}
                className="w-full py-1.5 text-[10px] sm:text-xs font-bold text-[#CD0D0D] border border-[#CD0D0D]/30 rounded-lg sm:rounded-xl hover:bg-[#FFF0F0] cursor-pointer transition-colors"
              >
                ✕ Reset
              </button>
            </div>
          )}
        </aside>

        {/* ─── RIGHT SCROLLABLE CONTENT ─── */}
        <div className="flex-1 overflow-y-auto bg-[#F7F5F2] min-w-0">

          {/* LIVE ORDER TRACKER WITH SINGLE & MULTI ITEM DELETION */}
          {activeOrder && activeOrder.status !== 'cancelled' && (
            <div className="mx-2 sm:mx-3.5 mt-2.5 sm:mt-3.5 bg-white border border-[#CD0D0D]/30 rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F4EAEA]">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="p-1 sm:p-1.5 rounded-lg bg-[#CD0D0D]/10 text-[#CD0D0D] shrink-0">
                    <ChefHat size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-black text-[11px] sm:text-xs text-[#1E1818] truncate">Order #{activeOrder._id.slice(-4)}</span>
                      <span className="text-[7px] uppercase font-black bg-[#CD0D0D] text-white px-1.5 py-0.2 rounded-full shrink-0">
                        {activeOrder.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#CD0D0D] font-bold truncate">{getStepStatusText()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-black text-xs sm:text-base text-[#CD0D0D] font-mono">₹{activeOrder.totalAmount}</span>
                  {activeOrder.status !== 'served' && (
                    <button 
                      onClick={() => handleRemoveOrder(activeOrder._id)} 
                      className="p-1 sm:p-1.5 bg-[#FFF0F0] rounded-lg cursor-pointer text-[#CD0D0D] hover:bg-[#CD0D0D] hover:text-white transition-all text-[10px] font-bold flex items-center gap-1"
                      title="Cancel Entire Order"
                    >
                      <Trash2 size={11} />
                      <span className="text-[10px] font-bold">Cancel All</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[8px] font-bold text-[#9E8080] mb-1">
                  <span>Order Progress</span><span className="text-[#CD0D0D]">{currentPercent}%</span>
                </div>
                <div className="w-full bg-[#F4EAEA] rounded-full h-1.5 sm:h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#CD0D0D] to-[#FF5555] rounded-full transition-all duration-700" style={{ width: `${currentPercent}%` }} />
                </div>
              </div>

              {/* LIVE ITEMS & DELETION LIST (Single & Multi-Item Delete) */}
              <div className="space-y-2 pt-1 border-t border-[#F4EAEA]">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-[#6E6262]">
                    Items in Live Order ({activeOrder.items?.length || 0})
                  </span>
                  {selectedDeleteItems.length > 0 && (
                    <button
                      onClick={() => setSelectedDeleteItems([])}
                      className="text-[9px] font-bold text-[#6E6262] hover:text-[#1E1818] underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {/* Multi-Item Delete Action Bar */}
                {selectedDeleteItems.length > 0 && (
                  <div className="bg-[#CD0D0D] text-white px-2.5 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold shadow-md animate-fade-in">
                    <span>{selectedDeleteItems.length} item(s) selected</span>
                    <button
                      onClick={() => handleDeleteItems(selectedDeleteItems)}
                      className="bg-white text-[#CD0D0D] hover:bg-[#FAF8F8] px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <Trash2 size={11} />
                      <span>Delete Selected ({selectedDeleteItems.length})</span>
                    </button>
                  </div>
                )}

                {/* Interactive Items List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeOrder.items?.map((item: any) => {
                    const nm = item.product?.name || item.name || 'Food Item';
                    const price = item.product?.isOffer && item.product?.discountPrice ? item.product.discountPrice : (item.product?.price || item.price || 0);
                    const st = item.status || 'pending';
                    const isSelected = selectedDeleteItems.includes(item._id);
                    const isLockedFromDelete = isItemInPreparationOrReady(st);

                    return (
                      <div 
                        key={item._id} 
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                          isSelected 
                            ? 'bg-[#CD0D0D]/10 border-[#CD0D0D]' 
                            : 'bg-[#FAF8F8] border-[#E8E0E0] hover:border-[#D0C0C0]'
                        }`}
                      >
                        {/* Checkbox & Details */}
                        <div className="flex items-center gap-2 min-w-0">
                          {isLockedFromDelete ? (
                            <div 
                              title="Chef preparation start pannitaar! Intha item-a select panna mudiyadhu."
                              className="w-3.5 h-3.5 flex items-center justify-center opacity-40 cursor-not-allowed"
                            >
                              <Lock size={10} className="text-amber-700" />
                            </div>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItemForDelete(item._id)}
                              className="accent-[#CD0D0D] w-3.5 h-3.5 cursor-pointer rounded"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1E1818] truncate text-[11px]">{nm}</span>
                              <span className="text-[#CD0D0D] font-extrabold bg-[#CD0D0D]/10 px-1.5 py-0.2 rounded text-[9px]">x{item.quantity}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-[#6E6262]">
                              <span>₹{price * item.quantity}</span>
                              <span className={`px-1.5 py-0.2 rounded-full font-bold uppercase text-[8px] ${
                                st === 'ready' || st === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : isLockedFromDelete
                                  ? 'bg-amber-100 text-amber-800 font-extrabold border border-amber-300'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {st}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delete or Locked Badge */}
                        {isLockedFromDelete ? (
                          <div 
                            onClick={() => alert(`Chef preparation start pannitaar! "${nm}" item-a delete panna mudiyadhu.`)}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-extrabold cursor-pointer hover:bg-amber-500/20 transition-all shrink-0 ml-1.5"
                            title="Preparation started in kitchen - Deletion locked"
                          >
                            <Lock size={11} />
                            <span>In Kitchen</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDeleteItems([item._id])}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0 ml-1.5"
                            title="Delete Single Food Item"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Full Width Cancel All Button */}
                <button
                  onClick={() => handleRemoveOrder(activeOrder._id)}
                  className="w-full py-2 bg-[#FFF0F0] hover:bg-[#CD0D0D] text-[#CD0D0D] hover:text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98] mt-2"
                >
                  <Trash2 size={13} />
                  <span>Cancel Entire Live Order</span>
                </button>
              </div>
            </div>
          )}

          {/* MENU GRID (Fluid Responsive Cards for all Phone & Tablet sizes) */}
          <div className="p-2 sm:p-3.5">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <h2 className="font-black text-xs sm:text-sm text-[#1E1818] uppercase tracking-wider">
                Menu · {filteredProducts.length} items
              </h2>
              <span className="text-[10px] sm:text-xs text-[#9E8888] font-medium">Fresh & Delicious</span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#9E8888]">
                <Coffee size={36} className="text-[#CD0D0D]/30 mb-3" />
                <p className="text-xs sm:text-sm font-bold">No items match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
                {filteredProducts.map(p => {
                  const inCart = cart.find(c => c.product._id === p._id);
                  const qty = inCart ? inCart.quantity : 0;
                  const price = p.isOffer && p.discountPrice ? p.discountPrice : p.price;
                  return (
                    <div
                      key={p._id}
                      onClick={() => { setDetailProductModal(p); setModalItemQty(1); }}
                      className="bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-[#E8E0D8] hover:border-[#CD0D0D] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-w-0"
                    >
                      {/* Product Image */}
                      <div>
                        <div className="relative w-full h-28 xs:h-32 sm:h-36 bg-[#FAF6F2] overflow-hidden">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=No+Image';
                            }}
                          />
                          {/* Category badge */}
                          <span className="absolute top-1.5 left-1.5 bg-[#CD0D0D] text-white text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase shadow-xs truncate max-w-[80%]">
                            {p.category}
                          </span>
                          {/* Cart qty badge */}
                          {qty > 0 && (
                            <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] sm:text-[9px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md">
                              {qty}
                            </span>
                          )}
                          {/* Offer badge */}
                          {p.isOffer && (
                            <span className="absolute bottom-1.5 right-1.5 bg-amber-400 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                              SALE
                            </span>
                          )}
                        </div>

                        {/* Card Info */}
                        <div className="p-2 sm:p-3">
                          <h3 className="font-bold text-[11px] sm:text-xs md:text-sm text-[#1E1818] line-clamp-1 group-hover:text-[#CD0D0D] transition-colors leading-tight">
                            {p.name}
                          </h3>
                          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-[#9E8888] mt-1 mb-1.5 font-medium">
                            <Clock size={9} className="text-[#CD0D0D] shrink-0" />
                            <span className="truncate">~{p.estimatedPrepTime || 15}m prep</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Bottom Controls */}
                      <div className="px-2 sm:px-3 pb-2 sm:pb-3 pt-0 flex items-center justify-between border-t border-[#F5EFEA]/80 mt-0.5">
                        <div className="min-w-0 pr-1">
                          <span className="font-black text-xs sm:text-sm md:text-base text-[#CD0D0D] font-mono">₹{price}</span>
                          {p.isOffer && p.discountPrice && (
                            <span className="text-[9px] text-[#9E8888] line-through ml-1 font-mono hidden xs:inline">₹{p.price}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p);
                          }}
                          className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer active:scale-95 shadow-xs shrink-0 ${
                            qty > 0
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              : 'bg-[#CD0D0D] hover:bg-[#A60A0A] text-white'
                          }`}
                        >
                          <Plus size={10} className="sm:w-3 sm:h-3" />
                          <span>{qty > 0 ? `(${qty})` : 'Add'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom padding so floating cart doesn't cover last card */}
          <div style={{ height: '85px' }} />
        </div>
      </div>

      {/* ═══════════ FLOATING CART PILL (Fluid Responsive Position) ═══════════ */}
      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-3 sm:bottom-4 z-40 left-[140px] sm:left-[172px] md:left-[198px] right-3 sm:right-4">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-[#CD0D0D] hover:bg-[#A60A0A] text-white py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-2xl shadow-[#CD0D0D]/40 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-white/25 flex items-center justify-center font-black text-[10px] sm:text-xs font-mono shrink-0">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </div>
              <span className="text-[11px] sm:text-xs font-extrabold truncate">View Cart · T{currentTable}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-black text-xs sm:text-sm font-mono">₹{calculateTotal().toFixed(0)}</span>
              <ChevronRight size={15} />
            </div>
          </button>
        </div>
      )}


      {/* ═══════════ CART DRAWER ═══════════ */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            {/* Cart Header */}
            <div className="px-5 py-4 border-b border-[#E8E0E0] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#CD0D0D]" />
                <h3 className="font-black text-base text-[#1E1818]">Your Cart</h3>
                <span className="bg-[#CD0D0D] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                  T{currentTable}
                </span>
              </div>
              <button onClick={() => setShowCart(false)} className="p-1.5 rounded-xl hover:bg-[#FAF0F0] text-[#9E8888] cursor-pointer transition-colors">
                ✕
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#9E8888]">
                  <ShoppingCart size={40} className="text-[#CD0D0D]/20 mb-3" />
                  <p className="text-sm font-bold">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product._id} className="bg-[#FAF8F8] border border-[#E8E0E0] rounded-2xl p-3">
                    <div className="flex gap-3 items-start">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-[#E0D8D8] shrink-0">
                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-[#1E1818] truncate">{item.product.name}</p>
                        <p className="font-black text-sm text-[#CD0D0D] font-mono mt-0.5">
                          ₹{((item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price) * item.quantity).toFixed(0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-[#E0D8D8] rounded-xl p-1 shrink-0">
                        <button onClick={() => updateCartQuantity(item.product._id, -1)} className="w-6 h-6 rounded-lg bg-[#FAF0F0] text-[#CD0D0D] font-bold text-sm flex items-center justify-center hover:bg-[#CD0D0D] hover:text-white transition-colors cursor-pointer">-</button>
                        <span className="font-mono font-black text-xs w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.product._id, 1)} className="w-6 h-6 rounded-lg bg-[#FAF0F0] text-[#CD0D0D] font-bold text-sm flex items-center justify-center hover:bg-[#CD0D0D] hover:text-white transition-colors cursor-pointer">+</button>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#EEE8E8]">
                      <input
                        type="text"
                        placeholder="Special note (e.g. less sugar)..."
                        className="w-full bg-white border border-[#DDD8D8] focus:border-[#CD0D0D] rounded-xl px-3 py-1.5 text-[10px] placeholder:text-[#9E8888] focus:outline-none"
                        value={item.instructions || specialInstructions[item.product._id] || ''}
                        onChange={(e) => updateInstructions(item.product._id, e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Checkout */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-[#E8E0E0] shrink-0 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-[#6E6262]">Total</span>
                  <span className="text-2xl font-black text-[#CD0D0D] font-mono">₹{calculateTotal().toFixed(0)}</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-4 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#CD0D0D]/30 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Send size={16} />
                  Place Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ PRODUCT DETAIL MODAL (Centered on Phone) ═══════════ */}
      {detailProductModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailProductModal(null)}>
          <div className="bg-white w-full max-w-[92vw] sm:max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-scale-in text-[#1E1818]" onClick={e => e.stopPropagation()}>
            {/* Image Banner - Centered & Featured */}
            <div className="relative w-full shrink-0 h-48 sm:h-56 bg-[#FAF6F2] overflow-hidden">
              <img
                src={detailProductModal.image}
                alt={detailProductModal.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x250?text=No+Image'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
              <button
                onClick={() => setDetailProductModal(null)}
                className="absolute top-3 right-3 bg-white/90 hover:bg-white p-2 rounded-full shadow-md cursor-pointer transition-colors text-[#1E1818]"
              >
                ✕
              </button>
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="bg-[#CD0D0D] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase shadow">
                  {detailProductModal.category}
                </span>
                {detailProductModal.isOffer && (
                  <span className="bg-amber-400 text-white text-[9px] font-black px-2 py-1 rounded-full uppercase shadow">
                    Sale
                  </span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <h2 className="text-lg sm:text-xl font-black text-[#1E1818] leading-snug">{detailProductModal.name}</h2>
                  <div className="flex items-center gap-1.5 text-[#9E8888] text-xs mt-1.5 font-medium">
                    <Clock size={13} className="text-[#CD0D0D]" />
                    <span>~{detailProductModal.estimatedPrepTime || 15} min prep time</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl sm:text-2xl font-black text-[#CD0D0D] font-mono">
                    ₹{detailProductModal.isOffer && detailProductModal.discountPrice ? detailProductModal.discountPrice : detailProductModal.price}
                  </p>
                  {detailProductModal.isOffer && detailProductModal.discountPrice && (
                    <p className="text-xs text-[#9E8888] line-through font-mono">₹{detailProductModal.price}</p>
                  )}
                </div>
              </div>
              {detailProductModal.description && (
                <p className="text-xs text-[#6E6262] mt-3 leading-relaxed border-t border-[#F5EFEA] pt-3">{detailProductModal.description}</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#EEE8E8] bg-[#FAF8F8] flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-white border border-[#E0D8D8] p-1.5 rounded-2xl">
                <button
                  onClick={() => setModalItemQty(prev => Math.max(1, prev - 1))}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FAF0F0] text-[#CD0D0D] font-bold flex items-center justify-center hover:bg-[#CD0D0D] hover:text-white transition-colors cursor-pointer"
                >
                  <Minus size={14} />
                </button>
                <span className="font-mono font-black text-base w-6 text-center">{modalItemQty}</span>
                <button
                  onClick={() => setModalItemQty(prev => prev + 1)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#FAF0F0] text-[#CD0D0D] font-bold flex items-center justify-center hover:bg-[#CD0D0D] hover:text-white transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                disabled={!detailProductModal.inStock}
                onClick={() => {
                  for (let i = 0; i < modalItemQty; i++) addToCart(detailProductModal);
                  setDetailProductModal(null);
                  setShowCart(true);
                }}
                className="flex-1 py-3.5 bg-[#CD0D0D] hover:bg-[#A60A0A] disabled:opacity-50 text-white font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#CD0D0D]/25 cursor-pointer transition-all active:scale-[0.98]"
              >
                <ShoppingBag size={16} />
                Add {modalItemQty} · ₹{((detailProductModal.isOffer && detailProductModal.discountPrice ? detailProductModal.discountPrice : detailProductModal.price) * modalItemQty).toFixed(0)}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🧾 ULTRA-MODERN AI SMART RECEIPT MODAL */}
      {showCustomerReceiptModal && activeOrder && (
        <SmartReceiptModal
          order={activeOrder}
          onClose={() => setShowCustomerReceiptModal(false)}
        />
      )}
    </div>
  );
};

