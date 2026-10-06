import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { Download, Search, X, Eye, Calendar } from "lucide-react";
import { getLocalDateStr } from "../../utils.jsx";

/**
 * Universal Inspect Modal for Admin Dashboard
 * Handles inspection, multi-field search, status filtering, date filtering, and Excel export
 * for registrations, interested calls, callbacks, and generic contact lists.
 */
export function InspectModal({ modal, onClose }) {
  if (!modal) return null;

  const {
    title = "Inspected Contacts",
    subtitle = "Viewing lead details",
    type = "contacts",
    items = [],
    defaultFilter = "all"
  } = modal;

  const isCallbackModal = Boolean(type?.startsWith("callback"));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(defaultFilter || "all");
  const [dateFilter, setDateFilter] = useState("");

  // Sync default filter if modal changes
  useEffect(() => {
    setStatusFilter(defaultFilter || "all");
    setDateFilter("");
    setSearch("");
  }, [modal]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Compute status counts for callback filter buttons
  const callbackFilterCounts = useMemo(() => {
    if (!isCallbackModal) return { all: 0, overdue: 0, upcoming: 0, completed: 0 };

    const baseItems = dateFilter
      ? items.filter(i => i.dateStr === dateFilter)
      : items;

    return {
      all: baseItems.length,
      overdue: baseItems.filter(i => (i.category || i.status || "").toLowerCase() === "overdue").length,
      upcoming: baseItems.filter(i => (i.category || i.status || "").toLowerCase() === "upcoming").length,
      completed: baseItems.filter(i => (i.category || i.status || "").toLowerCase() === "completed").length,
    };
  }, [isCallbackModal, items, dateFilter]);

  // Filter items based on status, date, and search
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      // 1. Status Filter (for callbacks)
      if (isCallbackModal && statusFilter !== "all") {
        const cat = (item.category || item.status || "").toLowerCase();
        if (cat !== statusFilter) return false;
      }

      // 2. Date Filter (for callbacks)
      if (isCallbackModal && dateFilter) {
        if (item.dateStr !== dateFilter) return false;
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (item.name || "").toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.calledFor || "").toLowerCase().includes(q) ||
          (item.attender || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q) ||
          (item.remark || "").toLowerCase().includes(q) ||
          (item.callType || "").toLowerCase().includes(q) ||
          (item.dateStr || "").includes(q) ||
          (item.dateTime || "").toLowerCase().includes(q)
        );
      }

      return true;
    });

    // When viewing upcoming, sort earliest upcoming first
    if (isCallbackModal && statusFilter === "upcoming") {
      result = [...result].sort((a, b) => {
        const ta = a.timestamp ? (a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()) : 0;
        const tb = b.timestamp ? (b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()) : 0;
        return ta - tb;
      });
    }

    return result;
  }, [items, isCallbackModal, statusFilter, dateFilter, search]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredItems.map((item, idx) => {
      const cType = String(item.callType || item.type || "").toLowerCase();
      const isInc = cType === "incoming" || cType === "in" || cType.includes("incoming");
      return {
        "#": idx + 1,
        "Name": item.name,
        "Phone": item.phone,
        [isCallbackModal ? "Callback Date" : "Date & Time"]: item.dateTime || "",
        "City": item.city,
        "Khoji": item.khoji,
        "Called For / Program": item.calledFor,
        "Call Type": isInc ? "Incoming (Inc)" : "Outgoing (Out)",
        "Attender": item.attender,
        [isCallbackModal ? "Callback Status" : "Stage Status"]: item.status,
        "Remark": item.remark || ""
      };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inspected List");
    XLSX.writeFile(wb, `${type}_contacts_export.xlsx`);
    toast.success("Inspected list exported to Excel!");
  };

  const todayStr = getLocalDateStr(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = getLocalDateStr(tomorrowDate);

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Eye size={18} className="text-emerald-600" /> {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Simple Callback Filter Buttons: Overdue, Upcoming, Completed, and Date */}
        {isCallbackModal && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Status Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                All
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "all" ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {callbackFilterCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("overdue")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "overdue"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
                }`}
              >
                Overdue
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "overdue" ? "bg-rose-700 text-white" : "bg-rose-100 text-rose-800"
                }`}>
                  {callbackFilterCounts.overdue}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("upcoming")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "upcoming"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-white text-sky-700 hover:bg-sky-50 border border-sky-200"
                }`}
              >
                Upcoming
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "upcoming" ? "bg-sky-700 text-white" : "bg-sky-100 text-sky-800"
                }`}>
                  {callbackFilterCounts.upcoming}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "completed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                }`}
              >
                Completed
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "completed" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {callbackFilterCounts.completed}
                </span>
              </button>
            </div>

            {/* Callback Date Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Date:</span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 h-8">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    className="text-[10px] text-slate-400 hover:text-slate-700 font-bold ml-1 px-1 rounded hover:bg-slate-100 cursor-pointer"
                    title="Clear date filter"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDateFilter(todayStr)}
                className={`h-8 px-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dateFilter === todayStr
                    ? "bg-indigo-600 text-white"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setDateFilter(tomorrowStr)}
                className={`h-8 px-2.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  dateFilter === tomorrowStr
                    ? "bg-indigo-600 text-white"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                Tomorrow
              </button>

              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter("")}
                  className="h-8 px-2 rounded-md text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors cursor-pointer"
                >
                  All Dates
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search and Action Bar */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by contact name, phone, program, attender, remark, date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <Download size={14} /> Export List
          </button>
        </div>

        {/* Table View */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 text-xs">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p>No matching records found.</p>
              {isCallbackModal && (statusFilter !== "all" || dateFilter || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setDateFilter("");
                    setSearch("");
                  }}
                  className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Clear filters & show all
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 w-8">#</th>
                  <th className="py-2.5 px-3 w-36">Name & Phone</th>
                  {(type === "interested_calls" || isCallbackModal) && (
                    <th className="py-2.5 px-3 w-36">
                      {isCallbackModal ? "Callback Date" : "Date & Time"}
                    </th>
                  )}
                  <th className="py-2.5 px-3 w-24">City / Khoji</th>
                  <th className="py-2.5 px-3 w-28">Program / Called For</th>
                  {type === "registered_programs" && <th className="py-2.5 px-3 w-24">Call Type</th>}
                  <th className="py-2.5 px-3 w-24">Attender</th>
                  <th className="py-2.5 px-3 w-28">{isCallbackModal ? "Callback Status" : "Stage Status"}</th>
                  {(type === "interested_calls" || isCallbackModal) && <th className="py-2.5 px-3">Remark</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredItems.map((item, idx) => {
                  const cType = String(item.callType || item.type || "").toLowerCase();
                  const isInc = cType === "incoming" || cType === "in" || cType.includes("incoming");
                  return (
                    <tr key={item.id + "_" + idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 truncate" title={`${item.name} (${item.phone})`}>
                        <div className="truncate">{item.name}</div>
                        <div className="text-[11px] font-normal text-slate-500 font-mono truncate">{item.phone}</div>
                      </td>
                      {(type === "interested_calls" || isCallbackModal) && (
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {item.dateTime}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-slate-600 truncate">
                        <div className="truncate">{item.city}</div>
                        {item.khoji !== "—" && <span className="text-[10px] text-slate-400 block truncate">{item.khoji}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-indigo-700 font-semibold truncate" title={item.calledFor}>{item.calledFor}</td>
                      {type === "registered_programs" && (
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            isInc ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}>
                            {isInc ? "Incoming (Inc)" : "Outgoing (Out)"}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-slate-700 font-medium truncate" title={item.attender}>{item.attender}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : item.status === "Overdue"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : item.status === "Upcoming"
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : type === "stage6"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      {(type === "interested_calls" || isCallbackModal) && (
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-0" title={item.remark}>
                          {item.remark}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Showing {filteredItems.length} of {items.length}{" "}
            {type === "registered_programs"
              ? "registration records"
              : isCallbackModal
              ? `callback leads${statusFilter !== "all" ? ` • ${statusFilter}` : ""}${dateFilter ? ` • ${dateFilter}` : ""}`
              : "unique contacts"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
