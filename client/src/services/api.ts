import { io, Socket } from 'socket.io-client';

// Determine Backend URL dynamically
// - On Render production: use Render origin
// - On phone via LAN (192.168.x.x:5173): use window.location.origin so Vite proxy forwards /api → localhost:5000
// - On localhost dev: use localhost:5000 directly
const RENDER_BACKEND_URL = 'https://cakeflow-ai-1.onrender.com';
export const BASE_URL = import.meta.env.VITE_BACKEND_URL || (
  window.location.origin.includes('onrender.com')
    ? window.location.origin
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5001'
        : window.location.origin)   // LAN IP (e.g. 192.168.x.x:5173) — Vite proxies /api & /socket.io
);
export const API_URL = `${BASE_URL}/api`;

// Fetch wrapper with JWT injection & retry resilience
const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('cakeflow_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      if (response.status === 401 && token) {
        // Staff token expired / invalid (e.g. after JWT_SECRET change): force a fresh login
        localStorage.removeItem('cakeflow_token');
        localStorage.removeItem('cakeflow_user');
        const path = window.location.pathname;
        if (!path.startsWith('/login') && !path.startsWith('/table/') && !path.startsWith('/receipt/')) {
          window.location.href = '/login';
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message?.includes('Failed to fetch')) {
      // Retry once after 600ms if server was momentarily restarting
      await new Promise(r => setTimeout(r, 600));
      try {
        const retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers
        });
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new Error(errorData.message || `Request failed with status ${retryResponse.status}`);
        }
        return await retryResponse.json();
      } catch (retryErr: any) {
        throw new Error(retryErr.message || 'Network error, please check connection.');
      }
    }
    throw err;
  }
};

// Authentication Services
export const authApi = {
  login: async (username: string, password: string) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('cakeflow_token', data.token);
    localStorage.setItem('cakeflow_user', JSON.stringify(data.user));
    return data.user;
  },
  logout: () => {
    localStorage.removeItem('cakeflow_token');
    localStorage.removeItem('cakeflow_user');
  },
  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('cakeflow_user');
      return (userStr && userStr !== 'undefined') ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse cached user:', e);
      localStorage.removeItem('cakeflow_user');
      localStorage.removeItem('cakeflow_token');
      return null;
    }
  }
};

// Product Services
export const productApi = {
  getAll: (filters: { category?: string; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    return request(`/products?${params.toString()}`);
  },
  create: (productData: any) => {
    return request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },
  update: (id: string, productData: any) => {
    return request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  },
  delete: (id: string) => {
    return request(`/products/${id}`, {
      method: 'DELETE'
    });
  }
};

// Order Services
export const orderApi = {
  create: (orderData: { tableNumber: number; customerName: string; items: any[]; totalAmount: number; mealType?: string }) => {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },
  getAll: (filters: { status?: string; tableNumber?: number; category?: string; timeframe?: string; paymentStatus?: string; mealType?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.mealType) params.append('mealType', filters.mealType);
    if (filters.tableNumber) params.append('tableNumber', String(filters.tableNumber));
    if (filters.category) params.append('category', filters.category);
    if (filters.timeframe) params.append('timeframe', filters.timeframe);
    return request(`/orders?${params.toString()}`);
  },
  getTableActiveOrders: (tableNumber: number) => {
    return request(`/orders/table/${tableNumber}`);
  },
  update: (id: string, updateData: any) => {
    return request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },
  closeTable: (id: string, paymentMethod?: string, gstRate?: number) => {
    return request(`/orders/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, gstRate })
    });
  },
  remove: (id: string, permanent: boolean = true) => {
    return request(`/orders/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE'
    });
  },
  bulkRemove: (orderIds: string[]) => {
    return request('/orders/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ orderIds })
    });
  }
};

