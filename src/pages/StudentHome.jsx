import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShoppingBag, Info, CheckCircle2, 
  ArrowRight, Sparkles, Clock, AlertTriangle 
} from 'lucide-react';

export default function StudentHome() {
  const { items, addOrder, officeStatus, announcements = [] } = useApp();
  const [ordering, setOrdering] = useState(null);

  const handleOrder = async (item, size) => {
    if (officeStatus !== 'OPEN') return;

    setOrdering({ id: item.id, size });
    const result = await addOrder({
      itemId: item.id,
      itemName: item.name,
      size: size
    });
    
    // We'll let the global state/socket handle the update, 
    // but we can provide a small local feedback reset
    setTimeout(() => setOrdering(null), 2000);
  };

  const latestAnnouncement = announcements[0];

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      
      {/* 🌟 HERO SECTION / ANNOUNCEMENT */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl shadow-slate-200">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
              <Sparkles size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Official Merch Portal</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">
              GEAR UP FOR <br/> 
              <span className="text-emerald-400">THE SEMESTER.</span>
            </h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">
              {latestAnnouncement?.content || "Claim your official student merchandise. Real-time stock tracking enabled."}
            </p>
          </div>
          
          <div className={`flex flex-col items-center gap-2 p-6 rounded-[2.5rem] border-2 backdrop-blur-md transition-all duration-500 ${
            officeStatus === 'OPEN' 
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}>
            <Clock size={32} className={officeStatus === 'OPEN' ? 'animate-pulse' : ''} />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Office Status</p>
              <p className="text-xl font-black uppercase tracking-tighter">{officeStatus}</p>
            </div>
          </div>
        </div>
        
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -mr-20 -mt-20" />
      </div>

      {/* 🏷️ CATEGORY FILTER AREA */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Available Drops</h2>
          <span className="h-px w-12 bg-slate-200 hidden md:block" />
          <p className="text-slate-400 text-sm font-bold hidden md:block">{items.length} Units Found</p>
        </div>
      </div>

      {/* 📦 ITEMS GRID */}
      {items.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-24 text-center border-2 border-dashed border-slate-100">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
            <ShoppingBag size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Vault is Empty</h3>
          <p className="text-slate-400 font-medium mt-2">Check back later for new merchandise drops.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="group relative bg-white rounded-[3rem] border border-slate-100 p-2 transition-all duration-500 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] hover:-translate-y-2"
            >
              {/* Card Header Image/Display Area */}
              <div className="h-64 bg-slate-50 rounded-[2.5rem] relative overflow-hidden flex items-center justify-center">
                <ShoppingBag size={80} className="text-slate-100 group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-6 left-6">
                  <span className="px-4 py-1.5 bg-white/90 backdrop-blur-md text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                    {item.category || 'Limited Edition'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 pt-8 space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authentication Verified</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Select Variant</span>
                    {officeStatus !== 'OPEN' && (
                      <span className="text-[10px] font-black text-red-400 uppercase flex items-center gap-1">
                        <AlertTriangle size={12} /> Portal Closed
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(item.sizes || {}).map(([size, qty]) => {
                      const isOutOfStock = qty <= 0;
                      const isOrderingThis = ordering?.id === item.id && ordering?.size === size;

                      return (
                        <button
                          key={size}
                          disabled={isOutOfStock || !!ordering || officeStatus !== 'OPEN'}
                          onClick={() => handleOrder(item, size)}
                          className={`
                            relative overflow-hidden px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-3 border-2 
                            ${isOutOfStock 
                              ? 'bg-slate-50 border-slate-50 text-slate-300 cursor-not-allowed' 
                              : isOrderingThis
                                ? 'bg-emerald-500 border-emerald-500 text-white animate-pulse'
                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-900 hover:text-slate-900 active:scale-95'
                            }
                          `}
                        >
                          <span className="relative z-10">{size}</span>
                          <span className={`relative z-10 text-[9px] px-2 py-0.5 rounded-lg ${
                            isOutOfStock ? 'bg-slate-100' : isOrderingThis ? 'bg-emerald-400' : 'bg-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors'
                          }`}>
                            {qty}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Link */}
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-slate-400">
                      <Info size={14} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Product Specs</span>
                   </div>
                   <ArrowRight size={18} className="text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}