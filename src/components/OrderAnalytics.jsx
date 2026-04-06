import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';

// (Keep your processOrderData function exactly as it is above)

export default function OrderAnalytics({ orders = [] }) {
  // 1. New State: This prevents the chart from even TRYING to render until the JS is fully loaded
  const [isReady, setIsReady] = useState(false);
  const stats = useMemo(() => processOrderData(orders), [orders]);

  useEffect(() => {
    // 2. Small delay to ensure the parent container animation (fade-in) has started
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full">
      {!stats.hasData ? (
        <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase">Awaiting System Data</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* STATS STRIP */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[8px] font-bold uppercase text-slate-400">Avg Speed</p>
              <p className="text-xl font-black text-slate-900">{stats.avgWaitTime}m</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[8px] font-bold uppercase text-slate-400">Peak</p>
              <p className="text-xl font-black text-slate-900">{stats.peakDay}</p>
            </div>
            <div className="bg-slate-900 p-4 rounded-2xl text-white">
               <p className="text-[8px] font-bold uppercase text-emerald-400">Today</p>
               <p className="text-xl font-black">{stats.todayCount}</p>
            </div>
          </div>

          {/* CHART WRAPPER */}
          <div className="w-full h-[300px] bg-white rounded-[2rem] border border-slate-100 p-4 overflow-hidden">
            {/* 3. ONLY render the ResponsiveContainer when isReady is true */}
            {isReady && (
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <LineChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tick={{fontSize: 10, fill: '#94a3b8'}} 
                    axisLine={false}
                    tickLine={false} 
                  />
                  <YAxis 
                    tick={{fontSize: 10, fill: '#94a3b8'}} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '1rem', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#10b981" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6, strokeWidth: 0 }} 
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}