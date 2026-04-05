import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line
} from 'recharts';
import { Printer, Loader2, Zap, Clock } from 'lucide-react';

export default function OrderAnalytics({ orders = [] }) {
  // 1. ALL STATE & REFS AT THE TOP
  const [showPrintVersion, setShowPrintVersion] = useState(false);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 2. ALL EFFECTS NEXT
  useEffect(() => {
    const observeTarget = containerRef.current;
    if (!observeTarget) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries?.length) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(observeTarget);
    return () => resizeObserver.disconnect();
  }, []);

  // 3. ALL MEMOS (Logic processing)
  const { chartData, todayCount, avgWaitTime, peakDay } = useMemo(() => {
    const dailyCounts = {};
    const now = new Date();
    let totalWait = 0;
    let timedOrders = 0;

    // Build the last 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dailyCounts[d.toLocaleDateString('en-CA')] = 0;
    }

    const todayStr = now.toLocaleDateString('en-CA');
    let countToday = 0;

    // Ensure orders is an array before processing
    const safeOrders = Array.isArray(orders) ? orders : [];

    safeOrders.forEach(o => {
      const dateObj = new Date(o.created_at || o.date);
      const dateKey = dateObj.toLocaleDateString('en-CA');

      if (dailyCounts.hasOwnProperty(dateKey)) {
        dailyCounts[dateKey] += 1;
      }
      if (dateKey === todayStr) countToday++;

      if ((o.status === 'READY' || o.status === 'COMPLETED') && o.updated_at) {
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

    const peakResult = formattedData.length > 0 
      ? formattedData.reduce((prev, curr) => (prev.count > curr.count) ? prev : curr, formattedData[0])
      : { label: 'N/A' };

    return {
      chartData: formattedData,
      todayCount: countToday,
      avgWaitTime: timedOrders > 0 ? Math.round((totalWait / timedOrders) / 60000) : 0,
      peakDay: peakResult.label
    };
  }, [orders]);

  // 4. HANDLERS
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
      margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
        axisLine={false}
        tickLine={false}
        dy={10}
      />
      <YAxis
        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
        allowDecimals={false}
        axisLine={false}
        tickLine={false}
      />
      {!isPrinting && (
        <Tooltip
          contentStyle={{ borderRadius: '15px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '12px' }}
          itemStyle={{ color: '#10b981', fontWeight: '900' }}
        />
      )}
      <Line
        type="monotone"
        dataKey="count"
        stroke="#10b981"
        strokeWidth={4}
        dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
        activeDot={{ r: 6, strokeWidth: 0 }}
        isAnimationActive={!isPrinting}
      />
    </LineChart>
  );

  // 5. CONDITIONAL RENDER (Now safe because all hooks have fired)
  if (!orders || orders.length === 0) {
    return (
      <div className="p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 animate-pulse">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Syncing Audit Feed...</p>
        </div>
      </div>
    );
  }

  // 6. MAIN JSX
  return (
    <>
      <div className="no-print w-full space-y-6 select-none">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem]">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={16} className="text-emerald-600" />
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Avg. Processing</p>
            </div>
            <h3 className="text-3xl font-black text-slate-900">{avgWaitTime} <span className="text-sm font-bold text-slate-400">mins</span></h3>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem]">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={16} className="text-amber-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peak Activity</p>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{peakDay}</h3>
          </div>

          <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Daily Volume</p>
              <button onClick={handlePrint} className="text-white hover:text-emerald-400 transition-colors">
                <Printer size={16} />
              </button>
            </div>
            <h3 className="text-3xl font-black">{todayCount} <span className="text-sm font-bold text-slate-500">Orders</span></h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm">
          <div ref={containerRef} className="w-full h-[300px] flex items-center justify-center">
            {dimensions.width > 0 ? (
              <RenderChart width={dimensions.width} height={300} isPrinting={false} />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <p className="font-black text-slate-300 uppercase tracking-widest text-[9px]">Syncing Canvas</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                <th className="py-4 px-8">Audit Period</th>
                <th className="py-4 px-8 text-right">Throughput</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {chartData.map((day, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 px-8 font-bold text-slate-600 text-xs">{day.label}</td>
                  <td className="py-4 px-8 text-right font-black text-slate-900 text-sm group-hover:text-emerald-600">
                    {day.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPrintVersion && createPortal(
        <div className="p-10 bg-white text-slate-900">
          <header className="flex justify-between border-b-4 border-slate-900 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase italic">Terminal_Audit_Report</h1>
              <p className="text-xs font-bold text-slate-500 tracking-[0.3em]">PERFORMANCE METRICS FEED</p>
            </div>
            <div className="text-right text-[10px] font-mono">
              <p>{new Date().toLocaleDateString()}</p>
              <p>{new Date().toLocaleTimeString()}</p>
            </div>
          </header>
          <div className="mb-10 flex justify-center border p-4 rounded-xl">
            <RenderChart width={650} height={250} isPrinting={true} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 uppercase font-black text-[10px]">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-right">Units Processed</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((day, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 font-bold">{day.label}</td>
                  <td className="py-2 text-right font-black">{day.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
        document.body
      )}
    </>
  );
}