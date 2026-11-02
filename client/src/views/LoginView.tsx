import React, { useState, useEffect } from 'react';
import { authApi, tableApi } from '../services/api';
import { User } from '../types';
import { ShieldAlert, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      authApi.logout();
      const user = await authApi.login(username.trim(), password.trim());
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
      setLoading(false);
    }
  };

  // Quick login helper for table buttons
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
        sessionStorage.setItem('cakeflow_token', 'mock_customer_token');
        sessionStorage.setItem('cakeflow_user', JSON.stringify(customerUser));
        setTimeout(() => onLoginSuccess(customerUser), 600);
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
        setTimeout(() => onLoginSuccess(user), 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#111827] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Soft warm light overlays */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[55%] rounded-full bg-[#4C1D95]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[55%] rounded-full bg-[#D1D5DB]/40 blur-[130px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-white border border-[#D1D5DB] p-5 sm:p-8 rounded-3xl shadow-xl z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#4C1D95] text-white shadow-lg shadow-[#4C1D95]/25 mb-3.5">
            <Sparkles size={28} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#4C1D95]">
            VPN Restaurant
          </h1>
          <p className="text-xs text-[#4B5563] font-semibold mt-1">Smart Bakery & Food Court Management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-[#4C1D95]/10 border border-[#4C1D95]/30 text-[#4C1D95] text-xs font-semibold flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">Username</label>
            <input
              id="username"
              name="username"
              data-testid="username"
              type="text"
              required
              className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors text-[#111827]"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                data-testid="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none transition-colors text-[#111827]"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-lg leading-none select-none transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
                aria-label={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? '🐵' : '🙈'}
              </button>
            </div>
          </div>

          <button
            id="loginBtn"
            name="loginBtn"
            data-testid="loginBtn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold rounded-xl text-sm transition-all flex justify-center items-center gap-2 shadow-lg shadow-[#4C1D95]/25 cursor-pointer active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Dynamic Table Logins Bar */}
        <div className="mt-6 flex flex-col items-center gap-2 text-[10px] text-[#4B5563]">
          <span className="font-bold text-[#111827] uppercase tracking-wider">Customer Table Logins ({tablesList.length} Tables):</span>
          <div className="flex flex-wrap justify-center gap-2 max-h-24 overflow-y-auto pr-1">
            {tablesList.map(num => (
              <button
                key={num}
                onClick={() => quickLogin('customer', num)}
                className="px-3 py-1.5 bg-[#F9FAFB] border border-[#D1D5DB] hover:border-[#4C1D95] hover:bg-[#4C1D95] hover:text-white rounded-xl font-extrabold text-[#111827] transition-all cursor-pointer shadow-sm"
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
