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

  // 1. Initial & Heartbeat Sync
  useEffect(() => {
    refreshData?.();
    const hb = setInterval(() => refreshData?.(), 30000);
    return () => clearInterval(hb);
  }, [refreshData]);

  // 2. DATA NORMALIZATION
  const normalizedOrders = useMemo(() => {
    return orders.map(o => {
      // Ensure we have a valid date string
      const rawDate = o.created_at || o.date || new Date().toISOString();
      return {
        ...o,
        status: String(o.status || 'PENDING').toUpperCase().trim(),
        itemName: (o.item_name || o.itemName || "").trim(),
        chartDate: rawDate // Guaranteed string
      };
    });
  }, [orders]);

  const currentStatus = officeStatus || 'OPEN';

  // --- STATS LOGIC ---
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
    <div className="space-y-10 pb-12 text-left animate-in fade-in duration-700">

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur p-4 rounded-3xl shadow-xl border border-slate-100 flex items-center gap-3">
          <Loader2 className="animate-spin text-emerald-500" size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Syncing Aiven...</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch no-print">
        <div className="lg:col-span-8 bg-slate-950 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Inventory Intelligence</span>
            </div>
            <h2 className="text-5xl font-black uppercase tracking-tighter leading-tight">
              Ready <br /><span className="text-emerald-500">Pickups</span>
            </h2>
          </div>
          <div className="bg-white/5 border border-white/10 p-10 rounded-[4rem] text-center min-w-[220px] z-10">
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
            <button onClick={() => toggleOfficeStatus(currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${currentStatus === 'OPEN' ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'}`}>
              {currentStatus}
            </button>
          </div>
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Office Control</h4>
            <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase">Gatekeeper Status</p>
          </div>
        </div>
      </div>

      {/* ANALYTICS & AUDIT */}
      <section className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <TrendingUp className="text-emerald-500" /> System Audit Log
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Real-time throughput data</p>
          </div>
          <button onClick={() => window.print()} className="no-print px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2">
            <Hash size={14} /> Generate Report
          </button>
        </div>

        {/* --- FIXED CHART AREA --- */}
        <div
          className="w-full mb-12 bg-slate-50 rounded-[2.5rem] p-6 border border-slate-100 relative"
          style={{
            height: '450px',
            minHeight: '450px',
            overflow: 'visible' // Important for Recharts tooltips
          }}
        >
          {/* Add a console log here temporarily to see if data exists when rendering */}
          {console.log("Dashboard passing to chart:", normalizedOrders)}

          {normalizedOrders && normalizedOrders.length > 0 ? (
            <OrderAnalytics orders={normalizedOrders} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Database size={48} className="mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Database Feed...</p>
            </div>
          )}
        </div>

        {/* AUDIT TABLE */}
        <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-8 py-5">Asset Name</th>
                <th className="px-8 py-5 text-center">In Verification</th>
                <th className="px-8 py-5 text-center">Fulfilled</th>
                <th className="px-8 py-5 text-center">Total Requests</th>
                <th className="px-8 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => {
                const itemOrders = normalizedOrders.filter(o =>
                  o.itemName === item.name || String(o.item_id) === String(item.id)
                );
                const pending = itemOrders.filter(o => ['AWAITING_VERIFICATION', 'VERIFYING'].includes(o.status)).length;
                const done = itemOrders.filter(o => ['READY', 'CLAIMED', 'COMPLETED'].includes(o.status)).length;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 font-black text-slate-900 uppercase text-xs">{item.name}</td>
                    <td className="px-8 py-5 text-center font-bold text-amber-500">{pending}</td>
                    <td className="px-8 py-5 text-center font-bold text-emerald-500">{done}</td>
                    <td className="px-8 py-5 text-center font-bold text-slate-400">{itemOrders.length}</td>
                    <td className="px-8 py-5 text-right">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full ${item.is_low_stock == 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {item.is_low_stock == 1 ? 'CRITICAL' : 'OPTIMAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* VERIFICATION QUEUE */}
      <section className="no-print bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" /> Pending Approval
        </h3>
        {ordersToVerify.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ordersToVerify.map(order => (
              <div key={order.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 group hover:border-emerald-300 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Order Ref</p>
                    <p className="font-black text-slate-900 uppercase text-sm">#{order.id}</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                    <Package size={18} className="text-slate-400" />
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Item:</span>
                    <span className="text-slate-900 uppercase">{order.itemName}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Receipt/Ref</p>
                    <p className="text-xs font-mono font-bold text-indigo-600 truncate">{order.receipt_url || "NO_DATA_SYNCED"}</p>
                  </div>
                </div>

                <button
                  disabled={processingId === order.id}
                  onClick={() => handleVerify(order)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  {processingId === order.id ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Verify & Notify
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <CheckCircle className="mx-auto text-emerald-300 mb-2" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Queue Fully Verified</p>
          </div>
        )}
      </section>

      {/* STATS TILES */}
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