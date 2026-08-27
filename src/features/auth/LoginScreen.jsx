import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Phone, Shield, Loader2 } from 'lucide-react';
import { fetchAPI } from '../../lib/db';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  
  const [error, setError] = useState('');
  const [attendersList, setAttendersList] = useState(FALLBACK_ATTENDERS);

  useEffect(() => {
    async function loadAttenders() {
      try {
        const res = await fetchAPI('/api/admin/attenders');
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setAttendersList(res.data);
        }
      } catch (e) {
        // Silently use fallback attenders list when offline or running on local dev server
      }
    }
    loadAttenders();
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
      // 1. Admin Authentication Check
      if (inputId.toLowerCase().includes('admin')) {
        if (['admin', 'tgfadmin', '123456', '629001', '198219'].includes(inputPass)) {
          login('admin_01', 'Super Admin', 'admin');
          return;
        } else {
          setError('Invalid Admin password');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Attender Credentials Match (by ID or Name)
      const inputLower = inputId.toLowerCase();
      let matched = attendersList.find(a => 
        String(a.id || '').toLowerCase() === inputLower ||
        String(a.name || '').toLowerCase() === inputLower ||
        String(a.name || '').toLowerCase().startsWith(inputLower) ||
        String(a.name || '').toLowerCase().includes(inputLower)
      );

      // Backup check in fallback list if dynamic list had missing entry
      if (!matched) {
        matched = FALLBACK_ATTENDERS.find(a => 
          String(a.id || '').toLowerCase() === inputLower ||
          String(a.name || '').toLowerCase() === inputLower ||
          String(a.name || '').toLowerCase().startsWith(inputLower) ||
          String(a.name || '').toLowerCase().includes(inputLower)
        );
      }

      if (!matched) {
        setError('Attender not found. Check your ID or Name.');
        setIsSubmitting(false);
        return;
      }

      // Verify Password (matches registered attender password, or emergency master pin 123456)
      if (matched.password && matched.password !== inputPass && inputPass !== '123456') {
        setError('Incorrect password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Login with actual Attender ID, true registered Name, and role
      login(matched.id, matched.name, 'attender');
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <Phone size={28} className="text-white" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-2xl font-bold tracking-tight text-white">
          TGF Call Center CRM
        </h2>
        <p className="mt-1.5 text-center text-sm text-slate-400 font-medium">
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
                id="attenderId"
                name="attenderId"
                type="text"
                required
                value={attenderId}
                onChange={(e) => setAttenderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-150"
                placeholder="e.g. Manisha, Sheetal, Priyanka, or admin"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-150"
                placeholder="••••••••"
              />
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
