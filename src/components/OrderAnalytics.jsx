import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * 🛠️ DATA PROCESSING LOGIC
 * This handles the math for the chart and the stats cards.
 */
const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  if (safeOrders.length === 0) return { hasData: false, chartData: [], todayCount: 0, avgWaitTime: 0, peakDay: "N/A" };

  const dailyCounts = {};
  const now = new Date();
  let totalWait = 0;
  let timedOrders = 0;

  // Initialize the last 7 days with 0
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
    if (Object.prototype.hasOwnProperty.call(dailyCounts, dateKey)) dailyCounts[dateKey] += 1;
    if (dateKey === todayStr) countToday++;
    
    // Calculate Wait Time for Completed Orders
    if ((o.status === 'READY' || o.status === 'COMPLETED' || o.status === 'CLAIMED') && o.updated_at) {
      const wait = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
      if (wait > 0) {
        totalWait += wait;
        timedOrders++;
      }
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
    hasData: true
  };
};

export default function OrderAnalytics({ orders = [] }) {
  // 🛡️ Guard state to prevent "Width -1" errors during initial animation
  const [isReady, setIsReady] = useState(false);
  
  const stats = useMemo(() => processOrderData(orders), [orders]);

  useEffect(() => {
    // Wait 150ms for the AdminDashboard fade-in animation to stabilize the container width
    const timer = setTimeout(() => setIsReady(true), 150);
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
            {isReady ? (
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                 <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}