import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Download, Calendar, TrendingUp, UserCheck, Smile, Info, Search, X, ChevronDown, Check, ChevronRight, RotateCw
} from "lucide-react";
import { CONNECTED_STATUSES, getContactKhoji, renderVal } from "../utils.jsx";

function ReportSection({ title, subtitle, badge, action, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer select-none bg-slate-50/40 border-b border-slate-200/60"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">{title}</h3>
            {badge && (
              <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-semibold border border-indigo-100/80">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 font-normal">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {action}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      {isOpen && <div className="p-4 bg-white space-y-3">{children}</div>}
    </div>
  );
}

// ── Formula Info Popover ──────────────────────────────────────────────────────
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

// ── Multi-select dropdown component ──────────────────────────────────────────
function MultiSelect({ options, selected, onChange, placeholder, allLabel = "All" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

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

// Helper to parse dates in a robust way (handling Firestore Timestamps, ISO strings, Date objects, string formats, etc.)
const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val.toDate === "function") return val.toDate();
  if (val.seconds !== undefined) return new Date(val.seconds * 1000);
  if (typeof val === "object" && val !== null && (val._methodName === "serverTimestamp" || val.operand?.toFieldTransform)) {
    return new Date();
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (trimmed.includes("/")) {
      const parts = trimmed.split(/[/ :]/);
      if (parts.length >= 3) {
        const [d, m, y] = parts.map(Number);
        if (y && m && d) return new Date(y, m - 1, d);
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Option 3: Primary Assigned Attender Priority Helper (Assigned Lead Owner Priority)
export const getRegistrationPrimaryAttender = (r) => {
  if (!r) return "Direct / Online";

  // 1. Check convertedBy first (the attender who performed the registration/conversion)
  if (r.convertedBy && String(r.convertedBy).trim() && String(r.convertedBy).trim() !== "Unknown" && String(r.convertedBy).trim() !== "Unassigned") {
    return String(r.convertedBy).trim();
  }

  // 2. Check assigned lead owner (attenderName, assignedTo, assignedAttender, attender)
  const assigned = r.attenderName || r.assignedTo || r.assignedAttender || r.attender;
  if (assigned && String(assigned).trim() && String(assigned).trim() !== "Unknown" && String(assigned).trim() !== "Unassigned") {
    return String(assigned).trim();
  }

  // 3. Look back at prior call history array to find the primary nurturer
  if (Array.isArray(r.history) && r.history.length > 0) {
    for (let i = 0; i < r.history.length; i++) {
      const h = r.history[i];
      const hAttender = h.convertedBy || h.attenderName || h.user || h.attender;
      if (hAttender && String(hAttender).trim() && String(hAttender).trim() !== "Unknown" && String(hAttender).trim() !== "Unassigned") {
        return String(hAttender).trim();
      }
    }
  }

  return "Direct / Online";
};

// Lead Owner helper specifically for identifying the original assigned owner (nurturer) vs assisting converter
export const getRegistrationLeadOwner = (r) => {
  if (!r) return "Direct / Online";
  const assigned = r.attenderName || r.assignedTo || r.assignedAttender || r.attender;
  if (assigned && String(assigned).trim() && String(assigned).trim() !== "Unknown" && String(assigned).trim() !== "Unassigned") {
    return String(assigned).trim();
  }
  if (Array.isArray(r.history) && r.history.length > 0) {
    for (let i = 0; i < r.history.length; i++) {
      const h = r.history[i];
      const hAttender = h.attenderName || h.user || h.attender;
      if (hAttender && String(hAttender).trim() && String(hAttender).trim() !== "Unknown" && String(hAttender).trim() !== "Unassigned") {
        return String(hAttender).trim();
      }
    }
  }
  return "Direct / Online";
};

// ── Main AbhivyaktiTab Component ──────────────────────────────────────────────
export default function AbhivyaktiTab({
  registrations = [],
  loading = false
}) {
  // Local filter states
  const [selectedCallTypes, setSelectedCallTypes] = useState([]);
  const [selectedCalledFors, setSelectedCalledFors] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedAttenders, setSelectedAttenders] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const todayObj = new Date();
    const yr = todayObj.getFullYear();
    const mn = String(todayObj.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mn}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const todayObj = new Date();
    const yr = todayObj.getFullYear();
    const mn = todayObj.getMonth();
    const lastDay = new Date(yr, mn + 1, 0).getDate();
    const mnStr = String(mn + 1).padStart(2, "0");
    return `${yr}-${mnStr}-${lastDay}`;
  });

  // Derived filter options from registrations data
  const callTypeOptions = useMemo(() => {
    const set = new Set();
    registrations.forEach(r => {
      if (r.callType) set.add(r.callType);
    });
    return Array.from(set).sort().map(val => ({
      value: val,
      label: val.charAt(0).toUpperCase() + val.slice(1)
    }));
  }, [registrations]);

  const calledForOptions = useMemo(() => {
    const set = new Set();
    registrations.forEach(r => {
      const val = r.calledFor || r["Called For"];
      if (val) {
        String(val).split(",").map(s => s.trim()).filter(Boolean).forEach(v => set.add(v));
      }
    });
    return Array.from(set).sort().map(val => ({ value: val, label: val }));
  }, [registrations]);

  const sourceOptions = useMemo(() => {
    const set = new Set();
    registrations.forEach(r => {
      const val = r.conversionSource || r.Source || r.source;
      if (val) set.add(String(val).trim());
    });
    return Array.from(set).sort().map(val => ({ value: val, label: val }));
  }, [registrations]);

  const attenderOptions = useMemo(() => {
    const set = new Set();
    registrations.forEach(r => {
      const val = getRegistrationPrimaryAttender(r);
      set.add(String(val).trim());
    });
    return Array.from(set).sort().map(val => ({ value: val, label: val }));
  }, [registrations]);

  // Apply filters to calculate filteredRegistrations
  const filteredRegistrations = useMemo(() => {
    const res = registrations.filter(r => {
      if (r._deleted) return false;

      // 1. Call Type Filter
      if (selectedCallTypes.length > 0 && !selectedCallTypes.includes(r.callType)) {
        return false;
      }

      // 2. Called For Filter
      if (selectedCalledFors.length > 0) {
        const rCalledFor = r.calledFor || r["Called For"];
        const rCalledFors = rCalledFor ? String(rCalledFor).split(",").map(s => s.trim()).filter(Boolean) : [];
        if (!rCalledFors.some(cf => selectedCalledFors.includes(cf))) return false;
      }

      // 3. Source Filter
      const rSource = r.conversionSource || r.Source || r.source;
      if (selectedSources.length > 0 && (!rSource || !selectedSources.includes(String(rSource).trim()))) {
        return false;
      }

      // 4. Attender Filter (Assigned Lead Owner Priority)
      const rAttender = getRegistrationPrimaryAttender(r);
      if (selectedAttenders.length > 0 && !selectedAttenders.includes(String(rAttender).trim())) {
        return false;
      }

      // 5. Date Range Filter
      if (dateFrom || dateTo) {
        const d = parseDate(r.registeredAt) || parseDate(r.createdAt);
        if (!d || isNaN(d.getTime())) return false;
        
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dStr = `${y}-${m}-${day}`;
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
      }

      return true;
    });

    console.log("[ABHIVYAKTI FILTERED REGS TRACE]", {
      totalInputRegistrations: registrations.length,
      filteredRegistrationsCount: res.length,
      attendersFound: Array.from(new Set(registrations.map(r => getRegistrationPrimaryAttender(r)))),
      dateFrom,
      dateTo
    });

    return res;
  }, [registrations, selectedCallTypes, selectedCalledFors, selectedSources, selectedAttenders, dateFrom, dateTo]);

  // Active filters count
  const activeFilters = selectedCallTypes.length + selectedCalledFors.length + selectedSources.length + selectedAttenders.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const metrics = useMemo(() => {
    const stats = {
      totalRegistrations: filteredRegistrations.length,
      avgPerDay: 0,
      highestDay: "-",
      totalAttenderAssisted: 0,
      conversionRate: "0.0%"
    };

    const dayMap = {};
    filteredRegistrations.forEach(r => {
      const d = parseDate(r.registeredAt) || parseDate(r.createdAt);
      if (d) {
        const dStr = d.toLocaleDateString("en-IN");
        dayMap[dStr] = (dayMap[dStr] || 0) + 1;
      }
      const hasRealAttender = (r.convertedBy && r.convertedBy !== "Unknown") || (r.attenderName && r.attenderName !== "Unknown");
      if (hasRealAttender) {
        stats.totalAttenderAssisted++;
      }
    });

    const dayCounts = Object.values(dayMap);
    if (dayCounts.length > 0) {
      stats.avgPerDay = Math.round(dayCounts.reduce((a, b) => a + b, 0) / dayCounts.length);
      const sorted = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
      stats.highestDay = `${sorted[0][0]} (${sorted[0][1]} regs)`;
    }

    return stats;
  }, [filteredRegistrations]);

  const section1 = useMemo(() => {
    return [
      { metric: "Total Registrations Count", value: metrics.totalRegistrations },
      { metric: "Average Registrations Per Day", value: metrics.avgPerDay },
      { metric: "Attender Assisted Conversions", value: metrics.totalAttenderAssisted },
      { metric: "Direct Online / Unassisted Registrations", value: metrics.totalRegistrations - metrics.totalAttenderAssisted }
    ];
  }, [metrics]);

  const sourceBreakdown = useMemo(() => {
    const map = {};
    let total = 0;
    filteredRegistrations.forEach(r => {
      const src = r.conversionSource || r.Source || "Online/Direct";
      map[src] = (map[src] || 0) + 1;
      total++;
    });
    return Object.entries(map).map(([src, count]) => ({
      "Registration Source": src,
      "Count": count,
      "Percentage (%)": total ? `${((count / total) * 100).toFixed(1)}%` : "0.0%"
    })).sort((a, b) => b.Count - a.Count);
  }, [filteredRegistrations]);

  const dayWiseTimeline = useMemo(() => {
    const map = {};
    filteredRegistrations.forEach(r => {
      const d = parseDate(r.registeredAt) || parseDate(r.createdAt);
      if (!d) return;
      const dStr = d.toLocaleDateString("en-IN");
      if (!map[dStr]) {
        map[dStr] = { date: dStr, total: 0, assisted: 0, direct: 0 };
      }
      map[dStr].total++;
      const hasRealAttender = (r.convertedBy && r.convertedBy !== "Unknown") || (r.attenderName && r.attenderName !== "Unknown");
      if (hasRealAttender) map[dStr].assisted++;
      else map[dStr].direct++;
    });

    const allDates = Array.from(new Set(filteredRegistrations.map(r => {
      const d = parseDate(r.registeredAt) || parseDate(r.createdAt);
      return d ? d.toLocaleDateString("en-IN") : null;
    }).filter(Boolean))).sort((a, b) => {
      const [da, ma, ya] = a.split("/").map(Number);
      const [db, mb, yb] = b.split("/").map(Number);
      return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
    });

    const list = [];
    allDates.forEach(dStr => {
      const data = map[dStr] || { date: dStr, total: 0, assisted: 0, direct: 0 };
      list.push({
        "Date": dStr,
        "Total Registrations": data.total,
        "Attender Assisted": data.assisted,
        "Direct Online": data.direct
      });
    });
    return list;
  }, [filteredRegistrations]);

  const dayWiseTotals = useMemo(() => {
    const totals = { "Date": "Total", "Total Registrations": 0, "Attender Assisted": 0, "Direct Online": 0 };
    dayWiseTimeline.forEach(row => {
      totals["Total Registrations"] += row["Total Registrations"];
      totals["Attender Assisted"] += row["Attender Assisted"];
      totals["Direct Online"] += row["Direct Online"];
    });
    return totals;
  }, [dayWiseTimeline]);

  const attenderPerformance = useMemo(() => {
    const map = {};
    filteredRegistrations.forEach(r => {
      const primaryName = getRegistrationPrimaryAttender(r);

      // Primary credit to Lead Owner
      if (!primaryName || primaryName === "Unknown" || primaryName === "Direct / Online") return;
      if (!map[primaryName]) {
        map[primaryName] = {
          name: primaryName,
          incomingConversions: 0,
          outgoingConversions: 0,
          count: 0,
          incomingConnected: 0,
          outgoingConnected: 0
        };
      }
      const callType = (r.callType || "").toLowerCase();
      const isIncoming = callType.startsWith("incoming");

      if (isIncoming) {
        map[primaryName].incomingConversions++;
      } else {
        map[primaryName].outgoingConversions++;
      }
      map[primaryName].count++;

      const rStatus = r.status || r.callStatus || "Reg.Done";
      const isRConnected = CONNECTED_STATUSES.includes(rStatus);

      let historyIncConn = 0;
      let historyOutConn = 0;
      if (Array.isArray(r.history) && r.history.length > 0) {
        r.history.forEach(h => {
          const hType = (h.callType || h.type || callType).toLowerCase();
          const hStatus = h.status || h.callStatus || rStatus;
          if (CONNECTED_STATUSES.includes(hStatus)) {
            if (hType.startsWith("incoming")) historyIncConn++;
            else historyOutConn++;
          }
        });
      }

      if (historyIncConn === 0 && isIncoming && isRConnected) historyIncConn = 1;
      if (historyOutConn === 0 && !isIncoming && isRConnected) historyOutConn = 1;

      map[primaryName].incomingConnected += Math.max(historyIncConn, isIncoming ? 1 : 0);
      map[primaryName].outgoingConnected += Math.max(historyOutConn, !isIncoming ? 1 : 0);
    });

    return Object.values(map).map(a => {
      const incConn = a.incomingConnected;
      const outConn = a.outgoingConnected;
      const totalConn = incConn + outConn;

      const incRateNum = incConn > 0 ? (a.incomingConversions / incConn) * 100 : 0;
      const outRateNum = outConn > 0 ? (a.outgoingConversions / outConn) * 100 : 0;
      const totalRateNum = totalConn > 0 ? (a.count / totalConn) * 100 : 0;

      return {
        "Attender Name": a.name,
        "Incoming Conversions": a.incomingConversions,
        "Incoming Connected": incConn,
        "Incoming Conversion Rate (%)": `${incRateNum.toFixed(1)}%`,
        "Outgoing Conversions": a.outgoingConversions,
        "Outgoing Connected": outConn,
        "Outgoing Conversion Rate (%)": `${outRateNum.toFixed(1)}%`,
        "Total Conversions": a.count,
        "Total Connected": totalConn,
        "Overall Conversion Rate (%)": `${totalRateNum.toFixed(1)}%`
      };
    }).sort((a, b) => b["Total Conversions"] - a["Total Conversions"]);
  }, [filteredRegistrations]);

  const attenderPerformanceTotals = useMemo(() => {
    const totals = {
      "Attender Name": "Total Assisted",
      "Incoming Conversions": 0,
      "Incoming Connected": 0,
      "Incoming Conversion Rate (%)": "0.0%",
      "Outgoing Conversions": 0,
      "Outgoing Connected": 0,
      "Outgoing Conversion Rate (%)": "0.0%",
      "Total Conversions": 0,
      "Total Connected": 0,
      "Overall Conversion Rate (%)": "0.0%"
    };
    attenderPerformance.forEach(row => {
      totals["Incoming Conversions"] += row["Incoming Conversions"];
      totals["Incoming Connected"] += row["Incoming Connected"];
      totals["Outgoing Conversions"] += row["Outgoing Conversions"];
      totals["Outgoing Connected"] += row["Outgoing Connected"];
      totals["Total Conversions"] += row["Total Conversions"];
      totals["Total Connected"] += row["Total Connected"];
    });

    const incRate = totals["Incoming Connected"] > 0
      ? ((totals["Incoming Conversions"] / totals["Incoming Connected"]) * 100).toFixed(1)
      : "0.0";
    const outRate = totals["Outgoing Connected"] > 0
      ? ((totals["Outgoing Conversions"] / totals["Outgoing Connected"]) * 100).toFixed(1)
      : "0.0";
    const totalRate = totals["Total Connected"] > 0
      ? ((totals["Total Conversions"] / totals["Total Connected"]) * 100).toFixed(1)
      : "0.0";

    totals["Incoming Conversion Rate (%)"] = `${incRate}%`;
    totals["Outgoing Conversion Rate (%)"] = `${outRate}%`;
    totals["Overall Conversion Rate (%)"] = `${totalRate}%`;

    return totals;
  }, [attenderPerformance]);

  // Separate Breakdown Table for Shared Conversions (Team Assists)
  const sharedConversionsBreakdown = useMemo(() => {
    const map = {};
    filteredRegistrations.forEach(r => {
      const primaryOwner = getRegistrationLeadOwner(r);
      const finalRegistrar = (r.convertedBy || "").trim();

      if (
        finalRegistrar &&
        finalRegistrar !== "Unknown" &&
        finalRegistrar !== "Direct / Online" &&
        primaryOwner &&
        primaryOwner !== "Unknown" &&
        primaryOwner !== "Direct / Online" &&
        finalRegistrar !== primaryOwner
      ) {
        const key = `${finalRegistrar}__${primaryOwner}`;
        if (!map[key]) {
          map[key] = {
            assistant: finalRegistrar,
            primaryOwner: primaryOwner,
            count: 0
          };
        }
        map[key].count++;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredRegistrations]);

  // Breakdown table for Called For + Attender Name + Khoji Type + Call Type (Incoming/Outgoing) + Conversions Count
  const calledForAttenderBreakdown = useMemo(() => {
    const map = {};
    filteredRegistrations.forEach(r => {
      const rawCalledFor = r.calledFor || r["Called For"];
      const calledForTags = rawCalledFor
        ? String(rawCalledFor).split(",").map(s => s.trim()).filter(Boolean)
        : ["Unspecified"];
      if (calledForTags.length === 0) calledForTags.push("Unspecified");

      const attender = getRegistrationPrimaryAttender(r);
      const khoji = getContactKhoji(r) || "No";
      const callType = (r.callType || "").toLowerCase();
      const isIncoming = callType.startsWith("incoming");

      calledForTags.forEach(tag => {
        const key = `${attender}___${tag}___${khoji}`;
        if (!map[key]) {
          map[key] = {
            calledFor: tag,
            attenderName: attender,
            khojiType: khoji,
            incomingConversions: 0,
            outgoingConversions: 0,
            total: 0
          };
        }
        const item = map[key];
        if (isIncoming) {
          item.incomingConversions++;
        } else {
          item.outgoingConversions++;
        }
        item.total++;
      });
    });

    return Object.values(map)
      .map(item => ({
        "Converted By (Attender)": item.attenderName,
        "Called For": item.calledFor,
        "Khoji Type": item.khojiType,
        "Incoming Conversions": item.incomingConversions,
        "Outgoing Conversions": item.outgoingConversions,
        "Total Conversions": item.total
      }))
      .sort((a, b) => {
        const attenderComp = a["Converted By (Attender)"].localeCompare(b["Converted By (Attender)"]);
        if (attenderComp !== 0) return attenderComp;
        const cfComp = a["Called For"].localeCompare(b["Called For"]);
        if (cfComp !== 0) return cfComp;
        const khojiComp = a["Khoji Type"].localeCompare(b["Khoji Type"]);
        if (khojiComp !== 0) return khojiComp;
        return b["Total Conversions"] - a["Total Conversions"];
      });
  }, [filteredRegistrations]);

  const calledForAttenderTotals = useMemo(() => {
    const totals = {
      "Converted By (Attender)": "Total",
      "Called For": "-",
      "Khoji Type": "-",
      "Incoming Conversions": 0,
      "Outgoing Conversions": 0,
      "Total Conversions": 0
    };
    calledForAttenderBreakdown.forEach(row => {
      totals["Incoming Conversions"] += row["Incoming Conversions"];
      totals["Outgoing Conversions"] += row["Outgoing Conversions"];
      totals["Total Conversions"] += row["Total Conversions"];
    });
    return totals;
  }, [calledForAttenderBreakdown]);

  // Grouped breakdown by attender with per-attender totals
  const groupedCalledForAttender = useMemo(() => {
    const attenderMap = new Map();
    calledForAttenderBreakdown.forEach(row => {
      const attender = row["Converted By (Attender)"];
      if (!attenderMap.has(attender)) {
        attenderMap.set(attender, {
          attenderName: attender,
          rows: [],
          totalIncoming: 0,
          totalOutgoing: 0,
          totalConversions: 0
        });
      }
      const group = attenderMap.get(attender);
      group.rows.push(row);
      group.totalIncoming += row["Incoming Conversions"];
      group.totalOutgoing += row["Outgoing Conversions"];
      group.totalConversions += row["Total Conversions"];
    });
    return Array.from(attenderMap.values());
  }, [calledForAttenderBreakdown]);

  const handleExport = () => {
    if (!filteredRegistrations.length) {
      toast.error("No registration data to export.");
      return;
    }
    const wb = XLSX.utils.book_new();

    // 1. Raw Data
    const rows = filteredRegistrations.map(r => {
      const nameVal = r.Name || r.name || "Unknown";
      const phoneVal = r.Phone || r.phone || "";
      const mobileVal = r.Mobile || r.mobile || "";
      const attenderVal = getRegistrationPrimaryAttender(r);
      const callsDoneVal = r.callCount !== undefined ? r.callCount : (r.history ? r.history.length : 0);
      const calledForVal = r.calledFor || r["Called For"] || "";
      const khojiVal = getContactKhoji(r) || "No";
      const sourceVal = r.conversionSource || r.Source || r.source || "";
      const callTypeVal = r.callType || "";

      return {
        "Name": nameVal,
        "Phone Number": phoneVal,
        "Mobile Number": mobileVal,
        "Attender Name": attenderVal,
        "Calls Done": callsDoneVal,
        "Called For": calledForVal,
        "Khoji Type": khojiVal,
        "Source": sourceVal,
        "Call Type": callTypeVal
      };
    });
    const wsRaw = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsRaw, "Registrations List");

    // 2. Summary
    const wsSummary = XLSX.utils.json_to_sheet(section1);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary KPI");

    // 3. Source Breakdown
    const wsSource = XLSX.utils.json_to_sheet(sourceBreakdown);
    XLSX.utils.book_append_sheet(wb, wsSource, "Source Distribution");

    // 4. Day-wise Timeline
    const wsDay = XLSX.utils.json_to_sheet([...dayWiseTimeline, dayWiseTotals]);
    XLSX.utils.book_append_sheet(wb, wsDay, "Day-wise Timeline");

    // 5. Attender performance
    const wsAttenders = XLSX.utils.json_to_sheet([...attenderPerformance, attenderPerformanceTotals]);
    XLSX.utils.book_append_sheet(wb, wsAttenders, "Attender Breakdown");

    // 6. Called For & Attender Breakdown (With Attender Subtotals)
    const calledForAttenderExportRows = [];
    groupedCalledForAttender.forEach(group => {
      group.rows.forEach(r => {
        calledForAttenderExportRows.push({ ...r });
      });
      calledForAttenderExportRows.push({
        "Converted By (Attender)": `Total for ${group.attenderName}`,
        "Called For": "",
        "Khoji Type": "",
        "Incoming Conversions": group.totalIncoming,
        "Outgoing Conversions": group.totalOutgoing,
        "Total Conversions": group.totalConversions
      });
    });
    calledForAttenderExportRows.push({ ...calledForAttenderTotals });

    const wsCalledForAttender = XLSX.utils.json_to_sheet(calledForAttenderExportRows);
    XLSX.utils.book_append_sheet(wb, wsCalledForAttender, "Called For & Attender");

    // 7. Team Assists Sheet
    if (sharedConversionsBreakdown.length > 0) {
      const wsShared = XLSX.utils.json_to_sheet(sharedConversionsBreakdown.map(item => ({
        "Assisting Attender (Final Call)": item.assistant,
        "Primary Lead Owner (Nurturer)": item.primaryOwner,
        "Shared Registrations Finalized": item.count
      })));
      XLSX.utils.book_append_sheet(wb, wsShared, "Team Assists");
    }

    XLSX.writeFile(wb, `Abhivyakti_RegistrationsReport_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Abhivyakti report downloaded successfully!");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── 1. PAGE HEADER ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Abhivyakti Registration Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">
            Track registrations, sources, conversions, and export reporting sheets.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              toast.loading("Refreshing registrations data...", { id: "refresh-regs" });
              try {
                localStorage.removeItem("abhivyakti_registrations_cache");
              } catch {}
              window.location.reload();
            }}
            className="flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-md transition-colors cursor-pointer"
            title="Purge local cache and re-fetch latest registrations"
          >
            <RotateCw size={13} className="text-slate-500" /> Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!filteredRegistrations.length}
            className="flex items-center gap-1.5 h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Download size={13} /> Export Workbook
          </button>
        </div>
      </div>

      {/* ── 2. COMPACT FILTER TOOLBAR ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-3">
        {/* Row 1: Dropdown Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filters:</span>
          
          {/* Call Type Dropdown */}
          <MultiSelect
            options={callTypeOptions}
            selected={selectedCallTypes}
            onChange={setSelectedCallTypes}
            placeholder="Call Type"
            allLabel="All Call Types"
          />

          {/* Called For Dropdown */}
          <MultiSelect
            options={calledForOptions}
            selected={selectedCalledFors}
            onChange={setSelectedCalledFors}
            placeholder="Called For"
            allLabel="All Called For"
          />

          {/* Source Dropdown */}
          <MultiSelect
            options={sourceOptions}
            selected={selectedSources}
            onChange={setSelectedSources}
            placeholder="Source"
            allLabel="All Sources"
          />

          {/* Attender Dropdown */}
          <MultiSelect
            options={attenderOptions}
            selected={selectedAttenders}
            onChange={setSelectedAttenders}
            placeholder="Attender"
            allLabel="All Attenders"
          />
        </div>

        {/* Row 2: Date Range Controls & Meta Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Date Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-slate-400 text-xs font-medium">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />

            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="h-8 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                title="Reset date range filter"
              >
                <X size={12} /> Reset
              </button>
            )}

            {(() => {
              const todayObj = new Date();
              const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
              const isTodaySelected = dateFrom === todayStr && dateTo === todayStr;

              const yr = todayObj.getFullYear();
              const mn = todayObj.getMonth();
              const firstDayStr = `${yr}-${String(mn + 1).padStart(2, "0")}-01`;
              const lastDay = new Date(yr, mn + 1, 0).getDate();
              const lastDayStr = `${yr}-${String(mn + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
              const isThisMonthSelected = dateFrom === firstDayStr && dateTo === lastDayStr;

              const prevMnObj = new Date(yr, mn - 1, 1);
              const prevYr = prevMnObj.getFullYear();
              const prevMn = prevMnObj.getMonth();
              const prevFirstDayStr = `${prevYr}-${String(prevMn + 1).padStart(2, "0")}-01`;
              const prevLastDay = new Date(prevYr, prevMn + 1, 0).getDate();
              const prevLastDayStr = `${prevYr}-${String(prevMn + 1).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;
              const isLastMonthSelected = dateFrom === prevFirstDayStr && dateTo === prevLastDayStr;

              return (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom(todayStr);
                      setDateTo(todayStr);
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
                    type="button"
                    onClick={() => {
                      setDateFrom(firstDayStr);
                      setDateTo(lastDayStr);
                    }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isThisMonthSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom(prevFirstDayStr);
                      setDateTo(prevLastDayStr);
                    }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isLastMonthSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Last Month
                  </button>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">{filteredRegistrations.length} entries</span>

            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCallTypes([]);
                  setSelectedCalledFors([]);
                  setSelectedSources([]);
                  setSelectedAttenders([]);
                  setDateFrom("");
                  setDateTo("");
                }}
                className="flex items-center gap-1 px-2.5 h-8 bg-rose-50 text-rose-600 border border-rose-200/80 rounded-md text-xs font-medium hover:bg-rose-100/80 transition cursor-pointer"
              >
                <X size={12} /> Clear filters
                <span className="bg-rose-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold">
                  {activeFilters}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium">Loading registrations database...</div>
      ) : filteredRegistrations.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs font-medium">No registration records match the active filters.</div>
      ) : (
        <div className="space-y-6">
          {/* ── 3. KPI SUMMARY CARDS ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Average Registrations/Day */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Average Registrations / Day</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{metrics.avgPerDay}</p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Calculated per active day</p>
            </div>

            {/* Card 2: Highest Peak Day */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Highest Peak Day</p>
                <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={metrics.highestDay}>
                  {metrics.highestDay}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Peak registration volume</p>
            </div>

            {/* Card 3: Attender Assisted */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Attender Assisted</p>
                <p className="text-2xl font-bold text-emerald-600 tracking-tight mt-1">{metrics.totalAttenderAssisted}</p>
              </div>
              <p className="text-[11px] text-emerald-600/80 font-medium mt-2">Attender facilitated</p>
            </div>

            {/* Card 4: Direct / Online Registrations */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Direct / Online Registrations</p>
                <p className="text-2xl font-bold text-slate-700 tracking-tight mt-1">
                  {metrics.totalRegistrations - metrics.totalAttenderAssisted}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Self-registered / Unassisted</p>
            </div>
          </div>

          {/* ── 4. CONVERSION ANALYSIS ────────────────────────────────────────── */}

          {/* Attender Assisted Conversions Table */}
          {attenderPerformance.length > 0 && (
            <ReportSection
              title="Attender Assisted Conversions"
              subtitle="Conversion volume and rates derived from connected incoming & outgoing call history"
              action={
                <FormulaInfoPopover
                  title="Attender Conversion Rate Formulas"
                  formulas={[
                    {
                      label: "Incoming Conversion Rate (%)",
                      formula: "(Incoming Conversions ÷ Total Incoming Connected Calls) × 100"
                    },
                    {
                      label: "Outgoing Conversion Rate (%)",
                      formula: "(Outgoing Conversions ÷ Total Outgoing Connected Calls) × 100"
                    },
                    {
                      label: "Overall Conversion Rate (%)",
                      formula: "(Total Conversions ÷ Total Connected Calls) × 100"
                    }
                  ]}
                />
              }
            >
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[960px]">
                  <thead className="bg-slate-50/90 text-[11px] font-semibold text-slate-600 uppercase tracking-wider sticky top-0 z-20 border-b border-slate-200">
                    {/* Header Grouping Row */}
                    <tr>
                      <th className="px-4 py-2.5 bg-slate-50 sticky left-0 z-30 border-r border-slate-200" rowSpan={2}>
                        Attender Name
                      </th>
                      <th colSpan={3} className="px-3 py-1.5 text-center bg-emerald-50/60 text-emerald-800 border-r border-slate-200">
                        Incoming Calls
                      </th>
                      <th colSpan={3} className="px-3 py-1.5 text-center bg-blue-50/60 text-blue-800 border-r border-slate-200">
                        Outgoing Calls
                      </th>
                      <th colSpan={3} className="px-3 py-1.5 text-center bg-slate-100/70 text-slate-800">
                        Overall Performance
                      </th>
                    </tr>
                    {/* Column Headers */}
                    <tr className="border-t border-slate-200">
                      <th className="px-3 py-2 text-right bg-emerald-50/40 text-emerald-900 font-semibold">Connected</th>
                      <th className="px-3 py-2 text-right bg-emerald-50/40 text-emerald-900 font-semibold">Conversions</th>
                      <th className="px-3 py-2 text-right bg-emerald-50/40 text-emerald-900 font-semibold border-r border-slate-200">Rate (%)</th>

                      <th className="px-3 py-2 text-right bg-blue-50/40 text-blue-900 font-semibold">Connected</th>
                      <th className="px-3 py-2 text-right bg-blue-50/40 text-blue-900 font-semibold">Conversions</th>
                      <th className="px-3 py-2 text-right bg-blue-50/40 text-blue-900 font-semibold border-r border-slate-200">Rate (%)</th>

                      <th className="px-3 py-2 text-right bg-slate-100/50 text-slate-900 font-semibold">Connected</th>
                      <th className="px-3 py-2 text-right bg-slate-100/50 text-slate-900 font-semibold">Conversions</th>
                      <th className="px-4 py-2 text-right bg-slate-100/50 text-slate-900 font-semibold">Overall Rate (%)</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                    {attenderPerformance.map((r, i) => {
                      const incConn = r["Incoming Connected"];
                      const incConv = r["Incoming Conversions"];
                      const incRate = r["Incoming Conversion Rate (%)"];

                      const outConn = r["Outgoing Connected"];
                      const outConv = r["Outgoing Conversions"];
                      const outRate = r["Outgoing Conversion Rate (%)"];

                      const totConn = r["Total Connected"];
                      const totConv = r["Total Conversions"];
                      const totRate = r["Overall Conversion Rate (%)"];

                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors duration-150">
                          {/* Sticky Attender Name Column */}
                          <td className="px-4 py-2.5 font-semibold text-slate-900 sticky left-0 z-10 bg-white border-r border-slate-200">
                            {r["Attender Name"]}
                          </td>

                          {/* Incoming */}
                          <td className="px-3 py-2.5 text-right font-medium text-slate-600">
                            {incConn > 0 ? incConn : <span className="text-slate-400 font-normal">0</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                            {incConv > 0 ? incConv : <span className="text-slate-400 font-normal">0</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium border-r border-slate-200">
                            {incConv > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] font-medium border border-emerald-100">
                                {incRate}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0.0%</span>
                            )}
                          </td>

                          {/* Outgoing */}
                          <td className="px-3 py-2.5 text-right font-medium text-slate-600">
                            {outConn > 0 ? outConn : <span className="text-slate-400 font-normal">0</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-blue-700">
                            {outConv > 0 ? outConv : <span className="text-slate-400 font-normal">0</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium border-r border-slate-200">
                            {outConv > 0 ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium border border-blue-100">
                                {outRate}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0.0%</span>
                            )}
                          </td>

                          {/* Total */}
                          <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                            {totConn > 0 ? totConn : <span className="text-slate-400 font-normal">0</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            {totConv > 0 ? totConv : <span className="text-slate-400 font-normal">0</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">
                            {totConv > 0 ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-semibold border border-slate-200">
                                {totRate}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0.0%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Summary Row */}
                    <tr className="bg-slate-100/90 backdrop-blur-xs border-t-2 border-slate-300 font-bold text-slate-900 sticky bottom-0 z-20">
                      <td className="px-4 py-3 sticky left-0 z-30 bg-slate-100 border-r border-slate-300 font-bold">
                        TOTAL ASSISTED
                      </td>
                      <td className="px-3 py-3 text-right text-slate-800">{attenderPerformanceTotals["Incoming Connected"]}</td>
                      <td className="px-3 py-3 text-right text-emerald-700">{attenderPerformanceTotals["Incoming Conversions"]}</td>
                      <td className="px-3 py-3 text-right text-emerald-800 border-r border-slate-200">{attenderPerformanceTotals["Incoming Conversion Rate (%)"]}</td>
                      <td className="px-3 py-3 text-right text-slate-800">{attenderPerformanceTotals["Outgoing Connected"]}</td>
                      <td className="px-3 py-3 text-right text-blue-700">{attenderPerformanceTotals["Outgoing Conversions"]}</td>
                      <td className="px-3 py-3 text-right text-blue-800 border-r border-slate-200">{attenderPerformanceTotals["Outgoing Conversion Rate (%)"]}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{attenderPerformanceTotals["Total Connected"]}</td>
                      <td className="px-3 py-3 text-right text-slate-900">{attenderPerformanceTotals["Total Conversions"]}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{attenderPerformanceTotals["Overall Conversion Rate (%)"]}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ReportSection>
          )}

          {/* Shared Conversions & Team Assists Table */}
          <ReportSection
            title="🤝 Shared Conversions & Team Assists"
            subtitle="Registrations finalized by an attender on incoming calls for another lead owner (Note: Counted under primary lead owner; no double counting)."
          >
            <div className="overflow-x-auto rounded-lg border border-slate-200 mt-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-amber-50/60 text-[11px] font-bold text-amber-900 uppercase tracking-wider border-b border-amber-100">
                  <tr>
                    <th className="px-4 py-2.5">Assisting Attender (Final Call)</th>
                    <th className="px-4 py-2.5">Primary Lead Owner (Nurturer)</th>
                    <th className="px-4 py-2.5 text-right">Shared Registrations Finalized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                  {sharedConversionsBreakdown.length > 0 ? (
                    sharedConversionsBreakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/20 transition-colors duration-150">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{item.assistant}</td>
                        <td className="px-4 py-2.5 font-bold text-indigo-700">{item.primaryOwner}</td>
                        <td className="px-4 py-2.5 text-right font-black text-amber-700">
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-200">
                            🤝 {item.count}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-5 text-center text-slate-400 font-medium">
                        No shared conversions recorded for the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReportSection>

          {/* Conversions by Called For & Attender Table */}
          {calledForAttenderBreakdown.length > 0 && (
            <ReportSection
              title="Conversions by Called For & Attender"
              subtitle="Breakdown of conversions by Attender, Called For category, Khoji Type, and Call Type"
              action={
                <FormulaInfoPopover
                  title="Conversions Breakdown Information"
                  formulas={[
                    {
                      label: "Conversions Count",
                      formula: "Count of registrations attributed to each Attender, Called For program, and Khoji Type."
                    }
                  ]}
                />
              }
            >
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Converted By (Attender)</th>
                      <th className="px-4 py-2.5">Called For</th>
                      <th className="px-4 py-2.5">Khoji Type</th>
                      <th className="px-4 py-2.5 text-right">Incoming Conversions</th>
                      <th className="px-4 py-2.5 text-right">Outgoing Conversions</th>
                      <th className="px-4 py-2.5 text-right">Total Conversions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                    {groupedCalledForAttender.map((group, groupIdx) => (
                      <React.Fragment key={groupIdx}>
                        {group.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors duration-150">
                            <td className="px-4 py-2.5 font-semibold text-slate-900">{r["Converted By (Attender)"]}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{r["Called For"]}</td>
                            <td className="px-4 py-2.5 text-slate-600">{r["Khoji Type"]}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">
                              {r["Incoming Conversions"] > 0 ? (
                                <span className="text-emerald-700">{r["Incoming Conversions"]}</span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold">
                              {r["Outgoing Conversions"] > 0 ? (
                                <span className="text-blue-700">{r["Outgoing Conversions"]}</span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{r["Total Conversions"]}</td>
                          </tr>
                        ))}
                        {/* Per-Attender Subtotal Row */}
                        <tr className="bg-slate-50 border-t border-b border-slate-200 font-bold text-slate-900">
                          <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-800" colSpan={3}>
                            TOTAL FOR {group.attenderName}
                          </td>
                          <td className="px-4 py-2.5 text-right text-emerald-700 font-bold">{group.totalIncoming}</td>
                          <td className="px-4 py-2.5 text-right text-blue-700 font-bold">{group.totalOutgoing}</td>
                          <td className="px-4 py-2.5 text-right text-slate-900 font-bold">{group.totalConversions}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                    {/* Grand Total Row */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="px-4 py-3 uppercase text-xs tracking-wider" colSpan={3}>GRAND TOTAL</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-bold">{calledForAttenderTotals["Incoming Conversions"]}</td>
                      <td className="px-4 py-3 text-right text-blue-700 font-bold">{calledForAttenderTotals["Outgoing Conversions"]}</td>
                      <td className="px-4 py-3 text-right text-slate-900 font-bold">{calledForAttenderTotals["Total Conversions"]}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ReportSection>
          )}

          {/* ── 5. DETAILED REGISTRATION DATA ────────────────────────────────── */}
          <ReportSection
            title={`Registrations Table List (${filteredRegistrations.length})`}
            subtitle="Verify names and details before exporting sheet workbook"
          >
            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/90 text-[11px] font-semibold text-slate-600 uppercase tracking-wider sticky top-0 z-20 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 bg-slate-50 sticky left-0 z-30 border-r border-slate-200">Name</th>
                    <th className="px-4 py-2.5">Phone Number</th>
                    <th className="px-4 py-2.5">Mobile Number</th>
                    <th className="px-4 py-2.5">Attender Name</th>
                    <th className="px-4 py-2.5 text-center">Calls Done</th>
                    <th className="px-4 py-2.5">Called For</th>
                    <th className="px-4 py-2.5">Khoji Type</th>
                    <th className="px-4 py-2.5">Source</th>
                    <th className="px-4 py-2.5">Call Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                  {filteredRegistrations.map((r, i) => {
                    const nameVal =
                      r.Name ||
                      r.name ||
                      r["Contact Name"] ||
                      r.contactName ||
                      r.contact_name ||
                      r["Full Name"] ||
                      r.fullName ||
                      r.full_name ||
                      r["First Name"] ||
                      r.first_name ||
                      (Array.isArray(r.history) && r.history[0]?.name) ||
                      "Unknown";
                    const phoneVal = r.Phone || r.phone || r["Phone Number"] || r.phoneNumber || r.normalizedPhone || "N/A";
                    const mobileVal = r.Mobile || r.mobile || r["Mobile Number"] || r.mobileNumber || r.normalizedMobile || "N/A";
                    const attenderVal = getRegistrationPrimaryAttender(r);
                    const callsDoneVal = r.callCount !== undefined ? r.callCount : (r.history ? r.history.length : 0);
                    const calledForVal = r.calledFor || r["Called For"] || "N/A";
                    const khojiVal = getContactKhoji(r) || "No";
                    const sourceVal = r.conversionSource || r.Source || r.source || "N/A";
                    const callTypeVal = r.callType || "N/A";

                    return (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors duration-150">
                        {/* Sticky Name Column */}
                        <td className="px-4 py-2.5 font-semibold text-slate-900 sticky left-0 z-10 bg-white border-r border-slate-200">
                          {nameVal}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{phoneVal}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{mobileVal}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{attenderVal}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                          {callsDoneVal > 0 ? callsDoneVal : <span className="text-slate-400 font-normal">0</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{calledForVal}</td>
                        <td className="px-4 py-2.5">
                          {khojiVal === "Yes" ? (
                            <span className="text-indigo-700 font-semibold">{khojiVal}</span>
                          ) : (
                            <span className="text-slate-500 font-normal">{khojiVal}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{sourceVal}</td>
                        <td className="px-4 py-2.5 text-slate-600 uppercase text-[11px]">{callTypeVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ReportSection>
        </div>
      )}
    </div>
  );
}
