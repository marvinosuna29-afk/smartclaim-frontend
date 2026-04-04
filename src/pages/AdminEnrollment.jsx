import React, { useState } from 'react';
import { useApp } from '../context/AppContext'; // Ensure this path is correct
import { UserPlus, ShieldCheck, Mail, Hash, Loader2, AlertCircle } from 'lucide-react';

export default function AdminEnrollment() {
  // 1. CRITICAL: Make sure 'register' is pulled from the hook
  const { register } = useApp(); 
  
  const [formData, setFormData] = useState({ id: '', name: '', email: '' });
  const [status, setStatus] = useState(null); 
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (status === 'error') setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation to prevent sending empty strings to MySQL
    if (!formData.id.trim() || !formData.name.trim()) {
      setStatus('error');
      setErrorMessage("ID and Name are required.");
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    const studentId = formData.id.trim();
    
    // This object maps exactly to what AppContext.jsx:251 expects
    const studentData = {
      user_id: studentId,      
      full_name: formData.name.trim(),
      email: formData.email.trim() || `${studentId}@student.system`, 
      password: studentId, // Default password is their ID
    };

    try {
      // 2. Call the register function from AppContext
      const result = await register(studentData);
      
      if (result && result.success) {
        setStatus('success');
        setFormData({ id: '', name: '', email: '' });
        // Clear success message after 3 seconds
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus('error');
        setErrorMessage(result?.message || "Enrollment failed: ID likely already exists.");
      }
    } catch (err) {
      console.error("Submission Error:", err);
      setStatus('error');
      setErrorMessage("Network error. Is the backend running on Port 5000?");
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-left">
        <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">Enroll Student</h2>
        <p className="text-slate-500 font-medium text-sm">Provision a new node. System password defaults to the Student ID.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Student ID</label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
              <input 
                required
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                placeholder="2024-XXXX"
                value={formData.id}
                onChange={e => handleInputChange('id', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Full Name</label>
            <div className="relative">
              <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
              <input 
                required
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                placeholder="Ex: Juan Dela Cruz"
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex justify-between tracking-widest">
            Email Identity
            <span className="text-[9px] text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md uppercase">Defaulting Enabled</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
            <input 
              type="email"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
              placeholder="personal@email.com (optional)"
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
            />
          </div>
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 justify-center text-red-500 bg-red-50 py-3 rounded-xl border border-red-100 animate-in shake duration-300">
            <AlertCircle size={16} />
            <p className="text-[10px] font-black uppercase tracking-widest">{errorMessage}</p>
          </div>
        )}

        <button 
          type="submit"
          disabled={status === 'loading'}
          className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-white transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] ${
            status === 'success' ? 'bg-emerald-500 shadow-emerald-200' : 
            status === 'error' ? 'bg-red-500 shadow-red-200' :
            'bg-emerald-950 hover:bg-black shadow-emerald-900/20'
          }`}
        >
          {status === 'loading' ? (
            <><Loader2 className="animate-spin" /> Provisioning Node...</>
          ) : status === 'success' ? (
            <><ShieldCheck /> Node Authorized</>
          ) : (
            <><UserPlus /> Authorize System Access</>
          )}
        </button>
      </form>
    </div>
  );
}