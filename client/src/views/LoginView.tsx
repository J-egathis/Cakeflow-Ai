import React, { useState } from 'react';
import { authApi } from '../services/api';
import { User } from '../types';
import { ChefHat, ClipboardList, ShieldAlert, Sparkles, Receipt, UserCheck } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
  const quickLogin = async (role: 'admin' | 'cake_chef' | 'snacks_chef' | 'waiter' | 'cashier' | 'customer', tableNum = 1) => {
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
        let defaultPassword = 'chef123'; // chefs

        if (role === 'admin') {
          defaultUsername = 'admin';
          defaultPassword = 'admin123';
        } else if (role === 'cake_chef') {
          defaultUsername = 'cakechef';
        } else if (role === 'snacks_chef') {
          defaultUsername = 'snackschef';
        } else if (role === 'waiter') {
          defaultUsername = 'waiter';
          defaultPassword = 'waiter123';
        } else if (role === 'cashier') {
          defaultUsername = 'cashier';
          defaultPassword = 'cashier123';
        }

        const user = await authApi.login(defaultUsername, defaultPassword);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Quick login failed. Make sure DB is running and seeded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-red-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-yellow-500/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-lg mb-4 animate-pulse">
            <Sparkles size={28} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-400 to-yellow-300">
            CakeFlow AI
          </h1>
          <p className="text-sm text-slate-400 mt-2">Real-Time Smart Cake & Snacks System</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              required
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-rose-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors text-slate-200"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-rose-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors text-slate-200"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-semibold rounded-xl text-sm hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-lg shadow-rose-500/20"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900/60 px-3 text-slate-500 backdrop-blur-xl">Quick Role Access</span>
          </div>
        </div>

        {/* Quick Login Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => quickLogin('admin')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-red-500/10 text-rose-400"><Sparkles size={16} /></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Admin</p>
              <p className="text-[10px] text-slate-500">Analytics & Stock</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('cake_chef')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400"><ChefHat size={16} /></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Cake Chef</p>
              <p className="text-[10px] text-slate-500">Baking Kitchen</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('snacks_chef')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><ChefHat size={16} /></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Snack Chef</p>
              <p className="text-[10px] text-slate-500">Salty Kitchen</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('waiter')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><ClipboardList size={16} /></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Waiter</p>
              <p className="text-[10px] text-slate-500">Floor Tables</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('cashier')}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Receipt size={16} /></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Cashier</p>
              <p className="text-[10px] text-slate-500">GST Bills & POS</p>
            </div>
          </button>

          <button
            onClick={() => quickLogin('customer', 1)}
            className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400"><UserCheck size={16} /></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Customer</p>
              <p className="text-[10px] text-slate-500">Table 1 Menu</p>
            </div>
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-2 text-[10px] text-slate-500 cursor-pointer">
          <span>Table logins:</span>
          {[1, 2, 3, 4, 5, 6].map(num => (
            <button
              key={num}
              onClick={() => quickLogin('customer', num)}
              className="hover:text-rose-400 underline font-semibold cursor-pointer"
            >
              T{num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
