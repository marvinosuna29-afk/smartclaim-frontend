import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line
} from 'recharts';
import { Printer, Loader2 } from 'lucide-react';

export default function OrderAnalytics({ orders = [] }) {
  // Guard against empty data to prevent "l is not a function"
  if (!orders || orders.length === 0) {
    return (
      <div className="p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">No Audit Data Available</p>
      </div>
    );
  }
  const [showPrintVersion, setShowPrintVersion] = useState(false);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Custom Resize Observer to solve the -1 width/height issue
  useEffect(() => {
    const observeTarget = containerRef.current;
    if (!observeTarget) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      // Only update state if we have a valid positive size
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(observeTarget);
    return () => resizeObserver.disconnect();
  }, []);

  const { chartData, todayCount, avgWaitTime, peakDay } = useMemo(() => {
    const dailyCounts = {};
    const now = new Date();
    let totalWait = 0;
    let timedOrders = 0;

    // Initialize 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dailyCounts[d.toLocaleDateString('en-CA')] = 0;
    }

    const todayStr = now.toLocaleDateString('en-CA');
    let countToday = 0;

    (orders || []).forEach(o => {
      const dateObj = new Date(o.created_at || o.date);
      const dateKey = dateObj.toLocaleDateString('en-CA');

      // 1. Volume Tracking
      if (dailyCounts.hasOwnProperty(dateKey)) {
        dailyCounts[dateKey] += 1;
      }
      if (dateKey === todayStr) countToday++;

      // 2. Performance Tracking: Processing Speed
      // Assuming your DB has created_at and a status_updated_at (or similar)
      if (o.status === 'CLAIMED' && o.updated_at) {
        const start = new Date(o.created_at).getTime();
        const end = new Date(o.updated_at).getTime();
        totalWait += (end - start);
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
      // Metric: Avg minutes to process an order
      avgWaitTime: timedOrders > 0 ? Math.round((totalWait / timedOrders) / 60000) : 0,
      // Metric: Find the day with highest volume
      peakDay: formattedData.reduce((prev, curr) => (prev.count > curr.count) ? prev : curr).label
    };
  }, [orders]);

  const handlePrint = () => {
    setShowPrintVersion(true);
    setTimeout(() => {
      window.print();
      setShowPrintVersion(false);
    }, 800);
  };

  const RenderChart = ({ width, height, isPrinting }) => (
    <LineChart
      width={width}
      height={height}
      data={chartData}
      margin={{ top: 20, right: 60, left: 10, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }}
        axisLine={false}
        tickLine={false}
        dy={10}
      />
      <YAxis
        tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }}
        allowDecimals={false}
        axisLine={false}
        tickLine={false}
      />
      {!isPrinting && (
        <Tooltip
          contentStyle={{ borderRadius: '20px', border: 'none', background: '#0f172a', color: '#fff' }}
          itemStyle={{ color: '#10b981', fontWeight: '900' }}
        />
      )}
      <Line
        type="monotone"
        dataKey="count"
        stroke="#10b981"
        strokeWidth={6}
        dot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 3 }}
        isAnimationActive={false}
      />
    </LineChart>
  );

  return (
    <>
      <div className="no-print w-full space-y-8 p-2 select-none">
        <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
          <div>
            <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
              Terminal <span className="text-emerald-500">Analytics</span>
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {todayCount} Orders Processed Today
              </p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="group flex items-center gap-3 bg-slate-950 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl transition-all duration-300 font-black active:scale-95"
          >
            <span className="uppercase text-[10px] tracking-widest">Audit Report</span>
            <Printer size={18} className="group-hover:rotate-12 transition-transform" />
          </button>
        </div>

        <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-inner overflow-hidden">
          <div ref={containerRef} style={{ width: '100%', height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dimensions.width > 0 ? (
              <RenderChart width={dimensions.width} height={380} isPrinting={false} />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="font-black text-slate-300 uppercase tracking-[0.3em] text-[10px]">Initializing Viewport</p>
              </div>
            )}
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden select-none">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Audit Period</th>
                <th className="py-5 px-8 text-right font-black text-[10px] uppercase text-slate-400 tracking-widest">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {chartData.map((day, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="py-5 px-8 font-bold text-slate-600 text-sm">{day.label}</td>
                  <td className="py-5 px-8 text-right font-black text-slate-900 text-lg group-hover:text-emerald-600 transition-colors">
                    {day.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPrintVersion && createPortal(
        <div className="clean-audit-report p-6 bg-white text-slate-900 font-sans max-h-screen">
          {/* Tighter Header */}
          <header className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Performance Audit</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Terminal Data Feed</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-tighter">
                {new Date().toLocaleDateString()} | {new Date().toLocaleTimeString()}
              </p>
            </div>
          </header>

          {/* Section 1: Visual Analytics - Reduced height to 250px to save space */}
          <section className="mb-6" style={{ breakInside: 'avoid' }}>
            <div className="flex justify-center border border-slate-100 rounded-2xl p-4 bg-slate-50/30">
              <RenderChart width={750} height={250} isPrinting={true} />
            </div>
          </section>

          {/* Section 2: Table - Tighter rows */}
          <section style={{ breakInside: 'avoid' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Period</th>
                  <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Units</th>
                  <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((day, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 px-2 text-xs font-bold text-slate-700">{day.label}</td>
                    <td className="py-2 px-2 text-right font-black text-slate-900 text-sm">
                      {day.count} <span className="text-[8px] text-slate-400 font-bold ml-1">Orders</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Synced</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td className="py-3 px-4 font-black text-slate-900 uppercase text-[9px]">7-Day Total</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900 text-lg" colSpan={2}>
                    {chartData.reduce((acc, curr) => acc + curr.count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <footer className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
            <p className="text-[8px] uppercase font-black text-slate-300 tracking-[0.2em]">
              © {new Date().getFullYear()} Terminal Admin • Page 1 of 1
            </p>
            <div className="italic text-[8px] text-slate-400 font-bold border px-2 py-1 rounded">
              INTERNAL AUDIT LOG
            </div>
          </footer>
        </div>,
        document.body
      )}
    </>
  );
}