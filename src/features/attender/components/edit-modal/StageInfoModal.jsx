import React from "react";
import { X, Shield, HelpCircle, AlertCircle, CheckCircle2, Clock, Award, XCircle, FileText, UserCheck } from "lucide-react";

export const PIPELINE_STAGE_INFO_LIST = [
  {
    stage: "1. New Lead",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
    icon: FileText,
    iconColor: "text-slate-600",
    desc: "Fresh lead newly created or imported into the system. No call attempts or attender interactions have been recorded yet."
  },
  {
    stage: "2. Attempting Contact",
    badge: "bg-amber-100 text-amber-900 border-amber-300",
    icon: Clock,
    iconColor: "text-amber-600",
    desc: "At least one call attempt has been made (e.g. Busy, Not Picked Up, No Network), but contact with the person has not been established yet."
  },
  {
    stage: "3. Information Given",
    badge: "bg-purple-100 text-purple-900 border-purple-300",
    icon: HelpCircle,
    iconColor: "text-purple-600",
    desc: "The call connected successfully and initial program/shivir details were communicated to the caller."
  },
  {
    stage: "Previous Program Pending",
    badge: "bg-purple-100 text-purple-900 border-purple-300",
    icon: Clock,
    iconColor: "text-purple-600",
    desc: "The person is currently being worked on for one program, but a previous program associated with the current source has not yet been attended/completed."
  },
  {
    stage: "4. Nurture / Interested",
    badge: "bg-indigo-100 text-indigo-900 border-indigo-300",
    icon: UserCheck,
    iconColor: "text-indigo-600",
    desc: "High-intent prospect who expressed clear interest in attending the program and is currently in active follow-up."
  },
  {
    stage: "5. Future Pool",
    badge: "bg-blue-100 text-blue-900 border-blue-300",
    icon: Clock,
    iconColor: "text-blue-600",
    desc: "The prospect requested a callback for a future batch, upcoming date, or later shivir event."
  },
  {
    stage: "6. Registered / Won",
    badge: "bg-emerald-100 text-emerald-900 border-emerald-300",
    icon: Award,
    iconColor: "text-emerald-600",
    desc: "Registration completed successfully! Payment or seat confirmation has been recorded for the selected program."
  },
  {
    stage: "Closed / Lost",
    badge: "bg-gray-200 text-gray-800 border-gray-400",
    icon: XCircle,
    iconColor: "text-gray-600",
    desc: "Lead explicitly expressed non-interest, refused to attend, or requested no further communication."
  },
  {
    stage: "Closed / Invalid",
    badge: "bg-rose-100 text-rose-900 border-rose-300",
    icon: AlertCircle,
    iconColor: "text-rose-600",
    desc: "Invalid/wrong number, or automatically closed after 5 consecutive unanswered call attempts."
  }
];

export const StageInfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden z-10 flex flex-col max-h-[85vh] border border-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-sm border border-indigo-400/30">
              i
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide uppercase">Pipeline Stages Guide</h3>
              <p className="text-[11px] text-slate-300 font-normal">Overview of all CRM contact progress stages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3 bg-slate-50/50">
          {PIPELINE_STAGE_INFO_LIST.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col gap-1.5 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className={`${item.iconColor} shrink-0`} />
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${item.badge}`}>
                    {item.stage}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium pl-6">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Shield size={12} className="text-indigo-600" />
            MongoDB Database Source of Truth
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition cursor-pointer shadow-sm"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageInfoModal;
