import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Megaphone, Send, Clock, Trash2, Hourglass, Loader2,
  AlertCircle, Zap, Power, ShieldAlert
} from 'lucide-react';

export default function AnnouncementManager() {
  const {
    announcements = [],
    addAnnouncement,
    deleteAnnouncement,
    officeStatus,
    toggleOfficeStatus // This is the master function that checks the DB password
  } = useApp();

  const [msg, setMsg] = useState('');
  const [duration, setDuration] = useState('24');
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Sync with the same status variable used in AdminDashboard
  const currentStatus = officeStatus || 'OPEN';

  // --- SYNCED AUTHENTICATION HANDLER ---
  const handleToggle = async () => {
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';

    // This prompt captures the password to be verified by your backend
    const password = prompt(`Enter Admin Password to set system to ${nextStatus}:`);

    if (!password) return; // Exit if they cancel or leave it blank

    setIsUpdatingStatus(true);
    try {
      // We pass the password directly to the context function. 
      // The "Sync" happens because this hits the same API endpoint as the Dashboard.
      const result = await toggleOfficeStatus(nextStatus, password);

      if (!result.success) {
        alert(result.error || "Authentication failed or server error.");
      }
    } catch (err) {
      console.error("Critical toggle error:", err);
      alert("System sync failed. Check connection.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setIsSending(true);

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + parseInt(duration));
    const expires_at = expiryDate.toISOString().slice(0, 19).replace('T', ' ');

    try {
      // Pack the strings into an object the backend recognizes
      const result = await addAnnouncement({
        title: 'Broadcast',
        content: msg,          // Backend specifically needs the key "content"
        type: 'info',
        expires_at: expires_at
      });

      if (result?.success) setMsg('');
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this announcement?")) return;
    await deleteAnnouncement(id);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">

      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-emerald-950 tracking-tighter uppercase leading-none">
            Announcement <span className="text-emerald-500 italic">Desk</span>
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-1 text-left">Master Control & Global Dispatches</p>
        </div>

        {/* --- SYNCED TOGGLE BUTTON --- */}
        <button
          onClick={handleToggle}
          disabled={isUpdatingStatus}
          className={`flex items-center gap-4 px-6 py-3 rounded-3xl border-2 transition-all duration-500 shadow-lg active:scale-95 ${currentStatus === 'OPEN'
              ? 'bg-white border-emerald-100 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-600 shadow-red-200/50'
            }`}
        >
          <div className={`p-2 rounded-xl transition-colors duration-500 ${currentStatus === 'OPEN' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
            {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1 text-slate-400">Security Gate</p>
            <p className="text-sm font-black uppercase leading-none tracking-tighter">
              {currentStatus === 'OPEN' ? 'System Live' : 'System Locked'}
            </p>
          </div>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* --- COMPOSE SECTION --- */}
        <section className="lg:col-span-4 space-y-6">
          {/* Visual Alert for Closed State */}
          {currentStatus === 'CLOSED' && (
            <div className="bg-red-600 text-white p-6 rounded-[2.5rem] flex items-center gap-4 animate-in zoom-in duration-300 shadow-xl shadow-red-600/20">
              <ShieldAlert size={32} className="shrink-0" />
              <p className="text-[11px] font-black uppercase leading-tight">
                Restriction Active: Checkout is currently disabled for all students.
              </p>
            </div>
          )}

          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-8">
            <div className="flex items-center gap-3 text-emerald-600 mb-6">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Megaphone size={24} />
              </div>
              <div>
                <h2 className="font-black uppercase tracking-tighter text-lg text-left">New Dispatch</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase text-left">Live Broadcast</p>
              </div>
            </div>

            <form onSubmit={handlePost} className="space-y-6">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Type your announcement..."
                className="w-full h-48 p-6 bg-slate-50 rounded-[2rem] border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none font-bold text-slate-800 resize-none transition-all placeholder:text-slate-300 shadow-inner"
              />

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-2 tracking-widest">
                  <Hourglass size={12} className="text-amber-500" /> Expiry
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ l: '1 Hour', v: '1' }, { l: '1 Day', v: '24' }, { l: '3 Days', v: '72' }, { l: 'Permanent', v: '8760' }].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setDuration(opt.v)}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${duration === opt.v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={isSending || !msg.trim()}
                className="w-full bg-emerald-950 text-white font-black py-5 rounded-[1.5rem] hover:bg-black disabled:opacity-30 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/20"
              >
                {isSending ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> Deploy to Feed</>}
              </button>
            </form>
          </div>
        </section>

        {/* --- LIVE FEED SECTION --- */}
        <section className="lg:col-span-8">
          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="font-black text-slate-900 uppercase tracking-tighter text-xl text-left">
                  Terminal Activity
                </h2>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {announcements.length > 0 ? (
                announcements.map((ann) => (
                  <div key={ann.id} className="p-8 flex justify-between items-start hover:bg-slate-50/50 transition-all group gap-6 text-left">
                    <div className="space-y-4 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 shrink-0">
                          <Clock size={10} /> Active
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                          {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-slate-800 leading-snug tracking-tight break-words italic">
                        "{ann.content}"
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 p-4 rounded-2xl transition-all shadow-sm active:scale-90 self-start mt-1"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-40 text-center">
                  <Megaphone className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No active broadcasts</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}