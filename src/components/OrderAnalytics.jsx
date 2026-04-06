import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * 🛠️ DATA PROCESSING LOGIC
 * Improved to handle various date formats and ensure a 7-day window.
 */
const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const dailyCounts = {};

  // 1. Initialize the last 7 days using LOCAL date strings
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Use local date format YYYY-MM-DD instead of ISO
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const label = `${year}-${month}-${day}`;
    dailyCounts[label] = 0;
  }

  safeOrders.forEach(o => {
    const dateSrc = o.created_at || o.date;
    if (!dateSrc) return;

    const dateObj = new Date(dateSrc);
    if (isNaN(dateObj)) return;

    // Convert the order's date to the same LOCAL YYYY-MM-DD format
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    if (Object.prototype.hasOwnProperty.call(dailyCounts, dateKey)) {
      dailyCounts[dateKey] += 1;
    }
  });

  const hasData = safeOrders.length > 0;

  return {
    chartData,
    todayCount: countToday,
    hasData
  };
};

export default function OrderAnalytics({ orders = [] }) {
  const [isMounted, setIsMounted] = useState(false);

  // Memoize stats so it doesn't re-calculate on every render
  const stats = useMemo(() => processOrderData(orders), [orders]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!stats.hasData) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting System Data Feed</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      <div
        className="w-full bg-white rounded-[2rem] border border-slate-100 p-6 print:border-none print:p-0"
        style={{ height: '100%', minHeight: '300px' }}
      >
        {isMounted && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stats.chartData}
              margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' }}
                contentStyle={{
                  borderRadius: '1.25rem',
                  border: 'none',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '12px'
                }}
              />
              <Line
                type="bundle"
                dataKey="count"
                stroke="#10b981"
                strokeWidth={5}
                dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 0, fill: '#059669' }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}