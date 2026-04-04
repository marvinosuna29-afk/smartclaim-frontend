import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext'; // Go up one level to src, then into context
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';   // Same folder
import StudentPortal from './StudentPortal';     // Same folder
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {user.role === 'admin' ? (
        <AdminDashboard />
      ) : (
        <StudentPortal needsVerification={!user.isVerified} />
      )}
    </>
  );
}