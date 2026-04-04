import React, { useState, useEffect, useRef } from 'react';
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
  // 1. ALL HOOKS MUST BE HERE AT THE TOP LEVEL
  const {
    user, isLocked, loading, officeStatus, refreshData,
    orders, items, announcements, currentQueue, deleteItem 
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

  // 2. EARLY RETURNS (LOADING/LOGIN) GO AFTER ALL HOOKS
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

  // 3. RENDER CONTENT (Uses variables from the top level)
  const renderContent = () => {
    const role = user?.role?.toLowerCase();
    const isStudent = role === 'student';
    const isVerified = Number(user?.is_verified) === 1;

    if (isStudent && !isVerified) {
      return <ProfileSettings />;
    }

    const renderStudentPortal = (view) => (
      <StudentPortal
        activeTab={view}
        myOrders={orders || []} 
        items={items || []}
        announcements={announcements || []}
        currentQueue={currentQueue}
        officeStatus={officeStatus}
      />
    );

    switch (activeTab) {
      case 'dashboard':
        return isStudent 
          ? renderStudentPortal('dashboard') 
          // ✅ FIX: Added setActiveTab prop here
          : <AdminDashboard setActiveTab={handleNavigate} />; 

      case 'history':
        return isStudent ? renderStudentPortal('history') : <AdminOrders />;
      
      case 'orders':
        return isStudent ? renderStudentPortal('dashboard') : <AdminOrders />;
      
      case 'inventory':
        return isStudent ? renderStudentPortal('dashboard') : <AdminInventory />;
      
      case 'profile':
        return <ProfileSettings />;
      
      case 'announcements':
        return <AnnouncementManager />;
      
      case 'users':
        return <AdminUsers />;
      
      case 'scanner':
        return <LiveScanner />;
      
      default:
        return isStudent 
          ? renderStudentPortal('dashboard') 
          // ✅ FIX: Added setActiveTab prop to default case as well
          : <AdminDashboard setActiveTab={handleNavigate} />;
    }
  };

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
          {renderContent()}
        </Layout>
      </div>
    </div>
  );
}

export default App;