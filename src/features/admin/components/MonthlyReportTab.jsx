import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Download, ChevronRight, ChevronDown, Calendar, TrendingUp, UserCheck, Smile, Info, Search, X, Check
} from "lucide-react";
import { subscribeToAllCallLogs } from "../../../lib/db";
import { CONNECTED_STATUSES, NOT_CONNECTED_STATUSES, parseTimestamp, getCanonicalStatus, getContactPhone, getContactName, getContactCity, getContactKhoji, renderVal } from "../utils.jsx";
import { isKhojiAffirmative, isKhojiNegative } from "../../attender/utils.js";

const getLocalDateStr = (d = new Date()) => {
  const yr = d.getFullYear();
  const mn = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
};

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
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
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

function MonthlyTable({ headers, rows, totals, formatValue }) {
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-slate-200 shadow-2xs bg-white">
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
            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
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
                        ? "sticky left-0 bg-white font-semibold text-slate-800 z-10 border-r border-slate-100 shadow-r"
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
            <tr className="bg-slate-100/90 border-t-2 border-slate-200 font-bold text-slate-900 sticky bottom-0 z-20">
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
                        ? "sticky left-0 bg-slate-100 font-bold text-slate-900 z-30 border-r border-slate-200"
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
    src === "spiritual healing"
  );
};

