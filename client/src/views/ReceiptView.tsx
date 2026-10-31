import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../services/api';
import { Order } from '../types';
import { Receipt, CheckCircle, Clock } from 'lucide-react';

export const ReceiptView: React.FC = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        if (!orderId) return;
        // Public single-order endpoint on the same server (works on phones / production, not just localhost)
        const res = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}`);
        setOrder(res.ok ? await res.json() : null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-bold">Loading Digital Receipt...</div>;
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500 font-bold">Receipt Not Found or Invalid Link.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#4C1D95] p-6 text-center text-white">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <CheckCircle size={32} className="text-[#4C1D95]" />
          </div>
          <h1 className="text-2xl font-black mb-1">VPN Restaurant</h1>
          <p className="text-[11px] text-violet-100 font-bold opacity-90">Thiruvarur - Nagapattinam Rd, Melakottaivasal</p>
          <p className="text-[11px] text-violet-200 font-bold opacity-80">Nagapattinam, Tamil Nadu 611001</p>
        </div>

        {/* Details */}
        <div className="p-6">
          <div className="text-center mb-6 border-b border-dashed border-gray-300 pb-6">
            <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Digital Receipt</h2>
            <p className="text-2xl font-black text-gray-900">₹{Number(order.totalAmount || 0).toFixed(2)}</p>
            <div className={`inline-block mt-2 px-3 py-1 text-[10px] font-extrabold rounded-full uppercase ${
              (order.paymentStatus || '').toLowerCase() === 'paid' || order.status === 'served'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {(order.paymentStatus || '').toLowerCase() === 'paid' || order.status === 'served'
                ? `Paid via ${order.paymentMethod || 'Cash'}`
                : 'Payment Pending'}
            </div>
          </div>

          <div className="space-y-3 text-sm mb-6 border-b border-dashed border-gray-300 pb-6">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Order ID</span>
              <span className="text-gray-900 font-bold">#{String(order._id || '').slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Date</span>
              <span className="text-gray-900 font-bold">{new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Table / Guest</span>
              <span className="text-gray-900 font-bold">Table {order.tableNumber}</span>
            </div>
          </div>

          <div className="space-y-2.5 mb-6">
            <div className="grid grid-cols-[32px_1fr_48px_72px] items-center text-xs font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2">
              <span>S.No</span>
              <span>Item Desc</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Amount</span>
            </div>
            {(() => {
              const map = new Map<string, { name: string; price: number; quantity: number }>();
              for (const item of (order.items || [])) {
                if (item.status === 'cancelled') continue;
                const itemName = (item.product?.name || item.name || 'Food Item').trim();
                const itemPrice = Number(item.price ?? item.product?.price ?? 0);
                const itemQty = Number(item.quantity || 1);
                const key = `${itemName.toLowerCase()}::${itemPrice}`;
                const existing = map.get(key);
                if (existing) {
                  existing.quantity += itemQty;
                } else {
                  map.set(key, { name: itemName, price: itemPrice, quantity: itemQty });
                }
              }
              return Array.from(map.values()).map((item, idx) => (
                <div key={idx} className="grid grid-cols-[32px_1fr_48px_72px] items-start text-sm">
                  <span className="text-gray-500 font-medium">{idx + 1}.</span>
                  <span className="text-gray-800 font-medium pr-2">{item.name}</span>
                  <span className="text-center text-gray-800 font-semibold">{item.quantity}</span>
                  <span className="text-right font-semibold text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ));
            })()}
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-gray-700 text-xs font-bold text-center">
            <div className="flex items-center gap-1.5 text-gray-900 font-extrabold">
              <Receipt size={14} />
              <span>Thank you! Visit again!</span>
            </div>
            <div className="text-[11px] text-gray-600 font-bold">
              😄 Software Developed By Murugan Solution 😄
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

