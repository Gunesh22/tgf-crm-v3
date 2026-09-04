import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { BarChart3, Download, Search, X, ChevronDown, Check, Eye } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { COLORS, cleanExportRow, CONNECTED_STATUSES, NOT_CONNECTED_STATUSES, parseTimestamp, getCanonicalStatus, getCanonicalStage, renderVal, isStageNurtureInterested, isStageRegisteredWon, getLocalDateStr, getCanonicalRegistrations, getCanonicalRegisteredPeople, getCanonicalStage6People, getContactPhone, formatDateTimeNoSeconds } from "../utils.jsx";
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

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardTab({ programs, attenders, settingsOptions = { statusOptions: [], sourceOptions: [], calledForOptions: [] }, callLogs = [], registrations = [], callLogsLoading = false, secondsAgo = 0, nextFetchIn = 45, lastSyncedAt }) {
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
  const [dateFrom, setDateFrom] = useState(currentMonthFirstDay);
  const [dateTo, setDateTo] = useState(currentMonthLastDay);
  const [conversionSearch, setConversionSearch] = useState("");
  const [convPage, setConvPage] = useState(1);
  const [selectedAttenderDetails, setSelectedAttenderDetails] = useState(null);
  const [attenderModalSearch, setAttenderModalSearch] = useState("");
  const [inspectModal, setInspectModal] = useState(null); // { title: string, subtitle: string, items: Array, type: string }
  const [inspectSearch, setInspectSearch] = useState("");

  const callTypeOptions = useMemo(() => [
    { value: "incoming", label: "Incoming" },
    { value: "outgoing", label: "Outgoing" }
  ], []);

  const khojiStatusOptions = useMemo(() => [
    { value: "Yes", label: "Yes (Khoji)" },
    { value: "No", label: "No (New)" },
    { value: "Dew drop khoji", label: "Dew drop khoji" }
  ], []);

  const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "agent"];

  const programOptions = useMemo(() => {
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
              callType: h.callType || h.callDirection || log.callType || log.callDirection || "outgoing",
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

      // 2. Extract fallback attender state status/remarks ONLY when no corresponding call exists in log.history
      if (hasAttenderStates) {
        Object.entries(log.attenderStates).forEach(([attId, state]) => {
          if (!state) return;
          const stateAttName = state.attenderName || "Unknown";
          const stateHasHistory = Array.isArray(state.history) && state.history.length > 0;

          // Check if this attender already has physical call(s) in log.history
          const attenderHasHistoryInLog = hasTopHistory && log.history.some(h => {
            const hAttId = h.attenderId || h.callAttenderId;
            if (hAttId && attId && String(hAttId) === String(attId)) return true;
            if (h.attenderName && stateAttName && h.attenderName.toLowerCase().trim() === stateAttName.toLowerCase().trim()) return true;
            return false;
          });

          if (!attenderHasHistoryInLog && !stateHasHistory && (state.lastCalledAt || (state.status && state.status !== "Pending") || state.remark)) {
            const canonicalStatus = getCanonicalStatus(state.status || "Pending");
            const attemptDate = getAttemptDate(state.lastCalledAt) || parseTimestamp(log.createdAt);
            const callDir = state.callType || state.callDirection || log.callType || log.callDirection || "outgoing";

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
              callType: callDir,
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

    const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "agent"];

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
        const regKey = `${key}_${leadId}_${cf}`;
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
        const regKey = `${leadId}_${cf}`;
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

  // CANONICAL REGISTRATION DERIVATIONS (SINGLE SOURCE OF TRUTH)
  const programRegistrationsList = useMemo(() => {
    return getCanonicalRegistrations(registrations, callLogs, {
      startDate: dateFrom,
      endDate: dateTo,
      selectedAttenderIds,
      selectedProgramIds,
      selectedSources,
      selectedCalledFors
    });
  }, [registrations, callLogs, dateFrom, dateTo, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors]);

  const outcomeData = useMemo(() => {
    const map = {};
    filteredLogs.forEach(l => {
      if (!l.isHistory) return;
      const canonical = getCanonicalStatus(l.status) || "Pending";
      if (canonical === "Reg.Done") return;
      map[canonical] = (map[canonical] || 0) + 1;
    });

    if (programRegistrationsList.length > 0) {
      map["Reg.Done"] = programRegistrationsList.length;
    }

    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredLogs, programRegistrationsList]);

  const registeredPeopleList = useMemo(() => {
    return getCanonicalRegisteredPeople(registrations, callLogs, {
      startDate: dateFrom,
      endDate: dateTo,
      selectedAttenderIds,
      selectedProgramIds,
      selectedSources,
      selectedCalledFors
    });
  }, [registrations, callLogs, dateFrom, dateTo, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors]);

  const stage6PeopleList = useMemo(() => {
    return getCanonicalStage6People(callLogs, {
      startDate: dateFrom,
      endDate: dateTo
    });
  }, [callLogs, dateFrom, dateTo]);

  const conversionsList = programRegistrationsList;

  const totalPhysicalCalls = useMemo(() => {
    return filteredLogs.filter(l => l.isHistory).length;
  }, [filteredLogs]);

  const totalInterestedCalls = useMemo(() => {
    return filteredLogs.filter(l => l.isHistory && getCanonicalStatus(l.status) === "Interested").length;
  }, [filteredLogs]);

  const interestedPeopleList = useMemo(() => {
    const map = new Map();
    filteredLogs.forEach(l => {
      const contactDoc = (callLogs || []).find(c => {
        const cId = String(c.id || c._id || "");
        const lId = String(l.contactId || "");
        if (cId && lId && cId === lId) return true;
        const cPhone = getContactPhone(c);
        const lPhone = getContactPhone(l);
        return cPhone && lPhone && cPhone === lPhone;
      });
      const targetObj = contactDoc || l;
      const key = String((contactDoc && (contactDoc.id || contactDoc._id)) || getContactPhone(targetObj) || targetObj.phone || targetObj.Phone || targetObj.name || targetObj.Name || "").trim();
      if (!key || map.has(key)) return;

      if (isStageNurtureInterested(targetObj)) {
        map.set(key, {
          id: key,
          name: renderVal(targetObj.Name || targetObj.contactName || targetObj.name || l.Name, "Unknown"),
          phone: renderVal(getContactPhone(targetObj) || targetObj.Phone || targetObj.contactPhone || targetObj.phone || targetObj.mobile || l.Phone, "—"),
          city: renderVal(targetObj.city || targetObj.City || l.city, "—"),
          khoji: renderVal(targetObj.Khoji || targetObj.khoji || l.Khoji, "—"),
          calledFor: renderVal(targetObj.calledFor || targetObj.called_for || l.calledFor || l.programName, "—"),
          attender: renderVal(targetObj.attenderName || l.attenderName || targetObj.assignedTo, "Unassigned"),
          status: renderVal(getCanonicalStage(targetObj), "4. Nurture / Interested"),
          stage: "4. Nurture / Interested",
          updatedAt: targetObj.updatedAt || targetObj.lastCalledAt || l.timestamp
        });
      }
    });
    return Array.from(map.values());
  }, [filteredLogs, callLogs]);

  const interestedCallsList = useMemo(() => {
    return filteredLogs
      .filter(l => l.isHistory && getCanonicalStatus(l.status) === "Interested")
      .map((l, idx) => {
        const ts = parseTimestamp(l.timestamp || l.createdAt || l.updatedAt);
        const dateTimeStr = formatDateTimeNoSeconds(ts);

        return {
          id: l.id || `int_call_${idx}`,
          name: renderVal(l.Name || l.contactName || l.name, "Unknown"),
          phone: renderVal(getContactPhone(l) || l.Phone || l.phone, "—"),
          city: renderVal(l.city || l.City, "—"),
          khoji: renderVal(l.Khoji || l.khoji, "—"),
          calledFor: renderVal(l.calledFor || l.programName, "—"),
          attender: renderVal(l.attenderName || l.assignedTo, "Unassigned"),
          status: renderVal(l.status, "Interested"),
          dateTime: dateTimeStr,
          timestamp: ts,
          remark: renderVal(l.remark, "—")
        };
      })
      .sort((a, b) => (b.timestamp ? b.timestamp.getTime() : 0) - (a.timestamp ? a.timestamp.getTime() : 0));
  }, [filteredLogs]);

  const callPurposeData = useMemo(() => {
    const counts = { SALES: 0, QUERY: 0, REMINDER: 0 };
    filteredLogs.forEach(l => {
      if (!l.isHistory) return;
      const p = String(l.purpose || l.callPurpose || "SALES").toUpperCase();
      if (counts[p] !== undefined) counts[p]++;
      else counts.SALES++;
    });
    return [
      { name: "Sales Calls", value: counts.SALES, fill: "#6366f1" },
      { name: "Query Calls", value: counts.QUERY, fill: "#f59e0b" },
      { name: "Reminder Calls", value: counts.REMINDER, fill: "#0284c7" }
    ].filter(d => d.value > 0);
  }, [filteredLogs]);

  const callbackComplianceMetrics = useMemo(() => {
    let totalScheduled = 0;
    let completed = 0;
    let overdue = 0;
    let upcoming = 0;

    const todayStr = getLocalDateStr(new Date());

    filteredLogs.forEach(l => {
      let cbDateRaw = l.callbackDate || l.callback_date;
      if (!cbDateRaw && l.attenderStates) {
        Object.values(l.attenderStates).forEach(st => {
          if (st?.callbackDate) cbDateRaw = st.callbackDate;
        });
      }
      if (!cbDateRaw) return;

      const cbStatus = String(l.callbackStatus || l.callback_status || "").toLowerCase().trim();
      const isCompleted = cbStatus === "completed" || cbStatus === "done" || cbStatus === "called";
      const isCancelled = cbStatus === "cancelled";

      if (isCancelled) return;

      totalScheduled++;

      const parsedCb = parseTimestamp(cbDateRaw);
      const cbDateStr = parsedCb ? getLocalDateStr(parsedCb) : "";

      if (isCompleted) {
        completed++;
      } else if (cbDateStr && cbDateStr < todayStr) {
        overdue++;
      } else {
        upcoming++;
      }
    });

    const evaluated = completed + overdue;
    const complianceRate = evaluated > 0 ? Math.round((completed / evaluated) * 100) : 100;

    return {
      totalScheduled,
      completed,
      overdue,
      upcoming,
      complianceRate
    };
  }, [filteredLogs]);

  const objectionReasonData = useMemo(() => {
    const map = {};
    filteredLogs.forEach(l => {
      if (getCanonicalStatus(l.status) === "Not Interested" || l.objectionReason) {
        const reason = l.objectionReason || l["Reason for Not Interested"] || "Unspecified";
        map[reason] = (map[reason] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredLogs]);

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
            <span className="text-xs text-slate-500 font-medium">{filteredLogs.length} total activities ({totalPhysicalCalls} physical calls)</span>

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Calls", value: totalPhysicalCalls, sub: "Physical call events (contact.history)" },
          { 
            label: "Total Registrations", 
            value: programRegistrationsList.length, 
            color: "text-emerald-600", 
            sub: "Total program registrations by registration ID", 
            inspectable: true,
            onClickInspect: () => {
              setInspectSearch("");
              setInspectModal({
                title: "Program Registrations — By Registration ID",
                subtitle: "Total program registrations tracked by unique registration ID",
                type: "registered_programs",
                items: programRegistrationsList
              });
            }
          },
          { 
            label: "Interested Calls", 
            value: totalInterestedCalls, 
            color: "text-amber-600", 
            sub: "Calls logged with Interested outcome", 
            inspectable: true,
            onClickInspect: () => {
              setInspectSearch("");
              setInspectModal({
                title: "Interested Calls — Logged Activities",
                subtitle: "Every call logged with Interested outcome (with Date & Time)",
                type: "interested_calls",
                items: interestedCallsList
              });
            }
          },
        ].map(s => (
          <div key={s.label} className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                {s.inspectable && (
                  <button
                    type="button"
                    onClick={s.onClickInspect}
                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title={`Inspect ${s.label}`}
                  >
                    <Eye size={12} /> Inspect
                  </button>
                )}
              </div>
              {callLogsLoading ? (
                <div className="h-8 w-24 bg-slate-200 animate-pulse rounded-md mt-1" />
              ) : (
                <p className={`text-2xl font-bold ${s.color || "text-slate-900"} mt-1`}>{s.value}</p>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
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

      {/* Row 2: Call Purpose & Objection Reasons Analytics */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Call Purpose Split */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Call Purpose Breakdown</span>
            <span className="text-[10px] text-slate-400 font-normal">Sales vs Query vs Reminder</span>
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-[200px]">
            <div className="w-full sm:w-1/2 h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={callPurposeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={35}
                    paddingAngle={2}
                  >
                    {callPurposeData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "none", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 grid grid-cols-1 gap-y-2 text-xs font-medium text-slate-600 self-center">
              {(() => {
                const total = callPurposeData.reduce((sum, item) => sum + item.value, 0);
                return callPurposeData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-slate-700 font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-900 font-bold">{item.value}</span>
                      <span className="text-slate-400 text-[10px]">({total ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Callback Compliance & Overdue Follow-ups */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Callback Compliance & Follow-ups</span>
              <span className="text-[10px] text-slate-400 font-normal">Attender Follow-up Rate</span>
            </h3>

            {/* Compliance KPI Banner */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-md border border-slate-100 mb-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">On-Time Compliance</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={`text-2xl font-bold ${
                    callbackComplianceMetrics.complianceRate >= 80 ? "text-emerald-600" :
                    callbackComplianceMetrics.complianceRate >= 50 ? "text-amber-600" : "text-rose-600"
                  }`}>
                    {callbackComplianceMetrics.complianceRate}%
                  </span>
                  <span className="text-xs font-medium text-slate-500">Rate</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  callbackComplianceMetrics.overdue > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {callbackComplianceMetrics.overdue > 0 ? `${callbackComplianceMetrics.overdue} Overdue` : "All Callbacks Up-to-Date"}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>Completed vs Overdue Progress</span>
                <span>{callbackComplianceMetrics.completed} / {callbackComplianceMetrics.totalScheduled} Callbacks</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                {callbackComplianceMetrics.totalScheduled > 0 ? (
                  <>
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(callbackComplianceMetrics.completed / callbackComplianceMetrics.totalScheduled) * 100}%` }}
                      title={`Completed: ${callbackComplianceMetrics.completed}`}
                    />
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${(callbackComplianceMetrics.overdue / callbackComplianceMetrics.totalScheduled) * 100}%` }}
                      title={`Overdue: ${callbackComplianceMetrics.overdue}`}
                    />
                    <div
                      className="h-full bg-sky-400 transition-all duration-300"
                      style={{ width: `${(callbackComplianceMetrics.upcoming / callbackComplianceMetrics.totalScheduled) * 100}%` }}
                      title={`Scheduled/Upcoming: ${callbackComplianceMetrics.upcoming}`}
                    />
                  </>
                ) : (
                  <div className="h-full bg-slate-200 w-full" />
                )}
              </div>
            </div>

            {/* 3 Metric Pill Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50/60 border border-emerald-100 p-2 rounded text-center">
                <p className="text-[10px] text-emerald-700 font-medium">Completed</p>
                <p className="text-base font-bold text-emerald-800 mt-0.5">{callbackComplianceMetrics.completed}</p>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 p-2 rounded text-center">
                <p className="text-[10px] text-rose-700 font-medium">Overdue</p>
                <p className="text-base font-bold text-rose-800 mt-0.5">{callbackComplianceMetrics.overdue}</p>
              </div>
              <div className="bg-sky-50/60 border border-sky-100 p-2 rounded text-center">
                <p className="text-[10px] text-sky-700 font-medium">Upcoming</p>
                <p className="text-base font-bold text-sky-800 mt-0.5">{callbackComplianceMetrics.upcoming}</p>
              </div>
            </div>
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
                const dateVal = parseTimestamp(c.timestamp || c.registeredAt || c.lastCalledAt || c.createdAt);
                const dateStr = dateVal ? dateVal.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
                const cName = renderVal(c.contactName || c.name || c.Name, "Unknown");
                const cPhone = getContactPhone(c) || renderVal(c.contactPhone || c.phone || c.Phone || c.Mobile || c.mobile || c.normalizedMobile, "—");
                const cCity = renderVal(c.contactCity || c.city, "");
                const attenderName = renderVal(c.attenderName || c.attender, "Unassigned");
                const programName = renderVal(c.programName || c.calledFor, "—");
                const sourceVal = renderVal(c.source || c.Source, "—");
                const calledForVal = renderVal(c.calledFor || c.programName, "—");
                const feedbackVal = renderVal(c.feedback || c.userFeedback, "—");
                const remarkVal = renderVal(c.remark || c.Remark, "—");

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    {/* Name & Contact */}
                    <td className="px-3.5 py-2.5">
                      <div className="font-semibold text-slate-900">{cName}</div>
                      {cPhone && cPhone !== "—" && <div className="text-indigo-600 font-mono text-[11px]">{cPhone}</div>}
                      {cCity && cCity !== "—" && <div className="text-[10px] text-slate-400">{cCity}</div>}
                    </td>
                    {/* Attender */}
                    <td className="px-3.5 py-2.5 font-medium text-slate-700">
                      {attenderName}
                    </td>
                    {/* Tag / Program */}
                    <td className="px-3.5 py-2.5">
                      <div className="text-slate-700 font-medium truncate max-w-[140px]">{programName}</div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {c.tags.slice(0, 2).map((t, tIdx) => (
                            <span key={tIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold">
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
                      <div className="font-medium text-slate-700">{sourceVal}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Called for: {calledForVal}</div>
                    </td>
                    {/* Date & Time */}
                    <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                      {dateStr}
                    </td>
                    {/* User Feedback */}
                    <td className="px-3.5 py-2.5">
                      <p className="max-w-[180px] truncate text-slate-600" title={feedbackVal}>
                        {feedbackVal}
                      </p>
                    </td>
                    {/* Remarks */}
                    <td className="px-3.5 py-2.5">
                      <p className="max-w-[180px] truncate text-slate-600" title={remarkVal}>
                        {remarkVal}
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

      {/* INSPECT REGISTRATIONS / PEOPLE MODAL */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Eye size={18} className="text-emerald-600" /> {inspectModal.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{inspectModal.subtitle}</p>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search and Action Bar */}
            <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by contact name, phone, program, or attender..."
                  value={inspectSearch}
                  onChange={(e) => setInspectSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={() => {
                  const filteredItems = inspectModal.items.filter(item => {
                    if (!inspectSearch.trim()) return true;
                    const q = inspectSearch.toLowerCase();
                    return (
                      (item.name || "").toLowerCase().includes(q) ||
                      (item.phone || "").toLowerCase().includes(q) ||
                      (item.calledFor || "").toLowerCase().includes(q) ||
                      (item.attender || "").toLowerCase().includes(q) ||
                      (item.city || "").toLowerCase().includes(q) ||
                      (item.remark || "").toLowerCase().includes(q)
                    );
                  });
                  const ws = XLSX.utils.json_to_sheet(filteredItems.map((item, idx) => ({
                    "#": idx + 1,
                    "Name": item.name,
                    "Phone": item.phone,
                    "Date & Time": item.dateTime || "",
                    "City": item.city,
                    "Khoji": item.khoji,
                    "Called For / Program": item.calledFor,
                    "Attender": item.attender,
                    "Stage / Status": item.status,
                    "Remark": item.remark || ""
                  })));
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Inspected List");
                  XLSX.writeFile(wb, `${inspectModal.type}_contacts_export.xlsx`);
                  toast.success("Inspected list exported to Excel!");
                }}
                className="flex items-center gap-1.5 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <Download size={14} /> Export List
              </button>
            </div>

            {/* Table View */}
            <div className="overflow-y-auto overflow-x-hidden flex-1 text-xs">
              {(() => {
                const filtered = inspectModal.items.filter(item => {
                  if (!inspectSearch.trim()) return true;
                  const q = inspectSearch.toLowerCase();
                  return (
                    (item.name || "").toLowerCase().includes(q) ||
                    (item.phone || "").toLowerCase().includes(q) ||
                    (item.calledFor || "").toLowerCase().includes(q) ||
                    (item.attender || "").toLowerCase().includes(q) ||
                    (item.city || "").toLowerCase().includes(q) ||
                    (item.remark || "").toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400">
                      No matching records found.
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 w-8">#</th>
                        <th className="py-2.5 px-3 w-36">Name & Phone</th>
                        {inspectModal.type === "interested_calls" && <th className="py-2.5 px-3 w-36">Date & Time</th>}
                        <th className="py-2.5 px-3 w-24">City / Khoji</th>
                        <th className="py-2.5 px-3 w-28">Program / Called For</th>
                        <th className="py-2.5 px-3 w-24">Attender</th>
                        <th className="py-2.5 px-3 w-28">Stage Status</th>
                        {inspectModal.type === "interested_calls" && <th className="py-2.5 px-3">Remark</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filtered.map((item, idx) => (
                        <tr key={item.id + "_" + idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 truncate" title={`${item.name} (${item.phone})`}>
                            <div className="truncate">{item.name}</div>
                            <div className="text-[11px] font-normal text-slate-500 font-mono truncate">{item.phone}</div>
                          </td>
                          {inspectModal.type === "interested_calls" && (
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {item.dateTime}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-slate-600 truncate">
                            <div className="truncate">{item.city}</div>
                            {item.khoji !== "—" && <span className="text-[10px] text-slate-400 block truncate">{item.khoji}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-indigo-700 font-semibold truncate" title={item.calledFor}>{item.calledFor}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium truncate" title={item.attender}>{item.attender}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              inspectModal.type === "stage6"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          {inspectModal.type === "interested_calls" && (
                            <td className="py-2.5 px-3 text-slate-600 truncate max-w-0" title={item.remark}>
                              {item.remark}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {inspectModal.items.filter(item => {
                  if (!inspectSearch.trim()) return true;
                  const q = inspectSearch.toLowerCase();
                  return (
                    (item.name || "").toLowerCase().includes(q) ||
                    (item.phone || "").toLowerCase().includes(q) ||
                    (item.calledFor || "").toLowerCase().includes(q) ||
                    (item.attender || "").toLowerCase().includes(q)
                  );
                }).length} of {inspectModal.items.length} {inspectModal.type === "registered_programs" ? "registration records" : "unique contacts"}
              </span>
              <button
                onClick={() => setInspectModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
