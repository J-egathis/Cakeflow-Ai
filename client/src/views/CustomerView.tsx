import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Product, Order, OrderItem } from '../types';
import { productApi, orderApi, tableApi, systemApi, getSocket, BASE_URL } from '../services/api';
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
 memberId: string;
}

export const CustomerView: React.FC<CustomerViewProps> = ({ user, onLogout, isQrMode = false }) => {
 const [searchParams, setSearchParams] = useSearchParams();
 const tableNum = user.tableNumber || parseInt(user.id.replace(/\D/g, '')) || 1;
 const [currentTable, setCurrentTable] = useState<number>(() => {
 const saved = localStorage.getItem('customer_currentTable');
 return saved ? parseInt(saved) : tableNum;
 });
 useEffect(() => { localStorage.setItem('customer_currentTable', currentTable.toString()); }, [currentTable]);
 
 // Sync per-table states when currentTable changes
 useEffect(() => {
 const savedMembers = localStorage.getItem(`customer_tableMembers_${currentTable}`);
 setTableMembers(savedMembers ? JSON.parse(savedMembers) : [{id: 'M1', name: 'Member 1'}]);
 
 const savedActive = localStorage.getItem(`customer_activeMember_${currentTable}`);
 setActiveMember(savedActive ? savedActive : 'M1');
 
 const savedCart = localStorage.getItem(`customer_cart_${currentTable}`);
 setCart(savedCart ? JSON.parse(savedCart) : []);
 }, [currentTable]);
 const [qrScanConfirmed, setQrScanConfirmed] = useState<boolean>(() => {
 if (!isQrMode) return false;
 if (searchParams.get('step') || sessionStorage.getItem(`qr_splash_done_${tableNum}`)) return false;
 return true;
 });

 const step = (searchParams.get('step') || localStorage.getItem(`customer_step_${currentTable}`) || (isQrMode ? 'MANAGE_MEMBERS' : 'SELECT_TABLE')) as 'SELECT_TABLE' | 'MANAGE_MEMBERS' | 'MENU' | 'TRACK_ORDER' | 'ALL_TRACK_ORDERS';
 const setStep = (newStep: string) => {
 localStorage.setItem(`customer_step_${currentTable}`, newStep);
 setSearchParams(prev => { prev.set('step', newStep); return prev; }, { replace: false });
 };
 
 const handleLogout = () => {
 localStorage.removeItem('customer_currentTable');
 localStorage.removeItem(`customer_step_${currentTable}`);
 localStorage.removeItem(`customer_tableMembers_${currentTable}`);
 localStorage.removeItem(`customer_activeMember_${currentTable}`);
 localStorage.removeItem(`customer_cart_${currentTable}`);
 onLogout();
 };
 const [tableMembers, setTableMembers] = useState<{id: string, name: string}[]>(() => {
 const saved = localStorage.getItem(`customer_tableMembers_${currentTable}`);
 return saved ? JSON.parse(saved) : [{id: 'M1', name: 'Member 1'}];
 });
 useEffect(() => { localStorage.setItem(`customer_tableMembers_${currentTable}`, JSON.stringify(tableMembers)); }, [tableMembers, currentTable]);
 const [newMemberName, setNewMemberName] = useState('');
 const [activeMember, setActiveMember] = useState<string>(() => {
 const saved = localStorage.getItem(`customer_activeMember_${currentTable}`);
 return saved ? saved : 'M1';
 });
 useEffect(() => { localStorage.setItem(`customer_activeMember_${currentTable}`, activeMember); }, [activeMember, currentTable]);
 const selectedMealType = searchParams.get('meal') || 'Breakfast';
 const setSelectedMealType = (meal: string) => {
 setSearchParams(prev => { prev.set('meal', meal); prev.delete('cat'); return prev; });
 };
 
 // Auto-dismiss the QR welcome splash after 1.5s — goes straight to members
 useEffect(() => {
 if (isQrMode && qrScanConfirmed) {
 const timer = setTimeout(() => {
 sessionStorage.setItem(`qr_splash_done_${tableNum}`, 'true');
 setQrScanConfirmed(false);
 }, 1500);
 return () => clearTimeout(timer);
 }
 }, [isQrMode, qrScanConfirmed, tableNum]);

 const [products, setProducts] = useState<Product[]>([]);
 const [selectedMainCategory, setSelectedMainCategory] = useState<string>('All');
 const selectedSubCategory = searchParams.get('cat') || 'All';
 const setSelectedSubCategory = (cat: string) => {
 setSearchParams(prev => { prev.set('cat', cat); return prev; });
 };
 const [selectedPriceTier, setSelectedPriceTier] = useState<string>('All');
 const [searchQuery, setSearchQuery] = useState('');
 const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
 const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
 const [customerMealCategories, setCustomerMealCategories] = useState<string[]>(['Breakfast', 'Lunch', 'Dinner']);
 useEffect(() => {
 const loadCatsAndMeals = () => {
 import('../services/api').then(m => {
 m.categoryApi.getMetas().then((data: any) => { 
 const map:Record<string,string> = {}; 
 const hiddens: string[] = [];
 data.forEach((d:any) => {
 map[d.name] = d.image; 
 if(d.isHidden) hiddens.push(d.name);
 });
 setCategoryImages(map); 
 setHiddenCategories(hiddens);
 }).catch((e: any) => console.log(e));
 m.categoryApi.getMeals().then((meals: any) => {
 if (Array.isArray(meals)) {
 const visibleMeals = meals.filter((mc: any) => !mc.isHidden).map((mc: any) => mc.name);
 if (visibleMeals.length > 0) setCustomerMealCategories(visibleMeals);
 }
 }).catch((e: any) => console.log(e));
 });
 };
 loadCatsAndMeals();
 window.addEventListener('mealCategoriesUpdated', loadCatsAndMeals);
 return () => window.removeEventListener('mealCategoriesUpdated', loadCatsAndMeals);
 }, []);
 
 
 
 const [cart, setCart] = useState<CartItem[]>(() => {
 const saved = localStorage.getItem(`customer_cart_${currentTable}`);
 return saved ? JSON.parse(saved) : [];
 });
 useEffect(() => { localStorage.setItem(`customer_cart_${currentTable}`, JSON.stringify(cart)); }, [cart, currentTable]);
 const [showCart, setShowCart] = useState(false);
 const [specialInstructions, setSpecialInstructions] = useState<{[key: string]: string}>({});

 const [activeOrder, setActiveOrder] = useState<Order | null>(null);
 const [allActiveOrders, setAllActiveOrders] = useState<Order[]>([]);

 const [selectedDeleteItems, setSelectedDeleteItems] = useState<string[]>([]);
 const [aiCombos, setAiCombos] = useState<any[]>([]);
 const [aiPrepTime, setAiPrepTime] = useState<number>(15);

 // Live GST Tax State
 const [gstRate, setGstRate] = useState<number>(() => {
 const saved = localStorage.getItem('admin_gst_rate');
 return saved !== null && saved !== '' ? parseFloat(saved) : 0;
 });

 // Food Details Modal State
 const [detailProductModal, setDetailProductModal] = useState<Product | null>(null);
 const [modalItemQty, setModalItemQty] = useState<number>(1);
 const [showCustomerReceiptModal, setShowCustomerReceiptModal] = useState<boolean>(false);

 // Dynamic Categories derived from store menu items & backend
 const visibleProducts = products.filter(p => !p.isHidden && p.category !== 'Uncategorized' && !hiddenCategories.includes(p.category));
 const dynamicCatList = Array.from(new Set(visibleProducts.map(p => p.category).filter(Boolean)));
 const mainCategories = ['All', ...dynamicCatList];
 
 const subCategoriesMap = useMemo(() => {
 const map: Record<string, string[]> = {
 'All': []
 };
 
 visibleProducts.forEach(p => {
 const c = p.category || '';
 const sc = p.subCategory || 'General';
 if (!map[c]) map[c] = ['All'];
 if (!map[c].includes(sc)) map[c].push(sc);
 });
 
 return map;
 }, [products]);

 const [customerTablesList, setCustomerTablesList] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

 // Fetch products, active order, GST, and categories
 useEffect(() => {
 fetchProducts();
 fetchActiveOrder();
 if (step === 'ALL_TRACK_ORDERS') fetchAllActiveOrders();
 fetchAIRecommendation();

 // Fetch live GST rate from backend
 systemApi.getGst()
 .then(res => {
 if (res && typeof res.gstRate === 'number') {
 setGstRate(res.gstRate);
 localStorage.setItem('admin_gst_rate', String(res.gstRate));
 }
 })
 .catch(err => console.error('Failed to fetch system GST:', err));

 // SubCategories map is now dynamically derived from products array via useMemo

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

 const handleGstUpdate = (data: { gstRate: number }) => {
 if (data && typeof data.gstRate === 'number') {
 setGstRate(data.gstRate);
 localStorage.setItem('admin_gst_rate', String(data.gstRate));
 }
 };

 // Removed handleCategoriesUpdate as it's computed now

 socket.on('order_updated', handleOrderChange);
 socket.on('table_status_updated', () => {
 fetchActiveOrder();
 fetchAllActiveOrders();
 });
 socket.on('product:updated', handleProductChange);
 socket.on('category:updated', () => {
 fetchProducts();
 import('../services/api').then(m => {
 m.categoryApi.getMetas().then((data: any) => { 
 const map: Record<string, string> = {}; 
 const hiddens: string[] = [];
 data.forEach((d: any) => {
 map[d.name] = d.image; 
 if(d.isHidden) hiddens.push(d.name);
 });
 setCategoryImages(map); 
 setHiddenCategories(hiddens);
 });
 m.categoryApi.getMeals().then((meals: any) => {
 if (Array.isArray(meals)) {
 const visibleMeals = meals.filter((mc: any) => !mc.isHidden).map((mc: any) => mc.name);
 if (visibleMeals.length > 0) setCustomerMealCategories(visibleMeals);
 }
 }).catch(() => {});
 });
 });
 socket.on('product:created', handleProductChange);
 socket.on('product:deleted', handleProductChange);
 socket.on('gst_rate_updated', handleGstUpdate);


 // Fast 3-second polling fallback for active order and product menu updates
 const intervalId = setInterval(() => {
 fetchActiveOrder();
 fetchProducts();
 }, 3000);

 return () => {
 clearInterval(intervalId);
 socket.emit('leave_room', `table_${currentTable}`);
 socket.off('order_updated', handleOrderChange);
 socket.off('table_status_updated', fetchActiveOrder);
 socket.off('product:updated', handleProductChange);
 socket.off('product:created', handleProductChange);
 socket.off('product:deleted', handleProductChange);
 socket.off('gst_rate_updated', handleGstUpdate);
 };
 }, [currentTable, selectedMealType]);

 const fetchProducts = async () => {
 try {
 const data = await productApi.getAll();
 const cleanData = Array.isArray(data) ? data.filter((p: any) => p.category !== 'Uncategorized') : [];
 setProducts(cleanData);
 } catch (err) {
 console.error('Failed to load menu:', err);
 }
 };

 // Auto-reset selectedSubCategory to 'All' if the category was deleted or hidden
 useEffect(() => {
 if (selectedSubCategory !== 'All' && products.length > 0) {
 const mealCats = products
 .filter(p => !p.isHidden && p.category && p.category !== 'Uncategorized' && !hiddenCategories.includes(p.category) && (!selectedMealType || selectedMealType === 'All' || (p as any).mealType?.toLowerCase() === selectedMealType.toLowerCase()))
 .map(p => p.category);
 if (!mealCats.includes(selectedSubCategory)) {
 setSelectedSubCategory('All');
 }
 }
 }, [products, selectedMealType, selectedSubCategory, hiddenCategories]);



 // Fetch ALL active orders whenever we enter the ALL_TRACK_ORDERS step
 useEffect(() => {
 if (step === 'ALL_TRACK_ORDERS') {
 fetchAllActiveOrders();
 }
 }, [step]);

 const fetchAllActiveOrders = async () => {
 try {
 const unpaidOrders = await orderApi.getAll({ paymentStatus: 'unpaid', mealType: selectedMealType });
 const active = (unpaidOrders || []).filter((o: Order) => o.status !== 'cancelled');
 active.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 setAllActiveOrders(active);
 } catch (err) {
 console.error('Failed to load all active orders:', err);
 }
 };

 const fetchActiveOrder = async () => {
 try {
 const data = await orderApi.getAll({ tableNumber: currentTable, paymentStatus: 'unpaid', mealType: selectedMealType });
 const active = (data || []).filter((o: Order) => o.status !== 'cancelled');
 active.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 if (active.length > 0) {
 setActiveOrder(active[0]);
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
 headers: { 'Content-[#111827]': 'application/json' },
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
 const existing = prev.find(item => item.product._id === product._id && item.memberId === activeMember);
 if (existing) {
 return prev.map(item =>
 (item.product._id === product._id && item.memberId === activeMember)
 ? { ...item, quantity: item.quantity + 1 }
 : item
 );
 }
 return [...prev, { product, quantity: 1, instructions: specialInstructions[`${activeMember}_${product._id}`] || '', memberId: activeMember }];
 });
 };

 const updateCartQuantity = (productId: string, memberId: string, delta: number) => {
 setCart(prev => {
 return prev.map(item => {
 if (item.product._id === productId && item.memberId === memberId) {
 const newQty = item.quantity + delta;
 return newQty > 0 ? { ...item, quantity: newQty } : null;
 }
 return item;
 }).filter(Boolean) as CartItem[];
 });
 };

 const updateInstructions = (productId: string, memberId: string, instructions: string) => {
 setSpecialInstructions(prev => ({ ...prev, [`${memberId}_${productId}`]: instructions }));
 setCart(prev =>
 prev.map(item =>
 (item.product._id === productId && item.memberId === memberId) ? { ...item, instructions } : item
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
 instructions: item.instructions,
 memberId: item.memberId
 }));

 const newOrder = await orderApi.create({
 tableNumber: currentTable,
 customerName: `Table ${currentTable} Guest`,
 items: orderItems,
 totalAmount: calculateTotal(),
 mealType: selectedMealType
 });

 setActiveOrder(newOrder);
 setCart([]);
 localStorage.setItem(`customer_cart_${currentTable}`, JSON.stringify([]));
 setShowCart(false);
 
 // Fetch AI prep time
 fetchAIRecommendation();
 setStep('TRACK_ORDER');
 } catch (error: any) {
 console.error('Failed to place order:', error);
 alert(error.message || 'Failed to place order. Please try again.');
 }
 };

 const isItemInPreparationOrReady = (_itemStatus?: string) => {
 return false;
 };

 const handleRemoveOrder = async (orderId: string) => {
 if (!orderId) return;

 if (!window.confirm('Are you sure you want to cancel and remove this entire live order?')) {
 return;
 }
 const targetOrderId = orderId;

 // Instant UI Reset (0ms delay)
 if (activeOrder && activeOrder._id === targetOrderId) {
 setActiveOrder(null);
 }
 setAllActiveOrders(prev => prev.filter(o => o._id !== targetOrderId));
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

 const handleDeleteItems = async (itemIdsToDelete: string[], customOrderId?: string) => {
 const targetOrderId = customOrderId || activeOrder?._id;
 if (!targetOrderId || itemIdsToDelete.length === 0) return;

 const count = itemIdsToDelete.length;
 const confirmMsg = count === 1
 ? 'Are you sure you want to delete this item from your live order?'
 : `Are you sure you want to delete these ${count} selected items from your live order?`;

 if (!window.confirm(confirmMsg)) return;

 try {
 const updatedOrder = await orderApi.update(targetOrderId, {
 deleteItemIds: itemIdsToDelete
 });

 if (!updatedOrder.items || updatedOrder.items.length === 0 || updatedOrder.status === 'cancelled') {
 if (activeOrder && activeOrder._id === targetOrderId) {
 setActiveOrder(null);
 }
 setAllActiveOrders(prev => prev.filter(o => o._id !== targetOrderId));
 } else {
 if (activeOrder && activeOrder._id === targetOrderId) {
 setActiveOrder(updatedOrder);
 }
 setAllActiveOrders(prev => prev.map(o => o._id === targetOrderId ? updatedOrder : o));
 }
 setSelectedDeleteItems([]);
 } catch (err: any) {
 alert('Failed to delete item(s): ' + (err.message || err));
 }
 };

 const handleDecrementItemQuantity = async (item: any, customOrderId?: string) => {
 const targetOrderId = customOrderId || activeOrder?._id;
 if (!targetOrderId || !item?._id) return;

 const currentQty = Number(item.quantity) || 1;
 if (currentQty <= 1) {
 return handleDeleteItems([item._id], targetOrderId);
 }

 const newQty = currentQty - 1;
 try {
 const updatedOrder = await orderApi.update(targetOrderId, {
 updateItemQuantity: { itemId: item._id, quantity: newQty }
 } as any);

 if (!updatedOrder.items || updatedOrder.items.length === 0 || updatedOrder.status === 'cancelled') {
 if (activeOrder && activeOrder._id === targetOrderId) {
 setActiveOrder(null);
 }
 setAllActiveOrders(prev => prev.filter(o => o._id !== targetOrderId));
 } else {
 if (activeOrder && activeOrder._id === targetOrderId) {
 setActiveOrder(updatedOrder);
 }
 setAllActiveOrders(prev => prev.map(o => o._id === targetOrderId ? updatedOrder : o));
 }
 } catch (err: any) {
 alert('Failed to update item quantity: ' + (err.message || err));
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
 return safeCat === mainCat;
 }).length;
 };

 // Filter items
 const filteredProducts = products.filter(p => {
 if (p.isHidden || p.category === 'Uncategorized' || hiddenCategories.includes(p.category)) return false;
 const safeName = p.name || '';
 const safeCat = p.category || '';
 const safeMealType = (p as any).mealType || 'Breakfast'; // Default to Breakfast if missing

 const matchesMeal = selectedMealType === 'All' || safeMealType.toLowerCase() === selectedMealType.toLowerCase();
 const matchesCat = selectedSubCategory === 'All' || safeCat === selectedSubCategory;
 
 const matchesSearch = safeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
 safeCat.toLowerCase().includes(searchQuery.toLowerCase());

 const itemPrice = p.isOffer && p.discountPrice ? p.discountPrice : p.price;
 let matchesPrice = true;
 if (selectedPriceTier === 'under100') matchesPrice = itemPrice < 100;
 else if (selectedPriceTier === '100-250') matchesPrice = itemPrice >= 100 && itemPrice <= 250;
 else if (selectedPriceTier === '250-500') matchesPrice = itemPrice >= 250 && itemPrice <= 500;
 else if (selectedPriceTier === 'above500') matchesPrice = itemPrice > 500;

 return matchesMeal && matchesCat && matchesSearch && matchesPrice;
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
 
 // Ensure"Preparing" step is highlighted if there are preparing items
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
 <div className="min-h-[100dvh] bg-[#FFFFFF] flex items-center justify-center p-6 text-[#111827]">
 <div className="text-center space-y-6 max-w-sm w-full">
 {/* Logo */}
 <div className="flex justify-center">
 <div className="w-20 h-20 rounded-3xl bg-[#4C1D95] flex items-center justify-center shadow-xl shadow-[#4C1D95]/30 animate-bounce">
 <Coffee size={36} className="text-white" />
 </div>
 </div>

 <div>
 <h1 className="text-3xl font-black text-[#4C1D95]">
 VPN Restaurant
 </h1>
 <p className="text-[#4B5563] text-sm mt-1 font-medium">Smart Dining Experience</p>
 </div>

 {/* Table Badge */}
 <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-[#D1D5DB] shadow-md">
 <div className="w-10 h-10 rounded-xl bg-[#4C1D95]/10 flex items-center justify-center">
 <span className="text-[#4C1D95] font-black text-lg">{currentTable}</span>
 </div>
 <div className="text-left">
 <p className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Your Table</p>
 <p className="text-[#111827] font-bold">Table {currentTable}</p>
 </div>
 <CheckCircle size={20} className="text-[#4C1D95] ml-2" />
 </div>

 <p className="text-[#4B5563] text-sm">
 QR Scan Verified! Loading your setup now...
 </p>

 <button
 onClick={() => setQrScanConfirmed(false)}
 className="w-full py-4 rounded-2xl bg-[#4C1D95] text-white font-extrabold text-base shadow-lg shadow-[#4C1D95]/30 hover:bg-[#5B21B6] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
 >
 <ShoppingBag size={20} />
 Tap to Continue
 </button>
 </div>
 </div>
 );
 }

 
 // Auto-reconstruct members from activeOrder (so they persist across device/cache resets)
 useEffect(() => {
 if (activeOrder && activeOrder.items && activeOrder.status !== 'cancelled') {
 const orderedMemberIds = [...new Set(activeOrder.items.map((i: any) => i.memberId).filter(Boolean))];
 
 setTableMembers(prev => {
 const newMembers = [...prev];
 let changed = false;
 
 (orderedMemberIds as string[]).forEach((id: string) => {
 if (!newMembers.find(m => m.id === id)) {
 newMembers.push({ id, name: `Member ${id.replace('M', '')}` });
 changed = true;
 }
 });
 
 if (changed) {
 newMembers.sort((a, b) => parseInt(a.id.replace('M','')) - parseInt(b.id.replace('M','')));
 return newMembers;
 }
 return prev;
 });
 }
 }, [activeOrder]);


 const renderBottomNav = () => (
 <div className="bg-white border-t border-[#e5e7eb] px-1.5 pt-2 pb-2 sm:pb-3 flex items-center justify-between z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 w-full shrink-0">
 <div className="flex items-center justify-center w-full max-w-sm mx-auto gap-3">
 <button
 onClick={() => setStep('SELECT_TABLE')}
 className={`flex-1 px-2 py-3 text-xs rounded-xl border border-[#4C1D95] font-black cursor-pointer shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 ${step === 'SELECT_TABLE' ? 'bg-[#4C1D95] text-white shadow-md' : 'bg-white text-[#4C1D95] hover:bg-[#4C1D95] hover:text-white'}`}
 >
 <span className="text-[16px]">🏠</span>
 <span>Table</span>
 </button>
 <button
 onClick={() => setStep('ALL_TRACK_ORDERS')}
 className={`flex-1 px-2 py-3 text-xs rounded-xl border border-[#4C1D95] font-black cursor-pointer shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 ${(step === 'TRACK_ORDER' || step === 'ALL_TRACK_ORDERS') ? 'bg-[#4C1D95] text-white shadow-md' : 'bg-white text-[#4C1D95] hover:bg-[#4C1D95] hover:text-white'}`}
 >
 <span className="text-[16px]">⏱️</span>
 <span>Track Order</span>
 </button>
 </div>
 </div>
 );

 if (step === 'SELECT_TABLE') {
 return (
 <div className="h-[100dvh] bg-[#F3F4F6] sm:bg-[#E5E7EB] flex flex-col text-[#111827] overflow-hidden"><div className="flex-1 flex flex-col items-center p-2 sm:p-4 overflow-y-auto">
 <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-[#D1D5DB] min-h-[550px] my-auto flex flex-col justify-center shrink-0">
 <div className="flex flex-col items-center mb-3">
 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#4C1D95] flex items-center justify-center shadow-lg shadow-[#4C1D95]/20 mb-2">
 <Coffee size={30} className="text-white" />
 </div>
 <h2 className="text-2xl font-black text-[#4C1D95]">Select Your Table</h2>
 <p className="text-[#4B5563] text-sm mt-1 text-center font-semibold">
 Please select the table you are seated at to begin.
 </p>
 </div>
 
 

 
 <div className="grid grid-cols-3 gap-2 mb-3">
 {customerMealCategories.map(meal => (
 <button
 key={meal}
 onClick={() => setSelectedMealType(meal)}
 className={`w-full px-2 py-2 rounded-xl font-extrabold text-sm transition-all cursor-pointer border-2 truncate ${
 selectedMealType === meal 
 ? 'bg-[#4C1D95] text-white border-[#4C1D95] shadow-lg' 
 : 'bg-white text-[#4C1D95] border-[#D1D5DB] hover:bg-[#F9FAFB] hover:border-[#4C1D95]'
 }`}
 >
 {meal}
 </button>
 ))}
 </div>

 <div className="grid grid-cols-3 gap-2">
 {customerTablesList.map(num => (
 <button
 key={num}
 onClick={() => {
 setTableMembers([{id: 'M1', name: 'Member 1'}]);
 setCart([]);
 localStorage.setItem(`customer_cart_${currentTable}`, JSON.stringify([]));
 setActiveMember('M1');
 localStorage.setItem(`customer_tableMembers_${num}`, JSON.stringify([{id: 'M1', name: 'Member 1'}]));
 localStorage.setItem(`customer_cart_${num}`, JSON.stringify([]));
 localStorage.setItem(`customer_activeMember_${num}`, 'M1');
 setCurrentTable(num);
 setStep('MANAGE_MEMBERS');
 }}
 className={`py-2 sm:py-3 border rounded-xl font-black text-xl transition-all shadow-sm active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 ${currentTable === num ? 'bg-[#4C1D95] text-white border-[#4C1D95] scale-105 shadow-md' : 'bg-[#F9FAFB] border-[#D1D5DB] text-[#4C1D95] hover:bg-[#4C1D95] hover:text-white'}`}
 >
 <span>{num}</span>
 <span className="text-[9px] uppercase tracking-wider font-bold opacity-70">Table</span>
 </button>
 ))}
 </div>
 
 {customerTablesList.length === 0 && (
 <div className="text-center p-6 border border-dashed border-[#D1D5DB] rounded-xl text-[#4B5563]">
 No tables available. Please contact admin.
 </div>
 )}
 
 

 </div>

 <div className="w-full max-w-md mt-2">
 <button 
 onClick={handleLogout} 
 className="w-full py-2 sm:py-3 rounded-xl border border-[#D1D5DB] bg-white text-[#4B5563] font-bold text-sm hover:bg-[#F9FAFB] hover:border-[#4B5563] transition-all cursor-pointer active:scale-95 shadow-sm"
 >
 🚪 Logout
 </button>
 </div>
 </div>
 {renderBottomNav()}
 </div>

 );
 }
 if (step === 'MANAGE_MEMBERS') {
 const handleAddMember = () => {
 const nextId = `M${tableMembers.length + 1}`;
 const name = newMemberName.trim() || `Member ${tableMembers.length + 1}`;
 setTableMembers([...tableMembers, { id: nextId, name }]);
 setNewMemberName('');
 };
 
 const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
 
 return (
 <div className="min-h-[100dvh] bg-[#FFFFFF] flex flex-col items-center p-6 text-[#111827]">
 <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-[#D1D5DB] flex flex-col h-[85vh] overflow-hidden mt-6">
 <div className="bg-gradient-to-r from-[#4C1D95] to-[#5B21B6] p-6 text-center shrink-0 relative">
 
 <h2 className="text-2xl font-black text-white">Table {currentTable}</h2>
 <p className="text-[#F3F4F6] text-sm mt-1 font-semibold">Select a member to order food.</p>
 </div>
 
 <div className="flex-1 overflow-y-auto p-6 space-y-4">
 
 
 
 <div className="space-y-3">
 <h3 className="font-extrabold text-[#4C1D95] text-sm uppercase tracking-wider border-b border-[#D1D5DB] pb-2">Seated Members</h3>
 {tableMembers.map(m => {
 const memberItems = cart.filter(c => c.memberId === m.id);
 const placedItems = activeOrder?.items?.filter((item: any) => item.memberId === m.id && item.status !== 'cancelled') || [];
 const memberItemCount = memberItems.reduce((sum, item) => sum + item.quantity, 0);
 const placedItemCount = placedItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

 return (
 <div key={m.id} 
 onClick={() => {
 setActiveMember(m.id);
 setStep('MENU');
 }}
 className="p-3.5 bg-[#F9FAFB] hover:bg-white border border-[#D1D5DB] hover:border-[#4C1D95] rounded-xl shadow-sm space-y-3 cursor-pointer transition-all"
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-[#4C1D95]/10 text-[#4C1D95] flex items-center justify-center font-black text-xs border border-[#4C1D95]/20">
 {m.id}
 </div>
 <div>
 <span className="font-bold text-[#111827] block">{m.name}</span>
 {(memberItemCount > 0 || placedItemCount > 0) ? (
 <span className="text-[10px] font-bold">
 {placedItemCount > 0 && <span className="text-green-600">{placedItemCount} ordered </span>}
 {placedItemCount > 0 && memberItemCount > 0 && <span className="text-[#9CA3AF]">· </span>}
 {memberItemCount > 0 && <span className="text-[#4C1D95]">{memberItemCount} unplaced</span>}
 </span>
 ) : (
 <span className="text-[10px] text-[#9CA3AF]">No items yet</span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 
 {tableMembers.length > 1 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 const confirm = window.confirm(`Remove ${m.name} from the table?\n\nTheir unplaced selected items will be removed.`);
 if (confirm) {
 setTableMembers(prev => prev.filter(tm => tm.id !== m.id));
 setCart(prev => prev.filter(c => c.memberId !== m.id));
 }
 }}
 className="p-2 bg-neutral-50 text-[#D1D5DB] hover:text-white hover:bg-[#D1D5DB] rounded-lg transition-colors cursor-pointer"
 title="Remove Member"
 >
 <Trash2 size={16} />
 </button>
 )}
 </div>
 </div>
 {(memberItems.length > 0 || placedItems.length > 0) && (
 <div className="pt-2 border-t border-[#D1D5DB]/50 space-y-2">
 {/* PLACED ITEMS */}
 {placedItems.map((item: any, idx: number) => (
 <div key={`placed-${idx}`} className="flex justify-between items-center text-xs opacity-75">
 <span className="font-semibold text-[#111827] truncate flex-1 pr-2">
 <span className="text-green-600 mr-1">✓</span>{item.product?.name || item.name || 'Food Item'} <span className="text-green-600 font-bold">x{item.quantity}</span>
 </span>
 <div className="flex items-center gap-1.5 shrink-0">
 {item.status && item.status !== 'pending' && (
 <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
 item.status === 'ready' || item.status === 'served' ? 'bg-green-100 text-green-700' :
 item.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
 'bg-gray-200 text-gray-700'
 }`}>
 {item.status}
 </span>
 )}
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteItems([item._id]);
 }}
 className="text-[#4C1D95] hover:text-white bg-[#4C1D95]/10 hover:bg-[#4C1D95] p-1.5 rounded-md transition-colors shrink-0 cursor-pointer"
 title="Delete item from order"
 >
 <Trash2 size={12} />
 </button>
 </div>
 </div>
 ))}
 
 {/* UNPLACED ITEMS */}
 {memberItems.map(item => (
 <div key={item.product._id} className="flex justify-between items-center text-xs">
 <span className="font-semibold text-[#111827] truncate flex-1 pr-2">{item.product.name} <span className="text-[#4C1D95] font-bold">x{item.quantity}</span></span>
 <button
 onClick={(e) => { e.stopPropagation(); updateCartQuantity(item.product._id, m.id, -item.quantity); }}
 className="text-[#D1D5DB] hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 p-1.5 rounded-md transition-colors shrink-0 cursor-pointer"
 title="Remove item"
 >
 <Trash2 size={12} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 
 <div className="pt-4 space-y-3">
 <h3 className="font-extrabold text-[#4C1D95] text-sm uppercase tracking-wider">Add Member</h3>
 <div className="flex gap-2 w-full">
 <button
 onClick={() => {
 if (tableMembers.length > 0) setActiveMember(tableMembers[0].id);
 setStep('MENU');
 }}
 className="flex-1 py-3 .5 bg-gradient-to-r from-[#4C1D95] to-[#5B21B6] hover:from-[#3B1275] hover:to-[#4C1D95] text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
 >
 <ShoppingBag size={18} />
 <span>Open Menu & Order Food</span>
 </button>
 <button
 onClick={handleAddMember}
 className="px-5 py-3 .5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center"
 >
 <Plus size={22} strokeWidth={3} />
 </button>
 </div>
 <div className="mt-8 mb-4">
 {/* LIVE ORDER TRACKER WITH SINGLE & MULTI ITEM DELETION */}
 {activeOrder && activeOrder.status !== 'cancelled' && (
 <div className="mx-2 .5 mt-2.5 .5 bg-white border border-[#4C1D95]/30 rounded-2xl p-3 .5 shadow-sm space-y-3">
 <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
 <div className="flex items-center gap-1.5 min-w-0">
 <div className="p-1 .5 rounded-lg bg-[#4C1D95]/10 text-[#4C1D95] shrink-0">
 <ChefHat size={14} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-1">
 <span className="font-black text-[11px] text-[#111827] truncate">Order #{activeOrder._id.slice(-4)}</span>
 <span className="text-[7px] uppercase font-black bg-[#4C1D95] text-white px-1.5 py-0.2 rounded-full shrink-0">
 {activeOrder.status}
 </span>
 </div>
 <p className="text-[9px] text-[#4C1D95] font-bold truncate">{getStepStatusText()}</p>
 </div>
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 <span className="font-black text-xs text-[#4C1D95] font-mono">₹{activeOrder.totalAmount}</span>
 {activeOrder.status !== 'served' && (
 <button 
 onClick={() => handleRemoveOrder(activeOrder._id)} 
 className="p-1 .5 bg-[#F9FAFB] rounded-lg cursor-pointer text-[#4C1D95] hover:bg-[#4C1D95] hover:text-white transition-all text-[10px] font-bold flex items-center gap-1"
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
 <div className="flex justify-between text-[8px] font-bold text-[#D1D5DB] mb-1">
 <span>Order Progress</span><span className="text-[#4C1D95]">{currentPercent}%</span>
 </div>
 <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
 <div className="h-full bg-gradient-to-r from-[#4C1D95] to-[#4C1D95] rounded-full transition-all duration-700" style={{ width: `${currentPercent}%` }} />
 </div>
 </div>

 {/* LIVE ITEMS & DELETION LIST (Single & Multi-Item Delete) */}
 <div className="space-y-2 pt-1 border-t border-[#F3F4F6]">
 <div className="flex items-center justify-between">
 <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4B5563]">
 Items in Live Order ({activeOrder.items?.length || 0})
 </span>
 {selectedDeleteItems.length > 0 && (
 <button
 onClick={() => setSelectedDeleteItems([])}
 className="text-[9px] font-bold text-[#4B5563] hover:text-[#111827] underline cursor-pointer"
 >
 Clear Selection
 </button>
 )}
 </div>

 {/* Multi-Item Delete Action Bar */}
 {selectedDeleteItems.length > 0 && (
 <div className="bg-[#4C1D95] text-white px-2.5 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold shadow-md animate-fade-in">
 <span>{selectedDeleteItems.length} item(s) selected</span>
 <button
 onClick={() => handleDeleteItems(selectedDeleteItems)}
 className="bg-white text-[#4C1D95] hover:bg-[#F9FAFB] px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-xs"
 >
 <Trash2 size={11} />
 <span>Delete Selected ({selectedDeleteItems.length})</span>
 </button>
 </div>
 )}

 {/* Interactive Items List */}
 <div className="space-y-1.5">
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
 ? 'bg-[#4C1D95]/10 border-[#4C1D95]' 
 : 'bg-[#F9FAFB] border-[#F3F4F6] hover:border-[#D1D5DB]'
 }`}
 >
 {/* Checkbox & Details */}
 <div className="flex items-center gap-2 min-w-0">
 {isLockedFromDelete ? (
 <div 
 title="Chef preparation start pannitaar! Intha item-a select panna mudiyadhu."
 className="w-3.5 h-3.5 flex items-center justify-center opacity-40 cursor-not-allowed"
 >
 <Lock size={10} className="text-neutral-700" />
 </div>
 ) : (
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleSelectItemForDelete(item._id)}
 className="accent-[#4C1D95] w-3.5 h-3.5 cursor-pointer rounded"
 />
 )}
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="font-bold text-[#111827] truncate text-[11px]">{nm}</span>
 <span className="text-[#4C1D95] font-extrabold bg-[#4C1D95]/10 px-1.5 py-0.2 rounded text-[9px]">x{item.quantity}</span>
 </div>
 <div className="flex items-center gap-2 text-[9px] text-[#4B5563]">
 <span>₹{price * item.quantity}</span>
 <span className={`px-1.5 py-0.2 rounded-full font-bold uppercase text-[8px] ${
 st === 'ready' || st === 'delivered'
 ? 'bg-neutral-100 text-neutral-700'
 : isLockedFromDelete
 ? 'bg-neutral-100 text-[#5B21B6] font-extrabold border border-neutral-300'
 : 'bg-neutral-100 text-neutral-700'
 }`}>
 {st}
 </span>
 </div>
 </div>
 </div>

 {/* Delete or Locked Badge */}
 {isLockedFromDelete ? (
 <div 
 onClick={() => alert(`Chef preparation start pannitaar!"${nm}" item-a delete panna mudiyadhu.`)}
 className="flex items-center gap-1 px-2 py-1 bg-[#D1D5DB]/10 text-neutral-700 border border-neutral-200 rounded-lg text-[9px] font-extrabold cursor-pointer hover:bg-[#D1D5DB]/20 transition-all shrink-0 ml-1.5"
 title="Preparation started in kitchen - Deletion locked"
 >
 <Lock size={11} />
 <span>In Kitchen</span>
 </div>
 ) : (
 <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
 {item.quantity > 1 && (
 <button
 onClick={() => handleDecrementItemQuantity(item)}
 className="px-2 py-1 bg-[#4C1D95]/10 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-lg font-extrabold text-[11px] flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
 title={`Remove 1 ${nm} (change x${item.quantity} to x${item.quantity - 1})`}
 >
 <Minus size={11} strokeWidth={3} />
 <span>1</span>
 </button>
 )}
 <button
 onClick={() => handleDeleteItems([item._id])}
 className="p-1.5 bg-[#4C1D95]/10 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
 title={item.quantity > 1 ? `Delete all ${item.quantity}x ${nm}` : `Delete ${nm}`}
 >
 <Trash2 size={12} />
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Full Width Cancel All Button */}
 <button
 onClick={() => handleRemoveOrder(activeOrder._id)}
 className="w-full py-2 bg-[#F9FAFB] hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98] mt-2"
 >
 <Trash2 size={13} />
 <span>Cancel Entire Live Order</span>
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 {renderBottomNav()}
 </div>
 );
 }


 if (step === 'ALL_TRACK_ORDERS') {
 return (
 <div id="customerPage" data-testid="customerPage" className="h-[100dvh] w-full bg-[#FFFFFF] text-[#111827] flex flex-col overflow-hidden">
 <header className="shrink-0 bg-white border-b border-[#e5e7eb] px-3 py-2 flex items-center justify-between z-40 shadow-sm">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
 <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
 </div>
 <div>
 <h1 className="font-black text-xs text-[#4C1D95] leading-none">All Tables Tracking</h1>
 <p className="text-[9px] text-[#4B5563] font-bold mt-0.5">Global Track Order</p>
 </div>
 </div>
 <button
 onClick={() => setStep('SELECT_TABLE')}
 className="text-[9px] text-[#4C1D95] bg-white hover:bg-[#4C1D95] hover:text-white px-3 py-1.5 rounded-xl border border-[#4C1D95] font-black cursor-pointer shadow-sm transition-all active:scale-95 flex items-center gap-1"
 >
 <span>← Back</span>
 </button>
 </header>

 <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-4">
 <div className="max-w-3xl mx-auto space-y-4">
 {allActiveOrders.length === 0 ? (
 <div className="text-center p-10 border border-dashed border-[#D1D5DB] rounded-2xl bg-white shadow-sm mt-10">
 <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
 <CheckCircle size={30} className="text-[#9CA3AF]" />
 </div>
 <h3 className="text-xl font-black text-[#111827]">No Active Orders</h3>
 <p className="text-[#4B5563] mt-2">There are currently no live orders for any table.</p>
 </div>
 ) : (
 allActiveOrders.map(order => {
 let currentPercent = 0;
 if (order.status === 'pending') currentPercent = 20;
 else if (order.status === 'preparing') currentPercent = 60;
 else if (order.status === 'ready' || order.status === 'served') currentPercent = 100;
 
 return (
 <div key={order._id} className="bg-white border border-[#D1D5DB] rounded-2xl p-4 shadow-sm">
 <div className="flex justify-between items-center mb-4">
 <div>
 <h2 className="text-xl font-black text-[#4C1D95]">Table {order.tableNumber}</h2>
 <p className="text-xs text-[#4B5563] font-bold">Order #{order._id.slice(-4)} • <span className="text-[#4C1D95] font-black font-mono">₹{order.totalAmount}</span></p>
 </div>
 <div className="flex items-center gap-2">
 <div className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
 (order.status === 'ready' || order.status === 'served') ? 'bg-green-100 text-green-700' :
 order.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
 'bg-blue-100 text-blue-700'
 }`}>
 {order.status}
 </div>
 <button
 onClick={() => handleRemoveOrder(order._id)}
 className="p-1.5 bg-[#F9FAFB] rounded-lg cursor-pointer text-[#4C1D95] hover:bg-[#4C1D95] hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 border border-[#E5E7EB]"
 title="Cancel Entire Order"
 >
 <Trash2 size={12} />
 </button>
 </div>
 </div>
 
 {/* Progress Bar */}
 <div className="mb-4">
 <div className="flex justify-between text-[10px] font-bold text-[#9CA3AF] mb-1.5">
 <span>Overall Progress</span><span>{currentPercent}%</span>
 </div>
 <div className="w-full bg-[#F3F4F6] rounded-full h-2 overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-700 ${
 (order.status === 'ready' || order.status === 'served') ? 'bg-green-500' :
 order.status === 'preparing' ? 'bg-yellow-500' :
 'bg-blue-500'
 }`} style={{ width: `${currentPercent}%` }} />
 </div>
 </div>
 
 {/* Items List (compact) */}
 <div className="space-y-1.5 bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB]">
 {order.items?.map((item: any, i: number) => (
 <div key={item._id || i} className="flex justify-between items-center text-xs">
 <div className="flex items-center gap-2">
 <span className="font-bold text-[#111827]">{item.quantity}x</span>
 <span className="text-[#4B5563] font-medium">{item.product?.name || item.name || 'Unknown Item'}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
 (item.status === 'ready' || item.status === 'served') ? 'bg-green-100 text-green-700' :
 item.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
 'bg-gray-200 text-gray-700'
 }`}>
 {item.status}
 </span>
 {item.quantity > 1 && (
 <button
 onClick={() => handleDecrementItemQuantity(item, order._id)}
 className="px-2 py-1 bg-[#4C1D95]/10 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-lg font-extrabold text-[11px] flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
 title={`Remove 1 ${item.product?.name || item.name || 'Item'}`}
 >
 <Minus size={11} strokeWidth={3} />
 <span>1</span>
 </button>
 )}
 <button
 onClick={() => handleDeleteItems([item._id], order._id)}
 className="p-1.5 bg-[#4C1D95]/10 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
 title="Delete Food Item"
 >
 <Trash2 size={12} />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 {renderBottomNav()}
 </div>
 );
 }

 if (step === 'TRACK_ORDER') {
 return (
 <div id="customerPage" data-testid="customerPage" className="h-[100dvh] w-full bg-[#FFFFFF] text-[#111827] flex flex-col overflow-hidden">
 <header className="shrink-0 bg-white border-b border-[#e5e7eb] px-3 py-2 flex items-center justify-between z-40 shadow-sm">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
 <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
 </div>
 <div>
 <h1 className="font-black text-xs text-[#4C1D95] leading-none">Track Order</h1>
 <p className="text-[9px] text-[#4B5563] font-bold mt-0.5">Table {currentTable}</p>
 </div>
 </div>
 </header>
 <div className="flex-1 overflow-y-auto bg-[#FFFFFF] p-2">
 {/* NO ACTIVE ORDER FALLBACK */}
 {(!activeOrder || activeOrder.status === 'cancelled') && (
 <div className="mt-20 flex flex-col items-center justify-center text-center p-6 bg-white mx-4 rounded-2xl shadow-sm border border-neutral-200">
 <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
 <CheckCircle size={40} className="text-neutral-400" />
 </div>
 <h3 className="text-2xl font-black text-neutral-800">No Active Orders</h3>
 <p className="text-neutral-500 mt-2 font-medium">There are currently no live orders for this table.</p>
 <button 
 onClick={() => setStep('MENU')}
 className="mt-6 px-6 py-3 bg-[#4C1D95] text-white font-bold rounded-xl active:scale-95 transition-all"
 >
 Browse Menu
 </button>
 </div>
 )}
 
 {/* LIVE ORDER TRACKER WITH SINGLE & MULTI ITEM DELETION */}
 {activeOrder && activeOrder.status !== 'cancelled' && (
 <div className="mx-2 .5 mt-2.5 .5 bg-white border border-[#4C1D95]/30 rounded-2xl p-3 .5 shadow-sm space-y-3">
 <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
 <div className="flex items-center gap-1.5 min-w-0">
 <div className="p-1 .5 rounded-lg bg-[#4C1D95]/10 text-[#4C1D95] shrink-0">
 <ChefHat size={14} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-1">
 <span className="font-black text-[11px] text-[#111827] truncate">Order #{activeOrder._id.slice(-4)}</span>
 <span className="text-[7px] uppercase font-black bg-[#4C1D95] text-white px-1.5 py-0.2 rounded-full shrink-0">
 {activeOrder.status}
 </span>
 </div>
 <p className="text-[9px] text-[#4C1D95] font-bold truncate">{getStepStatusText()}</p>
 </div>
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 <span className="font-black text-xs text-[#4C1D95] font-mono">₹{activeOrder.totalAmount}</span>
 {activeOrder.status !== 'served' && (
 <button 
 onClick={() => handleRemoveOrder(activeOrder._id)} 
 className="p-1 .5 bg-[#F9FAFB] rounded-lg cursor-pointer text-[#4C1D95] hover:bg-[#4C1D95] hover:text-white transition-all text-[10px] font-bold flex items-center gap-1"
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
 <div className="flex justify-between text-[8px] font-bold text-[#D1D5DB] mb-1">
 <span>Order Progress</span><span className="text-[#4C1D95]">{currentPercent}%</span>
 </div>
 <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
 <div className="h-full bg-gradient-to-r from-[#4C1D95] to-[#4C1D95] rounded-full transition-all duration-700" style={{ width: `${currentPercent}%` }} />
 </div>
 </div>

 {/* LIVE ITEMS & DELETION LIST (Single & Multi-Item Delete) */}
 <div className="space-y-2 pt-1 border-t border-[#F3F4F6]">
 <div className="flex items-center justify-between">
 <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4B5563]">
 Items in Live Order ({activeOrder.items?.length || 0})
 </span>
 {selectedDeleteItems.length > 0 && (
 <button
 onClick={() => setSelectedDeleteItems([])}
 className="text-[9px] font-bold text-[#4B5563] hover:text-[#111827] underline cursor-pointer"
 >
 Clear Selection
 </button>
 )}
 </div>

 {/* Multi-Item Delete Action Bar */}
 {selectedDeleteItems.length > 0 && (
 <div className="bg-[#4C1D95] text-white px-2.5 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-bold shadow-md animate-fade-in">
 <span>{selectedDeleteItems.length} item(s) selected</span>
 <button
 onClick={() => handleDeleteItems(selectedDeleteItems)}
 className="bg-white text-[#4C1D95] hover:bg-[#F9FAFB] px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-xs"
 >
 <Trash2 size={11} />
 <span>Delete Selected ({selectedDeleteItems.length})</span>
 </button>
 </div>
 )}

 {/* Interactive Items List */}
 <div className="space-y-1.5">
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
 ? 'bg-[#4C1D95]/10 border-[#4C1D95]' 
 : 'bg-[#F9FAFB] border-[#F3F4F6] hover:border-[#D1D5DB]'
 }`}
 >
 {/* Checkbox & Details */}
 <div className="flex items-center gap-2 min-w-0">
 {isLockedFromDelete ? (
 <div 
 title="Chef preparation start pannitaar! Intha item-a select panna mudiyadhu."
 className="w-3.5 h-3.5 flex items-center justify-center opacity-40 cursor-not-allowed"
 >
 <Lock size={10} className="text-neutral-700" />
 </div>
 ) : (
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => toggleSelectItemForDelete(item._id)}
 className="accent-[#4C1D95] w-3.5 h-3.5 cursor-pointer rounded"
 />
 )}
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="font-bold text-[#111827] truncate text-[11px]">{nm}</span>
 <span className="text-[#4C1D95] font-extrabold bg-[#4C1D95]/10 px-1.5 py-0.2 rounded text-[9px]">x{item.quantity}</span>
 </div>
 <div className="flex items-center gap-2 text-[9px] text-[#4B5563]">
 <span>₹{price * item.quantity}</span>
 <span className={`px-1.5 py-0.2 rounded-full font-bold uppercase text-[8px] ${
 st === 'ready' || st === 'delivered'
 ? 'bg-neutral-100 text-neutral-700'
 : isLockedFromDelete
 ? 'bg-neutral-100 text-[#5B21B6] font-extrabold border border-neutral-300'
 : 'bg-neutral-100 text-neutral-700'
 }`}>
 {st}
 </span>
 </div>
 </div>
 </div>

 {/* Delete or Locked Badge */}
 {isLockedFromDelete ? (
 <div 
 onClick={() => alert(`Chef preparation start pannitaar!"${nm}" item-a delete panna mudiyadhu.`)}
 className="flex items-center gap-1 px-2 py-1 bg-[#D1D5DB]/10 text-neutral-700 border border-neutral-200 rounded-lg text-[9px] font-extrabold cursor-pointer hover:bg-[#D1D5DB]/20 transition-all shrink-0 ml-1.5"
 title="Preparation started in kitchen - Deletion locked"
 >
 <Lock size={11} />
 <span>In Kitchen</span>
 </div>
 ) : (
 <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
 {item.quantity > 1 && (
 <button
 onClick={() => handleDecrementItemQuantity(item)}
 className="px-2 py-1 bg-[#4C1D95]/10 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-lg font-extrabold text-[11px] flex items-center gap-0.5 transition-colors cursor-pointer shrink-0"
 title={`Remove 1 ${nm} (change x${item.quantity} to x${item.quantity - 1})`}
 >
 <Minus size={11} strokeWidth={3} />
 <span>1</span>
 </button>
 )}
 <button
 onClick={() => handleDeleteItems([item._id])}
 className="p-1.5 bg-[#4C1D95]/10 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
 title={item.quantity > 1 ? `Delete all ${item.quantity}x ${nm}` : `Delete ${nm}`}
 >
 <Trash2 size={12} />
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Full Width Cancel All Button */}
 <button
 onClick={() => handleRemoveOrder(activeOrder._id)}
 className="w-full py-2 bg-[#F9FAFB] hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98] mt-2"
 >
 <Trash2 size={13} />
 <span>Cancel Entire Live Order</span>
 </button>
 </div>
 </div>
 )}
 </div>
 

 {renderBottomNav()}
 {showCustomerReceiptModal && activeOrder && (
 <SmartReceiptModal
 order={activeOrder}
 onClose={() => setShowCustomerReceiptModal(false)}
 />
 )}
 </div>
 );
 }

 return (
 <div id="customerPage" data-testid="customerPage" className="h-[100dvh] w-full bg-[#FFFFFF] text-[#111827] flex flex-col overflow-hidden">

 {/* ═══════════ TOP HEADER (Responsive for all screens) ═══════════ */}
 <header id="customerHeader" data-testid="customerHeader" className="shrink-0 bg-white border-b border-[#e5e7eb] px-2.5 py-2 .5 flex items-center justify-between z-40 shadow-sm">
 <div className="flex items-center gap-1.5 .5 min-w-0">
 <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
 <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
 </div>
 <div className="min-w-0">
 <h1 className="font-black text-xs tracking-tight text-[#4C1D95] leading-none truncate">VPN Restaurant</h1>
 
 </div>
 </div>
 </header>

 {/* ═══════════ BODY — sidebar + scrollable content ═══════════ */}
 <div className="flex flex-1 overflow-hidden flex-col">
 
 {/* HORIZONTAL MEMBER SELECTOR */}
 <div className="bg-white border-b border-[#e5e7eb] px-3 py-2.5 flex gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar shrink-0 shadow-sm z-20">
 {tableMembers.map((m) => (
 <button 
 key={m.id}
 onClick={() => setActiveMember(m.id)}
 className={`px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 border ${activeMember === m.id ? 'bg-[#4C1D95] text-white border-[#4C1D95]' : 'bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB] hover:bg-[#E5E7EB]'}`}
 >
 {m.name} {activeMember === m.id && '✓'}
 </button>
 ))}
 </div>

 <div className="flex flex-1 overflow-hidden">
 
 {/* ─── SCROLLABLE CONTENT ─── */}
 <div className="flex-1 overflow-y-auto bg-[#FFFFFF] min-w-0">

 {/* STICKY SEARCH + CATEGORY PILLS */}
 <div className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E5E7EB] shadow-sm">

 {/* Search bar */}
 <div className="px-3 pt-2.5 pb-1">
 <div className="relative w-full">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C1D95]" size={13} />
 <input
 type="text"
 placeholder="Search food items..."
 className="w-full bg-white border border-[#D1D5DB] rounded-xl pl-9 pr-8 py-2 text-xs text-[#4C1D95] font-semibold focus:outline-none focus:border-[#4C1D95] placeholder:text-[#4C1D95] shadow-inner"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 {searchQuery !== '' && (
 <button 
 onClick={() => setSearchQuery('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4C1D95] hover:text-[#111827] p-1.5 cursor-pointer"
 >
 ✕
 </button>
 )}
 </div>
 </div>

 
 {/* Category Image Icons (Swiggy Style) */}
 <div className="flex overflow-x-auto gap-4 px-3 pb-3 pt-2 scrollbar-hide" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
 {['All', ...Array.from(new Set(
 products.filter(p => !p.isHidden && p.category && p.category !== 'Uncategorized' && (!selectedMealType || selectedMealType === 'All' || (p as any).mealType?.toLowerCase() === selectedMealType.toLowerCase())).map(p => p.category)
 .filter(Boolean)
 ))].filter(cat => !hiddenCategories.includes(cat)).map(cat => {
 // Find image for this category
 let catImage = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500'; // Default
 if (cat === 'All') {
 catImage = 'https://images.unsplash.com/photo-1495474472201-4efa183b15ab?w=500'; // All items image
 } else {
 const firstProd = products.find(p => p.category === cat && p.image);
 if (firstProd) catImage = firstProd.image;
 if (categoryImages[cat as string]) catImage = categoryImages[cat as string];
 }

 const isSelected = selectedSubCategory === cat;

 return (
 <button
 key={cat as string}
 onClick={() => setSelectedSubCategory(cat as string)}
 className="flex flex-col items-center gap-1.5 min-w-[65px] cursor-pointer group shrink-0"
 >
 <div className={`w-14 h-14 rounded-full overflow-hidden transition-all duration-200 ${
 isSelected 
 ? 'border-2 border-[#4C1D95] ring-4 ring-[#4C1D95]/20 shadow-md scale-105' 
 : 'border border-[#D1D5DB] shadow-sm group-hover:scale-105 group-hover:shadow-md'
 }`}>
 <img 
 src={catImage} 
 alt={cat as string} 
 className="w-full h-full object-cover"
 onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500'; }}
 />
 </div>
 <span className={`text-[10px] font-bold text-center leading-tight transition-colors ${
 isSelected ? 'text-[#4C1D95]' : 'text-[#4B5563] group-hover:text-[#111827]'
 }`}>
 {cat as string}
 </span>
 </button>
 );
 })}
 </div>
 </div>

 {/* MENU GRID (Fluid Responsive Cards for all Phone & Tablet sizes) */}
 <div className="p-2 .5">
 <p className="text-[10px] text-[#9CA3AF] font-bold px-1 mb-3">
 {filteredProducts.length} items · {selectedMealType} {selectedSubCategory !== 'All' ? `/ ${selectedSubCategory}` : ''}
 </p>

 {filteredProducts.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
 <Coffee size={36} className="text-[#4C1D95]/30 mb-3" />
 <p className="text-xs font-bold">No items match your filters.</p>
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 .5 pb-4">
 {filteredProducts.map(p => {
 const inCart = cart.find(c => c.product._id === p._id && c.memberId === activeMember);
 const qty = inCart ? inCart.quantity : 0;
 const price = p.isOffer && p.discountPrice ? p.discountPrice : p.price;
 return (
 <div
 key={p._id}
 onClick={() => { setDetailProductModal(p); setModalItemQty(1); }}
 className="bg-white rounded-xl overflow-hidden border border-[#E5E7EB] hover:border-[#4C1D95] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-w-0"
 >
 {/* Product Image */}
 <div>
 <div className="relative w-full h-28 xs:h-32 bg-[#F9FAFB] overflow-hidden">
 <img
 src={p.image}
 alt={p.name}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
 onError={(e) => {
 (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=No+Image';
 }}
 />
 {/* Category badge */}
 <span className="absolute top-1.5 left-1.5 bg-[#4C1D95] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-xs truncate max-w-[80%]">
 {p.category}
 </span>
 {/* Cart qty badge */}
 {qty > 0 && (
 <span className="absolute top-1.5 right-1.5 bg-[#4C1D95] text-white text-[8px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md">
 {qty}
 </span>
 )}
 {/* Offer badge */}
 {p.isOffer && (
 <span className="absolute bottom-1.5 right-1.5 bg-[#E5E7EB] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
 SALE
 </span>
 )}
 </div>

 {/* Card Info */}
 <div className="p-2">
 <h3 className="font-bold text-[10px] sm:text-xs text-[#111827] line-clamp-1 group-hover:text-[#4C1D95] transition-colors leading-tight">
 {p.name}
 </h3>
 <div className="flex items-center gap-1 text-[9px] text-[#9CA3AF] mt-1 mb-1.5 font-medium">
 <Clock size={9} className="text-[#4C1D95] shrink-0" />
 <span className="truncate">~{p.estimatedPrepTime || 15}m prep</span>
 </div>
 </div>
 </div>

 {/* Card Bottom Controls */}
 <div className="px-2 pb-2 pt-0 flex items-center justify-between border-t border-[#FFFFFF]/80 mt-0.5">
 <div className="min-w-0 pr-1">
 <span className="font-black text-[11px] sm:text-sm text-[#4C1D95] font-mono">₹{price}</span>
 {p.isOffer && p.discountPrice && (
 <span className="text-[9px] text-[#9CA3AF] line-through ml-1 font-mono hidden xs:inline">₹{p.price}</span>
 )}
 </div>
 {qty > 0 ? (
 <div
 onClick={(e) => e.stopPropagation()}
 className="flex items-center gap-1.5 bg-[#F3F4F6] border border-[#4C1D95]/30 rounded-lg p-1"
 >
 <button
 onClick={() => updateCartQuantity(p._id, activeMember, -1)}
 className="w-6 h-6 rounded flex items-center justify-center bg-white text-[#4C1D95] border border-[#D1D5DB] hover:bg-neutral-100 shadow-sm cursor-pointer transition-colors active:scale-95 shrink-0"
 >
 <Minus size={12} className=".5 .5" />
 </button>
 <span className="font-bold text-[11px] w-4 text-center text-[#4C1D95]">{qty}</span>
 <button
 onClick={() => updateCartQuantity(p._id, activeMember, 1)}
 className="w-6 h-6 rounded flex items-center justify-center bg-[#4C1D95] text-white hover:bg-[#4C1D95] shadow-sm cursor-pointer transition-colors active:scale-95 shrink-0"
 >
 <Plus size={12} className=".5 .5" />
 </button>
 </div>
 ) : (
 <button
 onClick={(e) => {
 e.stopPropagation();
 addToCart(p);
 }}
 className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 shadow-sm shrink-0 bg-[#4C1D95] hover:bg-[#5B21B6] text-white"
 >
 <Plus size={12} strokeWidth={3} className="" />
 <span>Add</span>
 </button>
 )}
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

 {/* ═══════════ CART DRAWER ═══════════ */}
 {showCart && (
 <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setShowCart(false)}>
 <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
 {/* Cart Header */}
 <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between shrink-0">
 <div className="flex items-center gap-2">
 <ShoppingBag size={18} className="text-[#4C1D95]" />
 <h3 className="font-black text-base text-[#111827]">Your Cart</h3>
 <span className="bg-[#4C1D95] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
 T{currentTable}
 </span>
 </div>
 <button onClick={() => setShowCart(false)} className="p-1.5 rounded-xl hover:bg-[#F9FAFB] text-[#9CA3AF] cursor-pointer transition-colors">
 ✕
 </button>
 </div>

 {/* Cart Items */}
 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {cart.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-[#9CA3AF]">
 <ShoppingCart size={40} className="text-[#4C1D95]/20 mb-3" />
 <p className="text-sm font-bold">Cart is empty</p>
 </div>
 ) : (
 cart.map(item => (
 <div key={`${item.product._id}_${item.memberId}`} className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl p-3">
 <div className="flex gap-3 items-start">
 <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-[#E5E7EB] shrink-0">
 <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-xs text-[#111827] truncate">{item.product.name}</p>
 <p className="font-black text-sm text-[#4C1D95] font-mono mt-0.5">
 ₹{((item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price) * item.quantity).toFixed(0)}
 </p>
 <span className="inline-block mt-1 bg-[#4C1D95]/10 text-[#4C1D95] text-[9px] font-bold px-1.5 py-0.5 rounded">
 Seat {item.memberId}
 </span>
 </div>
 <div className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-xl p-1 shrink-0">
 <button onClick={() => updateCartQuantity(item.product._id, item.memberId, -1)} className="w-6 h-6 rounded-lg bg-[#F9FAFB] text-[#4C1D95] font-bold text-sm flex items-center justify-center hover:bg-[#4C1D95] hover:text-white transition-colors cursor-pointer">-</button>
 <span className="font-mono font-black text-xs w-4 text-center">{item.quantity}</span>
 <button onClick={() => updateCartQuantity(item.product._id, item.memberId, 1)} className="w-6 h-6 rounded-lg bg-[#F9FAFB] text-[#4C1D95] font-bold text-sm flex items-center justify-center hover:bg-[#4C1D95] hover:text-white transition-colors cursor-pointer">+</button>
 </div>
 </div>
 <div className="mt-2 pt-2 border-t border-[#F3F4F6]">
 <input
 type="text"
 placeholder="Special note (e.g. less sugar)..."
 className="w-full bg-white border border-[#e5e7eb] focus:border-[#4C1D95] rounded-xl px-3 py-1.5 text-[10px] placeholder:text-[#9CA3AF] focus:outline-none"
 value={item.instructions || specialInstructions[`${item.memberId}_${item.product._id}`] || ''}
 onChange={(e) => updateInstructions(item.product._id, item.memberId, e.target.value)}
 />
 </div>
 </div>
 ))
 )}
 </div>

 {/* Checkout with Live GST Breakdown */}
 {cart.length > 0 && (() => {
 const baseSubtotal = calculateTotal();
 const totalGst = baseSubtotal * (gstRate / 100);
 const cgst = totalGst / 2;
 const sgst = totalGst / 2;
 const grandTotal = baseSubtotal + totalGst;

 return (
 <div className="p-4 border-t border-[#F3F4F6] shrink-0 space-y-2.5 bg-[#F9FAFB]">
 <div className="space-y-1 text-[11px] text-[#4B5563] font-semibold border-b border-[#F3F4F6] pb-2">
 <div className="flex justify-between">
 <span>Item Base Subtotal:</span>
 <span className="font-mono font-bold text-[#111827]">₹{baseSubtotal.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>CGST ({(gstRate / 2).toFixed(1)}%):</span>
 <span className="font-mono font-bold text-[#111827]">₹{cgst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>SGST ({(gstRate / 2).toFixed(1)}%):</span>
 <span className="font-mono font-bold text-[#111827]">₹{sgst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between text-[#4C1D95] font-extrabold text-[11px]">
 <span>Total Live GST ({gstRate}%):</span>
 <span className="font-mono">₹{totalGst.toFixed(2)}</span>
 </div>
 </div>

 <div className="flex justify-between items-center pt-0.5">
 <div>
 <span className="text-xs font-extrabold text-[#4B5563] block leading-none">Grand Total</span>
 <span className="text-[9px] text-[#4C1D95] font-bold">Including {gstRate}% GST</span>
 </div>
 <span className="text-2xl font-black text-[#4C1D95] font-mono">₹{grandTotal.toFixed(2)}</span>
 </div>

 <button
 onClick={handlePlaceOrder}
 className="w-full py-3.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#4C1D95]/30 cursor-pointer transition-all active:scale-[0.98]"
 >
 <Send size={15} />
 <span>Place Order (₹{grandTotal.toFixed(2)})</span>
 </button>
 </div>
 );
 })()}
 </div>
 </div>
 )}

 {/* ═══════════ PRODUCT DETAIL MODAL (Centered on Phone) ═══════════ */}
 {detailProductModal && (
 <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailProductModal(null)}>
 <div className="bg-white w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-scale-in text-[#111827]" onClick={e => e.stopPropagation()}>
 {/* Image Banner - Centered & Featured */}
 <div className="relative w-full shrink-0 h-48 bg-[#F9FAFB] overflow-hidden">
 <img
 src={detailProductModal.image}
 alt={detailProductModal.name}
 className="w-full h-full object-cover"
 onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x250?text=No+Image'; }}
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
 <button
 onClick={() => setDetailProductModal(null)}
 className="absolute top-3 right-3 bg-white/90 hover:bg-white p-2 rounded-full shadow-md cursor-pointer transition-colors text-[#111827]"
 >
 ✕
 </button>
 <div className="absolute bottom-3 left-3 flex items-center gap-2">
 <span className="bg-[#4C1D95] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase shadow">
 {detailProductModal.category}
 </span>
 {detailProductModal.isOffer && (
 <span className="bg-[#E5E7EB] text-white text-[9px] font-black px-2 py-1 rounded-full uppercase shadow">
 Sale
 </span>
 )}
 </div>
 </div>

 {/* Info */}
 <div className="p-4 flex-1 overflow-y-auto">
 <div className="flex justify-between items-start gap-2">
 <div className="flex-1">
 <h2 className="text-lg font-black text-[#111827] leading-snug">{detailProductModal.name}</h2>
 <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs mt-1.5 font-medium">
 <Clock size={13} className="text-[#4C1D95]" />
 <span>~{detailProductModal.estimatedPrepTime || 15} min prep time</span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <p className="text-xl font-black text-[#4C1D95] font-mono">
 ₹{detailProductModal.isOffer && detailProductModal.discountPrice ? detailProductModal.discountPrice : detailProductModal.price}
 </p>
 {detailProductModal.isOffer && detailProductModal.discountPrice && (
 <p className="text-xs text-[#9CA3AF] line-through font-mono">₹{detailProductModal.price}</p>
 )}
 </div>
 </div>
 {detailProductModal.description && (
 <p className="text-xs text-[#4B5563] mt-3 leading-relaxed border-t border-[#FFFFFF] pt-3">{detailProductModal.description}</p>
 )}
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-[#F3F4F6] bg-[#F9FAFB] flex items-center gap-3 shrink-0">
 <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] p-1.5 rounded-2xl">
 <button
 onClick={() => setModalItemQty(prev => Math.max(1, prev - 1))}
 className="w-8 h-8 rounded-xl bg-[#F9FAFB] text-[#4C1D95] font-bold flex items-center justify-center hover:bg-[#4C1D95] hover:text-white transition-colors cursor-pointer"
 >
 <Minus size={14} />
 </button>
 <span className="font-mono font-black text-base w-6 text-center">{modalItemQty}</span>
 <button
 onClick={() => setModalItemQty(prev => prev + 1)}
 className="w-8 h-8 rounded-xl bg-[#F9FAFB] text-[#4C1D95] font-bold flex items-center justify-center hover:bg-[#4C1D95] hover:text-white transition-colors cursor-pointer"
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
 className="flex-1 py-3.5 bg-[#4C1D95] hover:bg-[#5B21B6] disabled:opacity-50 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#4C1D95]/25 cursor-pointer transition-all active:scale-[0.98]"
 >
 <ShoppingBag size={16} />
 Add {modalItemQty} · ₹{((detailProductModal.isOffer && detailProductModal.discountPrice ? detailProductModal.discountPrice : detailProductModal.price) * modalItemQty).toFixed(0)}
 </button>
 </div>
 </div>
 </div>
 )}
 {/* 🧾 ULTRA-MODERN AI SMART RECEIPT MODAL */}
 
 
 
 {/* FLOATING VIEW CART BUTTON */}
 {cart.length > 0 && (
 <button
 onClick={() => setShowCart(true)}
 className="fixed bottom-[96px] left-1/2 -translate-x-1/2 bg-[#4C1D95] text-white px-6 py-3 rounded-full font-black text-sm shadow-xl shadow-[#4C1D95]/30 flex items-center gap-2 z-40 transition-all hover:bg-[#5B21B6] active:scale-95 whitespace-nowrap"
 >
 <ShoppingBag size={18} />
 <span>View Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})</span>
 </button>
 )}

 
 </div>


 {renderBottomNav()}
 
{showCustomerReceiptModal && activeOrder && (
 <SmartReceiptModal
 order={activeOrder}
 onClose={() => setShowCustomerReceiptModal(false)}
 />
 )}
 </div>
 );
};




// Trigger HMR

// Trigger HMR again

// Fix is applied





