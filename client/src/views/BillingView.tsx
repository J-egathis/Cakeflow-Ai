import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { orderApi, tableApi, systemApi } from '../services/api';
import QRCode from 'qrcode';
import { 
  X, Receipt, Printer, CheckCircle, CreditCard, DollarSign, 
  Smartphone, Filter, RefreshCw, LogOut, Tag, AlertTriangle 
} from 'lucide-react';
import { SmartReceiptModal } from '../components/SmartReceiptModal';

interface BillingViewProps {
  onLogout?: () => void;
}

export const BillingView: React.FC<BillingViewProps> = ({ onLogout }) => {
  
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  
  const [gstRate, setGstRate] = useState<number>(() => {
    const saved = localStorage.getItem('admin_gst_rate');
    return saved ? parseFloat(saved) : 5;
  });
  const [showGstModal, setShowGstModal] = useState(false);
  const [tempGstInput, setTempGstInput] = useState(String(gstRate));

  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [settling, setSettling] = useState<boolean>(false);
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string>('');

  const fetchUnpaidOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await orderApi.getAll();
      const pendingBills = allOrders.filter(
        (o: Order) => o.paymentStatus !== 'paid' && o.status !== 'cancelled'
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

  const handleSaveGstRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempGstInput);
    if (!isNaN(parsed) && parsed >= 0) {
      setGstRate(parsed);
      localStorage.setItem('admin_gst_rate', String(parsed));
      try {
        await systemApi.updateGst(parsed);
      } catch (err) {
        console.error('Failed to update backend GST:', err);
      }
      setShowGstModal(false);
      setToastMessage(`✅ GST Tax Rate updated to ${parsed}%! Applied to all receipts.`);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handlePrintReceipt = async (order: Order) => {
    if (!order) return;

    let qrCodeUrl = '';
    try {
      const invoiceUrl = `${window.location.origin}/receipt/${order._id}`;
      qrCodeUrl = await QRCode.toDataURL(invoiceUrl, { width: 150, margin: 1, color: { dark: '#4C1D95', light: '#FFFFFF' } });
    } catch (e) {}

    const currentGlobalGst = parseFloat(localStorage.getItem('admin_gst_rate') || String(gstRate) || '5');
    const itemsSubtotal = (order.items && order.items.length > 0)
      ? order.items.reduce((sum: number, item: any) => {
          const price = Number(item.price ?? item.product?.price ?? 0);
          const qty = Number(item.quantity ?? 1);
          return sum + price * qty;
        }, 0)
      : Number(order.totalAmount || 0);
    const activeGstRate =
      order.gstRate !== null && order.gstRate !== undefined && !isNaN(Number(order.gstRate))
        ? Number(order.gstRate)
        : (itemsSubtotal > 0 && Number(order.totalAmount) > itemsSubtotal + 0.01
            ? Math.round(((Number(order.totalAmount) - itemsSubtotal) / itemsSubtotal) * 1000) / 10
            : currentGlobalGst);
    const halfGstRate = activeGstRate / 2;
    const subtotal = itemsSubtotal;
    const totalGstAmount = subtotal * (activeGstRate / 100);
    const cgst = totalGstAmount / 2;
    const sgst = totalGstAmount / 2;
    const grandTotal = subtotal + totalGstAmount;

    const smileySvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: -4px; display: inline-block; flex-shrink: 0;"><circle cx="12" cy="12" r="10.5" stroke="#000" stroke-width="1.8" fill="none"/><circle cx="8.5" cy="8.8" r="1.5" fill="#000" stroke="none"/><circle cx="15.5" cy="8.8" r="1.5" fill="#000" stroke="none"/><path d="M7.5 13.8 C8.8 17.5, 15.2 17.5, 16.5 13.8" stroke="#000" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;

    const groupedPrintItems = (() => {
      const map = new Map<string, { name: string; price: number; quantity: number; instructions: string[] }>();
      for (const item of (order.items || [])) {
        if ((item as any).status === 'cancelled') continue;
        const pName = (item.product?.name || item.name || 'Food Item').trim();
        const price = Number(item.price ?? item.product?.price ?? 0);
        const qty = Number(item.quantity ?? 1);
        const key = `${pName.toLowerCase()}::${price}`;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += qty;
          if (item.instructions && !existing.instructions.includes(item.instructions)) {
            existing.instructions.push(item.instructions);
          }
        } else {
          map.set(key, {
            name: pName,
            price,
            quantity: qty,
            instructions: item.instructions ? [item.instructions] : []
          });
        }
      }
      return Array.from(map.values());
    })();

    const itemsHtml = groupedPrintItems.map((item, idx) => {
      const noteText = item.instructions.join(', ');
      return `
        <div style="margin-bottom: 4px;">
          <div class="item-row">
            <span>${idx + 1}.</span>
            <span style="padding-right: 4px; word-break: break-word;">${item.name}</span>
            <span style="text-align: center;">${item.quantity}</span>
            <span style="text-align: right;">₹${item.price * item.quantity}</span>
          </div>
          ${noteText ? `<div style="font-size: 9px; color: #000; margin-top: 1px; padding-left: 28px;">Note: "${noteText}"</div>` : ''}
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
              font-family: 'Courier New', Courier, monospace;
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
              color: #000;
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
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              font-size: 10.5px;
              font-weight: 700;
              color: #000;
              line-height: 1.45;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .items-table {
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .table-head {
              display: grid;
              grid-template-columns: 28px 1fr 36px 56px;
              align-items: center;
              font-size: 9.5px;
              font-weight: 900;
              color: #000;
              text-transform: uppercase;
              border-bottom: 1px solid #000;
              padding-bottom: 3px;
              margin-bottom: 5px;
            }
            .item-row {
              display: grid;
              grid-template-columns: 28px 1fr 36px 56px;
              align-items: start;
              font-size: 10px;
              font-weight: 500;
              color: #000;
              -webkit-text-stroke: 0.3px #000;
              line-height: 1.35;
            }
            .summary {
              font-size: 10.5px;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 2px;
              color: #000;
              font-weight: 600;
            }
            .grand-total {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              font-weight: 900;
              color: #000;
              border-top: 1.5px dashed #000;
              padding-top: 5px;
              margin-top: 4px;
            }
            .qr-section {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px dashed #000;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .qr-text {
              font-size: 9.5px;
              color: #000;
              font-weight: 600;
            }
            .footer {
              text-align: center;
              font-size: 10.5px;
              font-weight: 800;
              color: #000;
              padding-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>VPN Restaurant</h2>
            <div class="subtitle">Thiruvarur - Nagapattinam Rd, Melakottaivasal</div>
            <div class="subtitle">Nagapattinam, Tamil Nadu 611001</div>
            <div class="title-tag">*** TAX INVOICE ***</div>
          </div>

          <div class="status-banner">
            <span>PAID / SETTLED</span>
            <span>Via ${order.paymentMethod || 'Cash'}</span>
          </div>

          <div class="meta-grid">
            <div>
              <div>Table: Table ${order.tableNumber}</div>
              <div>Guest: ${order.customerName || 'Walk-in Guest'}</div>
            </div>
            <div style="text-align: right;">
              <div>Bill #: #${order._id.slice(-6)}</div>
              <div>Time: ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div class="items-table">
            <div class="table-head">
              <span>S.NO</span>
              <span>ITEM DESC</span>
              <span style="text-align: center;">QTY</span>
              <span style="text-align: right;">AMOUNT</span>
            </div>
            ${itemsHtml}
          </div>

          <div class="summary">
            <div class="summary-row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
            <div class="summary-row"><span>CGST (${halfGstRate.toFixed(1)}%):</span><span>₹${cgst.toFixed(2)}</span></div>
            <div class="summary-row"><span>SGST (${halfGstRate.toFixed(1)}%):</span><span>₹${sgst.toFixed(2)}</span></div>
            <div class="grand-total">
              <span>TOTAL PAID:</span>
              <span>₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="qr-section">
            <div class="qr-text">
              <b>Digital Receipt QR</b><br>
              Scan to view order invoice
            </div>
            ${qrCodeUrl ? `<img src="${qrCodeUrl}" style="width: 48px; height: 48px; border: 1px solid #000;" />` : ''}
          </div>

          <div class="footer">
            <div>Thank you! Visit again!</div>
            <div style="font-size: 9.5px; font-weight: 700; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              ${smileySvg}
              <span>Software Developed By Murugan Solution</span>
              ${smileySvg}
            </div>
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

  const handleSettlePayment = async (order: Order) => {
    setSettling(true);
    try {
      const methodLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'upi' ? 'UPI' : 'Credit Card';
      const activeGstRate = parseFloat(localStorage.getItem('admin_gst_rate') || String(gstRate) || '5');
      handlePrintReceipt(order);
      await orderApi.closeTable(order._id, methodLabel, activeGstRate);
      setToastMessage(`💰 PAYMENT CONFIRMED! Table ${order.tableNumber} settled.`);
      setUnpaidOrders(prev => prev.filter(o => o._id !== order._id));
      setSelectedOrder(null);
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err: any) {
      alert('Settlement failed: ' + (err.message || err));
    } finally {
      setSettling(false);
    }
  };

  const filteredOrders = unpaidOrders.filter(o => {
    if (tableFilter !== 'all' && String(o.tableNumber) !== String(tableFilter)) return false;
    return true;
  });

  return (
    <div id="billingPage" data-testid="billingPage" className="min-h-screen bg-[#FFFFFF] text-[#111827] flex flex-col relative pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div id="toastContainer" data-testid="toastContainer" className="fixed top-4 right-5 z-50 p-4 bg-[#F3F4F6] border border-[#D1D5DB] text-[#4C1D95] text-xs font-bold rounded-2xl shadow-xl flex items-center gap-2 animate-slide-in">
          <CheckCircle size={16} className="text-[#4C1D95] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header id="header" data-testid="header" className="bg-white/95 backdrop-blur-md border-b border-[#D1D5DB] px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md shrink-0 bg-[#4C1D95] border border-white/10 flex items-center justify-center">
              <img src="/logo.png" alt="VPN Logo" className="w-full h-full object-contain brightness-150 contrast-125" />
            </div>
          <div>
            <h1 id="dashboardTitle" data-testid="dashboardTitle" className="font-extrabold text-base md:text-lg text-[#4C1D95]">VPN Restaurant Billing Desk</h1>
            <p className="text-[10px] md:text-xs text-[#4B5563] font-semibold">Reception, Payment Settlement & Thermal Receipts</p>
          </div>
        </div>

        {onLogout && (
          <button id="logoutBtn" data-testid="logoutBtn" onClick={onLogout} className="text-xs text-[#4B5563] hover:text-[#4C1D95] bg-white border border-[#D1D5DB] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer">
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        )}
      </header>

      {/* Main Grid Content */}
      <main id="mainContent" data-testid="mainContent" className="max-w-6xl w-full mx-auto p-6 space-y-6">
        <div id="receptionPage" data-testid="receptionPage" className="space-y-6">
          
          {/* Header Banner */}
          <div className="bg-white border border-[#D1D5DB] p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 rounded-2xl bg-[#4C1D95] text-white shadow-md shrink-0">
                <Receipt size={24} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#111827] flex items-center gap-2">
                  <span>Live Reception Bills Queue</span>
                  <span id="receptionBadge" data-testid="receptionBadge" className="text-xs bg-[#4C1D95] text-white px-2.5 py-0.5 rounded-full font-black">
                    {unpaidOrders.length} Unsettled
                  </span>
                </h2>
                <p className="text-xs text-[#4B5563] font-semibold mt-0.5">
                  Select payment method (Cash/UPI/Card), apply discounts, and generate 80mm thermal receipts
                </p>
              </div>
            </div>

            <button
              onClick={fetchUnpaidOrders}
              className="px-4 py-2.5 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Bills</span>
            </button>
          </div>

          {/* Unpaid Orders Table */}
          <div id="receptionTable" data-testid="receptionTable" className="bg-white border border-[#D1D5DB] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] border-b border-[#D1D5DB] text-[#4B5563] font-extrabold uppercase text-[10px]">
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
                <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#4B5563] font-semibold">
                        🎉 All table bills are settled! No pending bills in queue.
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
                        <td className="p-4 font-mono font-bold text-[#4C1D95]">#{order._id.slice(-6)}</td>
                        <td className="p-4 font-extrabold text-[#4C1D95]">Table {order.tableNumber}</td>
                        <td className="p-4 font-semibold">{order.customerName}</td>
                        <td className="p-4 text-[11px] text-[#4B5563] font-medium max-w-[200px] truncate">
                          {order.items?.map((i: any) => `${i.quantity}x ${i.product?.name || i.name}`).join(', ')}
                        </td>
                        <td className="p-4 font-black font-mono text-neutral-700">₹{order.totalAmount?.toFixed(2)}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#D1D5DB] text-white shadow-xs">
                            UNSETTLED
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              id={`viewBillBtn-${order._id}`}
                              data-testid={`viewBillBtn-${order._id}`}
                              onClick={() => setSelectedOrder(order)}
                              className="px-3 py-1.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
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

      {/* 🏷️ CONFIGURE GST RATE MODAL */}

      {showGstModal && (

        <div id="gstModal" data-testid="gstModal" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">

          <div className="bg-white border border-[#E5E7EB] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scale-in text-[#111827]">

            {/* Header */}

            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 flex justify-between items-center shadow-sm">

              <div className="flex items-center gap-2">

                <span className="text-base">🇮🇳</span>

                <div>

                  <h3 className="font-extrabold text-sm leading-tight">Indian Govt GST Tax Rate Manager</h3>

                  <p className="text-[10px] text-amber-100 font-medium">Standard Bakery & Food Court Tax Slabs</p>

                </div>

              </div>

              <button

                onClick={() => setShowGstModal(false)}

                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"

              >

                <X size={16} />

              </button>

            </div>



            {/* Form */}

            <form onSubmit={handleSaveGstRate} className="p-5 space-y-4">

              <div>

                <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider mb-1.5">

                  Total GST Rate (%)

                </label>

                <div className="relative">

                  <input

                    id="gstRateInput"

                    data-testid="gstRateInput"

                    type="number"

                    step="0.1"

                    min="0"

                    max="50"

                    required

                    placeholder="e.g. 5 or 12 or 18"

                    value={tempGstInput}

                    onChange={(e) => setTempGstInput(e.target.value)}

                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#111827] outline-none"

                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#4B5563]">% GST</span>

                </div>

                <p className="text-[10px] text-[#4B5563] mt-1.5 font-semibold flex items-center justify-between">

                  <span>Central CGST: <strong className="text-amber-600 font-mono">{(parseFloat(tempGstInput) / 2 || 0).toFixed(1)}%</strong></span>

                  <span>State SGST: <strong className="text-amber-600 font-mono">{(parseFloat(tempGstInput) / 2 || 0).toFixed(1)}%</strong></span>

                </p>

              </div>



              {/* Official Indian Govt GST Slabs */}

              <div className="space-y-2 pt-1 border-t border-[#F3F4F6]">

                <label className="block text-[10px] font-extrabold text-[#4B5563] uppercase tracking-wider">

                  Official Govt GST Slabs:

                </label>

                <div className="grid grid-cols-2 gap-2">

                  {[

                    { label: '5% Restaurant/Bakery', desc: '2.5% CGST + 2.5% SGST', val: 5 },

                    { label: '12% Packaged Food', desc: '6.0% CGST + 6.0% SGST', val: 12 },

                    { label: '18% AC Catering', desc: '9.0% CGST + 9.0% SGST', val: 18 },

                    { label: '0% Tax Exempt', desc: 'No GST Applied', val: 0 }

                  ].map(p => (

                    <button

                      key={p.val}

                      type="button"

                      onClick={() => setTempGstInput(String(p.val))}

                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${

                        tempGstInput === String(p.val)

                          ? 'bg-amber-50 border-amber-500 shadow-xs'

                          : 'bg-[#F9FAFB] text-[#111827] border-[#E5E7EB] hover:bg-white'

                      }`}

                    >

                      <div className="text-[11px] font-extrabold text-[#111827] flex items-center justify-between">

                        <span>{p.label}</span>

                        {tempGstInput === String(p.val) && <span className="text-amber-600 text-xs">✓</span>}

                      </div>

                      <p className="text-[9px] text-[#4B5563] font-semibold mt-0.5">{p.desc}</p>

                    </button>

                  ))}

                </div>

              </div>



              <div className="pt-2">

                <button

                  id="saveGstBtn"

                  data-testid="saveGstBtn"

                  type="submit"

                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"

                >

                  <CheckCircle size={15} />

                  <span>Update GST Rate & Apply to POS Receipts</span>

                </button>

              </div>

            </form>

          </div>

        </div>

      )}





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

export { BillingView as BillingPage };
export default BillingView;

