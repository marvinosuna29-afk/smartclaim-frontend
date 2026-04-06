import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Hash, Search, User, Mail, Package, AlertCircle, Check } from 'lucide-react';

// 🛡️ THEME MAPPING: Standardized colors for status badges
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

  // 🔄 Local State for UI Feedback
  const [syncingId, setSyncingId] = useState(null);
  const [lastSyncedId, setLastSyncedId] = useState(null);

  // 1. SYNC STATS FROM BACKEND
  const fetchDbStats = async () => {
    if (isStudentView || user?.role?.toLowerCase() !== 'admin') return;
    if (typeof api !== 'function') return;

    try {
      const res = await api(`/api/admin/stats?adminId=${user.id}`);
      if (res?.ok && res?.data) {
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
    if (user?.id && typeof api === 'function') {
      fetchDbStats();
    }
  }, [orders?.length, isStudentView, user?.id]);

  // 2. SEARCH & FILTER LOGIC (🛡️ DATA NORMALIZED)
  const historyOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];

    return orders.filter(o => {
      const status = String(o.status || "").toUpperCase().trim();
      const currentUserId = String(o.userId || o.user_id || "");
      const currentItemName = String(o.itemName || o.item_name || o.name || "Unknown Item");
      const currentFullName = String(o.full_name || o.fullName || "Guest Student");

      const finishedStatuses = ['CLAIMED', 'RELEASED', 'COMPLETED', 'DELIVERED'];
      const isFinished = finishedStatuses.includes(status);

      const isVisible = isStudentView ? isFinished : true;
      const isOwner = isStudentView ? currentUserId === String(user?.id) : true;

      const searchLower = searchTerm.toLowerCase();
      return isVisible && isOwner && [
        currentItemName.toLowerCase(),
        currentFullName.toLowerCase(),
        String(o.email || "").toLowerCase(),
        String(o.id || "")
      ].some(field => field.includes(searchLower));
    });
  }, [orders, searchTerm, user?.id, isStudentView]);

  // 3. STATS CALCULATIONS
  const displayTotal = useMemo(() => {
    // If the DB explicitly says 0, show 0. Don't fallback to local count unless DB is null.
    if (typeof dbStats.totalCompleted === 'number') return dbStats.totalCompleted;

    return historyOrders.filter(o =>
      ['CLAIMED', 'COMPLETED', 'RELEASED'].includes(String(o.status).toUpperCase())
    ).length;
  }, [dbStats.totalCompleted, historyOrders]);

  // 4. DISCORD SYNC HANDLER (With UI Guards)
  const handleDiscordSync = async (order) => {
    if (syncingId) return; // Prevent multiple simultaneous syncs

    setSyncingId(order.id);
    try {
      console.log(`📡 Digital Sync Initiated: Order #${order.id}`);
      await printReceipt(order);

      // Success feedback
      setLastSyncedId(order.id);
      setTimeout(() => setLastSyncedId(null), 3000); // Reset "Checkmark" after 3s
    } catch (error) {
      alert("Discord Sync Failed. Check console for details.");
    } finally {
      setSyncingId(null);
    }
  };
  console.log("🕵️ DEBUG - Raw Orders:", orders.length);
  console.log("🕵️ DEBUG - Filtered History:", historyOrders.length);

  return (
    <div className="space-y-8 p-4 text-left animate-in fade-in duration-500">
      {/* STATS PANEL */}
      {!isStudentView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-emerald-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Lifetime Claims</p>
            <h3 className="text-3xl font-black text-slate-900">{displayTotal}</h3>
          </div>
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-indigo-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Today's Total</p>
            <h3 className="text-3xl font-black text-slate-900">{dbStats.todayCompleted}</h3>
          </div>
          <div className="p-6 bg-white border-2 border-slate-50 rounded-3xl shadow-sm border-l-amber-500 border-l-4">
            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Live Queue</p>
            <h3 className="text-3xl font-black text-slate-900">
              {historyOrders.filter(o => !['CLAIMED', 'COMPLETED', 'RELEASED'].includes(String(o.status).toUpperCase())).length}
            </h3>
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
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Discord E-Receipt Feed</p>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search ID, Name, or Item..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:ring-2 ring-indigo-500 transition-all outline-none"
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
                {!isStudentView && <th className="px-6 py-4 text-right">E-Receipt</th>}
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
                        <span className="text-sm font-black text-slate-800 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                          <User size={12} className="text-indigo-500" />
                          {order.full_name || order.fullName || "Guest"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Mail size={10} /> {order.email || "No Email"}
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
                      <span className="text-[10px] text-indigo-600 font-black uppercase bg-indigo-50 w-fit px-1.5 rounded">
                        {order.size || 'N/A'}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-[9px] font-black rounded-full border uppercase tracking-tighter ${STATUS_THEMES[String(order.status).toUpperCase()] || STATUS_THEMES.PENDING
                      }`}>
                      {order.status}
                    </span>
                  </td>

                  {!isStudentView && (
                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={syncingId === order.id}
                        onClick={() => handleDiscordSync(order)}
                        className={`flex items-center gap-2 ml-auto px-4 py-2 font-black text-[10px] rounded-xl transition-all active:scale-95 shadow-sm uppercase tracking-tighter ${lastSyncedId === order.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white'
                          }`}
                      >
                        {syncingId === order.id ? (
                          <span className="animate-spin text-lg">⏳</span>
                        ) : lastSyncedId === order.id ? (
                          <Check size={14} />
                        ) : (
                          <Hash size={14} />
                        )}
                        {syncingId === order.id ? 'Syncing...' : lastSyncedId === order.id ? 'Sent!' : 'Sync Receipt'}
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