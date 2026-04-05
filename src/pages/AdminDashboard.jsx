import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package, Clock, AlertTriangle, Printer,
  CheckCircle, Power, Info, TrendingUp
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
  } = useApp();

  const currentStatus = officeStatus || 'OPEN';

  const handleToggle = async () => {
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const password = prompt(`Enter Admin Password to ${nextStatus} the system:`);
    if (!password) return;
    const result = await toggleOfficeStatus(nextStatus, password);
    if (!result.success) alert(result.error || "Update failed");
  };

  // --- DATA FILTERING & QUEUE LOGIC ---
  const ordersToVerify = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    return orders.filter(o => {
      const s = String(o.status || "").toUpperCase();
      return s === 'AWAITING_VERIFICATION' || s === 'VERIFYING';
    });
  }, [orders]); // Use 'orders' instead of 'orders.length'

  const activePickupQueue = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    return orders.filter(o => String(o.status || "").toUpperCase() === 'READY');
  }, [orders]); // Use 'orders' instead of 'orders.length'

  const displayQueue = useMemo(() => activePickupQueue.length, [activePickupQueue]);

  // 2. STOCK: Watch the whole 'items' array
  const lowStockCount = useMemo(() => {
    if (!items || !Array.isArray(items)) return 0;
    return items.filter(i => i && Number(i.is_low_stock) === 1).length;
  }, [items]); // Use 'items' instead of 'items.length'

  const totalUnits = useMemo(() => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((acc, item) => {
      const sizesObj = (item.sizes && typeof item.sizes === 'object') ? item.sizes : {};
      const itemTotal = Object.values(sizesObj).reduce((a, b) => a + (Number(b) || 0), 0);
      return acc + itemTotal;
    });
  }, [items]);

  // 3. STATS CARDS: Watch the derived memo results directly
  const statsCards = useMemo(() => [
    { label: 'To Verify', value: ordersToVerify.length, icon: AlertTriangle, color: 'bg-amber-500', tab: 'orders' },
    { label: 'Ready for Pickup', value: activePickupQueue.length, icon: Clock, color: 'bg-blue-500', tab: 'scanner' },
    { label: 'Low Stock', value: lowStockCount, icon: Info, color: 'bg-red-500', tab: 'inventory' },
    { label: 'Total Units', value: totalUnits, icon: Package, color: 'bg-emerald-500', tab: 'inventory' },
  ], [ordersToVerify, activePickupQueue, lowStockCount, totalUnits]);

  return (
    <div className="space-y-10 pb-12 text-left animate-in fade-in duration-700">

      {/* QUEUE & SYSTEM STATUS */}
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
              {String(displayQueue || 0).padStart(3, '0')}
            </span>
          </div>
        </div>

        <div className={`lg:col-span-4 p-8 rounded-[3.5rem] border-2 transition-all flex flex-col justify-between ${currentStatus === 'OPEN' ? 'bg-white border-emerald-100 shadow-sm' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-start">
            <div className={`p-4 rounded-2xl ${currentStatus === 'OPEN' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Power size={28} />
            </div>
            <button onClick={handleToggle} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${currentStatus === 'OPEN' ? 'bg-emerald-900 text-white' : 'bg-red-600 text-white'}`}>
              {currentStatus}
            </button>
          </div>
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">System Operations</h4>
            <p className="text-[11px] font-bold text-slate-400 mt-2 italic">Official System {currentStatus}</p>
          </div>
        </div>
      </div>

      {/* PERFORMANCE METRICS */}
      <section className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm no-print relative overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 relative z-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm">
                <TrendingUp size={20} />
              </div>
              Performance Metrics
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-time System Throughput
            </p>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex gap-2">
            <div className="px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data Points</p>
              <p className="text-sm font-black text-slate-900">{orders?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* 🛡️ STABLE RENDER STRATEGY: 
    We keep OrderAnalytics mounted 100% of the time so its hooks are stable.
    We only hide it visually if there is no data.
  */}
        <div className={orders && orders.length > 0 ? "block animate-in fade-in slide-in-from-bottom-4 duration-1000" : "hidden"}>
          <OrderAnalytics orders={orders || []} />
        </div>

        {/* 🛡️ EMPTY STATE (Conditional Rendering is safe here because this div has no hooks) */}
        {(!orders || orders.length === 0) && (
          <div className="py-24 text-center space-y-4 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <div className="mx-auto w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-200">
              <Package size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Awaiting Data Feed</p>
              <p className="text-[11px] font-bold text-slate-300 italic">Metrics will appear once the first order is placed.</p>
            </div>
          </div>
        )}
      </section>

      {/* VERIFICATION QUEUE */}
      <section className="bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-10 shadow-sm no-print">
        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter mb-8">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><AlertTriangle size={20} /></div>
          Awaiting Verification
        </h3>

        {ordersToVerify.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ordersToVerify.map(order => (
              <div key={order.id} className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between group hover:bg-white hover:border-emerald-200 transition-all">
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <p className="text-sm font-black text-slate-800 uppercase truncate">{order.item_name}</p>
                    <button onClick={() => printReceipt(order)} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 transition-all">
                      <Printer size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order Reference #{order.id}</p>
                </div>
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Verification Data</p>
                    {/* Priority 1: Check for a clickable URL */}
                    {order.receipt_url?.startsWith('http') ? (
                      <a href={order.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-mono font-bold text-blue-600 hover:underline truncate block">
                        View Attachment ↗
                      </a>
                    ) : (
                      /* Priority 2: Display the manual Reference Number (receipt_url or reference_number) */
                      <span className="text-xs font-mono font-bold text-emerald-700 break-all block">
                        {order.receipt_url || order.reference_number || "NO REF PROVIDED"}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const confirmAction = window.confirm("Verify payment and move to pickup queue?");
                      if (confirmAction) {
                        updateOrderStatusBulk([order.id], 'READY');
                      }
                    }}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-950 transition-all shadow-sm"
                  >
                    Verify & Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100">
            <CheckCircle className="mx-auto text-emerald-200 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pending verifications</p>
          </div>
        )}
      </section>

      {/* STATS TILES */}
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