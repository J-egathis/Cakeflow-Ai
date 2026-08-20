import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { analyticsApi, orderApi, tableApi, productApi, getSocket, BASE_URL } from '../services/api';
import { SmartTable, Order, Product } from '../types';
import { 
  TrendingUp, Users, Clock, ShoppingBag, 
  BarChart3, RefreshCw, Layers, Sparkles, Filter, 
  Calendar, CheckCircle, AlertTriangle, AlertCircle, 
  Search, ShieldAlert, Check, X, Printer, Receipt, DollarSign,
  Coffee, ChevronRight, PieChart as PieIcon, LogOut, QrCode, Download,
  Trash2, Trash, CheckSquare, Square, Plus, Utensils, Tag, Image, Upload, Link as LinkIcon, Camera,
  Eye, EyeOff, Edit, Edit2, XCircle, PackageCheck, PackageX
} from 'lucide-react';
import { TableManagement } from '../components/TableManagement';
import { SmartReceiptModal } from '../components/SmartReceiptModal';

interface AdminViewProps {
  user: { username: string; role: string };
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reception' | 'tables' | 'foods'>('overview');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'lastmonth' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Reception Desk State
  const [receptionOrders, setReceptionOrders] = useState<Order[]>([]);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [printTargetOrder, setPrintTargetOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [settlingBill, setSettlingBill] = useState(false);
  const [pendingTableFilter, setPendingTableFilter] = useState<string>('all');

  // Payment History Log State
  const [paymentHistory, setPaymentHistory] = useState<Order[]>([]);
  const [historyTableFilter, setHistoryTableFilter] = useState<string>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('all');

  // Overview Order History State & Filters
  const [allSystemOrders, setAllSystemOrders] = useState<Order[]>([]);
  const [overviewStatusFilter, setOverviewStatusFilter] = useState<string>('all');
  const [overviewTableFilter, setOverviewTableFilter] = useState<string>('all');
  const [overviewDateFilter, setOverviewDateFilter] = useState<string>('all');
  const [selectedOverviewOrderIds, setSelectedOverviewOrderIds] = useState<string[]>([]);

  // Add Food Item & Custom Category State
  const [showAddFoodModal, setShowAddFoodModal] = useState<boolean>(false);
  const [foodName, setFoodName] = useState<string>('');
  const [foodPrice, setFoodPrice] = useState<string>('');
  const [foodCategory, setFoodCategory] = useState<string>('Cakes');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [foodSubCategory, setFoodSubCategory] = useState<string>('Special');
  const [foodDescription, setFoodDescription] = useState<string>('');
  const [foodImage, setFoodImage] = useState<string>('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [savingFoodItem, setSavingFoodItem] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleImageFileUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WEBP)');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setFoodImage(compressed);
        } else {
          setFoodImage(rawDataUrl);
        }
        setUploadingImage(false);
      };
      img.onerror = () => {
        setFoodImage(rawDataUrl);
        setUploadingImage(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      alert('Failed to read image file');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };
  
  // GST Tax Config State
  const [gstRate, setGstRate] = useState<number>(() => {
    const saved = localStorage.getItem('admin_gst_rate');
    return saved ? parseFloat(saved) : 5;
  });
  const [showGstModal, setShowGstModal] = useState<boolean>(false);
  const [tempGstInput, setTempGstInput] = useState<string>(String(gstRate));

  const handleSaveGstRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempGstInput);
    if (isNaN(parsed) || parsed < 0 || parsed > 50) {
      alert('Please enter a valid GST percentage between 0% and 50%');
      return;
    }
    setGstRate(parsed);
    localStorage.setItem('admin_gst_rate', String(parsed));
    setShowGstModal(false);
    addToast(`✅ GST Tax Rate updated to ${parsed}% (${parsed/2}% CGST + ${parsed/2}% SGST)! Applied to all new printed receipts.`, 'success');
  };

  const defaultCategories = ['Cakes', 'Snacks', 'Juice', 'Chats', 'Desserts', 'Hot Drinks', 'Cold Drinks', 'Combos'];
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategories);

  // 🍔 All Food Items Management State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState<string>('');
  const [foodCategoryFilter, setFoodCategoryFilter] = useState<string>('all');
  const [foodStockFilter, setFoodStockFilter] = useState<'all' | 'active' | 'hidden' | 'outofstock' | 'instock'>('all');
  
  // Quick Edit Food Item State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editImage, setEditImage] = useState<string>('');
  const [editImageInputMode, setEditImageInputMode] = useState<'upload' | 'url'>('upload');
  const [editUploadingImage, setEditUploadingImage] = useState<boolean>(false);
  const [savingEditProduct, setSavingEditProduct] = useState<boolean>(false);
  const editFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchAdminProducts = async () => {
    try {
      setLoadingProducts(true);
      const data = await productApi.getAll();
      if (data && Array.isArray(data)) {
        setAllProducts(data);
        const catSet = new Set([...defaultCategories, ...data.map((p: any) => p.category).filter(Boolean)]);
        setAvailableCategories(Array.from(catSet));
      }
    } catch (err: any) {
      console.error('Failed to load admin products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load existing products to populate categories list & all products
  useEffect(() => {
    fetchAdminProducts();
  }, []);

  // Toggle Hide / Show product across all customer tables
  const handleToggleHideProduct = async (product: Product) => {
    const newHiddenState = !product.isHidden;
    try {
      // Optimistic update
      setAllProducts(prev => prev.map(p => p._id === product._id ? { ...p, isHidden: newHiddenState } : p));
      
      const updated = await productApi.update(product._id, { isHidden: newHiddenState });
      
      const socket = getSocket();
      socket.emit('product:updated', updated || { ...product, isHidden: newHiddenState });
      
      addToast(
        newHiddenState 
          ? `👁️ Item "${product.name}" is now HIDDEN from all customer tables!`
          : `✅ Item "${product.name}" is now LIVE & VISIBLE on all tables!`,
        newHiddenState ? 'danger' : 'success'
      );
    } catch (err: any) {
      alert(`Failed to update item visibility: ${err.message || err}`);
      fetchAdminProducts();
    }
  };

  // Toggle In Stock / Out of Stock
  const handleToggleStockProduct = async (product: Product) => {
    const newStockState = !product.inStock;
    try {
      setAllProducts(prev => prev.map(p => p._id === product._id ? { ...p, inStock: newStockState } : p));
      
      const updated = await productApi.update(product._id, { inStock: newStockState });
      
      const socket = getSocket();
      socket.emit('product:updated', updated || { ...product, inStock: newStockState });

      addToast(
        newStockState 
          ? `📦 "${product.name}" marked IN STOCK!`
          : `⚠️ "${product.name}" marked OUT OF STOCK for all tables!`,
        newStockState ? 'success' : 'info'
      );
    } catch (err: any) {
      alert(`Failed to update stock status: ${err.message || err}`);
      fetchAdminProducts();
    }
  };

  // Delete product permanently
  const handleDeleteProduct = async (productId: string, productName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete "${productName}"?\n\nThis will remove it from all Customer Tables and Kitchen screens in real-time.`);
    if (!confirmDelete) return;

    try {
      setAllProducts(prev => prev.filter(p => p._id !== productId));
      await productApi.delete(productId);

      const socket = getSocket();
      socket.emit('product:deleted', { id: productId, _id: productId });

      addToast(`🗑️ "${productName}" was permanently DELETED from the system!`, 'danger');
    } catch (err: any) {
      alert(`Failed to delete food item: ${err.message || err}`);
      fetchAdminProducts();
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(String(product.price));
    setEditCategory(product.category);
    setEditDescription(product.description || '');
    setEditImage(product.image);
    setEditImageInputMode('upload');
  };

  const handleEditImageFileUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WEBP)');
      return;
    }

    setEditUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setEditImage(compressed);
        } else {
          setEditImage(rawDataUrl);
        }
        setEditUploadingImage(false);
      };
      img.onerror = () => {
        setEditImage(rawDataUrl);
        setEditUploadingImage(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      alert('Failed to read image file');
      setEditUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName.trim() || !editPrice) return;
    setSavingEditProduct(true);

    try {
      const updatedData = {
        name: editName.trim(),
        price: parseFloat(editPrice),
        category: editCategory.trim() || editingProduct.category,
        description: editDescription.trim(),
        image: editImage.trim() || editingProduct.image
      };

      const res = await productApi.update(editingProduct._id, updatedData);
      setAllProducts(prev => prev.map(p => p._id === editingProduct._id ? { ...p, ...updatedData } : p));

      const socket = getSocket();
      socket.emit('product:updated', res || { ...editingProduct, ...updatedData });

      addToast(`✨ "${editName}" updated successfully and synced with all tables!`, 'success');
      setEditingProduct(null);
    } catch (err: any) {
      alert(`Failed to update product: ${err.message || err}`);
    } finally {
      setSavingEditProduct(false);
    }
  };

  const handleSaveFoodItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim() || !foodPrice) return;
    setSavingFoodItem(true);

    try {
      const finalCategory = isCustomCategory && customCategoryInput.trim()
        ? customCategoryInput.trim()
        : foodCategory;

      const newProductData = {
        name: foodName.trim(),
        price: parseFloat(foodPrice),
        category: finalCategory,
        subCategory: foodSubCategory || 'Special',
        description: foodDescription.trim() || 'Delicious item prepared fresh on order.',
        image: foodImage.trim() || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
        isAvailable: true,
        inStock: true,
        isHidden: false
      };

      const created = await productApi.create(newProductData);
      if (created) {
        setAllProducts(prev => [created, ...prev]);
      } else {
        fetchAdminProducts();
      }

      if (!availableCategories.includes(finalCategory)) {
        setAvailableCategories(prev => [...prev, finalCategory]);
      }

      // Notify clients over WebSockets
      const socket = getSocket();
      socket.emit('product:updated', created || newProductData);
      socket.emit('product:created', created || newProductData);

      addToast(`🎉 NEW FOOD ITEM ADDED: "${foodName}" (₹${foodPrice}) under category "${finalCategory}"! Live on Customer Menu.`, 'success');
      setShowAddFoodModal(false);

      // Reset form
      setFoodName('');
      setFoodPrice('');
      setFoodDescription('');
      setFoodImage('');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setImageInputMode('upload');
    } catch (err: any) {
      addToast(`Failed to add food item: ${err.message || 'Error'}`, 'danger');
    } finally {
      setSavingFoodItem(false);
    }
  };

  const handleDeleteSingleOrder = async (orderId: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete order #${orderId.slice(-6)}? This will permanently remove the order record.`);
    if (!confirmDelete) return;

    try {
      await orderApi.remove(orderId, true);
      setAllSystemOrders(prev => prev.filter(o => o._id !== orderId));
      setSelectedOverviewOrderIds(prev => prev.filter(id => id !== orderId));
      fetchAdminData(dateFilter);
      fetchReceptionOrders();
    } catch (err: any) {
      alert('Failed to delete order: ' + (err.message || err));
    }
  };

  const handleDeleteBulkOrders = async () => {
    if (selectedOverviewOrderIds.length === 0) return;
    const count = selectedOverviewOrderIds.length;
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete these ${count} selected order records?`);
    if (!confirmDelete) return;

    try {
      await orderApi.bulkRemove(selectedOverviewOrderIds);
      setAllSystemOrders(prev => prev.filter(o => !selectedOverviewOrderIds.includes(o._id)));
      setSelectedOverviewOrderIds([]);
      fetchAdminData(dateFilter);
      fetchReceptionOrders();
    } catch (err: any) {
      alert('Failed to bulk delete orders: ' + (err.message || err));
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOverviewOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllOrders = (ordersList: Order[]) => {
    const allFilteredIds = ordersList.map(o => o._id);
    const allSelected = allFilteredIds.every(id => selectedOverviewOrderIds.includes(id));
    if (allSelected) {
      setSelectedOverviewOrderIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedOverviewOrderIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Dynamic system tables list
  const [allSystemTables, setAllSystemTables] = useState<SmartTable[]>([]);

  // Toast Notification System State
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'danger' }>>([]);

  const addToast = (message: string, type: 'info' | 'success' | 'danger' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    fetchAdminData(dateFilter);
    fetchReceptionOrders();

    tableApi.getAll()
      .then(tbls => setAllSystemTables(tbls || []))
      .catch(e => console.error('Failed to load system tables in AdminView:', e));

    const socket = getSocket();
    socket.emit('join_room', 'admins');

    socket.on('new_order', (newOrder: Order) => {
      addToast(`🔔 New Order #${newOrder._id.slice(-4)} placed for Table ${newOrder.tableNumber}! Total: ₹${newOrder.totalAmount}`, 'info');
      fetchReceptionOrders();
      fetchAdminData(dateFilter);
    });

    socket.on('order_updated', (updatedOrder: Order) => {
      if (updatedOrder.status === 'ready') {
        addToast(`🔔 Chef Food Ready! Table ${updatedOrder.tableNumber} is ready for Reception Billing!`, 'success');
      } else if (updatedOrder.status === 'cancelled') {
        addToast(`⚠️ Order #${updatedOrder._id.slice(-4)} for Table ${updatedOrder.tableNumber} was CANCELLED!`, 'danger');
      }
      fetchReceptionOrders();
      fetchAdminData(dateFilter);
    });

    socket.on('table_status_updated', () => {
      fetchReceptionOrders();
    });

    socket.on('product:created', () => {
      fetchAdminProducts();
    });
    socket.on('product:updated', () => {
      fetchAdminProducts();
    });
    socket.on('product:deleted', () => {
      fetchAdminProducts();
    });

    // 4-second silent background auto-refresh interval for Admin Dashboard & Reception Desk
    const autoRefreshInterval = setInterval(() => {
      fetchReceptionOrders();
    }, 4000);

    return () => {
      clearInterval(autoRefreshInterval);
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('table_status_updated');
      socket.off('product:created');
      socket.off('product:updated');
      socket.off('product:deleted');
    };
  }, [dateFilter]);

  const defaultDashboardData = {
    grossRevenue: 4250,
    totalOrders: 18,
    avgPrepTimeMins: 14,
    liveActiveTables: 3,
    salesBreakdown: [
      { name: 'Today', sales: 4250, count: 18 }
    ],
    categoryBreakdown: [
      { category: 'Cakes', sales: 2150, percent: 50 },
      { category: 'Snacks', sales: 1200, percent: 28 },
      { category: 'Juice', sales: 900, percent: 14 },
      { category: 'Chats', sales: 400, percent: 8 }
    ],
    peakHours: [
      { hour: '8 AM', orders: 2 },
      { hour: '10 AM', orders: 3 },
      { hour: '12 PM', orders: 6 },
      { hour: '2 PM', orders: 8 },
      { hour: '4 PM', orders: 4 },
      { hour: '6 PM', orders: 7 },
      { hour: '8 PM', orders: 5 },
      { hour: '10 PM', orders: 2 }
    ],
    recentCompletedOrders: []
  };

  const checkDateMatch = (createdAtStr: any, filterType: string, customStart?: string, customEnd?: string) => {
    if (filterType === 'all') return true;

    const orderDate = new Date(createdAtStr || Date.now());
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    if (filterType === 'today') {
      return orderDate >= startOfToday && orderDate <= endOfToday;
    } else if (filterType === '7days') {
      const startOf7Days = new Date(startOfToday);
      startOf7Days.setDate(startOf7Days.getDate() - 6);
      return orderDate >= startOf7Days && orderDate <= endOfToday;
    } else if (filterType === '30days') {
      const startOf30Days = new Date(startOfToday);
      startOf30Days.setDate(startOf30Days.getDate() - 29);
      return orderDate >= startOf30Days && orderDate <= endOfToday;
    } else if (filterType === 'lastmonth') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
    } else if (filterType === 'custom') {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
      const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date();
      return orderDate >= start && orderDate <= end;
    }

    return true;
  };

  const fetchAdminData = async (
    filter = dateFilter, 
    startDate = customStartDate, 
    endDate = customEndDate
  ) => {
    setLoading(true);
    try {
      const data = await analyticsApi.getDashboard(filter, startDate, endDate);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch store analytics, using default dashboard data:', err);
      setAnalytics(defaultDashboardData);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceptionOrders = async () => {
    try {
      const allOrders = await orderApi.getAll();
      setAllSystemOrders(allOrders || []);

      // Show orders that are ready or quality_check as pending bills (waiting to be settled)
      // Also show preparing/pending orders so reception sees ALL active table orders
      const unsettled = allOrders.filter((o: Order) =>
        o.paymentStatus !== 'paid' &&
        o.status !== 'cancelled' &&
        o.status !== 'served' &&
        ['pending', 'preparing', 'ready', 'quality_check', 'decorating'].includes(o.status)
      );
      setReceptionOrders(unsettled);

      // Payment History: include served, paid, or settled orders (EXCLUDE 0.00 bills)
      const history = allOrders.filter((o: Order) =>
        Boolean(o.totalAmount && o.totalAmount > 0) && (
          o.status === 'served' ||
          o.paymentStatus === 'paid' ||
          (o.paymentStatus as any) === 'Paid' ||
          (o.paymentMethod && o.paymentMethod.trim() !== '')
        )
      );
      setPaymentHistory(history);
    } catch (err) {
      console.error('Failed to fetch reception orders:', err);
    }
  };

  const playCashRegisterChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(audioCtx.currentTime);
      osc2.start(audioCtx.currentTime + 0.1);
      osc1.stop(audioCtx.currentTime + 0.1);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Context blocked', e);
    }
  };

  const handlePrintAndSettleBill = async () => {
    if (!selectedReceiptOrder) return;
    const targetOrder = selectedReceiptOrder;
    const selectedMethodLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'upi' ? 'UPI' : 'Credit Card';

    // ⚡ Direct 80mm Thermal POS Auto-Print
    handleDirectPrintReceipt(targetOrder);

    // 1. INSTANT 0ms UI UPDATE: Close modal & remove card immediately so user never waits!
    setSelectedReceiptOrder(null);
    playCashRegisterChime();
    addToast(
      `💰 ${selectedMethodLabel.toUpperCase()} PAYMENT CONFIRMED! ₹${targetOrder.totalAmount?.toFixed(2)} received for Table ${targetOrder.tableNumber}. Saved in History & Table released!`,
      'success'
    );

    // Optimistically update local reception orders & payment history lists
    setReceptionOrders(prev => prev.filter(o => o._id !== targetOrder._id));
    const settledOrder = { ...targetOrder, status: 'served' as const, paymentStatus: 'paid' as const, paymentMethod: selectedMethodLabel as any };
    setPaymentHistory(prev => [settledOrder, ...prev]);

    // 2. Perform background API settlement
    try {
      await orderApi.closeTable(targetOrder._id, selectedMethodLabel);
      fetchAdminData(dateFilter);
      fetchReceptionOrders();
    } catch (err: any) {
      console.error('Background settlement sync error:', err);
    }
  };

  const dynamicTableNumbers = Array.from(
    new Set([
      ...allSystemTables.map((t: any) => String(t.tableNumber)),
      ...receptionOrders.map((o: any) => String(o.tableNumber)),
      ...paymentHistory.map((o: any) => String(o.tableNumber))
    ])
  ).sort((a, b) => Number(a) - Number(b));

  const filteredPendingOrders = receptionOrders.filter((o: any) => {
    if (pendingTableFilter === 'all') return true;
    return String(o.tableNumber) === String(pendingTableFilter);
  });

  const filteredPaymentHistory = paymentHistory.filter((o: any) => {
    const matchTable = historyTableFilter === 'all' || String(o.tableNumber) === String(historyTableFilter);
    if (!matchTable) return false;
    return checkDateMatch(o.createdAt, historyDateFilter, customStartDate, customEndDate);
  });

  const handleDirectPrintReceipt = async (orderToPrint?: Order) => {
    const order = orderToPrint || selectedReceiptOrder;
    if (!order) return;

    let qrCodeUrl = '';
    try {
      const invoiceUrl = `${window.location.origin}/receipt/${order._id}`;
      qrCodeUrl = await QRCode.toDataURL(invoiceUrl, { width: 150, margin: 1, color: { dark: '#CD0D0D', light: '#FFFFFF' } });
    } catch (e) {}

    const activeGstRate = parseFloat(localStorage.getItem('admin_gst_rate') || String(gstRate) || '5');
    const halfGstRate = activeGstRate / 2;
    const subtotal = order.totalAmount ? (order.totalAmount / (1 + (activeGstRate / 100))) : 0;
    const totalGstAmount = order.totalAmount ? (order.totalAmount - subtotal) : 0;
    const cgst = totalGstAmount / 2;
    const sgst = totalGstAmount / 2;

    const itemsHtml = order.items?.map((item: any) => {
      const pName = item.product?.name || item.name || 'Food Item';
      const price = item.price || item.product?.price || 0;
      return `
        <div style="margin-bottom: 5px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="font-weight: 600;">${item.quantity}x ${pName}</span>
            <span style="font-family: monospace; font-weight: bold;">₹${price * item.quantity}</span>
          </div>
          ${item.instructions ? `<div style="font-size: 9px; color: #CD0D0D; margin-top: 1px;">📌 Note: "${item.instructions}"</div>` : ''}
        </div>
      `;
    }).join('') || '';

    const printWindow = window.open('', '_blank', 'width=450,height=700');
    if (!printWindow) {
      alert('Please allow popup windows for this site to print thermal receipts.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt Table ${order.tableNumber} #${order._id.slice(-6)}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace, monospace;
              width: 72mm;
              max-width: 72mm;
              margin: 0 auto;
              padding: 4px 2px;
              color: #000;
              background: #fff;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .header h2 {
              margin: 0;
              color: #000;
              font-size: 15px;
              font-weight: 900;
            }
            .header .subtitle {
              font-size: 10px;
              color: #222;
              font-weight: 700;
            }
            .header .title-tag {
              font-size: 11px;
              font-weight: 900;
              color: #000;
              margin-top: 4px;
              letter-spacing: 0.5px;
            }
            .status-banner {
              border: 1px solid #000;
              color: #000;
              padding: 4px 6px;
              font-size: 10px;
              font-weight: 800;
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              font-size: 10px;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .items-table {
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .table-head {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              font-weight: 900;
              color: #000;
              text-transform: uppercase;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
              margin-bottom: 4px;
            }
            .summary {
              font-size: 10.5px;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 2px;
              color: #000;
              font-weight: 600;
            }
            .grand-total {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: 900;
              color: #000;
              border-top: 1.5px dashed #000;
              padding-top: 5px;
              margin-top: 4px;
            }
            .qr-section {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .qr-text {
              font-size: 9.5px;
              color: #000;
              font-weight: 600;
            }
            .footer {
              text-align: center;
              font-size: 10.5px;
              font-weight: 800;
              color: #000;
              padding-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🍰 CakeFlow AI Bakery</h2>
            <div class="subtitle">Main Branch • Counter C02</div>
            <div class="subtitle">GSTIN: 33AAAAA0000A1Z5</div>
            <div class="title-tag">*** TAX INVOICE ***</div>
          </div>

          <div class="status-banner">
            <span>PAID / SETTLED</span>
            <span>Via ${order.paymentMethod || 'Cash'}</span>
          </div>

          <div class="meta-grid">
            <div>
              <div><b>Table:</b> Table ${order.tableNumber}</div>
              <div><b>Guest:</b> ${order.customerName || 'Walk-in Guest'}</div>
            </div>
            <div style="text-align: right;">
              <div><b>Bill #:</b> #${order._id.slice(-6)}</div>
              <div><b>Time:</b> ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div class="items-table">
            <div class="table-head">
              <span>ITEM DESC</span>
              <span>AMOUNT</span>
            </div>
            ${itemsHtml}
          </div>

          <div class="summary">
            <div class="summary-row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
            <div class="summary-row"><span>CGST (${halfGstRate.toFixed(1)}%):</span><span>₹${cgst.toFixed(2)}</span></div>
            <div class="summary-row"><span>SGST (${halfGstRate.toFixed(1)}%):</span><span>₹${sgst.toFixed(2)}</span></div>
            <div class="grand-total">
              <span>TOTAL PAID:</span>
              <span>₹${order.totalAmount?.toFixed(2)}</span>
            </div>
          </div>

          <div class="qr-section">
            <div class="qr-text">
              <b>📱 Digital Receipt QR</b><br>
              Scan to view order invoice
            </div>
            ${qrCodeUrl ? `<img src="${qrCodeUrl}" style="width: 48px; height: 48px; border: 1px solid #000;" />` : ''}
          </div>

          <div class="footer">
            Thank you! Visit again!
          </div>

          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredOverviewOrders = allSystemOrders.filter((o: any) => {
    const matchTable = overviewTableFilter === 'all' || String(o.tableNumber) === String(overviewTableFilter);
    if (!matchTable) return false;

    if (overviewStatusFilter !== 'all') {
      if (overviewStatusFilter === 'paid') {
        const isPaid = o.paymentStatus === 'paid' || (o.paymentStatus as any) === 'Paid' || o.paymentMethod;
        if (!isPaid) return false;
      } else if (o.status !== overviewStatusFilter) {
        return false;
      }
    }

    return checkDateMatch(o.createdAt, overviewDateFilter, customStartDate, customEndDate);
  });

  const displayData = analytics || defaultDashboardData;

  return (
    <div id="dashboardPage" data-testid="dashboardPage" className="min-h-screen bg-[#F7F5F2] text-[#1E1818] flex flex-col relative overflow-hidden pb-12">
      {/* Real-time Toast Notifications Banner */}
      <div id="toastContainer" data-testid="toastContainer" className="fixed top-4 right-4 left-4 sm:left-auto sm:right-5 z-50 flex flex-col gap-2 max-w-sm sm:w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            id={`toast-${t.id}`}
            data-testid={`toast-${t.id}`}
            key={t.id} 
            className={`p-4 rounded-2xl border shadow-xl flex items-start gap-2.5 animate-slide-in pointer-events-auto ${
              t.type === 'danger' 
                ? 'bg-rose-50 border-rose-300 text-rose-800' 
                : t.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-[#FAF8F8] border-[#D0C0C0] text-[#1E1818]'
            }`}
          >
            {t.type === 'danger' ? <AlertTriangle size={16} className="shrink-0 mt-0.5 text-[#CD0D0D]" /> : <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-600" />}
            <span className="text-xs font-bold leading-relaxed">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header id="header" data-testid="header" className="bg-white/95 backdrop-blur-md border-b border-[#D0C0C0] px-4 md:px-6 py-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between z-10 shrink-0 gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div id="dashboardLogo" data-testid="dashboardLogo" className="p-2 rounded-xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
              <BarChart3 size={18} />
            </div>
            <div>
              <h1 id="dashboardTitle" data-testid="dashboardTitle" className="font-extrabold text-base md:text-lg tracking-tight text-[#CD0D0D]">
                CakeFlow Dashboard
              </h1>
              <p className="text-[10px] md:text-xs text-[#6E6262] font-semibold">
                Live Store Operations & Billing
              </p>
            </div>
          </div>

          <button 
            id="logoutBtnMobile"
            data-testid="logoutBtnMobile"
            onClick={onLogout}
            className="md:hidden text-xs text-[#6E6262] hover:text-[#CD0D0D] bg-white border border-[#D0C0C0] p-2 rounded-xl font-bold transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Tab Controls (Sidebar Navigation) */}
        <div id="sidebar" data-testid="sidebar" className="sidebar flex items-center bg-[#FAF8F8] border border-[#D0C0C0] p-1 rounded-2xl overflow-x-auto max-w-full scrollbar-none">
          <button
            id="overviewMenu"
            data-testid="overviewMenu"
            onClick={() => setActiveTab('overview')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'overview' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            Overview
          </button>
          
          <button
            id="billingMenu"
            data-testid="billingMenu"
            onClick={() => {
              setActiveTab('reception');
              fetchReceptionOrders();
            }}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer relative whitespace-nowrap ${activeTab === 'reception' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            <Receipt size={14} />
            <span>Reception & Billing</span>
            {receptionOrders.length > 0 && (
              <span id="receptionBadge" data-testid="receptionBadge" className="bg-[#CD0D0D] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse ml-0.5 border border-white">
                {receptionOrders.length}
              </span>
            )}
          </button>

          <button
            id="tablesMenu"
            data-testid="tablesMenu"
            onClick={() => setActiveTab('tables')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeTab === 'tables' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            <QrCode size={13} />
            <span>Tables & QR</span>
          </button>

          <button
            id="foodsTabMenu"
            data-testid="foodsTabMenu"
            onClick={() => {
              setActiveTab('foods');
              fetchAdminProducts();
            }}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${activeTab === 'foods' ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'}`}
          >
            <Utensils size={13} />
            <span>Food Items & Menu</span>
            {allProducts.length > 0 && (
              <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ml-0.5 shadow-xs">
                {allProducts.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 🏷️ GST TAX RATE CONFIG BUTTON */}
          <button
            id="gstConfigBtn"
            data-testid="gstConfigBtn"
            onClick={() => {
              setTempGstInput(String(gstRate));
              setShowGstModal(true);
            }}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            title="Configure GST Tax Percentage"
          >
            <DollarSign size={14} />
            <span>GST: {gstRate}%</span>
          </button>

          {/* ➕ ADD FOOD ITEM HEADER BUTTON */}
          <button
            id="addItemBtn"
            data-testid="addItemBtn"
            onClick={() => setShowAddFoodModal(true)}
            className="text-xs bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#CD0D0D]/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus size={14} />
            <span>Add Food Item</span>
          </button>

          <button
            id="profileBtn"
            data-testid="profileBtn"
            className="hidden md:flex text-xs text-[#1E1818] font-extrabold bg-[#FAF8F8] border border-[#D0C0C0] px-3 py-2 rounded-xl items-center gap-1.5 shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{user?.username || 'Admin'}</span>
          </button>

          <button 
            id="logoutBtn"
            data-testid="logoutBtn"
            onClick={onLogout}
            className="text-xs text-[#6E6262] hover:text-[#CD0D0D] bg-white border border-[#D0C0C0] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Grid content */}
      <main id="mainContent" data-testid="mainContent" className="max-w-6xl w-full mx-auto p-6 z-10 space-y-6">
        
        {/* VIEW: 🍔 FOOD MENU & ALL ITEMS MANAGEMENT */}
        {activeTab === 'foods' && (() => {
          const filteredAdminProducts = allProducts.filter(product => {
            const matchesSearch = !foodSearchQuery.trim() || 
              product.name.toLowerCase().includes(foodSearchQuery.toLowerCase()) ||
              product.category.toLowerCase().includes(foodSearchQuery.toLowerCase()) ||
              (product.description && product.description.toLowerCase().includes(foodSearchQuery.toLowerCase()));

            const matchesCategory = foodCategoryFilter === 'all' || product.category === foodCategoryFilter;

            let matchesStock = true;
            if (foodStockFilter === 'active') matchesStock = !product.isHidden;
            else if (foodStockFilter === 'hidden') matchesStock = !!product.isHidden;
            else if (foodStockFilter === 'outofstock') matchesStock = !product.inStock;
            else if (foodStockFilter === 'instock') matchesStock = !!product.inStock;

            return matchesSearch && matchesCategory && matchesStock;
          });

          const totalItems = allProducts.length;
          const liveItems = allProducts.filter(p => !p.isHidden).length;
          const hiddenItems = allProducts.filter(p => p.isHidden).length;
          const outOfStockItems = allProducts.filter(p => !p.inStock).length;

          return (
            <div id="foodManagementPage" data-testid="foodManagementPage" className="space-y-6 animate-fade-in">
              {/* Header Banner */}
              <div className="bg-white border border-[#D0C0C0] p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="p-3.5 rounded-2xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
                    <Utensils size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-[#1E1818] flex items-center gap-2">
                      <span>Food Items & Menu Catalog</span>
                      <span className="text-xs bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/30 px-2.5 py-0.5 rounded-full font-extrabold">
                        {allProducts.length} Total Items
                      </span>
                    </h2>
                    <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
                      Hide or delete items, update stock availability & sync with all dining tables in real-time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={fetchAdminProducts}
                    className="px-3.5 py-2.5 bg-[#FAF8F8] hover:bg-white text-[#1E1818] border border-[#D0C0C0] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
                    title="Refresh Menu"
                  >
                    <RefreshCw size={14} className={loadingProducts ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={() => setShowAddFoodModal(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-[#CD0D0D]/20 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Add New Food Item</span>
                  </button>
                </div>
              </div>

              {/* Stats KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div 
                  onClick={() => setFoodStockFilter('all')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    foodStockFilter === 'all' 
                      ? 'bg-white border-[#CD0D0D] ring-2 ring-[#CD0D0D]/20' 
                      : 'bg-[#FAF8F8] border-[#D0C0C0] hover:bg-white'
                  }`}
                >
                  <p className="text-[10px] font-bold text-[#6E6262] uppercase tracking-wider">Total Food Items</p>
                  <p className="text-2xl font-black text-[#1E1818] mt-1">{totalItems}</p>
                  <span className="text-[10px] text-[#6E6262] font-medium">All catalog items</span>
                </div>

                <div 
                  onClick={() => setFoodStockFilter('active')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    foodStockFilter === 'active' 
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20' 
                      : 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Live On Menu</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{liveItems}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">Visible to customers</span>
                </div>

                <div 
                  onClick={() => setFoodStockFilter('hidden')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    foodStockFilter === 'hidden' 
                      ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20' 
                      : 'bg-rose-50/40 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Hidden from Tables</p>
                  <p className="text-2xl font-black text-rose-700 mt-1">{hiddenItems}</p>
                  <span className="text-[10px] text-rose-600 font-semibold">Temporarily hidden</span>
                </div>

                <div 
                  onClick={() => setFoodStockFilter('outofstock')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    foodStockFilter === 'outofstock' 
                      ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20' 
                      : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Out of Stock</p>
                  <p className="text-2xl font-black text-amber-700 mt-1">{outOfStockItems}</p>
                  <span className="text-[10px] text-amber-600 font-semibold">Kitchen unavailable</span>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-white border border-[#D0C0C0] p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6262]" />
                  <input
                    type="text"
                    value={foodSearchQuery}
                    onChange={(e) => setFoodSearchQuery(e.target.value)}
                    placeholder="Search by food name, category..."
                    className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl pl-9 pr-8 py-2 text-xs text-[#1E1818] outline-none font-medium"
                  />
                  {foodSearchQuery && (
                    <button 
                      onClick={() => setFoodSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E6262] hover:text-[#1E1818] text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category & Status Filters */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                  {/* Category Filter */}
                  <select
                    value={foodCategoryFilter}
                    onChange={(e) => setFoodCategoryFilter(e.target.value)}
                    className="bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2 text-xs text-[#1E1818] font-bold outline-none cursor-pointer"
                  >
                    <option value="all">All Categories ({availableCategories.length})</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {/* Stock / Visibility Filter */}
                  <select
                    value={foodStockFilter}
                    onChange={(e) => setFoodStockFilter(e.target.value as any)}
                    className="bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2 text-xs text-[#1E1818] font-bold outline-none cursor-pointer"
                  >
                    <option value="all">All Items ({allProducts.length})</option>
                    <option value="active">Live On Menu Only ({liveItems})</option>
                    <option value="hidden">Hidden Only ({hiddenItems})</option>
                    <option value="instock">In Stock Only</option>
                    <option value="outofstock">Out of Stock Only ({outOfStockItems})</option>
                  </select>

                  {(foodSearchQuery || foodCategoryFilter !== 'all' || foodStockFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setFoodSearchQuery('');
                        setFoodCategoryFilter('all');
                        setFoodStockFilter('all');
                      }}
                      className="px-3 py-2 text-xs text-[#CD0D0D] font-bold hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Food Items Cards Grid */}
              {loadingProducts ? (
                <div className="bg-white border border-[#D0C0C0] p-12 rounded-3xl text-center space-y-3">
                  <RefreshCw size={28} className="animate-spin text-[#CD0D0D] mx-auto" />
                  <p className="text-xs font-bold text-[#6E6262]">Loading food items catalog...</p>
                </div>
              ) : filteredAdminProducts.length === 0 ? (
                <div className="bg-white border border-[#D0C0C0] p-12 rounded-3xl text-center space-y-3">
                  <Utensils size={36} className="text-[#6E6262]/40 mx-auto" />
                  <h3 className="text-base font-extrabold text-[#1E1818]">No Food Items Found</h3>
                  <p className="text-xs text-[#6E6262] max-w-sm mx-auto">
                    No items match your search or filter criteria. Try clearing filters or add a new food item.
                  </p>
                  <button
                    onClick={() => setShowAddFoodModal(true)}
                    className="px-4 py-2.5 bg-[#CD0D0D] text-white rounded-xl text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                  >
                    <Plus size={14} /> Add Food Item
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredAdminProducts.map((product) => {
                    const isHidden = !!product.isHidden;
                    const inStock = product.inStock !== false;

                    return (
                      <div
                        key={product._id}
                        className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md ${
                          isHidden 
                            ? 'border-rose-300 bg-rose-50/20 opacity-90' 
                            : !inStock 
                              ? 'border-amber-300 bg-amber-50/20' 
                              : 'border-[#D0C0C0] hover:border-[#CD0D0D]'
                        }`}
                      >
                        <div>
                          {/* Image & Badges Banner */}
                          <div className="relative h-44 w-full bg-[#FAF8F8] overflow-hidden">
                            <img
                              src={product.image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500';
                              }}
                            />

                            {/* Category Badge */}
                            <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                              {product.category}
                            </span>

                            {/* Live Status Indicators */}
                            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                              {isHidden ? (
                                <span className="bg-[#CD0D0D] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                                  <EyeOff size={11} /> HIDDEN
                                </span>
                              ) : (
                                <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                                  <Eye size={11} /> LIVE ON MENU
                                </span>
                              )}

                              {!inStock && (
                                <span className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                                  OUT OF STOCK
                                </span>
                              )}
                            </div>

                            {/* Price Floating Tag */}
                            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs text-[#1E1818] border border-[#D0C0C0] px-3 py-1 rounded-xl shadow-md flex items-center gap-1 font-black">
                              <span className="text-xs text-[#CD0D0D]">₹</span>
                              <span className="text-sm">{product.price?.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Details Content */}
                          <div className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-black text-sm text-[#1E1818] leading-tight line-clamp-1">
                                {product.name}
                              </h3>
                              <span className="text-[10px] text-[#6E6262] font-semibold shrink-0 bg-[#FAF8F8] border border-[#D0C0C0] px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <Clock size={11} className="text-[#CD0D0D]" />
                                {product.estimatedPrepTime || 15}m
                              </span>
                            </div>

                            <p className="text-[11px] text-[#6E6262] line-clamp-2 leading-relaxed font-medium">
                              {product.description || 'Prepared fresh on order with top ingredients.'}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="p-4 pt-2 border-t border-[#E8E0E0] grid grid-cols-2 gap-2 text-xs">
                          {/* Toggle Hide / Show */}
                          <button
                            onClick={() => handleToggleHideProduct(product)}
                            className={`px-3 py-2 rounded-xl border font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                              isHidden
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                : 'bg-[#FAF8F8] hover:bg-rose-50 text-[#CD0D0D] border-rose-200'
                            }`}
                            title={isHidden ? 'Click to Show in Customer Tables' : 'Click to Hide from Customer Tables'}
                          >
                            {isHidden ? (
                              <>
                                <Eye size={13} />
                                <span>Unhide</span>
                              </>
                            ) : (
                              <>
                                <EyeOff size={13} />
                                <span>Hide</span>
                              </>
                            )}
                          </button>

                          {/* Toggle In Stock / Out of Stock */}
                          <button
                            onClick={() => handleToggleStockProduct(product)}
                            className={`px-3 py-2 rounded-xl border font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                              !inStock
                                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                                : 'bg-[#FAF8F8] hover:bg-white text-[#1E1818] border-[#D0C0C0]'
                            }`}
                            title={inStock ? 'Mark as Out of Stock' : 'Mark as Available / In Stock'}
                          >
                            {inStock ? (
                              <>
                                <PackageCheck size={13} className="text-emerald-600" />
                                <span>In Stock</span>
                              </>
                            ) : (
                              <>
                                <PackageX size={13} className="text-amber-100" />
                                <span>Out of Stock</span>
                              </>
                            )}
                          </button>

                          {/* Edit Item */}
                          <button
                            onClick={() => openEditModal(product)}
                            className="px-3 py-2 bg-[#FAF8F8] hover:bg-white text-[#1E1818] border border-[#D0C0C0] rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="Edit Item Details"
                          >
                            <Edit2 size={13} className="text-sky-600" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Item */}
                          <button
                            onClick={() => handleDeleteProduct(product._id, product.name)}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="Permanently Delete Item"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* VIEW: TABLES & QR CODE MANAGEMENT */}
        {activeTab === 'tables' && (
          <div id="tablesPage" data-testid="tablesPage">
            <TableManagement />
          </div>
        )}

        {/* VIEW: RECEPTION & BILLING DESK */}
        {activeTab === 'reception' && (
          <div id="receptionPage" data-testid="receptionPage" className="space-y-6 sm:space-y-8 animate-fade-in">
            {/* Reception Header Banner */}
            <div className="bg-white border border-[#D0C0C0] p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 sm:gap-3.5">
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
                  <Receipt size={22} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#1E1818] flex items-center flex-wrap gap-2">
                    <span>Reception Billing Counter</span>
                    <span className="text-[10px] sm:text-xs bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/30 px-2 sm:px-2.5 py-0.5 rounded-full font-extrabold">
                      {receptionOrders.length} Unsettled Bills
                    </span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#6E6262] font-semibold mt-0.5 leading-tight">
                    Generate Tax Invoice Receipts, Record Cash Payments & Release Tables to Available Status
                  </p>
                </div>
              </div>

              <button
                onClick={fetchReceptionOrders}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#FAF8F8] hover:bg-white text-[#1E1818] border border-[#D0C0C0] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm quick-touch"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Queue</span>
              </button>
            </div>

            {/* Reception Orders Cards Grid */}
            <div className="space-y-3.5 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h3 className="text-xs font-extrabold text-[#1E1818] uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={16} className="text-[#CD0D0D]" />
                  <span>Pending Table Bills ({filteredPendingOrders.length})</span>
                </h3>

                {/* Filter Table Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl border border-[#D0C0C0] shadow-sm max-w-full">
                  <span className="text-xs font-bold text-[#6E6262] px-2 flex items-center gap-1 shrink-0">
                    <Filter size={12} className="text-[#CD0D0D]" /> Table:
                  </span>
                  <button
                    onClick={() => setPendingTableFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      pendingTableFilter === 'all'
                        ? 'bg-[#CD0D0D] text-white shadow'
                        : 'text-[#6E6262] hover:text-[#1E1818]'
                    }`}
                  >
                    All
                  </button>
                  {dynamicTableNumbers.map(tNum => (
                    <button
                      key={tNum}
                      onClick={() => setPendingTableFilter(tNum)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        pendingTableFilter === tNum
                          ? 'bg-[#CD0D0D] text-white shadow'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      T{tNum}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPendingOrders.length === 0 ? (
                <div className="bg-white border border-[#D0C0C0] rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-sm">
                  <CheckCircle size={36} className="mx-auto text-emerald-500 sm:w-10 sm:h-10" />
                  <h4 className="text-sm sm:text-base font-extrabold text-[#1E1818]">All Table Bills Cleared!</h4>
                  <p className="text-xs text-[#6E6262]">No table orders are currently awaiting billing receipt generation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                  {filteredPendingOrders.map((order: Order) => (
                    <div 
                      key={order._id}
                      className="bg-white border border-[#D0C0C0] hover:border-[#CD0D0D] rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Table Header */}
                        <div className="flex justify-between items-start border-b border-[#E8E0E0] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-[#CD0D0D]/10 text-[#CD0D0D] font-black text-xs sm:text-sm flex items-center justify-center border border-[#CD0D0D]/30 shrink-0">
                              T{order.tableNumber}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs sm:text-sm text-[#1E1818] truncate">{order.customerName}</h4>
                              <p className="text-[10px] text-[#6E6262] font-mono">Order #{order._id.slice(-4)}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow shrink-0 ${
                              order.status === 'ready' || order.status === 'quality_check'
                                ? 'bg-emerald-500 text-white'
                                : order.status === 'preparing' || order.status === 'decorating'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-sky-500 text-white'
                            }`}>
                            {order.status === 'ready' ? '✅ Ready' : order.status === 'preparing' || order.status === 'decorating' ? '🍳 Preparing' : '⏳ ' + order.status}
                          </span>
                        </div>

                        {/* Order Items Table Summary */}
                        <div className="space-y-1.5 bg-[#FAF8F8] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#D0C0C0]">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="text-xs flex justify-between items-center text-[#1E1818]">
                              <span className="font-semibold truncate pr-1">
                                {item.quantity}x {item.product?.name || item.name || 'Food Item'}
                              </span>
                              <span className="font-mono font-bold text-[#CD0D0D] shrink-0">
                                ₹{(item.price || item.product?.price || 0) * item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total Amount Banner */}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-bold text-[#6E6262]">Total Amount:</span>
                          <span className="text-base sm:text-lg font-black text-[#CD0D0D] font-mono">
                            ₹{order.totalAmount?.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Settle Bill or Track Status */}
                      {order.status === 'ready' || order.status === 'quality_check' ? (
                        <button
                          onClick={() => setSelectedReceiptOrder(order)}
                          className="w-full py-2.5 sm:py-3 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-xl sm:rounded-2xl text-xs shadow-md shadow-[#CD0D0D]/20 flex items-center justify-center gap-2 cursor-pointer transition-all quick-touch mt-2"
                        >
                          <Printer size={15} />
                          <span>Settle Bill & Release Table {order.tableNumber}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedReceiptOrder(order)}
                          className="w-full py-2.5 sm:py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl sm:rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all quick-touch mt-2"
                        >
                          <Receipt size={15} />
                          <span>View Live Bill — Kitchen Preparing...</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PAYMENT SETTLEMENT HISTORY LOG */}
            <div className="space-y-4 pt-4 border-t border-[#D0C0C0]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <h3 className="text-xs font-extrabold text-[#1E1818] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-600" />
                  <span>Payment Settlement History Log ({filteredPaymentHistory.length})</span>
                </h3>

                {/* Date & Table Filters */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap max-w-full overflow-x-auto no-scrollbar pb-1">
                  {/* Date Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold overflow-x-auto no-scrollbar shrink-0">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1 shrink-0">
                      <Calendar size={12} className="text-[#CD0D0D]" /> Date:
                    </span>
                    {['all', 'today', '7days', '30days', 'lastmonth', 'custom'].map(f => (
                      <button
                        key={f}
                        onClick={() => setHistoryDateFilter(f)}
                        className={`px-2.5 py-1 rounded-xl text-xs capitalize transition-all cursor-pointer shrink-0 ${
                          historyDateFilter === f
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : f === '7days' ? '7 Days' : f === '30days' ? '30 Days' : f === 'lastmonth' ? 'Last Month' : 'Custom'}
                      </button>
                    ))}
                  </div>

                  {/* Table Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold overflow-x-auto no-scrollbar shrink-0">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1 shrink-0">
                      <Filter size={12} className="text-[#CD0D0D]" /> Table:
                    </span>
                    <button
                      onClick={() => setHistoryTableFilter('all')}
                      className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer shrink-0 ${
                        historyTableFilter === 'all'
                          ? 'bg-[#CD0D0D] text-white shadow'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      All
                    </button>
                    {dynamicTableNumbers.map(tNum => (
                      <button
                        key={tNum}
                        onClick={() => setHistoryTableFilter(tNum)}
                        className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer shrink-0 ${
                          historyTableFilter === tNum
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        T{tNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredPaymentHistory.length === 0 ? (
                <div className="bg-white border border-[#D0C0C0] rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center text-[#6E6262] text-xs font-semibold">
                  No payment history transactions match selected filters.
                </div>
              ) : (
                <div id="receptionTable" data-testid="receptionTable" className="bg-white border border-[#D0C0C0] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
                  <div className="responsive-table-wrapper">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-[#FAF8F8] border-b border-[#D0C0C0] text-[#6E6262] font-extrabold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3 sm:p-4">Order ID</th>
                          <th className="p-3 sm:p-4">Table #</th>
                          <th className="p-3 sm:p-4">Customer</th>
                          <th className="p-3 sm:p-4">Payment Method</th>
                          <th className="p-3 sm:p-4">Amount Paid</th>
                          <th className="p-3 sm:p-4">Time Settled</th>
                          <th className="p-3 sm:p-4 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E0E0] text-[#1E1818]">
                        {filteredPaymentHistory.map((order: Order, idx: number) => (
                          <tr 
                            key={`${order._id}-${idx}`} 
                            id={idx === 0 ? "historyRow1" : `historyRow-${idx + 1}`}
                            data-testid={idx === 0 ? "historyRow1" : `historyRow-${idx + 1}`}
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="hover:bg-[#CD0D0D]/5 transition-colors cursor-pointer group"
                          >
                            <td className="p-3 sm:p-4 font-mono font-bold text-[#CD0D0D]">#{order._id.slice(-6)}</td>
                            <td className="p-3 sm:p-4 font-extrabold text-[#CD0D0D] group-hover:underline">Table {order.tableNumber}</td>
                            <td className="p-3 sm:p-4 font-semibold">{order.customerName}</td>
                            <td className="p-3 sm:p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/30">
                                {order.paymentMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="p-3 sm:p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                            <td className="p-3 sm:p-4 text-[#6E6262] font-semibold whitespace-nowrap">
                              {new Date((order as any).updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 sm:p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  id={`printReceiptBtn-${order._id}`}
                                  data-testid={`printReceiptBtn-${order._id}`}
                                  onClick={() => handleDirectPrintReceipt(order)}
                                  className="px-2.5 py-1 rounded-xl bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1 quick-touch"
                                  title="Direct Print 80mm POS Thermal Receipt"
                                >
                                  <Printer size={12} />
                                  <span>Print</span>
                                </button>
                                <button
                                  id={`viewBillBtn-${order._id}`}
                                  data-testid={`viewBillBtn-${order._id}`}
                                  onClick={() => setSelectedReceiptOrder(order)}
                                  className="px-2.5 py-1 rounded-xl bg-[#FAF8F8] hover:bg-white text-[#1E1818] border border-[#D0C0C0] font-bold text-[11px] transition-all cursor-pointer shadow-xs quick-touch"
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: OVERVIEW STORE ANALYTICS */}
        {activeTab === 'overview' && (
          <div id="overviewPage" data-testid="overviewPage" className="space-y-8">
            {/* Filter & Custom Date Section Header */}
            <div className="bg-white border border-[#D0C0C0] p-4 sm:p-5 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1E1818] flex items-center gap-2">
                    <Calendar size={20} className="text-[#CD0D0D]" />
                    <span>Store Operations Analytics & Date Filtering</span>
                  </h2>
                  <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
                    Real-time revenue metrics, kitchen performance, and custom date range stats
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex bg-[#FAF8F8] p-1.5 rounded-2xl border border-[#D0C0C0] shadow-xs flex-wrap gap-1">
                  {(['today', '7days', '30days', 'lastmonth', 'all', 'custom'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setDateFilter(f);
                        if (f !== 'custom') {
                          fetchAdminData(f);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        dateFilter === f
                          ? 'bg-[#CD0D0D] text-white shadow-md'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      {f === 'today' ? 'Today' : f === '7days' ? 'Last 7 Days' : f === '30days' ? 'Last 30 Days' : f === 'lastmonth' ? 'Last Month' : f === 'all' ? 'All Time' : '📅 Custom Range'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separated Custom Date Range Picker Section */}
              {dateFilter === 'custom' && (
                <div className="pt-4 border-t border-[#E8E0E0] animate-fade-in">
                  <div className="bg-[#FAF8F8] border border-[#D0C0C0] p-4 rounded-2xl flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-[#6E6262] uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={13} className="text-[#CD0D0D]" /> Start Date:
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full bg-white border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2 text-xs text-[#1E1818] font-semibold outline-none"
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-[#6E6262] uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={13} className="text-[#CD0D0D]" /> End Date:
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-white border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2 text-xs text-[#1E1818] font-semibold outline-none"
                      />
                    </div>

                    <button
                      onClick={() => fetchAdminData('custom', customStartDate, customEndDate)}
                      className="w-full sm:w-auto px-5 py-2 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 h-[38px] active:scale-[0.98]"
                    >
                      <Filter size={14} />
                      <span>Apply Date Filter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Gross Revenue</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><TrendingUp size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#CD0D0D] font-mono">₹{displayData.grossRevenue?.toFixed(2)}</div>
                <p className="text-[10px] text-emerald-600 font-bold">+14% from previous period</p>
              </div>

              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Total Orders</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><ShoppingBag size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#1E1818] font-mono">{displayData.totalOrders}</div>
                <p className="text-[10px] text-[#6E6262] font-semibold">Completed Orders</p>
              </div>

              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Avg Prep Time</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><Clock size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#1E1818] font-mono">{displayData.avgPrepTimeMins} <span className="text-xs font-bold text-[#6E6262]">mins</span></div>
                <p className="text-[10px] text-emerald-600 font-bold">Fast Kitchen Preparation</p>
              </div>

              <div className="bg-white border border-[#D0C0C0] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#6E6262]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Active Tables</span>
                  <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D]"><Users size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#CD0D0D] font-mono">{displayData?.liveActiveTables !== undefined ? displayData.liveActiveTables : 0}</div>
                <p className="text-[10px] text-[#6E6262] font-semibold">Live Occupied Tables</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#E8E0E0] pb-3">
                  <h3 className="font-extrabold text-sm text-[#1E1818]">Category Sales Share</h3>
                  <PieIcon size={16} className="text-[#CD0D0D]" />
                </div>
                <div className="space-y-3">
                  {(() => {
                    const categories = (displayData?.categoryBreakdown && displayData.categoryBreakdown.length > 0)
                      ? displayData.categoryBreakdown
                      : defaultDashboardData.categoryBreakdown;

                    return categories.map((cat: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#1E1818]">{cat.category}</span>
                          <span className="text-[#CD0D0D] font-mono">₹{cat.sales || 0} ({cat.percent || 0}%)</span>
                        </div>
                        <div className="w-full bg-[#FAF8F8] border border-[#D0C0C0] rounded-full h-2.5 overflow-hidden">
                          <div className="h-full bg-[#CD0D0D] rounded-full transition-all duration-500" style={{ width: `${Math.max(5, cat.percent || 0)}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Peak Dining Hours Line Graph */}
              <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#E8E0E0] pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1E1818]">Peak Dining Hours Graph</h3>
                    <p className="text-[10px] text-[#6E6262] font-semibold">Hourly order volume line chart</p>
                  </div>
                  <TrendingUp size={18} className="text-[#CD0D0D]" />
                </div>

                <div className="pt-2 relative">
                  {(() => {
                    const peaks = (displayData?.peakHours && displayData.peakHours.length > 0)
                      ? displayData.peakHours
                      : defaultDashboardData.peakHours;

                    const maxOrders = Math.max(1, ...peaks.map((p: any) => p.orders || 0));
                    const width = 500;
                    const height = 130;
                    const paddingX = 30;
                    const paddingY = 25;

                    const points = peaks.map((p: any, i: number) => {
                      const x = paddingX + (i * ((width - paddingX * 2) / (peaks.length - 1)));
                      const y = height - paddingY - (((p.orders || 0) / maxOrders) * (height - paddingY * 2));
                      return { x, y, hour: p.hour, orders: p.orders || 0 };
                    });

                    const linePath = points.reduce((acc: string, pt: any, i: number) => {
                      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                    }, '');

                    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - 15} L ${points[0].x} ${height - 15} Z`;

                    return (
                      <div className="w-full overflow-x-auto">
                        <div className="min-w-[420px] relative">
                          <svg viewBox={`0 0 ${width} ${height + 25}`} className="w-full h-auto overflow-visible">
                            <defs>
                              <linearGradient id="peakLineGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#CD0D0D" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#CD0D0D" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Horizontal Grid lines */}
                            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#E8E0E0" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1={paddingX} y1={(height - 15) / 2 + paddingY / 2} x2={width - paddingX} y2={(height - 15) / 2 + paddingY / 2} stroke="#E8E0E0" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1={paddingX} y1={height - 15} x2={width - paddingX} y2={height - 15} stroke="#D0C0C0" strokeWidth="1.5" />

                            {/* Area Gradient Fill */}
                            <path d={areaPath} fill="url(#peakLineGradient)" />

                            {/* Main Curve Line */}
                            <path d={linePath} fill="none" stroke="#CD0D0D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Interactive Data Points & Labels */}
                            {points.map((pt: any, idx: number) => (
                              <g key={idx} className="group cursor-pointer">
                                {/* Vertical Guideline on Hover */}
                                <line 
                                  x1={pt.x} y1={paddingY} x2={pt.x} y2={height - 15} 
                                  stroke="#CD0D0D" strokeWidth="1" strokeDasharray="2 2" 
                                  className="opacity-0 group-hover:opacity-100 transition-opacity" 
                                />

                                {/* Dot Node */}
                                <circle 
                                  cx={pt.x} cy={pt.y} r="5" 
                                  className="fill-[#CD0D0D] stroke-white stroke-2 group-hover:r-7 transition-all" 
                                />

                                {/* Tooltip Text on Hover */}
                                <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <rect 
                                    x={pt.x - 30} y={Math.max(2, pt.y - 30)} 
                                    width="60" height="20" rx="6" 
                                    className="fill-[#1E1818]" 
                                  />
                                  <text 
                                    x={pt.x} y={Math.max(2, pt.y - 30) + 13} 
                                    textAnchor="middle" 
                                    className="fill-white text-[9px] font-mono font-bold"
                                  >
                                    {pt.orders} orders
                                  </text>
                                </g>

                                {/* X-Axis Hour Label */}
                                <text 
                                  x={pt.x} y={height + 12} 
                                  textAnchor="middle" 
                                  className="fill-[#6E6262] text-[10px] font-bold font-sans"
                                >
                                  {pt.hour}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* OVERVIEW ORDER HISTORY TABLE WITH FILTERS */}
            <div className="space-y-4 pt-6 border-t border-[#D0C0C0]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1E1818] uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#CD0D0D]" />
                    <span>Overview Store Order History</span>
                  </h3>
                  <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
                    Complete log of all live & past store orders with status & table filters
                  </p>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Date Filter for Order History Table */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold shadow-xs">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1">
                      <Calendar size={12} className="text-[#CD0D0D]" /> Date:
                    </span>
                    {['all', 'today', '7days', '30days', 'lastmonth', 'custom'].map(f => (
                      <button
                        key={f}
                        onClick={() => setOverviewDateFilter(f)}
                        className={`px-2.5 py-1 rounded-xl text-xs capitalize font-extrabold transition-all cursor-pointer ${
                          overviewDateFilter === f
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : f === '7days' ? '7 Days' : f === '30days' ? '30 Days' : f === 'lastmonth' ? 'Last Month' : 'Custom'}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold shadow-xs">
                    <span className="text-[#6E6262] px-2 flex items-center gap-1">
                      <Filter size={12} className="text-[#CD0D0D]" /> Status:
                    </span>
                    {['all', 'paid', 'pending', 'ready', 'cancelled'].map(st => (
                      <button
                        key={st}
                        onClick={() => setOverviewStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                          overviewStatusFilter === st
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Table Filter */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#D0C0C0] text-xs font-bold shadow-xs">
                    <span className="text-[#6E6262] px-2">Table:</span>
                    <button
                      onClick={() => setOverviewTableFilter('all')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        overviewTableFilter === 'all'
                          ? 'bg-[#CD0D0D] text-white shadow'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      All
                    </button>
                    {dynamicTableNumbers.map(tNum => (
                      <button
                        key={tNum}
                        onClick={() => setOverviewTableFilter(tNum)}
                        className={`px-2 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          overviewTableFilter === tNum
                            ? 'bg-[#CD0D0D] text-white shadow'
                            : 'text-[#6E6262] hover:text-[#1E1818]'
                        }`}
                      >
                        T{tNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bulk Delete Bar */}
              {selectedOverviewOrderIds.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2 text-rose-700 font-extrabold text-xs">
                    <CheckSquare size={16} />
                    <span>{selectedOverviewOrderIds.length} order(s) selected for bulk deletion</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteBulkOrders}
                      className="px-4 py-2 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Delete Selected ({selectedOverviewOrderIds.length})</span>
                    </button>
                    <button
                      onClick={() => setSelectedOverviewOrderIds([])}
                      className="px-3 py-2 bg-white text-[#6E6262] hover:text-[#1E1818] font-bold text-xs rounded-xl border border-[#D0C0C0] cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* Order History Table */}
              <div className="bg-white border border-[#D0C0C0] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F8] border-b border-[#D0C0C0] text-[#6E6262] font-extrabold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4 w-10 text-center">
                          <input 
                            type="checkbox"
                            checked={filteredOverviewOrders.length > 0 && filteredOverviewOrders.every(o => selectedOverviewOrderIds.includes(o._id))}
                            onChange={() => toggleSelectAllOrders(filteredOverviewOrders)}
                            className="w-4 h-4 accent-[#CD0D0D] rounded cursor-pointer"
                            title="Select all filtered orders"
                          />
                        </th>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Table #</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Items Summary</th>
                        <th className="p-4">Total Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date & Time</th>
                        <th className="p-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0E0] text-[#1E1818]">
                      {filteredOverviewOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-[#6E6262] font-semibold">
                            No orders found matching selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredOverviewOrders.map((order: Order, index: number) => (
                          <tr 
                            key={order._id}
                            id={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                            data-testid={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                            onClick={() => setSelectedReceiptOrder(order)}
                            className={`hover:bg-[#CD0D0D]/5 transition-colors cursor-pointer group ${selectedOverviewOrderIds.includes(order._id) ? 'bg-rose-50/70' : ''}`}
                          >
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox"
                                checked={selectedOverviewOrderIds.includes(order._id)}
                                onChange={() => toggleSelectOrder(order._id)}
                                className="w-4 h-4 accent-[#CD0D0D] rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-4 font-mono font-bold text-[#CD0D0D]">#{order._id.slice(-6)}</td>
                            <td className="p-4 font-extrabold text-[#CD0D0D] group-hover:underline">Table {order.tableNumber}</td>
                            <td className="p-4 font-semibold">{order.customerName}</td>
                            <td className="p-4 text-[11px] text-[#6E6262] font-medium max-w-[200px] truncate">
                              {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                            </td>
                            <td className="p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-xs ${
                                order.status === 'served' || order.paymentStatus === 'paid'
                                  ? 'bg-emerald-500 text-white'
                                  : order.status === 'cancelled'
                                    ? 'bg-[#CD0D0D] text-white'
                                    : 'bg-amber-500 text-white'
                              }`}>
                                {order.paymentStatus === 'paid' ? 'PAID' : order.status}
                              </span>
                            </td>
                            <td className="p-4 text-[#6E6262] font-semibold">
                              {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  id={`viewBillBtn-${order._id}`}
                                  data-testid={`viewBillBtn-${order._id}`}
                                  onClick={() => setSelectedReceiptOrder(order)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F8] group-hover:bg-[#CD0D0D] group-hover:text-white text-[#1E1818] border border-[#D0C0C0] font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                                >
                                  View Bill
                                </button>
                                <button
                                  id={`deleteOrderBtn-${order._id}`}
                                  data-testid={`deleteOrderBtn-${order._id}`}
                                  onClick={() => handleDeleteSingleOrder(order._id)}
                                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition-colors cursor-pointer"
                                  title={`Delete order #${order._id.slice(-6)}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 🧾 ULTRA-MODERN AI SMART RECEIPT MODAL */}
      {selectedReceiptOrder && (
        <div id="receiptModal" data-testid="receiptModal">
          <SmartReceiptModal
            order={selectedReceiptOrder}
            onClose={() => setSelectedReceiptOrder(null)}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            settlingBill={settlingBill}
            onSettleBill={handlePrintAndSettleBill}
            onPrintReceipt={() => handleDirectPrintReceipt()}
          />
        </div>
      )}

      {/* 🍔 ADD FOOD ITEM & NEW CATEGORY MODAL */}
      {showAddFoodModal && (
        <div id="addItemModal" data-testid="addItemModal" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-[#D0C0C0] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-[#1E1818] my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#CD0D0D] via-[#A60A0A] to-[#7A0707] text-white p-5 flex justify-between items-center relative shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                  <Utensils size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white">Add New Food Item & Category</h3>
                  <p className="text-[10px] text-rose-100 font-semibold">Live sync with Customer Menu & Kitchen Board</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddFoodModal(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveFoodItem} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* ITEM NAME */}
              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Food Item Name *
                </label>
                <input
                  id="itemNameInput"
                  data-testid="itemNameInput"
                  type="text"
                  required
                  placeholder="e.g. Red Velvet Cream Cake / Spicy Paneer Tikka"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2.5 text-xs text-[#1E1818] font-semibold outline-none transition-colors"
                />
              </div>

              {/* PRICE (₹) */}
              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Price (₹ INR) *
                </label>
                <input
                  id="itemPriceInput"
                  data-testid="itemPriceInput"
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 350.00"
                  value={foodPrice}
                  onChange={(e) => setFoodPrice(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2.5 text-xs text-[#1E1818] font-mono font-bold outline-none transition-colors"
                />
              </div>

              {/* CATEGORY SELECTOR & NEW CATEGORY TOGGLE */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider">
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-[11px] font-extrabold text-[#CD0D0D] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>{isCustomCategory ? 'Select Existing Category' : '+ Add New Custom Category'}</span>
                  </button>
                </div>

                {!isCustomCategory ? (
                  <select
                    id="itemCategorySelect"
                    data-testid="itemCategorySelect"
                    value={foodCategory}
                    onChange={(e) => setFoodCategory(e.target.value)}
                    className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2.5 text-xs text-[#1E1818] font-bold outline-none cursor-pointer"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="newCategoryInput"
                    data-testid="newCategoryInput"
                    type="text"
                    required
                    placeholder="Type new category name (e.g. Milkshakes / Special Combos)..."
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="w-full bg-rose-50 border border-rose-300 focus:border-[#CD0D0D] rounded-xl px-4 py-2.5 text-xs text-[#1E1818] font-bold outline-none animate-fade-in"
                  />
                )}
              </div>

              {/* SUB-CATEGORY */}
              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Sub-Category / Type
                </label>
                <input
                  id="itemSubCategoryInput"
                  data-testid="itemSubCategoryInput"
                  type="text"
                  placeholder="e.g. Fresh Cream / Hot Beverage / Veg Delight"
                  value={foodSubCategory}
                  onChange={(e) => setFoodSubCategory(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2 text-xs text-[#1E1818] font-medium outline-none"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Description / Ingredients
                </label>
                <textarea
                  id="itemDescriptionInput"
                  data-testid="itemDescriptionInput"
                  rows={2}
                  placeholder="Freshly prepared with premium ingredients..."
                  value={foodDescription}
                  onChange={(e) => setFoodDescription(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2 text-xs text-[#1E1818] font-medium outline-none resize-none"
                />
              </div>

              {/* IMAGE SELECTOR (UPLOAD FILE OR URL/PRESET) */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider">
                    Food Image *
                  </label>
                  
                  {/* Mode Switcher Buttons */}
                  <div className="flex bg-[#FAF8F8] p-0.5 rounded-xl border border-[#D0C0C0] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        imageInputMode === 'upload'
                          ? 'bg-[#CD0D0D] text-white shadow-xs'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      <Upload size={12} />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode('url')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        imageInputMode === 'url'
                          ? 'bg-[#CD0D0D] text-white shadow-xs'
                          : 'text-[#6E6262] hover:text-[#1E1818]'
                      }`}
                    >
                      <LinkIcon size={12} />
                      <span>Image URL</span>
                    </button>
                  </div>
                </div>

                {/* MODE 1: FILE UPLOAD */}
                {imageInputMode === 'upload' && (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFileUpload(file);
                      }}
                    />

                    {foodImage ? (
                      <div className="relative border-2 border-dashed border-emerald-400 bg-emerald-50/50 rounded-2xl p-3 flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-emerald-300 bg-white shrink-0 shadow-xs">
                          <img src={foodImage} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                            <Check size={14} className="text-emerald-600" /> Image Uploaded Ready
                          </p>
                          <p className="text-[10px] text-[#6E6262] truncate">Auto-compressed & optimized</p>
                          <div className="flex gap-2 mt-1.5">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-white border border-[#D0C0C0] hover:border-[#CD0D0D] text-[#1E1818] text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Change Photo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFoodImage('')}
                              className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleImageFileUpload(file);
                        }}
                        className="border-2 border-dashed border-[#D0C0C0] hover:border-[#CD0D0D] bg-[#FAF8F8] hover:bg-rose-50/30 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-white border border-[#D0C0C0] group-hover:border-[#CD0D0D] flex items-center justify-center text-[#CD0D0D] shadow-xs group-hover:scale-105 transition-transform">
                          {uploadingImage ? (
                            <RefreshCw size={18} className="animate-spin text-[#CD0D0D]" />
                          ) : (
                            <Upload size={18} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1E1818] group-hover:text-[#CD0D0D]">
                            {uploadingImage ? 'Optimizing photo...' : 'Click to Upload Image from Device'}
                          </p>
                          <p className="text-[10px] text-[#6E6262]">or drag and drop photo here (PNG, JPG, WEBP)</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 2: URL INPUT & PRESETS */}
                {imageInputMode === 'url' && (
                  <div className="space-y-2">
                    <input
                      id="itemImageInput"
                      data-testid="itemImageInput"
                      type="url"
                      placeholder="Paste Image URL (https://...)"
                      value={foodImage}
                      onChange={(e) => setFoodImage(e.target.value)}
                      className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2 text-xs text-[#1E1818] outline-none"
                    />
                    
                    {/* Preset Chips */}
                    <div>
                      <span className="text-[10px] font-bold text-[#6E6262] block mb-1">Or Pick Instant Preset:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '🍰 Cake', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500' },
                          { label: '🍔 Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500' },
                          { label: '🍹 Juice', url: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500' },
                          { label: '🧁 Pastry', url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500' },
                          { label: '🍫 Brownie', url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500' },
                          { label: '🍟 Snacks', url: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500' }
                        ].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setFoodImage(preset.url)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              foodImage === preset.url ? 'bg-[#CD0D0D] text-white border-[#CD0D0D]' : 'bg-[#FAF8F8] text-[#6E6262] border-[#D0C0C0] hover:bg-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {foodImage && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#D0C0C0] shrink-0 bg-white">
                          <img src={foodImage} alt="URL Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                        <span className="text-[10px] text-emerald-700 font-bold">✓ Valid Image URL linked</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SAVE BUTTON */}
              <div className="pt-3">
                <button
                  id="saveItemBtn"
                  data-testid="saveItemBtn"
                  type="submit"
                  disabled={savingFoodItem}
                  className="w-full py-3.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-[#CD0D0D]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  <Plus size={16} />
                  <span>{savingFoodItem ? 'Adding to Menu...' : 'Publish Food Item to Live Customer Menu'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏷️ CONFIGURE GST RATE MODAL */}
      {showGstModal && (
        <div id="gstModal" data-testid="gstModal" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#D0C0C0] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-[#1E1818]">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-base">🇮🇳</span>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">Indian Govt GST Tax Rate Manager</h3>
                  <p className="text-[10px] text-amber-100 font-medium">Standard Bakery & Food Court Tax Slabs</p>
                </div>
              </div>
              <button
                onClick={() => setShowGstModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGstRate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Total GST Rate (%)
                </label>
                <div className="relative">
                  <input
                    id="gstRateInput"
                    data-testid="gstRateInput"
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    required
                    placeholder="e.g. 5 or 12 or 18"
                    value={tempGstInput}
                    onChange={(e) => setTempGstInput(e.target.value)}
                    className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#1E1818] outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#6E6262]">% GST</span>
                </div>
                <p className="text-[10px] text-[#6E6262] mt-1.5 font-semibold flex items-center justify-between">
                  <span>Central CGST: <strong className="text-amber-600 font-mono">{(parseFloat(tempGstInput) / 2 || 0).toFixed(1)}%</strong></span>
                  <span>State SGST: <strong className="text-amber-600 font-mono">{(parseFloat(tempGstInput) / 2 || 0).toFixed(1)}%</strong></span>
                </p>
              </div>

              {/* Official Indian Govt GST Slabs */}
              <div className="space-y-2 pt-1 border-t border-[#E8E0E0]">
                <label className="block text-[10px] font-extrabold text-[#6E6262] uppercase tracking-wider">
                  Official Govt GST Slabs:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '5% Restaurant/Bakery', desc: '2.5% CGST + 2.5% SGST', val: 5 },
                    { label: '12% Packaged Food', desc: '6.0% CGST + 6.0% SGST', val: 12 },
                    { label: '18% AC Catering', desc: '9.0% CGST + 9.0% SGST', val: 18 },
                    { label: '0% Tax Exempt', desc: 'No GST Applied', val: 0 }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setTempGstInput(String(p.val))}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        tempGstInput === String(p.val)
                          ? 'bg-amber-50 border-amber-500 shadow-xs'
                          : 'bg-[#FAF8F8] text-[#1E1818] border-[#D0C0C0] hover:bg-white'
                      }`}
                    >
                      <div className="text-[11px] font-extrabold text-[#1E1818] flex items-center justify-between">
                        <span>{p.label}</span>
                        {tempGstInput === String(p.val) && <span className="text-amber-600 text-xs">✓</span>}
                      </div>
                      <p className="text-[9px] text-[#6E6262] font-semibold mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="saveGstBtn"
                  data-testid="saveGstBtn"
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <CheckCircle size={15} />
                  <span>Update GST Rate & Apply to POS Receipts</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT FOOD ITEM MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in text-[#1E1818]">
          <div className="bg-white border border-[#D0C0C0] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in my-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1E1818] to-[#3A2F2F] text-white p-5 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 border border-white/20">
                  <Edit2 size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white">Edit Food Item</h3>
                  <p className="text-[10px] text-zinc-300 font-medium">Changes sync across all tables in real-time</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditProduct} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Food Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2.5 text-xs text-[#1E1818] font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Price (₹ INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2.5 text-xs text-[#1E1818] font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2.5 text-xs text-[#1E1818] font-bold outline-none cursor-pointer"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-2 text-xs text-[#1E1818] font-medium outline-none resize-none"
                />
              </div>

              {/* Edit Image */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider">
                    Food Image
                  </label>
                  <div className="flex bg-[#FAF8F8] p-0.5 rounded-xl border border-[#D0C0C0] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditImageInputMode('upload')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        editImageInputMode === 'upload' ? 'bg-[#CD0D0D] text-white' : 'text-[#6E6262]'
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditImageInputMode('url')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        editImageInputMode === 'url' ? 'bg-[#CD0D0D] text-white' : 'text-[#6E6262]'
                      }`}
                    >
                      URL
                    </button>
                  </div>
                </div>

                {editImageInputMode === 'upload' ? (
                  <div>
                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleEditImageFileUpload(file);
                      }}
                    />
                    <div
                      onClick={() => editFileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#D0C0C0] hover:border-[#CD0D0D] bg-[#FAF8F8] p-3 rounded-2xl text-center cursor-pointer flex items-center justify-center gap-2"
                    >
                      {editImage ? (
                        <div className="flex items-center gap-3">
                          <img src={editImage} alt="Edit preview" className="w-12 h-12 rounded-xl object-cover border" />
                          <span className="text-xs font-bold text-[#1E1818]">Click to Change Photo</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[#6E6262]">Click to upload photo</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={editImage}
                    onChange={(e) => setEditImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-3 py-2 text-xs text-[#1E1818] outline-none"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={savingEditProduct}
                  className="flex-1 py-3 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-2xl text-xs shadow-md transition-all cursor-pointer"
                >
                  {savingEditProduct ? 'Saving Changes...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-5 py-3 bg-[#FAF8F8] text-[#6E6262] font-bold text-xs rounded-2xl border border-[#D0C0C0] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🖨 DIRECT POS THERMAL RECEIPT PRINT CONTAINER (Active on window.print()) */}
      {printTargetOrder && (
        <div id="pos-thermal-print-container">
          <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #CD0D0D', paddingBottom: '8px', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, color: '#CD0D0D', fontSize: '16px', fontWeight: 900 }}>🍰 CakeFlow AI Bakery</h2>
            <div style={{ fontSize: '10px', color: '#6E6262', fontWeight: 600 }}>Madurai Branch • Counter C02</div>
            <div style={{ fontSize: '10px', color: '#6E6262', fontWeight: 600 }}>GSTIN: 33AAAAA0000A1Z5</div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#CD0D0D', marginTop: '4px' }}>TAX INVOICE RECEIPT</div>
          </div>

          <div style={{ background: '#E6F4EA', border: '1px solid #CEEAD6', color: '#137333', padding: '6px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>✓ PAYMENT SUCCESSFUL</span>
            <span>Paid via {printTargetOrder.paymentMethod || 'Cash'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10px', borderBottom: '1px dashed #D0C0C0', paddingBottom: '6px', marginBottom: '8px' }}>
            <div>
              <div><b>Table:</b> Table {printTargetOrder.tableNumber}</div>
              <div><b>Guest:</b> {printTargetOrder.customerName}</div>
              <div><b>Served By:</b> Rahul (EMP204)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div><b>Bill #:</b> #{printTargetOrder._id.slice(-6)}</div>
              <div><b>Time:</b> {new Date(printTargetOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div><b>Chef:</b> Chef Arjun</div>
            </div>
          </div>

          <div style={{ borderBottom: '1px dashed #D0C0C0', paddingBottom: '6px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 800, color: '#6E6262', textTransform: 'uppercase', borderBottom: '1px solid #E8E0E0', paddingBottom: '3px', marginBottom: '5px' }}>
              <span>ITEMS ORDERED</span>
              <span>AMT</span>
            </div>
            {printTargetOrder.items?.map((item: any, idx: number) => {
              const pName = item.product?.name || item.name || 'Food Item';
              const price = item.price || item.product?.price || 0;
              return (
                <div key={idx} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ fontWeight: 600 }}>{item.quantity}x {pName}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>₹{price * item.quantity}</span>
                  </div>
                  {item.instructions && (
                    <div style={{ fontSize: '9px', color: '#CD0D0D', marginTop: '1px' }}>📌 Note: "{item.instructions}"</div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '10px', borderBottom: '1px dashed #D0C0C0', paddingBottom: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#6E6262' }}>
              <span>Subtotal:</span>
              <span>₹{(printTargetOrder.totalAmount * 0.95).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#6E6262' }}>
              <span>CGST (2.5%):</span>
              <span>₹{(printTargetOrder.totalAmount * 0.025).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#6E6262' }}>
              <span>SGST (2.5%):</span>
              <span>₹{(printTargetOrder.totalAmount * 0.025).toFixed(2)}</span>
            </div>
            <div style={{ background: '#E6F4EA', color: '#137333', fontWeight: 800, padding: '3px 6px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
              <span>Savings Today:</span>
              <span>-₹50.00 🎉</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900, color: '#CD0D0D', borderTop: '1.5px dashed #CD0D0D', paddingTop: '6px', marginTop: '4px' }}>
              <span>GRAND TOTAL:</span>
              <span>₹{printTargetOrder.totalAmount?.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ background: '#FEF7E0', border: '1px solid #FDE293', borderRadius: '8px', padding: '6px 8px', fontSize: '9.5px', color: '#B06000', marginBottom: '8px' }}>
            <b>🎉 You Earned +{Math.floor((printTargetOrder.totalAmount || 0) * 0.1)} Cake Points!</b><br />
            Coupon: <b>CAKE20</b> (20% OFF Next Visit)
          </div>

          <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#CD0D0D' }}>
            ❤️ Thank you for dining at CakeFlow AI!
          </div>
        </div>
      )}
    </div>
  );
};

export { AdminView as DashboardView };

