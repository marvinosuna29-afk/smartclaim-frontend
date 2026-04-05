import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Printer, Search, User, Mail, Package, AlertCircle } from 'lucide-react';

// 🛡️ ENHANCED: Added fallbacks for every possible status
const STATUS_THEMES = {
  CLAIMED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  COMPLETED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  RELEASED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  READY: 'bg-blue-50 text-blue-600 border-blue-100',
  APPROVED: 'bg-blue-50 text-blue-600 border-blue-100',
  AWAITING_VERIFICATION: 'bg-amber-50 text-amber-600 border-amber-100',
  PENDING: 'bg-slate-50 text-slate-500 border-slate-100',
};

export default function AdminOrders({ isStudentView = false }) {
  const { orders, printReceipt, user, api } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [dbStats, setDbStats] = useState({ totalCompleted: 0, todayCompleted: 0 });

  // 1. SYNC STATS FROM BACKEND
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

  // 2. DEFENSIVE SEARCH & FILTER LOGIC
  const historyOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];

    return orders.filter(o => {
      // 🛡️ DATA NORMALIZATION: Handle snake_case vs camelCase from DB
      const status = String(o.status || "").toUpperCase().trim();
      const currentUserId = String(o.userId || o.user_id || "");
      const currentItemName = String(o.itemName || o.item_name || o.name || "Unknown Item");
      const currentFullName = String(o.full_name || o.fullName || "Guest Student");
      const currentEmail = String(o.email || "");
      const currentOrderId = String(o.id || "");

      // Visibility: Admin sees all, Students see only their finished claims
      const finishedStatuses = ['CLAIMED', 'RELEASED', 'COMPLETED', 'DELIVERED'];
      const isFinished = finishedStatuses.includes(status);
      
      const isVisible = isStudentView ? isFinished : true;
      const isOwner = isStudentView ? currentUserId === String(user?.id) : true;

      // Multi-Field Search
      const searchLower = searchTerm.toLowerCase();
      const matches = [
        currentItemName.toLowerCase(),
        currentFullName.toLowerCase(),
        currentEmail.toLowerCase(),
        currentOrderId
      ].some(field => field.includes(searchLower));

      return isVisible && isOwner && matches;
    });
  }, [orders, searchTerm, user?.id, isStudentView]);

  // 3. ENHANCED STATS CALCULATIONS
  const displayTotal = useMemo(() => 
    dbStats.totalCompleted || historyOrders.filter(o => 
      ['CLAIMED', 'COMPLETED'].includes(String(o.status).toUpperCase())
    ).length, 
    [dbStats.totalCompleted, historyOrders]
  );

  const queueCount = useMemo(() => {
    if (!orders) return 0;
    // 🛡️ EXCLUSION LOGIC: If it's not finished/cancelled, it's in the queue.
    const finishedStatuses = ['CLAIMED', 'RELEASED', 'COMPLETED', 'DELIVERED', 'REJECTED', 'CANCELLED'];
    return orders.filter(o => {
      const s = String(o.status || "").toUpperCase().trim();
      return s !== "" && !finishedStatuses.includes(s);
    }).length;
  }, [orders]);

  const handlePrintAction = (order) => {
    console.log(`🖨️ Printing Ticket: ID #${order.id}`);
    printReceipt(order);
  };

  return (
    <div className="space-y-8 p-4 text-left animate-in fade-in duration-500">
      {/* STATS PANEL */}
      {!isStudentView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-emerald-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Lifetime Claims</p>
            <h3 className="text-3xl font-black text-slate-900">{displayTotal}</h3>
          </div>
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-blue-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Today's Total</p>
            <h3 className="text-3xl font-black text-slate-900">{dbStats.todayCompleted}</h3>
          </div>
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-amber-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Live Queue</p>
            <h3 className="text-3xl font-black text-slate-900">{queueCount}</h3>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic">
              {isStudentView ? "My Claim History" : "Audit Log & Records"}
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live System Feed</p>
            </div>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search ID, Name, or Item..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:ring-2 ring-emerald-500 transition-all outline-none"
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
                {!isStudentView && <th className="px-6 py-4">Student</th>}
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">Status</th>
                {!isStudentView && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historyOrders.map((order, index) => (
                <tr key={order.id || `row-${index}`} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-black text-slate-900">
                    <span className="text-slate-300 mr-1">#</span>{order.id}
                  </td>

                  {!isStudentView && (
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 flex items-center gap-1 group-hover:text-emerald-600 transition-colors">
                          <User size={12} className="text-emerald-500" />
                          {order.full_name || order.fullName || "Guest"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Mail size={10} /> {order.email || `ID: ${order.user_id || order.userId}`}
                        </span>
                      </div>
                    </td>
                  )}

                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 flex items-center gap-1">
                        <Package size={12} className="text-slate-400" />
                        {order.itemName || order.item_name}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-black uppercase bg-emerald-50 w-fit px-1.5 rounded">
                        {order.size}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[9px] font-black rounded-full border uppercase tracking-tighter ${
                      STATUS_THEMES[String(order.status).toUpperCase()] || STATUS_THEMES.PENDING
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
            <div className="p-20 text-center flex flex-col items-center gap-2">
              <AlertCircle className="text-slate-200" size={48} />
              <p className="text-slate-300 font-black uppercase text-xs tracking-widest">No matching records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}