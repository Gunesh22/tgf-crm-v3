import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Download, ChevronRight, ChevronDown, Calendar, TrendingUp, UserCheck, Smile, Info, Search, X, Check, Eye, Table as TableIcon, PieChart as PieChartIcon, BarChart3, Layers, Target, PhoneCall
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { subscribeToAllCallLogs } from "../../../lib/db";
import { CONNECTED_STATUSES, NOT_CONNECTED_STATUSES, parseTimestamp, getCanonicalStatus, getContactPhone, getContactName, getContactCity, getContactKhoji, renderVal, classifyCallStatus, getCanonicalPhysicalCalls, getLocalDateStr, getCanonicalRegistrations, getContactLeadOrigin, getContactSource, isCallTypeOrInvalidProgram, sanitizeCalledFor, isCallTypeOrInvalidSource, sanitizeSource, getCanonicalStage } from "../utils.jsx";
import { isKhojiAffirmative, isKhojiNegative, resolveLeadOriginOptions, resolveCurrentSourceOptions } from "../../attender/utils.js";
import { getAllPresets } from "../../../utils/presetEngine.js";
import { determineCallType } from "../../../utils/registrationEngine.js";
import { EditModal } from "../../attender/components/EditModal";
import { PresetBarWidget } from "./PresetBarWidget.jsx";
import { PresetSummaryCards } from "./PresetSummaryCards.jsx";
import { PresetBuilderModal } from "./PresetBuilderModal.jsx";

function MonthlySection({ title, subtitle, action, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/70 transition-colors cursor-pointer select-none border-b border-slate-200/80"
      >
        <div className="flex-1">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">{title}</h3>
          {subtitle && (typeof subtitle === "string" ? <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p> : subtitle)}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      {isOpen && <div className="p-5 bg-white">{children}</div>}
    </div>
  );
}

// ── Formula Info Popover Component ───────────────────────────────────────────
const HEADER_FORMULAS = {
  "Percentage (%)": {
    title: "Percentage Formula",
    formulas: [
      { label: "Percentage (%)", formula: "(Category Count ÷ Total Section Calls) × 100" }
    ]
  },
  "Conversion Rate (%)": {
    title: "Conversion Rate Formula",
    formulas: [
      {
        label: "Conversion Rate (%)",
        formula: "(Reg.Done Conversions ÷ Valid Responded Attempts*) × 100",
        note: "*Valid Responded Attempts = Reg.Done + Info Given + Interested + Next Time + Not Interested"
      }
    ]
  },
  "Incoming Conversion Rate (%)": {
    title: "Incoming Conversion Rate Formula",
    formulas: [
      {
        label: "Incoming Conversion Rate (%)",
        formula: "(Incoming Conversions ÷ Incoming Valid Responded Attempts*) × 100",
        note: "*Valid Responded Attempts = Reg.Done + Info Given + Interested + Next Time + Not Interested"
      }
    ]
  },
  "Outgoing Conversion Rate (%)": {
    title: "Outgoing Conversion Rate Formula",
    formulas: [
      {
        label: "Outgoing Conversion Rate (%)",
        formula: "(Outgoing Conversions ÷ Outgoing Valid Responded Attempts*) × 100",
        note: "*Valid Responded Attempts = Reg.Done + Info Given + Interested + Next Time + Not Interested"
      }
    ]
  }
};

