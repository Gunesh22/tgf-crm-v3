import React, { useState, useEffect } from "react";
import { Palette, Eye } from "lucide-react";
import { toast } from "react-hot-toast";

// Static sample data for the interactive live preview (defined outside component to avoid reallocations)
const SAMPLE_PREVIEW_ROWS = [
  {
    id: "preview_1",
    name: "Test Forward Alpha",
    phone: "9800000001",
    calledFor: "Off MA",
    status: "6. Registered / Won",
    statusBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    type: "Outgoing",
    remark: "Payment done, confirmed seat",
    callback: "—",
    colorType: "called",
    colorLabel: "Call Completed",
    borderColor: "border-l-4 border-l-emerald-500",
    tintBg: "bg-emerald-50/60 hover:bg-emerald-100/50"
  },
  {
    id: "preview_2",
    name: "Test Future Zeta",
    phone: "9800000006",
    calledFor: "Maha Shivir",
    status: "5. Future Pool",
    statusBadge: "bg-sky-50 text-sky-700 border-sky-200",
    type: "Outgoing",
    remark: "Interested in next month batch",
    callback: "16 Sep 2026",
    colorType: "followup",
    colorLabel: "Follow-up Scheduled",
    borderColor: "border-l-4 border-l-sky-500",
    tintBg: "bg-sky-50/60 hover:bg-sky-100/50"
  },
  {
    id: "preview_3",
    name: "Test Overdue Lead",
    phone: "9800000099",
    calledFor: "Happy Thoughts Intro",
    status: "4. Nurture / Interested",
    statusBadge: "bg-rose-50 text-rose-700 border-rose-200",
    type: "Outgoing",
    remark: "Asked to call at 10 AM",
    callback: "Yesterday (Overdue)",
    colorType: "due",
    colorLabel: "Overdue Callback",
    borderColor: "border-l-4 border-l-rose-500",
    tintBg: "bg-rose-50/60 hover:bg-rose-100/50"
  },
  {
    id: "preview_4",
    name: "Test Anti Demote Beta",
    phone: "9800000002",
    calledFor: "Maha Shivir",
    status: "Unanswered Callback",
    statusBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    type: "Incoming",
    remark: "Ringing no response",
    callback: "—",
    colorType: "unanswered",
    colorLabel: "Unanswered Call",
    borderColor: "border-l-4 border-l-indigo-400",
    tintBg: "bg-indigo-50/60 hover:bg-indigo-100/50"
  },
  {
    id: "preview_5",
    name: "Gunesh Sakhala",
    phone: "9800000004",
    calledFor: "Other",
    status: "1. New Lead",
    statusBadge: "bg-slate-100 text-slate-700 border-slate-200",
    type: "Incoming",
    remark: "—",
    callback: "—",
    colorType: "default",
    colorLabel: "Pending / New",
    borderColor: "border-l-2 border-l-transparent",
    tintBg: "bg-white hover:bg-slate-50"
  }
];

export default function AppearanceSettings({ attenderId, attenderName }) {
  const storageKey = `row_highlight_${attenderId || "default"}`;

  const [fullRowHighlight, setFullRowHighlight] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "full";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) === "full";
      setFullRowHighlight(saved);
    } catch {
      setFullRowHighlight(false);
    }
  }, [storageKey]);

  const handleToggle = (newVal) => {
    try {
      localStorage.setItem(storageKey, newVal ? "full" : "default");
      setFullRowHighlight(newVal);
      window.dispatchEvent(
        new CustomEvent("attender-appearance-updated", {
          detail: { attenderId, fullRowHighlight: newVal }
        })
      );
      toast.success(
        newVal
          ? "Full row status highlights enabled!"
          : "Default left-edge indicators restored!",
        { id: "appearance-toggle" }
      );
    } catch (err) {
      console.error("Failed to save appearance setting", err);
      toast.error("Failed to save preference");
    }
  };

  return (
    <div className="flex flex-col space-y-6 max-w-4xl">
      {/* Section Header */}
      <div className="pb-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Palette size={20} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Appearance & Display</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Customize how your Call Sheet table and row indicators are displayed
        </p>
      </div>

      {/* Main Setting Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="pr-4">
            <h3 className="text-sm font-bold text-slate-900">
              Full Row Status Highlight
            </h3>
          </div>

          {/* Toggle Switch */}
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">
              {fullRowHighlight ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={fullRowHighlight}
              onClick={() => handleToggle(!fullRowHighlight)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                fullRowHighlight ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  fullRowHighlight ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Color Legend Pills */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1">Status Colors:</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Called / Connected
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-500" /> Follow-up Scheduled
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Overdue Callback
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Hot Lead
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Unanswered Call
          </span>
        </div>
      </div>

      {/* Interactive Live Preview Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Live Call Sheet Preview</h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Current mode: <strong className="text-slate-700">{fullRowHighlight ? "Full Row Subtle Tint" : "Default Left Edge Line"}</strong>
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="table-auto w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-400 uppercase w-8 text-center">#</th>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Name</th>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Phone</th>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Program</th>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Status</th>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Remark</th>
                <th className="py-2 px-3 text-[10px] font-semibold text-slate-500 uppercase">Callback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SAMPLE_PREVIEW_ROWS.map((row, idx) => {
                const rowBgClass = fullRowHighlight
                  ? row.tintBg
                  : "bg-white hover:bg-slate-50";

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors border-b border-slate-100 ${row.borderColor} ${rowBgClass}`}
                  >
                    <td className="py-2.5 px-3 text-[11px] font-medium text-slate-400 text-center">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {row.phone}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {row.calledFor}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${row.statusBadge}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate text-[11px]">
                      {row.remark}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[11px] text-slate-600">
                      {row.callback}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
