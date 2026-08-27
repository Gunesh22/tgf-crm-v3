import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  PhoneOff,
  Layers
} from "lucide-react";
import toast from "react-hot-toast";
import { updateCallCenterOptions, DEFAULT_NOT_CONNECTED_STATUSES } from "../../../lib/db";
import { updateDynamicOptions } from "../../attender/utils";

export default function CompulsoryFieldBypassCard({ options, setOptions }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [togglingStatus, setTogglingStatus] = useState(null);

  const statusOptions = options?.statusOptions || [];
  const connectedStatuses = options?.connectedStatuses || [];
  const notConnectedStatuses = options?.notConnectedStatuses || DEFAULT_NOT_CONNECTED_STATUSES;
  const optionalCompulsoryStatuses = options?.optionalCompulsoryStatuses || notConnectedStatuses;

  const filteredStatuses = useMemo(() => {
    if (!searchTerm.trim()) return statusOptions;
    return statusOptions.filter(s =>
      s.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [statusOptions, searchTerm]);

  const handleToggle = async (status) => {
    setTogglingStatus(status);
    const exists = optionalCompulsoryStatuses.some(
      s => s.toLowerCase() === status.toLowerCase()
    );
    const nextBypass = exists
      ? optionalCompulsoryStatuses.filter(s => s.toLowerCase() !== status.toLowerCase())
      : [...optionalCompulsoryStatuses, status];

    try {
      const updatePayload = {
        optionalCompulsoryStatuses: nextBypass
      };
      await updateCallCenterOptions(updatePayload);
      setOptions(prev => ({
        ...prev,
        ...updatePayload
      }));
      updateDynamicOptions(updatePayload);
      toast.success(
        exists
          ? `Compulsory fields are now REQUIRED for "${status}"`
          : `Compulsory fields are now OPTIONAL for "${status}"`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update setting: " + err.message);
    } finally {
      setTogglingStatus(null);
    }
  };

  const totalOptional = optionalCompulsoryStatuses.length;
  const totalRequired = statusOptions.length - totalOptional;

  return (
    <div className="space-y-4">
      {/* Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#172033] tracking-tight">
              Status Rules & Compulsory Fields
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Configure which fields are required when an attender logs a specific call status.
            </p>
          </div>
        </div>

        {/* Semantic Stat Badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md font-semibold text-[11px]">
            <PhoneCall size={11} /> Connected ({connectedStatuses.length})
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-md font-semibold text-[11px]">
            <PhoneOff size={11} /> Not Connected ({notConnectedStatuses.length})
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md font-semibold text-[11px]">
            {totalRequired} Required
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-md font-semibold text-[11px]">
            {totalOptional} Optional
          </span>
        </div>
      </div>

      {/* Toolbar: Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search status rules..."
            className="w-full h-9 pl-9 pr-8 bg-white border border-[#DDE2EA] rounded-[7px] text-xs font-medium text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-150 shadow-[0_1px_2px_rgba(16,24,40,0.02)]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#172033] p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {searchTerm && (
          <span className="text-xs text-[#667085] font-medium">
            Showing {filteredStatuses.length} of {statusOptions.length} statuses
          </span>
        )}
      </div>

      {/* Compact Elevated Status Rules Table Container */}
      <div className="bg-white border border-[#E4E7EC] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)]">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E4E7EC] text-[11px] font-semibold text-[#667085] uppercase tracking-wider sticky top-0 z-10 shadow-2xs">
                <th className="py-2.5 px-4">Status Name</th>
                <th className="py-2.5 px-4">Call Type</th>
                <th className="py-2.5 px-4">Fields Rule</th>
                <th className="py-2.5 px-4">Category Output</th>
                <th className="py-2.5 px-4 text-right">Optional Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]/60">
              {filteredStatuses.map(status => {
                const isNotConn = notConnectedStatuses.some(
                  s => s.toLowerCase() === status.toLowerCase()
                );
                const isConn = connectedStatuses.some(
                  s => s.toLowerCase() === status.toLowerCase()
                );
                const isBypassed = optionalCompulsoryStatuses.some(
                  s => s.toLowerCase() === status.toLowerCase()
                );
                const isToggling = togglingStatus === status;

                return (
                  <tr
                    key={status}
                    className={`transition-colors duration-150 min-h-[38px] ${
                      isBypassed ? "hover:bg-amber-50/30" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {/* Status Name */}
                    <td className="py-2.5 px-4 font-semibold text-[#172033] text-[13px]">
                      {status}
                    </td>

                    {/* Call Classification Badge */}
                    <td className="py-2.5 px-4">
                      {isConn ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <PhoneCall size={10} /> Connected
                        </span>
                      ) : isNotConn ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                          <PhoneOff size={10} /> Not Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-[#667085] border border-slate-200">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Compulsory Fields Rule */}
                    <td className="py-2.5 px-4">
                      {isBypassed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                          <CheckCircle2 size={10} className="text-amber-600" /> Optional
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                          Required
                        </span>
                      )}
                    </td>

                    {/* Category Output */}
                    <td className="py-2.5 px-4 text-[#667085] font-medium text-[11px]">
                      {isBypassed ? "Unanswered Callback" : "Normal Call Entry"}
                    </td>

                    {/* Toggle Switch */}
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleToggle(status)}
                        disabled={isToggling}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isBypassed ? "bg-amber-500" : "bg-slate-200"
                        } ${isToggling ? "opacity-50 cursor-wait" : ""}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs transition duration-200 ease-in-out ${
                            isBypassed ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredStatuses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[#98A2B3] mb-2">
                        <Layers size={16} />
                      </div>
                      <p className="text-xs font-semibold text-[#172033]">No matching status rules</p>
                      <p className="text-[11px] text-[#667085] mt-0.5">Try searching another status keyword</p>
                    </div>
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
