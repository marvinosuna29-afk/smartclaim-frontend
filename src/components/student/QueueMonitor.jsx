import React, { useMemo } from 'react';
import { useApp } from "../../context/AppContext";
import { Activity, Users, Clock, ShieldCheck, AlertCircle, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function QueueMonitor() {
    const { orders = [], user, currentServingId } = useApp();

    // 1. NORMALIZE USER ID (Prevents "invisible" mismatches between string/number)
    const currentUserId = String(user?.id || user?.user_id || "");

    // 2. CONSOLIDATED ACTIVE ORDER LOGIC
    // We wrap this in useMemo to ensure the UI stays stable during re-renders
    const activeOrder = useMemo(() => {
        if (!currentUserId) return null;

        // Filter all relevant orders for this user
        const myActiveOrders = orders.filter(o =>
            String(o.user_id || o.userId) === currentUserId &&
            String(o.status).toUpperCase() !== 'CLAIMED' &&
            String(o.status).toUpperCase() !== 'CANCELLED'
        );

        if (myActiveOrders.length === 0) return null;

        // Sort by ID to ensure we always handle the oldest request first
        const sorted = [...myActiveOrders].sort((a, b) => Number(a.id) - Number(b.id));

        // PRIORITY: If any are 'READY', show that one first. Otherwise, show the oldest pending.
        return sorted.find(o => String(o.status).toUpperCase() === 'READY') || sorted[0];
    }, [orders, currentUserId]);

    // If no active orders, the component remains dormant
    if (!activeOrder) return null;

    // 3. ACCURATE POSITION LOGIC
    const queuePosition = useMemo(() => {
        if (!activeOrder) return 1;

        const myId = Number(activeOrder.id);
        const servingId = Number(currentServingId || 0);

        // If my order ID is less than or equal to what is being served, I am #1
        if (myId <= servingId) return 1;

        // Filter only orders that are "between" the current pointer and my ID
        const ahead = orders.filter(o => {
            const oId = Number(o.id);
            const oStatus = String(o.status).toUpperCase();

            // We only count people who are still waiting and are between the Admin and Me
            return (
                oStatus !== 'CLAIMED' &&
                oStatus !== 'CANCELLED' &&
                oId >= servingId &&
                oId < myId
            );
        });

        return ahead.length + 1;
    }, [orders, activeOrder, currentServingId]);

    // 4. STATS & STYLING CONSTANTS
    const totalInQueue = orders.filter(o => {
        const s = String(o.status).toUpperCase();
        return s !== 'CLAIMED' && s !== 'CANCELLED';
    }).length;

    const isReady = String(activeOrder.status).toUpperCase() === 'READY';
    const waitPerPerson = isReady ? 1 : 3;
    const estWait = (queuePosition - 1) * waitPerPerson;

    return (
        <div className="w-full animate-in slide-in-from-top duration-700">
            <div className={`rounded-[2.5rem] p-8 text-white shadow-2xl transition-all duration-500 relative overflow-hidden border ${isReady
                    ? 'bg-emerald-600 border-emerald-400/30 shadow-emerald-500/20'
                    : 'bg-slate-900 border-white/5 shadow-slate-950/50'
                }`}>

                {/* Animated Background Element */}
                <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full animate-pulse ${isReady ? 'bg-white/20' : 'bg-emerald-500/10'
                    }`} />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">

                    {/* LEFT: Position Logic */}
                    <div className="flex flex-col items-center lg:items-start gap-4">
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${isReady
                                ? 'bg-white/20 border-white/30 text-white'
                                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            }`}>
                            {isReady ? <Zap size={14} fill="currentColor" /> : <Activity size={14} className="animate-pulse" />}
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                {isReady ? 'Priority Dispatch' : 'Live Queue Node'}
                            </span>
                        </div>

                        <div className="text-center lg:text-left">
                            <h2 className="text-5xl font-black tracking-tighter mb-1">
                                {queuePosition === 1 ? (
                                    <span className={isReady ? 'text-white' : 'text-emerald-400 animate-pulse'}>
                                        {isReady ? "It's Your Turn" : "Next In Line"}
                                    </span>
                                ) : (
                                    <>Position <span className={isReady ? 'text-emerald-200' : 'text-emerald-500'}>#{queuePosition}</span></>
                                )}
                            </h2>
                            <p className={`text-xs font-bold uppercase tracking-widest ${isReady ? 'text-emerald-100/60' : 'text-slate-400'}`}>
                                Targeting Order <span className="text-white">#{activeOrder.id}</span> • {activeOrder.item_name}
                            </p>
                        </div>
                    </div>

                    {/* MIDDLE: Quick Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
                        <div className={`p-4 rounded-3xl border text-center ${isReady ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/10'}`}>
                            <Users size={18} className={`mx-auto mb-1 ${isReady ? 'text-emerald-200' : 'text-slate-400'}`} />
                            <p className="text-[10px] font-black uppercase opacity-60">In Line</p>
                            <p className="text-lg font-black">{totalInQueue}</p>
                        </div>
                        <div className={`p-4 rounded-3xl border text-center ${isReady ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/10'}`}>
                            <Clock size={18} className={`mx-auto mb-1 ${isReady ? 'text-emerald-200' : 'text-slate-400'}`} />
                            <p className="text-[10px] font-black uppercase opacity-60">Est. Wait</p>
                            <p className="text-lg font-black">~{estWait <= 0 ? '1' : estWait}m</p>
                        </div>
                    </div>

                    {/* RIGHT: QR Dispatch */}
                    <div className="w-full lg:max-w-xs">
                        <div className={`p-6 rounded-[2rem] border backdrop-blur-md transition-all duration-500 ${isReady ? 'bg-white/20 border-white/40 shadow-lg shadow-emerald-900/20' : 'bg-white/5 border-white/10'
                            }`}>
                            {isReady ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="bg-white p-3 rounded-3xl shadow-2xl transform hover:scale-105 transition-all">
                                        <QRCodeSVG
                                            value={String(activeOrder.id)}
                                            size={120}
                                            level="H"
                                            includeMargin={true}
                                            className="rounded-lg"
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Master QR Active</p>
                                        <p className="text-[9px] font-bold text-emerald-100/60 mt-1 uppercase">Present to Admin for Pickup</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-slate-700 text-slate-400">
                                        <AlertCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Directive</p>
                                        <p className="text-sm font-bold leading-tight mt-1">
                                            Awaiting administrative review. Please remain in the vicinity.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}