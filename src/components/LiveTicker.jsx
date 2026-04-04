import React from 'react';
import { useApp } from '../context/AppContext';
import { Zap } from 'lucide-react';

export default function LiveTicker() {
  const { announcements = [] } = useApp();
  
  // Default text if no announcements exist
  const tickerText = announcements.length > 0 
    ? announcements.map(a => a.content).join(" • ") 
    : "SYSTEM ONLINE • STANDBY FOR UPDATES • WELCOME TO SMART CLAIM PROTOCOL";

  return (
    <div className="w-full bg-slate-900 border-b border-white/5 h-10 flex items-center overflow-hidden relative shadow-lg">
      <div className="z-20 bg-emerald-500 px-4 h-full flex items-center gap-2 shadow-[10px_0_20px_rgba(0,0,0,0.4)]">
        <Zap size={14} className="text-slate-900 fill-slate-900" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 whitespace-nowrap">
          Live Feed
        </span>
      </div>

      <div className="flex-1 overflow-hidden whitespace-nowrap flex items-center">
        <div className="animate-ticker inline-block">
          {/* We repeat the text to ensure a seamless loop */}
          <span className="text-[11px] font-bold uppercase tracking-tighter text-emerald-400/80 px-4">
            {tickerText} — {tickerText} — {tickerText}
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.3%); }
        }
        .animate-ticker {
          display: inline-block;
          white-space: nowrap;
          animation: ticker 30s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}} />
    </div>
  );
}