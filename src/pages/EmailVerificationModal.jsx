import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, ShieldCheck, RefreshCcw, X } from 'lucide-react';

export default function EmailVerificationModal({ isOpen, onClose }) {
  const { user, requestVerification, confirmOTP } = useApp();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Countdown for Resend Button
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleInput = (value, index) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    const code = otp.join('');
    const success = await confirmOTP(code);
    
    if (success) {
      onClose();
    } else {
      setError('Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setTimer(60);
    await requestVerification(user.email);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative animate-in zoom-in duration-300">
        <button onClick={onClose} className="absolute right-8 top-8 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>

        <div className="text-center space-y-4">
          <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="text-emerald-600" size={40} />
          </div>
          
          <h2 className="text-3xl font-black text-emerald-950">Verify Identity</h2>
          <p className="text-gray-500 font-medium">
            We sent a 6-digit code to <br />
            <span className="text-emerald-600 font-bold">{user.email}</span>
          </p>

          <div className="flex justify-between gap-2 py-8">
            {otp.map((data, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                maxLength="1"
                value={data}
                onChange={(e) => handleInput(e.target.value, i)}
                className="w-12 h-16 border-2 border-gray-100 rounded-2xl text-center text-2xl font-black text-emerald-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              />
            ))}
          </div>

          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

          <button
            onClick={handleVerify}
            disabled={loading || otp.includes('')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 transition-all active:scale-95"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <button
            onClick={handleResend}
            disabled={timer > 0}
            className="flex items-center justify-center gap-2 mx-auto text-sm font-bold text-emerald-600 disabled:text-gray-400 mt-4"
          >
            <RefreshCcw size={16} className={timer > 0 ? '' : 'animate-spin-slow'} />
            {timer > 0 ? `Resend code in ${timer}s` : 'Resend Code Now'}
          </button>
        </div>
      </div>
    </div>
  );
}