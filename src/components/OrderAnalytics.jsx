import React, { useState, useEffect, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

/**
 * 🛠️ DATA PROCESSING LOGIC
 */
const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const dailyCounts = {};

  // 1. Generate keys for the last 7 days based on LOCAL time
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA'); // Results in "YYYY-MM-DD"
    dailyCounts[key] = 0;
  }

  // 2. Map orders to those keys
  safeOrders.forEach(o => {
    const dateSrc = o.created_at || o.date;
    if (!dateSrc) return;

    // Convert whatever the DB sends into a local YYYY-MM-DD string
    const orderDate = new Date(dateSrc);
    const orderKey = orderDate.toLocaleDateString('en-CA');

    if (Object.prototype.hasOwnProperty.call(dailyCounts, orderKey)) {
      dailyCounts[orderKey] += 1;
    }
  });

  const formattedData = Object.keys(dailyCounts).sort().map(key => ({
    label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: dailyCounts[key]
  }));


  return {
    chartData: formattedData,
    hasData: true
  };
};

export default function OrderAnalytics({ orders = [] }) {
  const [isMounted, setIsMounted] = useState(false);
  const stats = useMemo(() => processOrderData(orders), [orders]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!stats.hasData) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting System Data Feed</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-[2rem] border border-slate-100 p-6 flex justify-center items-center" style={{ minHeight: '400px' }}>
      {isMounted && (
        /* 🛠️ THE CIRCUIT BREAKER: 
           We specify a fixed width (800) and height (350). 
           If the chart appears now, we know the issue was the ResponsiveContainer 
           failing to measure your dashboard layout.
        */
        <LineChart
          width={800}
          height={350}
          data={stats.chartData}
          margin={{ top: 20, right: 30, left: -20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: '1.25rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            strokeWidth={5}
            dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  );
}