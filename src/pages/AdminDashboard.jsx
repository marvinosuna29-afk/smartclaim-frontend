import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package, Clock, AlertTriangle, Hash,
  CheckCircle, Power, Info, TrendingUp, Send, Loader2, Database
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
    refreshData,
    loading
  } = useApp();

  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    refreshData?.();
    const hb = setInterval(() => refreshData?.(), 30000);
    return () => clearInterval(hb);
  }, [refreshData]);

  const normalizedOrders = useMemo(() => {
    return orders.map(o => {
      const rawDate = o.created_at || o.date || o.chartDate || new Date().toISOString();
      return {
        ...o,
        status: String(o.status || 'PENDING').toUpperCase().trim(),
        itemName: (o.item_name || o.itemName || "").trim(),
        created_at: rawDate,
        chartDate: rawDate
      };
    });
  }, [orders]);

  const currentStatus = officeStatus || 'OPEN';

  const ordersToVerify = useMemo(() =>
    normalizedOrders.filter(o => ['AWAITING_VERIFICATION', 'VERIFYING'].includes(o.status)),
    [normalizedOrders]);

  const activePickupQueue = useMemo(() =>
    normalizedOrders.filter(o => o.status === 'READY'),
    [normalizedOrders]);

  const lowStockCount = useMemo(() =>
    items.filter(i => Number(i.is_low_stock) === 1).length,
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
    setProcessingId(order.id);
    try {
      const ok = await updateOrderStatusBulk([order.id], 'READY');
      if (ok.success) {
        if (printReceipt) await printReceipt(order);
        refreshData?.();
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-12 text-left animate-in fade-in duration-700 px-2 md:px-0">

      {loading && (
        <div className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur p-4 rounded-3xl shadow-xl border border-slate-100 flex items-center gap-3 no-print">
          <Loader2 className="animate-spin text-emerald-500" size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Syncing...</span>
        </div>
      )}

      {/* HEADER SECTION - RESPONSIVE TWEAKS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-stretch no-print">
        <div className="lg:col-span-8 bg-slate-950 p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] text-white shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden text-center md:text-left">
          <div className="relative z-10">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2 md:mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Inventory Intelligence</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight">
              Ready <br className="hidden md:block" /><span className="text-emerald-500">Pickups</span>
            </h2>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] text-center min-w-[140px] md:min-w-[220px] z-10">
            <span className="text-6xl md:text-9xl font-black tracking-tighter text-white">
              {String(activePickupQueue.length).padStart(3, '0')}
            </span>
          </div>
        </div>

        <div className={`lg:col-span-4 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] border-2 transition-all flex flex-row lg:flex-col justify-between items-center lg:items-start ${currentStatus === 'OPEN' ? 'bg-white border-emerald-100' : 'bg-red-50 border-red-200'}`}>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:w-full lg:items-start items-center">
            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl mb-0 lg:mb-4 ${currentStatus === 'OPEN' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Power size={24} md:size={28} />
            </div>
            <button onClick={() => toggleOfficeStatus(currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN')} className={`px-4 py-2 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest ${currentStatus === 'OPEN' ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'}`}>
              {currentStatus}
            </button>
          </div>
          <div className="text-right lg:text-left">
            <h4 className="text-[8px] md:text-[10px] font-black uppercase text-slate-800 tracking-widest">Office Control</h4>
            <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase">Gatekeeper</p>
          </div>
        </div>
      </div>

      {/* ANALYTICS - SCROLLABLE TABLE ON MOBILE */}
      <section className="bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-sm relative no-print">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={20} /> System Audit Log
            </h3>
          </div>
          <button onClick={() => window.print()} className="w-full md:w-auto px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
            <Hash size={14} /> Generate Report
          </button>
        </div>

        <div className="w-full mb-8 md:mb-12 bg-slate-50 rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-6 border border-slate-100 relative h-[300px] md:h-[450px]">
          {normalizedOrders.length > 0 ? (
            <OrderAnalytics orders={normalizedOrders} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Database size={32} className="mb-4 opacity-20" />
              <p className="text-[8px] font-black uppercase tracking-widest">Awaiting Feed...</p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-4 md:px-8 py-4 md:py-5">Asset</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-center">Verify</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-center">Done</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-center">Total</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => {
                const itemOrders = normalizedOrders.filter(o => o.itemName === item.name || String(o.item_id) === String(item.id));
                const pending = itemOrders.filter(o => ['AWAITING_VERIFICATION', 'VERIFYING'].includes(o.status)).length;
                const done = itemOrders.filter(o => ['READY', 'CLAIMED', 'COMPLETED'].includes(o.status)).length;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 md:px-8 py-4 font-black text-slate-900 uppercase text-[10px] md:text-xs">{item.name}</td>
                    <td className="px-4 md:px-8 py-4 text-center font-bold text-amber-500">{pending}</td>
                    <td className="px-4 md:px-8 py-4 text-center font-bold text-emerald-500">{done}</td>
                    <td className="px-4 md:px-8 py-4 text-center font-bold text-slate-400">{itemOrders.length}</td>
                    <td className="px-4 md:px-8 py-4 text-right">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full ${item.is_low_stock == 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
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

      {/* STATS CARDS - 2x2 GRID ON MOBILE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 no-print">
        {statsCards.map((stat, i) => (
          <button key={i} onClick={() => setActiveTab(stat.tab)}
            className="bg-white p-4 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border border-slate-100 shadow-sm transition-all text-left active:scale-95 group">
            <div className={`${stat.color} p-2.5 md:p-4 rounded-xl md:rounded-2xl text-white w-fit mb-2 md:mb-6 shadow-lg`}>
              <stat.icon size={18} className="md:w-6 md:h-6" />
            </div>
            <p className="text-slate-400 font-black text-[7px] md:text-[10px] uppercase tracking-widest mb-0.5 md:mb-1">{stat.label}</p>
            <h2 className="text-xl md:text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h2>
          </button>
        ))}
      </div>
    </div>
  );
}