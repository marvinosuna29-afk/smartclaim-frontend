import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package, Clock, AlertTriangle, Hash,
  CheckCircle, Power, Info, TrendingUp, Send, Loader2, Database, Camera,
  Image as ImageIcon // <--- Add this alias here
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

      {/* 1. RESTORED: PENDING APPROVAL SECTION (The "Reference Number" fix) */}
      <section className="no-print bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> Pending Verification
          </h3>
          <span className="bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-[10px] font-black uppercase">
            {ordersToVerify.length} Awaiting
          </span>
        </div>

        {ordersToVerify.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ordersToVerify.map(order => (
              <div key={order.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 group hover:border-emerald-300 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Order Ref</p>
                    <p className="font-black text-slate-900 uppercase text-sm">#{order.id}</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 font-mono text-[10px] font-bold text-slate-400">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Item:</span>
                    <span className="text-slate-900 uppercase">{order.itemName}</span>
                  </div>
                  {/* REFERENCE NUMBER / RECEIPT BOX */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Proof of Payment</p>
                    <p className="text-xs font-mono font-bold text-indigo-600 truncate">{order.receipt_url || "MANUAL_ENTRY_REQUIRED"}</p>
                  </div>
                </div>

                <button
                  disabled={processingId === order.id}
                  onClick={() => handleVerify(order)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  {processingId === order.id ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Approve Reference
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <CheckCircle className="mx-auto text-emerald-300 mb-2" size={32} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Clear</p>
          </div>
        )}
      </section>

      {/* 2. UPDATED: AUDIT TABLE WITH PRODUCT IMAGES */}
      <section className="bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-sm no-print">
        <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2 mb-8">
          <Package className="text-emerald-500" /> Inventory Catalog
        </h3>

        <div className="overflow-x-auto rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-6 py-5">Product</th>
                <th className="px-6 py-5 text-center">In Verification</th>
                <th className="px-6 py-5 text-center">Fulfilled</th>
                <th className="px-6 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {/* PRODUCT IMAGE SLOT */}
                      <div className="relative group w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={20} className="text-slate-300" />
                        )}
                        {/* Hidden File Input Trigger */}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <Camera size={16} className="text-white" />
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleImageChange(e, item.id)}
                          />
                        </label>
                      </div>
                      <div>
                        <p className="font-black text-slate-900 uppercase text-xs">{item.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">UID: {item.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-amber-500">
                    {normalizedOrders.filter(o => (o.itemName === item.name || String(o.item_id) === String(item.id)) && ['AWAITING_VERIFICATION', 'VERIFYING'].includes(o.status)).length}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-500">
                    {normalizedOrders.filter(o => (o.itemName === item.name || String(o.item_id) === String(item.id)) && ['READY', 'CLAIMED', 'COMPLETED'].includes(o.status)).length}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-[8px] font-black px-2 py-1 rounded-full ${item.is_low_stock == 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {item.is_low_stock == 1 ? 'LOW STOCK' : 'OPTIMAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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