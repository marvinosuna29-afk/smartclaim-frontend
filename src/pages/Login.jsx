import React, { useState, useEffect } from 'react';
// Check this line carefully:
import { useApp } from '../context/AppContext';
import { ShieldCheck, User, Lock, Eye, EyeOff, Loader2, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login, setupPassword, setUser } = useApp();
  const navigate = useNavigate();

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- States for First-Time Setup ---
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(false);

  useEffect(() => {
    // Real-time matching logic
    setPasswordsMatch(newPassword !== '' && newPassword === confirmPassword);
  }, [newPassword, confirmPassword]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!id || !password) return setErrorMessage("Please fill in all fields");

    setIsLoading(true);
    try {
      const result = await login(id, password);
      if (result.setupRequired) {
        setIsSetupRequired(true);
      } else if (result.success) {
        navigate('/dashboard');
      } else {
        setErrorMessage(result.message || "Invalid credentials");
      }
    } catch (err) {
      setErrorMessage("System error. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordCreation = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 6) return setErrorMessage("Password must be at least 6 characters.");
    if (!passwordsMatch) return setErrorMessage("Passwords do not match.");

    setIsLoading(true);
    try {
      // 1. Submit the new password to the backend
      const success = await setupPassword(id, newPassword);

      if (success) {
        const result = await login(id, newPassword);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setIsSetupRequired(false);
          // Add this to give feedback:
          setErrorMessage("Password secured! Please sign in with your new password.");
          setPassword(''); // Clear the old/default password from the field
        }
      }
    } catch (err) {
      setErrorMessage("Connection error during setup.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-10 border border-white/10 relative overflow-hidden transition-all duration-500">

        {/* --- Setup Overlay --- */}
        <div className={`absolute inset-0 bg-white z-20 p-10 flex flex-col justify-center transition-all duration-700 ease-in-out ${isSetupRequired ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <div className="text-center mb-8">
            <div className="bg-amber-50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-amber-500 shadow-inner">
              <KeyRound size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Set Password</h2>
            <p className="text-sm text-slate-400 font-bold mt-2 uppercase tracking-widest">Account: {id}</p>
          </div>

          <form onSubmit={handlePasswordCreation} className="space-y-4">
            <input
              type="password"
              placeholder="New Password"
              className="w-full p-5 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-amber-400 focus:bg-white outline-none font-bold transition-all shadow-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <div className="relative">
              <input
                type="password"
                placeholder="Confirm New Password"
                className={`w-full p-5 rounded-2xl bg-gray-50 border-2 outline-none font-bold transition-all shadow-sm ${confirmPassword ? (passwordsMatch ? 'border-emerald-500 focus:border-emerald-600' : 'border-red-400 focus:border-red-500') : 'border-transparent focus:border-amber-400'
                  }`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && (
                <div className="absolute right-4 top-5">
                  {passwordsMatch ? (
                    <CheckCircle2 className="text-emerald-500" size={24} />
                  ) : (
                    <AlertCircle className="text-red-400" size={24} />
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !passwordsMatch}
              className="w-full bg-amber-500 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Save & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setIsSetupRequired(false); setUser(null); }}
              className="w-full text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-slate-600 transition-colors py-4"
            >
              Cancel
            </button>
          </form>
        </div>

        {/* --- Standard Login Form --- */}
        <div className="text-center mb-10">
          <div className="bg-emerald-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
            <ShieldCheck size={56} />
          </div>
          <h1 className="text-4xl font-black text-emerald-950 tracking-tighter">Smart<span className="text-emerald-600 font-light">Claim</span></h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Inventory Management System</p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in zoom-in duration-300">
            <AlertCircle size={18} />
            <p className="text-xs font-black uppercase tracking-tight">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative group">
            <User className="absolute left-5 top-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={24} />
            <input
              type="text"
              placeholder="Student or Employee ID"
              className="w-full p-5 pl-14 rounded-[1.5rem] bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none transition-all font-bold text-emerald-950 placeholder:text-slate-300"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-5 top-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={24} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-5 pl-14 pr-14 rounded-[1.5rem] bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none transition-all font-bold text-emerald-950 placeholder:text-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-5 text-slate-300 hover:text-emerald-600 transition-colors"
            >
              {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-900 text-white font-black py-5 rounded-[1.5rem] transition-all shadow-2xl shadow-emerald-200 active:scale-[0.97] text-lg flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : 'Sign In'}
          </button>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">
              First login? <span className="text-emerald-600">ID is your default password.</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}