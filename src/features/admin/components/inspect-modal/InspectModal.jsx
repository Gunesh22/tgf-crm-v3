import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { 
  Download, Search, X, Eye, Calendar, Clock, AlertTriangle, 
  CheckCircle2, ChevronRight, Phone, User, Tag 
} from "lucide-react";
import { 
  getContactName, 
  getContactPhone, 
  getContactCity,
  getCanonicalStage, 
  getCanonicalQueryStage, 
  getContactLeadOrigin, 
  getContactSource, 
  renderVal, 
  parseTimestamp, 
  getLocalDateStr 
} from "../../utils.jsx";

/**
 * Universal Inspect Modal for Admin Dashboard and Pipeline
 * Combines lead inspection, pipeline drilldowns, follow-up tracking,
 * multi-field search, status & date filtering, and Excel export into one unified component.
 */
export function InspectModal({ modal, onClose, onSelectLead }) {
  if (!modal) return null;

  const {
    title = "Inspected Contacts",
    subtitle = "",
    type = "contacts",
    items = [],
    category = "sales",
    defaultFilter = "all"
  } = modal;

  // Determine modal mode
  const isCallbackModal = Boolean(type?.startsWith("callback"));
  const isRegistrationModal = type === "registered_programs";
  const isInterestedModal = type === "interested_calls";
  const isPipelineModal = type === "people" || type === "pipeline" || Boolean(modal.category) || (!isCallbackModal && !isRegistrationModal && !isInterestedModal);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(defaultFilter || "all");
  const [dateFilter, setDateFilter] = useState("");

  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    return getLocalDateStr(tm);
  }, []);

  // Sync state when modal changes
  useEffect(() => {
    setStatusFilter(defaultFilter || "all");
    setDateFilter("");
    setSearch("");
  }, [modal, defaultFilter]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Pre-process and normalize items with follow-up metadata
  const normalizedItems = useMemo(() => {
    return items.map((rawItem, idx) => {
      const item = rawItem.contact || rawItem.row || rawItem;

      // Extract follow-up / callback date from root contact or attenderStates
      let cbDateRaw = item.callbackDate || item.callback_date;
      let matchedState = null;
      if (!cbDateRaw && item.attenderStates && typeof item.attenderStates === "object") {
        Object.values(item.attenderStates).forEach(st => {
          if (st?.callbackDate) {
            cbDateRaw = st.callbackDate;
            matchedState = st;
          }
        });
      }

      const cbStatus = String(matchedState?.callbackStatus || item.callbackStatus || item.callback_status || "").toLowerCase().trim();
      const isCompleted = cbStatus === "completed" || cbStatus === "done" || cbStatus === "called";

      const parsedCb = cbDateRaw ? parseTimestamp(cbDateRaw) : null;
      const cbDateStr = parsedCb && !isNaN(parsedCb.getTime()) 
        ? getLocalDateStr(parsedCb) 
        : (typeof cbDateRaw === "string" && cbDateRaw.length === 10 ? cbDateRaw : "");

      let followupStatus = "none";
      let followupStatusLabel = "No Follow-up";

      if (cbDateStr) {
        if (isCompleted) {
          followupStatus = "completed";
          followupStatusLabel = "Completed";
        } else if (cbDateStr < todayStr) {
          followupStatus = "overdue";
          followupStatusLabel = "Overdue";
        } else {
          followupStatus = "upcoming";
          followupStatusLabel = "Upcoming";
        }
      }

      const name = getContactName(item, rawItem) || item.name || (getContactPhone(item, rawItem) ? `Contact (${getContactPhone(item, rawItem)})` : `Lead #${(item.id || item._id || "").slice(-6) || idx + 1}`);
      const phone = getContactPhone(item, rawItem) || item.phone || "";
      const city = getContactCity(item) || item.city || "—";
      const khoji = item.khoji || item.isKhoji || "—";
      const calledFor = item.calledFor || item.programName || "—";
      const attender = item.attenderName || item.attender || item.assignedTo || "—";
      const origin = getContactLeadOrigin(item) || item.leadOrigin || "—";
      const source = getContactSource(item) || item.source || "—";
      const remark = item.remark || item.comment || "";
      const salesStage = getCanonicalStage(item) || "1. New Lead";
      const queryStage = getCanonicalQueryStage(item) || item.queryStatus || "Query Pending";
      const cType = String(item.callType || item.type || "").toLowerCase();
      const isInc = cType === "incoming" || cType === "in" || cType.includes("incoming");

      return {
        rawItem,
        item,
        name,
        phone,
        city,
        khoji,
        calledFor,
        attender,
        origin,
        source,
        remark,
        salesStage,
        queryStage,
        cType,
        isInc,
        dateTime: item.dateTime || cbDateStr,
        dateStr: item.dateStr || cbDateStr,
        cbDateStr,
        followupStatus,
        followupStatusLabel,
        // For dashboard callbacks compatibility:
        status: item.status || followupStatusLabel,
        category: item.category || followupStatus
      };
    });
  }, [items, todayStr]);

  // Compute status counts for filter buttons
  const filterCounts = useMemo(() => {
    const baseItems = dateFilter
      ? normalizedItems.filter(i => (isPipelineModal ? i.cbDateStr === dateFilter : i.dateStr === dateFilter))
      : normalizedItems;

    if (isPipelineModal) {
      return {
        all: baseItems.length,
        overdue: baseItems.filter(i => i.followupStatus === "overdue").length,
        upcoming: baseItems.filter(i => i.followupStatus === "upcoming").length,
        completed: baseItems.filter(i => i.followupStatus === "completed").length,
        none: baseItems.filter(i => i.followupStatus === "none").length,
      };
    }

    if (isCallbackModal) {
      return {
        all: baseItems.length,
        overdue: baseItems.filter(i => (i.category || i.status || "").toLowerCase() === "overdue").length,
        upcoming: baseItems.filter(i => (i.category || i.status || "").toLowerCase() === "upcoming").length,
        completed: baseItems.filter(i => (i.category || i.status || "").toLowerCase() === "completed").length,
      };
    }

    return { all: baseItems.length };
  }, [normalizedItems, isPipelineModal, isCallbackModal, dateFilter]);

  // Filter items based on status, date, and search
  const filteredItems = useMemo(() => {
    let result = normalizedItems.filter(record => {
      // 1. Status Filter
      if (statusFilter !== "all") {
        if (isPipelineModal) {
          if (record.followupStatus !== statusFilter) return false;
        } else if (isCallbackModal) {
          const cat = (record.category || record.status || "").toLowerCase();
          if (cat !== statusFilter) return false;
        }
      }

      // 2. Date Filter
      if (dateFilter) {
        const d = isPipelineModal ? record.cbDateStr : record.dateStr;
        if (d !== dateFilter) return false;
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          record.name.toLowerCase().includes(q) ||
          record.phone.toLowerCase().includes(q) ||
          record.calledFor.toLowerCase().includes(q) ||
          record.attender.toLowerCase().includes(q) ||
          record.city.toLowerCase().includes(q) ||
          record.remark.toLowerCase().includes(q) ||
          record.origin.toLowerCase().includes(q) ||
          record.source.toLowerCase().includes(q) ||
          record.salesStage.toLowerCase().includes(q) ||
          record.queryStage.toLowerCase().includes(q) ||
          record.followupStatusLabel.toLowerCase().includes(q) ||
          (record.cbDateStr && record.cbDateStr.includes(q)) ||
          (record.dateStr && record.dateStr.includes(q))
        );
      }

      return true;
    });

    // Sort upcoming earliest first
    if ((isPipelineModal || isCallbackModal) && statusFilter === "upcoming") {
      result = [...result].sort((a, b) => {
        const da = a.cbDateStr || a.dateStr || "";
        const db = b.cbDateStr || b.dateStr || "";
        return da.localeCompare(db);
      });
    }

    return result;
  }, [normalizedItems, isPipelineModal, isCallbackModal, statusFilter, dateFilter, search]);

  // Excel Export
  const handleExport = () => {
    let exportData = [];

    if (isPipelineModal) {
      exportData = filteredItems.map((rec, idx) => ({
        "#": idx + 1,
        "Name": rec.name,
        "Phone": rec.phone,
        "Attender": rec.attender,
        "Stage / Status": category === "query" ? rec.queryStage : rec.salesStage,
        "Program / Called For": rec.calledFor,
        "Follow-up Date": rec.cbDateStr || "—",
        "Follow-up Status": rec.followupStatusLabel,
        "Lead Origin": rec.origin,
        "Current Source": rec.source,
        "City": rec.city,
        "Remark": rec.remark
      }));
    } else {
      exportData = filteredItems.map((rec, idx) => ({
        "#": idx + 1,
        "Name": rec.name,
        "Phone": rec.phone,
        [isCallbackModal ? "Callback Date" : "Date & Time"]: rec.dateTime || rec.dateStr || "",
        "City": rec.city,
        "Khoji": rec.khoji,
        "Called For / Program": rec.calledFor,
        "Call Type": rec.isInc ? "Incoming (Inc)" : "Outgoing (Out)",
        "Attender": rec.attender,
        [isCallbackModal ? "Callback Status" : "Stage Status"]: rec.status,
        "Remark": rec.remark
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inspected Contacts");
    XLSX.writeFile(wb, `${type || "pipeline"}_inspect_${todayStr}.xlsx`);
    toast.success("Inspected list exported to Excel!");
  };

  const modalCategory = category || 
    (title.toLowerCase().includes("query") ? "query" : 
     title.toLowerCase().includes("reminder") ? "reminder" : "sales");

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Eye size={18} className="text-indigo-600" /> {title}
            </h3>
            {subtitle ? (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            ) : isPipelineModal ? (
              <p className="text-xs text-slate-500 mt-0.5">
                Click any row to view & edit lead details
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar (Follow-up Filters & Date Filters) */}
        {(isPipelineModal || isCallbackModal) && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                {isPipelineModal ? "Follow-up:" : "Status:"}
              </span>
              
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                All
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "all" ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {filterCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("overdue")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "overdue"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
                }`}
              >
                Overdue
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "overdue" ? "bg-rose-700 text-white" : "bg-rose-100 text-rose-800"
                }`}>
                  {filterCounts.overdue}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("upcoming")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "upcoming"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-white text-sky-700 hover:bg-sky-50 border border-sky-200"
                }`}
              >
                Upcoming
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "upcoming" ? "bg-sky-700 text-white" : "bg-sky-100 text-sky-800"
                }`}>
                  {filterCounts.upcoming}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "completed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                }`}
              >
                Completed
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  statusFilter === "completed" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {filterCounts.completed}
                </span>
              </button>

              {isPipelineModal && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("none")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === "none"
                      ? "bg-slate-600 text-white shadow-xs"
                      : "bg-white text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  No Follow-up
                  <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                    statusFilter === "none" ? "bg-slate-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {filterCounts.none}
                  </span>
                </button>
              )}
            </div>

            {/* Date Filters */}
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
              placeholder={
                isPipelineModal 
                  ? "Search by contact name, phone, program, attender, origin, status..."
                  : "Search by contact name, phone, program, attender, remark, date..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <p>No matching contacts found for this criteria.</p>
              {(statusFilter !== "all" || dateFilter || search) && (
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
                {isPipelineModal ? (
                  /* PIPELINE / STAGE INSPECTION HEADERS */
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 w-40">Name & Phone</th>
                    <th className="py-2.5 px-3 w-28">Attender</th>
                    <th className="py-2.5 px-3 w-32">Stage / Status</th>
                    <th className="py-2.5 px-3 w-32">Called For</th>
                    <th className="py-2.5 px-3 w-40">Follow-up Date & Status</th>
                    <th className="py-2.5 px-3 w-28">Lead Origin</th>
                    <th className="py-2.5 px-3 w-28">Current Source</th>
                  </tr>
                ) : (
                  /* DASHBOARD INSPECTION HEADERS */
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 w-36">Name & Phone</th>
                    {(isInterestedModal || isCallbackModal) && (
                      <th className="py-2.5 px-3 w-36">
                        {isCallbackModal ? "Callback Date" : "Date & Time"}
                      </th>
                    )}
                    <th className="py-2.5 px-3 w-24">City / Khoji</th>
                    <th className="py-2.5 px-3 w-28">Program / Called For</th>
                    {isRegistrationModal && <th className="py-2.5 px-3 w-24">Call Type</th>}
                    <th className="py-2.5 px-3 w-24">Attender</th>
                    <th className="py-2.5 px-3 w-28">{isCallbackModal ? "Callback Status" : "Stage Status"}</th>
                    {(isInterestedModal || isCallbackModal) && <th className="py-2.5 px-3">Remark</th>}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredItems.map((rec, idx) => {
                  const isClickable = Boolean(onSelectLead);

                  if (isPipelineModal) {
                    return (
                      <tr
                        key={idx}
                        onClick={() => onSelectLead?.(rec.item)}
                        className={`transition-colors ${
                          isClickable 
                            ? "hover:bg-indigo-50/70 cursor-pointer group" 
                            : "hover:bg-slate-50"
                        }`}
                        title={isClickable ? "Click to view & edit lead details" : ""}
                      >
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className={`font-bold text-slate-900 truncate ${isClickable ? "group-hover:text-indigo-600 transition-colors" : ""}`}>
                            {rec.name}
                          </p>
                          {rec.phone && (
                            <p className="text-[10px] text-indigo-600 font-mono truncate">{rec.phone}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 truncate text-slate-700">{renderVal(rec.attender)}</td>
                        <td className="py-2.5 px-3">
                          {modalCategory === "query" ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] inline-block truncate max-w-full">
                                {rec.queryStage}
                              </span>
                              {rec.salesStage && rec.salesStage !== "Query Desk" && rec.salesStage !== "Reminder Desk" && (
                                <p className="text-[9px] text-slate-500 font-medium truncate">Sales: {rec.salesStage}</p>
                              )}
                            </div>
                          ) : modalCategory === "reminder" ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px] inline-block truncate max-w-full">
                                {rec.item.status || "Reminder"}
                              </span>
                              {rec.salesStage && rec.salesStage !== "Query Desk" && rec.salesStage !== "Reminder Desk" && (
                                <p className="text-[9px] text-slate-500 font-medium truncate">Sales: {rec.salesStage}</p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] inline-block truncate max-w-full">
                              {rec.salesStage}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-indigo-700 font-semibold truncate" title={rec.calledFor}>
                          {rec.calledFor}
                        </td>
                        {/* FOLLOW-UP DATE & STATUS BADGE */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit border ${
                              rec.followupStatus === "completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : rec.followupStatus === "overdue"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : rec.followupStatus === "upcoming"
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                              {rec.followupStatus === "overdue" && <AlertTriangle size={10} />}
                              {rec.followupStatus === "upcoming" && <Clock size={10} />}
                              {rec.followupStatus === "completed" && <CheckCircle2 size={10} />}
                              {rec.followupStatusLabel}
                            </span>
                            {rec.cbDateStr ? (
                              <span className="text-[10px] text-slate-600 font-mono font-medium">
                                {rec.cbDateStr}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 italic">None set</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-100 inline-block truncate max-w-full">
                            {rec.origin}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-100 inline-block truncate max-w-full">
                            {rec.source}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // DASHBOARD ROW
                  return (
                    <tr 
                      key={idx} 
                      onClick={() => onSelectLead?.(rec.item)}
                      className={`transition-colors ${
                        isClickable ? "hover:bg-slate-50 cursor-pointer" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 truncate" title={`${rec.name} (${rec.phone})`}>
                        <div className="truncate">{rec.name}</div>
                        <div className="text-[11px] font-normal text-slate-500 font-mono truncate">{rec.phone}</div>
                      </td>
                      {(isInterestedModal || isCallbackModal) && (
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {rec.dateTime}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-slate-600 truncate">
                        <div className="truncate">{rec.city}</div>
                        {rec.khoji !== "—" && <span className="text-[10px] text-slate-400 block truncate">{rec.khoji}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-indigo-700 font-semibold truncate" title={rec.calledFor}>{rec.calledFor}</td>
                      {isRegistrationModal && (
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            rec.isInc ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}>
                            {rec.isInc ? "Incoming (Inc)" : "Outgoing (Out)"}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-slate-700 font-medium truncate" title={rec.attender}>{rec.attender}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : rec.status === "Overdue"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : rec.status === "Upcoming"
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : type === "stage6"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      {(isInterestedModal || isCallbackModal) && (
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-0" title={rec.remark}>
                          {rec.remark}
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
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> of {normalizedItems.length}{" "}
            {isPipelineModal
              ? `leads${statusFilter !== "all" ? ` • ${statusFilter}` : ""}${dateFilter ? ` • ${dateFilter}` : ""}`
              : isRegistrationModal
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
