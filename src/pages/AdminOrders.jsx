import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Printer, Search, User, Mail } from 'lucide-react';

// Status color mapping for consistent UI
const STATUS_THEMES = {
  CLAIMED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  COMPLETED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  RELEASED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  READY: 'bg-blue-50 text-blue-600 border-blue-100',
  AWAITING_VERIFICATION: 'bg-amber-50 text-amber-600 border-amber-100',
  PENDING: 'bg-slate-50 text-slate-500 border-slate-100',
};

export default function AdminOrders({ isStudentView = false }) {
  const { orders, printReceipt, user, api } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [dbStats, setDbStats] = useState({ totalCompleted: 0, todayCompleted: 0 });

  // 1. SYNC STATS
  const fetchDbStats = async () => {
    if (isStudentView || user?.role?.toLowerCase() !== 'admin') return;
    try {
      const res = await api(`/api/admin/stats?adminId=${user.id}`);
      if (res && res.success) {
        setDbStats({
          totalCompleted: res.data.totalCompleted || 0,
          todayCompleted: res.data.todayCompleted || 0
        });
      }
    } catch (err) {
      console.error("Stats sync failed:", err);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, [orders?.length, isStudentView]);

  // 2. SEARCH & FILTER LOGIC
  const historyOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];

    return orders.filter(o => {
      const status = String(o.status || "").toUpperCase().trim();
      const isFinished = ['CLAIMED', 'RELEASED', 'COMPLETED', 'DELIVERED'].includes(status);

      // Filter logic: Admin sees all, Student sees only their finished
      const isVisible = isStudentView ? isFinished : true;
      const isOwner = isStudentView ? String(o.user_id || o.userId) === String(user?.id) : true;

      const searchLower = searchTerm.toLowerCase();
      // FIX: Check both itemName and item_name for search matching
      const currentItemName = String(o.itemName || o.item_name || "");
      const nameMatch = currentItemName.toLowerCase().includes(searchLower);
      const studentNameMatch = String(o.full_name || "").toLowerCase().includes(searchLower);
      const emailMatch = String(o.email || "").toLowerCase().includes(searchLower);
      const idMatch = String(o.id).includes(searchLower);

      return isVisible && isOwner && (nameMatch || studentNameMatch || emailMatch || idMatch);
    });
  }, [orders, searchTerm, user?.id, isStudentView]);

  // 3. STATS CALCULATIONS
  const displayTotal = useMemo(() => dbStats.totalCompleted || historyOrders.length, [dbStats.totalCompleted, historyOrders.length]);

  const queueCount = useMemo(() => {
    return (orders || []).filter(o =>
      ['PENDING', 'AWAITING_VERIFICATION', 'READY', 'APPROVED'].includes(String(o.status).toUpperCase())
    ).length;
  }, [orders]);

  // FIX: Added logging to verify ID consistency during printing/scanning
  const handlePrintAction = (order) => {
    console.log(`Printing Ticket for Order ID: ${order.id} | Item: ${order.itemName || order.item_name}`);
    printReceipt(order);
  };

  return (
    <div className="space-y-8 p-4 text-left">
      {/* STATS PANEL */}
      {!isStudentView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-emerald-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Lifetime Claims</p>
            <h3 className="text-3xl font-black text-slate-900">{displayTotal}</h3>
          </div>
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm">
            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Database Record</p>
            <h3 className="text-3xl font-black text-slate-900">{dbStats.todayCompleted}</h3>
          </div>
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-amber-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Current Queue</p>
            <h3 className="text-3xl font-black text-slate-900">{queueCount}</h3>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic">
              {isStudentView ? "My Claim History" : "Past Transactions Audit"}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Auditor View</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search Name, Email, or Item..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-none rounded-xl text-sm font-bold shadow-inner focus:ring-2 ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80">
              <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-6 py-4">Ref ID</th>
                {!isStudentView && <th className="px-6 py-4">Recipient Detail</th>}
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4">Status</th>
                {!isStudentView && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historyOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                  {/* FIX: Ensure we are displaying the unique order.id */}
                  <td className="px-6 py-4 font-black text-slate-900">#{order.id}</td>

                  {!isStudentView && (
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 flex items-center gap-1 group-hover:text-emerald-600 transition-colors">
                          <User size={12} className="text-emerald-500" />
                          {order.full_name || "Guest Student"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Mail size={10} /> {order.email || `ID: ${order.userId || order.user_id}`}
                        </span>
                      </div>
                    </td>
                  )}

                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      {/* FIX: Use itemName with fallback to item_name for database compatibility */}
                      <span className="font-black text-slate-800">{order.itemName || order.item_name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{order.size}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[9px] font-black rounded-full border uppercase ${
                      STATUS_THEMES[order.status?.toUpperCase()] || STATUS_THEMES.PENDING
                    }`}>
                      {order.status}
                    </span>
                  </td>

                  {!isStudentView && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handlePrintAction(order)}
                        className="p-2.5 bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white rounded-xl transition-all active:scale-95 shadow-sm"
                        title="Re-print Audit Receipt"
                      >
                        <Printer size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {historyOrders.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-slate-300 font-black uppercase text-xs tracking-widest">No transaction history found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}