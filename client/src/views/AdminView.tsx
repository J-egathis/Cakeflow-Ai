import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { analyticsApi, orderApi, tableApi, productApi, categoryApi, authApi, getSocket, BASE_URL } from '../services/api';
import { SmartTable, Order, Product } from '../types';
import { 
  TrendingUp, Users, Clock, ShoppingBag, 
  BarChart3, RefreshCw, Layers, Sparkles, Filter, 
  Calendar, CheckCircle, AlertTriangle, AlertCircle, 
  Search, ShieldAlert, Check, X, Printer, Receipt, DollarSign,
  Coffee, ChevronRight, PieChart as PieIcon, LogOut, QrCode, Download,
  Trash2, Trash, CheckSquare, Square, Plus, Utensils, Tag, Image, Upload, Link as LinkIcon, Camera,
  Eye, EyeOff, Edit, Edit2, XCircle, PackageCheck, PackageX,
  Settings, Menu, ChevronDown, Package, Wallet, KeyRound, ChefHat, UserCheck
} from 'lucide-react';
import { TableManagement } from '../components/TableManagement';
import { SmartReceiptModal } from '../components/SmartReceiptModal';
import { ManageCategoriesModal } from '../components/ManageCategoriesModal';
import { InventoryManagement } from '../components/InventoryManagement';
import { MobileRadialMenu } from '../components/MobileRadialMenu';
import { AccountsManagement } from '../components/AccountsManagement';
import { SoldUnsoldTracker } from '../components/SoldUnsoldTracker';

interface AdminViewProps {
  user: { username: string; role: string };
  onLogout: () => void;
}

type AdminTab = 'overview' | 'reception' | 'tables' | 'foods' | 'sold_unsold' | 'inventory' | 'accounts' | 'expenses' | 'staff_logins';
const VALID_ADMIN_TABS: AdminTab[] = ['overview', 'reception', 'tables', 'foods', 'sold_unsold', 'inventory', 'accounts', 'expenses', 'staff_logins'];

