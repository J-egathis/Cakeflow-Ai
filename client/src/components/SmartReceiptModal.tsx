import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import QRCode from 'qrcode';
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

  // Generate Digital Invoice QR Code
  useEffect(() => {
    const invoiceUrl = `${window.location.origin}/receipt/${order._id}`;
    QRCode.toDataURL(invoiceUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#CD0D0D', light: '#FFFFFF' }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('Failed to generate receipt QR:', err));

    const timer = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(timer);
  }, [order._id]);

  const isPaid = order.paymentStatus === 'paid' || order.status === 'served';
  const activeGstRate = parseFloat(localStorage.getItem('admin_gst_rate') || '5');
  const halfGstRate = activeGstRate / 2;
  const subtotal = order.totalAmount ? (order.totalAmount / (1 + (activeGstRate / 100))) : 0;
  const totalGstAmount = order.totalAmount ? (order.totalAmount - subtotal) : 0;
  const cgst = totalGstAmount / 2;
  const sgst = totalGstAmount / 2;

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🍰 *CakeFlow AI Receipt*\nTable: ${order.tableNumber}\nBill #: #${order._id.slice(-6)}\nTotal: ₹${order.totalAmount?.toFixed(2)}\nStatus: ${order.paymentStatus?.toUpperCase()}\nThank you for dining with us!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`CakeFlow AI Receipt #${order._id.slice(-6)}`);
    const body = encodeURIComponent(
      `Thank you for visiting CakeFlow AI!\nTable: ${order.tableNumber}\nTotal Paid: ₹${order.totalAmount?.toFixed(2)}\nWe hope to see you again soon!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleCopyCoupon = () => {
    navigator.clipboard.writeText('CAKE20');
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
      <div className="bg-white border border-[#D0C0C0] w-full max-w-lg rounded-3xl shadow-2xl relative animate-scale-in text-[#1E1818] max-h-[92vh] flex flex-col my-auto overflow-hidden">
        
        {/* Confetti Micro Animation Banner */}
        {showConfetti && isPaid && (
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-400 animate-pulse z-30" />
        )}

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#CD0D0D] via-[#A60A0A] to-[#7A0707] text-white p-4 sm:p-5 relative shrink-0 shadow-md">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer z-10"
          >
            ✕
          </button>

          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/15 backdrop-blur-xs mb-1 border border-white/20 shadow-inner">
              <span className="text-2xl">🍰</span>
              <h2 className="font-black text-lg sm:text-xl tracking-tight text-white ml-2">CakeFlow AI</h2>
            </div>
            <div className="text-[11px] font-semibold text-rose-100 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <span>━━━━━━━━━━━━━━━━━━━</span>
            </div>
            <p className="text-xs font-bold text-white/90">Premium Smart Restaurant</p>
            <p className="text-[10px] font-semibold text-rose-200">Live Kitchen • AI Billing • QR Ordering</p>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="overflow-y-auto space-y-4 p-4 sm:p-5 pr-2.5 scrollbar-thin scrollbar-thumb-[#D0C0C0]">
          
          {/* 💳 2. Upgraded Payment Status Card */}
          {isPaid ? (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl space-y-2 shadow-xs relative overflow-hidden animate-slide-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs animate-bounce shadow">
                    ✓
                  </span>
                  <span>PAYMENT SUCCESSFUL</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {order.paymentMethod ? `Paid via ${order.paymentMethod}` : 'Paid via Cash'}
                </span>
              </div>

              <div className="flex justify-between items-end pt-1">
                <div>
                  <p className="text-[10px] text-emerald-800 font-semibold">Transaction ID:</p>
                  <p className="text-xs font-mono font-bold text-emerald-900">TXN{order._id.slice(-8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-700 font-mono">₹{order.totalAmount?.toFixed(2)}</div>
                  <p className="text-[10px] text-emerald-800 font-bold">
                    {new Date(order.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between text-amber-900 text-xs font-bold shadow-xs">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-600 animate-spin" />
                <span>Bill Payment Pending Settle</span>
              </div>
              <span className="text-sm font-mono font-black text-[#CD0D0D]">₹{order.totalAmount?.toFixed(2)}</span>
            </div>
          )}

          {/* 📊 7. Preparation Timeline Progress */}
          <div className="bg-[#FAF8F8] border border-[#D0C0C0] p-3.5 rounded-2xl space-y-2">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-[#6E6262] flex items-center justify-between">
              <span>Live Order Timeline Progress</span>
              <span className="text-[#CD0D0D] font-black">Table {order.tableNumber}</span>
            </h4>
            <div className="grid grid-cols-6 gap-1 text-center">
              {timelineStages.map((st, i) => (
                <div key={i} className="space-y-1">
                  <div className={`w-5 h-5 mx-auto rounded-full text-[10px] font-black flex items-center justify-center transition-all ${
                    st.done ? 'bg-emerald-500 text-white shadow' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {st.done ? '✓' : i + 1}
                  </div>
                  <p className={`text-[9px] font-bold truncate ${st.done ? 'text-emerald-700' : 'text-[#6E6262]'}`}>{st.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Thermal Receipt Paper Card */}
          <div className="bg-[#FFFAF4] border-2 border-dashed border-[#D0C0C0] p-4 rounded-2xl shadow-inner space-y-3 font-mono">
            {/* Store Title Header */}
            <div className="text-center border-b border-dashed border-[#D0C0C0] pb-2 space-y-0.5">
              <h4 className="font-extrabold text-sm text-[#CD0D0D]">🍰 CakeFlow AI Bakery</h4>
              <p className="text-[10px] text-[#6E6262]">Madurai Branch • Counter C02</p>
              <p className="text-[9px] text-[#6E6262]">GSTIN: 33AAAAA0000A1Z5</p>
              <span className="inline-block mt-1 text-[10px] font-black text-[#CD0D0D] bg-[#CD0D0D]/10 px-2 py-0.5 rounded-full uppercase">
                Tax Invoice Receipt
              </span>
            </div>

            {/* Order Details Grid */}
            <div className="grid grid-cols-2 text-[10px] text-[#6E6262] border-b border-dashed border-[#D0C0C0] pb-2">
              <div>
                <p>Table: <strong className="text-[#1E1818]">Table {order.tableNumber}</strong></p>
                <p>Guest: <strong className="text-[#1E1818]">{order.customerName || 'Table Guest'}</strong></p>
                <p>Served By: <strong className="text-[#1E1818]">Rahul (EMP204)</strong></p>
              </div>
              <div className="text-right">
                <p>Order #: <strong className="text-[#1E1818]">#{order._id.slice(-6)}</strong></p>
                <p>Time: <strong className="text-[#1E1818]">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></p>
                <p>Chef: <strong className="text-[#1E1818]">Chef Arjun (Cake Sec)</strong></p>
              </div>
            </div>

            {/* Order Items Breakdown */}
            <div className="space-y-1.5 border-b border-dashed border-[#D0C0C0] pb-2 text-[11px]">
              <div className="flex justify-between text-[10px] font-black text-[#6E6262] border-b border-[#E8E0E0] pb-1 uppercase">
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
                      <div className="flex justify-between font-bold text-[#1E1818]">
                        <span className="truncate pr-2">{pName}</span>
                        <span className="text-[#6E6262] font-mono shrink-0 px-2">{item.quantity} x ₹{price}</span>
                        <span className="font-mono text-[#CD0D0D] font-black shrink-0">₹{price * item.quantity}</span>
                      </div>
                      {item.instructions && (
                        <div className="text-[9px] text-[#CD0D0D] italic">📌 Note: "{item.instructions}"</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tax Summary */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-[#6E6262]">
                <span>Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#6E6262]">
                <span>CGST ({halfGstRate.toFixed(1)}%):</span>
                <span className="font-mono">₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#6E6262]">
                <span>SGST ({halfGstRate.toFixed(1)}%):</span>
                <span className="font-mono">₹{sgst.toFixed(2)}</span>
              </div>

              {/* Grand Total Banner */}
              <div className="flex justify-between items-center text-sm font-black text-[#CD0D0D] border-t-2 border-dashed border-[#D0C0C0] pt-2">
                <span>GRAND TOTAL:</span>
                <span className="text-base font-mono">₹{order.totalAmount?.toFixed(2)}</span>
              </div>
            </div>

            {/* Digital QR Code */}
            <div className="pt-2 border-t border-dashed border-[#D0C0C0] flex items-center justify-between gap-3">
              <div className="text-[10px] text-[#6E6262] space-y-0.5">
                <p className="font-bold text-[#1E1818]">📱 Digital Invoice QR</p>
                <p>Scan to download invoice & view order history anytime!</p>
              </div>
              {qrCodeDataUrl && (
                <img src={qrCodeDataUrl} alt="Receipt QR" className="w-16 h-16 rounded-xl border border-[#D0C0C0] bg-white p-1 shrink-0 shadow-xs" />
              )}
            </div>
          </div>

          {/* Payment Method Selector & Confirm Action (If unpaid) */}
          {!isPaid && setPaymentMethod && onSettleBill && (
            <div className="space-y-3 pt-2 border-t border-[#D0C0C0]">
              <label className="block text-xs font-bold text-[#6E6262] uppercase tracking-wider">Select Payment Method:</label>
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'upi'] as const).map((method) => {
                  const label = method === 'cash' ? '💵 Cash' : '📱 UPI';
                  return (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      disabled={settlingBill}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                        paymentMethod === method
                          ? 'bg-[#CD0D0D] text-white shadow-md'
                          : 'bg-[#FAF8F8] border border-[#D0C0C0] text-[#1E1818] hover:bg-white'
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
                className="w-full py-3.5 bg-[#CD0D0D] hover:bg-[#A60A0A] text-white font-black rounded-2xl text-sm shadow-lg shadow-[#CD0D0D]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
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
