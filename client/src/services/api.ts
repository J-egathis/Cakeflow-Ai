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
  create: (orderData: { tableNumber: number; customerName: string; items: any[]; totalAmount: number }) => {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },
  getAll: (filters: { status?: string; tableNumber?: number; category?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tableNumber) params.append('tableNumber', String(filters.tableNumber));
    if (filters.category) params.append('category', filters.category);
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
  closeTable: (id: string, paymentMethod?: string) => {
    return request(`/orders/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod })
    });
  },
  remove: (id: string) => {
    return request(`/orders/${id}`, {
      method: 'DELETE'
    });
  }
};

// Inventory Services
export const inventoryApi = {
  getAll: () => {
    return request('/inventory');
  },
  create: (itemData: { name: string; quantity: number; unit: string; minThreshold: number }) => {
    return request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },
  update: (id: string, quantity: number) => {
    return request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
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
  getDashboard: (dateFilter: string = 'today') => {
    return request(`/analytics?dateFilter=${dateFilter}`);
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
  createTable: (tableData: { tableNumber: number; capacity?: number }) => {
    return request('/tables', {
      method: 'POST',
      body: JSON.stringify(tableData)
    });
  }
};

// Socket.io Client Setup
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(BASE_URL);
  }
  return socket;
};
