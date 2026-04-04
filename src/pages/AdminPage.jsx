import React from 'react';
import AdminDashboard from './AdminDashboard';
import Scanner from './Scanner';
import AdminOrders from './AdminOrders';
import AdminInventory from './AdminInventory'; // Ensure this is imported

export default function AdminPage({ activeTab, setActiveTab }) {
  // Use the activeTab passed down from App.jsx instead of local state
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard setActiveTab={setActiveTab} />;
      case 'scanner':   return <Scanner />;
      case 'orders':    return <AdminOrders isStudentView={false} />;
      case 'inventory': return <AdminInventory />;
      // ... other cases
      default:          return <AdminDashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-white m-4 rounded-[3.5rem] shadow-inner border border-gray-100">
       {renderContent()}
    </div>
  );
}