import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Printer, Loader2, Zap, Clock } from 'lucide-react';

export default function OrderAnalytics({ orders = [] }) {
  // 1. ALL HOOKS MUST BE AT THE ABSOLUTE TOP
  const [showPrintVersion, setShowPrintVersion] = useState(false);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observeTarget = containerRef.current;
    if (!observeTarget) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries?.[0]?.contentRect) {
        const { width, height } = entries[0].contentRect;
        if (width > 0) setDimensions({ width, height });
      }
    });
    resizeObserver.observe(observeTarget);
    return () => resizeObserver.disconnect();
  }, []);

  const { chartData, todayCount, avgWaitTime, peakDay, hasData } = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const dailyCounts = {};
    const now = new Date();
    let totalWait = 0;
    let timedOrders = 0;

    // Standardize 7-day window
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dailyCounts[d.toLocaleDateString('en-CA')] = 0;
    }

    const todayStr = now.toLocaleDateString('en-CA');
    let countToday = 0;

    safeOrders.forEach(o => {
      const dateObj = new Date(o.created_at || o.date);
      const dateKey = dateObj.toLocaleDateString('en-CA');
      if (dailyCounts.hasOwnProperty(dateKey)) dailyCounts[dateKey] += 1;
      if (dateKey === todayStr) countToday++;
      if ((o.status === 'READY' || o.status === 'COMPLETED') && o.updated_at) {
        totalWait += (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime());
        timedOrders++;
      }
    });

    const formattedData = Object.keys(dailyCounts).sort().map(key => ({
      label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: dailyCounts[key]
    }));

    return {
      chartData: formattedData,
      todayCount: countToday,
      avgWaitTime: timedOrders > 0 ? Math.round((totalWait / timedOrders) / 60000) : 0,
      peakDay: formattedData.reduce((p, c) => (p.count > c.count ? p : c), formattedData[0])?.label || "N/A",
      hasData: safeOrders.length > 0
    };
  }, [orders]); // Watch the full array to keep it stable

  // 2. NO EARLY RETURNS. Use a single return with a conditional UI block.
  
  return (
    <div className="w-full">
      {!hasData ? (
        /* EMPTY STATE: Only plain HTML/Lucide here (No Hooks) */
        <div className="py-24 text-center space-y-4 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="mx-auto w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-200">
            <Clock size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Awaiting Data Feed</p>
            <p className="text-[11px] font-bold text-slate-300 italic">Metrics will appear once the first order is recorded.</p>
          </div>
        </div>
      ) : (
        /* MAIN UI: Everything else stays the same */
        <div className="no-print w-full space-y-6 select-none animate-in fade-in duration-500">
           {/* Your existing Analytics Bar, Chart Div, and Table Log code goes here */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stats Tiles... */}
           </div>

           <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm">
             <div ref={containerRef} className="w-full h-[300px] flex items-center justify-center">
                {dimensions.width > 0 && (
                  <LineChart width={dimensions.width} height={300} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip contentStyle={{borderRadius: '15px'}} />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={4} />
                  </LineChart>
                )}
             </div>
           </div>
           
           {/* Table Log... */}
        </div>
      )}

      {/* PORTAL (Rendered at the end, hooks already called) */}
      {showPrintVersion && hasData && createPortal(
        <div className="p-10 bg-white text-slate-900">
           {/* Your Print Layout... */}
        </div>,
        document.body
      )}
    </div>
  );
}