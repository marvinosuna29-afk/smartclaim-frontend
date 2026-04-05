import React, { useState, useEffect, useRef, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Package } from 'lucide-react';

// Logic moved outside to keep component clean
const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  if (safeOrders.length === 0) return { hasData: false, chartData: [], todayCount: 0, avgWaitTime: 0, peakDay: "N/A" };

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
    if (Object.prototype.hasOwnProperty.call(dailyCounts, dateKey)) dailyCounts[dateKey] += 1;
    if (dateKey === todayStr) countToday++;
    
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
  const containerRef = useRef(null);
  const stats = useMemo(() => processOrderData(orders), [orders]);

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

          {/* CHART - Using ResponsiveContainer to avoid l is not a function errors on Resize */}
          <div ref={containerRef} className="w-full h-[300px] bg-white rounded-[2rem] border border-slate-100 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#10b981' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}