import React from "react";
import { Sliders, ShieldCheck, PhoneCall, PhoneOff, CheckCircle2, Archive } from "lucide-react";

export function AddStatusCategorizationModal({ addStatusModal, confirmAddStatus }) {
  if (!addStatusModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <Sliders size={22} />
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-lg">Categorize New Status</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Select how this status should be classified in analytics.</p>
          </div>
        </div>

        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
          <ShieldCheck size={20} className="text-indigo-600 shrink-0" />
          <div>
            <span className="text-xs text-indigo-700 font-semibold block">New Status Name:</span>
            <span className="text-sm font-black text-indigo-950">{addStatusModal}</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => confirmAddStatus("connected")}
            className="w-full p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/80 text-left transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <PhoneCall size={18} />
              </div>
              <div>
                <h4 className="font-bold text-emerald-950 text-sm group-hover:text-emerald-900">Connected Calls</h4>
                <p className="text-xs text-emerald-700 font-medium">Classify as answered / successful contact</p>
              </div>
            </div>
            <CheckCircle2 size={18} className="text-emerald-600 opacity-0 group-hover:opacity-100 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => confirmAddStatus("notConnected")}
            className="w-full p-4 rounded-2xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/80 text-left transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
                <PhoneOff size={18} />
              </div>
              <div>
                <h4 className="font-bold text-rose-950 text-sm group-hover:text-rose-900">Not Connected Calls</h4>
                <p className="text-xs text-rose-700 font-medium">Classify as unanswered / failed attempt</p>
              </div>
            </div>
            <CheckCircle2 size={18} className="text-rose-600 opacity-0 group-hover:opacity-100 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => confirmAddStatus("skip")}
            className="w-full p-3.5 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-left transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center">
                <Archive size={16} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs">Skip (Not Assigned)</h4>
                <p className="text-[11px] text-gray-500 font-medium">Leave unassigned for now (can drag & drop later)</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
