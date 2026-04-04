import React from 'react';
import Sidebar from './Sidebar'; // Ensure the filename is Sidebar.jsx (Capital S)
import { Menu, X, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Layout({ 
  children, 
  activeTab, 
  setActiveTab, 
  isSidebarOpen, 
  setIsSidebarOpen,
  isLocked 
}) {
  const { user } = useApp();
  
  const toggleSidebar = () => {
    if (typeof setIsSidebarOpen === 'function') {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  return (
    /* 1. FIXED VIEWPORT WRAPPER */
    <div className="h-screen w-full flex overflow-hidden bg-slate-50 relative">
      
      {/* 2. MOBILE TOGGLE BUTTON */}
      <button 
        onClick={toggleSidebar}
        className={`fixed top-4 left-4 z-[70] p-3 text-white rounded-2xl shadow-xl lg:hidden transition-all active:scale-95 ${
          isAdmin ? 'bg-amber-600' : 'bg-emerald-900'
        }`}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* 3. SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] transform transition-transform duration-500 ease-in-out
        lg:relative lg:translate-x-0 lg:flex flex-shrink-0 w-80
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          closeSidebar={() => setIsSidebarOpen(false)} 
          isLocked={isLocked}
        />
      </aside>

      {/* 4. ADOPTIVE MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        
        {/* Verification Alert Bar */}
        {isLocked && (
          <div className="flex-shrink-0 bg-amber-500 text-white px-6 py-2 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest z-50 shadow-md">
            <ShieldAlert size={14} />
            Restricted Mode: Identity Binding Required
          </div>
        )}

        {/* 5. INTERNAL SCROLL PANE */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          {/* Dynamic Background Gradient */}
          <div className={`absolute top-0 inset-x-0 h-64 pointer-events-none transition-colors duration-700 ${
            isAdmin 
              ? 'bg-gradient-to-b from-amber-50/50 to-transparent' 
              : 'bg-gradient-to-b from-emerald-50/60 to-transparent'
          }`} />
          
          {/* Main Content Container */}
          <div className={`relative z-10 p-4 lg:p-8 pt-20 lg:pt-10 ${
            isAdmin ? 'max-w-full' : 'max-w-7xl'
          } mx-auto transition-all duration-500`}>
            {children}
          </div>
        </div>
      </main>

      {/* 6. MOBILE BACKDROP */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}