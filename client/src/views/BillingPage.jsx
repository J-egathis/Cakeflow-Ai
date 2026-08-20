import React, { useState, useEffect } from 'react';
import { orderApi } from '../services/api';
import { 
  Receipt, Printer, CheckCircle, RefreshCw, LogOut, Tag, AlertTriangle 
} from 'lucide-react';
import { SmartReceiptModal } from '../components/SmartReceiptModal';

export const BillingPage = ({ onLogout }) => {
  const [unpaidOrders, setUnpaidOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [settling, setSettling] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchUnpaidOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await orderApi.getAll();
      const pendingBills = (allOrders || []).filter(
        (o) => o.paymentStatus !== 'paid' && o.status !== 'cancelled'
      );
      setUnpaidOrders(pendingBills);
    } catch (err) {
      console.error('Failed to load unpaid billing orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnpaidOrders();
  }, []);

  const handlePrintReceipt = (order) => {
    if (!order) return;
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt Table ${order.tableNumber} #${order._id.slice(-6)}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: sans-serif; width: 78mm; margin: 0 auto; padding: 10px 8px; color: #1E1818; }
            .header { text-align: center; border-bottom: 1.5px dashed #CD0D0D; padding-bottom: 8px; margin-bottom: 8px; }
            .header h2 { margin: 0; color: #CD0D0D; font-size: 16px; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🍰 CakeFlow AI Bakery</h2>
            <div>RECEPTION BILLING & TAX INVOICE</div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSettlePayment = async (order) => {
    if (!order) return;
    setSettling(true);
    try {
      const methodLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'upi' ? 'UPI' : 'Credit Card';
      handlePrintReceipt(order);
      await orderApi.closeTable(order._id, methodLabel);
      setToastMessage(`💰 PAYMENT CONFIRMED! ₹${order.totalAmount?.toFixed(2)} received for Table ${order.tableNumber}.`);
      setUnpaidOrders(prev => prev.filter(o => o._id !== order._id));
      setSelectedOrder(null);
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      alert('Settlement failed: ' + (err.message || err));
    } finally {
      setSettling(false);
    }
  };

  return (
    <div id="billingPage" data-testid="billingPage" className="min-h-screen bg-[#F7F5F2] text-[#1E1818] flex flex-col relative pb-12">
      {/* Real-time Toast Notifications */}
      {toastMessage && (
        <div id="toastContainer" data-testid="toastContainer" className="fixed top-4 right-5 z-50 p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-2xl shadow-xl flex items-center gap-2 animate-slide-in">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header id="header" data-testid="header" className="bg-white/95 backdrop-blur-md border-b border-[#D0C0C0] px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div id="dashboardLogo" data-testid="dashboardLogo" className="p-2 rounded-xl bg-[#CD0D0D] text-white shadow-md">
            <Receipt size={18} />
          </div>
          <div>
            <h1 id="dashboardTitle" data-testid="dashboardTitle" className="font-extrabold text-base md:text-lg text-[#CD0D0D]">CakeFlow Billing Desk</h1>
            <p className="text-[10px] md:text-xs text-[#6E6262] font-semibold">Reception, Payment Settlement & Thermal Receipts</p>
          </div>
        </div>

        {onLogout && (
          <button id="logoutBtn" data-testid="logoutBtn" onClick={onLogout} className="text-xs text-[#6E6262] hover:text-[#CD0D0D] bg-white border border-[#D0C0C0] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer">
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        )}
      </header>

      {/* Main Grid Content */}
      <main id="mainContent" data-testid="mainContent" className="max-w-6xl w-full mx-auto p-6 space-y-6">
        <div id="receptionPage" data-testid="receptionPage" className="space-y-6">
          
          {/* Header Banner */}
          <div className="bg-white border border-[#D0C0C0] p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 rounded-2xl bg-[#CD0D0D] text-white shadow-md shrink-0">
                <Receipt size={24} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1E1818] flex items-center gap-2">
                  <span>Live Reception Bills Queue</span>
                  <span id="receptionBadge" data-testid="receptionBadge" className="text-xs bg-[#CD0D0D] text-white px-2.5 py-0.5 rounded-full font-black">
                    {unpaidOrders.length} Unsettled
                  </span>
                </h2>
                <p className="text-xs text-[#6E6262] font-semibold mt-0.5">
                  Select payment method, apply promo discounts (e.g. CAKE20), and print 80mm thermal receipts
                </p>
              </div>
            </div>

            <button
              onClick={fetchUnpaidOrders}
              className="px-4 py-2.5 bg-[#FAF8F8] border border-[#D0C0C0] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Bills</span>
            </button>
          </div>

          {/* Unpaid Orders Table */}
          <div id="receptionTable" data-testid="receptionTable" className="bg-white border border-[#D0C0C0] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F8] border-b border-[#D0C0C0] text-[#6E6262] font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Table #</th>
                    <th className="p-4">Customer Name</th>
                    <th className="p-4">Items Summary</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0E0] text-[#1E1818]">
                  {unpaidOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#6E6262] font-semibold">
                        🎉 All table bills are settled! No pending bills in queue.
                      </td>
                    </tr>
                  ) : (
                    unpaidOrders.map((order, index) => (
                      <tr 
                        key={order._id}
                        id={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                        data-testid={index === 0 ? "orderRow1" : `orderRow-${index + 1}`}
                        className="hover:bg-[#CD0D0D]/5 transition-colors cursor-pointer group"
                      >
                        <td className="p-4 font-mono font-bold text-[#CD0D0D]">#{order._id.slice(-6)}</td>
                        <td className="p-4 font-extrabold text-[#CD0D0D]">Table {order.tableNumber}</td>
                        <td className="p-4 font-semibold">{order.customerName}</td>
                        <td className="p-4 text-[11px] text-[#6E6262] font-medium max-w-[200px] truncate">
                          {order.items?.map((i) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                        </td>
                        <td className="p-4 font-black font-mono text-emerald-700">₹{order.totalAmount?.toFixed(2)}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white shadow-xs">
                            UNSETTLED
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              id={`viewBillBtn-${order._id}`}
                              data-testid={`viewBillBtn-${order._id}`}
                              onClick={() => setSelectedOrder(order)}
                              className="px-3 py-1.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                            >
                              Settle & Print
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

        </div>
      </main>

      {/* Smart Receipt Settlement Modal */}
      {selectedOrder && (
        <div id="receiptModal" data-testid="receiptModal">
          <SmartReceiptModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            settlingBill={settling}
            onSettleBill={() => handleSettlePayment(selectedOrder)}
            onPrintReceipt={() => handlePrintReceipt(selectedOrder)}
          />
        </div>
      )}
    </div>
  );
};

export default BillingPage;