// Inventory Services
export const inventoryApi = {
  getAll: () => {
    return request('/inventory');
  },
  create: (itemData: any) => {
    return request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },
  update: (id: string, updateData: any) => {
    const payload = typeof updateData === 'number' ? { quantity: updateData } : updateData;
    return request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  remove: (id: string) => {
    return request(`/inventory/${id}`, {
      method: 'DELETE'
    });
  },
  refill: () => {
    return request('/inventory/refill', {
      method: 'POST'
    });
  }
};

// Analytics Services
export const analyticsApi = {
  getDashboard: (dateFilter: string = 'today', startDate?: string, endDate?: string) => {
    let url = `/analytics?dateFilter=${dateFilter}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return request(url);
  }
};

// Accounts & Finance Services
export const accountsApi = {
  getSummary: (dateFilter: string = 'today', startDate?: string, endDate?: string, gstRate?: number) => {
    const params = new URLSearchParams({ dateFilter });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (gstRate !== undefined) params.append('gstRate', String(gstRate));
    return request(`/accounts?${params.toString()}`);
  },
  addExpense: (expenseData: { title: string; category: string; amount: number; paymentMode: string; notes?: string; expenseDate?: string }) => {
    return request('/accounts/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  },
  updateExpense: (id: string, expenseData: any) => {
    return request(`/accounts/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData)
    });
  },
  deleteExpense: (id: string) => {
    return request(`/accounts/expenses/${id}`, {
      method: 'DELETE'
    });
  }
};

