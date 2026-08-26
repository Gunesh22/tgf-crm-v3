import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Phone, Shield } from 'lucide-react';

export default function LoginScreen() {
  const [attenderId, setAttenderId] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.form?.preventDefault?.();
    e.preventDefault?.();
    
    if (!attenderId.trim() || !password.trim()) {
      setError('Please enter both ID and Password');
      return;
    }
    
    setError('');
    
    // Simple mock logic: if ID contains "admin", log in as Admin, else Attender
    const isAd = attenderId.toLowerCase().includes('admin');
    const role = isAd ? 'admin' : 'attender';
    const name = isAd ? 'Super Admin' : 'Agent';
    
    login(attenderId.trim(), name, role);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
             <Phone size={32} className="text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Call Center CRM
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Sign in to access your workspace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                <Shield size={16} className="text-rose-500" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="attenderId" className="block text-sm font-bold text-slate-700">
                Attender ID
              </label>
              <div className="mt-1">
                <input
                  id="attenderId"
                  name="attenderId"
                  type="text"
                  required
                  value={attenderId}
                  onChange={(e) => setAttenderId(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-all"
                  placeholder="e.g. attender_01 or admin_01"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700 font-medium">
                  Remember me
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98]"
              >
                <LogIn size={18} className="mr-2" />
                Sign in to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
