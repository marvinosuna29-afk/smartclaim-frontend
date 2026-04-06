import React, { useState, useEffect, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from 'recharts';

const processOrderData = (orders) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const dailyCounts = {};
  const now = new Date();

  // 1. Initialize last 7 days (YYYY-MM-DD)
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0]; 
    dailyCounts[key] = 0;
  }

  // 2. Map orders with "Split" logic to ignore Time/Timezones
  safeOrders.forEach(o => {
    const dateSrc = o.created_at || o.date || o.chartDate;
    if (!dateSrc) return;

    // "2026-04-06T12:05:27.000Z" -> "2026-04-06"
    const orderDateKey = dateSrc.split('T')[0];

    if (Object.prototype.hasOwnProperty.call(dailyCounts, orderDateKey)) {
      dailyCounts[orderDateKey] += 1;
    }
    
    // DEBUG: Look at your console to see if these match!
    console.log(`Comparing Order: ${orderDateKey} to Chart Keys:`, Object.keys(dailyCounts));
  });

  const formattedChartData = Object.keys(dailyCounts).sort().map(key => ({
    label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: dailyCounts[key]
  }));

  return {
    chartData: formattedChartData,
    hasData: safeOrders.length > 0
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
      <div className="h-[350px] flex items-center justify-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Data in Feed</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: '350px', minHeight: '350px' }}>
      {isMounted && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="label" 
              tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              allowDecimals={false}
              tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#10b981" 
              strokeWidth={4} 
              dot={{ r: 4, fill: '#10b981' }}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}