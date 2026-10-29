import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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

  const handleDirectPrintReceipt = async (order: Order) => {
    let qrCodeUrl = '';
    try {
      const invoiceUrl = `${window.location.origin}/receipt/${order._id}`;
      qrCodeUrl = await QRCode.toDataURL(invoiceUrl, { width: 150, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } });
    } catch (e) {}

    const currentGlobalGst = parseFloat(localStorage.getItem('admin_gst_rate') || '5');
    const itemsSubtotal = (order.items && order.items.length > 0)
      ? order.items.reduce((sum: number, item: any) => {
          const price = Number(item.price ?? item.product?.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + price * qty;
        }, 0)
      : Number(order.totalAmount || 0);
    const gstRate =
      order.gstRate !== null && order.gstRate !== undefined && !isNaN(Number(order.gstRate))
        ? Number(order.gstRate)
        : (itemsSubtotal > 0 && Number(order.totalAmount) > itemsSubtotal + 0.01
            ? Math.round(((Number(order.totalAmount) - itemsSubtotal) / itemsSubtotal) * 1000) / 10
            : currentGlobalGst);
    const halfGstRate = gstRate / 2;
    const subtotal = itemsSubtotal;
    const totalGstAmount = subtotal * (gstRate / 100);
    const cgst = totalGstAmount / 2;
    const sgst = totalGstAmount / 2;
    const grandTotal = subtotal + totalGstAmount;

    const itemsHtml = order.items?.map((item: any) => {
      const pName = item.product?.name || item.name || 'Food Item';
      const price = item.price || item.product?.price || 0;
      return `
        <div style="margin-bottom: 5px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="font-weight: 600;">${item.quantity}x ${pName}</span>
            <span style="font-family: monospace; font-weight: bold;">₹${price * item.quantity}</span>
          </div>
          ${item.instructions ? `<div style="font-size: 9px; color: #4C1D95; margin-top: 1px;">📌 Note: "${item.instructions}"</div>` : ''}
        </div>
      `;
    }).join('') || '';

    const printWindow = window.open('', '_blank', 'width=450,height=700');
    if (!printWindow) {
      alert('Please allow popup windows for this site to print thermal receipts.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt Table ${order.tableNumber} #${order._id.slice(-6)}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            body {
              font-family: 'Courier New', Courier, monospace, monospace;
              width: 72mm;
              max-width: 72mm;
              margin: 0 auto;
              padding: 4px 2px;
              color: #000;
              background: #fff;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .header h2 {
              margin: 0;
              color: #000;
              font-size: 15px;
              font-weight: 900;
            }
            .header .subtitle {
              font-size: 10px;
              color: #222;
              font-weight: 700;
            }
            .header .title-tag {
              font-size: 11px;
              font-weight: 900;
              color: #000;
              margin-top: 4px;
              letter-spacing: 0.5px;
            }
            .status-banner {
              border: 1px solid #000;
              color: #000;
              padding: 4px 6px;
              font-size: 10px;
              font-weight: 800;
              text-align: center;
              margin-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta {
              font-size: 10px;
              margin-bottom: 6px;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              display: flex;
              flex-wrap: wrap;
              gap: 4px 10px;
            }
            .meta div { width: 45%; }
            .items { margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px; }
            .totals {
              font-size: 11px;
              margin-bottom: 6px;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
            }
            .totals .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .totals .row.grand {
              font-size: 14px;
              font-weight: 900;
              border-top: 1px solid #000;
              padding-top: 4px;
              margin-top: 4px;
            }
            .qr-code {
              text-align: center;
              margin: 10px 0;
            }
            .qr-code img {
              width: 100px;
              height: 100px;
            }
            .footer {
              text-align: center;
              font-size: 9px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="font-size: 18px; margin-bottom: 2px;">VPN Restaurant</h2>
            <div class="subtitle" style="font-size: 10px;">Thiruvarur - Nagapattinam Rd, Melakottaivasal</div>
            <div class="subtitle" style="font-size: 10px;">Nagapattinam, Tamil Nadu 611106</div>
            <div class="title-tag" style="margin-top: 6px;">TAX INVOICE - CUSTOMER COPY</div>
          </div>
          
          <div class="status-banner">
            Table ${order.tableNumber} - ${order.paymentMethod ? (order.paymentMethod as string).toUpperCase() : 'CASH'}
          </div>

          <div class="meta">
            <div><b>Order:</b> #${order._id.slice(-6).toUpperCase()}</div>
            <div><b>Date:</b> ${new Date(order.createdAt).toLocaleDateString()}</div>
            <div><b>Time:</b> ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div><b>Guest:</b> ${order.customerName}</div>
          </div>

          <div class="items">
            ${itemsHtml}
          </div>

          <div class="totals">
            <div class="row">
              <span>Subtotal</span>
              <span style="font-family: monospace;">₹${subtotal.toFixed(2)}</span>
            </div>
            <div class="row" style="font-size: 10px; color: #333;">
              <span>CGST (${halfGstRate}%)</span>
              <span style="font-family: monospace;">₹${cgst.toFixed(2)}</span>
            </div>
            <div class="row" style="font-size: 10px; color: #333;">
              <span>SGST (${halfGstRate}%)</span>
              <span style="font-family: monospace;">₹${sgst.toFixed(2)}</span>
            </div>
            <div class="row grand">
              <span>Grand Total</span>
              <span style="font-family: monospace;">₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          ${qrCodeUrl ? `
            <div class="qr-code">
              <img src="${qrCodeUrl}" />
              <div style="font-size: 9px; font-weight: bold; margin-top:2px;">Scan to View Invoice</div>
            </div>
          ` : ''}
          
          <div class="footer">
            Thank you for dining with us!<br/>
            <b>Visit Again!</b><br/>
            <span style="font-size: 7px; color: #555; display:inline-block; margin-top:4px;">Printed via CakeFlow AI Smart POS</span>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

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
      const data = await orderApi.getAll({ timeframe: 'all' });
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
      <div className="bg-white border border-[#D1D5DB] p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shadow-[#4C1D95]/20 shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#111827] flex items-center gap-2">
              <span>Order Management & Store History</span>
              <span className="text-xs bg-[#4C1D95]/10 text-[#4C1D95] border border-[#4C1D95]/30 px-2.5 py-0.5 rounded-full font-black">
                {filteredOrders.length} Orders
              </span>
            </h2>
            <p className="text-xs text-[#4B5563] font-semibold mt-0.5">
              Comprehensive log of store orders, live status updates, POS thermal receipts, and bulk management
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          className="px-4 py-2.5 bg-[#F9FAFB] hover:bg-white text-[#111827] border border-[#D1D5DB] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-[#D1D5DB] p-4 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B5563]" />
            <input
              id="orderSearchInput"
              data-testid="orderSearchInput"
              type="text"
              placeholder="Search by Order ID, Guest Name, or Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-[#D1D5DB] focus:border-[#4C1D95] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#111827] outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#F9FAFB] p-1.5 rounded-2xl border border-[#D1D5DB] text-xs font-bold">
            <span className="text-[#4B5563] px-2 flex items-center gap-1">
              <Filter size={12} className="text-[#4C1D95]" /> Status:
            </span>
            {['all', 'paid', 'pending', 'preparing', 'ready', 'cancelled'].map(st => (
              <button
                key={st}
                id={`orderStatusFilter-${st}`}
                data-testid={`orderStatusFilter-${st}`}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                  statusFilter === st ? 'bg-[#4C1D95] text-white shadow-md' : 'text-[#4B5563] hover:text-[#111827]'
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
        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-neutral-700 font-extrabold text-xs">
            <CheckSquare size={16} />
            <span>{selectedOrderIds.length} order(s) selected for bulk action</span>
          </div>
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Delete Selected ({selectedOrderIds.length})</span>
          </button>
        </div>
      )}

      {/* Orders Data Table */}
      <div id="ordersTable" data-testid="ordersTable" className="bg-white border border-[#D1D5DB] rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full scrollbar-thin pb-2">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead className="bg-[#F9FAFB] border-b border-[#D1D5DB] text-[#4B5563] font-extrabold uppercase tracking-wider text-[10px]">
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
                    className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
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
            <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#4B5563] font-semibold">
                    No orders match selected criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => (
                  <tr 
                    key={order._id}
                    id={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                    data-testid={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-[#4C1D95]/5 transition-colors cursor-pointer group"
                  >
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order._id)}
                        onChange={() => toggleSelectOrder(order._id)}
                        className="w-4 h-4 accent-[#4C1D95] rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-4 font-mono font-bold text-[#4C1D95]">#{order._id.slice(-6)}</td>
                    <td className="p-4 font-extrabold text-[#4C1D95] group-hover:underline">Table {order.tableNumber}</td>
                    <td className="p-4 font-semibold">{order.customerName}</td>
                    <td className="p-4 text-[11px] text-[#4B5563] font-medium max-w-[200px] truncate">
                      {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                    </td>
                    <td className="p-4 font-black font-mono text-neutral-700">₹{order.totalAmount?.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-xs ${
                        order.status === 'served' || order.paymentStatus === 'paid' ? 'bg-[#4C1D95] text-white' : 'bg-[#D1D5DB] text-white'
                      }`}>
                        {order.paymentStatus === 'paid' ? 'PAID' : order.status}
                      </span>
                    </td>
                    <td className="p-4 text-[#4B5563] font-semibold">
                      {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {' '}
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDirectPrintReceipt(order); }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1"
                          title="Print Thermal Receipt"
                        >
                          <Printer size={13} />
                          <span>Print</span>
                        </button>
                        <button
                          id={`deleteOrderBtn-${order._id}`}
                          data-testid={`deleteOrderBtn-${order._id}`}
                          onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order._id); }}
                          className="p-1.5 rounded-xl bg-neutral-50 hover:bg-neutral-600 text-neutral-600 hover:text-white border border-neutral-200 transition-colors cursor-pointer"
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
