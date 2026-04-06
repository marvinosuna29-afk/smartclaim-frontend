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
  const now = new Date();

  // 1. Initialize Last 7 Days
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyCounts[key] = 0;
  }

  safeOrders.forEach(o => {
    const dateValue = o.created_at || o.date || o.chartDate;
    if (!dateValue) return;

    // 🛠️ ROBUST DATE PARSING: Handles MySQL " " and ISO "T"
    let orderDateKey;
    if (typeof dateValue === 'string') {
      orderDateKey = dateValue.includes('T')
        ? dateValue.split('T')[0]
        : dateValue.split(' ')[0];
    } else {
      orderDateKey = new Date(dateValue).toISOString().split('T')[0];
    }

    if (Object.prototype.hasOwnProperty.call(dailyCounts, orderDateKey)) {
      dailyCounts[orderDateKey] += 1;
    }
  });

  const formattedData = Object.keys(dailyCounts).sort().map(key => ({
    fullDate: key,
    label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: dailyCounts[key]
  }));

  return {
    chartData: formattedData,
    hasData: true // Force true so we don't flicker back to "Awaiting Feed"
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
    <div className="w-full h-[400px] min-h-[400px] relative">
      {/* We use a standard Tailwind class h-[400px] AND an inline style 
       to ensure the browser definitely knows how tall this area is.
    */}
      <div
        className="w-full bg-white rounded-[2rem] border border-slate-100 p-6"
        style={{ height: '400px', width: '100%' }}
      >
        {isMounted && stats.chartData.length > 0 && (
          <ResponsiveContainer minWidth={0} width="100%" height="100%">
            <LineChart
              data={stats.chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
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
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}