// Smart Table & QR Code Services
export const tableApi = {
  getAll: () => {
    return request('/tables');
  },
  getByNumber: (tableNumber: number) => {
    return request(`/tables/${tableNumber}`);
  },
  updateStatus: (tableNumber: number, data: { status?: string; customerCount?: number; waiterAssigned?: string; paymentStatus?: string }) => {
    return request(`/tables/${tableNumber}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  regenerateQr: (tableNumber: number) => {
    return request(`/tables/${tableNumber}/regenerate-qr`, {
      method: 'POST'
    });
  },
  createTable: (tableData: { tableNumber: number; capacity?: number; customerCount?: number }) => {
    return request('/tables', {
      method: 'POST',
      body: JSON.stringify(tableData)
    });
  },
  deleteTable: (tableNumber: number) => {
    return request(`/tables/${tableNumber}`, {
      method: 'DELETE'
    });
  },
  bulkDeleteTables: (tableNumbers: number[]) => {
    return request('/tables/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ tableNumbers })
    });
  }
};

// System Settings & Categories Services
export const systemApi = {
  getGst: () => {
    return request('/system/gst');
  },
  updateGst: (gstRate: number) => {
    return request('/system/gst', {
      method: 'PUT',
      body: JSON.stringify({ gstRate })
    });
  },
  getCategories: () => {
    return request('/system/categories');
  },
  updateCategories: (data: { categories?: string[]; subCategoriesMap: Record<string, string[]> }) => {
    return request('/system/categories', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};

// Socket.io Client Setup
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionAttempts: 10
    });
  }
  return socket;
};

const DEFAULT_MEALS = ['Breakfast', 'Lunch', 'Dinner'];
const LS_MEALS_KEY = 'cakeflow_meal_categories';
const LS_HIDDEN_MEALS_KEY = 'cakeflow_hidden_meals';
const LS_CAT_MEAL_MAP_KEY = 'cakeflow_category_meal_map';

const getLocalMealStore = () => {
  try {
    const rawMeals = localStorage.getItem(LS_MEALS_KEY);
    const rawHidden = localStorage.getItem(LS_HIDDEN_MEALS_KEY);
    const rawMap = localStorage.getItem(LS_CAT_MEAL_MAP_KEY);
    const mealCategories: string[] = rawMeals ? JSON.parse(rawMeals) : [...DEFAULT_MEALS];
    const hiddenMealCategories: string[] = rawHidden ? JSON.parse(rawHidden) : [];
    const categoryMealMap: Record<string, string> = rawMap ? JSON.parse(rawMap) : {};
    return {
      mealCategories: Array.isArray(mealCategories) && mealCategories.length > 0 ? mealCategories : [...DEFAULT_MEALS],
      hiddenMealCategories: Array.isArray(hiddenMealCategories) ? hiddenMealCategories : [],
      categoryMealMap: categoryMealMap && typeof categoryMealMap === 'object' ? categoryMealMap : {}
    };
  } catch {
    return {
      mealCategories: [...DEFAULT_MEALS],
      hiddenMealCategories: [] as string[],
      categoryMealMap: {} as Record<string, string>
    };
  }
};

const saveLocalMealStore = (store: { mealCategories?: string[]; hiddenMealCategories?: string[]; categoryMealMap?: Record<string, string> }) => {
  try {
    if (store.mealCategories) localStorage.setItem(LS_MEALS_KEY, JSON.stringify(store.mealCategories));
    if (store.hiddenMealCategories) localStorage.setItem(LS_HIDDEN_MEALS_KEY, JSON.stringify(store.hiddenMealCategories));
    if (store.categoryMealMap) localStorage.setItem(LS_CAT_MEAL_MAP_KEY, JSON.stringify(store.categoryMealMap));
  } catch {}
};

export const categoryApi = {
  getMetas: async () => {
    const metas = await request('/categories');
    const store = getLocalMealStore();
    let products: any[] = [];
    const needsFallbackMeal = Array.isArray(metas) && metas.some((m: any) => !m.mealType);
    if (needsFallbackMeal) {
      try {
        products = await productApi.getAll();
      } catch {}
    }
    return (Array.isArray(metas) ? metas : []).map((m: any) => {
      let mealType = store.categoryMealMap[m.name] || m.mealType;
      if (!mealType && products.length > 0) {
        const matchingProd = products.find((p: any) => p.category === m.name && p.mealType);
        if (matchingProd) mealType = matchingProd.mealType;
      }
      return {
        ...m,
        mealType: mealType || 'Lunch'
      };
    });
  },
  updateImage: (name: string, image: string, mealType?: string) => {
    if (mealType) {
      const store = getLocalMealStore();
      store.categoryMealMap[name] = mealType;
      saveLocalMealStore({ categoryMealMap: store.categoryMealMap });
    }
    return request('/categories', { method: 'POST', body: JSON.stringify({ name, image, mealType }) });
  },
  updateMeta: async (oldName: string, data: any) => {
    const store = getLocalMealStore();
    const targetName = data.newName ? data.newName.trim() : oldName;
    if (data.newName && data.newName.trim() !== oldName) {
      if (store.categoryMealMap[oldName]) {
        store.categoryMealMap[targetName] = store.categoryMealMap[oldName];
        delete store.categoryMealMap[oldName];
      }
    }
    if (data.mealType) {
      store.categoryMealMap[targetName] = data.mealType;
    }
    saveLocalMealStore({ categoryMealMap: store.categoryMealMap });

    const res = await request(`/categories/${encodeURIComponent(oldName)}`, { method: 'PUT', body: JSON.stringify(data) });

    if (data.mealType) {
      try {
        const allProducts = await productApi.getAll();
        const catProducts = (Array.isArray(allProducts) ? allProducts : []).filter(
          (p: any) => p.category === targetName && p.mealType !== data.mealType
        );
        await Promise.all(catProducts.map((p: any) => productApi.update(String(p.id || p._id), { mealType: data.mealType })));
      } catch {}
    }
    window.dispatchEvent(new Event('mealCategoriesUpdated'));
    return res;
  },
  deleteMeta: (name: string) => {
    const store = getLocalMealStore();
    if (store.categoryMealMap[name]) {
      delete store.categoryMealMap[name];
      saveLocalMealStore({ categoryMealMap: store.categoryMealMap });
    }
    return request(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
  getMeals: async (): Promise<Array<{ name: string; isHidden: boolean }>> => {
    const store = getLocalMealStore();
    try {
      const serverMeals = await request('/categories/meals');
      const items = Array.isArray(serverMeals)
        ? serverMeals
        : Array.isArray(serverMeals?.items)
          ? serverMeals.items
          : Array.isArray(serverMeals?.mealCategories)
            ? serverMeals.mealCategories.map((name: string) => ({
                name,
                isHidden: Array.isArray(serverMeals?.hiddenMealCategories) && serverMeals.hiddenMealCategories.includes(name)
              }))
            : [];
      if (items.length > 0) {
        const mealNames = items.map((m: any) => m.name).filter(Boolean);
        const hiddenNames = items.filter((m: any) => m.isHidden).map((m: any) => m.name);
        saveLocalMealStore({
          mealCategories: mealNames,
          hiddenMealCategories: hiddenNames
        });
        return items.map((m: any) => ({ name: m.name, isHidden: Boolean(m.isHidden) }));
      }
    } catch {
      try {
        const products = await productApi.getAll();
        let changed = false;
        (Array.isArray(products) ? products : []).forEach((p: any) => {
          if (p.mealType && !store.mealCategories.includes(p.mealType)) {
            store.mealCategories.push(p.mealType);
            changed = true;
          }
        });
        if (changed) saveLocalMealStore({ mealCategories: store.mealCategories });
      } catch {}
    }
    return store.mealCategories.map(name => ({
      name,
      isHidden: store.hiddenMealCategories.includes(name)
    }));
  },
  addMeal: async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const store = getLocalMealStore();
    if (!store.mealCategories.some(m => m.toLowerCase() === clean.toLowerCase())) {
      store.mealCategories.push(clean);
    }
    store.hiddenMealCategories = store.hiddenMealCategories.filter(m => m.toLowerCase() !== clean.toLowerCase());
    saveLocalMealStore({
      mealCategories: store.mealCategories,
      hiddenMealCategories: store.hiddenMealCategories
    });
    try {
      await request('/categories/meals', { method: 'POST', body: JSON.stringify({ name: clean }) });
    } catch {}
    window.dispatchEvent(new Event('mealCategoriesUpdated'));
    return { name: clean, isHidden: false };
  },
  updateMeal: async (oldName: string, data: { newName?: string; isHidden?: boolean }) => {
    const store = getLocalMealStore();
    const cleanNew = data.newName ? data.newName.trim() : oldName;

    if (cleanNew && cleanNew !== oldName) {
      store.mealCategories = store.mealCategories.map(m => (m === oldName ? cleanNew : m));
      store.hiddenMealCategories = store.hiddenMealCategories.map(m => (m === oldName ? cleanNew : m));
      Object.keys(store.categoryMealMap).forEach(cat => {
        if (store.categoryMealMap[cat] === oldName) {
          store.categoryMealMap[cat] = cleanNew;
        }
      });
    }
    if (data.isHidden !== undefined) {
      const target = cleanNew || oldName;
      if (data.isHidden) {
        if (!store.hiddenMealCategories.includes(target)) store.hiddenMealCategories.push(target);
      } else {
        store.hiddenMealCategories = store.hiddenMealCategories.filter(m => m !== target);
      }
    }
    saveLocalMealStore(store);

    try {
      await request(`/categories/meals/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch {
      if (cleanNew && cleanNew !== oldName) {
        try {
          const allProducts = await productApi.getAll();
          const matching = (Array.isArray(allProducts) ? allProducts : []).filter((p: any) => p.mealType === oldName);
          await Promise.all(matching.map((p: any) => productApi.update(String(p.id || p._id), { mealType: cleanNew })));
        } catch {}
      }
    }
    window.dispatchEvent(new Event('mealCategoriesUpdated'));
    return { name: cleanNew, isHidden: store.hiddenMealCategories.includes(cleanNew) };
  },
  deleteMeal: async (name: string) => {
    const store = getLocalMealStore();
    store.mealCategories = store.mealCategories.filter(m => m !== name);
    store.hiddenMealCategories = store.hiddenMealCategories.filter(m => m !== name);
    Object.keys(store.categoryMealMap).forEach(cat => {
      if (store.categoryMealMap[cat] === name) {
        delete store.categoryMealMap[cat];
      }
    });
    saveLocalMealStore(store);

    try {
      await request(`/categories/meals/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch {}
    window.dispatchEvent(new Event('mealCategoriesUpdated'));
    return { success: true };
  },
  getTargets: async (): Promise<Record<string, { target: number; manualSold?: number | null; updatedAt?: string }>> => {
    try {
      const serverTargets = await request('/categories/targets');
      if (serverTargets && typeof serverTargets === 'object' && !Array.isArray(serverTargets)) {
        try {
          localStorage.setItem('cakeflow_daily_targets', JSON.stringify(serverTargets));
        } catch {}
        return serverTargets;
      }
    } catch {}
    try {
      const raw = localStorage.getItem('cakeflow_daily_targets');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  updateTarget: async (payload: { key?: string; target?: number; manualSold?: number | null; clear?: boolean; resetAll?: boolean }) => {
    try {
      const raw = localStorage.getItem('cakeflow_daily_targets');
      const current = raw ? JSON.parse(raw) : {};
      if (payload.resetAll) {
        localStorage.setItem('cakeflow_daily_targets', JSON.stringify({}));
      } else if (payload.key) {
        if (payload.clear) {
          delete current[payload.key];
        } else {
          current[payload.key] = {
            ...(current[payload.key] || {}),
            ...(payload.target !== undefined ? { target: Math.max(0, Number(payload.target) || 0) } : {}),
            ...(payload.manualSold !== undefined ? { manualSold: payload.manualSold === null ? null : Math.max(0, Number(payload.manualSold) || 0) } : {}),
            updatedAt: new Date().toISOString()
          };
        }
        localStorage.setItem('cakeflow_daily_targets', JSON.stringify(current));
      }
    } catch {}

    try {
      const updated = await request('/categories/targets', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (updated && typeof updated === 'object') {
        try {
          localStorage.setItem('cakeflow_daily_targets', JSON.stringify(updated));
        } catch {}
        return updated;
      }
    } catch {}
    try {
      const raw = localStorage.getItem('cakeflow_daily_targets');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  getUnsoldReports: async (): Promise<any[]> => {
    try {
      const res = await request('/categories/unsold-reports');
      if (Array.isArray(res)) {
        try {
          localStorage.setItem('cakeflow_unsold_reports', JSON.stringify(res));
        } catch {}
        return res;
      }
    } catch {}
    try {
      const raw = localStorage.getItem('cakeflow_unsold_reports');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  addUnsoldReport: async (data: {
    productId?: string | number | null;
    foodName: string;
    category?: string;
    mealType?: string;
    price?: number;
    unsoldQty: number;
    reportedBy?: string;
    note?: string;
  }) => {
    try {
      const created = await request('/categories/unsold-reports', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (created && created.id) {
        try {
          const raw = localStorage.getItem('cakeflow_unsold_reports');
          const prev = raw ? JSON.parse(raw) : [];
          localStorage.setItem('cakeflow_unsold_reports', JSON.stringify([created, ...prev]));
        } catch {}
        return created;
      }
    } catch {}
    const fallbackReport = {
      id: `unsold_${Date.now()}`,
      productId: data.productId || null,
      foodName: data.foodName.trim(),
      category: data.category || 'General',
      mealType: data.mealType || 'Breakfast',
      price: Number(data.price) || 0,
      unsoldQty: Math.max(1, Number(data.unsoldQty) || 1),
      reportedBy: data.reportedBy || 'Kitchen Chef',
      note: (data.note || '').trim(),
      createdAt: new Date().toISOString()
    };
    try {
      const raw = localStorage.getItem('cakeflow_unsold_reports');
      const prev = raw ? JSON.parse(raw) : [];
      localStorage.setItem('cakeflow_unsold_reports', JSON.stringify([fallbackReport, ...prev]));
    } catch {}
    return fallbackReport;
  },
  deleteUnsoldReport: async (id: string) => {
    try {
      const raw = localStorage.getItem('cakeflow_unsold_reports');
      const prev = raw ? JSON.parse(raw) : [];
      const next = id === 'all' ? [] : prev.filter((r: any) => r.id !== id);
      localStorage.setItem('cakeflow_unsold_reports', JSON.stringify(next));
    } catch {}
    try {
      return await request(`/categories/unsold-reports/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch {
      return { success: true };
    }
  }
};

