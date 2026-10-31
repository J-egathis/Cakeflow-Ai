import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';
import { User } from './types';
import { authApi } from './services/api';
import { LoginView } from './views/LoginView';

// Code-split heavy screens: each page downloads only its own code (QR menu & chef open much faster)
const CustomerView = lazy(() => import('./views/CustomerView').then(m => ({ default: m.CustomerView })));
const ReceiptView = lazy(() => import('./views/ReceiptView').then(m => ({ default: m.ReceiptView })));
const ChefView = lazy(() => import('./views/ChefView').then(m => ({ default: m.ChefView })));
const AdminView = lazy(() => import('./views/AdminView').then(m => ({ default: m.AdminView })));
const BillingView = lazy(() => import('./views/BillingView').then(m => ({ default: m.BillingView })));
const OrdersView = lazy(() => import('./views/OrdersView').then(m => ({ default: m.OrdersView })));

// Warm up the most-used screen for the logged-in role in the background
try {
  const cachedUser = authApi.getCurrentUser();
  if (cachedUser?.role === 'admin' || cachedUser?.role === 'cashier' || cachedUser?.role === 'waiter') {
    import('./views/AdminView');
  } else if (cachedUser?.role === 'cake_chef' || cachedUser?.role === 'snacks_chef') {
    import('./views/ChefView');
  }
} catch (e) {}

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-10 h-10 rounded-full border-4 border-[#4C1D95]/20 border-t-[#4C1D95] animate-spin" />
  </div>
);

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
    if (user.role === 'cashier') return <Navigate to="/billing" replace />;
    return <Navigate to="/customer" replace />;
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
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'cashier') return <Navigate to="/billing" replace />;
  if (user.role === 'cake_chef' || user.role === 'snacks_chef') return <Navigate to="/chef" replace />;
  return <Navigate to="/customer" replace />;
}

function App() {
  const navigate = useNavigate();

  const handleLoginSuccess = (user: User) => {
    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'cashier') navigate('/billing');
    else if (user.role === 'cake_chef' || user.role === 'snacks_chef') navigate('/chef');
    else navigate('/customer');
  };

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<LoginView onLoginSuccess={handleLoginSuccess} />} />
      <Route path="/table/:tableId" element={<CustomerTableWrapper />} />
      
      {/* Protected Routes */}
      <Route path="/admin" element={<ProtectedRoute element={AdminView} allowedRoles={['admin']} />} />
      <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      
      <Route path="/chef" element={<ProtectedRoute element={ChefView} allowedRoles={['cake_chef', 'snacks_chef']} />} />
      <Route path="/kitchen" element={<Navigate to="/chef" replace />} />
      
      <Route path="/receipt/:orderId" element={<ReceiptView />} />
      <Route path="/customer" element={<ProtectedRoute element={CustomerView} allowedRoles={['customer', 'waiter']} />} />
      <Route path="/billing" element={<ProtectedRoute element={BillingView} allowedRoles={['admin', 'cashier']} />} />
      <Route path="/orders" element={<ProtectedRoute element={OrdersView} allowedRoles={['admin', 'cashier']} />} />

      {/* Root & Fallback */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
    </Suspense>
  );
}

export default App;
