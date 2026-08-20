import React, { useState, useEffect } from 'react';
import { authApi, tableApi } from '../services/api';
import { User } from '../types';
import { ChefHat, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tablesList, setTablesList] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  useEffect(() => {
    // Dynamically fetch all created tables from backend
    tableApi.getAll()
      .then((tables: any[]) => {
        const tableNums = tables?.length ? tables.map((t: any) => Number(t.tableNumber)).sort((a: number, b: number) => a - b) : [1, 2, 3, 4, 5, 6, 7];
        setTablesList(tableNums);
      })
      .catch(err => {
        console.error('Failed to load tables list for login view:', err);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await authApi.login(username, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Quick login helper for demo purposes
  const quickLogin = async (role: 'admin' | 'cake_chef' | 'snacks_chef' | 'waiter' | 'customer', tableNum = 1) => {
    setError('');
    setLoading(true);
    try {
      if (role === 'customer') {
        const customerUser: User = {
          id: `customer_table_${tableNum}`,
          username: `Table ${tableNum} Guest`,
          role: 'customer'
        };
        localStorage.setItem('cakeflow_token', 'mock_customer_token');
        localStorage.setItem('cakeflow_user', JSON.stringify(customerUser));
        onLoginSuccess(customerUser);
      } else {
        let defaultUsername = '';
        let defaultPassword = 'chef123';

        if (role === 'admin') {
          defaultUsername = 'admin';
          defaultPassword = 'admin123';
        } else if (role === 'cake_chef') {
          defaultUsername = 'cakechef';
        } else if (role === 'snacks_chef') {
          defaultUsername = 'snackschef';
        }

        const user = await authApi.login(defaultUsername, defaultPassword);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Quick login failed. Make sure DB is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1E1818] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Soft warm light overlays */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[55%] rounded-full bg-[#CD0D0D]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[55%] rounded-full bg-[#D0C0C0]/40 blur-[130px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-white border border-[#D0C0C0] p-5 sm:p-8 rounded-3xl shadow-xl z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#CD0D0D] text-white shadow-lg shadow-[#CD0D0D]/25 mb-3.5">
            <Sparkles size={28} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#CD0D0D]">
            CakeFlow AI
          </h1>
          <p className="text-xs text-[#6E6262] font-semibold mt-1">Smart Bakery & Food Court Management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-[#CD0D0D]/10 border border-[#CD0D0D]/30 text-[#CD0D0D] text-xs font-semibold flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">Username</label>
            <input
              id="username"
              name="username"
              data-testid="username"
              type="text"
              required
              className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors text-[#1E1818]"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider mb-1.5">Password</label>
            <input
              id="password"
              name="password"
              data-testid="password"
              type="password"
              required
              className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors text-[#1E1818]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            id="loginBtn"
            name="loginBtn"
            data-testid="loginBtn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold rounded-xl text-sm transition-all flex justify-center items-center gap-2 shadow-lg shadow-[#CD0D0D]/25 cursor-pointer active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#D0C0C0]"></div>
          </div>
          <div className="relative flex justify-center text-[11px] font-bold uppercase tracking-wider">
            <span className="bg-white px-3 text-[#6E6262]">Quick Role Access</span>
          </div>
        </div>

        {/* Quick Login Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => quickLogin('admin')}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F8] border border-[#D0C0C0] hover:border-[#CD0D0D] text-left transition-all cursor-pointer group shadow-sm"
          >
            <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D] group-hover:bg-[#CD0D0D] group-hover:text-white transition-colors">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#1E1818]">Admin</p>
              <p className="text-[10px] text-[#6E6262]">Analytics & Billing</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('cake_chef')}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F8] border border-[#D0C0C0] hover:border-[#CD0D0D] text-left transition-all cursor-pointer group shadow-sm"
          >
            <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D] group-hover:bg-[#CD0D0D] group-hover:text-white transition-colors">
              <ChefHat size={16} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#1E1818]">Chef Kitchen</p>
              <p className="text-[10px] text-[#6E6262]">Live Order Board</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('customer', 1)}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F8] border border-[#D0C0C0] hover:border-[#CD0D0D] text-left transition-all cursor-pointer group shadow-sm col-span-2"
          >
            <div className="p-2 rounded-xl bg-[#CD0D0D]/10 text-[#CD0D0D] group-hover:bg-[#CD0D0D] group-hover:text-white transition-colors">
              <UserCheck size={16} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#1E1818]">Customer Menu View</p>
              <p className="text-[10px] text-[#6E6262]">Table 1 Live Ordering</p>
            </div>
          </button>
        </div>

        {/* Dynamic Table Logins Bar */}
        <div className="mt-6 flex flex-col items-center gap-2 text-[10px] text-[#6E6262]">
          <span className="font-bold text-[#1E1818] uppercase tracking-wider">Customer Table Logins ({tablesList.length} Tables):</span>
          <div className="flex flex-wrap justify-center gap-2 max-h-24 overflow-y-auto pr-1">
            {tablesList.map(num => (
              <button
                key={num}
                onClick={() => quickLogin('customer', num)}
                className="px-3 py-1.5 bg-[#FAF8F8] border border-[#D0C0C0] hover:border-[#CD0D0D] hover:bg-[#CD0D0D] hover:text-white rounded-xl font-extrabold text-[#1E1818] transition-all cursor-pointer shadow-sm"
              >
                Table {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
