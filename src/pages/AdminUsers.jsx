import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserPlus, ShieldCheck, Mail, Hash, Loader2,
  AlertCircle, Search, Users, Trash2, ShieldAlert,
  ArrowUpCircle, ArrowDownCircle, MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminUsers() {
  // Pull actions and data from AppContext
  const {
    register,
    users = [],
    deleteUser,
    promoteUser,
    user: currentUser,
    loading
  } = useApp();

  const navigate = useNavigate();

  const [formData, setFormData] = useState({ id: '', name: '', email: '' });
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- SECURITY GUARD ---
  useEffect(() => {
    if (!loading && currentUser?.role?.toLowerCase() !== 'admin') {
      console.error("Unauthorized access to Registry.");
      navigate('/dashboard');
    }
  }, [currentUser, loading, navigate]);

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (status === 'error') setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    const studentId = formData.id.trim();
    const studentData = {
      id: studentId,
      full_name: formData.name.trim(),
      email: formData.email.trim() || `${studentId}@student.system`,
      password: studentId, // Default password is their ID
      role: 'Student'
    };

    try {
      const result = await register(studentData);
      if (result.success) {
        setStatus('success');
        setFormData({ id: '', name: '', email: '' });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus('error');
        setErrorMessage(result.message || "Enrollment failed.");
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage("Network timeout.");
    }
  };

  const handleRoleToggle = async (targetUserId, currentRole) => {
    // 1. Calculate the role
    const nextRole = currentRole?.toLowerCase() === 'admin' ? 'Student' : 'Admin';
    const confirmMsg = `Promote/Demote user ${targetUserId} to ${nextRole}?`;

    if (window.confirm(confirmMsg)) {
      try {
        // 2. PASS THE nextRole ARGUMENT HERE!
        const result = await promoteUser(targetUserId, nextRole);

        if (!result.success) {
          alert(result.message || "Failed to update role.");
        }
      } catch (err) {
        console.error("Role update error:", err);
        alert("Network error updating role.");
      }
    }
  };

  // FIXED: Ensure we check full_name and user_id to match backend response
  const filteredUsers = (users || []).filter(u => {
    // Use the fields created by normalizeUser in AppContext
    const name = (u.name || "").toLowerCase();
    const id = (u.id || "").toString().toLowerCase();
    const query = searchQuery.toLowerCase();

    return name.includes(query) || id.includes(query);
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Identity <span className="text-emerald-500">Registry</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Management & Node Provisioning
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
          <Users className="text-emerald-500" size={20} />
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Total Nodes</p>
            <p className="text-lg font-black text-slate-900 leading-none mt-1">{users.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ENROLLMENT FORM */}
        <div className="lg:col-span-4">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-8">
            <div className="mb-8">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-4">
                <UserPlus size={24} />
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Enrollment</h2>
              {errorMessage && <p className="text-red-500 text-[10px] font-bold uppercase mt-2">{errorMessage}</p>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Node ID</label>
                <input
                  required
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm"
                  placeholder="Student ID Number"
                  value={formData.id}
                  onChange={e => handleInputChange('id', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Full Name</label>
                <input
                  required
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm"
                  placeholder="Enter Name"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className={`w-full py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] text-white transition-all shadow-lg active:scale-95 ${status === 'success' ? 'bg-emerald-500' : 'bg-slate-900 hover:bg-black'
                  }`}
              >
                {status === 'loading' ? 'Binding Node...' : 'Authorize Access'}
              </button>
            </form>
          </div>
        </div>

        {/* USER DIRECTORY */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Active Directory</h3>
              <div className="relative md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search Registry..."
                  className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs font-bold outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-slate-400 font-bold text-sm uppercase">No nodes found in registry</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id || u.user_id} className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[2rem] hover:border-emerald-200 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 ${u.role?.toLowerCase() === 'admin' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}>
                        {(u.full_name || u.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-800 tracking-tight">{u.full_name || u.name}</p>
                          {u.role?.toLowerCase() === 'admin' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                              <ShieldAlert size={8} /> Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">ID: {u.user_id || u.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Prevent admin from deleting themselves */}
                      {(currentUser?.id !== u.id && currentUser?.user_id !== u.user_id) && (
                        <>
                          <button
                            title="Toggle Admin Rights"
                            onClick={() => handleRoleToggle(u.user_id || u.id, u.role)}
                            className="p-3 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                          >
                            {u.role?.toLowerCase() === 'admin' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                          </button>
                          <button
                            title="Delete User"
                            onClick={() => {
                              if (window.confirm(`Terminate access for ${u.full_name || u.name}?`)) {
                                deleteUser(u.user_id || u.id);
                              }
                            }}
                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}