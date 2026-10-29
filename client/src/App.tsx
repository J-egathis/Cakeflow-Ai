import { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';
import { User } from './types';
import { authApi } from './services/api';
import { LoginView } from './views/LoginView';
import { CustomerView } from './views/CustomerView';
import { ReceiptView } from './views/ReceiptView';
import { ChefView } from './views/ChefView';
import { AdminView } from './views/AdminView';
import { BillingView } from './views/BillingView';
import { OrdersView } from './views/OrdersView';

// Dedicated Wrapper Component for /table/:tableId route (QR Scan Mode)
function CustomerTableWrapper() {
  const { tableId } = useParams<{ tableId: string }>();
  const tableNumber = parseInt(tableId || '1') || 1;

  const tableUser: User = {
    id: `table_guest_${tableNumber}`,
    username: `Table ${tableNumber} Guest`,
    role: 'customer',
    tableNumber: tableNumber
  };

  return (
    <CustomerView 
      user={tableUser}
      isQrMode={true}
      onLogout={() => {
        window.location.href = '/login';
      }} 
    />
  );
}

// Wrapper for Protected Routes
function ProtectedRoute({ element: Element, allowedRoles }: { element: any, allowedRoles?: string[] }) {
  const user = authApi.getCurrentUser();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'admin') {
    if (user.role === 'cake_chef' || user.role === 'snacks_chef') return <Navigate to="/chef" replace />;
    if (user.role === 'customer') return <Navigate to="/customer" replace />;
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  return <Element user={user} onLogout={handleLogout} />;
}

// Redirects root to appropriate dashboard
function RootRedirect() {
  const user = authApi.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin' || user.role === 'cashier' || user.role === 'waiter') return <Navigate to="/admin" replace />;
  if (user.role === 'cake_chef' || user.role === 'snacks_chef') return <Navigate to="/chef" replace />;
  return <Navigate to="/customer" replace />;
}

function App() {
  const navigate = useNavigate();

  const handleLoginSuccess = (user: User) => {
    if (user.role === 'admin' || user.role === 'cashier' || user.role === 'waiter') navigate('/admin');
    else if (user.role === 'cake_chef' || user.role === 'snacks_chef') navigate('/chef');
    else navigate('/customer');
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginView onLoginSuccess={handleLoginSuccess} />} />
      <Route path="/table/:tableId" element={<CustomerTableWrapper />} />
      
      {/* Protected Routes */}
      <Route path="/admin" element={<ProtectedRoute element={AdminView} />} />
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      
      <Route path="/chef" element={<ProtectedRoute element={ChefView} allowedRoles={['cake_chef', 'snacks_chef']} />} />
      <Route path="/kitchen" element={<Navigate to="/chef" replace />} />
      
      <Route path="/receipt/:orderId" element={<ReceiptView />} />
      <Route path="/customer" element={<ProtectedRoute element={CustomerView} />} />
      <Route path="/billing" element={<ProtectedRoute element={BillingView} />} />
      <Route path="/orders" element={<ProtectedRoute element={OrdersView} />} />

      {/* Root & Fallback */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default App;
