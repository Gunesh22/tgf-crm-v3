import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { BarChart3, Download, Search, X, ChevronDown, Check, Database } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { COLORS, cleanExportRow, CONNECTED_STATUSES, NOT_CONNECTED_STATUSES, parseTimestamp, getCanonicalStatus, renderVal } from "../utils.jsx";
import { isKhojiAffirmative, isKhojiNegative } from "../../attender/utils.js";

// ── Multi-select dropdown ──────────────────────────────────────────────────
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

// ── Helper to format local YYYY-MM-DD date ──────────────────────────────────
const getLocalDateStr = (d = new Date()) => {
  const yr = d.getFullYear();
  const mn = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
};

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardTab({ programs, attenders, settingsOptions = { statusOptions: [], sourceOptions: [], calledForOptions: [] }, callLogs = [], registrations = [], secondsAgo = 0, nextFetchIn = 45, lastSyncedAt }) {
  const todayStr = getLocalDateStr();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedProgramIds, setSelectedProgramIds] = useState([]); // empty = ALL
  const [selectedAttenderIds, setSelectedAttenderIds] = useState([]); // empty = ALL
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedCalledFors, setSelectedCalledFors] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCallTypes, setSelectedCallTypes] = useState([]);
  const [selectedKhojiStatuses, setSelectedKhojiStatuses] = useState([]);
  const currentMonthFirstDay = `${todayStr.slice(0, 7)}-01`;
  const currentMonthLastDay = (() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${todayStr.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  })();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [conversionSearch, setConversionSearch] = useState("");
  const [convPage, setConvPage] = useState(1);
  const [selectedAttenderDetails, setSelectedAttenderDetails] = useState(null);
  const [attenderModalSearch, setAttenderModalSearch] = useState("");

  const callTypeOptions = useMemo(() => [
    { value: "incoming", label: "Incoming" },
    { value: "outgoing", label: "Outgoing" }
  ], []);

  const khojiStatusOptions = useMemo(() => [
    { value: "Yes", label: "Yes (Khoji)" },
    { value: "No", label: "No (New)" },
    { value: "Dew drop khoji", label: "Dew drop khoji" }
  ], []);

  const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "admin test", "test 2", "test2", "test"];

  const programOptions = programs.map(p => ({ value: p.id, label: p.name }));
  const attenderOptions = attenders
    .filter(a => a.role !== 'admin' && !EXCLUDED_ATTENDER_NAMES.includes((a.name || "").toLowerCase().trim()))
    .map(a => ({ value: a.id, label: a.name }));

  const sourceOptions = useMemo(() => {
    const sources = new Set(settingsOptions?.sourceOptions || []);
    callLogs.forEach(log => {
      const sourceKey = Object.keys(log).find(k => ["source", "sourse", "source of information", "source of informiton"].includes(k.toLowerCase()));
      const val = sourceKey ? String(log[sourceKey] || "").trim() : "";
      if (val) sources.add(val);
    });
    return Array.from(sources).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const calledForOptions = useMemo(() => {
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

  const statusOptions = useMemo(() => {
    const statuses = new Set(settingsOptions?.statusOptions || []);
    callLogs.forEach(log => {
      if (log.attenderStates) {
        Object.values(log.attenderStates).forEach(state => {
          if (state.status) statuses.add(state.status);
          if (state.history) {
            state.history.forEach(h => {
              if (h.status) statuses.add(h.status);
            });
          }
        });
      }
      if (log.status) statuses.add(log.status);
      if (log.history) {
        log.history.forEach(h => {
          if (h.status) statuses.add(h.status);
        });
      }
    });
    return Array.from(statuses).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const flattenedLogs = useMemo(() => {
    const list = [];
    callLogs.forEach(log => {
      if (log._deleted) return;

      const nameKey = Object.keys(log).find(k => ["name", "lead name", "caller name", "lead"].includes(k.toLowerCase()));
      const contactName = nameKey ? log[nameKey] : "Unknown";
      const phoneKey = Object.keys(log).find(k => ["phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno"].includes(k.toLowerCase()))
        || Object.keys(log).find(k => k.toLowerCase().includes("phone") || k.toLowerCase().includes("mobile") || k.toLowerCase().includes("whatsapp"));
      const contactPhone = phoneKey ? log[phoneKey] : "";

      const sourceKey = Object.keys(log).find(k => ["source", "sourse", "source of information", "source of informiton"].includes(k.toLowerCase()));
      const sourceVal = sourceKey ? String(log[sourceKey] || "").trim() : "";

      const calledForKey = Object.keys(log).find(k => ["called for", "called_for", "calledfor"].includes(k.toLowerCase()));
      const calledForVal = calledForKey ? String(log[calledForKey] || "").trim() : "";

      const khojiKey = Object.keys(log).find(k => ["khoji", "khoji yes or no", "khoji yes or no (have you done maha asmani)", "have you done maha asmani", "maha asmani", "mahaasmani", "have you done mahaasmani"].includes(k.toLowerCase()));
      const khojiVal = log.Khoji || (khojiKey ? String(log[khojiKey] || "").trim() : "");

      const feedbackKey = Object.keys(log).find(k => ["prog. feedback", "feedback", "user feedback", "program feedback"].includes(k.toLowerCase()));
      const feedbackVal = feedbackKey ? String(log[feedbackKey] || "").trim() : "";

      const getAttemptDate = (val) => {
        return parseTimestamp(val);
      };

      const hasTopHistory = Array.isArray(log.history) && log.history.length > 0;
      const hasAttenderStates = log.attenderStates && typeof log.attenderStates === "object" && Object.keys(log.attenderStates).length > 0;
      const seenCallKeys = new Set();

      // 1. Extract ALL physical call events directly from contact.history (Canonical call count)
      if (hasTopHistory) {
        log.history.forEach((h, index) => {
          const canonicalStatus = getCanonicalStatus(h.status || "Pending");
          const attemptDate = getAttemptDate(h.timestamp || h.date || h.createdAt) || parseTimestamp(log.createdAt);
          const attId = h.attenderId || log.attenderId || "legacy";
          const attName = h.attenderName || log.attenderName || "Legacy Attender";
          const callKey = `${log.id}_h_${index}`;

          if (!seenCallKeys.has(callKey)) {
            seenCallKeys.add(callKey);
            list.push({
              ...log,
              id: `${log.id}_h_${index}`,
              contactId: log.id,
              Name: contactName,
              Phone: contactPhone,
              programId: log.programId,
              programName: log.programName || "Unknown Program",
              tags: log.tags || [],
              attenderId: attId,
              attenderName: attName,
              status: canonicalStatus,
              pipelineStage: log.pipelineStage || "",
              remark: h.remark || "",
              callType: h.callType || log.callType || "outgoing",
              history: log.history || [],
              callbackDate: log.callbackDate || null,
              createdAt: parseTimestamp(log.createdAt) || attemptDate,
              timestamp: attemptDate || new Date(),
              updatedAt: attemptDate || new Date(),
              source: h.source || log.Source || log.source || sourceVal,
              calledFor: h.calledFor || log["Called For"] || log.calledFor || calledForVal,
              feedback: feedbackVal,
              Khoji: khojiVal,
              isHistory: true
            });
          }
        });
      }

      // 2. Extract fallback attender state status/remarks when no history array entry was created
      if (hasAttenderStates) {
        Object.entries(log.attenderStates).forEach(([attId, state]) => {
          if (!state) return;
          const stateAttName = state.attenderName || "Unknown";
          const stateHasHistory = Array.isArray(state.history) && state.history.length > 0;
          if (!stateHasHistory && (state.lastCalledAt || (state.status && state.status !== "Pending") || state.remark)) {
            const canonicalStatus = getCanonicalStatus(state.status || "Pending");
            const attemptDate = getAttemptDate(state.lastCalledAt) || parseTimestamp(log.createdAt);
            list.push({
              ...log,
              id: `${log.id}_${attId}_latest`,
              contactId: log.id,
              Name: contactName,
              Phone: contactPhone,
              programId: log.programId,
              programName: log.programName || "Unknown Program",
              tags: log.tags || [],
              attenderId: attId,
              attenderName: stateAttName,
              status: canonicalStatus,
              pipelineStage: log.pipelineStage || "",
              remark: state.remark || "",
              callType: state.callType || "outgoing",
              history: [],
              callbackDate: state.callbackDate || null,
              createdAt: parseTimestamp(log.createdAt) || attemptDate,
              timestamp: attemptDate || new Date(),
              updatedAt: attemptDate || new Date(),
              source: state.Source || state.source || sourceVal,
              calledFor: state["Called For"] || state.calledFor || calledForVal,
              feedback: feedbackVal,
              Khoji: khojiVal,
              isHistory: false
            });
          }
        });
      } else if (!hasTopHistory) {
        if (log.lastCalledAt || (log.status && log.status !== "Pending") || log.remark) {
          const canonicalStatus = getCanonicalStatus(log.status || "Pending");
          const attemptDate = getAttemptDate(log.lastCalledAt) || parseTimestamp(log.createdAt);
          list.push({
            ...log,
            id: `${log.id}_legacy_latest`,
            contactId: log.id,
            Name: contactName,
            Phone: contactPhone,
            programId: log.programId,
            programName: log.programName || "Unknown Program",
            tags: log.tags || [],
            attenderId: log.attenderId || "legacy",
            attenderName: log.attenderName || "Legacy Attender",
            status: canonicalStatus,
            pipelineStage: log.pipelineStage || "",
            remark: log.remark || "",
            callType: log.callType || "outgoing",
            history: [],
            callbackDate: log.callbackDate || null,
            createdAt: parseTimestamp(log.createdAt) || attemptDate,
            timestamp: attemptDate || new Date(),
            updatedAt: attemptDate || new Date(),
            source: log.Source || log.source || sourceVal,
            calledFor: log["Called For"] || log.calledFor || calledForVal,
            feedback: feedbackVal,
            Khoji: khojiVal,
            isHistory: false
          });
        }
      }
    });

    return list;
  }, [callLogs]);

  const filteredLogs = useMemo(() => {
    const res = flattenedLogs.filter(log => {
      // Multi-tag filter with robust fallback
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

        if (!matchesId && !matchesName) return false;
      }

      // Multi-attender filter
      if (selectedAttenderIds.length > 0) {
        const matchesId = log.attenderId && selectedAttenderIds.includes(log.attenderId);
        const selectedAttenderNames = selectedAttenderIds.map(id => {
          const a = attenders.find(x => x.id === id);
          return a ? a.name.toLowerCase().trim() : "";
        }).filter(Boolean);
        const matchesName = selectedAttenderNames.includes((log.attenderName || "").toLowerCase().trim());
        if (!matchesId && !matchesName) return false;
      }

      // Source filter
      if (selectedSources.length > 0 && !selectedSources.includes(log.source || "")) return false;

      // Called For filter
      if (selectedCalledFors.length > 0) {
        const logCalledFors = String(log.calledFor || "").split(",").map(x => x.trim()).filter(Boolean);
        if (!logCalledFors.some(cf => selectedCalledFors.includes(cf))) return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(log.status || "Pending")) return false;

      // Call Type filter
      if (selectedCallTypes.length > 0) {
        const cType = (log.callType || "outgoing").toLowerCase();
        const matches = selectedCallTypes.some(t => {
          if (t === "incoming") return cType.startsWith("incoming");
          if (t === "outgoing") return cType.startsWith("outgoing");
          return false;
        });
        if (!matches) return false;
      }

      // Khoji Status filter
      if (selectedKhojiStatuses.length > 0) {
        const val = log.Khoji;
        const affirmative = isKhojiAffirmative(val);
        const isDew = String(val || "").toLowerCase().includes("dew d") || String(val || "").toLowerCase().includes("dewdrop");
        const isNo = isKhojiNegative(val) || !val;

        let match = false;
        if (selectedKhojiStatuses.includes("Yes") && affirmative && !isDew) match = true;
        if (selectedKhojiStatuses.includes("No") && isNo) match = true;
        if (selectedKhojiStatuses.includes("Dew drop khoji") && isDew) match = true;

        if (!match) return false;
      }

      // Date range based on canonical event timestamp with fallbacks
      const logDate = parseTimestamp(log.timestamp) || parseTimestamp(log.lastCalledAt) || parseTimestamp(log.createdAt);
      if (!logDate || isNaN(logDate.getTime())) return false;
      const logDateStr = getLocalDateStr(logDate);
      if (dateFrom && logDateStr < dateFrom) return false;
      if (dateTo && logDateStr > dateTo) return false;

      return true;
    });
    return res;
  }, [flattenedLogs, selectedProgramIds, selectedAttenderIds, selectedSources, selectedCalledFors, selectedStatuses, selectedCallTypes, selectedKhojiStatuses, dateFrom, dateTo, programs, attenders]);

  const attenderStats = useMemo(() => {
    const map = {};
    const seenRegsPerAttender = new Set();

    const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "admin test", "test 2", "test2", "test"];

    filteredLogs.forEach(log => {
      const rawName = (log.attenderName || "").trim() || "Unknown Attender";
      const normName = rawName.toLowerCase();
      // Skip admin and test entries
      if (EXCLUDED_ATTENDER_NAMES.includes(normName)) return;

      // Match with official attenders list if available
      const foundAttender = (attenders || []).find(a => (a.name || "").toLowerCase().trim() === normName);
      if (foundAttender && (foundAttender.role === "admin" || EXCLUDED_ATTENDER_NAMES.includes((foundAttender.name || "").toLowerCase().trim()))) return;

      const canonicalName = foundAttender ? foundAttender.name : rawName;
      const canonicalId = foundAttender ? foundAttender.id : (log.attenderId && log.attenderId !== "unknown" && log.attenderId !== "legacy" ? log.attenderId : normName);

      if (canonicalId === "admin" || EXCLUDED_ATTENDER_NAMES.includes(canonicalName.toLowerCase().trim())) return;

      // Use canonicalId as map key to prevent same attender appearing twice
      const key = canonicalId;
      if (!map[key]) {
        map[key] = { id: canonicalId, name: canonicalName, total: 0, outgoing: 0, incoming: 0, interested: 0, regDone: 0, pending: 0 };
      }
      const s = map[key];
      s.total++;
      const cType = (log.callType || "").toLowerCase();
      if (cType.startsWith("in")) s.incoming++; else s.outgoing++;

      const normStatus = getCanonicalStatus(log.status);
      if (normStatus === "Interested") s.interested++;
      if (normStatus === "Reg.Done") {
        const leadId = log.contactId || log.Phone || log.Name;
        const cf = (log.calledFor || log.programName || "").toLowerCase().trim();
        const timeKey = log.timestamp ? log.timestamp.getTime() : "";
        const regKey = `${key}_${leadId}_${cf}_${timeKey}`;
        if (!seenRegsPerAttender.has(regKey)) {
          seenRegsPerAttender.add(regKey);
          s.regDone++;
        }
      }
      if (!normStatus || normStatus === "Pending") s.pending++;
    });

    // Final merge: collapse any duplicate name variants (e.g. legacy ID vs official ID for same person)
    const byName = {};
    Object.values(map).forEach(entry => {
      const nameKey = entry.name.toLowerCase().trim();
      if (EXCLUDED_ATTENDER_NAMES.includes(nameKey)) return;
      if (!byName[nameKey]) {
        byName[nameKey] = { ...entry };
      } else {
        const ex = byName[nameKey];
        ex.total += entry.total;
        ex.outgoing += entry.outgoing;
        ex.incoming += entry.incoming;
        ex.interested += entry.interested;
        ex.regDone += entry.regDone;
        ex.pending += entry.pending;
      }
    });

    return Object.values(byName).sort((a, b) => b.total - a.total);
  }, [filteredLogs, attenders]);

  const attenderModalLeads = useMemo(() => {
    if (!selectedAttenderDetails) return [];
    const targetObj = typeof selectedAttenderDetails === "object" ? selectedAttenderDetails : { id: null, name: selectedAttenderDetails };
    const targetId = targetObj.id;
    const targetName = (targetObj.name || "").toLowerCase().trim();

    const leads = filteredLogs.filter(log => {
      const logAttender = (log.attenderName || "").toLowerCase().trim();
      if (logAttender === targetName) return true;
      if (targetId && targetId !== "unknown" && targetId !== "legacy" && log.attenderId === targetId) return true;
      return false;
    });

    const seenRegs = new Set();
    const deduplicatedLeads = leads.filter(l => {
      if (getCanonicalStatus(l.status) === "Reg.Done") {
        const leadId = l.contactId || l.Phone || l.Name;
        const cf = (l.calledFor || l.programName || "").toLowerCase().trim();
        const timeKey = l.timestamp ? l.timestamp.getTime() : "";
        const regKey = `${leadId}_${cf}_${timeKey}`;
        if (seenRegs.has(regKey)) return false;
        seenRegs.add(regKey);
      }
      return true;
    });

    if (!attenderModalSearch.trim()) return deduplicatedLeads;
    const q = attenderModalSearch.toLowerCase();
    return deduplicatedLeads.filter(l =>
      (l.Name || "").toLowerCase().includes(q) ||
      (l.Phone || "").toLowerCase().includes(q) ||
      (l.status || "").toLowerCase().includes(q) ||
      (l.remark || "").toLowerCase().includes(q)
    );
  }, [filteredLogs, selectedAttenderDetails, attenderModalSearch]);

  const outcomeData = useMemo(() => {
    const map = {};
    const seenRegs = new Set();
    filteredLogs.forEach(l => {
      const canonical = getCanonicalStatus(l.status);
      if (canonical === "Reg.Done") {
        const leadId = l.contactId || l.Phone || l.Name;
        const cf = (l.calledFor || l.programName || "").toLowerCase().trim();
        const timeKey = l.timestamp ? l.timestamp.getTime() : "";
        const regKey = `${leadId}_${cf}_${timeKey}`;
        if (!seenRegs.has(regKey)) {
          seenRegs.add(regKey);
          map["Reg.Done"] = (map["Reg.Done"] || 0) + 1;
        }
      } else {
        const s = !l.status || l.status === "Pending" ? "Pending" : l.status;
        map[s] = (map[s] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredLogs]);

  const conversionsList = useMemo(() => {
    const seen = new Set();
    const result = [];
    filteredLogs.forEach(l => {
      if (getCanonicalStatus(l.status) === "Reg.Done") {
        const leadId = l.contactId || l.Phone || l.Name;
        const cf = (l.calledFor || l.programName || "").toLowerCase().trim();
        const timeKey = l.timestamp ? l.timestamp.getTime() : "";
        const regKey = `${leadId}_${cf}_${timeKey}`;
        if (!seen.has(regKey)) {
          seen.add(regKey);
          result.push(l);
        }
      }
    });
    return result;
  }, [filteredLogs]);

  const totalPhysicalCalls = useMemo(() => {
    return filteredLogs.filter(l => l.isHistory).length;
  }, [filteredLogs]);

  const totalRegisteredPeople = useMemo(() => {
    const uniqueContactIds = new Set();
    filteredLogs.forEach(l => {
      const cId = l.contactId || l.id || l.Phone || l.Name;
      if (!cId) return;
      const contactDoc = (callLogs || []).find(c => String(c.id || c._id) === String(cId));
      const stage = (contactDoc?.pipelineStage || l.pipelineStage || "").trim();
      if (stage === "6. Registered / Won" || stage === "Registered / Won" || stage.includes("Registered")) {
        uniqueContactIds.add(String(cId));
      }
    });
    return uniqueContactIds.size;
  }, [filteredLogs, callLogs]);

  const totalInterestedCalls = useMemo(() => {
    return filteredLogs.filter(l => l.isHistory && getCanonicalStatus(l.status) === "Interested").length;
  }, [filteredLogs]);

  const totalInterestedPeople = useMemo(() => {
    const uniqueContactIds = new Set();
    filteredLogs.forEach(l => {
      const cId = l.contactId || l.id || l.Phone || l.Name;
      if (!cId) return;
      const contactDoc = (callLogs || []).find(c => String(c.id || c._id) === String(cId));
      const stage = (contactDoc?.pipelineStage || l.pipelineStage || "").trim();
      const isNurtureInterested = stage === "4. Nurture / Interested" || stage === "Nurture / Interested" || (stage.includes("Interested") && !stage.includes("Reg"));
      if (isNurtureInterested) {
        uniqueContactIds.add(String(cId));
      }
    });
    return uniqueContactIds.size;
  }, [filteredLogs, callLogs]);

  const searchedConversions = useMemo(() => {
    if (!conversionSearch.trim()) return conversionsList;
    const term = conversionSearch.toLowerCase();
    return conversionsList.filter(c => {
      return (
        (c.Name || "").toLowerCase().includes(term) ||
        (c.Phone || "").toLowerCase().includes(term) ||
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
  const paginatedConversions = useMemo(() => {
    const start = (convPage - 1) * convPerPage;
    return searchedConversions.slice(start, start + convPerPage);
  }, [searchedConversions, convPage]);

  useEffect(() => {
    setConvPage(1);
  }, [conversionSearch]);

  const handleExport = () => {
    if (filteredLogs.length === 0) { toast.error("No data to export."); return; }
    const ws = XLSX.utils.json_to_sheet(filteredLogs.map(cleanExportRow));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `CallCenter_Report_${todayStr}.xlsx`);
    toast.success("Report downloaded!");
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const activeFilters = selectedProgramIds.length + selectedAttenderIds.length + selectedSources.length + selectedCalledFors.length + selectedStatuses.length + selectedCallTypes.length + selectedKhojiStatuses.length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Analytics Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">Call performance analytics and team metrics.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-md transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-3">
        {/* Dropdowns grid */}
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

        {/* Date range toolbar & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Date Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-xs font-medium">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

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

              const isAllTimeSelected = !dateFrom && !dateTo;

              return (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => { setDateFrom(todayStr); setDateTo(todayStr); }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isTodaySelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => { setDateFrom(firstDayStr); setDateTo(lastDayStr); }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isThisMonthSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      isAllTimeSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    All Time
                  </button>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{filteredLogs.length} entries</span>

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
                  setDateFrom(currentMonthFirstDay);
                  setDateTo(currentMonthLastDay);
                }}
                className="flex items-center gap-1 h-8 px-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-xs font-medium hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X size={12} /> Clear filters
                <span className="bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{activeFilters}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Calls", value: totalPhysicalCalls, sub: "Physical call events (contact.history)" },
          { label: "Interested Calls", value: totalInterestedCalls, color: "text-amber-600", sub: "Event count (call history)" },
          { label: "Interested People", value: totalInterestedPeople, color: "text-indigo-600", sub: "Unique contacts currently Interested" },
          { label: "Registered People", value: totalRegisteredPeople, color: "text-emerald-600", sub: "Unique contacts (6. Registered / Won)" },
        ].map(s => (
          <div key={s.label} className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color || "text-slate-900"} mt-1`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Call Outcomes Distribution (Event Count)</h3>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-[220px]">
            <div className="w-full sm:w-1/2 h-[200px]">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={outcomeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {outcomeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "none", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 grid grid-cols-1 gap-y-1.5 text-xs font-medium text-slate-600 self-center max-h-[190px] overflow-y-auto pr-1">
              {(() => {
                const total = outcomeData.reduce((sum, item) => sum + item.value, 0);
                return outcomeData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-0 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-slate-700" title={renderVal(item.name)}>{renderVal(item.name)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <span className="text-slate-900 font-semibold">{item.value}</span>
                      <span className="text-slate-400 text-[10px]">({total ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Calls by Attender</h3>
          <div className="w-full min-h-[220px]">
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={180}>
              <BarChart data={attenderStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 11, fill: "#334155" }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: "6px", color: "#fff", fontSize: "12px" }} />
                <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Attender Breakdown Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Per Attender Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click any attender row to inspect the exact leads & calls being counted.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Attender", "Total Calls", "Outgoing", "Incoming", "Interested Calls", "Reg.Done", "Pending", "Progress"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {attenderStats.map((a, i) => (
                <tr 
                  key={`${a.id || a.name}_${i}`} 
                  onClick={() => { setSelectedAttenderDetails(a); setAttenderModalSearch(""); }}
                  className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                  title="Click to view full leads list"
                >
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 group-hover:text-indigo-600 flex items-center gap-1.5">
                    {renderVal(a.name)}
                    <span className="text-[10px] text-slate-400 font-normal group-hover:text-indigo-600">🔍 Inspect</span>
                  </td>
                  <td className="px-3.5 py-2.5 font-bold text-slate-900">{a.total}</td>
                  <td className="px-3.5 py-2.5 text-slate-700">{a.outgoing}</td>
                  <td className="px-3.5 py-2.5 text-slate-700">{a.incoming}</td>
                  <td className="px-3.5 py-2.5 text-amber-600 font-semibold">{a.interested}</td>
                  <td className="px-3.5 py-2.5 text-emerald-600 font-semibold">{a.regDone}</td>
                  <td className="px-3.5 py-2.5 text-slate-500">{a.pending}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[70px]">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${a.total ? Math.round(((a.total - a.pending) / a.total) * 100) : 0}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                        {a.total ? Math.round(((a.total - a.pending) / a.total) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {attenderStats.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400 font-medium">No data for this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Converted Leads Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏆</span> Registered & Converted Leads ({conversionsList.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Leads whose call outcome is marked as Registered/Reg.Done.</p>
          </div>
          <div className="relative max-w-xs w-full">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search size={13} />
            </span>
            <input
              type="text"
              placeholder="Search conversions..."
              value={conversionSearch}
              onChange={(e) => setConversionSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                {["Name & Contact", "Attender", "Tag / Program", "Source / Called For", "Date & Time", "User Feedback", "Remarks"].map(h => (
                  <th key={h} className="px-3.5 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedConversions.map((c, idx) => {
                const dateVal = parseTimestamp(c.timestamp || c.lastCalledAt || c.createdAt);
                const dateStr = dateVal ? dateVal.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
                const cName = renderVal(c.contactName || c.Name || c.name, "Unknown");
                const cPhone = renderVal(c.contactPhone || c.Phone || c.phone || c.Mobile || c.mobile, "—");
                const cCity = renderVal(c.contactCity, "");
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {/* Name & Contact */}
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-900">{cName}</div>
                      <div className="text-indigo-600 font-mono text-[11px]">{cPhone}</div>
                      {cCity && <div className="text-[10px] text-slate-400">{cCity}</div>}
                    </td>
                    {/* Attender */}
                    <td className="px-3.5 py-2.5 font-medium text-slate-700">
                      {renderVal(c.attenderName)}
                    </td>
                    {/* Tag / Program */}
                    <td className="px-3.5 py-2.5">
                      <div className="text-slate-700 font-medium truncate max-w-[140px]">{renderVal(c.programName)}</div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {c.tags.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">
                              {renderVal(t)}
                            </span>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-[9px] text-slate-400">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Source / Called For */}
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-slate-700">{renderVal(c.source)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Called for: {renderVal(c.calledFor)}</div>
                    </td>
                    {/* Date & Time */}
                    <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                      {dateStr}
                    </td>
                    {/* User Feedback */}
                    <td className="px-3.5 py-2.5">
                      <p className="max-w-[180px] truncate text-slate-600" title={renderVal(c.feedback)}>
                        {renderVal(c.feedback, "—")}
                      </p>
                    </td>
                    {/* Remarks */}
                    <td className="px-3.5 py-2.5">
                      <p className="max-w-[180px] truncate text-slate-600" title={renderVal(c.remark)}>
                        {renderVal(c.remark, "—")}
                      </p>
                    </td>
                  </tr>
                );
              })}
              {paginatedConversions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    No conversions match the current filters and search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalConvPages > 1 && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500 font-medium">
              Showing {Math.min(searchedConversions.length, (convPage - 1) * convPerPage + 1)}-{Math.min(searchedConversions.length, convPage * convPerPage)} of {searchedConversions.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConvPage(p => Math.max(1, p - 1))}
                disabled={convPage === 1}
                className="h-7 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-medium text-slate-600">
                Page {convPage} of {totalConvPages}
              </span>
              <button
                onClick={() => setConvPage(p => Math.min(totalConvPages, p + 1))}
                disabled={convPage === totalConvPages}
                className="h-7 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drill-down Modal for Selected Attender */}
      {selectedAttenderDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50/40 via-white to-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xl text-slate-900 flex items-center gap-2">
                  <span>📊</span> Calls & Leads Breakdown for <span className="text-blue-600 underline decoration-blue-300">{typeof selectedAttenderDetails === "object" ? selectedAttenderDetails.name : selectedAttenderDetails}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  Showing {attenderModalLeads.length} counted entries for date range <span className="font-bold text-gray-700">{dateFrom}</span> to <span className="font-bold text-gray-700">{dateTo}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedAttenderDetails(null)}
                className="p-2 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controls Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads by name, phone, status..."
                  value={attenderModalSearch}
                  onChange={e => setAttenderModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                {attenderModalSearch && (
                  <button onClick={() => setAttenderModalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <span>Total Counted Items: <strong className="text-indigo-600 font-extrabold">{attenderModalLeads.length}</strong></span>
              </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto p-6">
              {attenderModalLeads.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-500 font-bold">No matching leads found for this attender.</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting the search query or date range filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Lead Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3 text-center">Calls Done</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Call Time (IST)</th>
                        <th className="px-4 py-3">Call Type</th>
                        <th className="px-4 py-3">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {attenderModalLeads.map((log, i) => {
                        const callTime = parseTimestamp(log.timestamp || log.lastCalledAt || log.createdAt);
                        const timeStr = callTime && !isNaN(callTime.getTime()) 
                          ? callTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) 
                          : "N/A";
                        const st = log.status || "Pending";
                        const isInterested = st === "Interested";
                        const isReg = st === "Reg.Done";
                        const isPending = st === "Pending";
                        const targetObj = typeof selectedAttenderDetails === "object" ? selectedAttenderDetails : { id: null, name: selectedAttenderDetails };
                        const targetId = targetObj.id;
                        const targetName = (targetObj.name || "").toLowerCase().trim();
                        let callsDoneCount = 0;

                        if (targetId && log.attenderStates && log.attenderStates[targetId]) {
                          const st = log.attenderStates[targetId];
                          if (Array.isArray(st.history) && st.history.length > 0) {
                            callsDoneCount = st.history.length;
                          } else if (st.lastCalledAt || st.status || st.remark) {
                            callsDoneCount = 1;
                          }
                        } else if (Array.isArray(log.history) && log.history.length > 0) {
                          const attenderHistory = log.history.filter(h => {
                            if (targetId && (h.attenderId === targetId || h.assignedTo === targetId)) return true;
                            const hName = (h.attenderName || h.name || "").toLowerCase().trim();
                            if (targetName && hName === targetName) return true;
                            return false;
                          });
                          callsDoneCount = attenderHistory.length > 0 ? attenderHistory.length : 1;
                        } else if (log.status || log.remark || log.Remark || log.callbackDate) {
                          callsDoneCount = 1;
                        }

                        return (
                          <tr key={log.id + "_" + i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3.5 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-900">{renderVal(log.Name || log.contactName || log.name, "Unknown")}</td>
                            <td className="px-3.5 py-2.5 font-mono text-slate-600">{renderVal(log.Phone || log.contactPhone || log.phone || log.mobile, "—")}</td>
                            <td className="px-3.5 py-2.5 text-center font-semibold">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                                {callsDoneCount}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                isReg ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                isInterested ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                isPending ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}>
                                {renderVal(st)}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">{timeStr}</td>
                            <td className="px-3.5 py-2.5 capitalize">{renderVal(log.callType || "outgoing")}</td>
                            <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate">{renderVal(log.remark, "—")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedAttenderDetails(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
