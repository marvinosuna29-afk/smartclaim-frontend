import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from './context/AppContext';

// --- COMPONENTS ---
import Layout from './components/layout/Layout';
import LiveTicker from './components/LiveTicker';

// --- PAGES ---
import Login from './pages/Login';
import StudentPortal from './pages/StudentPortal';
import AdminInventory from './pages/AdminInventory';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminOrders from './pages/AdminOrders';
import LiveScanner from './pages/Scanner';
import AnnouncementManager from './pages/AnnouncementManager';
import ProfileSettings from './pages/ProfileSettings';

function App() {
  const {
    user, isLocked, loading, officeStatus, refreshData,
    orders, items, announcements, currentQueue
  } = useApp();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const hasInitialFetched = useRef(false);

  useEffect(() => {
    if (user?.role && !hasInitialFetched.current) {
      setActiveTab('dashboard');
      if (refreshData) refreshData();
      hasInitialFetched.current = true;
    }
  }, [user?.role, refreshData]);

  const handleNavigate = (tabId) => {
    const role = user?.role?.toLowerCase();
    const isVerified = Number(user?.is_verified) === 1;
    const adminOnlyTabs = ['inventory', 'users', 'announcements', 'scanner'];

    if (role !== 'admin' && adminOnlyTabs.includes(tabId)) return;
    if (role === 'student' && !isVerified && tabId !== 'profile') return;

    setActiveTab(tabId);
    setIsSidebarOpen(false);
  };

  // --- 1. PRE-CALCULATE USER STATE ---
  const role = user?.role?.toLowerCase();
  const isStudent = role === 'student';
  const isVerified = Number(user?.is_verified) === 1;

  // --- 2. EARLY RETURNS (STILL AFTER ALL HOOKS) ---
  if (loading && !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-emerald-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-900 font-black uppercase text-[10px] tracking-[0.3em]">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  // --- 3. STABLE CONTENT SELECTION ---
  // Instead of a function, we use a variable. This helps the minifier map the tree.
  let Content;
  
  if (isStudent && !isVerified) {
    Content = <ProfileSettings />;
  } else {
    switch (activeTab) {
      case 'dashboard':
        Content = isStudent 
          ? <StudentPortal activeTab="dashboard" myOrders={orders || []} items={items || []} announcements={announcements || []} currentQueue={currentQueue} officeStatus={officeStatus} />
          : <AdminDashboard setActiveTab={handleNavigate} />;
        break;
      case 'history':
      case 'orders':
        Content = isStudent 
          ? <StudentPortal activeTab="history" myOrders={orders || []} items={items || []} announcements={announcements || []} currentQueue={currentQueue} officeStatus={officeStatus} />
          : <AdminOrders />;
        break;
      case 'inventory':
        Content = isStudent 
          ? <StudentPortal activeTab="dashboard" myOrders={orders || []} items={items || []} announcements={announcements || []} currentQueue={currentQueue} officeStatus={officeStatus} />
          : <AdminInventory />;
        break;
      case 'profile':
        Content = <ProfileSettings />;
        break;
      case 'announcements':
        Content = <AnnouncementManager />;
        break;
      case 'users':
        Content = <AdminUsers />;
        break;
      case 'scanner':
        Content = <LiveScanner />;
        break;
      default:
        Content = isStudent 
          ? <StudentPortal activeTab="dashboard" myOrders={orders || []} items={items || []} announcements={announcements || []} currentQueue={currentQueue} officeStatus={officeStatus} />
          : <AdminDashboard setActiveTab={handleNavigate} />;
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-50 flex flex-col">
      <div className="flex-shrink-0 z-[100]">
        {officeStatus === 'CLOSED' && (
          <div className="bg-red-600 text-white py-2 px-4 text-center font-black uppercase tracking-widest text-[9px] animate-pulse">
            ⚠️ Terminal Warning: Office is currently CLOSED.
          </div>
        )}
        <LiveTicker />
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <Layout
          activeTab={activeTab}
          setActiveTab={handleNavigate}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isLocked={isLocked || false}
          userRole={user?.role}
        >
          {/* Inject the pre-defined Content variable */}
          {Content}
        </Layout>
      </div>
    </div>
  );
}

export default App;