import { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { User } from './types';
import { authApi } from './services/api';
import { LoginView } from './views/LoginView';
import { CustomerView } from './views/CustomerView';
import { ChefView } from './views/ChefView';
import { WaiterView } from './views/WaiterView';
import { CashierView } from './views/CashierView';
import { AdminView } from './views/AdminView';

// Dedicated Wrapper Component for /table/:tableId route
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
      onLogout={() => {
        window.location.href = '/';
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
      return <WaiterView user={currentUser} onLogout={handleLogout} />;
    case 'cashier':
      return <CashierView user={currentUser} onLogout={handleLogout} />;
    case 'customer':
      return <CustomerView user={currentUser} onLogout={handleLogout} />;
    default:
      return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }
}

function App() {
  return (
    <Routes>
      <Route path="/table/:tableId" element={<CustomerTableWrapper />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
}

export default App;
