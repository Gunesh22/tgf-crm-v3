import React from 'react';
import { UserPlus, Shield, MoreVertical } from 'lucide-react';

export default function AttendersTab({ attenders = [], onReloadAttenders }) {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Team Management</h2>
          <p className="text-xs text-slate-500 font-medium">Manage all call center attender accounts & access</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs">Attender ID</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs">Attender Name</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs">Role</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attenders.length > 0 ? (
                attenders.map((a) => (
                  <tr key={a.id || a.name} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-500">
                      {a.id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {a.name}
                    </td>
                    <td className="py-3.5 px-4">
                      {a.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-200 shadow-xs">
                          <Shield size={12} strokeWidth={2.5} /> Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                          Attender (Agent)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                    No attenders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
