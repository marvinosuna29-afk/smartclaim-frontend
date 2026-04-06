import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package, Clock, AlertTriangle, Hash,
  CheckCircle, Power, Info, TrendingUp, Send, Loader2
} from 'lucide-react';
import OrderAnalytics from '../components/OrderAnalytics';

export default function AdminDashboard({ setActiveTab }) {
  const {
    items = [],
    orders = [],
    officeStatus,
    toggleOfficeStatus,
    updateOrderStatusBulk,
    printReceipt, 
    refreshData
  } = useApp();

  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (typeof refreshData === 'function') refreshData();
    const heartbeat = setInterval(() => {
      if (typeof refreshData === 'function') refreshData();
    }, 15000); // 15s is safer for server load
    return () => clearInterval(heartbeat);
  }, [refreshData]);

  const currentStatus = officeStatus || 'OPEN';

  const handleToggle = async () => {
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const password = prompt(`Enter Admin Password to ${nextStatus}:`);
    if (!password) return;
    const result = await toggleOfficeStatus(nextStatus, password);
    if (!result?.success) alert(result?.error || "Update failed");
  };

  // --- DATA FILTERING ---
  const ordersToVerify = useMemo(() => 
    (orders || []).filter(o => ['AWAITING_VERIFICATION', 'VERIFYING'].includes(String(o.status || "").toUpperCase())),
  [orders]);

  const activePickupQueue = useMemo(() => 
    (orders || []).filter(o => String(o.status || "").toUpperCase().trim() === 'READY'),
  [orders]);

  const lowStockCount = useMemo(() => 
    (items || []).filter(i => Number(i.is_low_stock) === 1).length,
  [items]);

  const totalUnits = useMemo(() => {
    return items.reduce((acc, item) => {
      const sizesObj = (item.sizes && typeof item.sizes === 'object') ? item.sizes : {};
      return acc + Object.values(sizesObj).reduce((a, b) => a + (Number(b) || 0), 0);
    }, 0);
  }, [items]);

  const statsCards = useMemo(() => [
    { label: 'To Verify', value: ordersToVerify.length, icon: AlertTriangle, color: 'bg-amber-500', tab: 'orders' },
    { label: 'Ready for Pickup', value: activePickupQueue.length, icon: Clock, color: 'bg-blue-500', tab: 'scanner' },
    { label: 'Low Stock', value: lowStockCount, icon: Info, color: 'bg-red-500', tab: 'inventory' },
    { label: 'Total Units', value: totalUnits, icon: Package, color: 'bg-emerald-500', tab: 'inventory' },
  ], [ordersToVerify.length, activePickupQueue.length, lowStockCount, totalUnits]);

  const handleVerify = async (order) => {
    if (processingId) return;
    if (!window.confirm(`Verify Order #${order.id}?`)) return;

    setProcessingId(order.id);
    try {
      await updateOrderStatusBulk([order.id], 'READY');
      if (printReceipt) await printReceipt(order);
      refreshData?.();
    } catch (err) {
      alert("Process failed.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-10 pb-12 text-left animate-in fade-in duration-700">
      
      {/* 1. HEADER (no-print) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch no-print">
        <div className="lg:col-span-8 bg-slate-950 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">System Live</span>
            </div>
            <h2 className="text-5xl font-black uppercase tracking-tighter leading-tight">
              Current <br /><span className="text-emerald-500">Queue</span>
            </h2>
          </div>
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[4rem] text-center min-w-[220px] z-10">
            <span className="text-8xl xl:text-9xl font-black tracking-tighter text-white">
              {String(activePickupQueue.length).padStart(3, '0')}
            </span>
          </div>
        </div>

        <div className={`lg:col-span-4 p-8 rounded-[3.5rem] border-2 transition-all flex flex-col justify-between ${currentStatus === 'OPEN' ? 'bg-white border-emerald-100' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-start">
            <div className={`p-4 rounded-2xl ${currentStatus === 'OPEN' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Power size={28} />
            </div>
            <button onClick={handleToggle} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${currentStatus === 'OPEN' ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'}`}>
              {currentStatus}
            </button>
          </div>
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Status</h4>
            <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase">{currentStatus} FOR TRANSACTIONS</p>
          </div>
        </div>
      </div>

      {/* 2. ANALYTICS & AUDIT (This section must be visible to print!) */}
      <section className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <TrendingUp className="text-emerald-500" /> System Audit Intelligence
            </h3>
            <p className="hidden print:block text-[10px] font-bold text-slate-400 mt-1 uppercase">Generated: {new Date().toLocaleString()}</p>
          </div>

          <div className="flex gap-3 no-print">
            <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2">
              <Hash size={14} /> Print Audit Log
            </button>
          </div>
        </div>

        {/* CHART - Hidden on print to save ink/space if you only want the table */}
        <div className="w-full mb-12 no-print" style={{ height: '300px' }}>
          <OrderAnalytics orders={orders} />
        </div>

        {/* AUDIT TABLE - Visible on Screen AND Print */}
        <div className="overflow-hidden rounded-[2.5rem] border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-8 py-5">Product</th>
                <th className="px-8 py-5 text-center">Pending</th>
                <th className="px-8 py-5 text-center">Completed</th>
                <th className="px-8 py-5 text-center">Total</th>
                <th className="px-8 py-5 text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => {
                const itemOrders = orders.filter(o => o.item_name === item.name);
                const pending = itemOrders.filter(o => ['AWAITING_VERIFICATION', 'VERIFYING'].includes(o.status)).length;
                const done = itemOrders.filter(o => ['READY', 'CLAIMED', 'COMPLETED'].includes(o.status)).length;
                
                return (
                  <tr key={item.id} className="text-sm">
                    <td className="px-8 py-5 font-black text-slate-900 uppercase">{item.name}</td>
                    <td className="px-8 py-5 text-center font-bold text-amber-500">{pending}</td>
                    <td className="px-8 py-5 text-center font-bold text-emerald-500">{done}</td>
                    <td className="px-8 py-5 text-center font-bold text-slate-400">{itemOrders.length}</td>
                    <td className="px-8 py-5 text-right">
                      <span className={`text-[10px] font-black px-2 py-1 rounded ${item.is_low_stock == 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {item.is_low_stock == 1 ? 'LOW' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. VERIFICATION QUEUE (no-print) */}
      <section className="no-print bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" /> Awaiting Verification
        </h3>
        {ordersToVerify.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ordersToVerify.map(order => (
              <div key={order.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="font-black text-slate-800 uppercase text-sm truncate">{order.item_name}</p>
                    <span className="text-[10px] font-bold text-slate-400">#{order.id}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl mb-4 border border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ref/Receipt</p>
                    <p className="text-xs font-mono font-bold text-indigo-600 truncate">{order.receipt_url || "NONE"}</p>
                  </div>
                </div>
                <button
                  disabled={processingId === order.id}
                  onClick={() => handleVerify(order)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                >
                  {processingId === order.id ? <Loader2 className="animate-spin" size={14}/> : <Send size={14} />}
                  Verify Payment
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
            <CheckCircle className="mx-auto text-emerald-200 mb-2" size={40} />
            <p className="text-[10px] font-black text-slate-400 uppercase">All clear</p>
          </div>
        )}
      </section>

      {/* 4. STATS TILES (no-print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        {statsCards.map((stat, i) => (
          <button key={i} onClick={() => setActiveTab(stat.tab)} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all text-left group">
            <div className={`${stat.color} p-4 rounded-2xl text-white w-fit mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h2>
          </button>
        ))}
      </div>
    </div>
  );
}