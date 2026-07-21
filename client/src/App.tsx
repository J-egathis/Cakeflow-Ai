import { useState, useEffect } from 'react';
import { User } from './types';
import { authApi } from './services/api';
import { LoginView } from './views/LoginView';
import { CustomerView } from './views/CustomerView';
import { ChefView } from './views/ChefView';
import { WaiterView } from './views/WaiterView';
import { CashierView } from './views/CashierView';
import { AdminView } from './views/AdminView';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for QR code URL table parameter: /table/1, /table/2 or ?table=1
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    let detectedTableNumber: number | null = null;

    if (path.includes('/table/')) {
      const parts = path.split('/table/');
      if (parts[1]) {
        const num = parseInt(parts[1]);
        if (!isNaN(num) && num > 0) {
          detectedTableNumber = num;
        }
      }
    } else if (searchParams.get('table')) {
      const num = parseInt(searchParams.get('table') || '');
      if (!isNaN(num) && num > 0) {
        detectedTableNumber = num;
      }
    }

    if (detectedTableNumber) {
      const tableUser: User = {
        id: `table_guest_${detectedTableNumber}`,
        username: `Table ${detectedTableNumber} Guest`,
        role: 'customer',
        tableNumber: detectedTableNumber
      };
      setCurrentUser(tableUser);
      localStorage.setItem('cakeflow_user', JSON.stringify(tableUser));
      return;
    }

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

export default App;
