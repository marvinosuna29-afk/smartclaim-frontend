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
    printReceipt, // 📡 Now triggers Discord Webhook
    refreshData
  } = useApp();

  const [processingId, setProcessingId] = useState(null);

  // 🛡️ HEARTBEAT REFRESH: Keeps data live every 10 seconds
  useEffect(() => {
    if (typeof refreshData === 'function') refreshData();
    const heartbeat = setInterval(() => {
      if (typeof refreshData === 'function') refreshData();
    }, 10000);
    return () => clearInterval(heartbeat);
  }, [refreshData]);

  const currentStatus = officeStatus || 'OPEN';

  const handleToggle = async () => {
    if (typeof toggleOfficeStatus !== 'function') return;
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const password = prompt(`Enter Admin Password to ${nextStatus} the system:`);
    if (!password) return;
    const result = await toggleOfficeStatus(nextStatus, password);
    if (!result?.success) alert(result?.error || "Update failed");
  };

  // --- DATA FILTERING ---
  const ordersToVerify = useMemo(() => {
    return (orders || []).filter(o => {
      const s = String(o.status || "").toUpperCase();
      return s === 'AWAITING_VERIFICATION' || s === 'VERIFYING';
    });
  }, [orders]);

  const activePickupQueue = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];

    return orders.filter(o => {
      // 🛡️ STRICT CHECK: Order must have a valid ID AND the status must be 'READY'
      const hasValidId = o && (o.id !== undefined && o.id !== null);
      const isReady = String(o.status || "").toUpperCase().trim() === 'READY';

      return hasValidId && isReady;
    });
  }, [orders]);

  const lowStockCount = useMemo(() => {
    return (items || []).filter(i => i && Number(i.is_low_stock) === 1).length;
  }, [items]);

  const totalUnits = useMemo(() => {
    if (!items || items.length === 0) return 0;
    return items.reduce((acc, item) => {
      if (!item) return acc;
      const sizesObj = (item.sizes && typeof item.sizes === 'object') ? item.sizes : {};
      return acc + Object.values(sizesObj).reduce((a, b) => a + (Number(b) || 0), 0);
    }, 0);
  }, [items]);

  const statsCards = useMemo(() => [
    { label: 'To Verify', value: ordersToVerify.length, icon: AlertTriangle, color: 'bg-amber-500', tab: 'orders' },
    { label: 'Ready for Pickup', value: activePickupQueue.length, icon: Clock, color: 'bg-blue-500', tab: 'scanner' },
    { label: 'Low Stock', value: lowStockCount, icon: Info, color: 'bg-red-500', tab: 'inventory' },
    { label: 'Total Units', value: totalUnits, icon: Package, color: 'bg-emerald-500', tab: 'inventory' },
  ], [ordersToVerify, activePickupQueue, lowStockCount, totalUnits]);

  // 🚀 AUTOMATED VERIFICATION HANDLER
  const handleVerify = async (order) => {
    if (!order.id || processingId) return;

    const confirmAction = window.confirm(`Verify payment for Order #${order.id}? This will also sync the receipt to Discord.`);
    if (!confirmAction) return;

    setProcessingId(order.id);
    try {
      // 1. Update status in Database
      await updateOrderStatusBulk([order.id], 'READY');

      // 2. Trigger Discord Webhook (the old printReceipt function)
      if (typeof printReceipt === 'function') {
        await printReceipt(order);
      }

      // 3. Refresh UI
      if (typeof refreshData === 'function') refreshData();
    } catch (err) {
      console.error("Verification error:", err);
      alert("Process failed. Please check connection.");
    } finally {
      setProcessingId(null);
    }
  };

  // --- RESTORED AUDIT LOG LOGIC ---
  const auditSummary = useMemo(() => {
    return (items || []).map(item => {
      const itemOrders = (orders || []).filter(o =>
        o.item_id === item.id || o.item_name === item.name
      );
      const completed = itemOrders.filter(o =>
        ['CLAIMED', 'COMPLETED', 'RELEASED', 'READY'].includes(String(o.status).toUpperCase())
      ).length;

      return {
        ...item,
        orderCount: itemOrders.length,
        completedCount: completed
      };
    });
  }, [items, orders]);

  return (
    <div className="space-y-10 pb-12 text-left animate-in fade-in duration-700">

      {/* 1. HEADER SECTION: SERVER STATUS & QUEUE (no-print) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch no-print">
        <div className="lg:col-span-8 bg-slate-950 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Live Server Connected</span>
            </div>
            <h2 className="text-5xl font-black uppercase tracking-tighter leading-tight">
              Current <br /><span className="text-emerald-500">Serving</span>
            </h2>
          </div>
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[4rem] text-center min-w-[220px] z-10">
            <span className="text-8xl xl:text-9xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              {String(activePickupQueue.length || 0).padStart(3, '0')}
            </span>
          </div>
        </div>

        <div className={`lg:col-span-4 p-8 rounded-[3.5rem] border-2 transition-all flex flex-col justify-between ${currentStatus === 'OPEN' ? 'bg-white border-emerald-100 shadow-sm' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-start">
            <div className={`p-4 rounded-2xl ${currentStatus === 'OPEN' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Power size={28} />
            </div>
            <button onClick={handleToggle} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 ${currentStatus === 'OPEN' ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'}`}>
              {currentStatus}
            </button>
          </div>
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">System Operations</h4>
            <p className="text-[11px] font-bold text-slate-400 mt-2 italic">Official System Status: {currentStatus}</p>
          </div>
        </div>
      </div>

      {/* RESTORED HIGH-INFO ANALYTICS & AUDIT SECTION */}
      <section className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl no-print" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 relative z-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm">
                <TrendingUp size={20} />
              </div>
              System Audit Intelligence
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 no-print">
              Detailed Inventory Throughput & Order Analytics
            </p>
          </div>

          <div className="flex gap-3 no-print">
            <button
              onClick={() => refreshData?.()}
              className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-emerald-600 transition-all border border-slate-100"
              title="Refresh Data"
            >
              <Loader2 size={18} className={processingId ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <Hash size={14} /> Export Audit Report
            </button>
          </div>
        </div>

        {/* 📈 THE CHART (Restored & Stabilized) */}
        <div className="w-full mb-12 no-print" style={{ minHeight: '300px', height: '300px' }}>
          {orders && orders.length > 0 ? (
            <OrderAnalytics orders={orders} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <Package className="text-slate-200 mb-2" size={32} />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initializing Data Streams...</p>
            </div>
          )}
        </div>

        {/* 📋 THE "INFORMATIVE" AUDIT TABLE (The core data you missed) */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6 no-print">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
              Live Order Distribution
            </h4>
          </div>

          <div className="overflow-x-auto no-scrollbar rounded-[2.5rem] border border-slate-100 bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="px-8 py-6">Product Item</th>
                  <th className="px-8 py-6 text-center">In-Queue</th>
                  <th className="px-8 py-6 text-center">Ready/Released</th>
                  <th className="px-8 py-6 text-center">Total Volume</th>
                  <th className="px-8 py-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => {
                  const itemOrders = orders.filter(o => o.item_name === item.name || o.item_id === item.id);
                  const pendingCount = itemOrders.filter(o => ['AWAITING_VERIFICATION', 'VERIFYING'].includes(o.status?.toUpperCase())).length;
                  const successCount = itemOrders.filter(o => ['READY', 'CLAIMED', 'COMPLETED'].includes(o.status?.toUpperCase())).length;

                  return (
                    <tr key={item.id} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-sm uppercase group-hover:text-emerald-600 transition-colors">{item.name}</span>
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Inventory Ref: {item.id}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`font-mono font-bold ${pendingCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                          {pendingCount}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="font-mono font-bold text-emerald-500">
                          {successCount}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
                          <span className="text-xs font-black text-slate-600">{itemOrders.length}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {item.is_low_stock == 1 ? (
                          <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase tracking-tighter italic">Low Stock</span>
                        ) : (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-1 rounded-md uppercase tracking-tighter">Healthy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PRINT-ONLY AUDIT FOOTER */}
        <div className="hidden print:flex justify-between items-center mt-12 pt-8 border-t-2 border-slate-900">
          <div className="text-[10px] font-black uppercase text-slate-400">SmartClaim Internal Audit Log</div>
          <div className="text-[10px] font-black uppercase text-slate-900">End of Report</div>
        </div>
      </section>

      {/* 3. VERIFICATION QUEUE (no-print) */}
      <section className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm no-print">
        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter mb-8">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><AlertTriangle size={20} /></div>
          Awaiting Verification
        </h3>

        {ordersToVerify.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ordersToVerify.map(order => (
              <div key={order.id} className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between group hover:bg-white hover:border-indigo-200 transition-all shadow-hover">
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <p className="text-sm font-black text-slate-800 uppercase truncate">{order.item_name}</p>
                    <button
                      onClick={() => printReceipt?.(order)}
                      title="Sync to Discord"
                      className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
                    >
                      <Hash size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ref #{order.id}</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Attachment</p>
                    {order.receipt_url?.startsWith('http') ? (
                      <a href={order.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-mono font-bold text-blue-600 hover:underline truncate block">
                        View Receipt ↗
                      </a>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-700 break-all block">
                        {order.receipt_url || order.reference_number || "NO REF"}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={processingId === order.id}
                    onClick={() => handleVerify(order)}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-950 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {processingId === order.id ? 'Processing...' : 'Verify & Send Receipt'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100">
            <CheckCircle className="mx-auto text-emerald-200 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queue Clear</p>
          </div>
        )}
      </section>

      {/* 4. STATS TILES (no-print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        {statsCards.map((stat, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(stat.tab)}
            className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all text-left group active:scale-95"
          >
            <div className={`${stat.color} p-4 rounded-[1.5rem] text-white w-fit mb-6 shadow-lg group-hover:rotate-6 transition-transform`}>
              <stat.icon size={26} />
            </div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h2>
          </button>
        ))}
      </div>
    </div>
  );
}