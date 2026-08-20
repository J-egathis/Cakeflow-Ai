import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { orderApi, tableApi, analyticsApi } from '../services/api';
import { 
  ShoppingBag, Search, Filter, Calendar, Trash2, 
  Printer, Receipt, CheckSquare, RefreshCw, CheckCircle 
} from 'lucide-react';
import { SmartReceiptModal } from './SmartReceiptModal';

interface OrderManagementProps {
  onSelectOrder?: (order: Order) => void;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await orderApi.getAll();
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch order management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm(`Permanently delete order #${orderId.slice(-6)}?`)) return;
    try {
      await orderApi.remove(orderId, true);
      setOrders(prev => prev.filter(o => o._id !== orderId));
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedOrderIds.length} selected orders permanently?`)) return;
    try {
      await orderApi.bulkRemove(selectedOrderIds);
      setOrders(prev => prev.filter(o => !selectedOrderIds.includes(o._id)));
      setSelectedOrderIds([]);
    } catch (err: any) {
      alert('Bulk delete failed: ' + (err.message || err));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredOrders = orders.filter(o => {
    if (tableFilter !== 'all' && String(o.tableNumber) !== String(tableFilter)) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid' && o.paymentStatus !== 'paid') return false;
      if (statusFilter !== 'paid' && o.status !== statusFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = o._id.toLowerCase().includes(q);
      const matchCustomer = o.customerName?.toLowerCase().includes(q);
      const matchItems = o.items?.some((i: any) => (i.product?.name || i.name || '').toLowerCase().includes(q));
      if (!matchId && !matchCustomer && !matchItems) return false;
    }
    return true;
  });

  return (
    <div id="orderManagement" data-testid="orderManagement" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-[#CD0D0D] text-white shadow-md shadow-[#CD0D0D]/20 shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#1E1818] flex items-center gap-2">
              <span>Order Management & Store History</span>
              <span className="text-xs bg-[#CD0D0D]/10 text-[#CD0D0D] border border-[#CD0D0D]/30 px-2.5 py-0.5 rounded-full font-black">
                {filteredOrders.length} Orders
              </span>
            </h2>
            <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
              Comprehensive log of store orders, live status updates, POS thermal receipts, and bulk management
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          className="px-4 py-2.5 bg-[#FAF8F8] hover:bg-white text-[#1E1818] border border-[#D0C0C0] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-[#D0C0C0] p-4 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E6262]" />
            <input
              id="orderSearchInput"
              data-testid="orderSearchInput"
              type="text"
              placeholder="Search by Order ID, Guest Name, or Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F8] border border-[#D0C0C0] focus:border-[#CD0D0D] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#1E1818] outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#FAF8F8] p-1.5 rounded-2xl border border-[#D0C0C0] text-xs font-bold">
            <span className="text-[#6E6262] px-2 flex items-center gap-1">
              <Filter size={12} className="text-[#CD0D0D]" /> Status:
            </span>
            {['all', 'paid', 'pending', 'preparing', 'ready', 'cancelled'].map(st => (
              <button
                key={st}
                id={`orderStatusFilter-${st}`}
                data-testid={`orderStatusFilter-${st}`}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                  statusFilter === st ? 'bg-[#CD0D0D] text-white shadow-md' : 'text-[#6E6262] hover:text-[#1E1818]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Select Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-rose-700 font-extrabold text-xs">
            <CheckSquare size={16} />
            <span>{selectedOrderIds.length} order(s) selected for bulk action</span>
          </div>
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Delete Selected ({selectedOrderIds.length})</span>
          </button>
        </div>
      )}

      {/* Orders Data Table */}
      <div id="ordersTable" data-testid="ordersTable" className="bg-white border border-[#D0C0C0] rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F8] border-b border-[#D0C0C0] text-[#6E6262] font-extrabold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o._id))}
                    onChange={() => {
                      const allIds = filteredOrders.map(o => o._id);
                      const allSelected = allIds.every(id => selectedOrderIds.includes(id));
                      setSelectedOrderIds(allSelected ? [] : allIds);
                    }}
                    className="w-4 h-4 accent-[#CD0D0D] rounded cursor-pointer"
                  />
                </th>
                <th className="p-4">Order ID</th>
                <th className="p-4">Table #</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Items Summary</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0E0] text-[#1E1818]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#6E6262] font-semibold">
                    No orders match selected criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => (
                  <tr 
                    key={order._id}
                    id={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                    data-testid={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                    className="hover:bg-[#CD0D0D]/5 transition-colors cursor-pointer group"
                  >
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order._id)}
                        onChange={() => toggleSelectOrder(order._id)}
                        className="w-4 h-4 accent-[#CD0D0D] rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-mono font-bold text-[#CD0D0D]">#{order._id.slice(-6)}</td>
                    <td className="p-4 font-extrabold text-[#CD0D0D]">Table {order.tableNumber}</td>
                    <td className="p-4 font-semibold">{order.customerName}</td>
                    <td className="p-4 text-[11px] text-[#6E6262] font-medium max-w-[200px] truncate">
                      {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                    </td>
                    <td className="p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-xs ${
                        order.status === 'served' || order.paymentStatus === 'paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {order.paymentStatus === 'paid' ? 'PAID' : order.status}
                      </span>
                    </td>
                    <td className="p-4 text-[#6E6262] font-semibold">
                      {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          id={`viewBillBtn-${order._id}`}
                          data-testid={`viewBillBtn-${order._id}`}
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F8] group-hover:bg-[#CD0D0D] group-hover:text-white text-[#1E1818] border border-[#D0C0C0] font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                        >
                          View Bill
                        </button>
                        <button
                          id={`deleteOrderBtn-${order._id}`}
                          data-testid={`deleteOrderBtn-${order._id}`}
                          onClick={() => handleDeleteOrder(order._id)}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Receipt Modal */}
      {selectedOrder && (
        <SmartReceiptModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};
