import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Scan, Keyboard, XCircle, Terminal,
  AlertCircle, RefreshCcw, PackageCheck
} from 'lucide-react';

export default function Scanner() {
  const { orders = [], processScanClaim, incrementQueue, user, printReceipt } = useApp();
  const [scanResult, setScanResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualId, setManualId] = useState('');
  const manualInputRef = useRef(null);

  useEffect(() => {
    const focusInput = () => {
      if (!isProcessing && !scanResult && manualInputRef.current) {
        if (document.activeElement !== manualInputRef.current) {
          manualInputRef.current.focus();
        }
      }
    };
    const focusInterval = setInterval(focusInput, 300);
    return () => clearInterval(focusInterval);
  }, [scanResult, isProcessing]);

  const playFeedback = (success) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = success ? 'sine' : 'square';
      osc.frequency.setValueAtTime(success ? 880 : 220, ctx.currentTime);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) { console.warn("Audio feedback blocked"); }
  };

  const handleProcessCode = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode || isProcessing) return;
    setIsProcessing(true);
    const SHOULD_PRINT = false;
    const idArray = [...new Set(cleanCode.split(/[,\s]+/).filter(id => id.length > 0))];

    if (idArray.length === 0) {
      setScanResult({ success: false, message: "Invalid ID format." });
      playFeedback(false);
      setIsProcessing(false);
      return;
    }

    try {
      const adminId = user?.id || user?.user_id;
      const result = await processScanClaim(idArray, adminId);
      if (result.success) {
        if (SHOULD_PRINT && typeof printReceipt === 'function') {
          const claimedOrders = (orders || []).filter(o => idArray.includes(String(o.id)));
          await Promise.allSettled(claimedOrders.map(order => printReceipt(order)));
        }
        if (typeof incrementQueue === 'function') await incrementQueue(adminId);

        setScanResult({
          success: true,
          message: `AUTHORIZED: ${idArray.length} Record(s) Processed`,
          details: idArray.join(", ")
        });
        playFeedback(true);
        setManualId('');
        setTimeout(() => setScanResult(null), 3000);
      } else {
        setScanResult({ success: false, message: result.message || "Verification Failed" });
        playFeedback(false);
      }
    } catch (error) {
      setScanResult({ success: false, message: "System Error. Connection Refused." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    /* 🛠️ MOBILE FIX: Changed max-width and reduced padding for small screens */
    <div className="w-full max-w-xl mx-auto p-4 md:p-6 min-h-[85vh] flex flex-col justify-start md:justify-center animate-in fade-in duration-700">
      
      {/* HEADER SECTION - More compact on mobile */}
      <div className="flex items-center justify-between mb-6 md:mb-10 px-2 md:px-6">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="p-3 md:p-4 bg-slate-950 text-emerald-400 rounded-2xl md:rounded-[1.5rem] shadow-xl">
            <Terminal size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-slate-950 uppercase tracking-tighter">
              Scanner <span className="text-emerald-500">Core</span>
            </h1>
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Protocol active</p>
          </div>
        </div>
      </div>

      {/* MAIN SCAN CARD - Responsive corner rounding and padding */}
      <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="p-6 md:p-12 flex flex-col items-center justify-center min-h-[350px] md:min-h-[500px]">
          
          {isProcessing ? (
            <div className="text-center space-y-6">
              <RefreshCcw className="animate-spin text-emerald-500 mx-auto" size={48} md:size={72} />
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">Processing...</p>
            </div>
          ) : scanResult ? (
            <div className="w-full text-center space-y-6 md:space-y-10 animate-in zoom-in duration-300">
              <div className={`mx-auto w-24 h-24 md:w-32 md:h-32 flex items-center justify-center rounded-[2rem] md:rounded-[2.5rem] ${scanResult.success ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {scanResult.success ? <PackageCheck size={48} md:size={72} /> : <XCircle size={48} md:size={72} />}
              </div>
              <div className="space-y-2 md:space-y-4 px-4">
                <h3 className={`text-3xl md:text-5xl font-black uppercase tracking-tighter ${scanResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                  {scanResult.success ? 'Cleared' : 'Rejected'}
                </h3>
                <p className="text-slate-500 font-bold text-sm md:text-base">{scanResult.message}</p>
              </div>
              <button onClick={() => setScanResult(null)} className="w-full md:w-auto px-10 py-4 md:py-6 bg-slate-950 text-white rounded-2xl md:rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em]">
                Dismiss
              </button>
            </div>
          ) : (
            <div className="w-full space-y-8 md:space-y-14 text-center">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Input</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-slate-950 uppercase tracking-tighter">Standby</h2>
              </div>

              {/* INPUT BOX - Responsive Sizing */}
              <div className="relative group w-full px-2">
                <div className="absolute inset-0 bg-emerald-500/5 blur-2xl rounded-full" />
                <input
                  ref={manualInputRef}
                  type="text"
                  inputMode="numeric" /* 🛠️ Mobile Fix: Pulls up number pad if IDs are numeric */
                  autoFocus
                  autoComplete="off"
                  placeholder="---"
                  className="relative w-full p-8 md:p-12 bg-slate-50 border-2 border-slate-100 rounded-[2rem] md:rounded-[3rem] outline-none focus:border-emerald-500 focus:bg-white font-black text-center text-3xl md:text-5xl tracking-[0.3em] text-slate-950 transition-all shadow-inner"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProcessCode(manualId)}
                />
              </div>

              <div className="flex items-center justify-center gap-8 md:gap-12 opacity-30">
                <div className="flex flex-col items-center gap-2"><Scan size={20} md:size={28} /><span className="text-[8px] font-black uppercase tracking-widest">Laser</span></div>
                <div className="flex flex-col items-center gap-2"><Keyboard size={20} md:size={28} /><span className="text-[8px] font-black uppercase tracking-widest">Manual</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER TILES - Grid fixes for mobile */}
      <div className="mt-6 md:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 px-2">
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600"><AlertCircle size={20} /></div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Queue</p>
            <p className="text-base md:text-lg font-black text-slate-950">
              {orders.filter(o => ['READY', 'APPROVED', 'RELEASE_READY', 'AWAITING_VERIFICATION'].includes(String(o.status || "").toUpperCase())).length} Units
            </p>
          </div>
        </div>
        
        {/* Network status hidden on mobile to save vertical space if needed, or kept small */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Network</p><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Synchronized</p></div>
          <div className="w-8 h-8 border-2 border-emerald-500 rounded-full border-t-transparent animate-spin" />
        </div>
      </div>
    </div>
  );
}