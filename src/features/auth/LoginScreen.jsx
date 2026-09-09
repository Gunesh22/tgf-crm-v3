import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { fetchAPI } from '../../lib/db';
import LottieAnimation from '../../components/ui/LottieAnimation';
import customerServiceAnimation from '../../assets/customer_service.json';

function CustomerServiceLogo() {
  return (
    <LottieAnimation
      animationData={customerServiceAnimation}
      className="w-56 h-56 sm:w-64 sm:h-64 mx-auto flex items-center justify-center relative z-50 pointer-events-none filter drop-shadow-lg"
    />
  );
}

const FALLBACK_ATTENDERS = [
  { id: "9VZZnV00X63PzUSaGTgq", name: "Manisha", role: "attender", password: "629001" },
  { id: "E5Vy71mpJ7cQIw3acQgEm", name: "Sheetal Marne", role: "attender", password: "121313" },
  { id: "VN6h9vevwXpXU0UXm5IQ", name: "Aparna Mule", role: "attender", password: "121312" },
  { id: "WbND9Oa4yPUuWXVyibb3", name: "Geeta", role: "attender", password: "198291" },
  { id: "ZJQsev2aLqi2Ispr3j74", name: "Priyanka", role: "attender", password: "706321" },
  { id: "a82GcDWY69r6k936b4GC", name: "Vaishali Golande", role: "attender", password: "121314" },
  { id: "IrAgizMZzxqzUbJjHIBI", name: "Rakhi", role: "attender", password: "697984" },
  { id: "o1FPWNvI7HO4O2ylSuZm", name: "Sreeja", role: "attender", password: "646080" },
  { id: "pKfAHuc7UODJ8aOB1luFY", name: "Dipika", role: "attender", password: "121311" }
];

export default function LoginScreen() {
  const [attenderId, setAttenderId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  
  const [error, setError] = useState('');
  const attenderInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    // Auto-focus Attender ID field on page load
    attenderInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault?.();
    
    const inputId = attenderId.trim();
    const inputPass = password.trim();
    
    if (!inputId || !inputPass) {
      setError('Please enter both ID/Name and Password');
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    try {
      // Authenticate via server authentication endpoint
      const authRes = await fetchAPI('/api/auth/login', 'POST', {
        attenderId: inputId,
        password: inputPass
      });

      if (authRes && authRes.success && authRes.user) {
        login(authRes.user.id, authRes.user.name, authRes.user.role);
        return;
      } else {
        setError(authRes?.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-6 sm:px-6 lg:px-8 font-sans relative z-0">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-50">
        <div className="flex justify-center -mb-4 relative z-50 overflow-visible">
          <CustomerServiceLogo />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white relative z-50">
          TGF Call Center CRM
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400 font-medium relative z-50">
          Sign in to access your assigned workspace
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-950/80 backdrop-blur-sm py-8 px-6 shadow-2xl rounded-xl sm:px-8 border border-slate-800/80">
          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {error && (
              <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Shield size={15} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="attenderId" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Attender ID or Name
              </label>
              <input
                ref={attenderInputRef}
                id="attenderId"
                name="attenderId"
                type="text"
                required
                value={attenderId}
                onChange={(e) => setAttenderId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && attenderId.trim()) {
                    e.preventDefault();
                    passwordInputRef.current?.focus();
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-150"
                placeholder="e.g. Manisha, Sheetal, Priyanka, or admin"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-150"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded focus:outline-none transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 flex items-center justify-center px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <>
                    <LogIn size={16} className="mr-2" />
                    Sign in to Workspace
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
