import { io, Socket } from 'socket.io-client';

// Determine Backend URL dynamically
const RENDER_BACKEND_URL = 'https://cakeflow-ai-1.onrender.com';
export const BASE_URL = import.meta.env.VITE_BACKEND_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : (window.location.origin.includes('onrender.com') ? window.location.origin : RENDER_BACKEND_URL)
);
export const API_URL = `${BASE_URL}/api`;

// Fetch wrapper with JWT injection
const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('cakeflow_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
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
    const userStr = localStorage.getItem('cakeflow_user');
    return userStr ? JSON.parse(userStr) : null;
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
  closeTable: (id: string) => {
    return request(`/orders/${id}/close`, {
      method: 'POST'
    });
  }
};

// Inventory Services
export const inventoryApi = {
  getAll: () => {
    return request('/inventory');
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
  getDashboard: () => {
    return request('/analytics');
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