export default function MonthlyReportTab({ programs, attenders = [], settingsOptions = { statusOptions: [], sourceOptions: [], calledForOptions: [] }, callLogs = [] }) {
  const [selectedProgramIds, setSelectedProgramIds] = useState([]); // empty = ALL
  const [selectedAttenderIds, setSelectedAttenderIds] = useState([]); // empty = ALL
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mn = String(d.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mn}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mn = d.getMonth();
    const lastDay = new Date(yr, mn + 1, 0).getDate();
    const mnStr = String(mn + 1).padStart(2, "0");
    return `${yr}-${mnStr}-${lastDay}`;
  });
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedCalledFors, setSelectedCalledFors] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCallTypes, setSelectedCallTypes] = useState([]);
  const [selectedKhojiStatuses, setSelectedKhojiStatuses] = useState([]);
  const [conversionSearch, setConversionSearch] = useState("");
  const [convPage, setConvPage] = useState(1);
  const loading = false;

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
    return programs.map(p => ({ value: p.id, label: p.name }));
  }, [programs]);

  const sourceOptions = React.useMemo(() => {
    const sources = new Set(settingsOptions?.sourceOptions || []);
    callLogs.forEach(log => {
      const sourceKey = Object.keys(log).find(k => ["source", "sourse", "source of information", "source of informiton"].includes(k.toLowerCase()));
      const val = sourceKey ? String(log[sourceKey] || "").trim() : "";
      if (val) sources.add(val);
    });
    return Array.from(sources).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const calledForOptions = React.useMemo(() => {
    const values = new Set();
    (settingsOptions?.calledForOptions || []).forEach(opt => {
      if (opt) {
        String(opt).split(",").map(s => s.trim()).filter(Boolean).forEach(v => values.add(v));
      }
    });
    callLogs.forEach(log => {
      const key = Object.keys(log).find(k => ["called for", "called_for", "calledfor"].includes(k.toLowerCase()));
      const val = key ? String(log[key] || "").trim() : "";
      if (val) {
        val.split(",").map(s => s.trim()).filter(Boolean).forEach(v => values.add(v));
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

  const allHistoricalAttempts = React.useMemo(() => {
    const attempts = [];
    callLogs.forEach(log => {
      if (log._deleted) return;

      // Multi-tag filter
      if (selectedProgramIds.length > 0) {
        const selectedNames = selectedProgramIds.map(id => {
          const p = programs.find(x => x.id === id);
          return p ? p.name : id;
        });
        const contactTags = Array.isArray(log.tags) ? log.tags : [];
        const matchesId = selectedProgramIds.includes(log.programId);
        const matchesName = selectedNames.includes(log.programId) || 
                            selectedNames.includes(log.programName) ||
                            contactTags.some(t => selectedNames.includes(t) || selectedProgramIds.includes(t));

        if (!matchesId && !matchesName) return;
      }

      // Source filter
      const sourceKey = Object.keys(log).find(k => ["source", "sourse", "source of information", "source of informiton"].includes(k.toLowerCase()));
      const sourceVal = sourceKey ? String(log[sourceKey] || "").trim() : "";
      if (selectedSources.length > 0 && !selectedSources.includes(sourceVal)) {
        return;
      }

      // Called For filter
      const calledForKey = Object.keys(log).find(k => ["called for", "called_for", "calledfor"].includes(k.toLowerCase()));
      const calledForVal = calledForKey ? String(log[calledForKey] || "").trim() : "";
      const logCalledFors = calledForVal.split(",").map(x => x.trim()).filter(Boolean);
      if (selectedCalledFors.length > 0 && !logCalledFors.some(cf => selectedCalledFors.includes(cf))) {
        return;
      }

      const feedbackKey = Object.keys(log).find(k => ["prog. feedback", "feedback", "user feedback", "program feedback"].includes(k.toLowerCase()));
      const feedbackVal = feedbackKey ? String(log[feedbackKey] || "").trim() : "";

      const contactName = getContactName(log);
      const contactPhone = getContactPhone(log);
      const contactCity = getContactCity(log);
      const khojiVal = getContactKhoji(log);
      const contactTags = Array.isArray(log.tags) ? log.tags : [];
      const programName = log.programName || "Unknown";

      const rawAttempts = [];
      const seenEventKeys = new Set();

      const addAttemptIfNew = (attId, attName, status, remark, dateVal, callType, calledFor, source, isHistory = false, index = 0) => {
        const canonicalStatus = getCanonicalStatus(status || "Pending");
        const ts = parseTimestamp(dateVal) || parseTimestamp(log.createdAt);
        if (!ts) return;

        const eventKey = isHistory
          ? `${log.id}_${attId}_h${index}_${canonicalStatus}`
          : `${log.id}_${attId}_latest_${canonicalStatus}`;
        if (seenEventKeys.has(eventKey)) return;
        seenEventKeys.add(eventKey);

        rawAttempts.push({
          timestamp: ts,
          attenderId: attId,
          attenderName: attName || "Unknown",
          status: canonicalStatus,
          remark: remark || "",
          callType: callType || "outgoing",
          calledFor: calledFor || "",
          source: source || ""
        });
      };

      // A. Collect from attenderStates
      if (log.attenderStates && typeof log.attenderStates === "object") {
        Object.entries(log.attenderStates).forEach(([attId, state]) => {
          if (!state) return;
          const stateAttName = state.attenderName || "Unknown";
          if (state.history && Array.isArray(state.history) && state.history.length > 0) {
            state.history.forEach((h, index) => {
              addAttemptIfNew(
                attId,
                h.attenderName || stateAttName,
                h.status || state.status,
                h.remark,
                h.timestamp || h.date || state.lastCalledAt,
                h.callType || state.callType,
                h.calledFor || state["Called For"] || state.calledFor,
                h.source || state.Source || state.source,
                true,
                index
              );
            });
          }
          if (state.lastCalledAt || (state.status && state.status !== "Pending") || state.remark) {
            addAttemptIfNew(
              attId,
              stateAttName,
              state.status,
              state.remark,
              state.lastCalledAt || log.createdAt,
              state.callType,
              state["Called For"] || state.calledFor,
              state.Source || state.source,
              false,
              0
            );
          }
        });
      }

      // B. Collect from top-level log.history
      if (log.history && Array.isArray(log.history) && log.history.length > 0) {
        log.history.forEach((h, index) => {
          addAttemptIfNew(
            h.attenderId || log.attenderId || "legacy",
            h.attenderName || log.attenderName || "Unknown",
            h.status,
            h.remark,
            h.timestamp || h.date || log.lastCalledAt || log.createdAt,
            h.callType || log.callType,
            h.calledFor || log["Called For"] || log.calledFor,
            h.source || log.Source || log.source,
            true,
            index
          );
        });
      }

      // C. Collect top-level log standalone call if no attempts were found in attenderStates/history
      if (rawAttempts.length === 0 && (log.lastCalledAt || (log.status && log.status !== "Pending") || log.remark)) {
        addAttemptIfNew(
          log.attenderId || "legacy",
          log.attenderName || "Legacy Attender",
          log.status,
          log.remark,
          log.lastCalledAt || log.createdAt,
          log.callType,
          log["Called For"] || log.calledFor,
          log.Source || log.source
        );
      }

      const totalContactCalls = rawAttempts.length;

      const processAttempt = (att) => {
        const status = getCanonicalStatus(att.status || "Pending");
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) {
          return null;
        }
        const finalCalledFor = att.calledFor || calledForVal;
        const attemptCalledFors = finalCalledFor.split(",").map(x => x.trim()).filter(Boolean);
        if (selectedCalledFors.length > 0 && !attemptCalledFors.some(cf => selectedCalledFors.includes(cf))) {
          return null;
        }

        const finalPhone = getContactPhone(log, att);
        const finalName = getContactName(log, att);
        const finalCity = getContactCity(log, att);
        const finalKhoji = getContactKhoji(log, att);

        return {
          ...att,
          status,
          contactName: finalName,
          contactPhone: finalPhone,
          contactCity: finalCity,
          contactTags,
          programName,
          contactId: log.id,
          source: att.source || sourceVal,
          calledFor: finalCalledFor,
          feedback: feedbackVal,
          Khoji: finalKhoji,
          totalContactCalls: totalContactCalls || 1
        };
      };

      rawAttempts.forEach(item => {
        const att = processAttempt(item);
        if (att) attempts.push(att);
      });
    });
    return attempts;
  }, [callLogs, selectedProgramIds, selectedSources, selectedCalledFors, selectedStatuses, programs]);



  const attenderOptions = React.useMemo(() => {
    return attenders.map(a => ({
      value: a.id,
      label: a.name
    }));
  }, [attenders]);

  const allAttempts = React.useMemo(() => {
    console.log(`[MonthlyReportTab DEBUG] total allHistoricalAttempts before date/attender filter:`, allHistoricalAttempts.length);
    const filtered = allHistoricalAttempts.filter(att => {
      if (!att.timestamp || isNaN(att.timestamp.getTime())) return false;
      const attDateStr = getLocalDateStr(att.timestamp);
      if (startDate && attDateStr < startDate) return false;
      if (endDate && attDateStr > endDate) return false;

      if (selectedAttenderIds.length > 0) {
        const matchesId = selectedAttenderIds.includes(att.attenderId);
        const selectedAttenderNames = selectedAttenderIds.map(id => {
          const a = attenders.find(x => x.id === id);
          return a ? a.name.toLowerCase().trim() : "";
        });
        const matchesName = selectedAttenderNames.includes((att.attenderName || "").toLowerCase().trim());
        if (!matchesId && !matchesName) return false;
      }

      // Call Type filter
      if (selectedCallTypes.length > 0) {
        const cType = (att.callType || "outgoing").toLowerCase();
        const matches = selectedCallTypes.some(t => {
          if (t === "incoming") return cType.startsWith("incoming");
          if (t === "outgoing") return cType.startsWith("outgoing");
          return false;
        });
        if (!matches) return false;
      }

      // Khoji Status filter
      if (selectedKhojiStatuses.length > 0) {
        const val = att.Khoji;
        const affirmative = isKhojiAffirmative(val);
        const isDew = String(val || "").toLowerCase().includes("dew d") || String(val || "").toLowerCase().includes("dewdrop");
        const isNo = isKhojiNegative(val) || !val;

        let match = false;
        if (selectedKhojiStatuses.includes("Yes") && affirmative && !isDew) match = true;
        if (selectedKhojiStatuses.includes("No") && isNo) match = true;
        if (selectedKhojiStatuses.includes("Dew drop khoji") && isDew) match = true;

        if (!match) return false;
      }

      return true;
    });

    return filtered;
  }, [allHistoricalAttempts, startDate, endDate, selectedAttenderIds, selectedCallTypes, selectedKhojiStatuses, attenders]);

  const monthFiltered = React.useMemo(() => {
    const contactIds = new Set(allAttempts.map(a => a.contactId));
    return callLogs.filter(log => contactIds.has(log.id));
  }, [callLogs, allAttempts]);

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

    allAttempts.forEach(c => {
      stats.totalCalls++;
      const isConnected = CONNECTED_STATUSES.includes(c.status);
      const isNotConnected = NOT_CONNECTED_STATUSES.includes(c.status);
      const type = (c.callType || "").toLowerCase();
      const isIncoming = type.startsWith("incoming");

      if (isConnected) {
        stats.connectedCalls++;
        if (isIncoming) {
          stats.incomingConnectedCalls++;
        } else {
          stats.outgoingConnectedCalls++;
        }
      } else if (isNotConnected) {
        stats.notConnectedCalls++;
        if (isIncoming) {
          stats.incomingNotConnectedCalls++;
        } else {
          stats.outgoingNotConnectedCalls++;
        }
      }

      if (c.status === "Reg.Done") {
        stats.totalConversions++;
        if (isIncoming) {
          stats.incomingConversions++;
        } else {
          stats.outgoingConversions++;
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
  }, [allAttempts]);

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
      { metric: "Direct Registrations / Conversions (Reg.Done)", value: metrics.totalConversions },
      { metric: "Incoming Conversions (Reg.Done)", value: metrics.incomingConversions },
      { metric: "Outgoing Conversions (Reg.Done)", value: metrics.outgoingConversions },
    ];
    const totalContactsInMonth = new Set(monthFiltered.map(l => l.id)).size;
    list.push({ metric: "Unique Leads Contacted", value: totalContactsInMonth });
    return list;
  }, [allAttempts, metrics, monthFiltered]);

  const attenderPerformance = React.useMemo(() => {
    const map = {};
    allAttempts.forEach(c => {
      if (!map[c.attenderId]) {
        map[c.attenderId] = { name: c.attenderName, total: 0, connected: 0, notConnected: 0, incoming: 0, outgoing: 0, conversions: 0, incomingConversions: 0, outgoingConversions: 0, denominator: 0 };
      }
      const item = map[c.attenderId];
      item.total++;
      if (CONNECTED_STATUSES.includes(c.status)) item.connected++;
      else if (NOT_CONNECTED_STATUSES.includes(c.status)) item.notConnected++;
      
      const type = (c.callType || "").toLowerCase();
      const isIncoming = type.startsWith("incoming");
      if (isIncoming) {
        item.incoming++;
      } else {
        item.outgoing++;
      }

      if (c.status === "Reg.Done") {
        item.conversions++;
        if (isIncoming) {
          item.incomingConversions++;
        } else {
          item.outgoingConversions++;
        }
      }
      
      item.denominator += getConversionDenominator(c.status);
    });

    return Object.values(map).map(a => ({
      "Attender Name": a.name,
      "Total Calls": a.total,
      "Connected": a.connected,
      "Not Connected": a.notConnected,
      "Incoming": a.incoming,
      "Outgoing": a.outgoing,
      "Reg.Done (Conversions)": a.conversions,
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
  }, [allAttempts]);

  const attenderPerformanceTotals = React.useMemo(() => {
    const totals = { 
      "Attender Name": "Total", 
      "Total Calls": 0, 
      "Connected": 0, 
      "Not Connected": 0, 
      "Incoming": 0, 
      "Outgoing": 0, 
      "Reg.Done (Conversions)": 0, 
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
      const src = String(c.source || "").trim() || "Unknown";
      const calledFors = String(c.calledFor || "").trim()
        ? String(c.calledFor).split(",").map(x => x.trim()).filter(Boolean)
        : ["Unknown"];

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
            incomingDenominator: 0, 
            outgoingDenominator: 0 
          };
        }
        const item = map[key];
        item.total++;
        
        const type = (c.callType || "").toLowerCase();
        const isIncoming = type.startsWith("incoming");
        
        if (isIncoming) {
          item.incoming++;
        } else {
          item.outgoing++;
        }

        const denom = getConversionDenominator(c.status);
        if (isIncoming) {
          item.incomingDenominator += denom;
        } else {
          item.outgoingDenominator += denom;
        }

        if (c.status === "Reg.Done") {
          item.conversions++;
          if (isIncoming) {
            item.incomingConversions++;
          } else {
            item.outgoingConversions++;
          }
        }
      });
    });

    const calledForTotals = {};
    const rows = Object.values(map).map(a => {
      const row = {
        "Called For": a.calledFor,
        "Source": a.source,
        "Total Calls": a.total,
        "Incoming Calls": a.incoming,
        "Outgoing Calls": a.outgoing,
        "Total Conversions": a.conversions,
        "Incoming Conversions": a.incomingConversions,
        "Outgoing Conversions": a.outgoingConversions,
        "Incoming Denominator": a.incomingDenominator,
        "Outgoing Denominator": a.outgoingDenominator,
        "Incoming Conversion Rate (%)": a.incomingDenominator ? `${((a.incomingConversions / a.incomingDenominator) * 100).toFixed(1)}%` : "0.0%",
        "Outgoing Conversion Rate (%)": a.outgoingDenominator ? `${((a.outgoingConversions / a.outgoingDenominator) * 100).toFixed(1)}%` : "0.0%"
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
  }, [allAttempts, selectedCalledFors]);

  const calledForVsSourceBreakdownTotals = React.useMemo(() => {
    const totals = { 
      "Called For": "Total", 
      "Source": "-", 
      "Total Calls": 0, 
      "Incoming Calls": 0, 
      "Outgoing Calls": 0, 
      "Total Conversions": 0, 
      "Incoming Conversions": 0,
      "Outgoing Conversions": 0,
      "Incoming Conversion Rate (%)": "0.0%", 
      "Outgoing Conversion Rate (%)": "0.0%" 
    };
    let totalIncomingDenominator = 0;
    let totalOutgoingDenominator = 0;
    calledForVsSourceBreakdown.forEach(row => {
      totals["Total Calls"] += row["Total Calls"];
      totals["Incoming Calls"] += row["Incoming Calls"];
      totals["Outgoing Calls"] += row["Outgoing Calls"];
      totals["Total Conversions"] += row["Total Conversions"];
      totals["Incoming Conversions"] += row["Incoming Conversions"];
      totals["Outgoing Conversions"] += row["Outgoing Conversions"];
      totalIncomingDenominator += row["Incoming Denominator"] || 0;
      totalOutgoingDenominator += row["Outgoing Denominator"] || 0;
    });
    totals["Incoming Conversion Rate (%)"] = totalIncomingDenominator ? `${((totals["Incoming Conversions"] / totalIncomingDenominator) * 100).toFixed(1)}%` : "0.0%";
    totals["Outgoing Conversion Rate (%)"] = totalOutgoingDenominator ? `${((totals["Outgoing Conversions"] / totalOutgoingDenominator) * 100).toFixed(1)}%` : "0.0%";
    return totals;
  }, [calledForVsSourceBreakdown]);

  const conversionsList = React.useMemo(() => {
    return allAttempts.filter(c => c.status === "Reg.Done");
  }, [allAttempts]);

  const searchedConversions = React.useMemo(() => {
    if (!conversionSearch.trim()) return conversionsList;
    const term = conversionSearch.toLowerCase();
    return conversionsList.filter(c => {
      return (
        (c.contactName || "").toLowerCase().includes(term) ||
        (c.contactPhone || "").toLowerCase().includes(term) ||
        (c.programName || "").toLowerCase().includes(term) ||
        (c.attenderName || "").toLowerCase().includes(term) ||
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
    if (!monthFiltered.length) {
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



    // Write file
    const startStr = startDate ? startDate.replace(/-/g, "") : "start";
    const endStr = endDate ? endDate.replace(/-/g, "") : "end";
    XLSX.writeFile(wb, `CallCenter_Report_${startStr}_to_${endStr}.xlsx`);
    toast.success("Excel analytics report downloaded successfully!");
  };

  const activeFilters = selectedProgramIds.length + selectedAttenderIds.length + selectedSources.length + selectedCalledFors.length + selectedStatuses.length + selectedCallTypes.length + selectedKhojiStatuses.length;

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
            disabled={!monthFiltered.length}
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
            options={sourceOptions}
            selected={selectedSources}
            onChange={setSelectedSources}
            placeholder="Source"
            allLabel="All Sources"
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
            <span className="text-xs text-slate-500 font-medium">{monthFiltered.length} entries</span>

            {activeFilters > 0 && (
              <button
                onClick={() => {
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
      ) : (!startDate || !endDate || monthFiltered.length === 0) ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium">No call history logs found for this period.</div>
      ) : (
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
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Direct Registrations</p>
                <p className="text-2xl font-bold text-blue-600 tracking-tight mt-1">{metrics.totalConversions}</p>
              </div>
              <p className="text-[11px] text-blue-600 font-medium mt-2">Period conversions</p>
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
            />
          </MonthlySection>

          <MonthlySection
            title="Section 2: Called For vs Source Incoming & Outgoing Breakdown"
            action={
              <FormulaInfoPopover
                title="Called For vs Source Conversion Rate Formulas"
                formulas={[
                  {
                    label: "Incoming Conversion Rate (%)",
                    formula: "(Incoming Conversions ÷ Incoming Valid Responded Attempts*) × 100"
                  },
                  {
                    label: "Outgoing Conversion Rate (%)",
                    formula: "(Outgoing Conversions ÷ Outgoing Valid Responded Attempts*) × 100",
                    note: "*Valid Responded Attempts include: Reg.Done, Info Given, Interested, Next Time, Not Interested."
                  }
                ]}
              />
            }
          >
            <MonthlyTable
              headers={["Called For", "Source", "Total Calls", "Incoming Calls", "Outgoing Calls", "Total Conversions", "Incoming Conversions", "Outgoing Conversions", "Incoming Conversion Rate (%)", "Outgoing Conversion Rate (%)"]}
              rows={calledForVsSourceBreakdown}
              totals={calledForVsSourceBreakdownTotals}
            />
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
                <div className="hidden md:grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-wider px-6 py-2">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-4">Attender Name</div>
                  <div className="col-span-4 text-center">Conversion Rate & Efficiency</div>
                  <div className="col-span-3 text-right">Metrics</div>
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
                        <div className="col-span-4 font-black text-slate-800 text-base">
                          {row["Attender Name"]}
                        </div>

                        {/* Progress Bar & Conv Rate */}
                        <div className="col-span-4 flex items-center gap-3">
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
                          <span className="text-sm font-black text-slate-700 whitespace-nowrap">
                            {row["Conversion Rate (%)"]}
                          </span>
                        </div>

                        {/* Metrics details */}
                        <div className="col-span-3 flex justify-between md:justify-end items-center gap-3 text-xs font-semibold text-slate-500">
                          <div className="text-right">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Conversions</span>
                            <span className="text-sm font-black text-emerald-600">{row["Reg.Done (Conversions)"]}</span>
                            <span className="block text-[9px] font-semibold text-emerald-500">({row["Incoming Conversions"]} In / {row["Outgoing Conversions"]} Out)</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Incoming</span>
                            <span className="text-xs font-bold text-slate-700">{row["Incoming"]}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Outgoing</span>
                            <span className="text-xs font-bold text-slate-700">{row["Outgoing"]}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Connected</span>
                            <span className="text-xs font-bold text-slate-700">{row["Connected"]}</span>
                          </div>
                          <div className="text-right font-medium">
                            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
                            <span className="text-xs font-bold text-slate-700">{row["Total Calls"]}</span>
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
                      {["Name & Contact", "Attender", "Tag / Program", "Source / Called For", "Date & Time", "User Feedback", "Remarks"].map(h => (
                        <th key={h} className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {paginatedConversions.map((c, idx) => {
                      const dateStr = c.timestamp instanceof Date && !isNaN(c.timestamp.getTime())
                        ? c.timestamp.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                        : "N/A";
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          {/* Name & Contact */}
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-800">{c.contactName || "Unnamed"}</div>
                            <div className="text-xs text-gray-400 font-medium">{c.contactPhone || "No Phone"}</div>
                          </td>
                          {/* Attender */}
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">
                              👤 {c.attenderName}
                            </span>
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
                          {/* Source / Called For */}
                          <td className="px-6 py-4 text-xs text-gray-600">
                            <div className="font-medium text-gray-700">{c.source || "N/A"}</div>
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5">Called for: {c.calledFor || "N/A"}</div>
                          </td>
                          {/* Date & Time */}
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {dateStr}
                          </td>
                          {/* User Feedback */}
                          <td className="px-6 py-4">
                            <p className="text-xs text-gray-600 max-w-[200px] truncate" title={c.feedback}>
                              {c.feedback || <span className="text-gray-300 italic">No feedback</span>}
                            </p>
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
      )}
    </div>
  );
}
