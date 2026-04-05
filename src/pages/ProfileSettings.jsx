import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
// Added MessageSquare for the Discord icon
import { User, Mail, ShieldCheck, Save, Loader2, CheckCircle, Lock, Key, X, Fingerprint, AlertTriangle, Send, MessageSquare, ExternalLink } from 'lucide-react';
import axios from 'axios'; // Ensure axios is imported for the custom routes

export default function ProfileSettings() {
  const { user, updateProfile, requestOTP, verifyOTP, refreshUser, unlinkDiscord } = useApp();

  // Profile State
  const [formData, setFormData] = useState({ full_name: '', email: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password State
  const [passwords, setPasswords] = useState({ next: '', confirm: '' });
  const [isChangingPass, setIsChangingPass] = useState(false);

  // --- NEW: Discord State ---
  const [discordId, setDiscordId] = useState('');
  const [isRequestingDiscord, setIsRequestingDiscord] = useState(false);

  // OTP Modal State
  // types: 'profile', 'password', 'email_verify', 'discord'
  const [otpModal, setOtpModal] = useState({ show: false, code: '', type: null });
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || user.name || '',
        email: user.email || '',
      });
      // Pre-fill discord ID if they have one saved but aren't verified
      if (user.discord_id) setDiscordId(user.discord_id);
    }
  }, [user]);

  const notify = (type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus({ type: '', msg: '' }), 4000);
  };

  // --- DISCORD LOGIC ---
  const handleDiscordRequest = async (e) => {
    e.preventDefault();
    if (!discordId) return notify('error', 'Please enter your Discord User ID.');

    setIsRequestingDiscord(true);
    try {
      // Calling your new backend route
      const res = await axios.post('https://smartclaim-backend.onrender.com/api/auth/discord/request-code', {
        userId: user.id,
        discordId: discordId
      });

      if (res.data.success) {
        setOtpModal({ show: true, code: '', type: 'discord' });
        notify('success', 'Check your Discord DMs!');
      }
    } catch (err) {
      notify('error', err.response?.data?.message || 'Failed to connect to Discord Bot.');
    } finally {
      setIsRequestingDiscord(false);
    }
  };

  // --- EXISTING FLOWS ---
  const handleVerifyEmailOnly = async () => {
    if (!user.email && !formData.email) return notify('error', 'Please enter an email address first.');
    setIsVerifying(true);
    const targetEmail = formData.email || user.email;
    const success = await requestOTP(targetEmail);
    setIsVerifying(false);
    if (success) setOtpModal({ show: true, code: '', type: 'email_verify' });
    else notify('error', 'Failed to send code.');
  };

  const handleProfileUpdateTrigger = async (e) => {
    e.preventDefault();
    if (formData.email !== user.email) {
      setIsSavingProfile(true);
      const success = await requestOTP(formData.email);
      setIsSavingProfile(false);
      if (success) setOtpModal({ show: true, code: '', type: 'profile' });
      else notify('error', 'Failed to send verification code.');
    } else {
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
    if (success) setOtpModal({ show: true, code: '', type: 'password' });
    else notify('error', 'Could not send OTP.');
  };

  // --- UPDATED CONFIRM OTP ---
  const confirmOTP = async () => {
    setIsVerifying(true);
    const cleanCode = otpModal.code.trim();

    // --- 🎮 CASE 1: DISCORD VERIFICATION ---
    if (otpModal.type === 'discord') {
      try {
        const res = await axios.post('https://smartclaim-backend.onrender.com/api/auth/discord/verify-code', {
          userId: user.id,
          code: cleanCode
        });

        if (res.data.success) {
          setOtpModal({ show: false, code: '', type: null });
          notify('success', 'Discord Verified Successfully!');

          // 🔥 CRITICAL: Update the global state so the UI badges flip to green
          if (typeof refreshUser === 'function') {
            await refreshUser();
          }
        }
      } catch (err) {
        setOtpModal(prev => ({ ...prev, code: '' })); // Clear the input on error
        notify('error', err.response?.data?.message || 'Invalid Discord code.');
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    // --- 📧 CASE 2: STANDARD EMAIL/PROFILE/PASSWORD ---
    const result = await verifyOTP(cleanCode, {
      newEmail: otpModal.type === 'profile' ? formData.email : null,
      newPassword: otpModal.type === 'password' ? passwords.next : null,
      full_name: formData.full_name
    });

    if (result.success) {
      setOtpModal({ show: false, code: '', type: null });
      setPasswords({ next: '', confirm: '' });
      notify('success', 'Action Verified & Updated!');

      // Backup refresh to ensure ProfileSettings reflects the name/email changes
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }
    } else {
      setOtpModal(prev => ({ ...prev, code: '' }));
      notify('error', result.message || 'Incorrect code.');
    }

    setIsVerifying(false);
  };

  const handleUnlinkDiscord = async () => {
    if (!window.confirm("Are you sure? Discord notifications will stop.")) return;


    // Use the 'unlinkDiscord' you already destuctured at the top of the file
    const result = await unlinkDiscord();

    if (result.success) {
      notify('success', 'Discord unlinked successfully.');
      // Recommended: Refresh the user state so the UI flips back to the "Link" form
      if (typeof refreshUser === 'function') await refreshUser();
    } else {
      notify('error', result.message || 'Failed to unlink.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 space-y-10 text-left animate-in fade-in slide-in-from-bottom-4 relative">

      {/* 📧 OTP MODAL OVERLAY */}
      {otpModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl border border-white/20 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${otpModal.type === 'discord' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
            <button onClick={() => setOtpModal({ ...otpModal, show: false })} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors">
              <X size={24} />
            </button>

            <div className="text-center space-y-6">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${otpModal.type === 'discord' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {otpModal.type === 'discord' ? <MessageSquare size={40} /> : <ShieldCheck size={40} />}
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                  {otpModal.type === 'discord' ? 'Discord Verify' : 'Verify Identity'}
                </h2>
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                  {otpModal.type === 'discord' ? 'Check your Discord Direct Messages' : `Code sent to ${otpModal.type === 'profile' ? formData.email : user.email}`}
                </p>
              </div>

              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otpModal.code}
                onChange={(e) => setOtpModal({ ...otpModal, code: e.target.value })}
                className="w-full text-center text-4xl font-black tracking-[1rem] py-6 bg-slate-50 rounded-3xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all placeholder:text-slate-200"
              />

              <button
                onClick={confirmOTP}
                disabled={isVerifying || otpModal.code.length < 6}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 disabled:opacity-50 transition-all"
              >
                {isVerifying ? <Loader2 className="animate-spin" size={18} /> : <Fingerprint size={18} />} Confirm & Verify
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

          {/* 🎮 DISCORD INTEGRATION SECTION */}
          <div className="relative z-10">
            <h3 className="text-sm font-black uppercase tracking-widest mb-8 text-slate-800 flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-500" /> Discord Integration
            </h3>

            {/* ⚡️ IMPROVED CHECK: Use both discord_id OR is_verified to prevent the UI from flickering back to the form */}
            {(user?.discord_id || user?.is_verified) ? (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-indigo-50 p-6 rounded-3xl border border-indigo-100 animate-in zoom-in-95">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Linked Account</p>
                    <p className="font-bold text-slate-700">
                      {/* Show the ID if we have it, otherwise show a generic verified message */}
                      {user?.discord_id ? (
                        <>Verified Discord ID: <span className="font-mono">{user.discord_id}</span></>
                      ) : (
                        "Discord Account Linked & Verified"
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleUnlinkDiscord}
                  className="w-full md:w-auto px-6 py-3 rounded-xl bg-white border border-red-100 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2"
                >
                  <X size={14} /> Unlink Discord
                </button>
              </div>
            ) : (
              <form onSubmit={handleDiscordRequest} className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-end px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Discord User ID</label>
                    <a
                      href="https://support.discord.com/hc/en-us/articles/206346498"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-tighter transition-colors"
                    >
                      How to find ID <ExternalLink size={10} />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 445058896701161483"
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value.replace(/\D/g, ''))} // Auto-strip non-numbers
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none font-bold placeholder:text-slate-300 transition-all"
                    />
                    <MessageSquare className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200" size={20} />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                  <button
                    type="submit"
                    disabled={isRequestingDiscord || !discordId}
                    className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-3 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-indigo-100"
                  >
                    {isRequestingDiscord ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    Send Verification Code
                  </button>

                  <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase italic max-w-xs text-center md:text-left">
                    * Ensure your DMs are open and you share a server with the bot.
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* 👤 SECTION 1: PERSONAL INFO */}
          <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            {/* ... Your Existing Personal Identity JSX ... */}
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
            {/* ... Your Existing Password JSX ... */}
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
                  ? "Your account is fully verified. You will receive automated claim receipts via email and Discord."
                  : "Verification required. Please verify your email or link your Discord to enable all security features."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}