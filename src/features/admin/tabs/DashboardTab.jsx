import React from 'react';
import { Users, PhoneCall, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';

export default function DashboardTab() {
  const metrics = [
    { title: 'Total Active Leads', value: '4,521', icon: Users, color: 'bg-blue-100 text-blue-600' },
    { title: 'Calls Today', value: '342', icon: PhoneCall, color: 'bg-emerald-100 text-emerald-600' },
    { title: 'Conversion Rate', value: '12.4%', icon: TrendingUp, color: 'bg-indigo-100 text-indigo-600' },
    { title: 'Pending Callbacks', value: '89', icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">System Overview</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
            <div className={`p-3 rounded-xl ${metric.color}`}>
              <metric.icon size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{metric.title}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-extrabold text-slate-800">Recent Activity Stream</h3>
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
            View All <ArrowRight size={12} strokeWidth={3} />
          </button>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-50/20">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shadow-inner">
            <PhoneCall size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold">Real-time activity logs will stream here...</p>
        </div>
      </div>
    </div>
  );
}
