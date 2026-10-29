import React from 'react';
import { OrderManagement } from '../components/OrderManagement';
import { ShoppingBag, LogOut } from 'lucide-react';
import { User } from '../types';

interface OrdersViewProps {
  user?: User;
  onLogout?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ user, onLogout }) => {
  return (
    <div id="ordersPage" data-testid="ordersPage" className="min-h-screen bg-[#FFFFFF] text-[#111827] flex flex-col relative overflow-hidden pb-12">
      {/* Header */}
      <header id="ordersHeader" data-testid="ordersHeader" className="bg-white/95 backdrop-blur-md border-b border-[#D1D5DB] px-4 md:px-6 py-3.5 flex items-center justify-between z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
              <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
            </div>
          <div>
            <h1 className="font-extrabold text-base md:text-lg tracking-tight text-[#4C1D95]">VPN Restaurant Orders Page</h1>
            <p className="text-[10px] md:text-xs text-[#4B5563] font-semibold">Live & Historical Order Analytics</p>
          </div>
        </div>

        {onLogout && (
          <button 
            id="logoutBtn"
            data-testid="logoutBtn"
            onClick={onLogout}
            className="text-xs text-[#4B5563] hover:text-[#4C1D95] bg-white border border-[#D1D5DB] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        )}
      </header>

      {/* Main Order Management View */}
      <main id="mainContent" data-testid="mainContent" className="max-w-6xl w-full mx-auto p-6 z-10 space-y-6">
        <OrderManagement />
      </main>
    </div>
  );
};

export { OrdersView as OrdersPage, OrdersView as Orders };
export default OrdersView;

