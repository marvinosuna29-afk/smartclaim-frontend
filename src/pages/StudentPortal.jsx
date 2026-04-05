import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { QRCodeSVG } from 'qrcode.react';
import {
  Package, X, CheckCircle2,
  Wallet, Info, Loader2, Clock, Ticket,
  QrCode, ChevronRight, AlertTriangle, Megaphone, Sparkles, Zap, Hash
} from 'lucide-react';
import QueueMonitor from '../components/student/QueueMonitor';

export default function StudentPortal({ needsVerification, activeTab, myOrders: propsOrders }) {
  const {
    items = [],
    orders: contextOrders = [], // Rename this to contextOrders
    user = {},
    currentQueue = 0,
    addOrder,
    officeStatus = "OPEN",
    announcements = [],
    submitReceipt,
    loading
  } = useApp();

  const [selectedSizes, setSelectedSizes] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedOrderForQR, setSelectedOrderForQR] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 🛡️ FILTER LOGIC ---
  const myOrders = useMemo(() => {
    // Priority: Use contextOrders if they exist, as they are live-updated by sockets
    const sourceOrders = contextOrders.length > 0 ? contextOrders : (propsOrders || []);
    const currentUserId = String(user?.user_id || user?.id || "").trim();

    if (!currentUserId || sourceOrders.length === 0) return [];

    return sourceOrders.filter(o => {
      const orderOwnerId = String(
        o.user_id || o.userId || o.student_id || o.studentId || o.owner_id || ""
      ).trim();
      return orderOwnerId === currentUserId;
    });
  }, [propsOrders, contextOrders, user]); // Now it watches contextOrders correctly

  const pendingPayment = useMemo(() => {
    return myOrders.filter(o => {
      // Normalize the status string
      const s = String(o.status || "").toUpperCase().trim();

      // ✅ FIX: Catching both 'PENDING' and any status that requires a receipt
      const needsPayment = s === 'PENDING' || s === 'AWAITING_PAYMENT' || s === 'UNPAID';
      const hasNoProof = !o.receipt_url && !o.reference_number;

      return needsPayment && hasNoProof;
    });
  }, [myOrders]);

  const verifyingOrders = useMemo(() => {
    return myOrders.filter(o => {
      const s = String(o.status || "").toUpperCase().trim();
      return ['AWAITING_VERIFICATION', 'VERIFYING', 'PENDING_APPROVAL'].includes(s) ||
        (s === 'PENDING' && (o.receipt_url || o.reference_number));
    });
  }, [myOrders]);

  const readyOrders = useMemo(() => {
    return myOrders.filter(o => {
      const s = String(o.status || "").toUpperCase().trim();
      const isReady = ['READY', 'APPROVED', 'FOR PICKUP'].includes(s);
      const isFinished = ['CLAIMED', 'RELEASED', 'COMPLETED', 'VOIDED'].includes(s);
      return isReady && !isFinished;
    });
  }, [myOrders]);

  const completedOrders = useMemo(() => {
    return myOrders.filter(order => {
      const s = String(order.status || "").toUpperCase().trim();
      return ['CLAIMED', 'COMPLETED', 'CANCELLED', 'VOIDED'].includes(s);
    });
  }, [myOrders]);

  useEffect(() => {
    if (showQRModal && selectedOrderForQR) {
      // Check if the specific order in the modal is still in the "READY" list
      const isStillReady = readyOrders.some(o => String(o.id) === String(selectedOrderForQR.id));
      if (!isStillReady) {
        setShowQRModal(false);
        setSelectedOrderForQR(null);
      }
    }
  }, [readyOrders, showQRModal, selectedOrderForQR]); // Watch readyOrders specifically

  if (needsVerification && user?.role?.toLowerCase() !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center animate-in fade-in duration-700">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-amber-400/20 blur-3xl rounded-full" />
          <div className="relative bg-white p-8 rounded-full border-4 border-amber-50 text-amber-500 shadow-2xl">
            <Clock size={64} strokeWidth={1.5} className="animate-pulse" />
          </div>
        </div>
        <div className="max-w-sm space-y-4">
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Awaiting Entry</h2>
          <p className="text-slate-400 font-bold text-sm leading-relaxed">
            Your credentials have been submitted. The administration is currently verifying your student profile.
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
            Status: Pending Admin Approval
          </div>
        </div>
      </div>
    );
  }

  const handlePlaceOrder = async (item) => {
    const size = selectedSizes[item.id];
    if (officeStatus === 'CLOSED' || isSubmitting || !size) return;
    setIsSubmitting(true);
    try {
      const response = await addOrder({ itemId: item.id, itemName: item.name, size: size });
      if (response && response.success) {
        setSelectedSizes(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } else {
        alert(response?.message || "Order failed to save.");
      }
    } catch (err) {
      console.error("Critical Order Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReferenceSubmit = async (orderId) => {
    const refNum = window.prompt("Enter your Payment Reference / Transaction Number:");

    // 1. Validation: Ensure input isn't empty or just spaces
    if (!refNum || !refNum.trim()) return;

    setUploadingId(orderId);
    try {
      // 2. The Fix: Capture the full response object
      const response = await submitReceipt(orderId, refNum.trim());

      // 3. The Fix: Check for the success property specifically
      if (response && response.success) {
        // Optional: You could add a "Success" toast here
      } else {
        // Show the specific error message from the server if it exists
        alert(response?.message || "Submission failed. Check your connection.");
      }
    } catch (err) {
      console.error("Receipt Upload Error:", err);
      alert("A critical error occurred during submission.");
    } finally {
      setUploadingId(null);
    }
  };

  console.log("Current User ID:", user?.id, "Ready Orders:", readyOrders);

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">

      {/* 🏠 VIEW 1: DASHBOARD (Active when tab is 'dashboard' or undefined) */}
      {(activeTab === 'dashboard' || !activeTab) && (
        <>
          {/* ✨ DYNAMIC WELCOME BANNER */}
          <div className="px-4 pt-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-500 font-black uppercase text-[10px] tracking-[0.3em]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  System Online • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-[0.85]">
                  Hello, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">
                    {user?.user_metadata?.full_name?.split(' ')[0] || 'Student'}
                  </span>
                </h1>
              </div>

              <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="px-6 py-3 bg-slate-900 rounded-[1.5rem] text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Requests</p>
                  <p className="text-xl font-black text-white leading-none">
                    {readyOrders.length + verifyingOrders.length + pendingPayment.length}
                  </p>
                </div>
                <div className="pr-6">
                  <p className="text-[10px] font-black text-slate-900 uppercase">Portal Status</p>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${officeStatus === 'CLOSED' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {officeStatus === 'CLOSED' ? 'Restricted Access' : 'Full Access'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 🎟️ HERO / QUEUE SECTION - STACKED FOR PERSISTENCE */}
          <div className="space-y-6">

            {/* 1. READY BANNER LOGIC */}
            {loading && contextOrders.length === 0 ? ( // ✅ Changed from orders.length
              /* A: SYNCING STATE */
              <div className="h-48 w-full bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 animate-pulse flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-slate-300" size={20} />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Verifying Ticket Status...</p>
                </div>
              </div>
            ) : readyOrders.length > 0 ? (
              /* B: READY STATE - Shows when data is confirmed */
              <div className="relative overflow-hidden bg-emerald-600 rounded-[3rem] p-10 md:p-14 text-white shadow-2xl animate-in zoom-in duration-500">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                  <div className="space-y-4 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 text-white rounded-full border border-white/30 animate-pulse">
                      <Zap size={14} fill="currentColor" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Collection Ticket Active</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                      Ready for <br /><span className="text-emerald-100 underline decoration-white/30">Collection</span>
                    </h1>
                    <p className="text-emerald-100/80 font-bold text-sm uppercase tracking-widest">
                      {readyOrders.length} {readyOrders.length > 1 ? 'Items' : 'Item'} Authorized for Pickup
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedOrderForQR(readyOrders[0]);
                      setShowQRModal(true);
                    }}
                    className="group relative active:scale-95 transition-all"
                  >
                    <div className="absolute inset-0 bg-white/40 blur-3xl group-hover:bg-white/60 transition-all duration-700" />
                    <div className="relative bg-white text-emerald-600 rounded-[4rem] px-12 py-10 flex flex-col items-center shadow-2xl border-4 border-emerald-500/20">
                      <QrCode size={64} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform duration-500" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-6">Open Claim Ticket</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            {/* 2. QUEUE MONITOR: Always rendered, no longer hidden by the banner */}
            <QueueMonitor />

          </div>

          {/* 📢 ANNOUNCEMENTS */}
          {announcements.length > 0 ? (
            <section className="space-y-4 px-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                <Megaphone size={14} className="text-emerald-500" /> Office Directives
              </h3>
              <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar snap-x">
                {announcements.map((ann) => (
                  <div key={ann.id} className="min-w-[85%] md:min-w-[480px] snap-center bg-emerald-950 rounded-[3rem] p-8 md:p-10 text-white relative overflow-hidden shadow-xl border border-emerald-900/50 hover:border-emerald-500/50 transition-all duration-500">
                    <Megaphone className="absolute -right-6 -bottom-6 text-emerald-900/40 rotate-12" size={140} />
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
                      <p className="text-xl md:text-2xl font-bold italic">"{ann.content}"</p>
                      <div className="flex items-center justify-between pt-4 border-t border-emerald-900/50 text-[9px] uppercase font-black">
                        <span>Broadcast Sync</span>
                        <ChevronRight size={18} className="text-emerald-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="mx-2 p-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 flex items-center justify-center gap-3">
              <Sparkles size={16} className="text-slate-300" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">System idle — no live directives.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-8">
              {/* PAYMENT SECTION */}
              {pendingPayment.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-100/50 p-8 rounded-[3rem] space-y-6">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-2">
                    <Wallet size={16} /> Action Required: Payment
                  </h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {pendingPayment.map(order => (
                      <div key={order.id} className="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-amber-200/20">
                        <div>
                          <p className="text-xs font-black uppercase text-slate-800 tracking-tight">{order.item_name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Size: {order.size}</p>
                        </div>
                        <button
                          onClick={() => handleReferenceSubmit(order.id)}
                          disabled={uploadingId === order.id}
                          className="p-4 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition-all disabled:opacity-50"
                        >
                          {uploadingId === order.id ? <Loader2 size={18} className="animate-spin" /> : <Hash size={18} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIVE PICKUP SECTION */}
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3 mb-8">
                  <CheckCircle2 className="text-emerald-500" size={22} /> My Pickup Terminal
                </h3>

                {(readyOrders.length > 0 || verifyingOrders.length > 0) ? (
                  <div className="space-y-4">
                    {verifyingOrders.map(order => (
                      <div key={order.id} className="w-full flex items-center justify-between p-6 rounded-3xl border-2 border-slate-50 bg-slate-50/50 opacity-80">
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">{order.item_name}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status: Verifying Receipt...</p>
                        </div>
                        <div className="text-slate-300 animate-pulse"><Clock size={20} /></div>
                      </div>
                    ))}

                    {readyOrders.map(order => (
                      <button
                        key={order.id}
                        onClick={() => { setSelectedOrderForQR(order); setShowQRModal(true); }}
                        className="w-full group flex items-center justify-between p-6 rounded-3xl border-2 border-emerald-50 bg-emerald-50/20 hover:border-emerald-500 hover:bg-white active:scale-95 transition-all duration-300"
                      >
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">{order.item_name}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Authorized: Open Claim QR</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white shadow-sm text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <QrCode size={20} strokeWidth={2.5} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                    <Package className="mx-auto text-slate-200 mb-4" size={40} />
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Active Requests</p>
                  </div>
                )}
              </div>
            </div>

            {/* INVENTORY CATALOG */}
            <div className="lg:col-span-7 space-y-8 relative">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Inventory Catalog</h3>
                {officeStatus === 'CLOSED' && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-500 rounded-full border border-red-100 animate-pulse">
                    <AlertTriangle size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Portal Closed</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {items.map(item => (
                  <div key={item.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                    {officeStatus === 'CLOSED' && (
                      <div className="absolute inset-0 z-10 bg-slate-50/40 backdrop-blur-[1px] cursor-not-allowed" />
                    )}
                    <div>
                      <h4 className="text-xl font-black uppercase text-slate-900 tracking-tight group-hover:text-emerald-600 transition-colors mb-6">
                        {item.name}
                      </h4>
                      <div className="grid grid-cols-3 gap-2 mb-8">
                        {Object.entries(item.sizes || {}).map(([size, qty]) => {
                          const isOutOfStock = qty <= 0 || item.hidden_sizes?.includes(size);
                          const isSelected = selectedSizes[item.id] === size;
                          return (
                            <button
                              key={size}
                              disabled={isOutOfStock || officeStatus === 'CLOSED'}
                              onClick={() => setSelectedSizes({ ...selectedSizes, [item.id]: size })}
                              className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 relative z-20 ${isSelected
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : !isOutOfStock
                                  ? 'bg-white border-slate-100 text-slate-500 hover:border-emerald-400'
                                  : 'bg-slate-50 border-transparent text-slate-200 cursor-not-allowed'
                                }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePlaceOrder(item)}
                      disabled={!selectedSizes[item.id] || officeStatus === 'CLOSED' || isSubmitting}
                      className="w-full py-5 bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-20 active:scale-95 relative z-20"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="animate-spin" size={14} />
                          <span>Processing...</span>
                        </div>
                      ) : officeStatus === 'CLOSED' ? (
                        "Portal Inactive"
                      ) : (
                        "Initiate Request"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 📜 VIEW 2: ORDER HISTORY (Active when tab is 'history') */}
      {activeTab === 'history' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 px-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">My Orders</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Complete history of your requests</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {myOrders.length > 0 ? (
              myOrders.map(order => (
                <div key={order.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{order.item_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Size: {order.size} • Ref: {order.reference_number || 'Cash Payment'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${['READY', 'APPROVED'].includes(String(order.status || "").toUpperCase()) ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {order.status}
                    </div>
                    <p className="text-[9px] font-bold text-slate-300 uppercase">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-black uppercase tracking-widest">No past records found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🎟️ DIGITAL CLAIM MODAL (Available in all tabs) */}
      {showQRModal && selectedOrderForQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[4rem] overflow-hidden relative animate-in zoom-in duration-300">

            {/* Header Section */}
            <div className="bg-slate-900 p-10 pb-14 text-center relative">
              <button
                onClick={() => setShowQRModal(false)}
                className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Authorized Collection</p>
                <h3 className="text-3xl font-black uppercase text-white tracking-tighter leading-none">
                  {selectedOrderForQR.item_name}
                </h3>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                  Ref: #{String(selectedOrderForQR.id).padStart(4, '0')}
                </p>
              </div>
            </div>

            {/* QR & Info Section */}
            <div className="p-10 text-center space-y-8">
              <div className="bg-white p-6 rounded-[3rem] inline-block border-2 border-slate-50 shadow-inner">
                <QRCodeSVG
                  value={String(selectedOrderForQR.id)}
                  size={180}
                  level="H"
                  includeMargin={true}
                  fgColor="#0f172a"
                />
              </div>

              <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-emerald-700/50 uppercase mb-1">Size</p>
                    <p className="text-2xl font-black text-emerald-950">{selectedOrderForQR.size}</p>
                  </div>
                  <div className="h-10 w-[1px] bg-emerald-200" />
                  <div className="text-center">
                    <p className="text-[8px] font-black text-emerald-700/50 uppercase mb-1">Queue Sync</p>
                    <p className="text-xl font-black text-emerald-600">#{String(currentQueue || 0).padStart(3, '0')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed px-4">
                  Present this code to the office administrator. <br />
                  Once scanned, this item will be marked as claimed.
                </p>

                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-slate-800 transition-all active:scale-95"
                >
                  Close Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}