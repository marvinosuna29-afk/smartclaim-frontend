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

  // --- 1. AGGRESSIVE HARDWARE AUTO-FOCUS ---
  // Re-focuses every 300ms to ensure the "Laser" always has a target
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

  // --- 2. AUDIO FEEDBACK ---
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

  // --- 3. PROCESSING LOGIC ---
  const handleProcessCode = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode || isProcessing) return;

    setIsProcessing(true);

    // Toggle this to TRUE when your printing function is ready
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

      // 1. Backend Sync
      const result = await processScanClaim(idArray, adminId);

      if (result.success) {
        // 2. Conditional Printing Logic (Ready for implementation)
        if (SHOULD_PRINT && typeof printReceipt === 'function') {
          const claimedOrders = (orders || []).filter(o => idArray.includes(String(o.id)));

          // Using Promise.allSettled so one failed print doesn't crash the whole scan
          await Promise.allSettled(
            claimedOrders.map(order => printReceipt(order))
          );
        }

        // 3. Queue Management
        if (typeof incrementQueue === 'function') {
          await incrementQueue(adminId);
        }

        // 4. Success State
        setScanResult({
          success: true,
          message: `AUTHORIZED: ${idArray.length} Record(s) Processed`,
          details: idArray.join(", ")
        });

        playFeedback(true);
        setManualId('');

        // Auto-reset
        setTimeout(() => setScanResult(null), 3000);
      } else {
        setScanResult({
          success: false,
          message: result.message || "Verification Failed"
        });
        playFeedback(false);
      }
    } catch (error) {
      console.error("Scanner Error:", error);
      setScanResult({ success: false, message: "System Error. Connection Refused." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 min-h-[85vh] flex flex-col justify-center animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-10 px-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-slate-950 text-emerald-400 rounded-[1.5rem] shadow-2xl shadow-emerald-500/20">
            <Terminal size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-950 uppercase tracking-tighter">
              Scanner <span className="text-emerald-500">Core</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1.5">Verification Protocol</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden relative">
        <div className="p-12 flex flex-col items-center justify-center min-h-[500px]">
          {isProcessing ? (
            <div className="text-center space-y-8 animate-pulse">
              <RefreshCcw className="animate-spin text-emerald-500 mx-auto" size={72} strokeWidth={1.5} />
              <p className="text-slate-400 font-black text-xs uppercase tracking-[0.4em]">Syncing Protocol...</p>
            </div>
          ) : scanResult ? (
            <div className="w-full text-center space-y-10 animate-in zoom-in duration-300">
              <div className={`mx-auto w-32 h-32 flex items-center justify-center rounded-[2.5rem] shadow-inner ${scanResult.success ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {scanResult.success ? <PackageCheck size={72} strokeWidth={1.5} /> : <XCircle size={72} strokeWidth={1.5} />}
              </div>
              <div className="space-y-4 px-6">
                <h3 className={`text-5xl font-black uppercase tracking-tighter ${scanResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                  {scanResult.success ? 'Cleared' : 'Rejected'}
                </h3>
                <p className="text-slate-500 font-bold text-base leading-snug">{scanResult.message}</p>
              </div>
              <button onClick={() => setScanResult(null)} className="px-14 py-6 bg-slate-950 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em]">
                Reset
              </button>
            </div>
          ) : (
            <div className="w-full space-y-14 text-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 bg-emerald-50 text-emerald-700 px-6 py-2.5 rounded-full">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ready</span>
                </div>
                <h2 className="text-6xl font-black text-slate-950 uppercase tracking-tighter">Standby</h2>
              </div>

              <div className="relative group max-w-sm mx-auto">
                <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full" />
                <input
                  ref={manualInputRef}
                  type="text"
                  autoFocus
                  autoComplete="off"
                  placeholder="---"
                  className="relative w-full p-12 bg-slate-50 border-2 border-slate-100 rounded-[3rem] outline-none focus:border-emerald-500 focus:bg-white font-black text-center text-5xl tracking-[0.4em] text-slate-950 transition-all shadow-inner"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleProcessCode(manualId);
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-center gap-12 opacity-30">
                <div className="flex flex-col items-center gap-4"><Scan size={28} /><span className="text-[9px] font-black uppercase tracking-widest">Laser</span></div>
                <div className="flex flex-col items-center gap-4"><Keyboard size={28} /><span className="text-[9px] font-black uppercase tracking-widest">Manual</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-6 px-2">
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="bg-amber-50 p-4 rounded-2xl text-amber-600"><AlertCircle size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting</p>
            <p className="text-lg font-black text-slate-950">
              {orders.filter(o => ['READY', 'APPROVED', 'RELEASE_READY', 'AWAITING_VERIFICATION'].includes(String(o.status || "").toUpperCase())).length} Units
            </p>
          </div>
        </div>
        <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network</p><p className="text-sm font-black text-emerald-500 uppercase tracking-widest">Sync</p></div>
          <div className="w-10 h-10 border-[3px] border-emerald-500 rounded-full border-t-transparent animate-spin" />
        </div>
      </div>
    </div>
  );
}