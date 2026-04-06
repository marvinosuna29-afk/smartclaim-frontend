import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * 🛠️ DATA PROCESSING LOGIC
 * Uses en-CA locale for a reliable YYYY-MM-DD match across timezones.
 */
const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const dailyCounts = {};
  const now = new Date();

  // 1. Initialize the last 7 days with 0 (Standardized YYYY-MM-DD)
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    // 'en-CA' always returns YYYY-MM-DD
    const dateKey = d.toLocaleDateString('en-CA'); 
    dailyCounts[dateKey] = 0;
  }

  // 2. Map orders to those days
  safeOrders.forEach(o => {
    // Your console log showed 'created_at', so we prioritize that
    const dateSrc = o.created_at || o.chartDate || o.date;
    if (!dateSrc) return;

    const dateObj = new Date(dateSrc);
    if (isNaN(dateObj)) return;

    // Convert the order's date to the same YYYY-MM-DD format
    const orderKey = dateObj.toLocaleDateString('en-CA');

    if (Object.prototype.hasOwnProperty.call(dailyCounts, orderKey)) {
      dailyCounts[orderKey] += 1;
    }
  });

  // 3. Convert to Chart Format
  const formattedChartData = Object.keys(dailyCounts).sort().map(key => ({
    fullDate: key,
    // Display label as "Apr 6"
    label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: dailyCounts[key]
  }));

  // Match today's key for the summary count
  const todayKey = now.toLocaleDateString('en-CA');
  const countToday = dailyCounts[todayKey] || 0;

  return {
    chartData: formattedChartData,
    todayCount: countToday,
    hasData: safeOrders.length > 0
  };
};

export default function OrderAnalytics({ orders = [] }) {
  const [isMounted, setIsMounted] = useState(false);

  // Memoize to prevent jittery chart re-renders
  const stats = useMemo(() => processOrderData(orders), [orders]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show "Awaiting Feed" only if there are strictly zero orders
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
        style={{ height: '100%', minHeight: '350px' }}
      >
        {isMounted && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stats.chartData}
              margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
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
                allowDecimals={false}
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
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                strokeWidth={5}
                dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 0, fill: '#059669' }}
                animationDuration={1500}
                fill="url(#lineGradient)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}