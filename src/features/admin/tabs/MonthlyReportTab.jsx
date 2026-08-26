import React from 'react';
import { Calendar, Download } from 'lucide-react';

export default function MonthlyReportTab() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Monthly Performance</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
            <Calendar size={16} /> Select Month
          </button>
          <button className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
            <Download size={16} /> Export
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs">Attender</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs text-center">Total Calls</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs text-center">Connected</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs text-center">Registrations</th>
                <th className="py-3 px-4 font-extrabold text-slate-500 uppercase tracking-wider text-xs text-center">Avg Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors cursor-default">
                <td className="py-4 px-4">
                  <div className="font-bold text-slate-900">Priyanka</div>
                  <div className="text-xs font-semibold text-slate-400">attender_01</div>
                </td>
                <td className="py-4 px-4 text-center font-bold text-slate-700">1,245</td>
                <td className="py-4 px-4 text-center">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold text-xs">840</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-bold text-xs border border-emerald-100 shadow-sm">45</span>
                </td>
                <td className="py-4 px-4 text-center font-semibold text-slate-500">4m 12s</td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors cursor-default">
                <td className="py-4 px-4">
                  <div className="font-bold text-slate-900">Rahul</div>
                  <div className="text-xs font-semibold text-slate-400">attender_02</div>
                </td>
                <td className="py-4 px-4 text-center font-bold text-slate-700">980</td>
                <td className="py-4 px-4 text-center">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-bold text-xs">610</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-bold text-xs border border-emerald-100 shadow-sm">32</span>
                </td>
                <td className="py-4 px-4 text-center font-semibold text-slate-500">3m 45s</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