export const AdminView: React.FC<AdminViewProps> = ({ user, onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    const urlTab = searchParams.get('tab') as AdminTab;
    if (urlTab && VALID_ADMIN_TABS.includes(urlTab)) return urlTab;
    const savedTab = localStorage.getItem('admin_active_tab') as AdminTab;
    if (savedTab && VALID_ADMIN_TABS.includes(savedTab)) return savedTab;
    return 'overview';
  });

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    localStorage.setItem('admin_active_tab', tab);
    setSearchParams(prev => {
      prev.set('tab', tab);
      return prev;
    }, { replace: true });
  };

  useEffect(() => {
    const urlTab = searchParams.get('tab') as AdminTab;
    if (urlTab && VALID_ADMIN_TABS.includes(urlTab)) {
      if (urlTab !== activeTab) {
        setActiveTabState(urlTab);
      }
      localStorage.setItem('admin_active_tab', urlTab);
    } else {
      setSearchParams(prev => {
        prev.set('tab', activeTab);
        return prev;
      }, { replace: true });
    }
  }, [searchParams]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Tablets (768px – 1023px) get the compact icon rail so content has full room; desktops get the full sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024
  );

  useEffect(() => {
    let wasTablet = window.innerWidth < 1024;
    const handleResize = () => {
      const isTablet = window.innerWidth < 1024;
      if (isTablet !== wasTablet) {
        wasTablet = isTablet;
        setIsSidebarCollapsed(isTablet);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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
  const [historyGstOnlyFilter, setHistoryGstOnlyFilter] = useState<boolean>(false);
  const [selectedHistoryOrderIds, setSelectedHistoryOrderIds] = useState<string[]>([]);

  // Overview Order History State & Filters
  const [allSystemOrders, setAllSystemOrders] = useState<Order[]>([]);
  const [overviewStatusFilter, setOverviewStatusFilter] = useState<string>('all');
  const [overviewTableFilter, setOverviewTableFilter] = useState<string>('all');
  const [overviewDateFilter, setOverviewDateFilter] = useState<string>('all');
  const [selectedOverviewOrderIds, setSelectedOverviewOrderIds] = useState<string[]>([]);

  // Add Food Item & Custom Category State
  const [showAddFoodModal, setShowAddFoodModal] = useState<boolean>(false);
  const [showAddFoodNameSuggestions, setShowAddFoodNameSuggestions] = useState<boolean>(false);
  const [showManageCategories, setShowManageCategories] = useState<boolean>(false);
  const [foodName, setFoodName] = useState<string>('');
  const [foodPrice, setFoodPrice] = useState<string>('');
  const [foodCategory, setFoodCategory] = useState<string>('Cakes');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [foodMealType, setFoodMealType] = useState<string>('Breakfast');
  const [availableMealCategories, setAvailableMealCategories] = useState<string[]>(['Breakfast', 'Lunch', 'Dinner']);
  const [isCustomMealCategory, setIsCustomMealCategory] = useState<boolean>(false);
  const [customMealCategoryInput, setCustomMealCategoryInput] = useState<string>('');
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
    return saved !== null && saved !== '' ? parseFloat(saved) : 0;
  });
  const [showGstModal, setShowGstModal] = useState<boolean>(false);
  const [tempGstInput, setTempGstInput] = useState<string>(String(gstRate));

  useEffect(() => {
    import('../services/api').then(({ systemApi, getSocket }) => {
      systemApi.getGst()
        .then(res => {
          if (res && typeof res.gstRate === 'number' && !isNaN(res.gstRate)) {
            setGstRate(res.gstRate);
            localStorage.setItem('admin_gst_rate', String(res.gstRate));
          }
        })
        .catch(() => {});

      const socket = getSocket();
      const onGstUpdated = (data: { gstRate: number }) => {
        if (data && typeof data.gstRate === 'number' && !isNaN(data.gstRate)) {
          setGstRate(data.gstRate);
          localStorage.setItem('admin_gst_rate', String(data.gstRate));
        }
      };
      socket.on('gst_rate_updated', onGstUpdated);
    });
  }, []);

  const handleSaveGstRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempGstInput);
    if (isNaN(parsed) || parsed < 0 || parsed > 50) {
      alert('Please enter a valid GST percentage between 0% and 50%');
      return;
    }
    setGstRate(parsed);
    localStorage.setItem('admin_gst_rate', String(parsed));

    // Immediately recalculate any pending/unsettled bills in state
    setReceptionOrders(prev =>
      prev.map(o => {
        const itemsSubtotal = (o.items && o.items.length > 0)
          ? o.items.reduce((sum: number, item: any) => {
              const price = Number(item.price ?? item.product?.price ?? 0);
              const qty = Number(item.quantity ?? 1);
              return sum + price * qty;
            }, 0)
          : Number(o.totalAmount || 0);
        const newTotal = Math.round((itemsSubtotal + itemsSubtotal * (parsed / 100)) * 100) / 100;
        return { ...o, gstRate: parsed, totalAmount: newTotal };
      })
    );

    try {
      const { systemApi } = await import('../services/api');
      await systemApi.updateGst(parsed);
      fetchReceptionOrders();
    } catch (err) {
      console.error('Failed to sync GST with backend', err);
    }

    setShowGstModal(false);
    addToast(`✅ GST Tax Rate updated to ${parsed}% (${parsed/2}% CGST + ${parsed/2}% SGST)! Applied to all active & new bills.`, 'success');
  };

  // 🔑 Staff Login Credentials State (Admin, Chef & Servant Individual Options)
  const [adminUsernameInput, setAdminUsernameInput] = useState<string>('admin');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('admin123');
  const [adminSavedUsername, setAdminSavedUsername] = useState<string>('admin');
  const [adminSavedPassword, setAdminSavedPassword] = useState<string>('admin123');
  const [adminUpdatedAt, setAdminUpdatedAt] = useState<string | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [savingAdminCreds, setSavingAdminCreds] = useState<boolean>(false);

  const [chefUsernameInput, setChefUsernameInput] = useState<string>('chef');
  const [chefPasswordInput, setChefPasswordInput] = useState<string>('chef123');
  const [chefSavedUsername, setChefSavedUsername] = useState<string>('chef');
  const [chefSavedPassword, setChefSavedPassword] = useState<string>('chef123');
  const [chefUpdatedAt, setChefUpdatedAt] = useState<string | null>(null);
  const [showChefPassword, setShowChefPassword] = useState<boolean>(false);
  const [savingChefCreds, setSavingChefCreds] = useState<boolean>(false);

  const [servantUsernameInput, setServantUsernameInput] = useState<string>('waiter');
  const [servantPasswordInput, setServantPasswordInput] = useState<string>('waiter123');
  const [servantSavedUsername, setServantSavedUsername] = useState<string>('waiter');
  const [servantSavedPassword, setServantSavedPassword] = useState<string>('waiter123');
  const [servantUpdatedAt, setServantUpdatedAt] = useState<string | null>(null);
  const [showServantPassword, setShowServantPassword] = useState<boolean>(false);
  const [savingServantCreds, setSavingServantCreds] = useState<boolean>(false);
  const [loadingStaffCreds, setLoadingStaffCreds] = useState<boolean>(false);

  const fetchStaffCredentials = async () => {
    try {
      setLoadingStaffCreds(true);
      const data = await authApi.getStaffCredentials();
      if (data?.admin) {
        setAdminUsernameInput(data.admin.username || 'admin');
        setAdminPasswordInput(data.admin.password || 'admin123');
        setAdminSavedUsername(data.admin.username || 'admin');
        setAdminSavedPassword(data.admin.password || 'admin123');
        setAdminUpdatedAt(data.admin.updatedAt || null);
      }
      if (data?.chef) {
        setChefUsernameInput(data.chef.username || 'chef');
        setChefPasswordInput(data.chef.password || 'chef123');
        setChefSavedUsername(data.chef.username || 'chef');
        setChefSavedPassword(data.chef.password || 'chef123');
        setChefUpdatedAt(data.chef.updatedAt || null);
      }
      if (data?.servant) {
        setServantUsernameInput(data.servant.username || 'waiter');
        setServantPasswordInput(data.servant.password || 'waiter123');
        setServantSavedUsername(data.servant.username || 'waiter');
        setServantSavedPassword(data.servant.password || 'waiter123');
        setServantUpdatedAt(data.servant.updatedAt || null);
      }
    } catch (err) {
      console.error('Failed to load staff credentials:', err);
    } finally {
      setLoadingStaffCreds(false);
    }
  };

  useEffect(() => {
    fetchStaffCredentials();
  }, []);

  const handleUpdateStaffCredentials = async (target: 'admin' | 'chef' | 'servant', e: React.FormEvent) => {
    e.preventDefault();
    const uName = (target === 'admin' ? adminUsernameInput : target === 'chef' ? chefUsernameInput : servantUsernameInput).trim();
    const pWord = (target === 'admin' ? adminPasswordInput : target === 'chef' ? chefPasswordInput : servantPasswordInput).trim();

    if (!uName || !pWord) {
      addToast('⚠️ Username and password cannot be empty!', 'danger');
      return;
    }

    if (target === 'admin') setSavingAdminCreds(true);
    else if (target === 'chef') setSavingChefCreds(true);
    else setSavingServantCreds(true);

    try {
      const res = await authApi.updateStaffCredentials(target, uName, pWord);
      if (target === 'admin' && res?.admin) {
        setAdminUsernameInput(res.admin.username);
        setAdminPasswordInput(res.admin.password);
        setAdminSavedUsername(res.admin.username);
        setAdminSavedPassword(res.admin.password);
        setAdminUpdatedAt(res.admin.updatedAt || new Date().toISOString());
        try {
          const currentUser = authApi.getCurrentUser();
          if (currentUser && currentUser.role === 'admin') {
            const updatedUser = { ...currentUser, username: res.admin.username };
            sessionStorage.setItem('cakeflow_user', JSON.stringify(updatedUser));
            localStorage.setItem('cakeflow_user', JSON.stringify(updatedUser));
          }
        } catch {}
        addToast(`✅ Admin Login Updated! Username: "${res.admin.username}"`, 'success');
      } else if (target === 'chef' && res?.chef) {
        setChefUsernameInput(res.chef.username);
        setChefPasswordInput(res.chef.password);
        setChefSavedUsername(res.chef.username);
        setChefSavedPassword(res.chef.password);
        setChefUpdatedAt(res.chef.updatedAt || new Date().toISOString());
        addToast(`✅ Chef Login Updated! Username: "${res.chef.username}"`, 'success');
      } else if (target === 'servant' && res?.servant) {
        setServantUsernameInput(res.servant.username);
        setServantPasswordInput(res.servant.password);
        setServantSavedUsername(res.servant.username);
        setServantSavedPassword(res.servant.password);
        setServantUpdatedAt(res.servant.updatedAt || new Date().toISOString());
        addToast(`✅ Servant Login Updated! Username: "${res.servant.username}"`, 'success');
      }
    } catch (err: any) {
      addToast(`⚠️ ${err.message || 'Failed to update credentials'}`, 'danger');
    } finally {
      if (target === 'admin') setSavingAdminCreds(false);
      else if (target === 'chef') setSavingChefCreds(false);
      else setSavingServantCreds(false);
    }
  };

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // 🍔 All Food Items Management State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState<string>('');
  const [showFoodSuggestions, setShowFoodSuggestions] = useState<boolean>(false);
  const [foodCategoryFilter, setFoodCategoryFilter] = useState<string>('all');
  const [foodStockFilter, setFoodStockFilter] = useState<'all' | 'active' | 'hidden' | 'outofstock' | 'instock'>('all');
  
  // Quick Edit Food Item State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editMealType, setEditMealType] = useState<string>('Lunch');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editImage, setEditImage] = useState<string>('');
  const [editImageInputMode, setEditImageInputMode] = useState<'upload' | 'url'>('upload');
  const [editUploadingImage, setEditUploadingImage] = useState<boolean>(false);
  const [savingEditProduct, setSavingEditProduct] = useState<boolean>(false);
  const editFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // In-flight dedupe + debounce so socket bursts never flood the API or flash a loader
  const productsFetchInFlight = React.useRef<boolean>(false);
  const productsFetchQueued = React.useRef<boolean>(false);
  const productsRefreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleProductsRefresh = () => {
    if (productsRefreshTimer.current) clearTimeout(productsRefreshTimer.current);
    productsRefreshTimer.current = setTimeout(() => {
      productsRefreshTimer.current = null;
      fetchAdminProducts();
    }, 350);
  };

  const fetchAdminProducts = async () => {
    if (productsFetchInFlight.current) {
      productsFetchQueued.current = true;
      return;
    }
    productsFetchInFlight.current = true;
    try {
      setLoadingProducts(true);
      const [data, metas, mealsData] = await Promise.all([
        productApi.getAll(),
        categoryApi.getMetas().catch(() => []),
        categoryApi.getMeals().catch(() => [])
      ]);
      if (Array.isArray(mealsData) && mealsData.length > 0) {
        const mealNames = mealsData.map((m: any) => m.name).filter(Boolean);
        if (mealNames.length > 0) {
          setAvailableMealCategories(mealNames);
          setFoodMealType(prev => (prev && mealNames.includes(prev) ? prev : mealNames[0]));
        }
      }
      if (data && Array.isArray(data)) {
        const cleanProducts = data.filter((p: any) => p.category !== 'Uncategorized');
        setAllProducts(cleanProducts);
        const metaNames = Array.isArray(metas) ? metas.map((m: any) => m.name).filter((c: string) => c && c !== 'Uncategorized') : [];
        const prodCats = cleanProducts.map((p: any) => p.category).filter((c: string) => c && c !== 'Uncategorized');
        const uniqueCats = Array.from(new Set([...metaNames, ...prodCats]));
        setAvailableCategories(uniqueCats);
        setFoodCategoryFilter(prev => (prev !== 'all' && !uniqueCats.includes(prev) ? 'all' : prev));
        if (uniqueCats.length > 0) {
          setFoodCategory(prev => (prev && uniqueCats.includes(prev) ? prev : uniqueCats[0]));
        } else {
          setFoodCategory('');
        }
      }
    } catch (err: any) {
      console.error('Failed to load admin products:', err);
    } finally {
      setLoadingProducts(false);
      productsFetchInFlight.current = false;
      if (productsFetchQueued.current) {
        productsFetchQueued.current = false;
        scheduleProductsRefresh();
      }
    }
  };

  // Load existing products to populate categories list & all products
  useEffect(() => {
    fetchAdminProducts();
    const handleMealsSync = () => {
      categoryApi.getMeals().then(mealsData => {
        if (Array.isArray(mealsData) && mealsData.length > 0) {
          const mealNames = mealsData.map((m: any) => m.name).filter(Boolean);
          if (mealNames.length > 0) {
            setAvailableMealCategories(mealNames);
          }
        }
      }).catch(() => {});
    };
    window.addEventListener('mealCategoriesUpdated', handleMealsSync);
    return () => window.removeEventListener('mealCategoriesUpdated', handleMealsSync);
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
    setEditMealType((product as any).mealType || availableMealCategories[0] || 'Lunch');
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
        mealType: editMealType || (editingProduct as any).mealType || 'Lunch',
        description: editDescription.trim(),
        image: editImage.trim() || editingProduct.image
      };

      const res = await productApi.update(editingProduct._id, updatedData);
      setAllProducts(prev => prev.map(p => p._id === editingProduct._id ? { ...p, ...updatedData } as any : p));

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
      const finalMealType = isCustomMealCategory && customMealCategoryInput.trim()
        ? customMealCategoryInput.trim()
        : foodMealType;

      if (isCustomMealCategory && customMealCategoryInput.trim()) {
        await categoryApi.addMeal(finalMealType);
        if (!availableMealCategories.includes(finalMealType)) {
          setAvailableMealCategories(prev => [...prev, finalMealType]);
        }
        setFoodMealType(finalMealType);
      }

      const finalCategory = isCustomCategory && customCategoryInput.trim()
        ? customCategoryInput.trim()
        : (foodCategory || 'General');

      const newProductData = {
        name: foodName.trim(),
        price: parseFloat(foodPrice),
        category: finalCategory,
        mealType: finalMealType,
        subCategory: 'General',
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

      addToast(`🎉 NEW FOOD ITEM ADDED: "${foodName}" (₹${foodPrice}) under category "${finalCategory}" (${finalMealType})! Live on Customer Menu.`, 'success');
      setShowAddFoodModal(false);

      // Reset form
      setFoodName('');
      setFoodPrice('');
      setFoodDescription('');
      setFoodImage('');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
      setIsCustomMealCategory(false);
      setCustomMealCategoryInput('');
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
      setPaymentHistory(prev => prev.filter(o => o._id !== orderId));
      setSelectedOverviewOrderIds(prev => prev.filter(id => id !== orderId));
      setSelectedHistoryOrderIds(prev => prev.filter(id => id !== orderId));
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
      setPaymentHistory(prev => prev.filter(o => !selectedOverviewOrderIds.includes(o._id)));
      setSelectedOverviewOrderIds([]);
      fetchAdminData(dateFilter);
      fetchReceptionOrders();
    } catch (err: any) {
      alert('Failed to bulk delete orders: ' + (err.message || err));
    }
  };

  const handleDeleteBulkHistoryOrders = async () => {
    if (selectedHistoryOrderIds.length === 0) return;
    const count = selectedHistoryOrderIds.length;
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete these ${count} selected bill record(s)?`);
    if (!confirmDelete) return;

    try {
      await orderApi.bulkRemove(selectedHistoryOrderIds);
      setPaymentHistory(prev => prev.filter(o => !selectedHistoryOrderIds.includes(o._id)));
      setAllSystemOrders(prev => prev.filter(o => !selectedHistoryOrderIds.includes(o._id)));
      setSelectedHistoryOrderIds([]);
      fetchAdminData(dateFilter);
      fetchReceptionOrders();
    } catch (err: any) {
      alert('Failed to bulk delete bills: ' + (err.message || err));
    }
  };

  const toggleSelectHistoryOrder = (orderId: string) => {
    setSelectedHistoryOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllHistoryOrders = (ordersList: Order[]) => {
    const allFilteredIds = ordersList.map(o => o._id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedHistoryOrderIds.includes(id));
    if (allSelected) {
      setSelectedHistoryOrderIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedHistoryOrderIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
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
  const [allSystemTables, setAllSystemTables] = useState<SmartTable[]>(() => {
    try {
      const cached = localStorage.getItem('cakeflow_tables_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });

  const fetchSystemTables = async () => {
    try {
      const tbls = await tableApi.getAll();
      if (tbls && Array.isArray(tbls)) {
        setAllSystemTables(tbls);
        localStorage.setItem('cakeflow_tables_cache', JSON.stringify(tbls));
      }
    } catch (e) {
      console.error('Failed to load system tables in AdminView:', e);
    }
  };

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
    fetchSystemTables();

    const socket = getSocket();
    socket.emit('join_room', 'admins');

    // Coalesce bursts of socket events (one order update can emit 3-4 events) into ONE quick refresh
    let liveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let liveRefreshAnalytics = false;
    const scheduleLiveRefresh = (withAnalytics: boolean) => {
      if (withAnalytics) liveRefreshAnalytics = true;
      if (liveRefreshTimer) clearTimeout(liveRefreshTimer);
      liveRefreshTimer = setTimeout(() => {
        liveRefreshTimer = null;
        fetchReceptionOrders();
        if (liveRefreshAnalytics) {
          liveRefreshAnalytics = false;
          fetchAdminData(dateFilter, customStartDate, customEndDate, true);
        }
      }, 200);
    };

    const onNewOrder = (newOrder: Order) => {
      addToast(`🔔 New Order #${newOrder._id.slice(-4)} placed for Table ${newOrder.tableNumber}! Total: ₹${newOrder.totalAmount}`, 'info');
      scheduleLiveRefresh(true);
    };

    const onOrderUpdated = (updatedOrder: Order) => {
      if (updatedOrder.status === 'ready') {
        addToast(`🔔 Chef Food Ready! Table ${updatedOrder.tableNumber} is ready for Reception Billing!`, 'success');
      } else if (updatedOrder.status === 'cancelled') {
        addToast(`⚠️ Order #${updatedOrder._id.slice(-4)} for Table ${updatedOrder.tableNumber} was CANCELLED!`, 'danger');
      }
      scheduleLiveRefresh(true);
    };

    const onTableStatusUpdated = (updatedTable?: SmartTable) => {
      if (updatedTable && updatedTable.tableNumber) {
        setAllSystemTables(prev => {
          const idx = prev.findIndex(t => Number(t.tableNumber) === Number(updatedTable.tableNumber));
          let next: SmartTable[];
          if (idx >= 0) {
            next = [...prev];
            next[idx] = updatedTable;
          } else {
            next = [...prev, updatedTable].sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));
          }
          localStorage.setItem('cakeflow_tables_cache', JSON.stringify(next));
          return next;
        });
      } else {
        fetchSystemTables();
      }
      scheduleLiveRefresh(false);
    };

    const onTableDeleted = (data?: { tableNumber: number }) => {
      if (data && data.tableNumber) {
        setAllSystemTables(prev => {
          const next = prev.filter(t => Number(t.tableNumber) !== Number(data.tableNumber));
          localStorage.setItem('cakeflow_tables_cache', JSON.stringify(next));
          return next;
        });
      } else {
        fetchSystemTables();
      }
    };

    const onChefUnsoldReport = (report: any) => {
      const fName = report?.foodName || report?.name;
      if (fName) {
        addToast(
          `📢 Kitchen Unsold Report: ${report.reportedBy || 'Chef'} reported ${report.unsoldQty}x "${fName}" as Unsold!`,
          'danger'
        );
      }
    };

    socket.on('new_order', onNewOrder);
    socket.on('order_updated', onOrderUpdated);
    socket.on('table_status_updated', onTableStatusUpdated);
    socket.on('table_deleted', onTableDeleted);
    socket.on('product:created', scheduleProductsRefresh);
    socket.on('product:updated', scheduleProductsRefresh);
    socket.on('product:deleted', scheduleProductsRefresh);
    socket.on('category:updated', scheduleProductsRefresh);
    socket.on('chef_unsold_report', onChefUnsoldReport);

    // Silent background safety-net refresh (sockets already push live changes instantly).
    // Skipped while the browser tab is hidden so the device & server are not loaded for nothing.
    const autoRefreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchReceptionOrders();
    }, 5000);

    const handleVisibility = () => {
      if (!document.hidden) scheduleLiveRefresh(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(autoRefreshInterval);
      if (liveRefreshTimer) clearTimeout(liveRefreshTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      // Remove ONLY this view's handlers (child panels like Accounts / Inventory keep their own live listeners)
      socket.off('new_order', onNewOrder);
      socket.off('order_updated', onOrderUpdated);
      socket.off('table_status_updated', onTableStatusUpdated);
      socket.off('table_deleted', onTableDeleted);
      socket.off('product:created', scheduleProductsRefresh);
      socket.off('product:updated', scheduleProductsRefresh);
      socket.off('product:deleted', scheduleProductsRefresh);
      socket.off('category:updated', scheduleProductsRefresh);
      socket.off('chef_unsold_report', onChefUnsoldReport);
    };
  }, [dateFilter]);

  const defaultDashboardData = {
    grossRevenue: 0,
    totalOrders: 0,
    avgPrepTimeMins: 0,
    liveActiveTables: 0,
    salesBreakdown: [
      { name: 'Today', sales: 0, count: 0 }
    ],
    categoryBreakdown: [] as Array<{ category: string; sales: number; percent: number }>,
    peakHours: [
      { hour: '8 AM', orders: 0 },
      { hour: '10 AM', orders: 0 },
      { hour: '12 PM', orders: 0 },
      { hour: '2 PM', orders: 0 },
      { hour: '4 PM', orders: 0 },
      { hour: '6 PM', orders: 0 },
      { hour: '8 PM', orders: 0 },
      { hour: '10 PM', orders: 0 }
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
    endDate = customEndDate,
    silent = false
  ) => {
    if (!silent) setLoading(true);
    try {
      const data = await analyticsApi.getDashboard(filter, startDate, endDate);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch store analytics, using default dashboard data:', err);
      if (!silent) setAnalytics(defaultDashboardData);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Last orders payload reference: if the server data has not changed, skip all state updates (no re-render lag)
  const lastReceptionOrdersRef = React.useRef<any>(null);

  const fetchReceptionOrders = async () => {
    try {
      const allOrders = await orderApi.getAll({ timeframe: 'all' });
      if (allOrders === lastReceptionOrdersRef.current) return;
      lastReceptionOrdersRef.current = allOrders;
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

      // Keep any open Receipt/Bill modal synced if items were removed or order cancelled
      setSelectedReceiptOrder((prev) => {
        if (!prev) return null;
        const latest = (allOrders || []).find((o: Order) => o._id === prev._id);
        if (!latest || latest.status === 'cancelled' || (latest.items && latest.items.length === 0)) {
          return null;
        }
        return latest;
      });

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
    const currentGlobalGst = !isNaN(Number(gstRate)) ? Number(gstRate) : parseFloat(localStorage.getItem('admin_gst_rate') || '0');
    const itemsSubtotal = ( targetOrder.items && targetOrder.items.length > 0)
      ? targetOrder.items.reduce((sum: number, item: any) => {
          const price = Number(item.price ?? item.product?.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + price * qty;
        }, 0)
      : Number(targetOrder.totalAmount || 0);
    // Settling an unpaid bill locks it to the currently active GST rate (e.g. 0% when GST is 0%)
    const activeGstRate = currentGlobalGst;
    const grandTotalWithGst = itemsSubtotal + (itemsSubtotal * (activeGstRate / 100));

    const settledOrder = {
      ...targetOrder,
      gstRate: activeGstRate,
      totalAmount: Math.round(grandTotalWithGst * 100) / 100,
      status: 'served' as const,
      paymentStatus: 'paid' as const,
      paymentMethod: selectedMethodLabel as any
    };

    // ⚡ Direct 80mm Thermal POS Auto-Print (uses settledOrder so Cash / UPI / Card prints accurately)
    handleDirectPrintReceipt(settledOrder);

    // 1. INSTANT 0ms UI UPDATE: Close modal, reset payment method to Cash & remove card immediately
    setSelectedReceiptOrder(null);
    setPaymentMethod('cash');
    playCashRegisterChime();
    addToast(
      `💰 ${selectedMethodLabel.toUpperCase()} PAYMENT CONFIRMED! ₹${grandTotalWithGst.toFixed(2)} received for Table ${targetOrder.tableNumber}. Saved in History & Table released!`,
      'success'
    );

    // Optimistically update local reception orders & payment history lists (locking GST rate & Grand Total onto this bill)
    setReceptionOrders(prev => prev.filter(o => o._id !== targetOrder._id));
    setPaymentHistory(prev => [settledOrder, ...prev]);

    // 2. Perform background API settlement
    try {
      await orderApi.closeTable(targetOrder._id, selectedMethodLabel, activeGstRate);
      fetchAdminData(dateFilter, customStartDate, customEndDate, true);
      fetchReceptionOrders();
    } catch (err: any) {
      console.error('Background settlement sync error:', err);
      setReceptionOrders(prev => [targetOrder, ...prev.filter(o => o._id !== targetOrder._id)]);
      setPaymentHistory(prev => prev.filter(o => o._id !== targetOrder._id));
      addToast(`⚠️ Failed to settle bill for Table ${targetOrder.tableNumber}. Please try again.`, 'danger');
    }
  };

  const dynamicTableNumbers = Array.from(
    new Set([
      ...allSystemTables.map((t: any) => String(t.tableNumber)),
      ...receptionOrders.map((o: any) => String(o.tableNumber)),
      ...paymentHistory.map((o: any) => String(o.tableNumber))
    ])
  )
    .filter(n => n && !isNaN(Number(n)) && Number(n) > 0)
    .sort((a, b) => Number(a) - Number(b));

  const filteredPendingOrders = receptionOrders.filter((o: any) => {
    if (pendingTableFilter === 'all') return true;
    return String(o.tableNumber) === String(pendingTableFilter);
  });

  const getOrderEffectiveGstRate = (order: any): number => {
    const itemsSubtotal = (order?.items && order.items.length > 0)
      ? order.items.reduce((sum: number, item: any) => {
          const itemPrice = Number(item.price ?? item.product?.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + (itemPrice * qty);
        }, 0)
      : Number(order?.totalAmount || 0);
    const savedTotal = Number(order?.totalAmount || 0);
    if (order?.gstRate !== null && order?.gstRate !== undefined && !isNaN(Number(order.gstRate))) {
      return Number(order.gstRate);
    }
    if (itemsSubtotal > 0 && savedTotal > itemsSubtotal + 0.01) {
      return Math.round(((savedTotal - itemsSubtotal) / itemsSubtotal) * 100 * 100) / 100;
    }
    return 0;
  };

  const baseDateAndTableFilteredHistory = paymentHistory.filter((o: any) => {
    const matchTable = historyTableFilter === 'all' || String(o.tableNumber) === String(historyTableFilter);
    if (!matchTable) return false;
    return checkDateMatch(o.createdAt, historyDateFilter, customStartDate, customEndDate);
  });

  const gstPaymentHistoryCount = baseDateAndTableFilteredHistory.filter((o: any) => getOrderEffectiveGstRate(o) > 0).length;

  const filteredPaymentHistory = historyGstOnlyFilter
    ? baseDateAndTableFilteredHistory.filter((o: any) => getOrderEffectiveGstRate(o) > 0)
    : baseDateAndTableFilteredHistory;

  const handleDirectPrintReceipt = async (orderToPrint?: Order) => {
    const order = orderToPrint || selectedReceiptOrder;
    if (!order) return;

    let qrCodeUrl = '';
    try {
      const invoiceUrl = `${window.location.origin}/receipt/${order._id}`;
      qrCodeUrl = await QRCode.toDataURL(invoiceUrl, { width: 150, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } });
    } catch (e) {}

    const currentGlobalGst = !isNaN(Number(gstRate)) ? Number(gstRate) : parseFloat(localStorage.getItem('admin_gst_rate') || '0');
    const itemsSubtotal = (order.items && order.items.length > 0)
      ? order.items.reduce((sum: number, item: any) => {
          const price = Number(item.price ?? item.product?.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + price * qty;
        }, 0)
      : Number(order.totalAmount || 0);
    const isOrderSettled = order.paymentStatus === 'paid' || order.status === 'served';
    const activeGstRate = isOrderSettled
      ? (order.gstRate !== null && order.gstRate !== undefined && !isNaN(Number(order.gstRate))
          ? Number(order.gstRate)
          : (itemsSubtotal > 0 && Number(order.totalAmount) > itemsSubtotal + 0.01
              ? Math.round(((Number(order.totalAmount) - itemsSubtotal) / itemsSubtotal) * 1000) / 10
              : 0))
      : currentGlobalGst;
    const halfGstRate = activeGstRate / 2;
    const subtotal = itemsSubtotal;
    const totalGstAmount = subtotal * (activeGstRate / 100);
    const cgst = totalGstAmount / 2;
    const sgst = totalGstAmount / 2;
    const grandTotal = subtotal + totalGstAmount;

    const smileySvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: -4px; display: inline-block; flex-shrink: 0;"><circle cx="12" cy="12" r="10.5" stroke="#000" stroke-width="1.8" fill="none"/><circle cx="8.5" cy="8.8" r="1.5" fill="#000" stroke="none"/><circle cx="15.5" cy="8.8" r="1.5" fill="#000" stroke="none"/><path d="M7.5 13.8 C8.8 17.5, 15.2 17.5, 16.5 13.8" stroke="#000" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;

    const groupedPrintItems = (() => {
      const map = new Map<string, { name: string; price: number; quantity: number; instructions: string[] }>();
      for (const item of (order.items || [])) {
        if ((item as any).status === 'cancelled') continue;
        const pName = (item.product?.name || item.name || 'Food Item').trim();
        const price = Number(item.price ?? item.product?.price ?? 0);
        const qty = Number(item.quantity ?? 1);
        const key = `${pName.toLowerCase()}::${price}`;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += qty;
          if (item.instructions && !existing.instructions.includes(item.instructions)) {
            existing.instructions.push(item.instructions);
          }
        } else {
          map.set(key, {
            name: pName,
            price,
            quantity: qty,
            instructions: item.instructions ? [item.instructions] : []
          });
        }
      }
      return Array.from(map.values());
    })();

    const itemsHtml = groupedPrintItems.map((item, idx) => {
      const noteText = item.instructions.join(', ');
      return `
        <div style="margin-bottom: 4px;">
          <div class="item-row">
            <span>${idx + 1}.</span>
            <span style="padding-right: 4px; word-break: break-word;">${item.name}</span>
            <span style="text-align: center;">${item.quantity}</span>
            <span style="text-align: right;">₹${item.price * item.quantity}</span>
          </div>
          ${noteText ? `<div style="font-size: 9px; color: #000; margin-top: 1px; padding-left: 28px;">Note: "${noteText}"</div>` : ''}
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
              font-family: 'Courier New', Courier, monospace;
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
              color: #000;
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
              font-size: 10.5px;
              font-weight: 700;
              color: #000;
              line-height: 1.45;
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
              display: grid;
              grid-template-columns: 28px 1fr 36px 56px;
              align-items: center;
              font-size: 9.5px;
              font-weight: 900;
              color: #000;
              text-transform: uppercase;
              border-bottom: 1px solid #000;
              padding-bottom: 3px;
              margin-bottom: 5px;
            }
            .item-row {
              display: grid;
              grid-template-columns: 28px 1fr 36px 56px;
              align-items: start;
              font-size: 10px;
              font-weight: 500;
              color: #000;
              -webkit-text-stroke: 0.3px #000;
              line-height: 1.35;
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
              <h2>VPN Restaurant</h2>
              <div class="subtitle">Thiruvarur - Nagapattinam Rd, Melakottaivasal</div>
              <div class="subtitle">Nagapattinam, Tamil Nadu 611001</div>
            <div class="title-tag">*** TAX INVOICE ***</div>
          </div>

          <div class="status-banner">
            <span>PAID / SETTLED</span>
            <span>Via ${order.paymentMethod || 'Cash'}</span>
          </div>

          <div class="meta-grid">
            <div>
              <div>Table: Table ${order.tableNumber}</div>
              <div>Guest: ${order.customerName || 'Walk-in Guest'}</div>
            </div>
            <div style="text-align: right;">
              <div>Bill #: #${order._id.slice(-6)}</div>
              <div>Time: ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div class="items-table">
            <div class="table-head">
              <span>S.NO</span>
              <span>ITEM DESC</span>
              <span style="text-align: center;">QTY</span>
              <span style="text-align: right;">AMOUNT</span>
            </div>
            ${itemsHtml}
          </div>

          <div class="summary">
            <div class="summary-row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
            <div class="summary-row"><span>CGST (${halfGstRate.toFixed(1)}%):</span><span>₹${cgst.toFixed(2)}</span></div>
            <div class="summary-row"><span>SGST (${halfGstRate.toFixed(1)}%):</span><span>₹${sgst.toFixed(2)}</span></div>
            <div class="grand-total">
              <span>TOTAL PAID:</span>
              <span>₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="qr-section">
            <div class="qr-text">
              <b>Digital Receipt QR</b><br>
              Scan to view order invoice
            </div>
            ${qrCodeUrl ? `<img src="${qrCodeUrl}" style="width: 48px; height: 48px; border: 1px solid #000;" />` : ''}
          </div>

          <div class="footer">
            <div>Thank you! Visit again!</div>
            <div style="font-size: 9.5px; font-weight: 700; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              ${smileySvg}
              <span>Software Developed By Murugan Solution</span>
              ${smileySvg}
            </div>
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

  // Export Overview Store Order History to CSV / Excel
  const handleExportOverviewOrdersCSV = () => {
    const ordersToExport = selectedOverviewOrderIds.length > 0
      ? filteredOverviewOrders.filter(o => selectedOverviewOrderIds.includes(o._id))
      : filteredOverviewOrders;

    if (ordersToExport.length === 0) {
      alert('No orders found to export for the selected filters.');
      return;
    }

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];
    lines.push(`"VPN RESTAURANT - STORE ORDER HISTORY REPORT"`);
    lines.push(`"Generated On",${escapeCsv(new Date().toLocaleString())}`);
    lines.push(`"Date Filter",${escapeCsv(overviewDateFilter.toUpperCase())}`);
    lines.push(`"Status Filter",${escapeCsv(overviewStatusFilter.toUpperCase())}`);
    lines.push(`"Table Filter",${escapeCsv(overviewTableFilter === 'all' ? 'All Tables' : `Table ${overviewTableFilter}`)}`);
    lines.push(`"Total Orders Exported",${escapeCsv(ordersToExport.length)}`);

    const totalRevenue = ordersToExport.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    lines.push(`"Total Revenue (INR)",${escapeCsv(`₹${totalRevenue.toFixed(2)}`)}`);
    lines.push('');

    // Table Header
    const headers = [
      'Order #',
      'Order ID (Full)',
      'Table #',
      'Customer Name',
      'Date',
      'Time',
      'Ordered Food Items',
      'Total Items Qty',
      'Subtotal (INR)',
      'GST Rate (%)',
      'GST Tax Amount (INR)',
      'Total Bill Amount (INR)',
      'Order Status',
      'Payment Status',
      'Payment Method',
      'Special Instructions',
      'Kitchen Notes / Reason'
    ];
    lines.push(headers.map(escapeCsv).join(','));

    // Data rows
    ordersToExport.forEach((order: Order) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = !isNaN(orderDate.getTime()) ? orderDate.toLocaleDateString() : '';
      const timeStr = !isNaN(orderDate.getTime()) ? orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      const itemsSubtotal = (order.items && order.items.length > 0)
        ? order.items.reduce((sum: number, item: any) => {
            const price = Number(item.price ?? item.product?.price ?? 0);
            const qty = Number(item.quantity ?? 1);
            return sum + (price * qty);
          }, 0)
        : Number(order.totalAmount || 0);

      const itemsSummary = (order.items && order.items.length > 0)
        ? order.items.map((i: any) => {
            const name = i.product?.name || i.name || 'Item';
            const price = Number(i.price ?? i.product?.price ?? 0);
            const noteStr = i.instructions ? ` [Note: ${i.instructions}]` : '';
            return `${i.quantity}x ${name} (₹${(price * i.quantity).toFixed(2)})${noteStr}`;
          }).join('; ')
        : 'No items recorded';

      const allInstructions = (order.items && order.items.length > 0)
        ? order.items.filter((i: any) => i.instructions).map((i: any) => `${i.product?.name || i.name}: ${i.instructions}`).join('; ') || '-'
        : '-';

      const totalItemsQty = (order.items && order.items.length > 0)
        ? order.items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0)
        : 0;

      const effectiveGstRate = getOrderEffectiveGstRate(order);
      const gstTaxAmount = Math.max(0, Number(order.totalAmount || 0) - itemsSubtotal);

      const paymentMethod = order.paymentMethod || (order.paymentStatus === 'paid' ? 'Cash' : '-');
      const orderStatusStr = order.status ? order.status.toUpperCase() : 'PENDING';
      const paymentStatusStr = (order.paymentStatus === 'paid' || (order as any).status === 'served') ? 'PAID' : 'UNPAID';
      const notes = order.chefNotes || order.rejectionReason || '-';

      const row = [
        `#${order._id.slice(-6).toUpperCase()}`,
        order._id,
        `Table ${order.tableNumber}`,
        order.customerName || 'Guest',
        dateStr,
        timeStr,
        itemsSummary,
        totalItemsQty,
        itemsSubtotal.toFixed(2),
        `${effectiveGstRate}%`,
        gstTaxAmount.toFixed(2),
        Number(order.totalAmount || 0).toFixed(2),
        orderStatusStr,
        paymentStatusStr,
        paymentMethod,
        allInstructions,
        notes
      ];

      lines.push(row.map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `VPN_Store_Order_History_${overviewDateFilter}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(`📥 Successfully exported ${ordersToExport.length} order(s) to CSV Excel!`, 'success');
  };

  const displayData = analytics || defaultDashboardData;

  return (
    <div id="dashboardPage" data-testid="dashboardPage" className="h-screen bg-[#F3F4F6] text-[#111827] flex flex-col relative overflow-hidden">
      {/* Real-time Toast Notifications Banner */}
      <div id="toastContainer" data-testid="toastContainer" className="fixed top-4 right-4 left-4 sm:left-auto sm:right-5 z-50 flex flex-col gap-2 max-w-sm sm:w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            id={`toast-${t.id}`}
            data-testid={`toast-${t.id}`}
            key={t.id} 
            className={`p-4 rounded-2xl border shadow-xl flex items-start gap-2.5 animate-slide-in pointer-events-auto ${
              t.type === 'danger' 
                ? 'bg-violet-50 border-violet-300 text-violet-800' 
                : t.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-[#FFFFFF] border-[#D1D5DB] text-[#111827]'
            }`}
          >
            {t.type === 'danger' ? <AlertTriangle size={16} className="shrink-0 mt-0.5 text-[#4C1D95]" /> : <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-600" />}
            <span className="text-xs font-bold leading-relaxed">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header id="header" data-testid="header" className="bg-white/95 backdrop-blur-md border-b border-[#D1D5DB] px-4 md:px-6 py-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between z-10 shrink-0 gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div id="dashboardLogo" data-testid="dashboardLogo" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md shadow-[#4C1D95]/20 shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
              <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
            </div>
            <div>
              <h1 id="dashboardTitle" data-testid="dashboardTitle" className="font-extrabold text-base md:text-lg tracking-tight text-[#4C1D95]">
                VPN Restaurant Dashboard
              </h1>
              <p className="text-[10px] md:text-xs text-[#4B5563] font-semibold">
                Live Store Operations & Billing
              </p>
            </div>
          </div>

          <button 
            id="logoutBtnMobile"
            data-testid="logoutBtnMobile"
            onClick={onLogout}
            className="md:hidden text-xs text-[#4B5563] hover:text-[#4C1D95] bg-white border border-[#D1D5DB] p-2 rounded-xl font-bold transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={14} />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button 
            id="logoutBtn"
            data-testid="logoutBtn"
            onClick={onLogout}
            className="text-xs text-[#4B5563] hover:text-[#4C1D95] bg-white border border-[#D1D5DB] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Grid content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Nav Bar (Desktop - Adjustable Collapsible/Expandable Rail) */}
        <aside
          className={`hidden md:flex flex-col ${
            isSidebarCollapsed ? 'w-[74px] items-center px-2.5 py-4' : 'w-60 lg:w-64 p-3.5'
          } bg-white border-r border-[#D1D5DB] shadow-sm z-20 shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-300 gap-3`}
        >
          {/* Sidebar Toggle / Adjust Header */}
          <div className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-1'} pb-2 border-b border-gray-100`}>
            {!isSidebarCollapsed && (
              <span className="text-[11px] font-black uppercase tracking-wider text-[#4B5563]">
                Navigation
              </span>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? 'Expand Sidebar Menu' : 'Collapse Sidebar Menu'}
              className="w-9 h-9 rounded-xl bg-violet-50 hover:bg-[#4C1D95] text-[#4C1D95] hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-xs"
            >
              <ChevronRight size={16} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Tab Controls (Sidebar Navigation) */}
          <div id="sidebar-desktop" data-testid="sidebar-desktop" className={`sidebar flex flex-col gap-2 w-full ${isSidebarCollapsed ? 'items-center' : ''}`}>
            <button
              id="overviewMenu"
              data-testid="overviewMenu"
              title="Overview"
              onClick={() => {
                setActiveTab('overview');
                fetchSystemTables();
              }}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <BarChart3 size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Overview</span>}
            </button>

            <button
              id="billingMenu"
              data-testid="billingMenu"
              title="Reception & Billing"
              onClick={() => {
                setActiveTab('reception');
                fetchReceptionOrders();
                fetchSystemTables();
              }}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-between'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer relative whitespace-nowrap ${
                activeTab === 'reception'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Receipt size={17} className="shrink-0" />
                {!isSidebarCollapsed && <span>Reception & Billing</span>}
              </div>
              {receptionOrders.length > 0 && (
                <span
                  id="receptionBadge"
                  data-testid="receptionBadge"
                  className={`${
                    isSidebarCollapsed ? 'absolute -top-1 -right-1 px-1.5 py-0.2' : 'px-1.5 py-0.5 ml-1'
                  } bg-[#4C1D95] text-white text-[9px] font-black rounded-full animate-pulse border border-white`}
                >
                  {receptionOrders.length}
                </span>
              )}
            </button>

            <button
              id="tablesMenu"
              data-testid="tablesMenu"
              title="Tables & QR"
              onClick={() => setActiveTab('tables')}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'tables'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <QrCode size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Tables & QR</span>}
            </button>

            <button
              id="foodsTabMenu"
              data-testid="foodsTabMenu"
              title="Food Items & Menu"
              onClick={() => {
                setActiveTab('foods');
                fetchAdminProducts();
              }}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-between'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer relative whitespace-nowrap ${
                activeTab === 'foods'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Utensils size={17} className="shrink-0" />
                {!isSidebarCollapsed && <span>Food Items & Menu</span>}
              </div>
              {allProducts.length > 0 && (
                <span
                  className={`${
                    isSidebarCollapsed ? 'absolute -top-1 -right-1 px-1.5 py-0.2' : 'px-1.5 py-0.5 ml-1'
                  } bg-emerald-500 text-white text-[9px] font-black rounded-full shadow-xs`}
                >
                  {allProducts.length}
                </span>
              )}
            </button>

            <button
              id="soldUnsoldTabMenu"
              data-testid="soldUnsoldTabMenu"
              title="Sold & Unsold"
              onClick={() => {
                setActiveTab('sold_unsold');
                fetchAdminProducts();
              }}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'sold_unsold'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <PackageCheck size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Sold & Unsold</span>}
            </button>

            <button
              id="inventoryTabMenu"
              data-testid="inventoryTabMenu"
              title="Inventory & Profit"
              onClick={() => {
                setActiveTab('inventory');
                fetchAdminProducts();
              }}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <Package size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Inventory & Profit</span>}
            </button>

            <button
              id="accountsTabMenu"
              data-testid="accountsTabMenu"
              title="Accounts & Finance"
              onClick={() => setActiveTab('accounts')}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <DollarSign size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Accounts & Finance</span>}
            </button>

            <button
              id="expensesTabMenu"
              data-testid="expensesTabMenu"
              title="Shop Expenses"
              onClick={() => setActiveTab('expenses')}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <Wallet size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Shop Expenses</span>}
            </button>

            <button
              id="staffLoginsTabMenu"
              data-testid="staffLoginsTabMenu"
              title="Staff Logins (Chef & Servant)"
              onClick={() => {
                setActiveTab('staff_logins');
                fetchStaffCredentials();
              }}
              className={`${
                isSidebarCollapsed
                  ? 'w-11 h-11 rounded-full justify-center'
                  : 'w-full text-left px-3.5 py-2.5 rounded-xl justify-start gap-3'
              } text-xs font-extrabold transition-all flex items-center cursor-pointer whitespace-nowrap ${
                activeTab === 'staff_logins'
                  ? 'bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/25'
                  : 'text-[#4B5563] hover:bg-violet-50 hover:text-[#4C1D95]'
              }`}
            >
              <KeyRound size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span>Staff Logins</span>}
            </button>
          </div>
        </aside>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Floating Radial Arc Mobile Menu (+ / ×) */}
          <MobileRadialMenu
            isOpen={isMobileMenuOpen}
            onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            onClose={() => setIsMobileMenuOpen(false)}
            activeTab={activeTab}
            onSelectTab={(tabId) => {
              setActiveTab(tabId as any);
              if (tabId === 'reception') fetchReceptionOrders();
              if (tabId === 'foods' || tabId === 'sold_unsold' || tabId === 'inventory') fetchAdminProducts();
              if (tabId === 'staff_logins') fetchStaffCredentials();
            }}
            receptionOrdersCount={receptionOrders.length}
            allProductsCount={allProducts.length}
          />

          {/* Main Grid content */}
          <main id="mainContent" data-testid="mainContent" className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar min-w-0 w-full p-3 pb-24 md:p-6 lg:p-8 space-y-6">

        {/* VIEW: 🔑 INDIVIDUAL ADMIN, CHEF & SERVANT LOGIN CREDENTIALS MANAGEMENT */}
        {activeTab === 'staff_logins' && (
          <div id="staffLoginsPage" data-testid="staffLoginsPage" className="space-y-6 animate-fade-in">
            {/* Header Banner */}
            <div className="bg-white border border-[#D1D5DB] p-4 sm:p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-3 sm:p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-black text-[#111827] flex items-center flex-wrap gap-2">
                    <span>Admin, Chef & Servant Login Management</span>
                    <span className="text-[11px] bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30 px-2.5 py-0.5 rounded-full font-extrabold">
                      Individual Access Control
                    </span>
                  </h2>
                  <p className="text-xs text-[#4B5563] font-semibold mt-0.5">
                    Individually change and update the login Username & Password for Admin, Kitchen Chef, and Table Servant.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchStaffCredentials}
                className="px-3.5 py-2 bg-white hover:bg-violet-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
              >
                <RefreshCw size={14} className={loadingStaffCreds ? 'animate-spin text-[#4C1D95]' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Individual Cards (2 Cards Per Row): 1) Admin Login  2) Chef Login  3) Servant Login */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* CARD 1: ADMIN LOGIN CREDENTIALS */}
              <div className="bg-white border border-[#D1D5DB] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4 h-full">
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4 min-h-[60px]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-violet-100 text-[#4C1D95] flex items-center justify-center shrink-0">
                      <KeyRound size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-[#111827] leading-tight">Admin Login</h3>
                      <p className="text-[11px] text-[#4B5563] font-semibold truncate mt-0.5">
                        Admin Dashboard (<span className="font-mono text-[#4C1D95]">/admin</span>)
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase shrink-0">
                    Owner
                  </span>
                </div>

                {/* Current Active Admin Credentials Summary Box */}
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3.5 min-h-[84px] flex flex-col justify-between gap-1.5">
                  <div className="text-[10px] font-extrabold text-[#4B5563] uppercase tracking-wider">
                    Current Saved Admin Credentials
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[#4B5563] font-semibold">Username: </span>
                      <span className="font-mono font-black text-[#111827]">{adminSavedUsername}</span>
                    </div>
                    <div>
                      <span className="text-[#4B5563] font-semibold">Password: </span>
                      <span className="font-mono font-black text-[#4C1D95]">
                        {showAdminPassword ? adminSavedPassword : '••••••••'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#4B5563] font-medium">
                    {adminUpdatedAt
                      ? `Last updated: ${new Date(adminUpdatedAt).toLocaleString()}`
                      : 'Status: Active login credentials'}
                  </div>
                </div>

                {/* Admin Update Form */}
                <form onSubmit={(e) => handleUpdateStaffCredentials('admin', e)} className="flex flex-col flex-1 justify-between gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold text-[#4B5563] uppercase tracking-wider mb-1.5">
                        Admin Username *
                      </label>
                      <input
                        id="adminUsernameInput"
                        data-testid="adminUsernameInput"
                        type="text"
                        required
                        value={adminUsernameInput}
                        onChange={(e) => setAdminUsernameInput(e.target.value)}
                        placeholder="Enter Admin Username (e.g. admin)"
                        className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-[#111827] outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#4B5563] uppercase tracking-wider mb-1.5">
                        Admin Password *
                      </label>
                      <div className="relative">
                        <input
                          id="adminPasswordInput"
                          data-testid="adminPasswordInput"
                          type={showAdminPassword ? 'text' : 'password'}
                          required
                          value={adminPasswordInput}
                          onChange={(e) => setAdminPasswordInput(e.target.value)}
                          placeholder="Enter Admin Password"
                          className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] focus:bg-white rounded-xl pl-4 pr-11 py-3 text-sm font-mono font-bold text-[#111827] outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#4B5563] hover:text-[#4C1D95] cursor-pointer"
                          title={showAdminPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    id="saveAdminCredentialsBtn"
                    data-testid="saveAdminCredentialsBtn"
                    type="submit"
                    disabled={savingAdminCreds}
                    className="w-full py-3.5 px-4 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-[#4C1D95]/20 cursor-pointer active:scale-[0.98]"
                  >
                    <CheckCircle size={16} className="shrink-0" />
                    <span>{savingAdminCreds ? 'Updating Admin Login...' : 'Update Admin Username & Password'}</span>
                  </button>
                </form>
              </div>

              {/* CARD 2: CHEF LOGIN CREDENTIALS */}
              <div className="bg-white border border-[#D1D5DB] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4 h-full">
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4 min-h-[60px]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-violet-100 text-[#4C1D95] flex items-center justify-center shrink-0">
                      <ChefHat size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-[#111827] leading-tight">Chef Login</h3>
                      <p className="text-[11px] text-[#4B5563] font-semibold truncate mt-0.5">
                        Kitchen Display System (<span className="font-mono text-[#4C1D95]">/chef</span>)
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase shrink-0">
                    Active
                  </span>
                </div>

                {/* Current Active Chef Credentials Summary Box */}
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3.5 min-h-[84px] flex flex-col justify-between gap-1.5">
                  <div className="text-[10px] font-extrabold text-[#4B5563] uppercase tracking-wider">
                    Current Saved Chef Credentials
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[#4B5563] font-semibold">Username: </span>
                      <span className="font-mono font-black text-[#111827]">{chefSavedUsername}</span>
                    </div>
                    <div>
                      <span className="text-[#4B5563] font-semibold">Password: </span>
                      <span className="font-mono font-black text-[#4C1D95]">
                        {showChefPassword ? chefSavedPassword : '••••••••'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#4B5563] font-medium">
                    {chefUpdatedAt
                      ? `Last updated: ${new Date(chefUpdatedAt).toLocaleString()}`
                      : 'Status: Active login credentials'}
                  </div>
                </div>

                {/* Chef Update Form */}
                <form onSubmit={(e) => handleUpdateStaffCredentials('chef', e)} className="flex flex-col flex-1 justify-between gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold text-[#4B5563] uppercase tracking-wider mb-1.5">
                        Chef Username *
                      </label>
                      <input
                        id="chefUsernameInput"
                        data-testid="chefUsernameInput"
                        type="text"
                        required
                        value={chefUsernameInput}
                        onChange={(e) => setChefUsernameInput(e.target.value)}
                        placeholder="Enter Chef Username (e.g. chef)"
                        className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-[#111827] outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#4B5563] uppercase tracking-wider mb-1.5">
                        Chef Password *
                      </label>
                      <div className="relative">
                        <input
                          id="chefPasswordInput"
                          data-testid="chefPasswordInput"
                          type={showChefPassword ? 'text' : 'password'}
                          required
                          value={chefPasswordInput}
                          onChange={(e) => setChefPasswordInput(e.target.value)}
                          placeholder="Enter Chef Password"
                          className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] focus:bg-white rounded-xl pl-4 pr-11 py-3 text-sm font-mono font-bold text-[#111827] outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowChefPassword(!showChefPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#4B5563] hover:text-[#4C1D95] cursor-pointer"
                          title={showChefPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showChefPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    id="saveChefCredentialsBtn"
                    data-testid="saveChefCredentialsBtn"
                    type="submit"
                    disabled={savingChefCreds}
                    className="w-full py-3.5 px-4 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-[#4C1D95]/20 cursor-pointer active:scale-[0.98]"
                  >
                    <CheckCircle size={16} className="shrink-0" />
                    <span>{savingChefCreds ? 'Updating Chef Login...' : 'Update Chef Username & Password'}</span>
                  </button>
                </form>
              </div>

              {/* CARD 3: SERVANT / WAITER LOGIN CREDENTIALS */}
              <div className="bg-white border border-[#D1D5DB] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4 h-full">
                {/* Card Header */}
                <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4 min-h-[60px]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-violet-100 text-[#4C1D95] flex items-center justify-center shrink-0">
                      <UserCheck size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-[#111827] leading-tight">Servant Login</h3>
                      <p className="text-[11px] text-[#4B5563] font-semibold truncate mt-0.5">
                        Table Order Taking (<span className="font-mono text-[#4C1D95]">/customer</span>)
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase shrink-0">
                    Active
                  </span>
                </div>

                {/* Current Active Servant Credentials Summary Box */}
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-3.5 min-h-[84px] flex flex-col justify-between gap-1.5">
                  <div className="text-[10px] font-extrabold text-[#4B5563] uppercase tracking-wider">
                    Current Saved Servant Credentials
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[#4B5563] font-semibold">Username: </span>
                      <span className="font-mono font-black text-[#111827]">{servantSavedUsername}</span>
                    </div>
                    <div>
                      <span className="text-[#4B5563] font-semibold">Password: </span>
                      <span className="font-mono font-black text-[#4C1D95]">
                        {showServantPassword ? servantSavedPassword : '••••••••'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#4B5563] font-medium">
                    {servantUpdatedAt
                      ? `Last updated: ${new Date(servantUpdatedAt).toLocaleString()}`
                      : 'Status: Active login credentials'}
                  </div>
                </div>

                {/* Servant Update Form */}
                <form onSubmit={(e) => handleUpdateStaffCredentials('servant', e)} className="flex flex-col flex-1 justify-between gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-extrabold text-[#4B5563] uppercase tracking-wider mb-1.5">
                        Servant Username *
                      </label>
                      <input
                        id="servantUsernameInput"
                        data-testid="servantUsernameInput"
                        type="text"
                        required
                        value={servantUsernameInput}
                        onChange={(e) => setServantUsernameInput(e.target.value)}
                        placeholder="Enter Servant Username (e.g. waiter / servant)"
                        className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-[#111827] outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#4B5563] uppercase tracking-wider mb-1.5">
                        Servant Password *
                      </label>
                      <div className="relative">
                        <input
                          id="servantPasswordInput"
                          data-testid="servantPasswordInput"
                          type={showServantPassword ? 'text' : 'password'}
                          required
                          value={servantPasswordInput}
                          onChange={(e) => setServantPasswordInput(e.target.value)}
                          placeholder="Enter Servant Password"
                          className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] focus:bg-white rounded-xl pl-4 pr-11 py-3 text-sm font-mono font-bold text-[#111827] outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowServantPassword(!showServantPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#4B5563] hover:text-[#4C1D95] cursor-pointer"
                          title={showServantPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showServantPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    id="saveServantCredentialsBtn"
                    data-testid="saveServantCredentialsBtn"
                    type="submit"
                    disabled={savingServantCreds}
                    className="w-full py-3.5 px-4 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-[#4C1D95]/20 cursor-pointer active:scale-[0.98]"
                  >
                    <CheckCircle size={16} className="shrink-0" />
                    <span>{savingServantCreds ? 'Updating Servant Login...' : 'Update Servant Username & Password'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: 💰 FULL ACCOUNTS & FINANCE STATEMENT */}
        {activeTab === 'accounts' && (
          <AccountsManagement
            gstRate={gstRate}
            addToast={addToast}
            mode="accounts"
            onSwitchToExpenses={() => setActiveTab('expenses')}
          />
        )}

        {/* VIEW: 🧾 DEDICATED DAILY SHOP EXPENSES TRACKER */}
        {activeTab === 'expenses' && (
          <AccountsManagement
            gstRate={gstRate}
            addToast={addToast}
            mode="expenses"
          />
        )}

        {/* VIEW: 📊 SOLD & UNSOLD FOOD REPORT */}
        {activeTab === 'sold_unsold' && (
          <SoldUnsoldTracker
            products={allProducts}
            orders={allSystemOrders.length > 0 ? allSystemOrders : paymentHistory}
            onRefresh={() => {
              fetchAdminProducts();
              fetchReceptionOrders();
              fetchAdminData(dateFilter);
            }}
          />
        )}

        {/* VIEW: 📦 SMART INVENTORY & PROFIT/LOSS TRACKER */}
        {activeTab === 'inventory' && (
          <InventoryManagement allProducts={allProducts} addToast={addToast} />
        )}
        
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
              <div className="bg-white border border-[#D1D5DB] p-4 sm:p-6 rounded-3xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start sm:items-center gap-3.5 w-full xl:w-auto min-w-0">
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0">
                    <Utensils size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-xl font-black text-[#111827] flex items-center flex-wrap gap-2">
                      <span>Food Items & Menu Catalog</span>
                      <span className="text-[11px] sm:text-xs bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30 px-2.5 py-0.5 rounded-full font-extrabold whitespace-nowrap shrink-0">
                        {allProducts.length} Total Items
                      </span>
                    </h2>
                    <p className="text-xs text-[#4B5563] font-semibold mt-0.5">
                      Hide or delete items, update stock availability & sync with all dining tables in real-time.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    onClick={fetchAdminProducts}
                    className="p-2.5 bg-[#FFFFFF] hover:bg-gray-50 text-[#4B5563] hover:text-[#4C1D95] border border-[#D1D5DB] rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-xs shrink-0"
                    title="Refresh Menu"
                  >
                    <RefreshCw size={15} className={loadingProducts ? 'animate-spin text-[#4C1D95]' : ''} />
                  </button>

                  <button
                    onClick={() => setShowManageCategories(true)}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-white hover:bg-gray-50 text-[#4C1D95] border-2 border-[#4C1D95] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-sm whitespace-nowrap"
                  >
                    <Settings size={15} className="shrink-0" />
                    <span>Manage Categories</span>
                  </button>

                  <button
                    onClick={() => setShowAddFoodModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-[#4C1D95]/20 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={15} className="shrink-0" />
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
                      ? 'bg-white border-[#4C1D95] ring-2 ring-[#4C1D95]/20' 
                      : 'bg-[#FFFFFF] border-[#D1D5DB] hover:bg-white'
                  }`}
                >
                  <p className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">Total Food Items</p>
                  <p className="text-2xl font-black text-[#111827] mt-1">{totalItems}</p>
                  <span className="text-[10px] text-[#4B5563] font-medium">All catalog items</span>
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
                      ? 'bg-violet-50/80 border-violet-500 ring-2 ring-violet-500/20' 
                      : 'bg-violet-50/40 border-violet-200 hover:bg-violet-50'
                  }`}
                >
                  <p className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">Hidden from Tables</p>
                  <p className="text-2xl font-black text-violet-700 mt-1">{hiddenItems}</p>
                  <span className="text-[10px] text-violet-600 font-semibold">Temporarily hidden</span>
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
              <div className="bg-white border border-[#D1D5DB] p-4 rounded-2xl flex flex-col xl:flex-row items-center justify-between gap-3 shadow-sm relative z-30">
                {/* Wide Search Bar with Live Autocomplete Suggestions Dropdown */}
                <div className="relative w-full xl:flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C1D95]" />
                  <input
                    type="text"
                    value={foodSearchQuery}
                    onFocus={() => setShowFoodSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowFoodSuggestions(false), 180)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' || e.key === 'Enter') {
                        setShowFoodSuggestions(false);
                      }
                    }}
                    onChange={(e) => {
                      setFoodSearchQuery(e.target.value);
                      setShowFoodSuggestions(true);
                    }}
                    placeholder="Search by food name, category..."
                    className="w-full h-[38px] bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl pl-9 pr-8 text-xs text-[#111827] outline-none font-semibold transition-all"
                  />
                  {foodSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => {
                        setFoodSearchQuery('');
                        setShowFoodSuggestions(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#111827] text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}

                  {/* Autocomplete Suggestions Dropdown Below Search Input */}
                  {showFoodSuggestions && foodSearchQuery.trim().length > 0 && (() => {
                    const q = foodSearchQuery.trim().toLowerCase();
                    const matchedItems = allProducts.filter(p =>
                      p.name.toLowerCase().includes(q) ||
                      p.category.toLowerCase().includes(q) ||
                      (p.description && p.description.toLowerCase().includes(q))
                    ).slice(0, 8);

                    const renderHighlighted = (text: string) => {
                      const idx = text.toLowerCase().indexOf(q);
                      if (idx === -1) return <span>{text}</span>;
                      return (
                        <span>
                          {text.slice(0, idx)}
                          <span className="text-[#4C1D95] font-black underline decoration-[#4C1D95]/40">
                            {text.slice(idx, idx + q.length)}
                          </span>
                          {text.slice(idx + q.length)}
                        </span>
                      );
                    };

                    return (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border border-[#D1D5DB] rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-[#F3F4F6]">
                        {matchedItems.length === 0 ? (
                          <div className="px-4 py-3 text-xs font-semibold text-[#6B7280] flex items-center gap-2">
                            <Search size={13} className="text-[#9CA3AF]" />
                            <span>No food items found matching "{foodSearchQuery}"</span>
                          </div>
                        ) : (
                          matchedItems.map((item) => (
                            <div
                              key={item._id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFoodSearchQuery(item.name);
                                setShowFoodSuggestions(false);
                              }}
                              className="px-3.5 py-2.5 hover:bg-violet-50/80 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={item.image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500'}
                                  alt={item.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-[#E5E7EB] shrink-0 bg-gray-50"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500';
                                  }}
                                />
                                <div className="min-w-0 flex items-center gap-1.5 flex-wrap text-xs">
                                  <span className="font-bold text-[#111827] truncate">
                                    {renderHighlighted(item.name)}
                                  </span>
                                  <span className="text-[#9CA3AF]">—</span>
                                  <span className="text-[11px] font-bold text-[#4C1D95] bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                                    {renderHighlighted(item.category)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-black font-mono text-[#111827]">
                                  ₹{item.price}
                                </span>
                                {item.isHidden ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                                    Hidden
                                  </span>
                                ) : item.inStock === false ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                    Out
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                    Live
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Category & Status Filters */}
                <div className="flex items-center gap-2 w-full xl:w-auto shrink-0">
                  {/* Category Filter */}
                  <select
                    value={foodCategoryFilter}
                    onChange={(e) => setFoodCategoryFilter(e.target.value)}
                    className="flex-1 xl:flex-none min-w-0 h-[38px] bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 text-xs text-[#111827] font-bold outline-none cursor-pointer"
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
                    className="flex-1 xl:flex-none min-w-0 h-[38px] bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 text-xs text-[#111827] font-bold outline-none cursor-pointer"
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
                      className="px-3 py-2 text-xs text-[#4C1D95] font-bold hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Food Items Cards Grid */}
              {loadingProducts && allProducts.length === 0 ? (
                <div className="bg-white border border-[#D1D5DB] p-12 rounded-3xl text-center space-y-3">
                  <RefreshCw size={28} className="animate-spin text-[#4C1D95] mx-auto" />
                  <p className="text-xs font-bold text-[#4B5563]">Loading food items catalog...</p>
                </div>
              ) : filteredAdminProducts.length === 0 ? (
                <div className="bg-white border border-[#D1D5DB] p-12 rounded-3xl text-center space-y-3">
                  <Utensils size={36} className="text-[#4B5563]/40 mx-auto" />
                  <h3 className="text-base font-extrabold text-[#111827]">No Food Items Found</h3>
                  <p className="text-xs text-[#4B5563] max-w-sm mx-auto">
                    No items match your search or filter criteria. Try clearing filters or add a new food item.
                  </p>
                  <button
                    onClick={() => setShowAddFoodModal(true)}
                    className="px-4 py-2.5 bg-[#4C1D95] text-white rounded-xl text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                  >
                    <Plus size={14} /> Add Food Item
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredAdminProducts.map((product) => {
                    const isHidden = !!product.isHidden;
                    const inStock = product.inStock !== false;

                    return (
                      <div
                        key={product._id}
                        className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md ${
                          isHidden 
                            ? 'border-violet-300 bg-violet-50/20 opacity-90' 
                            : !inStock 
                              ? 'border-amber-300 bg-amber-50/20' 
                              : 'border-[#D1D5DB] hover:border-[#4C1D95]'
                        }`}
                      >
                        <div>
                          {/* Image & Badges Banner */}
                          <div className="relative h-44 w-full bg-[#FFFFFF] overflow-hidden">
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
                                <span className="bg-[#4C1D95] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
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
                            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs text-[#111827] border border-[#D1D5DB] px-3 py-1 rounded-xl shadow-md flex items-center gap-1 font-black">
                              <span className="text-xs text-[#4C1D95]">₹</span>
                              <span className="text-sm">{product.price?.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Details Content */}
                          <div className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-black text-sm text-[#111827] leading-tight line-clamp-1">
                                {product.name}
                              </h3>
                              <span className="text-[10px] text-[#4B5563] font-semibold shrink-0 bg-[#FFFFFF] border border-[#D1D5DB] px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <Clock size={11} className="text-[#4C1D95]" />
                                {product.estimatedPrepTime || 15}m
                              </span>
                            </div>

                            <p className="text-[11px] text-[#4B5563] line-clamp-2 leading-relaxed font-medium">
                              {product.description || 'Prepared fresh on order with top ingredients.'}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="p-4 pt-2 border-t border-[#E5E7EB] grid grid-cols-2 gap-2 text-xs">
                          {/* Toggle Hide / Show */}
                          <button
                            onClick={() => handleToggleHideProduct(product)}
                            className={`px-3 py-2 rounded-xl border font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                              isHidden
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                : 'bg-[#FFFFFF] hover:bg-violet-50 text-[#4C1D95] border-violet-200'
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
                                : 'bg-[#FFFFFF] hover:bg-white text-[#111827] border-[#D1D5DB]'
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
                            className="px-3 py-2 bg-[#FFFFFF] hover:bg-white text-[#111827] border border-[#D1D5DB] rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="Edit Item Details"
                          >
                            <Edit2 size={13} className="text-sky-600" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Item */}
                          <button
                            onClick={() => handleDeleteProduct(product._id, product.name)}
                            className="px-3 py-2 bg-violet-50 hover:bg-violet-600 text-violet-600 hover:text-white border border-violet-200 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
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
            <div className="bg-white border border-[#D1D5DB] p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 sm:gap-3.5">
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0">
                  <Receipt size={22} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#111827] flex items-center flex-wrap gap-2">
                    <span>Reception Billing Counter</span>
                    <span className="text-[10px] sm:text-xs bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30 px-2 sm:px-2.5 py-0.5 rounded-full font-extrabold">
                      {receptionOrders.length} Unsettled Bills
                    </span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#4B5563] font-semibold mt-0.5 leading-tight">
                    Generate Tax Invoice Receipts, Record Cash Payments & Release Tables to Available Status
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  id="gstConfigBtn"
                  data-testid="gstConfigBtn"
                  onClick={() => {
                    setTempGstInput(String(gstRate));
                    setShowGstModal(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm quick-touch whitespace-nowrap"
                  title="Configure GST Tax Percentage"
                >
                  <DollarSign size={14} />
                  <span>GST: {gstRate}%</span>
                </button>
                <button
                onClick={fetchReceptionOrders}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#FFFFFF] hover:bg-white text-[#111827] border border-[#D1D5DB] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm quick-touch"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Queue</span>
              </button>
              </div>
              </div>
            </div>

            {/* Reception Orders Cards Grid */}
            <div className="space-y-3.5 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={16} className="text-[#4C1D95]" />
                  <span>Pending Table Bills ({filteredPendingOrders.length})</span>
                </h3>

                {/* Filter Table Pills */}
                <div className="flex items-start gap-1 bg-white p-1.5 rounded-2xl border border-[#D1D5DB] shadow-sm w-full sm:w-auto max-w-full">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-bold text-[#4B5563] px-2 py-1 flex items-center gap-1 shrink-0">
                      <Filter size={12} className="text-[#4C1D95]" /> Table:
                    </span>
                    <button
                      onClick={() => setPendingTableFilter('all')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        pendingTableFilter === 'all'
                          ? 'bg-[#4C1D95] text-white shadow'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      All
                    </button>
                  </div>
                  <div className="flex items-center flex-wrap gap-1 flex-1 min-w-0">
                    {dynamicTableNumbers.map(tNum => (
                      <button
                        key={tNum}
                        onClick={() => setPendingTableFilter(tNum)}
                        className={`px-2 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center shrink-0 ${
                          pendingTableFilter === tNum
                            ? 'bg-[#4C1D95] text-white shadow'
                            : 'text-[#4B5563] hover:text-[#111827]'
                        }`}
                      >
                        T{tNum}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredPendingOrders.length === 0 ? (
                <div className="bg-white border border-[#D1D5DB] rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-sm">
                  <CheckCircle size={36} className="mx-auto text-emerald-500 sm:w-10 sm:h-10" />
                  <h4 className="text-sm sm:text-base font-extrabold text-[#111827]">All Table Bills Cleared!</h4>
                  <p className="text-xs text-[#4B5563]">No table orders are currently awaiting billing receipt generation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5">
                  {filteredPendingOrders.map((order: Order) => (
                    <div 
                      key={order._id}
                      className="bg-white border border-[#D1D5DB] hover:border-[#4C1D95] rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Table Header */}
                        <div className="flex justify-between items-start border-b border-[#E5E7EB] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-[#4C1D95]/10 text-[#4C1D95] font-black text-xs sm:text-sm flex items-center justify-center border border-[#4C1D95]/30 shrink-0">
                              T{order.tableNumber}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs sm:text-sm text-[#111827] truncate">{order.customerName}</h4>
                              <p className="text-[10px] text-[#4B5563] font-mono">Order #{order._id.slice(-4)}</p>
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
                        <div className="space-y-1.5 bg-[#FFFFFF] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#D1D5DB]">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="text-xs flex justify-between items-center text-[#111827]">
                              <span className="font-semibold truncate pr-1">
                                {item.quantity}x {item.product?.name || item.name || 'Food Item'}
                              </span>
                              <span className="font-mono font-bold text-[#4C1D95] shrink-0">
                                ₹{(item.price || item.product?.price || 0) * item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total Amount Banner */}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-bold text-[#4B5563]">Total Amount:</span>
                          <span className="text-base sm:text-lg font-black text-[#4C1D95] font-mono">
                            ₹{(() => {
                              const sub = (order.items && order.items.length > 0)
                                ? order.items.reduce((sum: number, item: any) => {
                                    const p = Number(item.price ?? item.product?.price ?? 0);
                                    const q = Number(item.quantity ?? 1);
                                    return sum + p * q;
                                  }, 0)
                                : Number(order.totalAmount || 0);
                              return (sub + sub * ((Number(gstRate) || 0) / 100)).toFixed(2);
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Settle Bill or Track Status */}
                      {order.status === 'ready' || order.status === 'quality_check' ? (
                        <button
                          onClick={() => setSelectedReceiptOrder(order)}
                          className="w-full py-2.5 sm:py-3 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-xl sm:rounded-2xl text-xs shadow-md shadow-[#4C1D95]/20 flex items-center justify-center gap-2 cursor-pointer transition-all quick-touch mt-2"
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
            <div className="space-y-4 pt-4 border-t border-[#D1D5DB]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h3 className="text-xs font-extrabold text-[#111827] uppercase tracking-wider flex items-center gap-2 shrink-0">
                  <DollarSign size={16} className="text-emerald-600 shrink-0" />
                  <span className="leading-snug">
                    <span className="block whitespace-nowrap">Payment Settlement</span>
                    <span className="block whitespace-nowrap">History Log ({filteredPaymentHistory.length})</span>
                  </span>
                </h3>

                {/* Date, GST Bill & Table Filters */}
                <div className="flex flex-col items-start gap-2.5 w-full lg:w-auto max-w-full min-w-0">
                  {/* Date Filter + GST Bill Button Row */}
                  <div className="flex items-center gap-2 flex-wrap w-full max-w-full min-w-0">
                    <div className="flex items-center flex-wrap gap-1 bg-white p-1 sm:p-1.5 rounded-2xl border border-[#D1D5DB] text-xs font-bold shadow-xs w-full sm:w-auto max-w-full min-w-0">
                      <span className="text-[#4B5563] px-1.5 sm:px-2 flex items-center gap-1 shrink-0 text-[11px] sm:text-xs">
                        <Calendar size={12} className="text-[#4C1D95]" /> Date:
                      </span>
                      {['all', 'today', '7days', '30days', 'lastmonth', 'custom'].map(f => (
                        <button
                          key={f}
                          title={f === 'custom' ? 'Custom Date Range' : undefined}
                          onClick={() => setHistoryDateFilter(f)}
                          className={`px-1.5 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs tracking-tight sm:tracking-normal capitalize transition-all cursor-pointer shrink-0 ${
                            historyDateFilter === f
                              ? 'bg-[#4C1D95] text-white shadow'
                              : 'text-[#4B5563] hover:text-[#111827]'
                          }`}
                        >
                          {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : f === '7days' ? '7 Days' : f === '30days' ? '30 Days' : f === 'lastmonth' ? 'Last Month' : '📅 CR'}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setHistoryGstOnlyFilter(prev => !prev)}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0 ${
                        historyGstOnlyFilter
                          ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 shadow-md'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                      title={historyGstOnlyFilter ? 'Showing only GST bills. Click to show all bills.' : 'Click to show only GST bills'}
                    >
                      <Receipt size={14} className={historyGstOnlyFilter ? 'text-white' : 'text-amber-600'} />
                      <span>GST Bill ({gstPaymentHistoryCount})</span>
                    </button>
                  </div>

                  {/* Custom Date Range Picker for Payment Settlement History Log */}
                  {historyDateFilter === 'custom' && (
                    <div className="w-full bg-white border border-[#D1D5DB] p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 shadow-xs animate-fade-in">
                      <div className="w-full sm:flex-1 space-y-1.5">
                        <label className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#4C1D95] shrink-0" /> Start Date:
                        </label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2 text-xs text-[#111827] font-semibold outline-none"
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
                          className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2 text-xs text-[#111827] font-semibold outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Table Filter */}
                  <div className="flex items-start gap-1 bg-white p-1.5 rounded-2xl border border-[#D1D5DB] text-xs font-bold w-full sm:w-auto max-w-full">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[#4B5563] px-2 py-1 flex items-center gap-1 shrink-0">
                        <Filter size={12} className="text-[#4C1D95]" /> Table:
                      </span>
                      <button
                        onClick={() => setHistoryTableFilter('all')}
                        className={`px-2.5 py-1 rounded-xl text-xs transition-all cursor-pointer shrink-0 ${
                          historyTableFilter === 'all'
                            ? 'bg-[#4C1D95] text-white shadow'
                            : 'text-[#4B5563] hover:text-[#111827]'
                        }`}
                      >
                        All
                      </button>
                    </div>
                    <div className="flex items-center flex-wrap gap-1 flex-1 min-w-0">
                      {dynamicTableNumbers.map(tNum => (
                        <button
                          key={tNum}
                          onClick={() => setHistoryTableFilter(tNum)}
                          className={`px-2 py-1 rounded-xl text-xs transition-all cursor-pointer text-center shrink-0 ${
                            historyTableFilter === tNum
                              ? 'bg-[#4C1D95] text-white shadow'
                              : 'text-[#4B5563] hover:text-[#111827]'
                          }`}
                        >
                          T{tNum}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Delete Bar for Payment Settlement History Log */}
              {selectedHistoryOrderIds.length > 0 && (
                <div className="bg-violet-50 border border-violet-200 p-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2 text-violet-700 font-extrabold text-xs">
                    <CheckSquare size={16} />
                    <span>{selectedHistoryOrderIds.length} bill(s) selected for bulk deletion</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteBulkHistoryOrders}
                      className="px-4 py-2 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Delete Selected ({selectedHistoryOrderIds.length})</span>
                    </button>
                    <button
                      onClick={() => setSelectedHistoryOrderIds([])}
                      className="px-3 py-2 bg-white text-[#4B5563] hover:text-[#111827] font-bold text-xs rounded-xl border border-[#D1D5DB] cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {filteredPaymentHistory.length === 0 ? (
                <div className="bg-white border border-[#D1D5DB] rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center text-[#4B5563] text-xs font-semibold">
                  {historyGstOnlyFilter
                    ? 'No GST bills found for the selected filters.'
                    : 'No payment history transactions match selected filters.'}
                </div>
              ) : (
                <div id="receptionTable" data-testid="receptionTable" className="bg-white border border-[#D1D5DB] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
                  <div className="responsive-table-wrapper overflow-x-auto w-full scrollbar-thin pb-2">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-[#FFFFFF] border-b border-[#D1D5DB] text-[#4B5563] font-extrabold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3 sm:p-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={filteredPaymentHistory.length > 0 && filteredPaymentHistory.every(o => selectedHistoryOrderIds.includes(o._id))}
                              onChange={() => toggleSelectAllHistoryOrders(filteredPaymentHistory)}
                              className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
                              title="Select all filtered bills"
                            />
                          </th>
                          <th className="p-3 sm:p-4">Order ID</th>
                          <th className="p-3 sm:p-4">Table #</th>
                          <th className="p-3 sm:p-4">Customer</th>
                          <th className="p-3 sm:p-4">Payment Method</th>
                          <th className="p-3 sm:p-4">Amount Paid</th>
                          <th className="p-3 sm:p-4">Time Settled</th>
                          <th className="p-3 sm:p-4 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                        {filteredPaymentHistory.map((order: Order, idx: number) => (
                          <tr 
                            key={`${order._id}-${idx}`} 
                            id={idx === 0 ? "historyRow1" : `historyRow-${idx + 1}`}
                            data-testid={idx === 0 ? "historyRow1" : `historyRow-${idx + 1}`}
                            onClick={() => setSelectedReceiptOrder(order)}
                            className={`hover:bg-[#4C1D95]/5 transition-colors cursor-pointer group ${selectedHistoryOrderIds.includes(order._id) ? 'bg-violet-50/70' : ''}`}
                          >
                            <td className="p-3 sm:p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedHistoryOrderIds.includes(order._id)}
                                onChange={() => toggleSelectHistoryOrder(order._id)}
                                className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-3 sm:p-4 font-mono font-bold text-[#4C1D95]">#{order._id.slice(-6)}</td>
                            <td className="p-3 sm:p-4 font-extrabold text-[#4C1D95] group-hover:underline">Table {order.tableNumber}</td>
                            <td className="p-3 sm:p-4 font-semibold">{order.customerName}</td>
                            <td className="p-3 sm:p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30">
                                {order.paymentMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="p-3 sm:p-4 font-black font-mono text-emerald-700">
                              <div className="flex items-center gap-1.5">
                                <span>₹{order.totalAmount?.toFixed(2)}</span>
                                {getOrderEffectiveGstRate(order) > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                    GST {getOrderEffectiveGstRate(order)}%
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 sm:p-4 text-[#4B5563] font-semibold whitespace-nowrap">
                              {new Date((order as any).updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 sm:p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  id={`printReceiptBtn-${order._id}`}
                                  data-testid={`printReceiptBtn-${order._id}`}
                                  onClick={() => handleDirectPrintReceipt(order)}
                                  className="px-2.5 py-1 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1 quick-touch"
                                  title="Direct Print 80mm POS Thermal Receipt"
                                >
                                  <Printer size={12} />
                                  <span>Print</span>
                                </button>

                                <button
                                  id={`deleteHistoryOrderBtn-${order._id}`}
                                  data-testid={`deleteHistoryOrderBtn-${order._id}`}
                                  onClick={() => handleDeleteSingleOrder(order._id)}
                                  className="p-1.5 rounded-xl bg-violet-50 hover:bg-violet-600 text-violet-600 hover:text-white border border-violet-200 transition-colors cursor-pointer"
                                  title={`Delete bill #${order._id.slice(-6)}`}
                                >
                                  <Trash2 size={14} />
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
            <div className="bg-white border border-[#D1D5DB] p-4 sm:p-5 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 xl:flex-1">
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0 flex items-center justify-center">
                    <BarChart3 size={24} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-[#111827] flex items-center gap-2">
                      <span>Store Operations Analytics & Date Filtering</span>
                    </h2>
                    <p className="text-xs text-[#4B5563] font-semibold mt-0.5">
                      Real-time revenue metrics, kitchen performance, and custom date range stats
                    </p>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center flex-wrap xl:shrink-0 bg-[#FFFFFF] p-1 sm:p-1.5 rounded-2xl border border-[#D1D5DB] shadow-xs gap-1 w-full sm:w-auto max-w-full min-w-0">
                  {(['today', '7days', '30days', 'lastmonth', 'all', 'custom'] as const).map((f) => (
                    <button
                      key={f}
                      title={f === 'custom' ? 'Custom Date Range' : undefined}
                      onClick={() => {
                        setDateFilter(f);
                        if (f !== 'custom') {
                          fetchAdminData(f);
                        }
                      }}
                      className={`px-2 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs tracking-tight sm:tracking-normal font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        dateFilter === f
                          ? 'bg-[#4C1D95] text-white shadow-md'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      {f === 'today' ? 'Today' : f === '7days' ? 'Last 7 Days' : f === '30days' ? 'Last 30 Days' : f === 'lastmonth' ? 'Last Month' : f === 'all' ? 'All Time' : '📅 CR'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separated Custom Date Range Picker Section */}
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
                      onClick={() => fetchAdminData('custom', customStartDate, customEndDate)}
                      className="w-full sm:w-auto px-5 py-2.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 h-[40px] active:scale-[0.98]"
                    >
                      <Filter size={14} />
                      <span>Apply Date Filter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
              <div className="bg-white border border-[#D1D5DB] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#4B5563]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Gross Revenue</span>
                  <div className="p-2 rounded-xl bg-[#4C1D95]/10 text-[#4C1D95]"><TrendingUp size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#4C1D95] font-mono">₹{(displayData.grossRevenue || 0).toFixed(2)}</div>
                <p className="text-[10px] text-emerald-600 font-bold">Total revenue for selected period</p>
              </div>

              <div className="bg-white border border-[#D1D5DB] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#4B5563]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Total Orders</span>
                  <div className="p-2 rounded-xl bg-[#4C1D95]/10 text-[#4C1D95]"><ShoppingBag size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#111827] font-mono">{displayData.totalOrders}</div>
                <p className="text-[10px] text-[#4B5563] font-semibold">Completed Orders</p>
              </div>

              <div className="bg-white border border-[#D1D5DB] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#4B5563]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Avg Prep Time</span>
                  <div className="p-2 rounded-xl bg-[#4C1D95]/10 text-[#4C1D95]"><Clock size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#111827] font-mono">{displayData.avgPrepTimeMins} <span className="text-xs font-bold text-[#4B5563]">mins</span></div>
                <p className="text-[10px] text-emerald-600 font-bold">Fast Kitchen Preparation</p>
              </div>

              <div className="bg-white border border-[#D1D5DB] p-5 rounded-3xl shadow-sm space-y-2">
                <div className="flex justify-between items-center text-[#4B5563]">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Active Tables</span>
                  <div className="p-2 rounded-xl bg-[#4C1D95]/10 text-[#4C1D95]"><Users size={16} /></div>
                </div>
                <div className="text-2xl font-black text-[#4C1D95] font-mono">{displayData?.liveActiveTables !== undefined ? displayData.liveActiveTables : 0}</div>
                <p className="text-[10px] text-[#4B5563] font-semibold">Live Occupied Tables</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div className="bg-white border border-[#D1D5DB] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-3">
                  <h3 className="font-extrabold text-sm text-[#111827]">Category Sales Share</h3>
                  <PieIcon size={16} className="text-[#4C1D95]" />
                </div>
                <div className="space-y-3">
                  {(() => {
                    const categories = (displayData?.categoryBreakdown && displayData.categoryBreakdown.length > 0)
                      ? displayData.categoryBreakdown
                      : defaultDashboardData.categoryBreakdown;

                    if (categories.length === 0) {
                      return (
                        <div className="py-8 text-center text-xs font-semibold text-[#4B5563]">
                          No category sales recorded for the selected period.
                        </div>
                      );
                    }

                    return categories.map((cat: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#111827]">{cat.category}</span>
                          <span className="text-[#4C1D95] font-mono">₹{cat.sales || 0} ({cat.percent || 0}%)</span>
                        </div>
                        <div className="w-full bg-[#FFFFFF] border border-[#D1D5DB] rounded-full h-2.5 overflow-hidden">
                          <div className="h-full bg-[#4C1D95] rounded-full transition-all duration-500" style={{ width: `${Math.max(5, cat.percent || 0)}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Peak Dining Hours Line Graph */}
              <div className="bg-white border border-[#D1D5DB] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#111827]">Peak Dining Hours Graph</h3>
                    <p className="text-[10px] text-[#4B5563] font-semibold">Hourly order volume line chart</p>
                  </div>
                  <TrendingUp size={18} className="text-[#4C1D95]" />
                </div>

                <div className="pt-2 relative">
                  {(() => {
                    const computeLivePeakHours = () => {
                      if (!allSystemOrders || allSystemOrders.length === 0) return null;
                      const slots = [
                        { hour: '8 AM', orders: 0 },
                        { hour: '10 AM', orders: 0 },
                        { hour: '12 PM', orders: 0 },
                        { hour: '2 PM', orders: 0 },
                        { hour: '4 PM', orders: 0 },
                        { hour: '6 PM', orders: 0 },
                        { hour: '8 PM', orders: 0 },
                        { hour: '10 PM', orders: 0 }
                      ];

                      const validPeriodOrders = allSystemOrders.filter((o: any) => {
                        if (o.status === 'cancelled' || !(Number(o.totalAmount) > 0)) return false;
                        return checkDateMatch(o.createdAt, dateFilter, customStartDate, customEndDate);
                      });

                      validPeriodOrders.forEach((o: any) => {
                        let hr = new Date(o.createdAt || Date.now()).getHours();
                        try {
                          const parts = new Intl.DateTimeFormat('en-US', {
                            timeZone: 'Asia/Kolkata',
                            hour: 'numeric',
                            hour12: false
                          }).formatToParts(new Date(o.createdAt || Date.now()));
                          const hp = parts.find(p => p.type === 'hour');
                          if (hp) {
                            const parsed = parseInt(hp.value, 10);
                            if (!isNaN(parsed)) hr = parsed === 24 ? 0 : parsed;
                          }
                        } catch (e) {}

                        if (hr < 9) slots[0].orders++;
                        else if (hr >= 9 && hr < 11) slots[1].orders++;
                        else if (hr >= 11 && hr < 13) slots[2].orders++;
                        else if (hr >= 13 && hr < 15) slots[3].orders++;
                        else if (hr >= 15 && hr < 17) slots[4].orders++;
                        else if (hr >= 17 && hr < 19) slots[5].orders++;
                        else if (hr >= 19 && hr < 21) slots[6].orders++;
                        else if (hr >= 21) slots[7].orders++;
                      });

                      return slots;
                    };

                    const livePeaks = computeLivePeakHours();
                    const peaks = livePeaks
                      ? livePeaks
                      : (displayData?.peakHours && displayData.peakHours.length > 0)
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
                                <stop offset="0%" stopColor="#4C1D95" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Horizontal Grid lines */}
                            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#E5E7EB" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1={paddingX} y1={(height - 15) / 2 + paddingY / 2} x2={width - paddingX} y2={(height - 15) / 2 + paddingY / 2} stroke="#E5E7EB" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1={paddingX} y1={height - 15} x2={width - paddingX} y2={height - 15} stroke="#D1D5DB" strokeWidth="1.5" />

                            {/* Area Gradient Fill */}
                            <path d={areaPath} fill="url(#peakLineGradient)" />

                            {/* Main Curve Line */}
                            <path d={linePath} fill="none" stroke="#4C1D95" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Interactive Data Points & Labels */}
                            {points.map((pt: any, idx: number) => (
                              <g key={idx} className="group cursor-pointer">
                                {/* Vertical Guideline on Hover */}
                                <line 
                                  x1={pt.x} y1={paddingY} x2={pt.x} y2={height - 15} 
                                  stroke="#4C1D95" strokeWidth="1" strokeDasharray="2 2" 
                                  className="opacity-0 group-hover:opacity-100 transition-opacity" 
                                />

                                {/* Dot Node */}
                                <circle 
                                  cx={pt.x} cy={pt.y} r="5" 
                                  className="fill-[#4C1D95] stroke-white stroke-2 group-hover:r-7 transition-all" 
                                />

                                {/* Visible Count Label for Non-Zero Points */}
                                {pt.orders > 0 && (
                                  <text
                                    x={pt.x}
                                    y={Math.max(12, pt.y - 10)}
                                    textAnchor="middle"
                                    className="fill-[#4C1D95] text-[10px] font-mono font-extrabold group-hover:opacity-0 transition-opacity"
                                  >
                                    {pt.orders}
                                  </text>
                                )}

                                {/* Tooltip Text on Hover */}
                                <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <rect 
                                    x={pt.x - 30} y={Math.max(2, pt.y - 30)} 
                                    width="60" height="20" rx="6" 
                                    className="fill-[#111827]" 
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
                                  className="fill-[#4B5563] text-[10px] font-bold font-sans"
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
            <div className="space-y-3 pt-6 border-t border-[#D1D5DB]">
              {/* Row 1: Title on Left, Date Filter on Right */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="shrink-0">
                  <h3 className="text-sm font-extrabold text-[#111827] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                    <ShoppingBag size={16} className="text-[#4C1D95]" />
                    <span>Overview Store Order History</span>
                    <span className="text-[10px] bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30 px-2.5 py-0.5 rounded-full font-extrabold">
                      {filteredOverviewOrders.length} Orders
                    </span>
                  </h3>
                  <p className="text-xs text-[#4B5563] font-semibold mt-0.5">
                    Complete log of all live & past store orders with status & table filters
                  </p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center flex-wrap gap-1 bg-white p-1 rounded-2xl border border-[#D1D5DB] text-xs font-bold shadow-xs w-full sm:w-auto max-w-full shrink-0">
                  <span className="text-[#4B5563] px-1.5 sm:px-2 flex items-center gap-1 text-[11px] sm:text-xs shrink-0">
                    <Calendar size={12} className="text-[#4C1D95]" /> Date:
                  </span>
                  {['all', 'today', '7days', '30days', 'lastmonth', 'custom'].map(f => (
                    <button
                      key={f}
                      title={f === 'custom' ? 'Custom Date Range' : undefined}
                      onClick={() => setOverviewDateFilter(f)}
                      className={`px-1.5 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs tracking-tight sm:tracking-normal capitalize font-extrabold transition-all cursor-pointer shrink-0 ${
                        overviewDateFilter === f
                          ? 'bg-[#4C1D95] text-white shadow'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : f === '7days' ? '7 Days' : f === '30days' ? '30 Days' : f === 'lastmonth' ? 'Last Month' : '📅 CR'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range Picker for Overview Store Order History */}
              {overviewDateFilter === 'custom' && (
                <div className="w-full bg-white border border-[#D1D5DB] p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 shadow-xs animate-fade-in">
                  <div className="w-full sm:flex-1 space-y-1.5">
                    <label className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#4C1D95] shrink-0" /> Start Date:
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2 text-xs text-[#111827] font-semibold outline-none"
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
                      className="w-full bg-white border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2 text-xs text-[#111827] font-semibold outline-none"
                    />
                  </div>

                  {(customStartDate || customEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#4B5563] hover:text-[#111827] text-xs font-bold rounded-xl transition-all cursor-pointer h-[38px]"
                    >
                      Clear Dates
                    </button>
                  )}
                </div>
              )}

              {/* Row 2: Export CSV on Left (opposite to filters), Status & Table Filters on Right */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-0.5">
                <button
                  onClick={handleExportOverviewOrdersCSV}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 self-start lg:self-center"
                  title="Export Filtered Order History to CSV Excel"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>

                {/* Status & Table Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center lg:flex-nowrap gap-2 w-full lg:w-auto min-w-0">
                  {/* Status Filter */}
                  <div className="flex items-center flex-nowrap gap-0.5 bg-white p-1 rounded-2xl border border-[#D1D5DB] text-xs font-bold shadow-xs w-full sm:w-auto shrink-0 overflow-x-auto scrollbar-none">
                    <span className="text-[#4B5563] px-1.5 flex items-center gap-1 text-[11px] xl:text-xs shrink-0">
                      <Filter size={12} className="text-[#4C1D95] shrink-0" /> Status:
                    </span>
                    {['all', 'paid', 'pending', 'ready', 'cancelled'].map(st => (
                      <button
                        key={st}
                        onClick={() => setOverviewStatusFilter(st)}
                        className={`px-2 py-1 rounded-xl text-[11px] xl:text-xs tracking-tight xl:tracking-normal uppercase font-extrabold transition-all cursor-pointer shrink-0 ${
                          overviewStatusFilter === st
                            ? 'bg-[#4C1D95] text-white shadow'
                            : 'text-[#4B5563] hover:text-[#111827]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Table Filter */}
                  <div className="flex items-start gap-1 bg-white p-1 rounded-2xl border border-[#D1D5DB] text-xs font-bold shadow-xs w-full sm:w-auto max-w-full min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[#4B5563] px-1.5 py-1 text-[11px] xl:text-xs shrink-0">Table:</span>
                      <button
                        onClick={() => setOverviewTableFilter('all')}
                        className={`px-2 py-1 rounded-xl text-[11px] xl:text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                          overviewTableFilter === 'all'
                            ? 'bg-[#4C1D95] text-white shadow'
                            : 'text-[#4B5563] hover:text-[#111827]'
                        }`}
                      >
                        All
                      </button>
                    </div>
                    <div className="flex items-center flex-wrap gap-0.5 sm:gap-1 flex-1 min-w-0">
                      {dynamicTableNumbers.map(tNum => (
                        <button
                          key={tNum}
                          onClick={() => setOverviewTableFilter(tNum)}
                          className={`px-1.5 xl:px-2 py-1 rounded-xl text-[11px] xl:text-xs font-extrabold transition-all cursor-pointer text-center shrink-0 ${
                            overviewTableFilter === tNum
                              ? 'bg-[#4C1D95] text-white shadow'
                              : 'text-[#4B5563] hover:text-[#111827]'
                          }`}
                        >
                          T{tNum}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Delete Bar */}
              {selectedOverviewOrderIds.length > 0 && (
                <div className="bg-violet-50 border border-violet-200 p-3.5 rounded-2xl flex items-center justify-between shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2 text-violet-700 font-extrabold text-xs">
                    <CheckSquare size={16} />
                    <span>{selectedOverviewOrderIds.length} order(s) selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportOverviewOrdersCSV}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Export Selected Orders to CSV Excel"
                    >
                      <Download size={14} />
                      <span>Export Selected ({selectedOverviewOrderIds.length})</span>
                    </button>
                    <button
                      onClick={handleDeleteBulkOrders}
                      className="px-4 py-2 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Delete Selected ({selectedOverviewOrderIds.length})</span>
                    </button>
                    <button
                      onClick={() => setSelectedOverviewOrderIds([])}
                      className="px-3 py-2 bg-white text-[#4B5563] hover:text-[#111827] font-bold text-xs rounded-xl border border-[#D1D5DB] cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* Order History Table */}
              <div className="bg-white border border-[#D1D5DB] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto w-full scrollbar-thin pb-2">
                  <table className="w-full text-left text-xs min-w-[900px]">
                    <thead className="bg-[#FFFFFF] border-b border-[#D1D5DB] text-[#4B5563] font-extrabold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4 w-10 text-center">
                          <input 
                            type="checkbox"
                            checked={filteredOverviewOrders.length > 0 && filteredOverviewOrders.every(o => selectedOverviewOrderIds.includes(o._id))}
                            onChange={() => toggleSelectAllOrders(filteredOverviewOrders)}
                            className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
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
                    <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                      {filteredOverviewOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-[#4B5563] font-semibold">
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
                            className={`hover:bg-[#4C1D95]/5 transition-colors cursor-pointer group ${selectedOverviewOrderIds.includes(order._id) ? 'bg-violet-50/70' : ''}`}
                          >
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox"
                                checked={selectedOverviewOrderIds.includes(order._id)}
                                onChange={() => toggleSelectOrder(order._id)}
                                className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-4 font-mono font-bold text-[#4C1D95]">#{order._id.slice(-6)}</td>
                            <td className="p-4 font-extrabold text-[#4C1D95] group-hover:underline">Table {order.tableNumber}</td>
                            <td className="p-4 font-semibold">{order.customerName}</td>
                            <td className="p-4 text-[11px] text-[#4B5563] font-medium max-w-[200px] truncate">
                              {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                            </td>
                            <td className="p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-xs ${
                                order.status === 'served' || order.paymentStatus === 'paid'
                                  ? 'bg-emerald-500 text-white'
                                  : order.status === 'cancelled'
                                    ? 'bg-[#4C1D95] text-white'
                                    : 'bg-amber-500 text-white'
                              }`}>
                                {order.paymentStatus === 'paid' ? 'PAID' : order.status}
                              </span>
                            </td>
                            <td className="p-4 text-[#4B5563] font-semibold">
                              {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDirectPrintReceipt(order); }}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                  title="Print Thermal Receipt"
                                >
                                  <Printer size={13} />
                                  <span>Print</span>
                                </button>
                                <button
                                  id={`deleteOrderBtn-${order._id}`}
                                  data-testid={`deleteOrderBtn-${order._id}`}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteSingleOrder(order._id); }}
                                  className="p-1.5 rounded-xl bg-violet-50 hover:bg-violet-600 text-violet-600 hover:text-white border border-violet-200 transition-colors cursor-pointer"
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
        </div>
      </div>

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

      {/* ⚙️ MANAGE CATEGORIES MODAL */}
      {showManageCategories && (
        <ManageCategoriesModal 
          onClose={() => setShowManageCategories(false)} 
          onUpdate={fetchAdminProducts} 
        />
      )}

      {/* 🍔 ADD FOOD ITEM & NEW CATEGORY MODAL */}
      {showAddFoodModal && (
        <div id="addItemModal" data-testid="addItemModal" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-[#D1D5DB] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-[#111827] my-auto">
            {/* Modal Header */}
            <div className="bg-[#4C1D95] text-white p-5 flex justify-between items-center relative shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                  <Utensils size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white">Add New Food Item & Category</h3>
                  <p className="text-[10px] text-violet-100 font-semibold">Live sync with Customer Menu & Kitchen Board</p>
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
              
              {/* ITEM NAME WITH LIVE AUTOCOMPLETE OPTIONS */}
              <div className="relative">
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Food Item Name *
                </label>
                <input
                  id="itemNameInput"
                  data-testid="itemNameInput"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="e.g. Red Velvet Cream Cake / Spicy Paneer Tikka"
                  value={foodName}
                  onFocus={() => setShowAddFoodNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAddFoodNameSuggestions(false), 180)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowAddFoodNameSuggestions(false);
                  }}
                  onChange={(e) => {
                    setFoodName(e.target.value);
                    setShowAddFoodNameSuggestions(true);
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-2.5 text-xs text-[#111827] font-semibold outline-none transition-colors"
                />

                {showAddFoodNameSuggestions && foodName.trim().length > 0 && (() => {
                  const q = foodName.trim().toLowerCase();
                  const commonFoodCatalog: Array<{ name: string; category: string; mealType: string; price?: number }> = [
                    // Dosa & Breakfast
                    { name: 'Plain Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Masala Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Onion Rava Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Ghee Roast Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Podi Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Paper Roast Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Set Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Kal Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Cheese Masala Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Paneer Masala Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Mushroom Masala Dosa', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Egg Dosa', category: 'Dosa', mealType: 'Dinner' },
                    { name: 'Chicken Kari Dosa', category: 'Dosa', mealType: 'Dinner' },
                    { name: 'Mutton Kari Dosa', category: 'Dosa', mealType: 'Dinner' },
                    { name: 'Onion Uttapam', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Tomato Onion Uttapam', category: 'Dosa', mealType: 'Breakfast' },
                    { name: 'Idli (2 Pcs)', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Mini Sambar Idli', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Ghee Podi Idli', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Medu Vada', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Sambar Vada', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Curd Vada', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Masala Vada', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Ven Pongal', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Sweet Pongal', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Poori Masala', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Chola Poori', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Idiyappam', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Appam with Coconut Milk', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Rava Kichadi', category: 'Tiffin', mealType: 'Breakfast' },
                    { name: 'Chapati Kurma', category: 'Dinner', mealType: 'Dinner' },
                    { name: 'Parotta Salna', category: 'Parotta', mealType: 'Dinner' },
                    { name: 'Kothu Parotta', category: 'Parotta', mealType: 'Dinner' },
                    { name: 'Egg Kothu Parotta', category: 'Parotta', mealType: 'Dinner' },
                    { name: 'Chicken Kothu Parotta', category: 'Parotta', mealType: 'Dinner' },
                    { name: 'Chilli Parotta', category: 'Parotta', mealType: 'Dinner' },
                    { name: 'Veechu Parotta', category: 'Parotta', mealType: 'Dinner' },
                    { name: 'Bun Parotta', category: 'Parotta', mealType: 'Dinner' },
                    // Biryani, Rice & Noodles
                    { name: 'South Indian Veg Meals', category: 'Meals', mealType: 'Lunch' },
                    { name: 'Non-Veg Meals', category: 'Meals', mealType: 'Lunch' },
                    { name: 'Chicken Dum Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Mutton Dum Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Hyderabadi Chicken Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Egg Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Veg Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Mushroom Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Paneer Biryani', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Empty Biryani (Kushka)', category: 'Biryani', mealType: 'Lunch' },
                    { name: 'Sambar Rice', category: 'Rice', mealType: 'Lunch' },
                    { name: 'Curd Rice', category: 'Rice', mealType: 'Lunch' },
                    { name: 'Lemon Rice', category: 'Rice', mealType: 'Lunch' },
                    { name: 'Tomato Rice', category: 'Rice', mealType: 'Lunch' },
                    { name: 'Ghee Rice', category: 'Rice', mealType: 'Lunch' },
                    { name: 'Jeera Rice', category: 'Rice', mealType: 'Lunch' },
                    { name: 'Veg Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Schezwan Veg Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Paneer Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Mushroom Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Egg Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Chicken Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Schezwan Chicken Fried Rice', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Veg Noodles', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Egg Noodles', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Chicken Noodles', category: 'Chinese', mealType: 'Dinner' },
                    { name: 'Schezwan Chicken Noodles', category: 'Chinese', mealType: 'Dinner' },
                    // Starters & Curries
                    { name: 'Gobi 65', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Gobi Manchurian', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Paneer 65', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Chilli Paneer', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Spicy Paneer Tikka', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Paneer Butter Masala', category: 'Curry', mealType: 'Dinner' },
                    { name: 'Mushroom 65', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Chilli Mushroom', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Chicken 65', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Boneless Chicken 65', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Chilli Chicken', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Pepper Chicken', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Chicken Manchurian', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Dragon Chicken', category: 'Starters', mealType: 'Dinner' },
                    { name: 'Butter Chicken Masala', category: 'Curry', mealType: 'Dinner' },
                    { name: 'Chettinad Chicken Curry', category: 'Curry', mealType: 'Lunch' },
                    { name: 'Tandoori Chicken (Half)', category: 'Tandoori', mealType: 'Dinner' },
                    { name: 'Tandoori Chicken (Full)', category: 'Tandoori', mealType: 'Dinner' },
                    { name: 'Grill Chicken (Half)', category: 'Tandoori', mealType: 'Dinner' },
                    { name: 'Grill Chicken (Full)', category: 'Tandoori', mealType: 'Dinner' },
                    { name: 'Chicken Shawarma Roll', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Plate Shawarma', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Mutton Chukka', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Fish Fry', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Prawn 65', category: 'Starters', mealType: 'Lunch' },
                    { name: 'Butter Naan', category: 'Tandoori', mealType: 'Dinner' },
                    { name: 'Garlic Naan', category: 'Tandoori', mealType: 'Dinner' },
                    // Cakes, Bakery & Desserts
                    { name: 'Red Velvet Cream Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Black Forest Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'White Forest Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Chocolate Truffle Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Choco Lava Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Butterscotch Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Pineapple Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Strawberry Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Blueberry Cheesecake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Rasmalai Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Plum Cake', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Chocolate Brownie', category: 'Cakes', mealType: 'Breakfast' },
                    { name: 'Sizzling Hot Brownie', category: 'Cakes', mealType: 'Dinner' },
                    { name: 'Gulab Jamun', category: 'Desserts', mealType: 'Lunch' },
                    { name: 'Falooda', category: 'Desserts', mealType: 'Dinner' },
                    // Snacks, Burgers & Chats
                    { name: 'Veg Puff', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Egg Puff', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Chicken Puff', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Samosa', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'French Fries', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Peri Peri Fries', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Veg Burger', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Chicken Burger', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Veg Sandwich', category: 'Snacks', mealType: 'Breakfast' },
                    { name: 'Chicken Sandwich', category: 'Snacks', mealType: 'Dinner' },
                    { name: 'Pani Puri', category: 'Chats', mealType: 'Dinner' },
                    { name: 'Masala Puri', category: 'Chats', mealType: 'Dinner' },
                    { name: 'Bhel Puri', category: 'Chats', mealType: 'Dinner' },
                    { name: 'Pav Bhaji', category: 'Chats', mealType: 'Dinner' },
                    // Beverages & Juices
                    { name: 'Filter Coffee', category: 'Drinks', mealType: 'Breakfast' },
                    { name: 'Masala Tea', category: 'Drinks', mealType: 'Breakfast' },
                    { name: 'Ginger Tea', category: 'Drinks', mealType: 'Breakfast' },
                    { name: 'Badam Milk', category: 'Drinks', mealType: 'Breakfast' },
                    { name: 'Rose Milk', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Cold Coffee', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Fresh Lime Juice', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Watermelon Juice', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Orange Juice', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Apple Juice', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Pomegranate Juice', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Mango Milkshake', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Chocolate Milkshake', category: 'Juice', mealType: 'Lunch' },
                    { name: 'Oreo Milkshake', category: 'Juice', mealType: 'Lunch' },
                  ];

                  // Merge existing products first, then catalog items (deduplicated by lowercase name)
                  const seen = new Set<string>();
                  const mergedList: Array<{ name: string; category: string; mealType: string; price?: number; isExisting?: boolean }> = [];

                  for (const p of allProducts) {
                    const key = (p.name || '').trim().toLowerCase();
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    mergedList.push({
                      name: p.name,
                      category: p.category || 'Cakes',
                      mealType: (p as any).mealType || 'Breakfast',
                      price: p.price,
                      isExisting: true
                    });
                  }

                  for (const c of commonFoodCatalog) {
                    const key = c.name.trim().toLowerCase();
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    mergedList.push(c);
                  }

                  // Sort prefix matches first, then substring matches
                  const matches = mergedList
                    .filter(item => item.name.toLowerCase().includes(q) && item.name.toLowerCase() !== q)
                    .sort((a, b) => {
                      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                      return aStarts - bStarts || a.name.localeCompare(b.name);
                    })
                    .slice(0, 8);

                  if (matches.length === 0) return null;

                  const highlightMatch = (text: string) => {
                    const idx = text.toLowerCase().indexOf(q);
                    if (idx === -1) return <span>{text}</span>;
                    return (
                      <span>
                        {text.slice(0, idx)}
                        <span className="text-[#4C1D95] font-black underline decoration-[#4C1D95]/40">
                          {text.slice(idx, idx + q.length)}
                        </span>
                        {text.slice(idx + q.length)}
                      </span>
                    );
                  };

                  return (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white border border-[#D1D5DB] rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-[#F3F4F6]">
                      {matches.map((item, i) => (
                        <button
                          key={`${item.name}-${i}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFoodName(item.name);
                            if (!foodPrice && item.price) {
                              setFoodPrice(String(item.price));
                            }
                            if (item.mealType && availableMealCategories.includes(item.mealType)) {
                              setFoodMealType(item.mealType);
                            }
                            if (item.category) {
                              setFoodCategory(item.category);
                            }
                            setShowAddFoodNameSuggestions(false);
                          }}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-violet-50/80 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Utensils size={13} className="text-[#4C1D95] shrink-0" />
                            <span className="text-xs font-bold text-[#111827] truncate">
                              {highlightMatch(item.name)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.price !== undefined && (
                              <span className="text-[10px] font-mono font-bold text-emerald-700">
                                ₹{item.price}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-[#4C1D95] text-[9px] font-extrabold">
                              {item.category}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* PRICE (₹) */}
              <div>
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
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
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-2.5 text-xs text-[#111827] font-mono font-bold outline-none transition-colors"
                />
              </div>

              {/* SELECT MEAL CATEGORY */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                    Select Meal Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMealCategory(!isCustomMealCategory)}
                    className="text-[11px] font-extrabold text-[#4C1D95] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>{isCustomMealCategory ? 'Select Existing Meal Category' : '+ + Add New Meal Category'}</span>
                  </button>
                </div>

                {!isCustomMealCategory ? (
                  <div className="grid grid-cols-3 gap-2">
                    {availableMealCategories.map((meal) => (
                      <button
                        key={meal}
                        type="button"
                        onClick={() => {
                          setFoodMealType(meal);
                          const mealCats = Array.from(new Set(
                            allProducts
                              .filter(p => (p.mealType || 'Breakfast') === meal)
                              .map(p => p.category)
                              .filter(Boolean)
                          ));
                          if (mealCats.length > 0 && !mealCats.includes(foodCategory)) {
                            setFoodCategory(mealCats[0]);
                          }
                        }}
                        className={`w-full py-2.5 px-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer truncate ${
                          foodMealType === meal
                            ? 'bg-[#4C1D95] border-[#4C1D95] text-white shadow-md'
                            : 'bg-white border-[#D1D5DB] text-[#4B5563] hover:border-[#4C1D95]'
                        }`}
                      >
                        {meal}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center animate-fade-in">
                    <input
                      id="newMealCategoryInput"
                      data-testid="newMealCategoryInput"
                      type="text"
                      required
                      placeholder="Type new meal category (e.g. Evening Snacks / Specials)..."
                      value={customMealCategoryInput}
                      onChange={(e) => setCustomMealCategoryInput(e.target.value)}
                      className="flex-1 bg-violet-50 border border-violet-300 focus:border-[#4C1D95] rounded-xl px-4 py-2.5 text-xs text-[#111827] font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const trimmed = customMealCategoryInput.trim();
                        if (!trimmed) return;
                        await categoryApi.addMeal(trimmed);
                        if (!availableMealCategories.includes(trimmed)) {
                          setAvailableMealCategories(prev => [...prev, trimmed]);
                        }
                        setFoodMealType(trimmed);
                        setCustomMealCategoryInput('');
                        setIsCustomMealCategory(false);
                        addToast(`✅ Meal Category "${trimmed}" added!`, 'success');
                      }}
                      className="px-4 py-2.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white rounded-xl text-xs font-extrabold cursor-pointer shrink-0 shadow-sm"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* CATEGORY SELECTOR & NEW CATEGORY TOGGLE */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                    Category (For {isCustomMealCategory && customMealCategoryInput.trim() ? customMealCategoryInput.trim() : foodMealType}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-[11px] font-extrabold text-[#4C1D95] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>{isCustomCategory ? 'Select Existing Category' : '+ + Add New Category'}</span>
                  </button>
                </div>

                {!isCustomCategory ? (
                  <select
                    id="itemCategorySelect"
                    data-testid="itemCategorySelect"
                    value={foodCategory}
                    onChange={(e) => setFoodCategory(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2.5 text-xs text-[#111827] font-bold outline-none cursor-pointer"
                  >
                    <option value="" disabled>-- Select Category --</option>
                    {(() => {
                      const mealSpecificCats = Array.from(new Set(
                        allProducts
                          .filter(p => (p.mealType || 'Breakfast') === foodMealType)
                          .map(p => p.category)
                          .filter(Boolean)
                      ));
                      const catsToDisplay = mealSpecificCats.length > 0 ? mealSpecificCats : availableCategories;
                      return catsToDisplay.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ));
                    })()}
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
                    className="w-full bg-violet-50 border border-violet-300 focus:border-[#4C1D95] rounded-xl px-4 py-2.5 text-xs text-[#111827] font-bold outline-none animate-fade-in"
                  />
                )}
              </div>
              {/* DESCRIPTION */}
              <div>
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Description / Ingredients
                </label>
                <textarea
                  id="itemDescriptionInput"
                  data-testid="itemDescriptionInput"
                  rows={2}
                  placeholder="Freshly prepared with premium ingredients..."
                  value={foodDescription}
                  onChange={(e) => setFoodDescription(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-2 text-xs text-[#111827] font-medium outline-none resize-none"
                />
              </div>

              {/* IMAGE SELECTOR (UPLOAD FILE OR URL/PRESET) */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                    Food Image *
                  </label>
                  
                  {/* Mode Switcher Buttons */}
                  <div className="flex bg-[#FFFFFF] p-0.5 rounded-xl border border-[#D1D5DB] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        imageInputMode === 'upload'
                          ? 'bg-[#4C1D95] text-white shadow-xs'
                          : 'text-[#4B5563] hover:text-[#111827]'
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
                          ? 'bg-[#4C1D95] text-white shadow-xs'
                          : 'text-[#4B5563] hover:text-[#111827]'
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
                          <p className="text-[10px] text-[#4B5563] truncate">Auto-compressed & optimized</p>
                          <div className="flex gap-2 mt-1.5">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-white border border-[#D1D5DB] hover:border-[#4C1D95] text-[#111827] text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Change Photo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFoodImage('')}
                              className="px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 text-[10px] font-bold rounded-lg cursor-pointer"
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
                        className="border-2 border-dashed border-[#D1D5DB] hover:border-[#4C1D95] bg-[#FFFFFF] hover:bg-violet-50/30 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-white border border-[#D1D5DB] group-hover:border-[#4C1D95] flex items-center justify-center text-[#4C1D95] shadow-xs group-hover:scale-105 transition-transform">
                          {uploadingImage ? (
                            <RefreshCw size={18} className="animate-spin text-[#4C1D95]" />
                          ) : (
                            <Upload size={18} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#111827] group-hover:text-[#4C1D95]">
                            {uploadingImage ? 'Optimizing photo...' : 'Click to Upload Image from Device'}
                          </p>
                          <p className="text-[10px] text-[#4B5563]">or drag and drop photo here (PNG, JPG, WEBP)</p>
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
                      className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2 text-xs text-[#111827] outline-none"
                    />
                    
                    {/* Preset Chips */}
                    <div>
                      <span className="text-[10px] font-bold text-[#4B5563] block mb-1">Or Pick Instant Preset:</span>
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
                              foodImage === preset.url ? 'bg-[#4C1D95] text-white border-[#4C1D95]' : 'bg-[#FFFFFF] text-[#4B5563] border-[#D1D5DB] hover:bg-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {foodImage && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#D1D5DB] shrink-0 bg-white">
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
                  className="w-full py-3.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-[#4C1D95]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
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
          <div className="bg-white border border-[#D1D5DB] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-[#111827]">
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
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
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
                    className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#111827] outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#4B5563]">% GST</span>
                </div>
                <p className="text-[10px] text-[#4B5563] mt-1.5 font-semibold flex items-center justify-between">
                  <span>Central CGST: <strong className="text-amber-600 font-mono">{(parseFloat(tempGstInput) / 2 || 0).toFixed(1)}%</strong></span>
                  <span>State SGST: <strong className="text-amber-600 font-mono">{(parseFloat(tempGstInput) / 2 || 0).toFixed(1)}%</strong></span>
                </p>
              </div>

              {/* Official Indian Govt GST Slabs */}
              <div className="space-y-2 pt-1 border-t border-[#E5E7EB]">
                <label className="block text-[10px] font-extrabold text-[#4B5563] uppercase tracking-wider">
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
                          : 'bg-[#FFFFFF] text-[#111827] border-[#D1D5DB] hover:bg-white'
                      }`}
                    >
                      <div className="text-[11px] font-extrabold text-[#111827] flex items-center justify-between">
                        <span>{p.label}</span>
                        {tempGstInput === String(p.val) && <span className="text-amber-600 text-xs">✓</span>}
                      </div>
                      <p className="text-[9px] text-[#4B5563] font-semibold mt-0.5">{p.desc}</p>
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in text-[#111827]">
          <div className="bg-white border border-[#D1D5DB] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in my-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#111827] to-[#3A2F2F] text-white p-5 flex justify-between items-center shadow-md">
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
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Food Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-2.5 text-xs text-[#111827] font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Price (₹ INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-2.5 text-xs text-[#111827] font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Meal Category *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableMealCategories.map(meal => (
                    <button
                      key={meal}
                      type="button"
                      onClick={() => setEditMealType(meal)}
                      className={`w-full py-2 px-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer truncate ${
                        editMealType === meal
                          ? 'bg-[#4C1D95] border-[#4C1D95] text-white shadow-sm'
                          : 'bg-white border-[#D1D5DB] text-[#4B5563] hover:border-[#4C1D95]'
                      }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2.5 text-xs text-[#111827] font-bold outline-none cursor-pointer"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-2 text-xs text-[#111827] font-medium outline-none resize-none"
                />
              </div>

              {/* Edit Image */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                    Food Image
                  </label>
                  <div className="flex bg-[#FFFFFF] p-0.5 rounded-xl border border-[#D1D5DB] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditImageInputMode('upload')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        editImageInputMode === 'upload' ? 'bg-[#4C1D95] text-white' : 'text-[#4B5563]'
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditImageInputMode('url')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        editImageInputMode === 'url' ? 'bg-[#4C1D95] text-white' : 'text-[#4B5563]'
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
                      className="border-2 border-dashed border-[#D1D5DB] hover:border-[#4C1D95] bg-[#FFFFFF] p-3 rounded-2xl text-center cursor-pointer flex items-center justify-center gap-2"
                    >
                      {editImage ? (
                        <div className="flex items-center gap-3">
                          <img src={editImage} alt="Edit preview" className="w-12 h-12 rounded-xl object-cover border" />
                          <span className="text-xs font-bold text-[#111827]">Click to Change Photo</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[#4B5563]">Click to upload photo</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={editImage}
                    onChange={(e) => setEditImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#FFFFFF] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-3 py-2 text-xs text-[#111827] outline-none"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={savingEditProduct}
                  className="flex-1 py-3 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-2xl text-xs shadow-md transition-all cursor-pointer"
                >
                  {savingEditProduct ? 'Saving Changes...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-5 py-3 bg-[#FFFFFF] text-[#4B5563] font-bold text-xs rounded-2xl border border-[#D1D5DB] cursor-pointer"
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
          <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #4C1D95', paddingBottom: '8px', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, color: '#4C1D95', fontSize: '16px', fontWeight: 900 }}>🍰 CakeFlow AI Bakery</h2>
            <div style={{ fontSize: '10px', color: '#4B5563', fontWeight: 600 }}>Madurai Branch • Counter C02</div>
            <div style={{ fontSize: '10px', color: '#4B5563', fontWeight: 600 }}>GSTIN: 33AAAAA0000A1Z5</div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#4C1D95', marginTop: '4px' }}>TAX INVOICE RECEIPT</div>
          </div>

          <div style={{ background: '#E6F4EA', border: '1px solid #CEEAD6', color: '#137333', padding: '6px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>✓ PAYMENT SUCCESSFUL</span>
            <span>Paid via {printTargetOrder.paymentMethod || 'Cash'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '10px', borderBottom: '1px dashed #D1D5DB', paddingBottom: '6px', marginBottom: '8px' }}>
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

          <div style={{ borderBottom: '1px dashed #D1D5DB', paddingBottom: '6px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', paddingBottom: '3px', marginBottom: '5px' }}>
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
                    <div style={{ fontSize: '9px', color: '#4C1D95', marginTop: '1px' }}>📌 Note: "{item.instructions}"</div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '10px', borderBottom: '1px dashed #D1D5DB', paddingBottom: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#4B5563' }}>
              <span>Subtotal:</span>
              <span>₹{(printTargetOrder.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#4B5563' }}>
              <span>CGST ({(gstRate / 2).toFixed(1)}%):</span>
              <span>₹{((printTargetOrder.totalAmount || 0) * (gstRate / 200)).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#4B5563' }}>
              <span>SGST ({(gstRate / 2).toFixed(1)}%):</span>
              <span>₹{((printTargetOrder.totalAmount || 0) * (gstRate / 200)).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900, color: '#4C1D95', borderTop: '1.5px dashed #4C1D95', paddingTop: '6px', marginTop: '4px' }}>
              <span>GRAND TOTAL:</span>
              <span>₹{((printTargetOrder.totalAmount || 0) * (1 + gstRate / 100)).toFixed(2)}</span>
            </div>
          </div>

          <div style={{ background: '#FEF7E0', border: '1px solid #FDE293', borderRadius: '8px', padding: '6px 8px', fontSize: '9.5px', color: '#B06000', marginBottom: '8px' }}>
            <b>🎉 You Earned +{Math.floor((printTargetOrder.totalAmount || 0) * 0.1)} Cake Points!</b><br />
            Coupon: <b>CAKE20</b> (20% OFF Next Visit)
          </div>

          <div style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 800, color: '#000' }}>
            <div>Thank you! Visit again!</div>
            <div style={{ fontSize: '9.5px', fontWeight: 700, marginTop: '3px' }}>😄 Software Developed By Murugan Solution 😄</div>
          </div>
        </div>
      )}
    </div>
  );
};

export { AdminView as DashboardView };

