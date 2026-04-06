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

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0]; 
    dailyCounts[key] = 0;
  }

  safeOrders.forEach(o => {
    const dateSrc = o.created_at || o.date || o.chartDate;
    if (!dateSrc) return;
    const orderDateKey = dateSrc.split('T')[0];
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
      <div className="h-[400px] flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting System Data Feed</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-700">
      <div 
        className="w-full bg-white rounded-[2rem] border border-slate-100 p-6 print:border-none print:p-0"
        /* CRITICAL FIX: Changed minHeight to 400px to match AdminDashboard 
           and added position relative to anchor the chart.
        */
        style={{ minHeight: '400px', height: '400px', position: 'relative' }}
      >
        {isMounted && (
          /* FIX: We use a fixed height (400) instead of "100%". 
             This prevents the -20000px offset error.
          */
          <ResponsiveContainer width="100%" height={400}>
            <LineChart 
              data={stats.chartData} 
              margin={{ top: 20, right: 30, left: -20, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="#f1f5f9" 
              />
              
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
                animationDuration={1000}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}