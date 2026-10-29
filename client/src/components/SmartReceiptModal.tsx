import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import QRCode from 'qrcode';
import { systemApi, getSocket } from '../services/api';
import { 
  CheckCircle, Printer, Download, Share2, Sparkles, 
  Heart, Star, Gift, Tag, Clock, User, ChefHat, 
  Store, Award, QrCode, RefreshCw, Send, ThumbsUp, DollarSign
} from 'lucide-react';

interface SmartReceiptModalProps {
  order: Order;
  onClose: () => void;
  paymentMethod?: 'cash' | 'upi' | 'card';
  setPaymentMethod?: (method: 'cash' | 'upi' | 'card') => void;
  settlingBill?: boolean;
  onSettleBill?: () => void;
  onPrintReceipt?: () => void;
}

export const SmartReceiptModal: React.FC<SmartReceiptModalProps> = ({
  order,
  onClose,
  paymentMethod = 'cash',
  setPaymentMethod,
  settlingBill = false,
  onSettleBill,
  onPrintReceipt
}) => {
  const [rating, setRating] = useState<number>(5);
  const [selectedEmoji, setSelectedEmoji] = useState<string>('😍');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedCoupon, setCopiedCoupon] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(true);
  const [discountCodeInput, setDiscountCodeInput] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [discountSuccessMsg, setDiscountSuccessMsg] = useState<string>('');
  const [activeGstRate, setActiveGstRate] = useState<number>(() => {
    const saved = localStorage.getItem('admin_gst_rate');
    return saved !== null && saved !== '' ? parseFloat(saved) : 0;
  });

  // Generate Digital Invoice QR Code and fetch GST rate
  useEffect(() => {
    const invoiceUrl = `${window.location.origin}/receipt/${order._id}`;
    QRCode.toDataURL(invoiceUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#4C1D95', light: '#FFFFFF' }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('Failed to generate receipt QR:', err));

    systemApi.getGst()
      .then(res => {
        if (res && typeof res.gstRate === 'number' && !isNaN(res.gstRate)) {
          setActiveGstRate(res.gstRate);
          localStorage.setItem('admin_gst_rate', String(res.gstRate));
        }
      })
      .catch(() => {});

    const socket = getSocket();
    const handleGstUpdate = (data: { gstRate: number }) => {
      if (data && typeof data.gstRate === 'number' && !isNaN(data.gstRate)) {
        setActiveGstRate(data.gstRate);
        localStorage.setItem('admin_gst_rate', String(data.gstRate));
      }
    };
    socket.on('gst_rate_updated', handleGstUpdate);

    const timer = setTimeout(() => setShowConfetti(false), 3500);
    return () => {
      clearTimeout(timer);
      socket.off('gst_rate_updated', handleGstUpdate);
    };
  }, [order._id]);

  const isPaid = order.paymentStatus === 'paid' || order.status === 'served';
  const itemsSubtotal = (order.items && order.items.length > 0)
    ? order.items.reduce((sum: number, item: any) => {
        const price = Number(item.price ?? item.product?.price ?? 0);
        const qty = Number(item.quantity ?? 1);
        return sum + price * qty;
      }, 0)
    : Number(order.totalAmount || 0);

  // Paid/settled bills remain locked to their historical order.gstRate.
  // Unpaid/pending bills always reflect the current active GST rate (e.g. 0% when GST is set to 0%).
  const effectiveGstRate = isPaid
    ? (order.gstRate !== null && order.gstRate !== undefined && !isNaN(Number(order.gstRate))
        ? Number(order.gstRate)
        : (itemsSubtotal > 0 && Number(order.totalAmount) > itemsSubtotal + 0.01
            ? Math.round(((Number(order.totalAmount) - itemsSubtotal) / itemsSubtotal) * 1000) / 10
            : 0))
    : activeGstRate;

  const halfGstRate = effectiveGstRate / 2;
  const subtotal = itemsSubtotal;
  const totalGstAmount = subtotal * (effectiveGstRate / 100);
  const cgst = totalGstAmount / 2;
  const sgst = totalGstAmount / 2;
  const grandTotal = subtotal + totalGstAmount;

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🍰 *VPN Restaurant Receipt*\nTable: ${order.tableNumber}\nBill #: #${order._id.slice(-6)}\nSubtotal: ₹${subtotal.toFixed(2)}\nGST (${effectiveGstRate}%): ₹${totalGstAmount.toFixed(2)}\nGrand Total: ₹${grandTotal.toFixed(2)}\nStatus: ${order.paymentStatus?.toUpperCase()}\nThank you for dining with us!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`VPN Restaurant Receipt #${order._id.slice(-6)}`);
    const body = encodeURIComponent(
      `Thank you for visiting VPN Restaurant!\nTable: ${order.tableNumber}\nSubtotal: ₹${subtotal.toFixed(2)}\nGST (${effectiveGstRate}%): ₹${totalGstAmount.toFixed(2)}\nTotal Paid: ₹${grandTotal.toFixed(2)}\nWe hope to see you again soon!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleCopyCoupon = () => {
    navigator.clipboard.writeText('VPN20');
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  // Preparation timeline stages
  const timelineStages = [
    { label: 'Ordered', done: true },
    { label: 'Accepted', done: true },
    { label: 'Preparing', done: ['preparing', 'decorating', 'ready', 'served'].includes(order.status) },
    { label: 'Ready', done: ['ready', 'served'].includes(order.status) },
    { label: 'Served', done: order.status === 'served' },
    { label: 'Paid', done: isPaid }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      {/* Floating Modal Card */}
      <div className="bg-white border border-[#D1D5DB] w-full max-w-lg rounded-3xl shadow-2xl relative animate-scale-in text-[#111827] max-h-[92vh] flex flex-col my-auto overflow-hidden">
        
        {/* Confetti Micro Animation Banner */}
        {showConfetti && isPaid && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-neutral-400 via-neutral-500 to-neutral-400 animate-pulse z-30" />
        )}

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#4C1D95] via-[#5B21B6] to-[#4C1D95] text-white p-4 sm:p-5 relative shrink-0 shadow-md">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer z-10"
          >
            ✕
          </button>

          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/15 backdrop-blur-xs mb-1 border border-white/20 shadow-inner">
              <img src="/logo.png" className="w-8 h-8 rounded-full" alt="logo" />
              <h2 className="font-black text-lg sm:text-xl tracking-tight text-white ml-2">VPN Restaurant</h2>
            </div>
            <div className="text-[11px] font-semibold text-neutral-100 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <span>━━━━━━━━━━━━━━━━━━━</span>
            </div>
            <p className="text-xs font-bold text-white/90">Premium Smart Restaurant</p>
            <p className="text-[10px] font-semibold text-[#E5E7EB]">Live Kitchen • AI Billing • QR Ordering</p>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="overflow-y-auto space-y-4 p-4 sm:p-5 pr-2.5 scrollbar-thin scrollbar-thumb-[#D1D5DB]">
          
          {/* 💳 2. Upgraded Payment Status Card */}
          {isPaid ? (
            <div className="bg-gradient-to-br from-neutral-50 to-neutral-50 border border-[#D1D5DB] p-4 rounded-2xl space-y-2 shadow-xs relative overflow-hidden animate-slide-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-700 font-extrabold text-sm">
                  <span className="w-7 h-7 rounded-full bg-[#4C1D95] text-white flex items-center justify-center text-xs animate-bounce shadow">
                    ✓
                  </span>
                  <span>PAYMENT SUCCESSFUL</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-neutral-100 text-[#4C1D95] px-2 py-0.5 rounded-full border border-[#D1D5DB]">
                  {order.paymentMethod ? `Paid via ${order.paymentMethod}` : 'Paid via Cash'}
                </span>
              </div>

              <div className="flex justify-between items-end pt-1">
                <div>
                  <p className="text-[10px] text-[#4C1D95] font-semibold">Transaction ID:</p>
                  <p className="text-xs font-mono font-bold text-[#4C1D95]">TXN{order._id.slice(-8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-neutral-700 font-mono">₹{grandTotal.toFixed(2)}</div>
                  <p className="text-[10px] text-[#4C1D95] font-bold">
                    {new Date(order.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50 border border-neutral-200 p-3.5 rounded-2xl flex items-center justify-between text-[#4C1D95] text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-neutral-600 animate-spin" />
                <span>Bill Payment Pending Settle</span>
              </div>
              <span className="text-sm font-mono font-black text-[#4C1D95]">₹{grandTotal.toFixed(2)}</span>
            </div>
          )}

          {/* 📊 7. Preparation Timeline Progress */}
          <div className="bg-[#F9FAFB] border border-[#D1D5DB] p-3.5 rounded-2xl space-y-2">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#4B5563] flex items-center justify-between">
              <span>Live Order Timeline Progress</span>
              <span className="text-[#4C1D95] font-black">Table {order.tableNumber}</span>
            </h4>
            <div className="grid grid-cols-6 gap-1 text-center">
              {timelineStages.map((st, i) => (
                <div key={i} className="space-y-1">
                  <div className={`w-5 h-5 mx-auto rounded-full text-[10px] font-black flex items-center justify-center transition-all ${
                    st.done ? 'bg-[#4C1D95] text-white shadow' : 'bg-neutral-200 text-[#D1D5DB]'
                  }`}>
                    {st.done ? '✓' : i + 1}
                  </div>
                  <p className={`text-[9px] font-bold truncate ${st.done ? 'text-neutral-700' : 'text-[#4B5563]'}`}>{st.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Thermal Receipt Paper Card */}
          <div className="bg-[#FFFFFF] border-2 border-dashed border-[#D1D5DB] p-4 rounded-2xl shadow-inner space-y-3 font-mono">
            {/* Store Title Header */}
            <div className="text-center border-b border-dashed border-[#D1D5DB] pb-2 space-y-0.5">
              <div style={{display:"flex", alignItems:"center", gap:"8px", justifyContent:"center"}}>
                <img src="/logo.png" style={{width:"20px", height:"20px", borderRadius:"50%"}} alt="logo" />
                <h4 className="font-extrabold text-sm text-[#4C1D95]">VPN Restaurant</h4>
              </div>
              <p className="text-[10px] text-[#4B5563]">Thiruvarur - Nagapattinam Rd, Melakottaivasal</p>
              <p className="text-[10px] text-[#4B5563]">Nagapattinam, Tamil Nadu 611106</p>
              <p className="text-[9px] text-[#4B5563]">GSTIN: 33AAAAA0000A1Z5</p>
              <span className="inline-block mt-1 text-[10px] font-black text-[#4C1D95] bg-[#4C1D95]/10 px-2 py-0.5 rounded-full uppercase">
                Tax Invoice Receipt
              </span>
            </div>

            {/* Order Details Grid */}
            <div className="grid grid-cols-2 text-[10px] text-[#4B5563] border-b border-dashed border-[#D1D5DB] pb-2">
              <div>
                <p>Table: <strong className="text-[#111827]">Table {order.tableNumber}</strong></p>
                <p>Guest: <strong className="text-[#111827]">{order.customerName || 'Table Guest'}</strong></p>
                <p>Served By: <strong className="text-[#111827]">Rahul (EMP204)</strong></p>
              </div>
              <div className="text-right">
                <p>Order #: <strong className="text-[#111827]">#{order._id.slice(-6)}</strong></p>
                <p>Time: <strong className="text-[#111827]">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></p>
                <p>Chef: <strong className="text-[#111827]">Head Chef</strong></p>
              </div>
            </div>

            {/* Order Items Breakdown */}
            <div className="space-y-1.5 border-b border-dashed border-[#D1D5DB] pb-2 text-[11px]">
              <div className="flex justify-between text-[10px] font-black text-[#4B5563] border-b border-[#F3F4F6] pb-1 uppercase">
                <span>Item</span>
                <span>Qty x Rate</span>
                <span>Amt</span>
              </div>

              <div className="space-y-1">
                {order.items?.map((item: any, idx: number) => {
                  const pName = item.product?.name || item.name || 'Food Item';
                  const price = item.price || item.product?.price || 0;
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between font-bold text-[#111827]">
                        <span className="truncate pr-2">{pName}</span>
                        <span className="text-[#4B5563] font-mono shrink-0 px-2">{item.quantity} x ₹{price}</span>
                        <span className="font-mono text-[#4C1D95] font-black shrink-0">₹{price * item.quantity}</span>
                      </div>
                      {item.instructions && (
                        <div className="text-[9px] text-[#4C1D95] italic">📌 Note: "{item.instructions}"</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tax Summary */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-[#4B5563]">
                <span>Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>CGST ({halfGstRate.toFixed(1)}%):</span>
                <span className="font-mono">₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>SGST ({halfGstRate.toFixed(1)}%):</span>
                <span className="font-mono">₹{sgst.toFixed(2)}</span>
              </div>

              {/* Grand Total Banner */}
              <div className="flex justify-between items-center text-sm font-black text-[#4C1D95] border-t-2 border-dashed border-[#D1D5DB] pt-2">
                <span>GRAND TOTAL:</span>
                <span className="text-base font-mono">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Digital QR Code */}
            <div className="pt-2 border-t border-dashed border-[#D1D5DB] flex items-center justify-between gap-3">
              <div className="text-[10px] text-[#4B5563] space-y-0.5">
                <p className="font-bold text-[#111827]">📱 Digital Invoice QR</p>
                <p>Scan to download invoice & view order history anytime!</p>
              </div>
              {qrCodeDataUrl && (
                <img src={qrCodeDataUrl} alt="Receipt QR" className="w-16 h-16 rounded-xl border border-[#D1D5DB] bg-white p-1 shrink-0 shadow-xs" />
              )}
            </div>
          </div>

          {/* Payment Method Selector & Confirm Action (If unpaid) */}
          {!isPaid && setPaymentMethod && onSettleBill && (
            <div className="space-y-3 pt-2 border-t border-[#D1D5DB]">
              <label className="block text-xs font-bold text-[#4B5563] uppercase tracking-wider">Select Payment Method:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'upi', 'card'] as const).map((method) => {
                  const label = method === 'cash' ? '💵 Cash' : method === 'upi' ? '📱 UPI' : '💳 Card';
                  return (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      disabled={settlingBill}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                        paymentMethod === method
                          ? 'bg-[#4C1D95] text-white shadow-md'
                          : 'bg-[#F9FAFB] border border-[#D1D5DB] text-[#111827] hover:bg-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={onSettleBill}
                disabled={settlingBill}
                className="w-full py-3.5 bg-[#4C1D95] hover:bg-[#5B21B6] text-white font-black rounded-2xl text-sm shadow-lg shadow-[#4C1D95]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {settlingBill ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Settling Bill & Releasing Table {order.tableNumber}...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Confirm {paymentMethod.toUpperCase()} Payment & Release Table {order.tableNumber}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
