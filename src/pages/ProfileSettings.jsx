import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, Mail, ShieldCheck, Save, Loader2, CheckCircle, Lock, Key, X, Fingerprint, AlertTriangle, Send } from 'lucide-react';

export default function ProfileSettings() {
  const { user, updateProfile, requestOTP, verifyOTP } = useApp();

  // Profile State
  const [formData, setFormData] = useState({ full_name: '', email: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password State
  const [passwords, setPasswords] = useState({ next: '', confirm: '' });
  const [isChangingPass, setIsChangingPass] = useState(false);

  // OTP Modal State
  const [otpModal, setOtpModal] = useState({ show: false, code: '', type: null }); // type: 'profile', 'password', or 'email_verify'
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const notify = (type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus({ type: '', msg: '' }), 4000);
  };

  // --- TRIGGER OTP FLOWS ---

  // New: Simple verification trigger for unverified accounts
  const handleVerifyEmailOnly = async () => {
    // If the user's email is currently NULL/Empty in the DB
    if (!user.email && !formData.email) {
      return notify('error', 'Please enter an email address first.');
    }

    setIsVerifying(true);
    // Prioritize the email in the input box if available
    const targetEmail = formData.email || user.email;
    const success = await requestOTP(targetEmail);
    setIsVerifying(false);

    if (success) {
      setOtpModal({ show: true, code: '', type: 'email_verify' });
    } else {
      notify('error', 'Failed to send code.');
    }
  };

  const handleProfileUpdateTrigger = async (e) => {
    e.preventDefault();
    // If the email in the input box is different from the current user email
    if (formData.email !== user.email) {
      setIsSavingProfile(true);

      // CRITICAL: Send the email from the form, not the user object!
      const success = await requestOTP(formData.email);

      setIsSavingProfile(false);
      if (success) {
        setOtpModal({ show: true, code: '', type: 'profile' });
      } else {
        notify('error', 'Failed to send verification code to ' + formData.email);
      }
    } else {
      // Standard profile update (name change only)
      setIsSavingProfile(true);
      const result = await updateProfile(formData);
      setIsSavingProfile(false);
      if (result.success) notify('success', 'Profile updated!');
    }
  };

  const handlePasswordUpdateTrigger = async (e) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) return notify('error', 'New passwords do not match.');
    if (passwords.next.length < 6) return notify('error', 'Password too short.');

    setIsChangingPass(true);
    const success = await requestOTP(user.email);
    setIsChangingPass(false);

    if (success) {
      setOtpModal({ show: true, code: '', type: 'password' });
    } else {
      notify('error', 'Could not send OTP to your email.');
    }
  };

  const confirmOTP = async () => {
    setIsVerifying(true);
    const cleanCode = otpModal.code.trim();

    const result = await verifyOTP(cleanCode, {
      newEmail: otpModal.type === 'profile' ? formData.email : null,
      newPassword: otpModal.type === 'password' ? passwords.next : null,
      full_name: formData.full_name
    });

    setIsVerifying(false);

    if (result.success) {
      setOtpModal({ show: false, code: '', type: null });
      setPasswords({ next: '', confirm: '' });
      // Use a nice "Success" state
      notify('success', 'Profile Verified & Updated!');
    } else {
      // 🎨 UX UPGRADE: Shake the input or highlight red instead of just an alert
      setOtpModal(prev => ({ ...prev, code: '' })); // Clear the wrong code
      notify('error', result.message || 'Incorrect code. Please try again.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-10 text-left animate-in fade-in slide-in-from-bottom-4 relative">

      {/* 📧 OTP MODAL OVERLAY */}
      {otpModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
            <button onClick={() => setOtpModal({ ...otpModal, show: false })} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors">
              <X size={24} />
            </button>

            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                <ShieldCheck size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Verify Identity</h2>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                  Code sent to {otpModal.type === 'profile' ? formData.email : user.email}
                </p>
              </div>

              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otpModal.code}
                onChange={(e) => setOtpModal({ ...otpModal, code: e.target.value })}
                className="w-full text-center text-4xl font-black tracking-[1rem] py-6 bg-slate-50 rounded-3xl border-2 border-transparent focus:border-emerald-500 outline-none transition-all placeholder:text-slate-200"
              />

              <button
                onClick={confirmOTP}
                disabled={isVerifying || otpModal.code.length < 6}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-slate-900 transition-all"
              >
                {isVerifying ? <Loader2 className="animate-spin" size={18} /> : <Fingerprint size={18} />} Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="space-y-2">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
          Account <span className="text-emerald-600">Settings</span>
        </h1>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Manage your identity and security access</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">

          {/* 🚨 NEW: EMAIL VERIFICATION ALERT (Only shows if not verified) */}
          {!user?.is_verified && (
            <div className="bg-amber-50 p-8 rounded-[3rem] border-2 border-dashed border-amber-200 flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle size={32} />
              </div>
              <div className="flex-1 text-center md:text-left space-y-1">
                <h4 className="text-lg font-black text-amber-900 uppercase tracking-tight">Email not verified</h4>
                <p className="text-amber-700/70 text-[11px] font-bold uppercase leading-relaxed">
                  Verify your email to receive claim receipts and security notifications directly to your inbox.
                </p>
              </div>
              <button
                onClick={handleVerifyEmailOnly}
                className="bg-amber-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-amber-700 transition-all shadow-lg shadow-amber-200"
              >
                <Send size={14} /> Verify Now
              </button>
            </div>
          )}

          {/* 👤 SECTION 1: PERSONAL INFO */}
          <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <h3 className="text-sm font-black uppercase tracking-widest mb-8 text-slate-800 flex items-center gap-2">
              <User size={18} className="text-emerald-500" /> Personal Identity
            </h3>
            <form onSubmit={handleProfileUpdateTrigger} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold"
                  />
                </div>
              </div>
              <button disabled={isSavingProfile} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-3 hover:bg-emerald-600 transition-all">
                {isSavingProfile ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save Changes
              </button>
            </form>
          </div>

          {/* 🔐 SECTION 2: SECURITY & PASSWORD */}
          <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <h3 className="text-sm font-black uppercase tracking-widest mb-8 text-slate-800 flex items-center gap-2">
              <Key size={18} className="text-emerald-500" /> Secure Password Change
            </h3>
            <form onSubmit={handlePasswordUpdateTrigger} className="space-y-6">
              <div className="space-y-4">
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-tight italic">Changing password requires email verification.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="password"
                    placeholder="New Password"
                    value={passwords.next}
                    onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-emerald-500 outline-none font-bold"
                  />
                </div>
              </div>
              <button disabled={isChangingPass} className="bg-emerald-950 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-3 hover:bg-black transition-all">
                {isChangingPass ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Request Verification
              </button>
            </form>
          </div>

          {status.msg && (
            <div className={`p-4 rounded-2xl font-black text-[10px] uppercase text-center animate-bounce ${status.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {status.msg}
            </div>
          )}
        </div>

        {/* SIDEBAR CARD */}
        <div className="lg:col-span-4">
          <div className="bg-emerald-950 p-8 rounded-[3rem] text-white sticky top-10">
            {user?.is_verified ? (
              <CheckCircle className="text-emerald-400 mb-6" size={40} />
            ) : (
              <AlertTriangle className="text-amber-400 mb-6" size={40} />
            )}
            <h4 className="text-xl font-black uppercase tracking-tighter mb-2">Security Status</h4>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-6 ${user?.is_verified ? 'text-emerald-400/60' : 'text-amber-400/60'}`}>
              Verification: {user?.is_verified ? 'VERIFIED' : 'PENDING'}
            </p>
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-white/40 uppercase">Account ID</span>
                <span className="text-[10px] font-bold">#{user?.id}</span>
              </div>
              <p className="text-[10px] font-bold text-white/30 leading-relaxed italic">
                {user?.is_verified
                  ? "Your account is fully verified. You will receive automated claim receipts via email."
                  : "Verification required. Please verify your email to enable all security and notification features."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}