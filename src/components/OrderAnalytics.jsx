import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { Printer, Loader2, Zap, Clock } from 'lucide-react';

// --- 1. MOVE LOGIC OUTSIDE THE COMPONENT ---
// This ensures the logic is "Pure" and cannot accidentally trigger Hook errors.
const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const dailyCounts = {};
  const now = new Date();
  let totalWait = 0;
  let timedOrders = 0;

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

  const chartData = Object.keys(dailyCounts).sort().map(key => ({
    label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: dailyCounts[key]
  }));

  const peak = chartData.reduce((p, c) => (p.count > c.count ? p : c), chartData[0]);

  return {
    chartData,
    todayCount: countToday,
    avgWaitTime: timedOrders > 0 ? Math.round((totalWait / timedOrders) / 60000) : 0,
    peakDay: peak?.label || "N/A",
    hasData: safeOrders.length > 0
  };
};

export default function OrderAnalytics({ orders = [] }) {
  const [showPrintVersion, setShowPrintVersion] = useState(false);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // --- 2. STABLE HOOKS ---
  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    const observer = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      if (width > 0) setDimensions(prev => prev.width !== width ? { width, height: 300 } : prev);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Simplified useMemo - only returns raw data
  const stats = useMemo(() => processOrderData(orders), [orders]);

  const handlePrint = () => {
    setShowPrintVersion(true);
    setTimeout(() => { window.print(); setShowPrintVersion(false); }, 800);
  };

  // --- 3. SINGLE RETURN PATH ---
  return (
    <div className="w-full">
      {!stats.hasData ? (
        <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
           <p className="text-[10px] font-black text-slate-400 uppercase">No Data Available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* STATS STRIP */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[8px] font-bold uppercase text-slate-400">Avg Speed</p>
              <p className="text-xl font-black">{stats.avgWaitTime}m</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[8px] font-bold uppercase text-slate-400">Peak</p>
              <p className="text-xl font-black">{stats.peakDay}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl text-white">
               <p className="text-[8px] font-bold uppercase text-emerald-400">Today</p>
               <p className="text-xl font-black">{stats.todayCount}</p>
            </div>
          </div>

          {/* CHART */}
          <div ref={containerRef} className="w-full h-[300px] bg-white rounded-[2rem] border border-slate-100 p-4">
            {dimensions.width > 0 && (
              <LineChart width={dimensions.width} height={250} data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{fontSize: 10}} hide={showPrintVersion} />
                <YAxis tick={{fontSize: 10}} hide={showPrintVersion} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={4} isAnimationActive={false} />
              </LineChart>
            )}
          </div>
        </div>
      )}
    </div>
  );
}