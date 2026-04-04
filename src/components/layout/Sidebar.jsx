import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard, Package, History,
  Megaphone, Camera, LogOut, Users,
  User, ShoppingCart, Lock, ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, closeSidebar, isLocked }) {
  const { user, setUser } = useApp();

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    // This forces the browser to go to the root URL, 
    // which avoids the 404 on sub-pages like /dashboard or /inventory
    window.location.href = '/';
  };

  const userRole = user?.role?.toUpperCase() || 'STUDENT';

  // --- NAVIGATION CONFIG ---
  const navItems = userRole === 'ADMIN' ? [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'All Orders', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'scanner', label: 'Live Scanner', icon: Camera },
    { id: 'announcements', label: 'Broadcast', icon: Megaphone },
    { id: 'profile', label: 'My Profile', icon: User },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'My Orders', icon: History },
    { id: 'profile', label: 'Profile & Security', icon: User },
  ];

  return (
    <div className="w-72 h-full bg-white border-r border-slate-100 flex flex-col shadow-[20px_0_40px_-20px_rgba(0,0,0,0.05)] overflow-hidden">

      {/* 🚀 BRAND HEADER */}
      <div className="flex-shrink-0 pt-10 pb-8 px-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex-shrink-0 flex items-center justify-center text-emerald-400 font-black text-2xl shadow-xl rotate-3">
            S
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xl font-black text-slate-900 tracking-tighter leading-none">SMART</span>
            <span className="text-emerald-500 font-bold tracking-[0.2em] text-[10px] uppercase mt-1">Claim Protocol</span>
          </div>
        </div>

        {/* Status Indicator Chip */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 ${isLocked ? 'bg-red-50 border-red-100 text-red-600' :
            userRole === 'ADMIN' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}>
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLocked ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
              userRole === 'ADMIN' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            }`} />
          <span className="text-[9px] font-black uppercase tracking-widest leading-none">
            {isLocked ? 'System Locked' : `${userRole} Node Online`}
          </span>
        </div>
      </div>

      {/* 🧭 NAVIGATION */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto no-scrollbar pb-6">
        <div className="px-4 mb-2">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Main Menu</p>
        </div>
        {navItems.map((item) => {
          const isDisabled = isLocked && item.id !== 'profile';
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              disabled={isDisabled}
              onClick={() => {
                setActiveTab(item.id);
                if (closeSidebar) closeSidebar();
              }}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all duration-300 group relative ${isActive
                  ? 'bg-slate-900 text-white shadow-2xl shadow-slate-200'
                  : isDisabled
                    ? 'text-slate-300 cursor-not-allowed grayscale'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <item.icon size={18} className={`${isActive ? "text-emerald-400" : "group-hover:scale-110 group-hover:text-slate-600 transition-all duration-300"}`} />
              <span className="flex-1 text-[11px] font-black uppercase tracking-wider text-left">{item.label}</span>

              {isActive && !isDisabled && <ChevronRight size={14} className="text-emerald-400 animate-in fade-in slide-in-from-left-2" />}
              {isDisabled && <Lock size={14} className="opacity-50" />}
            </button>
          );
        })}
      </nav>

      {/* 👤 BOTTOM IDENTITY */}
      <div className="flex-shrink-0 p-6 mt-auto">
        <div className={`p-5 rounded-[2rem] border transition-all duration-300 ${isLocked ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100 shadow-inner'
          }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
              <User size={20} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Authenticated As</p>
              <p className="text-sm font-black text-slate-900 truncate tracking-tight uppercase">
                {user?.full_name || user?.name || 'Authorized User'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-100"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

        {/* Verification Badge for Students */}
        {!isLocked && userRole === 'STUDENT' && (
          <div className="mt-4 flex items-center justify-center gap-2 opacity-50">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 italic">Secure Node Verified</span>
          </div>
        )}
      </div>
    </div>
  );
}