import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { orderApi, getSocket } from '../services/api';
import { 
  Receipt, CreditCard, DollarSign, Wallet, Percent, 
  Printer, ArrowRight, CheckCircle, Split, FileText, LogOut, RefreshCw 
} from 'lucide-react';

interface CashierViewProps {
  user: { username: string };
  onLogout: () => void;
}

export const CashierView: React.FC<CashierViewProps> = ({ user, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Payment States
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit Card' | 'Debit Card' | 'Split'>('Cash');
  const [splitCount, setSplitCount] = useState<number>(2);
  const [isSplitMode, setIsSplitMode] = useState(false);

  const fetchUnpaidOrders = async () => {
    setLoading(true);
    try {
      const data = await orderApi.getAll();
      // Cashier handles unpaid orders (even if served or preparing)
      const unpaid = data.filter((o: Order) => o.paymentStatus === 'unpaid' && o.status !== 'cancelled');
      setOrders(unpaid);
      
      // Auto-select first order if none selected
      if (unpaid.length > 0 && !selectedOrder) {
        setSelectedOrder(unpaid[0]);
      }
    } catch (err) {
      console.error('Failed to load cashier orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnpaidOrders();

    // Sockets setup
    const socket = getSocket();
    socket.emit('join_room', 'cashiers');

    socket.on('new_order', () => {
      fetchUnpaidOrders();
    });

    socket.on('order_updated', () => {
      fetchUnpaidOrders();
    });

    return () => {
      socket.emit('leave_room', 'cashiers');
      socket.off('new_order');
      socket.off('order_updated');
    };
  }, []);

  const handleProcessPayment = async () => {
    if (!selectedOrder) return;
    try {
      await orderApi.closeTable(selectedOrder._id);
      
      // Set payment method
      await orderApi.update(selectedOrder._id, {
        paymentMethod,
        paymentStatus: 'paid'
      });

      alert(`Payment of ₹${selectedOrder.totalAmount} processed successfully via ${paymentMethod}!`);
      
      // Reset selections
      setSelectedOrder(null);
      fetchUnpaidOrders();
    } catch (err) {
      alert('Failed to process payment: ' + err);
    }
  };

  // Tax calculations (GST = 5% split into CGST 2.5% and SGST 2.5%)
  const calculateTaxDetails = (amount: number) => {
    const subtotal = amount / 1.05; // 5% GST inclusive
    const gstTotal = amount - subtotal;
    const cgst = gstTotal / 2;
    const sgst = gstTotal / 2;
    return {
      subtotal: Math.round(subtotal),
      cgst: Math.round(cgst),
      sgst: Math.round(sgst),
      total: amount
    };
  };

  // Mock PDF/Invoice Downloader
  const downloadReceipt = () => {
    if (!selectedOrder) return;
    const taxes = calculateTaxDetails(selectedOrder.totalAmount);
    
    let receiptContent = `
=============================================
             CAKEFLOW AI - INVOICE           
=============================================
Invoice No: INV-${selectedOrder._id.slice(-6).toUpperCase()}
Date: ${new Date(selectedOrder.createdAt).toLocaleString()}
Table: Table ${selectedOrder.tableNumber}
Customer: ${selectedOrder.customerName}
---------------------------------------------
ITEMS:
`;

    selectedOrder.items.forEach(item => {
      const price = item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price;
      receiptContent += `${item.product.name.padEnd(25)} x${item.quantity}   ₹${price * item.quantity}\n`;
    });

    receiptContent += `
---------------------------------------------
Subtotal (GST Excl):        ₹${taxes.subtotal}
CGST (2.5%):                ₹${taxes.cgst}
SGST (2.5%):                ₹${taxes.sgst}
---------------------------------------------
GRAND TOTAL (GST Incl):     ₹${taxes.total}
=============================================
Payment Method: ${paymentMethod}
Payment Status: ${selectedOrder.paymentStatus.toUpperCase()}
Thank you! Visit again.
=============================================
`;

    // Download file
    const element = document.createElement("a");
    const file = new Blob([receiptContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Invoice_Table_${selectedOrder.tableNumber}_${selectedOrder._id.slice(-4)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      {/* Background gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md">
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">
              POS & Billing Counter
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">GST Invoice Processing and Settlement</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchUnpaidOrders}
            className="p-2 rounded-xl bg-slate-800/85 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          
          <button 
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-rose-400 bg-slate-800/35 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto p-6 z-10 grid md:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Side: Unpaid Orders Queue */}
        <section className="md:col-span-5 bg-slate-900/40 border border-slate-800/60 p-4 rounded-3xl space-y-4 backdrop-blur-md max-h-[80vh] flex flex-col">
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <h3 className="font-bold text-sm text-slate-200">Pending Bills</h3>
            <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
              {orders.length}
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {orders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <CheckCircle size={32} className="text-emerald-500 animate-pulse" />
                <p className="text-xs">All bills are settled!</p>
              </div>
            ) : (
              orders.map(order => (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full p-4 rounded-2xl text-left border transition-all flex justify-between items-center ${
                    selectedOrder?._id === order._id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-450 shadow'
                      : 'bg-slate-950/40 border-slate-800 text-slate-350 hover:bg-slate-900'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Table {order.tableNumber} - {order.customerName}</h4>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {order.items.length} items • Status: <span className="capitalize text-slate-400">{order.status}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-200 block">₹{order.totalAmount}</span>
                    <span className="text-[8px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Unpaid</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Right Side: Billing Console */}
        <section className="md:col-span-7 space-y-6">
          {selectedOrder ? (
            <div className="grid md:grid-cols-12 gap-6">
              {/* Invoice breakdown */}
              <div className="md:col-span-7 bg-slate-950/60 border border-slate-800 p-6 rounded-3xl space-y-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-900">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400">GST Invoice</span>
                    <h3 className="font-extrabold text-sm text-slate-200 mt-1">INV-{selectedOrder._id.slice(-6).toUpperCase()}</h3>
                  </div>
                  <button 
                    onClick={downloadReceipt}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-250 transition-colors flex items-center gap-1 text-[10px]"
                  >
                    <Printer size={13} />
                    <span>Download TXT</span>
                  </button>
                </div>

                {/* Items List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedOrder.items.map(item => {
                    const price = item.product.isOffer && item.product.discountPrice ? item.product.discountPrice : item.product.price;
                    return (
                      <div key={item._id} className="flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-slate-250">{item.product?.name}</p>
                          <p className="text-[9px] text-slate-500">₹{price} x {item.quantity}</p>
                        </div>
                        <span className="font-bold text-slate-200">₹{price * item.quantity}</span>
                      </div>
                    );
                  })}
                </div>

                {/* GST Calc Card */}
                {(() => {
                  const taxes = calculateTaxDetails(selectedOrder.totalAmount);
                  return (
                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-850 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal (Excl. Tax)</span>
                        <span>₹{taxes.subtotal}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>CGST (2.5%)</span>
                        <span>₹{taxes.cgst}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>SGST (2.5%)</span>
                        <span>₹{taxes.sgst}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 font-bold border-t border-slate-900 pt-2 text-slate-200">
                        <span>Total Tax (5% GST)</span>
                        <span>₹{taxes.cgst + taxes.sgst}</span>
                      </div>
                      <div className="flex justify-between font-black text-sm text-emerald-400 pt-1">
                        <span>Grand Total (Incl. Tax)</span>
                        <span>₹{taxes.total}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Settlement Panel */}
              <div className="md:col-span-5 bg-slate-900/30 border border-slate-800 p-6 rounded-3xl space-y-5 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Payment</h4>

                  <div className="space-y-2">
                    {[
                      { id: 'Cash', label: 'Cash', icon: <DollarSign size={14} /> },
                      { id: 'UPI', label: 'UPI / QR', icon: <Wallet size={14} /> },
                      { id: 'Credit Card', label: 'Credit Card', icon: <CreditCard size={14} /> },
                      { id: 'Debit Card', label: 'Debit Card', icon: <CreditCard size={14} /> },
                      { id: 'Split', label: 'Split Bill', icon: <Split size={14} /> }
                    ].map(method => (
                      <button
                        key={method.id}
                        onClick={() => {
                          setPaymentMethod(method.id as any);
                          setIsSplitMode(method.id === 'Split');
                        }}
                        className={`w-full p-3 rounded-xl border text-left text-xs transition-colors flex items-center gap-2.5 ${
                          paymentMethod === method.id 
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold' 
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-950'
                        }`}
                      >
                        {method.icon}
                        <span>{method.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Split payment inputs */}
                  {isSplitMode && (
                    <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Split Count</label>
                        <select
                          className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-emerald-400"
                          value={splitCount}
                          onChange={(e) => setSplitCount(Number(e.target.value))}
                        >
                          {[2, 3, 4, 5].map(n => (
                            <option key={n} value={n}>{n} Persons</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Each Pays: <span className="font-extrabold text-emerald-400">₹{Math.round(selectedOrder.totalAmount / splitCount)}</span>
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleProcessPayment}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all flex justify-center items-center gap-1.5 shadow-lg shadow-emerald-500/10 mt-6"
                >
                  <CheckCircle size={14} />
                  <span>Settle & Close Table</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-3xl text-slate-500 space-y-3">
              <FileText size={48} className="text-slate-800" />
              <p className="text-sm">Select a pending bill to view the invoice & settlement options.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