function FormulaInfoPopover({ title = "Formula Info", formulas = [], iconOnly = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left font-normal normal-case" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={
          iconOnly
            ? "p-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs"
            : "px-2.5 py-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full transition-all inline-flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
        }
        title={iconOnly ? `View ${title}` : "View Formula Information"}
      >
        <Info size={iconOnly ? 13 : 14} className="text-indigo-600" />
        {!iconOnly && <span>Formula Info</span>}
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-2 w-80 p-4 bg-slate-900 text-white rounded-2xl shadow-xl z-50 border border-slate-700 text-xs normal-case font-normal"
        >
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <span className="font-extrabold text-indigo-300 text-sm flex items-center gap-1.5">
              <Info size={16} className="text-indigo-400" /> {title}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {formulas.map((item, idx) => (
              <div key={idx}>
                {item.label && <div className="text-indigo-300 font-bold mb-1">{item.label}</div>}
                <div className="bg-slate-800/90 p-2 rounded-xl text-slate-200 font-mono text-[11px] border border-slate-700/60 leading-relaxed">
                  {item.formula}
                </div>
                {item.note && <div className="text-[10px] text-slate-400 mt-1 italic">{item.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyTable({ headers, rows, totals, formatValue, noScroll = false, onRowClick }) {
  return (
    <div className={`overflow-x-auto ${noScroll ? "" : "overflow-y-auto max-h-[550px]"} rounded-xl border border-slate-200 shadow-2xs bg-white`}>
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
          <tr>
            {headers.map((h, index) => {
              const formulaInfo = HEADER_FORMULAS[h];
              let firstLine = h;
              let secondLine = "";
              if (h.startsWith("Incoming ")) {
                firstLine = "Incoming";
                secondLine = h.replace("Incoming ", "");
              } else if (h.startsWith("Outgoing ")) {
                firstLine = "Outgoing";
                secondLine = h.replace("Outgoing ", "");
              } else if (h.startsWith("Total ") && h !== "Total Calls") {
                firstLine = "Total";
                secondLine = h.replace("Total ", "");
              } else if (h.startsWith("Overall ")) {
                firstLine = "Overall";
                secondLine = h.replace("Overall ", "");
              }

              const isFirstCol = index === 0;

              return (
                <th
                  key={h}
                  className={`px-4 py-3 whitespace-nowrap bg-slate-50 ${
                    isFirstCol ? "sticky left-0 z-30 border-r border-slate-200" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>
                      {firstLine}
                      {secondLine && <><br />{secondLine}</>}
                    </span>
                    {formulaInfo && (
                      <FormulaInfoPopover
                        title={formulaInfo.title}
                        formulas={formulaInfo.formulas}
                        iconOnly={true}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, idx) => (
            <tr 
              key={idx} 
              onClick={() => onRowClick && onRowClick(row, false)}
              className={`transition-colors group ${
                onRowClick 
                  ? "hover:bg-indigo-50/70 cursor-pointer" 
                  : "hover:bg-slate-50/80"
              }`}
              title={onRowClick ? "Click row to inspect leads" : undefined}
            >
              {headers.map((h, i) => {
                const rawVal = row[h];
                const displayVal = formatValue ? formatValue(rawVal, h) : rawVal;
                const isFirstCol = i === 0;
                const isZero = displayVal === 0 || displayVal === "0" || displayVal === "0.0%" || displayVal === "0%";
                const isRate = h.includes("Rate (%)");

                return (
                  <td
                    key={i}
                    className={`px-4 py-2.5 whitespace-nowrap ${
                      isFirstCol
                        ? `sticky left-0 bg-white font-semibold text-slate-800 z-10 border-r border-slate-100 shadow-r transition-colors ${
                            onRowClick ? "group-hover:bg-indigo-50/70" : ""
                          }`
                        : isRate
                        ? isZero
                          ? "text-slate-300 font-mono text-xs"
                          : "font-semibold text-emerald-700 font-mono text-xs"
                        : isZero
                        ? "text-slate-300 font-mono text-xs"
                        : "text-slate-700 font-mono text-xs"
                    }`}
                  >
                    {displayVal}
                  </td>
                );
              })}
            </tr>
          ))}
          {totals && (
            <tr 
              onClick={() => onRowClick && onRowClick(totals, true)}
              className={`bg-slate-100/90 border-t-2 border-slate-200 font-bold text-slate-900 sticky bottom-0 z-20 group ${
                onRowClick ? "hover:bg-indigo-100/80 cursor-pointer" : ""
              }`}
              title={onRowClick ? "Click total row to inspect all leads" : undefined}
            >
              {headers.map((h, i) => {
                const rawVal = totals[h];
                const displayVal = formatValue ? formatValue(rawVal, h) : rawVal;
                const isFirstCol = i === 0;
                const isRate = h.includes("Rate (%)");

                return (
                  <td
                    key={i}
                    className={`px-4 py-3 whitespace-nowrap ${
                      isFirstCol
                        ? `sticky left-0 bg-slate-100 font-bold text-slate-900 z-30 border-r border-slate-200 transition-colors ${
                            onRowClick ? "group-hover:bg-indigo-100/80" : ""
                          }`
                        : isRate
                        ? "font-bold text-emerald-800 font-mono text-xs"
                        : "font-bold text-slate-900 font-mono text-xs"
                    }`}
                  >
                    {displayVal}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MultiSelect({ options, selected, onChange, placeholder, allLabel = "All" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = React.useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => String(o.label || "").toLowerCase().includes(search.toLowerCase()));
  const allSelected = selected.length === 0 || selected.length === options.length;

  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(options.map(o => o.value));
  };

  const label = allSelected
    ? allLabel
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label || "1 selected")
      : `${selected.length} selected`;

  const hasFilterApplied = selected.length > 0 && selected.length < options.length;

  return (
    <div className="relative flex-1 min-w-[140px] sm:min-w-[155px] max-w-[220px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`flex items-center justify-between gap-2 h-9 px-3 border rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full whitespace-nowrap overflow-hidden transition-colors cursor-pointer ${
          hasFilterApplied
            ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
        }`}
      >
        <span className="truncate flex-1 text-left">{label}</span>
        {hasFilterApplied && (
          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""} ${hasFilterApplied ? "text-indigo-600" : "text-slate-400"}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-md shadow-lg w-full min-w-[210px] overflow-hidden right-0">
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-xs focus:outline-none bg-transparent"
            />
            {search && <button onClick={() => setSearch("")}><X size={12} className="text-slate-400" /></button>}
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              onClick={toggleAll}
              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${allSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                {allSelected && <Check size={9} className="text-white stroke-[3]" />}
              </span>
              {allLabel}
            </button>
            {filtered.map(o => {
              const active = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                    {active && <Check size={9} className="text-white stroke-[3]" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const getConversionDenominator = (status) => {
  if (!status) return 0;
  const s = status.toLowerCase().trim();
  if (
    status === "Reg.Done" ||
    s === "info given" ||
    s === "interested" ||
    s === "intersted" ||
    s === "next time" ||
    s === "not interested" ||
    s === "not intrested"
  ) {
    return 1;
  }
  return 0;
};

const shouldGoToEnd = (sourceName) => {
  const src = String(sourceName || "").toLowerCase().trim();
  return (
    src === "khoji" ||
    src === "book" ||
    src === "books" ||
    src === "spritual healing" ||
    src === "spiritual healing" ||
    src === "unspecified"
  );
};

const SOURCE_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", 
  "#06b6d4", "#f97316", "#14b8a6", "#6366f1", "#84cc16", 
  "#a855f7", "#ef4444", "#64748b", "#0284c7", "#e11d48",
  "#d97706", "#059669", "#7c3aed", "#db2777", "#2563eb"
];

export default function MonthlyReportTab({
  callLogs = [],
  registrations = [],
  programs = [],
  attenders = [],
  settingsOptions = {},
  selectedMonth,
  setSelectedMonth
}) {
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
  const currentMonthFirstDay = `${todayStr.slice(0, 7)}-01`;
  const currentMonthLastDay = (() => {
    const lastDay = new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0).getDate();
    return `${todayStr.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  })();

  const getMonthBounds = (mKey) => {
    if (!mKey || mKey === 'ALL') return null;
    const [yrStr, mnStr] = mKey.split('-');
    const yr = parseInt(yrStr, 10);
    const mn = parseInt(mnStr, 10);
    if (isNaN(yr) || isNaN(mn)) return null;
    const start = `${yr}-${String(mn).padStart(2, '0')}-01`;
    const lastDay = new Date(yr, mn, 0).getDate();
    const end = `${yr}-${String(mn).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  };

  const initialBounds = (selectedMonth && selectedMonth !== 'ALL' && getMonthBounds(selectedMonth)) || { start: currentMonthFirstDay, end: currentMonthLastDay };

  const [selectedProgramIds, setSelectedProgramIds] = useState([]); // empty = ALL
  const [selectedAttenderIds, setSelectedAttenderIds] = useState([]); // empty = ALL
  const [startDate, setStartDate] = useState(initialBounds.start);
  const [endDate, setEndDate] = useState(initialBounds.end);

  // Sync startDate and endDate when parent selectedMonth changes
  useEffect(() => {
    if (!selectedMonth || selectedMonth === 'ALL') return;
    const bounds = getMonthBounds(selectedMonth);
    if (bounds && (startDate.slice(0, 7) !== selectedMonth || endDate.slice(0, 7) !== selectedMonth)) {
      setStartDate(bounds.start);
      setEndDate(bounds.end);
    }
  }, [selectedMonth]);

  // Sync parent selectedMonth when user changes startDate or endDate
  useEffect(() => {
    if (!setSelectedMonth || !startDate || !endDate) return;
    const sM = startDate.slice(0, 7);
    const eM = endDate.slice(0, 7);
    const target = sM === eM ? sM : 'ALL';
    if (selectedMonth !== target) {
      setSelectedMonth(target);
    }
  }, [startDate, endDate, selectedMonth, setSelectedMonth]);
  const [selectedLeadOrigins, setSelectedLeadOrigins] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedCalledFors, setSelectedCalledFors] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCallTypes, setSelectedCallTypes] = useState([]);
  const [selectedKhojiStatuses, setSelectedKhojiStatuses] = useState([]);
  const [sourceDimension, setSourceDimension] = useState("currentSource"); // "currentSource" | "leadOrigin"
  const [conversionSearch, setConversionSearch] = useState("");
  const [convPage, setConvPage] = useState(1);
  const [calledForVsSourceView, setCalledForVsSourceView] = useState("table"); // "table" | "graph"
  const [graphMetric, setGraphMetric] = useState("calls"); // "calls" | "registrations"
  const [sourceWiseView, setSourceWiseView] = useState("table"); // "table" | "graph"
  const [inspectModalData, setInspectModalData] = useState(null);
  const [inspectSearch, setInspectSearch] = useState("");
  const [inspectStageFilter, setInspectStageFilter] = useState("ALL");
  const [inspectCallTypeFilter, setInspectCallTypeFilter] = useState("ALL");
  const [inspectAttenderFilter, setInspectAttenderFilter] = useState("ALL");
  const [inspectProgramFilter, setInspectProgramFilter] = useState("ALL");

  const contactMap = React.useMemo(() => {
    const map = new Map();
    (callLogs || []).forEach(c => {
      if (c._id) map.set(String(c._id), c);
      if (c.id) map.set(String(c.id), c);
    });
    return map;
  }, [callLogs]);

  const getItemStage = React.useCallback((item) => {
    if (!item) return "New Lead";
    const cId = String(item.contactId || item._id || item.id || "");
    const contact = (cId && contactMap.get(cId)) ? contactMap.get(cId) : item;
    return getCanonicalStage(contact);
  }, [contactMap]);

  const handleCloseInspectModal = React.useCallback(() => {
    setInspectModalData(null);
    setInspectSearch("");
    setInspectStageFilter("ALL");
    setInspectCallTypeFilter("ALL");
    setInspectAttenderFilter("ALL");
    setInspectProgramFilter("ALL");
  }, []);

  const getStageBadgeClass = (stage) => {
    const s = String(stage || "").toLowerCase();
    if (s.includes("registered") || s.includes("won") || s.includes("reg.done")) {
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
    if (s.includes("interested") || s.includes("nurture")) {
      return "bg-purple-100 text-purple-800 border-purple-300";
    }
    if (s.includes("info given") || s.includes("information given")) {
      return "bg-blue-100 text-blue-800 border-blue-300";
    }
    if (s.includes("attempting")) {
      return "bg-amber-100 text-amber-800 border-amber-300";
    }
    if (s.includes("future pool") || s.includes("next time")) {
      return "bg-teal-100 text-teal-800 border-teal-300";
    }
    if (s.includes("alumni")) {
      return "bg-indigo-100 text-indigo-800 border-indigo-300";
    }
    if (s.includes("query")) {
      return "bg-orange-100 text-orange-800 border-orange-300";
    }
    if (s.includes("reminder")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
    if (s.includes("closed") || s.includes("lost") || s.includes("invalid") || s.includes("not interested")) {
      return "bg-rose-100 text-rose-800 border-rose-300";
    }
    return "bg-slate-100 text-slate-700 border-slate-300";
  };

  const inspectOptions = React.useMemo(() => {
    if (!inspectModalData?.items) return { stages: [], callTypes: [], attenders: [], programs: [] };
    const stages = new Set();
    const callTypes = new Set();
    const attendersSet = new Set();
    const programsSet = new Set();

    inspectModalData.items.forEach(item => {
      const stage = getItemStage(item);
      if (stage) stages.add(stage);

      const cType = String(item.callType || item.type || "").toLowerCase();
      const isInc = cType === "incoming" || cType === "in" || cType.includes("incoming");
      callTypes.add(isInc ? "incoming" : "outgoing");

      const att = item.attenderName || "Unassigned";
      if (att) attendersSet.add(att);

      const prog = sanitizeCalledFor(item.calledFor || item.programName, "Unspecified");
      if (prog && prog !== "Unspecified") programsSet.add(prog);
    });

    return {
      stages: Array.from(stages).sort(),
      callTypes: Array.from(callTypes).sort(),
      attenders: Array.from(attendersSet).sort(),
      programs: Array.from(programsSet).sort()
    };
  }, [inspectModalData, getItemStage]);

  const filteredInspectItems = React.useMemo(() => {
    if (!inspectModalData?.items) return [];
    return inspectModalData.items.filter(item => {
      const stage = getItemStage(item);

      // Search Query
      if (inspectSearch.trim()) {
        const q = inspectSearch.toLowerCase();
        const matches = (
          String(item.contactName || "").toLowerCase().includes(q) ||
          String(item.contactPhone || "").toLowerCase().includes(q) ||
          String(item.calledFor || item.programName || "").toLowerCase().includes(q) ||
          String(item.source || "").toLowerCase().includes(q) ||
          String(item.callType || item.type || "").toLowerCase().includes(q) ||
          String(item.attenderName || "").toLowerCase().includes(q) ||
          stage.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }

      // Stage Filter
      if (inspectStageFilter !== "ALL" && stage !== inspectStageFilter) {
        return false;
      }

      // Call Type Filter
      if (inspectCallTypeFilter !== "ALL") {
        const cType = String(item.callType || item.type || "").toLowerCase();
        const isInc = cType === "incoming" || cType === "in" || cType.includes("incoming");
        if (inspectCallTypeFilter === "incoming" && !isInc) return false;
        if (inspectCallTypeFilter === "outgoing" && isInc) return false;
      }

      // Attender Filter
      if (inspectAttenderFilter !== "ALL") {
        if ((item.attenderName || "Unassigned") !== inspectAttenderFilter) return false;
      }

      // Program Filter
      if (inspectProgramFilter !== "ALL") {
        const prog = sanitizeCalledFor(item.calledFor || item.programName, "Unspecified");
        if (prog !== inspectProgramFilter) return false;
      }

      return true;
    });
  }, [inspectModalData, inspectSearch, inspectStageFilter, inspectCallTypeFilter, inspectAttenderFilter, inspectProgramFilter, getItemStage]);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState(null);
  const loading = false;

  const handleOpenLeadEdit = (item) => {
    if (!item) return;

    // 1. Match by id / _id / contactId
    const targetId = item.id || item._id || item.contactId;
    if (targetId) {
      const found = callLogs.find(l => String(l._id || l.id) === String(targetId));
      if (found) {
        setSelectedLeadForEdit(found);
        return;
      }
    }

    // 2. Match by normalized phone
    const rawPhone = item.contactPhone || item.phone || item.Phone || item.Mobile || item.mobile;
    if (rawPhone) {
      const cleanDigits = String(rawPhone).replace(/\D/g, "");
      if (cleanDigits.length >= 7) {
        const found = callLogs.find(l => {
          const lPhone = String(l.Phone || l.phone || l.Mobile || l.mobile || "").replace(/\D/g, "");
          return lPhone && (lPhone.endsWith(cleanDigits) || cleanDigits.endsWith(lPhone));
        });
        if (found) {
          setSelectedLeadForEdit(found);
          return;
        }
      }
    }

    // 3. Match by name
    const rawName = (item.contactName || item.name || item.Name || "").trim().toLowerCase();
    if (rawName && rawName !== "unnamed" && rawName !== "unknown") {
      const found = callLogs.find(l => {
        const lName = String(l.Name || l.name || "").trim().toLowerCase();
        return lName && lName === rawName;
      });
      if (found) {
        setSelectedLeadForEdit(found);
        return;
      }
    }

    // 4. Fallback: construct standard lead row
    setSelectedLeadForEdit({
      _id: targetId || `lead_${Date.now()}`,
      id: targetId || `lead_${Date.now()}`,
      Name: item.contactName || item.name || "Unknown Lead",
      Phone: rawPhone || "",
      calledFor: item.calledFor || item.programName || "",
      source: item.source || "",
      attenderName: item.attenderName || "Admin",
      status: item.status || "Pending",
      history: item.history || []
    });
  };

  // Dynamic Preset Engine State
  const [presets, setPresets] = useState(() => getAllPresets());
  const [activePresetId, setActivePresetId] = useState(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [presetToEdit, setPresetToEdit] = useState(null);

  const activePreset = React.useMemo(() => {
    return presets.find(p => p.id === activePresetId) || null;
  }, [presets, activePresetId]);

  const callTypeOptions = React.useMemo(() => [
    { value: "incoming", label: "Incoming" },
    { value: "outgoing", label: "Outgoing" }
  ], []);

  const khojiStatusOptions = React.useMemo(() => [
    { value: "Yes", label: "Yes (Khoji)" },
    { value: "No", label: "No (New)" },
    { value: "Dew drop khoji", label: "Dew drop khoji" }
  ], []);

  const programOptions = React.useMemo(() => {
    const map = new Map();

    (programs || []).forEach(p => {
      const val = String(p.id || p._id || p.key || p.name || "").trim();
      const label = String(p.name || val).trim();
      if (val) map.set(val, { value: val, label });
    });

    (callLogs || []).forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach(t => {
          const tagStr = String(t || "").trim();
          if (tagStr && !map.has(tagStr)) {
            map.set(tagStr, { value: tagStr, label: tagStr });
          }
        });
      }
      if (c.Tags) {
        String(c.Tags).split(",").forEach(t => {
          const tagStr = t.trim();
          if (tagStr && !map.has(tagStr)) {
            map.set(tagStr, { value: tagStr, label: tagStr });
          }
        });
      }
      if (c.programName) {
        const pn = String(c.programName).trim();
        if (pn && !map.has(pn)) map.set(pn, { value: pn, label: pn });
      }
      if (c.programId) {
        const pid = String(c.programId).trim();
        if (pid && !map.has(pid)) map.set(pid, { value: pid, label: pid });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [programs, callLogs]);

  const leadOriginOptions = React.useMemo(() => {
    const origins = new Set();
    const configOpts = resolveLeadOriginOptions(settingsOptions);
    (configOpts || []).forEach(s => {
      if (s && !isCallTypeOrInvalidSource(s)) origins.add(s);
    });
    callLogs.forEach(log => {
      const val = sanitizeSource(getContactLeadOrigin(log), "");
      if (val) origins.add(val);
    });
    return Array.from(origins).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const sourceOptions = React.useMemo(() => {
    const sources = new Set();
    const configOpts = resolveCurrentSourceOptions(settingsOptions);
    (configOpts || []).forEach(s => {
      if (s && !isCallTypeOrInvalidSource(s)) sources.add(s);
    });
    callLogs.forEach(log => {
      const val = sanitizeSource(getContactSource(log) || log.currentSource || log.source, "");
      if (val) sources.add(val);
    });
    return Array.from(sources).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const calledForOptions = React.useMemo(() => {
    const values = new Set();
    (settingsOptions?.calledForOptions || []).forEach(opt => {
      if (opt) {
        String(opt).split(",").map(s => s.trim()).filter(s => !isCallTypeOrInvalidProgram(s)).forEach(v => values.add(v));
      }
    });
    callLogs.forEach(log => {
      const key = Object.keys(log).find(k => ["called for", "called_for", "calledfor"].includes(k.toLowerCase()));
      const val = key ? String(log[key] || "").trim() : "";
      if (val) {
        val.split(",").map(s => s.trim()).filter(s => !isCallTypeOrInvalidProgram(s)).forEach(v => values.add(v));
      }
    });
    return Array.from(values).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const statusOptions = React.useMemo(() => {
    const statuses = new Set();
    const rawOptions = settingsOptions?.statusOptions || [];
    rawOptions.forEach(opt => {
      if (opt) statuses.add(getCanonicalStatus(opt));
    });
    callLogs.forEach(log => {
      if (log.attenderStates) {
        Object.values(log.attenderStates).forEach(state => {
          if (state.status) statuses.add(getCanonicalStatus(state.status));
          if (state.history) {
            state.history.forEach(h => {
              if (h.status) statuses.add(getCanonicalStatus(h.status));
            });
          }
        });
      }
      if (log.status) statuses.add(getCanonicalStatus(log.status));
      if (log.history) {
        log.history.forEach(h => {
          if (h.status) statuses.add(getCanonicalStatus(h.status));
        });
      }
    });
    return Array.from(statuses).filter(s => s !== "Pending").sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const allAttempts = React.useMemo(() => {
    return getCanonicalPhysicalCalls(callLogs, {
      startDate,
      endDate,
      selectedAttenderIds,
      selectedProgramIds,
      selectedSources,
      selectedLeadOrigins,
      selectedCalledFors,
      selectedStatuses,
      selectedCallTypes,
      selectedKhojiStatuses
    });
  }, [callLogs, startDate, endDate, selectedAttenderIds, selectedProgramIds, selectedSources, selectedLeadOrigins, selectedCalledFors, selectedStatuses, selectedCallTypes, selectedKhojiStatuses]);

  const attenderOptions = React.useMemo(() => {
    const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "agent"];
    return attenders
      .filter(a => a.role !== 'admin' && !EXCLUDED_ATTENDER_NAMES.includes((a.name || "").toLowerCase().trim()))
      .map(a => ({
        value: a.id || a._id,
        label: a.name
      }));
  }, [attenders]);

  const monthFiltered = React.useMemo(() => {
    const contactIds = new Set(allAttempts.map(a => String(a.contactId)));
    return callLogs.filter(log => contactIds.has(String(log._id || log.id)));
  }, [callLogs, allAttempts]);

  const programRegistrationsList = React.useMemo(() => {
    const list = getCanonicalRegistrations(registrations, callLogs, {
      startDate,
      endDate,
      selectedAttenderIds,
      selectedProgramIds,
      selectedSources,
      selectedLeadOrigins,
      selectedCalledFors
    });
    if (!startDate && !endDate) return list;
    return list.filter(reg => {
      const rawDate = reg.evidence?.timestamp || reg.registeredAt || reg.createdAt || reg.timestamp || reg.date;
      if (!rawDate) return false;
      const parsed = parseTimestamp(rawDate);
      if (!parsed || isNaN(parsed.getTime())) return false;
      const localStr = getLocalDateStr(parsed);
      const isLocalMatch = (!startDate || localStr >= startDate) && (!endDate || localStr <= endDate);
      return isLocalMatch;
    });
  }, [registrations, callLogs, startDate, endDate, selectedAttenderIds, selectedProgramIds, selectedSources, selectedLeadOrigins, selectedCalledFors]);

  const metrics = React.useMemo(() => {
    const stats = {
      connectedCalls: 0,
      notConnectedCalls: 0,
      totalCalls: 0,
      avgCallsPerDay: 0,
      highestCallDay: "-",
      totalConversions: 0,
      incomingCalls: 0,
      outgoingCalls: 0,
      incomingConnectedCalls: 0,
      incomingNotConnectedCalls: 0,
      outgoingConnectedCalls: 0,
      outgoingNotConnectedCalls: 0,
      incomingConversions: 0,
      outgoingConversions: 0,
      queryCalls: 0,
    };

    const seenConversions = new Set();
    allAttempts.forEach(c => {
      stats.totalCalls++;
      const category = classifyCallStatus(c.status);
      const isConnected = category === "CONNECTED";
      const isNotConnected = category === "NOT_CONNECTED";
      const type = (c.callType || "").toLowerCase();
      const isIncoming = type.startsWith("incoming");

      if (isConnected) {
        stats.connectedCalls++;
        if (isIncoming) {
          stats.incomingConnectedCalls++;
        } else {
          stats.outgoingConnectedCalls++;
        }
      } else {
        stats.notConnectedCalls++;
        if (isIncoming) {
          stats.incomingNotConnectedCalls++;
        } else {
          stats.outgoingNotConnectedCalls++;
        }
      }

      if (c.status === "Query") {
        stats.queryCalls++;
      }
      if (isIncoming) {
        stats.incomingCalls++;
      } else {
        stats.outgoingCalls++;
      }
    });

    // Populate conversions directly from canonical programRegistrationsList (Single Source of Truth)
    programRegistrationsList.forEach(reg => {
      stats.totalConversions++;
      const type = String(reg.callType || reg.type || "").toLowerCase().trim();
      const isIncoming = type === "incoming" || type === "in" || type.includes("incoming");
      if (isIncoming) {
        stats.incomingConversions++;
      } else {
        stats.outgoingConversions++;
      }
    });

    const dayMap = {};
    allAttempts.forEach(c => {
      if (c.timestamp) {
        const dStr = c.timestamp.toLocaleDateString("en-IN");
        dayMap[dStr] = (dayMap[dStr] || 0) + 1;
      }
    });

    const dayCounts = Object.values(dayMap);
    if (dayCounts.length > 0) {
      stats.avgCallsPerDay = Math.round(dayCounts.reduce((a, b) => a + b, 0) / dayCounts.length);
      const sorted = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
      stats.highestCallDay = `${sorted[0][0]} (${sorted[0][1]} calls)`;
    }

    return stats;
  }, [allAttempts, programRegistrationsList]);

  const section1 = React.useMemo(() => {
    const list = [
      { metric: "Total Calls Attempted", value: allAttempts.length },
      { metric: "Connected Calls", value: metrics.connectedCalls },
      { metric: "Not Connected Calls", value: metrics.notConnectedCalls },
      { metric: "Incoming Calls", value: metrics.incomingCalls },
      { metric: "Incoming Connected Calls", value: metrics.incomingConnectedCalls },
      { metric: "Incoming Not Connected Calls", value: metrics.incomingNotConnectedCalls },
      { metric: "Outgoing Calls", value: metrics.outgoingCalls },
      { metric: "Outgoing Connected Calls", value: metrics.outgoingConnectedCalls },
      { metric: "Outgoing Not Connected Calls", value: metrics.outgoingNotConnectedCalls },
      { metric: "Query Calls", value: metrics.queryCalls },
      { metric: "Total Program Registrations", value: programRegistrationsList.length },
      { metric: "Incoming Conversions (Reg.Done)", value: metrics.incomingConversions },
      { metric: "Outgoing Conversions (Reg.Done)", value: metrics.outgoingConversions },
    ];
    const totalContactsInMonth = new Set(monthFiltered.map(l => l.id)).size;
    list.push({ metric: "Unique Leads Contacted", value: totalContactsInMonth });
    return list;
  }, [allAttempts, metrics, monthFiltered, programRegistrationsList]);

  const attenderPerformance = React.useMemo(() => {
    const map = {};
    const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "agent"];

    attenders.forEach(a => {
      const norm = (a.name || "").toLowerCase().trim();
      if (a.role !== 'admin' && !EXCLUDED_ATTENDER_NAMES.includes(norm)) {
        map[a.id || norm] = { name: a.name, total: 0, connected: 0, notConnected: 0, incoming: 0, outgoing: 0, conversions: 0, incomingConversions: 0, outgoingConversions: 0, denominator: 0 };
      }
    });

    allAttempts.forEach(c => {
      const rawName = (c.attenderName || "").toLowerCase().trim();
      if (EXCLUDED_ATTENDER_NAMES.includes(rawName) || c.attenderId === "admin") return;

      const foundAttender = attenders.find(a => (a.name || "").toLowerCase().trim() === rawName || a.id === c.attenderId);
      const attId = foundAttender ? foundAttender.id : (c.attenderId || rawName);
      if (!map[attId]) {
        map[attId] = { name: foundAttender ? foundAttender.name : c.attenderName, total: 0, connected: 0, notConnected: 0, incoming: 0, outgoing: 0, conversions: 0, incomingConversions: 0, outgoingConversions: 0, denominator: 0 };
      }
      const item = map[attId];
      item.total++;
      const classification = classifyCallStatus(c.status);
      if (classification === "CONNECTED") item.connected++;
      else if (classification === "NOT_CONNECTED") item.notConnected++;
      
      const type = (c.callType || "").toLowerCase();
      const isIncoming = type.startsWith("incoming");
      if (isIncoming) {
        item.incoming++;
      } else {
        item.outgoing++;
      }
      
      item.denominator += getConversionDenominator(c.status);
    });

    // Populate conversions from canonical programRegistrationsList
    programRegistrationsList.forEach(reg => {
      const rawName = (reg.leadOwnerName || reg.attenderName || reg.attender || reg.assignedTo || "").trim() || "Unknown Attender";
      const normName = rawName.toLowerCase();
      if (EXCLUDED_ATTENDER_NAMES.includes(normName)) return;

      const foundAttender = (attenders || []).find(a =>
        (a.name || "").toLowerCase().trim() === normName ||
        (a.id && (reg.leadOwnerId || reg.attenderId) && String(a.id) === String(reg.leadOwnerId || reg.attenderId))
      );
      const attId = foundAttender ? foundAttender.id : (reg.leadOwnerId || reg.attenderId || normName);
      if (!attId || attId === "admin") return;

      if (!map[attId]) {
        map[attId] = { name: foundAttender ? foundAttender.name : rawName, total: 0, connected: 0, notConnected: 0, incoming: 0, outgoing: 0, conversions: 0, incomingConversions: 0, outgoingConversions: 0, teamAssists: 0, denominator: 0 };
      }
      map[attId].conversions++;

      const type = String(reg.callType || reg.type || "").toLowerCase().trim();
      const isIncoming = type === "incoming" || type === "in" || type.includes("incoming");
      if (isIncoming) {
        map[attId].incomingConversions = (map[attId].incomingConversions || 0) + 1;
      } else {
        map[attId].outgoingConversions = (map[attId].outgoingConversions || 0) + 1;
      }

      // If this is a shared conversion, credit team assist to the converter
      if (reg.isSharedConversion && (reg.convertingAttenderName || reg.convertedBy)) {
        const convRawName = (reg.convertingAttenderName || reg.convertedBy || "").trim();
        const convNormName = convRawName.toLowerCase();
        if (!EXCLUDED_ATTENDER_NAMES.includes(convNormName)) {
          const foundConv = (attenders || []).find(a =>
            (a.name || "").toLowerCase().trim() === convNormName ||
            (a.id && reg.convertingAttenderId && String(a.id) === String(reg.convertingAttenderId))
          );
          const convId = foundConv ? foundConv.id : (reg.convertingAttenderId || convNormName);
          if (convId && convId !== "admin") {
            if (!map[convId]) {
              map[convId] = { name: foundConv ? foundConv.name : convRawName, total: 0, connected: 0, notConnected: 0, incoming: 0, outgoing: 0, conversions: 0, incomingConversions: 0, outgoingConversions: 0, teamAssists: 0, denominator: 0 };
            }
            map[convId].teamAssists = (map[convId].teamAssists || 0) + 1;
          }
        }
      }
    });

    return Object.values(map).map(a => ({
      "Attender Name": a.name,
      "Total Calls": a.total,
      "Connected": a.connected,
      "Not Connected": a.notConnected,
      "Incoming": a.incoming,
      "Outgoing": a.outgoing,
      "Reg.Done (Conversions)": a.conversions,
      "Team Assists": a.teamAssists || 0,
      "Incoming Conversions": a.incomingConversions,
      "Outgoing Conversions": a.outgoingConversions,
      "denominator": a.denominator,
      "Conversion Rate (%)": a.denominator ? `${((a.conversions / a.denominator) * 100).toFixed(1)}%` : "0.0%"
    })).sort((a, b) => {
      if (b["Reg.Done (Conversions)"] !== a["Reg.Done (Conversions)"]) {
        return b["Reg.Done (Conversions)"] - a["Reg.Done (Conversions)"];
      }
      return parseFloat(b["Conversion Rate (%)"]) - parseFloat(a["Conversion Rate (%)"]);
    });
  }, [allAttempts, attenders, programRegistrationsList]);

  const attenderPerformanceTotals = React.useMemo(() => {
    const totals = { 
      "Attender Name": "Total", 
      "Total Calls": 0, 
      "Connected": 0, 
      "Not Connected": 0, 
      "Incoming": 0, 
      "Outgoing": 0, 
      "Reg.Done (Conversions)": 0, 
      "Team Assists": 0,
      "Incoming Conversions": 0,
      "Outgoing Conversions": 0,
      "Conversion Rate (%)": "0.0%" 
    };
    let totalDenominator = 0;
    attenderPerformance.forEach(row => {
      totals["Total Calls"] += row["Total Calls"];
      totals["Connected"] += row["Connected"];
      totals["Not Connected"] += row["Not Connected"];
      totals["Incoming"] += row["Incoming"];
      totals["Outgoing"] += row["Outgoing"];
      totals["Reg.Done (Conversions)"] += row["Reg.Done (Conversions)"];
      totals["Team Assists"] += row["Team Assists"] || 0;
      totals["Incoming Conversions"] += row["Incoming Conversions"];
      totals["Outgoing Conversions"] += row["Outgoing Conversions"];
      totalDenominator += row["denominator"] || 0;
    });
    totals["Conversion Rate (%)"] = totalDenominator ? `${((totals["Reg.Done (Conversions)"] / totalDenominator) * 100).toFixed(1)}%` : "0.0%";
    return totals;
  }, [attenderPerformance]);

  const calledForVsSourceBreakdown = React.useMemo(() => {
    const map = {};

    allAttempts.forEach(c => {
      const rawSrc = sourceDimension === "leadOrigin" ? c.leadOrigin : c.source;
      const src = sanitizeSource(rawSrc, "Unspecified");
      const rawCalledFors = String(c.calledFor || "").split(",").map(x => x.trim()).filter(x => !isCallTypeOrInvalidProgram(x));
      const calledFors = rawCalledFors.length > 0 ? rawCalledFors : ["Unspecified"];

      calledFors.forEach(prog => {
        if (selectedCalledFors.length > 0 && !selectedCalledFors.includes(prog)) {
          return;
        }
        const key = `${prog} &&& ${src}`;
        if (!map[key]) {
          map[key] = { 
            calledFor: prog, 
            source: src, 
            total: 0, 
            incoming: 0, 
            outgoing: 0, 
            conversions: 0, 
            incomingConversions: 0, 
            outgoingConversions: 0, 
            incomingLeadsSet: new Set(),
            outgoingLeadsSet: new Set(),
            attempts: [],
            registrations: []
          };
        }
        const item = map[key];
        item.total++;
        item.attempts.push(c);
        
        const type = (c.callType || "").toLowerCase();
        const isIncoming = type.startsWith("incoming");
        
        if (isIncoming) {
          item.incoming++;
        } else {
          item.outgoing++;
        }

        // Track unique leads by their 1st call type
        const contactId = c.contactId ? String(c.contactId) : null;
        if (contactId) {
          const leadLog = callLogs.find(l => String(l._id || l.id) === contactId);
          const firstCallType = leadLog ? String(determineCallType(leadLog, leadLog) || "").toLowerCase() : (isIncoming ? "incoming" : "outgoing");
          if (firstCallType.startsWith("incoming") || firstCallType === "in") {
            item.incomingLeadsSet.add(contactId);
          } else {
            item.outgoingLeadsSet.add(contactId);
          }
        }
      });
    });

    // Populate conversions directly from canonical programRegistrationsList
    programRegistrationsList.forEach(reg => {
      const rawSrc = sourceDimension === "leadOrigin" ? reg.leadOrigin : reg.source;
      const src = sanitizeSource(rawSrc, "Unspecified");
      const prog = sanitizeCalledFor(reg.calledFor || reg.programName, "Unspecified");
      const key = `${prog} &&& ${src}`;
      if (!map[key]) {
        map[key] = { 
          calledFor: prog, 
          source: src, 
          total: 0, 
          incoming: 0, 
          outgoing: 0, 
          conversions: 0, 
          incomingConversions: 0, 
          outgoingConversions: 0, 
          incomingLeadsSet: new Set(),
          outgoingLeadsSet: new Set(),
          attempts: [],
          registrations: []
        };
      }
      const item = map[key];
      const type = String(reg.callType || reg.type || "").toLowerCase().trim();
      const isIncoming = type === "incoming" || type === "in" || type.includes("incoming");
      item.conversions++;
      item.registrations.push(reg);
      if (isIncoming) {
        item.incomingConversions++;
        if (reg.contactId) item.incomingLeadsSet.add(String(reg.contactId));
      } else {
        item.outgoingConversions++;
        if (reg.contactId) item.outgoingLeadsSet.add(String(reg.contactId));
      }
    });

    const calledForTotals = {};
    const rows = Object.values(map).map(a => {
      // Direct and intuitive Call Center conversion rate:
      // If calls = 0, conversion rate is strictly 0.0% (never 100% on 0 calls).
      // If calls > 0, (conversions / calls) * 100, capped at 100.0%.
      const incomingRate = a.incoming > 0 
        ? Math.min(100, (a.incomingConversions / a.incoming) * 100) 
        : 0;

      const outgoingRate = a.outgoing > 0 
        ? Math.min(100, (a.outgoingConversions / a.outgoing) * 100) 
        : 0;

      const srcCol = sourceDimension === "leadOrigin" ? "Lead Origin" : "Source";
      const row = {
        "Called For": a.calledFor,
        [srcCol]: a.source,
        "Source": a.source,
        "Lead Origin": a.source,
        "Total Calls": a.total,
        "Incoming Calls": a.incoming,
        "Outgoing Calls": a.outgoing,
        "Total Conversions": a.conversions,
        "Incoming Conversions": a.incomingConversions,
        "Outgoing Conversions": a.outgoingConversions,
        "Incoming Conversion Rate (%)": `${incomingRate.toFixed(1)}%`,
        "Outgoing Conversion Rate (%)": `${outgoingRate.toFixed(1)}%`,
        _attempts: a.attempts || [],
        _registrations: a.registrations || []
      };
      const prog = row["Called For"];
      calledForTotals[prog] = (calledForTotals[prog] || 0) + row["Total Calls"];
      return row;
    });

    return rows.sort((a, b) => {
      const aProg = a["Called For"];
      const bProg = b["Called For"];
      
      const aEnd = shouldGoToEnd(aProg);
      const bEnd = shouldGoToEnd(bProg);
      
      if (aEnd && !bEnd) return 1;
      if (!aEnd && bEnd) return -1;
      
      if (aProg !== bProg) {
        const aVol = calledForTotals[aProg] || 0;
        const bVol = calledForTotals[bProg] || 0;
        if (bVol !== aVol) {
          return bVol - aVol;
        }
        return aProg.localeCompare(bProg);
      }
      
      return b["Total Calls"] - a["Total Calls"];
    });
  }, [allAttempts, selectedCalledFors, programRegistrationsList, sourceDimension, callLogs]);

  const calledForVsSourceBreakdownTotals = React.useMemo(() => {
    const srcCol = sourceDimension === "leadOrigin" ? "Lead Origin" : "Source";
    const totals = { 
      "Called For": "Total", 
      [srcCol]: "-",
      "Source": "-", 
      "Lead Origin": "-", 
      "Total Calls": 0, 
      "Incoming Calls": 0, 
      "Outgoing Calls": 0, 
      "Total Conversions": 0, 
      "Incoming Conversions": 0, 
      "Outgoing Conversions": 0, 
      "Incoming Conversion Rate (%)": "0.0%", 
      "Outgoing Conversion Rate (%)": "0.0%" 
    };
    calledForVsSourceBreakdown.forEach(row => {
      totals["Total Calls"] += row["Total Calls"];
      totals["Incoming Calls"] += row["Incoming Calls"];
      totals["Outgoing Calls"] += row["Outgoing Calls"];
      totals["Total Conversions"] += row["Total Conversions"];
      totals["Incoming Conversions"] += row["Incoming Conversions"];
      totals["Outgoing Conversions"] += row["Outgoing Conversions"];
    });
    const incomingOverallRate = totals["Incoming Calls"] > 0 
      ? Math.min(100, (totals["Incoming Conversions"] / totals["Incoming Calls"]) * 100) 
      : 0;
    const outgoingOverallRate = totals["Outgoing Calls"] > 0 
      ? Math.min(100, (totals["Outgoing Conversions"] / totals["Outgoing Calls"]) * 100) 
      : 0;
    totals["Incoming Conversion Rate (%)"] = `${incomingOverallRate.toFixed(1)}%`;
    totals["Outgoing Conversion Rate (%)"] = `${outgoingOverallRate.toFixed(1)}%`;
    return totals;
  }, [calledForVsSourceBreakdown]);

  // ── Source-wise Conversions, Calls, Incoming & Outgoing Breakdown ──────────
  const sourceWiseBreakdown = React.useMemo(() => {
    const map = {};

    allAttempts.forEach(c => {
      const rawSrc = sourceDimension === "leadOrigin" ? c.leadOrigin : c.source;
      const src = sanitizeSource(rawSrc, "Unspecified");

      if (selectedSources.length > 0 && !selectedSources.includes(src)) {
        return;
      }

      if (!map[src]) {
        map[src] = {
          source: src,
          total: 0,
          incoming: 0,
          outgoing: 0,
          conversions: 0,
          incomingConversions: 0,
          outgoingConversions: 0,
          attempts: [],
          registrations: []
        };
      }

      const item = map[src];
      item.total++;
      item.attempts.push(c);

      const type = (c.callType || "").toLowerCase();
      const isIncoming = type.startsWith("incoming");

      if (isIncoming) {
        item.incoming++;
      } else {
        item.outgoing++;
      }
    });

    // Populate conversions directly from canonical programRegistrationsList
    programRegistrationsList.forEach(reg => {
      const rawSrc = sourceDimension === "leadOrigin" ? reg.leadOrigin : reg.source;
      const src = sanitizeSource(rawSrc, "Unspecified");

      if (selectedSources.length > 0 && !selectedSources.includes(src)) {
        return;
      }

      if (!map[src]) {
        map[src] = {
          source: src,
          total: 0,
          incoming: 0,
          outgoing: 0,
          conversions: 0,
          incomingConversions: 0,
          outgoingConversions: 0,
          attempts: [],
          registrations: []
        };
      }

      const item = map[src];
      const type = String(reg.callType || reg.type || "").toLowerCase().trim();
      const isIncoming = type === "incoming" || type === "in" || type.includes("incoming");
      item.conversions++;
      item.registrations.push(reg);

      if (isIncoming) {
        item.incomingConversions++;
      } else {
        item.outgoingConversions++;
      }
    });

    const srcCol = sourceDimension === "leadOrigin" ? "Lead Origin" : "Source";

    const rows = Object.values(map).map(a => {
      const totalConvRate = a.total > 0
        ? Math.min(100, (a.conversions / a.total) * 100)
        : 0;

      const incomingRate = a.incoming > 0
        ? Math.min(100, (a.incomingConversions / a.incoming) * 100)
        : 0;

      const outgoingRate = a.outgoing > 0
        ? Math.min(100, (a.outgoingConversions / a.outgoing) * 100)
        : 0;

      return {
        [srcCol]: a.source,
        "Source": a.source,
        "Lead Origin": a.source,
        "Total Calls": a.total,
        "Incoming Calls": a.incoming,
        "Outgoing Calls": a.outgoing,
        "Total Conversions": a.conversions,
        "Incoming Conversions": a.incomingConversions,
        "Outgoing Conversions": a.outgoingConversions,
        "Conversion Rate (%)": `${totalConvRate.toFixed(1)}%`,
        "Incoming Conversion Rate (%)": `${incomingRate.toFixed(1)}%`,
        "Outgoing Conversion Rate (%)": `${outgoingRate.toFixed(1)}%`,
        rawTotalRate: parseFloat(totalConvRate.toFixed(1)),
        rawIncomingRate: parseFloat(incomingRate.toFixed(1)),
        rawOutgoingRate: parseFloat(outgoingRate.toFixed(1)),
        _attempts: a.attempts || [],
        _registrations: a.registrations || []
      };
    });

    return rows.sort((a, b) => {
      const aEnd = shouldGoToEnd(a.Source);
      const bEnd = shouldGoToEnd(b.Source);
      if (aEnd && !bEnd) return 1;
      if (!aEnd && bEnd) return -1;
      if (b["Total Conversions"] !== a["Total Conversions"]) {
        return b["Total Conversions"] - a["Total Conversions"];
      }
      return b["Total Calls"] - a["Total Calls"];
    });
  }, [allAttempts, programRegistrationsList, sourceDimension, selectedSources]);

  const sourceWiseBreakdownTotals = React.useMemo(() => {
    const srcCol = sourceDimension === "leadOrigin" ? "Lead Origin" : "Source";
    const totals = {
      [srcCol]: "Total",
      "Source": "Total",
      "Lead Origin": "Total",
      "Total Calls": 0,
      "Incoming Calls": 0,
      "Outgoing Calls": 0,
      "Total Conversions": 0,
      "Incoming Conversions": 0,
      "Outgoing Conversions": 0,
      "Conversion Rate (%)": "0.0%",
      "Incoming Conversion Rate (%)": "0.0%",
      "Outgoing Conversion Rate (%)": "0.0%",
      _attempts: allAttempts,
      _registrations: programRegistrationsList
    };

    sourceWiseBreakdown.forEach(row => {
      totals["Total Calls"] += row["Total Calls"];
      totals["Incoming Calls"] += row["Incoming Calls"];
      totals["Outgoing Calls"] += row["Outgoing Calls"];
      totals["Total Conversions"] += row["Total Conversions"];
      totals["Incoming Conversions"] += row["Incoming Conversions"];
      totals["Outgoing Conversions"] += row["Outgoing Conversions"];
    });

    const totalConvRate = totals["Total Calls"] > 0
      ? Math.min(100, (totals["Total Conversions"] / totals["Total Calls"]) * 100)
      : 0;

    const incomingOverallRate = totals["Incoming Calls"] > 0
      ? Math.min(100, (totals["Incoming Conversions"] / totals["Incoming Calls"]) * 100)
      : 0;

    const outgoingOverallRate = totals["Outgoing Calls"] > 0
      ? Math.min(100, (totals["Outgoing Conversions"] / totals["Outgoing Calls"]) * 100)
      : 0;

    totals["Conversion Rate (%)"] = `${totalConvRate.toFixed(1)}%`;
    totals["Incoming Conversion Rate (%)"] = `${incomingOverallRate.toFixed(1)}%`;
    totals["Outgoing Conversion Rate (%)"] = `${outgoingOverallRate.toFixed(1)}%`;

    return totals;
  }, [sourceWiseBreakdown, sourceDimension, allAttempts, programRegistrationsList]);

  const sourceWisePieData = React.useMemo(() => {
    const totalConvs = sourceWiseBreakdownTotals["Total Conversions"] || 1;
    const totalCalls = sourceWiseBreakdownTotals["Total Calls"] || 1;

    const convSlice = sourceWiseBreakdown
      .filter(r => r["Total Conversions"] > 0)
      .map((r, idx) => ({
        name: r.Source,
        value: r["Total Conversions"],
        percentage: ((r["Total Conversions"] / totalConvs) * 100).toFixed(1),
        color: SOURCE_PALETTE[idx % SOURCE_PALETTE.length]
      }));

    const callSlice = sourceWiseBreakdown
      .filter(r => r["Total Calls"] > 0)
      .map((r, idx) => ({
        name: r.Source,
        value: r["Total Calls"],
        percentage: ((r["Total Calls"] / totalCalls) * 100).toFixed(1),
        color: SOURCE_PALETTE[idx % SOURCE_PALETTE.length]
      }));

    return { convSlice, callSlice };
  }, [sourceWiseBreakdown, sourceWiseBreakdownTotals]);

  const handleInspectSourceSlice = (sourceName, sliceType = "conversions") => {
    if (!sourceName) return;
    const row = sourceWiseBreakdown.find(r => (r.Source || r["Lead Origin"]) === sourceName);
    if (!row) return;

    const isConv = sliceType === "conversions";
    const items = isConv
      ? (row._registrations && row._registrations.length > 0 ? row._registrations : row._attempts || [])
      : (row._attempts && row._attempts.length > 0 ? row._attempts : row._registrations || []);

    const sName = row.Source || row["Lead Origin"];
    setInspectModalData({
      title: `${isConv ? "Conversions" : "Calls & Leads"} for Source "${sName}" (${items.length})`,
      subtitle: `Total Calls: ${row["Total Calls"]} (Incoming: ${row["Incoming Calls"]}, Outgoing: ${row["Outgoing Calls"]}) | Conversions: ${row["Total Conversions"]} (Incoming: ${row["Incoming Conversions"]}, Outgoing: ${row["Outgoing Conversions"]})`,
      category: isConv ? "registrations" : "calls",
      items: items
    });
  };

  const calledForConversionPieData = React.useMemo(() => {
    const progMap = {};
    const totalConvs = programRegistrationsList.length || 1;

    programRegistrationsList.forEach(reg => {
      const prog = sanitizeCalledFor(reg.calledFor || reg.programName, "Unspecified");
      if (selectedCalledFors.length > 0 && !selectedCalledFors.includes(prog)) {
        return;
      }

      if (!progMap[prog]) {
        progMap[prog] = {
          name: prog,
          value: 0,
          registrations: []
        };
      }
      progMap[prog].value++;
      progMap[prog].registrations.push(reg);
    });

    const slices = Object.values(progMap)
      .filter(p => p.value > 0)
      .sort((a, b) => {
        const aEnd = shouldGoToEnd(a.name);
        const bEnd = shouldGoToEnd(b.name);
        if (aEnd && !bEnd) return 1;
        if (!aEnd && bEnd) return -1;
        return b.value - a.value;
      })
      .map((p, idx) => ({
        name: p.name,
        value: p.value,
        percentage: ((p.value / totalConvs) * 100).toFixed(1),
        color: SOURCE_PALETTE[(idx + 4) % SOURCE_PALETTE.length],
        registrations: p.registrations
      }));

    const totalCalledForConvs = slices.reduce((sum, s) => sum + s.value, 0);

    return { slices, totalCalledForConvs };
  }, [programRegistrationsList, selectedCalledFors]);

  const handleInspectCalledForConversionSlice = (progName) => {
    if (!progName) return;
    const slice = calledForConversionPieData.slices.find(s => s.name === progName);
    const items = slice ? slice.registrations : [];
    setInspectModalData({
      title: `Conversions for Program "${progName}" (${items.length})`,
      subtitle: `Total Registrations: ${items.length} confirmed conversions`,
      category: "registrations",
      items: items
    });
  };

  const calledForPieData = React.useMemo(() => {
    const groupMap = {};
    const globalSourceCounts = {};

    allAttempts.forEach(c => {
      const rawSrc = sourceDimension === "leadOrigin" ? c.leadOrigin : c.source;
      const src = sanitizeSource(rawSrc, "Unspecified");
      const rawCalledFors = String(c.calledFor || "").split(",").map(x => x.trim()).filter(x => !isCallTypeOrInvalidProgram(x));
      const calledFors = rawCalledFors.length > 0 ? rawCalledFors : ["Unspecified"];

      calledFors.forEach(prog => {
        if (selectedCalledFors.length > 0 && !selectedCalledFors.includes(prog)) {
          return;
        }

        if (!groupMap[prog]) {
          groupMap[prog] = {
            calledFor: prog,
            totalCalls: 0,
            sourcesMap: {},
            attempts: [],
            attemptsBySource: {}
          };
        }

        const group = groupMap[prog];
        group.totalCalls++;
        group.attempts.push(c);

        if (!group.sourcesMap[src]) {
          group.sourcesMap[src] = 0;
          group.attemptsBySource[src] = [];
        }
        group.sourcesMap[src]++;
        group.attemptsBySource[src].push(c);

        globalSourceCounts[src] = (globalSourceCounts[src] || 0) + 1;
      });
    });

    const uniqueSources = Object.keys(globalSourceCounts).sort((a, b) => {
      const aEnd = shouldGoToEnd(a);
      const bEnd = shouldGoToEnd(b);
      if (aEnd && !bEnd) return 1;
      if (!aEnd && bEnd) return -1;
      return globalSourceCounts[b] - globalSourceCounts[a];
    });

    const sourceColorMap = {};
    uniqueSources.forEach((src, idx) => {
      sourceColorMap[src] = SOURCE_PALETTE[idx % SOURCE_PALETTE.length];
    });

    const groups = Object.values(groupMap).map(g => {
      const sourcesList = Object.entries(g.sourcesMap).map(([sName, sCount]) => ({
        name: sName,
        value: sCount,
        percentage: g.totalCalls ? ((sCount / g.totalCalls) * 100).toFixed(1) : "0.0"
      })).sort((a, b) => b.value - a.value);

      return {
        calledFor: g.calledFor,
        totalCalls: g.totalCalls,
        sources: sourcesList,
        attempts: g.attempts,
        attemptsBySource: g.attemptsBySource
      };
    }).sort((a, b) => {
      const aEnd = shouldGoToEnd(a.calledFor);
      const bEnd = shouldGoToEnd(b.calledFor);
      if (aEnd && !bEnd) return 1;
      if (!aEnd && bEnd) return -1;
      return b.totalCalls - a.totalCalls;
    });

    return {
      groups,
      uniqueSources,
      globalSourceCounts,
      sourceColorMap
    };
  }, [allAttempts, selectedCalledFors, sourceDimension]);

  const calledForRegistrationPieData = React.useMemo(() => {
    const groupMap = {};
    const globalSourceCounts = {};

    programRegistrationsList.forEach(reg => {
      const rawSrc = sourceDimension === "leadOrigin" ? reg.leadOrigin : reg.source;
      const src = sanitizeSource(rawSrc, "Unspecified");
      const prog = sanitizeCalledFor(reg.calledFor || reg.programName, "Unspecified");

      if (selectedCalledFors.length > 0 && !selectedCalledFors.includes(prog)) {
        return;
      }

      if (!groupMap[prog]) {
        groupMap[prog] = {
          calledFor: prog,
          totalRegistrations: 0,
          sourcesMap: {},
          registrations: [],
          registrationsBySource: {}
        };
      }

      const group = groupMap[prog];
      group.totalRegistrations++;
      const itemRecord = {
        contactName: reg.name || reg.contactName || "Unnamed",
        contactPhone: reg.phone || reg.contactPhone || "—",
        attenderName: reg.leadOwnerName || reg.attenderName || reg.assignedTo || "Unassigned",
        calledFor: prog,
        source: src,
        callType: reg.callType || reg.type || "Registration",
        status: "Reg.Done",
        timestamp: parseTimestamp(reg.registeredAt || reg.timestamp || reg.createdAt || reg.date),
        remark: reg.remark || ""
      };
      group.registrations.push(itemRecord);

      if (!group.sourcesMap[src]) {
        group.sourcesMap[src] = 0;
        group.registrationsBySource[src] = [];
      }
      group.sourcesMap[src]++;
      group.registrationsBySource[src].push(itemRecord);

      globalSourceCounts[src] = (globalSourceCounts[src] || 0) + 1;
    });

    const uniqueSources = Object.keys(globalSourceCounts).sort((a, b) => {
      const aEnd = shouldGoToEnd(a);
      const bEnd = shouldGoToEnd(b);
      if (aEnd && !bEnd) return 1;
      if (!aEnd && bEnd) return -1;
      return globalSourceCounts[b] - globalSourceCounts[a];
    });

    const sourceColorMap = {};
    uniqueSources.forEach((src, idx) => {
      sourceColorMap[src] = SOURCE_PALETTE[idx % SOURCE_PALETTE.length];
    });

    const groups = Object.values(groupMap).map(g => {
      const sourcesList = Object.entries(g.sourcesMap).map(([sName, sCount]) => ({
        name: sName,
        value: sCount,
        percentage: g.totalRegistrations ? ((sCount / g.totalRegistrations) * 100).toFixed(1) : "0.0"
      })).sort((a, b) => b.value - a.value);

      const callsForGroup = calledForPieData.groups.find(cg => cg.calledFor === g.calledFor)?.totalCalls || 0;
      const convRate = callsForGroup > 0 ? ((g.totalRegistrations / callsForGroup) * 100).toFixed(1) : null;

      return {
        calledFor: g.calledFor,
        totalRegistrations: g.totalRegistrations,
        totalCalls: callsForGroup,
        convRate,
        sources: sourcesList,
        registrations: g.registrations,
        registrationsBySource: g.registrationsBySource
      };
    }).sort((a, b) => {
      const aEnd = shouldGoToEnd(a.calledFor);
      const bEnd = shouldGoToEnd(b.calledFor);
      if (aEnd && !bEnd) return 1;
      if (!aEnd && bEnd) return -1;
      return b.totalRegistrations - a.totalRegistrations;
    });

    return {
      groups,
      uniqueSources,
      globalSourceCounts,
      sourceColorMap
    };
  }, [programRegistrationsList, selectedCalledFors, sourceDimension, calledForPieData.groups]);

  const conversionsList = React.useMemo(() => {
    return programRegistrationsList.map(r => {
      const ts = parseTimestamp(r.registeredAt || r.timestamp || r.createdAt || r.date);
      return {
        contactName: r.name || r.contactName || "Unnamed",
        contactPhone: r.phone || r.contactPhone || "—",
        attenderName: r.leadOwnerName || r.attenderName || r.attender || r.assignedTo || "Unassigned",
        leadOwnerName: r.leadOwnerName,
        convertedBy: r.convertedBy || r.convertingAttenderName,
        isSharedConversion: r.isSharedConversion,
        programName: r.programName || r.calledFor || "—",
        source: r.source || "—",
        calledFor: r.calledFor || r.programName || "—",
        timestamp: ts,
        feedback: r.feedback || "",
        remark: r.remark || ""
      };
    });
  }, [programRegistrationsList]);

  const searchedConversions = React.useMemo(() => {
    if (!conversionSearch.trim()) return conversionsList;
    const term = conversionSearch.toLowerCase();
    return conversionsList.filter(c => {
      return (
        (c.contactName || "").toLowerCase().includes(term) ||
        (c.contactPhone || "").toLowerCase().includes(term) ||
        (c.programName || "").toLowerCase().includes(term) ||
        (c.attenderName || "").toLowerCase().includes(term) ||
        (c.leadOwnerName || "").toLowerCase().includes(term) ||
        (c.convertedBy || "").toLowerCase().includes(term) ||
        (c.source || "").toLowerCase().includes(term) ||
        (c.calledFor || "").toLowerCase().includes(term) ||
        (c.feedback || "").toLowerCase().includes(term) ||
        (c.remark || "").toLowerCase().includes(term)
      );
    });
  }, [conversionsList, conversionSearch]);

  const convPerPage = 10;
  const totalConvPages = Math.ceil(searchedConversions.length / convPerPage) || 1;
  const paginatedConversions = React.useMemo(() => {
    const start = (convPage - 1) * convPerPage;
    return searchedConversions.slice(start, start + convPerPage);
  }, [searchedConversions, convPage]);

  useEffect(() => {
    setConvPage(1);
  }, [conversionSearch]);

  const handleExport = () => {
    if (!allAttempts.length) {
      toast.error("No data to export.");
      return;
    }
    const wb = XLSX.utils.book_new();

    const cleanRows = (list) => list.map(item => {
      const { 
        denominator, 
        Denominator, 
        incomingDenominator, 
        outgoingDenominator, 
        "Incoming Denominator": incDen, 
        "Outgoing Denominator": outDen, 
        ...rest 
      } = item;
      return rest;
    });

    // 1. Summary
    const wsSummary = XLSX.utils.json_to_sheet(section1);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary KPI");

    // 2. Attenders
    const wsAttenders = XLSX.utils.json_to_sheet(cleanRows([...attenderPerformance, attenderPerformanceTotals]));
    XLSX.utils.book_append_sheet(wb, wsAttenders, "Attender Performance");

    // 3. Called For vs Source Breakdown
    const wsCalledForVsSource = XLSX.utils.json_to_sheet(cleanRows([...calledForVsSourceBreakdown, calledForVsSourceBreakdownTotals]));
    XLSX.utils.book_append_sheet(wb, wsCalledForVsSource, "Called For vs Source");

    // 3b. Source-wise Conversions & Calls Breakdown
    const wsSourceWise = XLSX.utils.json_to_sheet(cleanRows([...sourceWiseBreakdown, sourceWiseBreakdownTotals]));
    XLSX.utils.book_append_sheet(wb, wsSourceWise, "Source Breakdown");

    // 4. Detailed Call Logs (Grouped by Mobile Number: consecutive rows per number, chronological history)
    const detailedLogs = [...allAttempts]
      .sort((a, b) => {
        const phoneA = (a.contactPhone || "").trim();
        const phoneB = (b.contactPhone || "").trim();
        if (phoneA !== phoneB) {
          return phoneA.localeCompare(phoneB);
        }
        return (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0);
      })
      .map(att => ({
        "Date": att.timestamp ? att.timestamp.toISOString().split("T")[0] : "",
        "Time": att.timestamp ? att.timestamp.toLocaleTimeString("en-IN") : "",
        "Name": att.contactName || "",
        "Mobile Number": att.contactPhone || "",
        "City": att.contactCity || "",
        "Khoji Type": att.Khoji || "",
        "Called For": att.calledFor || "",
        "Source": att.source || "",
        "Status": att.status || "",
        "Calls Done": att.totalContactCalls || 1,
        "Attender": att.attenderName || "",
        "Call Type": att.callType || "",
        "Remark": att.remark || ""
      }));
    const wsDetailedLogs = XLSX.utils.json_to_sheet(detailedLogs);
    XLSX.utils.book_append_sheet(wb, wsDetailedLogs, "Detailed Call Logs");

    // 5. Previous Program Pending Leads
    const prevPendingLogs = (callLogs || [])
      .filter(log => {
        const stage = getCanonicalStatus(log.pipelineStage || log.stage);
        return stage === "Previous Program Pending" || log.pipelineStage === "Previous Program Pending";
      })
      .map(log => ({
        "Name": getContactName(log),
        "Phone": getContactPhone(log),
        "City": getContactCity(log),
        "Khoji": getContactKhoji(log),
        "Target Program (Called For)": log["Called For"] || log.calledFor || log.called_for || log.programName || "—",
        "Source": log.Source || log.source || "—",
        "Pending Previous Program": log.previousProgram || log.Source || log.source || "Unspecified",
        "Attender": log.attenderName || log.assignedTo || "Unassigned",
        "Last Called": log.lastCalledAt ? new Date(log.lastCalledAt).toISOString().split("T")[0] : "—"
      }));

    if (prevPendingLogs.length > 0) {
      const wsPrevPending = XLSX.utils.json_to_sheet(prevPendingLogs);
      XLSX.utils.book_append_sheet(wb, wsPrevPending, "Previous Program Pending");
    }



    // Write file
    const startStr = startDate ? startDate.replace(/-/g, "") : "start";
    const endStr = endDate ? endDate.replace(/-/g, "") : "end";
    XLSX.writeFile(wb, `CallCenter_Report_${startStr}_to_${endStr}.xlsx`);
    toast.success("Excel analytics report downloaded successfully!");
  };

  const activeFilters = selectedLeadOrigins.length + selectedProgramIds.length + selectedAttenderIds.length + selectedSources.length + selectedCalledFors.length + selectedStatuses.length + selectedCallTypes.length + selectedKhojiStatuses.length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Call Center Analytics Report</h2>
          <p className="text-xs text-slate-500 mt-0.5">Generate comprehensive custom range analytics and export to Excel.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            disabled={!allAttempts.length}
            className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Download size={14} /> Export Excel Workbook
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-3">
        {/* Row 1: Dropdowns grid */}
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={leadOriginOptions}
            selected={selectedLeadOrigins}
            onChange={setSelectedLeadOrigins}
            placeholder="Lead Origin"
            allLabel="All Lead Origins"
          />

          <MultiSelect
            options={sourceOptions}
            selected={selectedSources}
            onChange={setSelectedSources}
            placeholder="Current Source"
            allLabel="All Current Sources"
          />

          <MultiSelect
            options={programOptions}
            selected={selectedProgramIds}
            onChange={setSelectedProgramIds}
            placeholder="Tags"
            allLabel="All Tags"
          />

          <MultiSelect
            options={attenderOptions}
            selected={selectedAttenderIds}
            onChange={setSelectedAttenderIds}
            placeholder="Attenders"
            allLabel="All Attenders"
          />

          <MultiSelect
            options={calledForOptions}
            selected={selectedCalledFors}
            onChange={setSelectedCalledFors}
            placeholder="Called For"
            allLabel="All Called For"
          />

          <MultiSelect
            options={statusOptions}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            placeholder="Status"
            allLabel="All Statuses"
          />

          <MultiSelect
            options={callTypeOptions}
            selected={selectedCallTypes}
            onChange={setSelectedCallTypes}
            placeholder="Call Type"
            allLabel="All Call Types"
          />

          <MultiSelect
            options={khojiStatusOptions}
            selected={selectedKhojiStatuses}
            onChange={setSelectedKhojiStatuses}
            placeholder="Khoji Status"
            allLabel="All Khoji Statuses"
          />
        </div>

        {/* Row 2: Controls & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-slate-400 text-xs font-medium">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />
            {(() => {
              const todayObj = new Date();
              const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
              const isTodaySelected = startDate === todayStr && endDate === todayStr;

              const yr = todayObj.getFullYear();
              const mn = todayObj.getMonth();
              const firstDayStr = `${yr}-${String(mn + 1).padStart(2, "0")}-01`;
              const lastDay = new Date(yr, mn + 1, 0).getDate();
              const lastDayStr = `${yr}-${String(mn + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
              const isThisMonthSelected = startDate === firstDayStr && endDate === lastDayStr;

              return (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => {
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isTodaySelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      setStartDate(firstDayStr);
                      setEndDate(lastDayStr);
                    }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isThisMonthSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    This Month
                  </button>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{allAttempts.length} entries</span>

            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setSelectedLeadOrigins([]);
                  setSelectedProgramIds([]);
                  setSelectedAttenderIds([]);
                  setSelectedSources([]);
                  setSelectedCalledFors([]);
                  setSelectedStatuses([]);
                  setSelectedCallTypes([]);
                  setSelectedKhojiStatuses([]);
                }}
                className="flex items-center gap-1 px-2.5 h-8 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-xs font-medium hover:bg-rose-100 transition cursor-pointer"
              >
                <X size={12} /> Clear filters
                <span className="bg-rose-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">{activeFilters}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium">Loading report datasets...</div>
      ) : (!startDate || !endDate || allAttempts.length === 0) ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium">No call history logs found for this period.</div>
      ) : (
        <>
          <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Average Daily Calls</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{metrics.avgCallsPerDay}</p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Calculated per active day</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Busiest Day Peak</p>
                <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={metrics.highestCallDay}>{metrics.highestCallDay}</p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Highest attempt volume</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unique Connected Calls</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{metrics.connectedCalls}</p>
              </div>
              <p className="text-[11px] text-emerald-600 font-medium mt-2">Successful responses</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Registrations</p>
                  <p className="text-2xl font-bold text-blue-600 tracking-tight mt-1">{programRegistrationsList.length}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectSearch("");
                    setInspectModalData({
                      title: "Total Program Registrations Audit",
                      subtitle: `Detailed view of all ${programRegistrationsList.length} canonical program registrations`,
                      items: programRegistrationsList
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-all shadow-2xs cursor-pointer"
                  title="Inspect Registrations List"
                >
                  <Eye size={14} />
                  <span>Inspect</span>
                </button>
              </div>
              <p className="text-[11px] text-blue-600 font-medium mt-2">Total program registrations by registration ID</p>
            </div>
          </div>

          {/* Collapsible Sections */}
          <MonthlySection
            title="Section 1: General KPIs Summary"
            action={
              <FormulaInfoPopover
                title="KPI Summary Information"
                formulas={[
                  {
                    label: "Connected Calls",
                    formula: "Calls with status: Info Given, Interested, Next Time, Reg.Done, Query, Not Interested, etc."
                  },
                  {
                    label: "Not Connected Calls",
                    formula: "Calls with status: Busy, Switched Off, Not Reachable, No Answer, Invalid Number, Wrong Number, etc."
                  }
                ]}
              />
            }
          >
            <MonthlyTable
              headers={["metric", "value"]}
              rows={section1}
              noScroll={true}
            />
          </MonthlySection>

          <MonthlySection
            title="Section 2: Called For vs Source Incoming & Outgoing Breakdown"
            subtitle={
              <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dimension:</span>
                <div className="inline-flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSourceDimension("currentSource")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      sourceDimension === "currentSource"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Current Source
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceDimension("leadOrigin")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      sourceDimension === "leadOrigin"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Lead Origin
                  </button>
                </div>
              </div>
            }
            action={
              <div className="flex items-center gap-2">
                {/* View Mode Toggle: Table View vs Graphical View */}
                <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setCalledForVsSourceView("table")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      calledForVsSourceView === "table"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="View as detailed data table"
                  >
                    <TableIcon size={13} />
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalledForVsSourceView("graph")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      calledForVsSourceView === "graph"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="View as graphical donut charts"
                  >
                    <PieChartIcon size={13} />
                    <span>Graphical View</span>
                  </button>
                </div>

                <FormulaInfoPopover
                  title="Called For vs Source Conversion Rate Formulas"
                  formulas={[
                    {
                      label: "Incoming Conversion Rate (%)",
                      formula: "(Incoming Conversions ÷ Incoming Calls) × 100",
                      note: "*Shows 0.0% if Incoming Calls = 0. Capped at 100.0%."
                    },
                    {
                      label: "Outgoing Conversion Rate (%)",
                      formula: "(Outgoing Conversions ÷ Outgoing Calls) × 100",
                      note: "*Shows 0.0% if Outgoing Calls = 0. Capped at 100.0%."
                    }
                  ]}
                />
              </div>
            }
          >
            {calledForVsSourceView === "table" ? (
              <MonthlyTable
                headers={["Called For", sourceDimension === "leadOrigin" ? "Lead Origin" : "Source", "Total Calls", "Incoming Calls", "Outgoing Calls", "Total Conversions", "Incoming Conversions", "Outgoing Conversions", "Incoming Conversion Rate (%)", "Outgoing Conversion Rate (%)"]}
                rows={calledForVsSourceBreakdown}
                totals={calledForVsSourceBreakdownTotals}
                onRowClick={(row, isTotal) => {
                  if (isTotal) {
                    setInspectModalData({
                      title: `All Section 2 Calls (${allAttempts.length})`,
                      subtitle: `Total Calls: ${calledForVsSourceBreakdownTotals["Total Calls"]} | Total Conversions: ${calledForVsSourceBreakdownTotals["Total Conversions"]}`,
                      category: "all",
                      items: allAttempts
                    });
                    return;
                  }
                  const items = (row._attempts && row._attempts.length > 0)
                    ? row._attempts
                    : (row._registrations || []);
                  setInspectModalData({
                    title: `Calls & Leads for "${row["Called For"]}" via "${row["Source"]}" (${items.length})`,
                    subtitle: `Total Calls: ${row["Total Calls"]} | Conversions: ${row["Total Conversions"]}`,
                    category: "all",
                    items: items
                  });
                }}
              />
            ) : (
              <div className="space-y-4">
                {/* Metric Selector Bar: Calls vs Registrations */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-100">
                  <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setGraphMetric("calls")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        graphMetric === "calls"
                          ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>📞 Total Calls</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                        graphMetric === "calls" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200/60 text-slate-600"
                      }`}>
                        {metrics.totalCalls || allAttempts.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphMetric("registrations")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        graphMetric === "registrations"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>🏆 Registrations (Conversions)</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                        graphMetric === "registrations" ? "bg-emerald-700 text-white" : "bg-slate-200/60 text-slate-600"
                      }`}>
                        {programRegistrationsList.length}
                      </span>
                    </button>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {graphMetric === "calls" 
                      ? "Showing call volume per called for broken down by source" 
                      : "Showing confirmed registrations per called for broken down by source"}
                  </span>
                </div>

                {(() => {
                  const isRegMode = graphMetric === "registrations";
                  const currentPieData = isRegMode ? calledForRegistrationPieData : calledForPieData;

                  return (
                    <>
                      {/* Grid of Donut Charts (One Circle per Called For) */}
                      {currentPieData.groups.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-medium text-xs">
                          {isRegMode 
                            ? "No registrations found for the selected period and filters." 
                            : "No call records found for the selected period and filters."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {currentPieData.groups.map(group => {
                            const countVal = isRegMode ? group.totalRegistrations : group.totalCalls;
                            const countUnit = isRegMode ? "Regs" : "Calls";
                            const itemsList = isRegMode ? group.registrations : group.attempts;
                            const itemsBySrc = isRegMode ? group.registrationsBySource : group.attemptsBySource;

                            return (
                              <div
                                key={group.calledFor}
                                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group relative hover:z-40"
                              >
                                {/* Card Header: Called For title & Inspect button */}
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-extrabold text-slate-800 text-xs truncate" title={group.calledFor}>
                                      {group.calledFor}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                      {group.sources.length} {group.sources.length === 1 ? "source channel" : "source channels"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setInspectModalData({
                                      title: `All ${isRegMode ? "Registrations" : "Calls"} for "${group.calledFor}"`,
                                      subtitle: `${countVal} total records`,
                                      items: itemsList
                                    })}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer shrink-0 ${
                                      isRegMode 
                                        ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100" 
                                        : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                                    }`}
                                    title={`Inspect all ${isRegMode ? "registrations" : "calls"} for this category`}
                                  >
                                    Inspect All
                                  </button>
                                </div>

                                {/* Donut Chart with Center Count */}
                                <div className="relative w-full h-[180px] flex items-center justify-center my-1">
                                  <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                      <Pie
                                        data={group.sources}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={46}
                                        outerRadius={68}
                                        paddingAngle={group.sources.length > 1 ? 2 : 0}
                                        onClick={(entry) => {
                                          if (entry && entry.name) {
                                            setInspectModalData({
                                              title: `${isRegMode ? "Registrations" : "Calls"} for "${group.calledFor}" via "${entry.name}"`,
                                              subtitle: `${itemsBySrc[entry.name]?.length || 0} matching records`,
                                              items: itemsBySrc[entry.name] || []
                                            });
                                          }
                                        }}
                                        className="cursor-pointer"
                                      >
                                        {group.sources.map(entry => (
                                          <Cell
                                            key={entry.name}
                                            fill={currentPieData.sourceColorMap[entry.name] || "#94a3b8"}
                                            className="hover:opacity-80 transition-opacity focus:outline-none"
                                          />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                                        content={({ active, payload }) => {
                                          if (active && payload && payload.length) {
                                            const d = payload[0];
                                            const pct = countVal ? ((d.value / countVal) * 100).toFixed(1) : 0;
                                            return (
                                              <div className="bg-white/95 backdrop-blur-sm text-slate-800 p-3 rounded-2xl shadow-xl border border-slate-200 text-xs min-w-[165px] ring-1 ring-slate-900/5">
                                                <div className="font-extrabold flex items-center gap-1.5 mb-2 text-slate-900">
                                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: d.payload?.fill }} />
                                                  <span className="truncate">{d.name}</span>
                                                </div>
                                                <div className="space-y-1">
                                                  <div className="text-slate-500 flex justify-between gap-4 py-0.5 text-[11px]">
                                                    <span>{isRegMode ? "Registrations:" : "Calls:"}</span>
                                                    <span className="font-bold text-slate-900 font-mono text-xs">{d.value}</span>
                                                  </div>
                                                  <div className="text-slate-500 flex justify-between gap-4 py-0.5 text-[11px]">
                                                    <span>Share:</span>
                                                    <span className={`font-bold font-mono text-xs ${isRegMode ? "text-emerald-600" : "text-indigo-600"}`}>{pct}%</span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>

                                  {/* Center of the circle: number of records */}
                                  <div
                                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10"
                                  >
                                    <span className="text-xl font-black text-slate-800 leading-none">{countVal}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{countUnit}</span>
                                  </div>
                                </div>

                                {/* Under the circle: Number of records & breakdown */}
                                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                  {isRegMode ? (
                                    <>
                                      <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px]">
                                        {group.totalRegistrations} Reg.Done
                                      </span>
                                      {group.convRate !== null ? (
                                        <span className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[11px]" title={`${group.totalRegistrations} registrations from ${group.totalCalls} calls`}>
                                          {group.convRate}% Conv.
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[10px]">No Calls</span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-slate-500 font-semibold text-[10px]">Total Volume</span>
                                      <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-xs">
                                        {group.totalCalls} Calls
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </MonthlySection>

          {/* Section 3: Source-wise Conversions & Calls Breakdown */}
          <MonthlySection
            title="Section 3: Source-wise Conversions & Calls Breakdown"
            subtitle={
              <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dimension:</span>
                <div className="inline-flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSourceDimension("currentSource")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      sourceDimension === "currentSource"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Current Source
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceDimension("leadOrigin")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      sourceDimension === "leadOrigin"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Lead Origin
                  </button>
                </div>
              </div>
            }
            action={
              <div className="flex items-center gap-2">
                {/* View Mode Toggle: Table View vs Graphical View vs Both */}
                <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setSourceWiseView("table")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      sourceWiseView === "table"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="View as detailed data table"
                  >
                    <TableIcon size={13} />
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceWiseView("graph")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      sourceWiseView === "graph"
                        ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="View as graphical charts"
                  >
                    <BarChart3 size={13} />
                    <span>Graph View</span>
                  </button>
                </div>

                <FormulaInfoPopover
                  title="Source Conversion Rate Formulas"
                  formulas={[
                    {
                      label: "Total Conversion Rate (%)",
                      formula: "(Total Conversions ÷ Total Calls) × 100",
                      note: "*Shows 0.0% if Total Calls = 0. Capped at 100.0%."
                    },
                    {
                      label: "Incoming Conversion Rate (%)",
                      formula: "(Incoming Conversions ÷ Incoming Calls) × 100",
                      note: "*Shows 0.0% if Incoming Calls = 0. Capped at 100.0%."
                    },
                    {
                      label: "Outgoing Conversion Rate (%)",
                      formula: "(Outgoing Conversions ÷ Outgoing Calls) × 100",
                      note: "*Shows 0.0% if Outgoing Calls = 0. Capped at 100.0%."
                    }
                  ]}
                />
              </div>
            }
          >
            <div className="space-y-6">
              {/* Graphical View (Donut Graphs) */}
              {sourceWiseView === "graph" && (
                <div className="pt-2">
                  {sourceWisePieData.convSlice.length === 0 && sourceWisePieData.callSlice.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium text-xs">
                      No source data available for the selected filters.
                    </div>
                  ) : (
                    /* Donut Charts side-by-side (Source Conversions, Called For Conversions, Source Calls) */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Left Donut: Total Conversions by Source */}
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Conversions by Source</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectModalData({
                                title: `All Source Conversions (${programRegistrationsList.length})`,
                                subtitle: `Total Conversions: ${sourceWiseBreakdownTotals["Total Conversions"]} (In: ${sourceWiseBreakdownTotals["Incoming Conversions"]} · Out: ${sourceWiseBreakdownTotals["Outgoing Conversions"]})`,
                                category: "registrations",
                                items: programRegistrationsList
                              });
                            }}
                            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer transition-colors"
                            title="Click to inspect all conversions"
                          >
                            {sourceWiseBreakdownTotals["Total Conversions"]} Regs • Inspect
                          </button>
                        </div>
                        <div className="relative w-full h-64 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={sourceWisePieData.convSlice}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={2}
                                onClick={(entry) => handleInspectSourceSlice(entry?.name, "conversions")}
                                className="cursor-pointer"
                              >
                                {sourceWisePieData.convSlice.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.color}
                                    onClick={() => handleInspectSourceSlice(entry?.name, "conversions")}
                                    style={{ cursor: "pointer" }}
                                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const d = payload[0];
                                  const fill = d.payload?.color || d.color || "#10b981";
                                  return (
                                    <div className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-xl border border-slate-200 text-xs min-w-[170px] pointer-events-none">
                                      <div className="font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fill }} />
                                        <span className="truncate">{d.name}</span>
                                      </div>
                                      <div className="flex justify-between items-baseline gap-3 pt-1 border-t border-slate-100">
                                        <span className="text-slate-500 font-medium">Conversions:</span>
                                        <span className="text-emerald-700 font-mono font-bold text-sm">
                                          {d.value} <span className="text-xs text-emerald-600 font-normal">({d.payload?.percentage}%)</span>
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
                            <span className="text-2xl font-black text-slate-800">
                              {sourceWiseBreakdownTotals["Total Conversions"]}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Regs
                            </span>
                          </div>
                        </div>
                        <div className="w-full flex flex-wrap gap-2 justify-center pt-2 border-t border-slate-200/60 max-h-24 overflow-y-auto">
                          {sourceWisePieData.convSlice.map(item => (
                            <div
                              key={item.name}
                              onClick={() => handleInspectSourceSlice(item.name, "conversions")}
                              className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                              title={`Click to inspect ${item.value} conversions for ${item.name}`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="font-medium truncate max-w-[100px]">{item.name}:</span>
                              <span className="font-bold text-slate-900 font-mono">{item.value} ({item.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Middle Donut: Called For-wise Conversions */}
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Conversions by Called For</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectModalData({
                                title: `All Program Conversions (${programRegistrationsList.length})`,
                                subtitle: `Total Conversions: ${calledForConversionPieData.totalCalledForConvs} confirmed registrations`,
                                category: "registrations",
                                items: programRegistrationsList
                              });
                            }}
                            className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 cursor-pointer transition-colors"
                            title="Click to inspect all program conversions"
                          >
                            {calledForConversionPieData.totalCalledForConvs} Regs • Inspect
                          </button>
                        </div>
                        <div className="relative w-full h-64 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={calledForConversionPieData.slices}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={2}
                                onClick={(entry) => handleInspectCalledForConversionSlice(entry?.name)}
                                className="cursor-pointer"
                              >
                                {calledForConversionPieData.slices.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.color}
                                    onClick={() => handleInspectCalledForConversionSlice(entry?.name)}
                                    style={{ cursor: "pointer" }}
                                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const d = payload[0];
                                  const fill = d.payload?.color || d.color || "#8b5cf6";
                                  return (
                                    <div className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-xl border border-slate-200 text-xs min-w-[170px] pointer-events-none">
                                      <div className="font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fill }} />
                                        <span className="truncate">{d.name}</span>
                                      </div>
                                      <div className="flex justify-between items-baseline gap-3 pt-1 border-t border-slate-100">
                                        <span className="text-slate-500 font-medium">Conversions:</span>
                                        <span className="text-purple-700 font-mono font-bold text-sm">
                                          {d.value} <span className="text-xs text-purple-600 font-normal">({d.payload?.percentage}%)</span>
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
                            <span className="text-2xl font-black text-slate-800">
                              {calledForConversionPieData.totalCalledForConvs}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Regs
                            </span>
                          </div>
                        </div>
                        <div className="w-full flex flex-wrap gap-2 justify-center pt-2 border-t border-slate-200/60 max-h-24 overflow-y-auto">
                          {calledForConversionPieData.slices.map(item => (
                            <div
                              key={item.name}
                              onClick={() => handleInspectCalledForConversionSlice(item.name)}
                              className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-purple-700 hover:bg-purple-50 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                              title={`Click to inspect ${item.value} conversions for ${item.name}`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="font-medium truncate max-w-[100px]">{item.name}:</span>
                              <span className="font-bold text-slate-900 font-mono">{item.value} ({item.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Donut: Total Calls by Source */}
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Call Volume Share by Source</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectModalData({
                                title: `All Source-wise Calls (${allAttempts.length})`,
                                subtitle: `Total Calls: ${sourceWiseBreakdownTotals["Total Calls"]} | Total Conversions: ${sourceWiseBreakdownTotals["Total Conversions"]}`,
                                category: "calls",
                                items: allAttempts
                              });
                            }}
                            className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 cursor-pointer transition-colors"
                            title="Click to inspect all calls"
                          >
                            {sourceWiseBreakdownTotals["Total Calls"]} Calls • Inspect
                          </button>
                        </div>
                        <div className="relative w-full h-64 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={sourceWisePieData.callSlice}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={2}
                                onClick={(entry) => handleInspectSourceSlice(entry?.name, "calls")}
                                className="cursor-pointer"
                              >
                                {sourceWisePieData.callSlice.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.color}
                                    onClick={() => handleInspectSourceSlice(entry?.name, "calls")}
                                    style={{ cursor: "pointer" }}
                                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const d = payload[0];
                                  const fill = d.payload?.color || d.color || "#6366f1";
                                  return (
                                    <div className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl shadow-xl border border-slate-200 text-xs min-w-[170px] pointer-events-none">
                                      <div className="font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fill }} />
                                        <span className="truncate">{d.name}</span>
                                      </div>
                                      <div className="flex justify-between items-baseline gap-3 pt-1 border-t border-slate-100">
                                        <span className="text-slate-500 font-medium">Call Volume:</span>
                                        <span className="text-indigo-700 font-mono font-bold text-sm">
                                          {d.value} <span className="text-xs text-indigo-600 font-normal">({d.payload?.percentage}%)</span>
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
                            <span className="text-2xl font-black text-slate-800">
                              {sourceWiseBreakdownTotals["Total Calls"]}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Calls
                            </span>
                          </div>
                        </div>
                        <div className="w-full flex flex-wrap gap-2 justify-center pt-2 border-t border-slate-200/60 max-h-24 overflow-y-auto">
                          {sourceWisePieData.callSlice.map(item => (
                            <div
                              key={item.name}
                              onClick={() => handleInspectSourceSlice(item.name, "calls")}
                              className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                              title={`Click to inspect ${item.value} calls for ${item.name}`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="font-medium truncate max-w-[100px]">{item.name}:</span>
                              <span className="font-bold text-slate-900 font-mono">{item.value} ({item.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Table View */}
              {sourceWiseView === "table" && (
                <div className="pt-2">
                  <MonthlyTable
                    headers={[
                      sourceDimension === "leadOrigin" ? "Lead Origin" : "Source",
                      "Total Calls",
                      "Incoming Calls",
                      "Outgoing Calls",
                      "Total Conversions",
                      "Incoming Conversions",
                      "Outgoing Conversions",
                      "Conversion Rate (%)",
                      "Incoming Conversion Rate (%)",
                      "Outgoing Conversion Rate (%)"
                    ]}
                    rows={sourceWiseBreakdown}
                    totals={sourceWiseBreakdownTotals}
                    onRowClick={(row, isTotal) => {
                      if (isTotal) {
                        setInspectModalData({
                          title: `All Source-wise Calls (${allAttempts.length})`,
                          subtitle: `Total Calls: ${sourceWiseBreakdownTotals["Total Calls"]} | Total Conversions: ${sourceWiseBreakdownTotals["Total Conversions"]}`,
                          category: "all",
                          items: allAttempts
                        });
                        return;
                      }
                      const items = (row._attempts && row._attempts.length > 0)
                        ? row._attempts
                        : (row._registrations || []);
                      const sName = row.Source || row["Lead Origin"];
                      setInspectModalData({
                        title: `Calls & Leads for Source "${sName}" (${items.length})`,
                        subtitle: `Total Calls: ${row["Total Calls"]} (Incoming: ${row["Incoming Calls"]}, Outgoing: ${row["Outgoing Calls"]}) | Conversions: ${row["Total Conversions"]}`,
                        category: "all",
                        items: items
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </MonthlySection>


          <MonthlySection
            title="🏆 Attender Productivity Leaderboard"
            action={
              <FormulaInfoPopover
                title="Attender Conversion Rate Formula"
                formulas={[
                  {
                    label: "Conversion Rate (%)",
                    formula: "(Reg.Done Conversions ÷ Attender Valid Responded Attempts*) × 100",
                    note: "*Valid Responded Attempts include: Reg.Done, Info Given, Interested, Next Time, Not Interested."
                  }
                ]}
              />
            }
          >
            {attenderPerformance.length === 0 ? (
              <div className="text-center py-6 text-slate-400 font-bold text-sm">No attender history logs found for this period.</div>
            ) : (
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-2 items-center">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-2">Attender Name</div>
                  <div className="col-span-3 text-center">Conversion Rate & Efficiency</div>
                  <div className="col-span-6 text-right pr-2">Metrics</div>
                </div>
                
                <div className="space-y-2.5">
                  {attenderPerformance.map((row, index) => {
                    const rank = index + 1;
                    const convRate = parseFloat(row["Conversion Rate (%)"]);
                    const isTop3 = rank <= 3;
                    const rankIcons = ["🥇", "🥈", "🥉"];
                    
                    return (
                      <div 
                        key={`${row["Attender Name"]}-${index}`} 
                        className={`grid grid-cols-1 md:grid-cols-12 items-center gap-4 px-6 py-4 rounded-3xl border transition-all ${
                          rank === 1 
                            ? "bg-amber-50/40 border-amber-100 shadow-sm" 
                            : rank === 2
                            ? "bg-slate-50/40 border-slate-100 shadow-sm"
                            : rank === 3
                            ? "bg-orange-50/40 border-orange-100 shadow-sm"
                            : "bg-white border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        {/* Rank */}
                        <div className="col-span-1 flex items-center font-bold text-sm text-slate-600">
                          {isTop3 ? (
                            <span className="text-2xl">{rankIcons[index]}</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 rounded-full w-7 h-7 flex items-center justify-center text-xs font-black">
                              #{rank}
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="col-span-2 font-black text-slate-800 text-base truncate" title={row["Attender Name"]}>
                          {row["Attender Name"]}
                        </div>

                        {/* Progress Bar & Conv Rate */}
                        <div className="col-span-3 flex items-center gap-2.5 pr-3 border-r border-slate-200/80">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                convRate > 20 
                                  ? "bg-emerald-500" 
                                  : convRate > 10 
                                  ? "bg-indigo-500" 
                                  : "bg-slate-400"
                              }`}
                              style={{ width: `${Math.min(convRate || 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-slate-700 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                            {row["Conversion Rate (%)"]}
                          </span>
                        </div>

                        {/* Metrics details */}
                        <div className="col-span-6 flex justify-between md:justify-end items-center gap-3 sm:gap-5 text-xs font-semibold text-slate-500 pl-2">
                          <div className="text-right min-w-[110px] shrink-0">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Conversions</span>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-sm font-black text-emerald-600 leading-none">{row["Reg.Done (Conversions)"]}</span>
                              {row["Team Assists"] > 0 && (
                                <span className="inline-flex items-center text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded whitespace-nowrap" title={`${row["Team Assists"]} team assist${row["Team Assists"] > 1 ? 's' : ''} (conversions on other owners' leads)`}>
                                  +{row["Team Assists"]} assist
                                </span>
                              )}
                            </div>
                            <span className="block text-[9px] font-semibold text-emerald-600/80 mt-0.5 whitespace-nowrap">
                              ({row["Incoming Conversions"]} In / {row["Outgoing Conversions"]} Out)
                            </span>
                          </div>
                          <div className="text-right min-w-[45px] shrink-0">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Incoming</span>
                            <span className="text-xs font-bold text-slate-700">{row["Incoming"]}</span>
                          </div>
                          <div className="text-right min-w-[45px] shrink-0">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Outgoing</span>
                            <span className="text-xs font-bold text-slate-700">{row["Outgoing"]}</span>
                          </div>
                          <div className="text-right min-w-[50px] shrink-0">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Connected</span>
                            <span className="text-xs font-bold text-slate-700">{row["Connected"]}</span>
                          </div>
                          <div className="text-right min-w-[40px] shrink-0 font-medium">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total</span>
                            <span className="text-xs font-extrabold text-slate-800">{row["Total Calls"]}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </MonthlySection>

          <MonthlySection title={`🏆 Registered & Converted Leads list (${conversionsList.length})`}>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
                <p className="text-xs text-gray-400">Leads whose call outcome in this period is marked as Registered/Reg.Done.</p>
                <div className="relative max-w-xs w-full">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search conversions..."
                    value={conversionSearch}
                    onChange={(e) => setConversionSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-sm bg-white">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["Name & Contact", "Attender", "Tag / Program", "Call Type", "Source / Called For", "Date & Time", "Remarks"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {paginatedConversions.map((c, idx) => {
                      const dateStr = c.timestamp instanceof Date && !isNaN(c.timestamp.getTime())
                        ? c.timestamp.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                        : "N/A";
                      const rawType = String(c.callType || c.callDirection || c.type || c.direction || "").toLowerCase().trim();
                      const isInc = rawType === "incoming" || rawType === "in" || rawType.includes("incoming") || rawType.includes("inbound");

                      return (
                        <tr 
                          key={idx} 
                          onClick={() => handleOpenLeadEdit(c)}
                          className="hover:bg-indigo-50/60 transition-colors cursor-pointer group"
                          title="Click to view & edit lead details"
                        >
                          {/* Name & Contact */}
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                              <span>{c.contactName || "Unnamed"}</span>
                              <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 font-normal transition-opacity">Edit →</span>
                            </div>
                            <div className="text-xs text-gray-400 font-medium">{c.contactPhone || "No Phone"}</div>
                          </td>
                          {/* Attender */}
                          <td className="px-6 py-4">
                            {c.isSharedConversion ? (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl">
                                    {c.leadOwnerName || c.attenderName}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200" title="Shared Lead Conversion">
                                    🏆 Shared
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1 pl-1">
                                  Converted by: <span className="font-semibold text-indigo-600">{c.convertedBy || c.convertingAttenderName || "Team"}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">
                                {c.attenderName}
                              </span>
                            )}
                          </td>
                          {/* Tag / Program */}
                          <td className="px-6 py-4">
                            <div className="text-gray-700 font-medium text-xs truncate max-w-[150px]">{c.programName}</div>
                            {c.contactTags && c.contactTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {c.contactTags.slice(0, 2).map((t, index) => (
                                  <span key={index} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold">
                                    {t}
                                  </span>
                                ))}
                                {c.contactTags.length > 2 && (
                                  <span className="text-[9px] text-gray-400">+{c.contactTags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </td>
                          {/* Call Type */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isInc ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-blue-100 text-blue-800 border border-blue-300"
                            }`}>
                              {isInc ? "Incoming (Inc)" : "Outgoing (Out)"}
                            </span>
                          </td>
                          {/* Source / Called For */}
                          <td className="px-6 py-4 text-xs text-gray-600">
                            <div className="font-medium text-gray-700">{sanitizeSource(c.source, "Unspecified")}</div>
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5">Called for: {sanitizeCalledFor(c.calledFor, "Unspecified")}</div>
                          </td>
                          {/* Date & Time */}
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {dateStr}
                          </td>
                          {/* Remarks */}
                          <td className="px-6 py-4">
                            <p className="text-xs text-gray-600 max-w-[200px] truncate" title={c.remark}>
                              {c.remark || <span className="text-gray-300 italic">No remarks</span>}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedConversions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400 font-medium bg-white">
                          No conversions match the current filters and search query in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalConvPages > 1 && (
                <div className="p-4 flex items-center justify-between bg-gray-50/50 rounded-2xl border border-gray-100">
                  <span className="text-xs text-gray-400 font-medium">
                    Showing {Math.min(searchedConversions.length, (convPage - 1) * convPerPage + 1)}-{Math.min(searchedConversions.length, convPage * convPerPage)} of {searchedConversions.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConvPage(p => Math.max(1, p - 1))}
                      disabled={convPage === 1}
                      className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-xs font-bold rounded-xl shadow-xs transition"
                    >
                      Previous
                    </button>
                    <span className="px-3 text-xs font-bold text-gray-600">
                      Page {convPage} of {totalConvPages}
                    </span>
                    <button
                      onClick={() => setConvPage(p => Math.min(totalConvPages, p + 1))}
                      disabled={convPage === totalConvPages}
                      className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-xs font-bold rounded-xl shadow-xs transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </MonthlySection>
        </div>

        {/* Inspect Registrations Modal */}
        {inspectModalData && createPortal(
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{inspectModalData.title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{inspectModalData.subtitle} • Click any row to view & edit lead</p>
              </div>
              <button
                type="button"
                onClick={handleCloseInspectModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                {/* Search Filter */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, phone, stage..."
                    value={inspectSearch}
                    onChange={(e) => setInspectSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                  />
                  {inspectSearch && (
                    <button
                      type="button"
                      onClick={() => setInspectSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Stage Filter */}
                <select
                  value={inspectStageFilter}
                  onChange={(e) => setInspectStageFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                >
                  <option value="ALL">All Stages ({inspectOptions.stages.length})</option>
                  {inspectOptions.stages.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Call Type Filter */}
                <select
                  value={inspectCallTypeFilter}
                  onChange={(e) => setInspectCallTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                >
                  <option value="ALL">All Call Types</option>
                  <option value="incoming">Incoming Only</option>
                  <option value="outgoing">Outgoing Only</option>
                </select>

                {/* Attender Filter */}
                {inspectOptions.attenders.length > 1 && (
                  <select
                    value={inspectAttenderFilter}
                    onChange={(e) => setInspectAttenderFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="ALL">All Attenders ({inspectOptions.attenders.length})</option>
                    {inspectOptions.attenders.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                )}

                {/* Program Filter */}
                {inspectOptions.programs.length > 1 && (
                  <select
                    value={inspectProgramFilter}
                    onChange={(e) => setInspectProgramFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="ALL">All Programs ({inspectOptions.programs.length})</option>
                    {inspectOptions.programs.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                {/* Reset Filters Button */}
                {(inspectSearch || inspectStageFilter !== "ALL" || inspectCallTypeFilter !== "ALL" || inspectAttenderFilter !== "ALL" || inspectProgramFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectSearch("");
                      setInspectStageFilter("ALL");
                      setInspectCallTypeFilter("ALL");
                      setInspectAttenderFilter("ALL");
                      setInspectProgramFilter("ALL");
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>

              <span className="text-xs font-bold text-slate-500 shrink-0">
                Showing {filteredInspectItems.length} of {inspectModalData.items?.length || 0}
              </span>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
                  <tr className="text-slate-700 font-bold bg-slate-100">
                    <th className="py-2.5 px-4 bg-slate-100">#</th>
                    <th className="py-2.5 px-4 bg-slate-100">Contact Name</th>
                    <th className="py-2.5 px-4 bg-slate-100">Phone</th>
                    <th className="py-2.5 px-4 bg-slate-100">Current Stage</th>
                    <th className="py-2.5 px-4 bg-slate-100">Program (Called For)</th>
                    <th className="py-2.5 px-4 bg-slate-100">Call Type</th>
                    <th className="py-2.5 px-4 bg-slate-100">Source</th>
                    <th className="py-2.5 px-4 bg-slate-100">Attender</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredInspectItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                        No records match the current search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInspectItems.map((item, idx) => {
                      const cType = String(item.callType || item.type || "").toLowerCase();
                      const isInc = cType === "incoming" || cType === "in" || cType.includes("incoming");
                      const stage = getItemStage(item);
                      return (
                        <tr 
                          key={idx} 
                          onClick={() => handleOpenLeadEdit(item)}
                          className="hover:bg-indigo-50/70 transition-colors cursor-pointer group"
                          title="Click to view & edit lead details"
                        >
                          <td className="py-2.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                            <div className="flex items-center justify-between gap-1">
                              <span>{item.contactName || "Unknown"}</span>
                              <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 font-normal transition-opacity">Edit →</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{item.contactPhone || "—"}</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStageBadgeClass(stage)}`}>
                              {stage}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-indigo-700">{sanitizeCalledFor(item.calledFor || item.programName, "—")}</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              isInc ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-blue-100 text-blue-800 border border-blue-300"
                            }`}>
                              {isInc ? "Incoming (Inc)" : "Outgoing (Out)"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{sanitizeSource(item.source, "—")}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-700">{item.attenderName || "Unassigned"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {filteredInspectItems.length} record{filteredInspectItems.length === 1 ? "" : "s"} shown
              </span>
              <button
                type="button"
                onClick={handleCloseInspectModal}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
        </>
      )}

      {/* Edit Lead Modal */}
      {selectedLeadForEdit && (
        <EditModal
          row={selectedLeadForEdit}
          attenderId="admin"
          attenderName="Admin"
          attenders={attenders}
          programs={programs}
          onClose={() => setSelectedLeadForEdit(null)}
          onSave={() => {
            setSelectedLeadForEdit(null);
          }}
        />
      )}

      {/* Custom Preset Builder Modal */}
      {isBuilderOpen && (
        <PresetBuilderModal
          presetToEdit={presetToEdit}
          contacts={callLogs}
          onClose={() => {
            setIsBuilderOpen(false);
            setPresetToEdit(null);
          }}
          onSaved={() => {
            setPresets(getAllPresets());
            setIsBuilderOpen(false);
            setPresetToEdit(null);
          }}
        />
      )}
    </div>
  );
}
