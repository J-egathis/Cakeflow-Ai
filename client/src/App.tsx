import { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { User } from './types';
import { authApi } from './services/api';
import { LoginView } from './views/LoginView';
import { CustomerView } from './views/CustomerView';
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

function MainApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const user = authApi.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    authApi.logout();
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Render view based on role
  switch (currentUser.role) {
    case 'admin':
      return <AdminView user={currentUser} onLogout={handleLogout} />;
    case 'cake_chef':
    case 'snacks_chef':
      return <ChefView user={currentUser as any} onLogout={handleLogout} />;
    case 'waiter':
    case 'cashier':
      return <AdminView user={currentUser} onLogout={handleLogout} />;
    case 'customer':
      return <CustomerView user={currentUser} onLogout={handleLogout} />;
    default:
      return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }
}

function App() {
  const navigate = useNavigate();

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const handleLoginSuccess = (user: User) => {
    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'cake_chef' || user.role === 'snacks_chef') navigate('/chef');
    else navigate('/customer');
  };

  const mockAdminUser: User = { id: 'admin_1', username: 'admin', role: 'admin' };
  const mockChefUser: User = { id: 'chef_1', username: 'cakechef', role: 'cake_chef' };
  const mockCustomerUser: User = { id: 'customer_1', username: 'Table 1 Guest', role: 'customer', tableNumber: 1 };

  return (
    <Routes>
      {/* 🌐 DIRECT URL ROUTES FOR SELENIUM AUTOMATION & DEEP LINKING */}
      <Route path="/admin" element={<AdminView user={mockAdminUser} onLogout={handleLogout} />} />
      <Route path="/dashboard" element={<AdminView user={mockAdminUser} onLogout={handleLogout} />} />
      <Route path="/chef" element={<ChefView user={mockChefUser as any} onLogout={handleLogout} />} />
      <Route path="/kitchen" element={<ChefView user={mockChefUser as any} onLogout={handleLogout} />} />
      <Route path="/customer" element={<CustomerView user={mockCustomerUser} onLogout={handleLogout} />} />
      <Route path="/billing" element={<BillingView onLogout={handleLogout} />} />
      <Route path="/orders" element={<OrdersView user={mockAdminUser} onLogout={handleLogout} />} />
      <Route path="/login" element={<LoginView onLoginSuccess={handleLoginSuccess} />} />
      
      {/* QR Code Table Scanning Route */}
      <Route path="/table/:tableId" element={<CustomerTableWrapper />} />

      {/* Main App Fallback Route */}
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
}

export default App;
