import React from 'react';
import { useApp } from "../../context/AppContext";
import { Activity, Users, Clock, ShieldCheck, AlertCircle, Zap } from 'lucide-react';

export default function QueueMonitor() {
    const { orders = [], user } = useApp();

    // 1. Identify the user's current context
    const myOrders = orders.filter(o =>
        String(o.user_id || o.userId) === String(user?.id || user?.user_id) &&
        o.status !== 'CLAIMED'
    );

    // 2. Find the "Priority" order (Oldest READY order)
    const readyOrder = [...myOrders]
        .filter(o => o.status === 'READY')
        .sort((a, b) => a.id - b.id)[0];

    // 3. Find the "Active" order (Oldest overall if none are READY)
    const activeOrder = readyOrder || [...myOrders].sort((a, b) => a.id - b.id)[0];

    // If no active orders, the node remains dormant
    if (!activeOrder) return null;

    // 4. ACCURATE POSITION LOGIC
    // If the order is READY, we only care about other READY orders ahead of us (the physical line).
    // If it's PENDING, we care about all uncollected orders ahead of us (the processing line).
    const queuePosition = orders.filter(o => {
        const orderId = String(o.id);
        const activeId = String(activeOrder.id);
        if (activeOrder.status === 'READY') {
            return o.status === 'READY' && orderId < activeId;
        }
        return o.status !== 'CLAIMED' && orderId < activeId;
    }).length + 1;

    // 5. STATS CALCULATIONS
    const totalInQueue = orders.filter(o => o.status !== 'CLAIMED').length;
    // Estimate: 2 mins if READY (quick scan), 5 mins if PENDING (needs admin review)
    const waitPerPerson = activeOrder.status === 'READY' ? 2 : 5;
    const estWait = (queuePosition - 1) * waitPerPerson;

    return (
        <div className="w-full animate-in slide-in-from-top duration-700">
            <div className={`rounded-[2.5rem] p-8 text-white shadow-2xl transition-all duration-500 relative overflow-hidden border ${activeOrder.status === 'READY'
                    ? 'bg-emerald-600 border-emerald-400/30 shadow-emerald-500/20'
                    : 'bg-slate-900 border-white/5 shadow-slate-950/50'
                }`}>

                {/* Animated Background Element */}
                <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full animate-pulse ${activeOrder.status === 'READY' ? 'bg-white/20' : 'bg-emerald-500/10'
                    }`} />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">

                    {/* LEFT: Position Logic */}
                    <div className="flex flex-col items-center lg:items-start gap-4">
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${activeOrder.status === 'READY'
                                ? 'bg-white/20 border-white/30 text-white'
                                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            }`}>
                            {activeOrder.status === 'READY' ? <Zap size={14} fill="currentColor" /> : <Activity size={14} className="animate-pulse" />}
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                {activeOrder.status === 'READY' ? 'Priority Dispatch' : 'Live Queue Node'}
                            </span>
                        </div>

                        <div className="text-center lg:text-left">
                            <h2 className="text-5xl font-black tracking-tighter mb-1">
                                {queuePosition === 1 ? (
                                    <span className={activeOrder.status === 'READY' ? 'text-white' : 'text-emerald-400 animate-pulse'}>
                                        {activeOrder.status === 'READY' ? "It's Your Turn" : "Next In Line"}
                                    </span>
                                ) : (
                                    <>Position <span className={activeOrder.status === 'READY' ? 'text-emerald-200' : 'text-emerald-500'}>#{queuePosition}</span></>
                                )}
                            </h2>
                            <p className={`text-xs font-bold uppercase tracking-widest ${activeOrder.status === 'READY' ? 'text-emerald-100/60' : 'text-slate-400'
                                }`}>
                                Targeting Order <span className="text-white">#{activeOrder.id}</span> • {activeOrder.item_name}
                            </p>
                        </div>
                    </div>

                    {/* MIDDLE: Quick Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
                        <div className={`p-4 rounded-3xl border text-center ${activeOrder.status === 'READY' ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/10'
                            }`}>
                            <Users size={18} className={`mx-auto mb-1 ${activeOrder.status === 'READY' ? 'text-emerald-200' : 'text-slate-400'}`} />
                            <p className="text-[10px] font-black uppercase opacity-60">In Line</p>
                            <p className="text-lg font-black">{totalInQueue}</p>
                        </div>
                        <div className={`p-4 rounded-3xl border text-center ${activeOrder.status === 'READY' ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/10'
                            }`}>
                            <Clock size={18} className={`mx-auto mb-1 ${activeOrder.status === 'READY' ? 'text-emerald-200' : 'text-slate-400'}`} />
                            <p className="text-[10px] font-black uppercase opacity-60">Est. Wait</p>
                            <p className="text-lg font-black">~{estWait === 0 ? '1' : estWait}m</p>
                        </div>
                    </div>

                    {/* RIGHT: System Directive */}
                    <div className="w-full lg:max-w-xs">
                        <div className={`p-6 rounded-[2rem] border backdrop-blur-md transition-all ${activeOrder.status === 'READY'
                                ? 'bg-white/10 border-white/20'
                                : 'bg-white/5 border-white/10'
                            }`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${activeOrder.status === 'READY' ? 'bg-white text-emerald-600' : 'bg-slate-700 text-slate-400'
                                    }`}>
                                    {activeOrder.status === 'READY' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Directive</p>
                                    <p className="text-sm font-bold leading-tight mt-1">
                                        {activeOrder.status === 'READY'
                                            ? "Validation Successful. Please present your Master QR to the Admin."
                                            : "Awaiting administrative review. Please remain in the vicinity."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}