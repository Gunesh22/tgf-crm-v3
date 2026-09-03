import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  BarChart3, Users, PhoneCall, TrendingUp, Award, Filter, X, Download, 
  ArrowRight, CheckCircle2, AlertTriangle, Clock, RefreshCw, Layers, ShieldCheck, HelpCircle,
  ChevronDown, ChevronUp, Info, UserCheck, Eye, Search, Check
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid 
} from "recharts";
import { 
  parseTimestamp, renderVal, getCanonicalStatus, classifyCallStatus, COLORS, getContactName, getContactPhone, getContactCity, getCanonicalStage, getLocalDateStr, getCanonicalPhysicalCalls, getCanonicalRegistrations, getCanonicalQueryStage 
} from "../utils.jsx";
import { PIPELINE_STAGES, QUERY_PIPELINE_STAGES, getEffectiveStage } from "../../../utils/pipelineEngine";

// Multi-select dropdown component
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

// Approved 2-Stage Evidence-based Call Purpose Classifier
export const getCallPurpose = (h = {}, contact = {}) => {
  const explicit = (h.callPurpose || h.purpose || "").toLowerCase().trim();
  if (explicit === "sales") return "sales";
  if (explicit === "query") return "query";
  if (explicit === "reminder") return "reminder";

  const remark = (h.remark || h.comment || contact.remark || "").toLowerCase().trim();
  const status = (h.status || contact.status || "").toLowerCase().trim();
  const calledFor = (h.calledFor || contact.calledFor || contact.programName || "").toLowerCase().trim();

  // 1. Query Evidence
  const isQueryRemark = remark.includes("query") || remark.includes("doubt") || remark.includes("question") || 
                        remark.includes("asking about") || remark.includes("asked about") || remark.includes("shivir query") || 
                        remark.includes("fee detail asked") || remark.includes("inquiry") || remark.includes("location") ||
                        remark.includes("timing") || remark.includes("batch timing") || remark.includes("when is next") ||
                        remark.includes("offline possible") || remark.includes("bus ki suvidha") || remark.includes("suvidha");
  const isQueryStatus = status.includes("query") || status === "query desk";
  if (isQueryRemark || isQueryStatus) return "query";

  // 2. Reminder Evidence
  const isReminderRemark = remark.includes("reminder") || remark.includes("remind") || remark.includes("payment link") || 
                           remark.includes("session link") || remark.includes("zoom link") || remark.includes("whatsapp link") ||
                           remark.includes("webinar link") || remark.includes("event reminder") || remark.includes("workshop reminder") ||
                           remark.includes("passcode");
  const isReminderStatus = status.includes("reminder");
  if (isReminderRemark || isReminderStatus) return "reminder";

  // 3. High-Confidence Sales Evidence
  const isSalesStatus = status.includes("info given") || status.includes("information given") || 
                        status.includes("interested") || status.includes("reg.done") || status.includes("registered") ||
                        status.includes("not interested") || status.includes("future pool") || status.includes("next time") ||
                        status.includes("attempting") || status.includes("new lead");
  const isSalesRemark = remark.includes("info given") || remark.includes("explained") || remark.includes("details sent") ||
                        remark.includes("shivir info") || remark.includes("will join") || remark.includes("interested") ||
                        remark.includes("fees given") || remark.includes("program info") || remark.includes("call back for sales") ||
                        remark.includes("registration done") || remark.includes("reg.done");
  if (isSalesStatus || isSalesRemark) return "sales";

  // 4. Check for Generic Call Attempt / Unconnected Attempt with Program Context
  if (status.includes("busy") || status.includes("call cut") || status.includes("na") || status.includes("switched off") || status.includes("no answer") || status.includes("invalid no") || status.includes("no network") || status.includes("call log added")) {
    if (calledFor || contact.pipelineStage) {
      return "sales";
    }
  }

  // 5. Secondary Review Pass for Ambiguous/Blank items
  if (remark.includes("called by mistake") || remark.includes("by mistake") || status.includes("called by mistake") || remark.includes("tetette")) {
    return "unknown_legacy";
  }

  const salesKeywords = [
    "next batch", "added in", "batch", "group", "program", "not attended", "link send", 
    "link sent", "not possible to attend", "next program", "basic program", "shivir",
    "future", "postpone", "august", "july", "september", "october", "reg.d", "already reg"
  ];
  const hasSalesKeyword = salesKeywords.some(k => remark.includes(k) || status.includes(k));
  if (hasSalesKeyword) return "sales";

  const isCallAttemptStatus = status.includes("not attended") || status.includes("not possible");
  const isCallAttemptRemark = remark.includes("not connected") || remark.includes("call not received") || 
                              remark.includes("incoming call") || remark.includes("number not available");

  if ((isCallAttemptStatus || isCallAttemptRemark) && (calledFor || contact.pipelineStage)) {
    return "sales";
  }

  if (remark.includes("fee") || remark.includes("amount") || remark.includes("price") || remark.includes("cost") || remark.includes("bus ki suvidha") || remark.includes("suvidha")) {
    return "query";
  }

  if (remark.includes("registration done") || remark.includes("reg.done") || remark.includes("registered")) {
    return "sales";
  }

  if (remark.includes("link") || remark.includes("zoom") || remark.includes("passcode")) {
    return "reminder";
  }

  return "unknown_legacy";
};

// Canonical Helper 1: Program Identity Matcher
const matchesProgramRecord = (record, targetProgramIds, programsList) => {
  if (!targetProgramIds || targetProgramIds.length === 0) return true;
  return targetProgramIds.some(pId => {
    const progObj = (programsList || []).find(p => String(p.id || p._id || p.key || p.name) === String(pId));
    const pName = progObj ? progObj.name.toLowerCase().trim() : String(pId).toLowerCase().trim();
    const targetIdClean = String(pId).toLowerCase().trim();

    const recProgId = String(record.programId || record.calledForKey || "").toLowerCase().trim();
    const recCalledFor = String(record.calledFor || record.programName || "").toLowerCase().trim();
    if (recProgId === targetIdClean || recCalledFor === pName || recCalledFor === targetIdClean) return true;

    if (Array.isArray(record.history)) {
      return record.history.some(h => {
        const hProgId = String(h.programId || h.calledForKey || "").toLowerCase().trim();
        const hCalledFor = String(h.calledFor || "").toLowerCase().trim();
        return hProgId === targetIdClean || hCalledFor === pName || hCalledFor === targetIdClean;
      });
    }

    return false;
  });
};

// Canonical Helper 2: Attender Identity Set Resolution
const getRecordAttenderIds = (record) => {
  const ids = new Set();
  if (record.attenderId) ids.add(String(record.attenderId));
  if (Array.isArray(record.assignedTo)) record.assignedTo.forEach(id => ids.add(String(id)));
  if (record.attenderStates && typeof record.attenderStates === "object") {
    Object.keys(record.attenderStates).forEach(id => ids.add(String(id)));
  }
  if (Array.isArray(record.history)) {
    record.history.forEach(h => { if (h.attenderId) ids.add(String(h.attenderId)); });
  }
  return ids;
};

export default function PipelineCallsTab({ callLogs = [], registrations = [], programs = [], attenders = [], settingsOptions = {} }) {
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
  const currentMonthFirstDay = `${todayStr.slice(0, 7)}-01`;
  const currentMonthLastDay = (() => {
    const lastDay = new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0).getDate();
    return `${todayStr.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  })();

  // Top Filter States
  const [dateFrom, setDateFrom] = useState(currentMonthFirstDay);
  const [dateTo, setDateTo] = useState(currentMonthLastDay);
  const [dateMode, setDateMode] = useState("call"); // "call" or "contact"
  const [selectedProgramIds, setSelectedProgramIds] = useState([]);
  const [selectedAttenderIds, setSelectedAttenderIds] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedCalledFors, setSelectedCalledFors] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCallTypes, setSelectedCallTypes] = useState([]);
  const [selectedKhojiStatuses, setSelectedKhojiStatuses] = useState([]);
  const [selectedPurposes, setSelectedPurposes] = useState([]);
  const [selectedPipelineStages, setSelectedPipelineStages] = useState([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState([]);



  // Drill-down Modals
  const [drillDownModal, setDrillDownModal] = useState(null); // { title: string, type: string, items: Array }
  const [drillSearch, setDrillSearch] = useState("");
  const [attenderDetailModal, setAttenderDetailModal] = useState(null);

  // 1. EXTRACT ALL HISTORICAL CALL EVENTS
  const allCallEvents = useMemo(() => {
    const events = [];
    const seenCallIds = new Set();

    (callLogs || []).forEach(contact => {
      const cId = contact.id || contact._id || contact.Phone || contact.Name;
      const cName = getContactName(contact);
      const cPhone = getContactPhone(contact);
      const cCity = getContactCity(contact);
      const cStage = getCanonicalStage(contact);

      if (Array.isArray(contact.history) && contact.history.length > 0) {
        contact.history.forEach((h, idx) => {
          const ts = parseTimestamp(h.timestamp || h.date || h.createdAt);
          const callId = h.callId || h.id || `legacy_call_${cId}_${idx}_${ts ? ts.getTime() : idx}`;
          if (seenCallIds.has(callId)) return;
          seenCallIds.add(callId);

          let attId = h.attenderId;
          let attName = h.attenderName;

          if (!attId && attName) {
            const cleanName = attName.trim().toLowerCase();
            const matchedAttender = (attenders || []).find(a => (a.name || "").trim().toLowerCase() === cleanName);
            if (matchedAttender) {
              attId = matchedAttender.id || matchedAttender._id;
            }
          }

          if (!attId && !attName) {
            attId = contact.attenderId;
            attName = contact.attenderName;
            if (!attId && attName) {
              const cleanName = attName.trim().toLowerCase();
              const matchedAttender = (attenders || []).find(a => (a.name || "").trim().toLowerCase() === cleanName);
              if (matchedAttender) {
                attId = matchedAttender.id || matchedAttender._id;
              }
            }
          }

          if (!attId) attId = "unassigned";
          if (!attName) attName = "Unassigned Attender";

          const rawCallStage = h.pipelineStage || h.stage || (h.status ? getCanonicalStage(h.status) : null);
          const callStage = rawCallStage ? getCanonicalStage(rawCallStage) : cStage;

          events.push({
            callId,
            contactId: cId,
            contactName: cName,
            contactPhone: cPhone,
            contactCity: cCity,
            pipelineStage: callStage,
            status: h.status || contact.status || "Pending",
            callType: (h.callType || contact.callType || "outgoing").toLowerCase(),
            purpose: getCallPurpose(h, contact),
            source: h.source || contact.source || "",
            calledFor: h.calledFor || contact.calledFor || contact.programName || "",
            programId: h.programId || h.calledForKey || contact.programId || contact.calledForKey || "",
            calledForKey: h.calledForKey || h.programId || contact.calledForKey || contact.programId || "",
            attenderId: attId,
            attenderName: attName,
            timestamp: ts,
            dateStr: ts ? getLocalDateStr(ts) : "",
            remark: h.remark || "",
            contactCreatedAt: parseTimestamp(contact.createdAt || contact.date_added)
          });
        });
      }
    });

    return events;
  }, [callLogs, attenders]);

  // 2. FILTERED CALL EVENTS
  const filteredEvents = useMemo(() => {
    return allCallEvents.filter(ev => {
      if (dateFrom || dateTo) {
        const compareDate = dateMode === "call" ? ev.timestamp : ev.contactCreatedAt;
        if (!compareDate) return false;
        const dStr = getLocalDateStr(compareDate);
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
      }

      if (selectedAttenderIds.length > 0) {
        const attenderIds = getRecordAttenderIds(ev);
        if (!selectedAttenderIds.some(id => attenderIds.has(String(id)))) return false;
      }

      if (!matchesProgramRecord(ev, selectedProgramIds, programs)) return false;

      if (selectedSources.length > 0) {
        if (!selectedSources.includes(ev.source)) return false;
      }

      if (selectedCalledFors.length > 0) {
        if (!selectedCalledFors.includes(ev.calledFor)) return false;
      }

      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(ev.status)) return false;
      }

      if (selectedCallTypes.length > 0) {
        const isInc = (ev.callType || "").toLowerCase().startsWith("in");
        const type = isInc ? "incoming" : "outgoing";
        if (!selectedCallTypes.includes(type)) return false;
      }

      if (selectedPurposes.length > 0) {
        const evPurpose = String(ev.purpose || "SALES").toUpperCase().trim();
        const hasMatch = selectedPurposes.some(p => String(p).toUpperCase().trim() === evPurpose);
        if (!hasMatch) return false;
      }

      if (selectedPipelineStages.length > 0) {
        if (!selectedPipelineStages.includes(ev.pipelineStage)) return false;
      }

      if (selectedOutcomes.length > 0) {
        const cStatus = getCanonicalStatus(ev.status);
        if (!selectedOutcomes.includes(cStatus)) return false;
      }

      return true;
    });
  }, [allCallEvents, dateFrom, dateTo, dateMode, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors, selectedStatuses, selectedCallTypes, selectedPurposes, selectedPipelineStages, selectedOutcomes, programs]);

  // 3. FILTERED CONTACTS
  const filteredContacts = useMemo(() => {
    return (callLogs || []).filter(c => {
      if (selectedAttenderIds.length > 0) {
        const attenderIds = getRecordAttenderIds(c);
        if (!selectedAttenderIds.some(id => attenderIds.has(String(id)))) return false;
      }

      if (!matchesProgramRecord(c, selectedProgramIds, programs)) return false;

      if (selectedSources.length > 0) {
        const srcKey = Object.keys(c).find(k => ["source", "sourse", "source of information", "source of informiton"].includes(k.toLowerCase()));
        const srcVal = srcKey ? String(c[srcKey] || "").trim() : "";
        if (!selectedSources.includes(srcVal)) return false;
      }

      if (selectedCalledFors.length > 0) {
        const cfKey = Object.keys(c).find(k => ["calledfor", "called for", "programname"].includes(k.toLowerCase()));
        const cfVal = cfKey ? String(c[cfKey] || "").trim() : "";
        if (!selectedCalledFors.includes(cfVal)) return false;
      }

      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(String(c.status || "").trim())) return false;
      }

      if (selectedCallTypes.length > 0) {
        const cType = (c.callType || "outgoing").toLowerCase();
        const isInc = cType.startsWith("in");
        const type = isInc ? "incoming" : "outgoing";
        if (!selectedCallTypes.includes(type)) return false;
      }

      if (selectedKhojiStatuses.length > 0) {
        const khojiVal = String(c.Khoji || c.khoji || c["Khoji Type"] || "No").trim();
        if (!selectedKhojiStatuses.includes(khojiVal)) return false;
      }

      if (selectedPipelineStages.length > 0) {
        const stage = getCanonicalStage(c);
        if (!selectedPipelineStages.includes(stage)) return false;
      }

      if (dateFrom || dateTo) {
        if (dateMode === "contact") {
          const cDate = parseTimestamp(c.createdAt || c.date_added);
          if (cDate) {
            const dStr = getLocalDateStr(cDate);
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
          } else {
            return false;
          }
        } else {
          // dateMode === "call" (default) - ONLY real physical call timestamps (no generic updatedAt)
          const activityDates = [];
          const lastCall = parseTimestamp(c.lastCalledAt);
          if (lastCall) activityDates.push(lastCall);

          if (Array.isArray(c.history)) {
            c.history.forEach(h => {
              const hTs = parseTimestamp(h.timestamp || h.date || h.createdAt);
              if (hTs) activityDates.push(hTs);
            });
          }

          if (activityDates.length === 0) return false;

          const hasMatch = activityDates.some(d => {
            const dStr = getLocalDateStr(d);
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
            return true;
          });

          if (!hasMatch) return false;
        }
      }

      return true;
    });
  }, [callLogs, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors, selectedStatuses, selectedCallTypes, selectedKhojiStatuses, selectedPipelineStages, dateFrom, dateTo, dateMode, programs]);

  // 4. FILTERED REGISTRATIONS (CANONICAL SOURCE OF TRUTH)
  const filteredRegistrations = useMemo(() => {
    return getCanonicalRegistrations(registrations, callLogs, {
      startDate: dateFrom,
      endDate: dateTo,
      selectedAttenderIds,
      selectedProgramIds,
      selectedSources,
      selectedCalledFors
    });
  }, [registrations, callLogs, dateFrom, dateTo, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors]);

  // METRICS
  const totalCallsCount = filteredEvents.length;
  const connectedCallsCount = useMemo(() => {
    return filteredEvents.filter(ev => classifyCallStatus(ev.status) === "CONNECTED").length;
  }, [filteredEvents]);

  const connectedRate = totalCallsCount > 0 ? ((connectedCallsCount / totalCallsCount) * 100).toFixed(1) : "0.0";
  const activeFunnelPeopleCount = filteredContacts.length;
  const registrationsCount = filteredRegistrations.length;

  // Pipeline Stage Counts (Sales Pipeline — Canonicalized)
  const pipelineStageCounts = useMemo(() => {
    const counts = {
      [PIPELINE_STAGES.NEW_LEAD]: 0,
      [PIPELINE_STAGES.ATTEMPTING]: 0,
      [PIPELINE_STAGES.INFO_GIVEN]: 0,
      [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: 0,
      [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
      [PIPELINE_STAGES.FUTURE_POOL]: 0,
      [PIPELINE_STAGES.REGISTERED_WON]: 0,
      [PIPELINE_STAGES.CLOSED_LOST]: 0,
      [PIPELINE_STAGES.CLOSED_INVALID]: 0,
      "Existing Alumni": 0,
      "Unknown / Legacy": 0
    };

    filteredContacts.forEach(c => {
      const stage = getCanonicalStage(c);
      if (stage === "Query Desk" || stage === "Reminder Desk") {
        // Query & Reminder workstreams are tracked separately in their dedicated sections below
        return;
      }
      if (counts[stage] !== undefined) {
        counts[stage]++;
      } else {
        counts["Unknown / Legacy"]++;
      }
    });

    return counts;
  }, [filteredContacts]);

  // Query Pipeline Stage Counts (Independent Query State Machine)
  const queryStageCounts = useMemo(() => {
    const counts = {
      [QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY]: 0,
      [QUERY_PIPELINE_STAGES.QUERY_PENDING]: 0,
      [QUERY_PIPELINE_STAGES.QUERY_SOLVED]: 0,
    };
    filteredContacts.forEach(c => {
      const qStage = getCanonicalQueryStage(c);
      if (qStage && counts[qStage] !== undefined) {
        counts[qStage]++;
      }
    });
    return counts;
  }, [filteredContacts]);

  // Reminder Activity Summary (Activity Metric, Not a Pipeline)
  const reminderCounts = useMemo(() => {
    let reminderCallsCount = 0;
    let reminderContactsCount = 0;
    filteredEvents.forEach(ev => {
      if (String(ev.callPurpose || "").toUpperCase() === "REMINDER" || String(ev.status || "").toLowerCase().includes("reminder")) {
        reminderCallsCount++;
      }
    });
    filteredContacts.forEach(c => {
      const purpose = String(c.callPurpose || "").toUpperCase();
      const status = String(c.status || "").toLowerCase();
      if (purpose === "REMINDER" || status.includes("reminder")) {
        reminderContactsCount++;
      }
    });
    return { reminderCallsCount, reminderContactsCount };
  }, [filteredContacts, filteredEvents]);

  const prevProgPendingBreakdown = useMemo(() => {
    const map = {};
    filteredContacts.forEach(c => {
      const stage = getCanonicalStage(c);
      if (stage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || stage === "Previous Program Pending") {
        const prog = c.previousProgram || c.Source || c.source || "Unspecified";
        map[prog] = (map[prog] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredContacts]);

  // Stage Matrix for Calls vs People
  const pipelineVsCallsMatrix = useMemo(() => {
    const stageCalls = {};
    filteredEvents.forEach(ev => {
      const stage = getCanonicalStage(ev.pipelineStage);
      stageCalls[stage] = (stageCalls[stage] || 0) + 1;
    });

    const stagesList = [
      PIPELINE_STAGES.NEW_LEAD,
      PIPELINE_STAGES.ATTEMPTING,
      PIPELINE_STAGES.INFO_GIVEN,
      PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING,
      PIPELINE_STAGES.NURTURE_INTERESTED,
      PIPELINE_STAGES.FUTURE_POOL,
      PIPELINE_STAGES.REGISTERED_WON,
      PIPELINE_STAGES.CLOSED_LOST,
      PIPELINE_STAGES.CLOSED_INVALID,
      "Query Desk",
      "Reminder Desk",
      "Existing Alumni",
      "Unknown / Legacy"
    ];

    return stagesList.map(st => ({
      stage: st,
      people: pipelineStageCounts[st] || 0,
      calls: stageCalls[st] || 0,
      avgCallsPerPerson: (pipelineStageCounts[st] || 0) > 0 ? ((stageCalls[st] || 0) / pipelineStageCounts[st]).toFixed(1) : "0.0"
    }));
  }, [pipelineStageCounts, filteredEvents]);

  // Attender Performance Table
  const attenderPerformance = useMemo(() => {
    const map = {};
    const EXCLUDED_ATTENDER_NAMES = ["admin", "super admin", "administrator", "agent"];

    // First initialize map for ALL known non-admin attenders
    (attenders || []).forEach(a => {
      if (a.role === 'admin' || EXCLUDED_ATTENDER_NAMES.includes((a.name || "").toLowerCase().trim())) return;
      const attId = a.id || a._id;
      map[attId] = {
        id: attId,
        name: a.name,
        totalCalls: 0,
        connectedCalls: 0,
        interestedCalls: 0,
        regDoneCalls: 0,
        contactIds: new Set()
      };
    });

    // Populate call events
    filteredEvents.forEach(ev => {
      const rawName = (ev.attenderName || "").toLowerCase().trim();
      if (EXCLUDED_ATTENDER_NAMES.includes(rawName)) return;

      const attId = ev.attenderId || "unassigned";
      if (attId === "admin") return;

      if (!map[attId]) {
        map[attId] = {
          id: attId,
          name: ev.attenderName || "Unassigned Attender",
          totalCalls: 0,
          connectedCalls: 0,
          interestedCalls: 0,
          regDoneCalls: 0,
          contactIds: new Set()
        };
      }
      const item = map[attId];
      item.totalCalls++;
      item.contactIds.add(ev.contactId);

      if (classifyCallStatus(ev.status) === "CONNECTED") {
        item.connectedCalls++;
      }
      const s = getCanonicalStatus(ev.status);
      if (s === "Interested") item.interestedCalls++;
      if (s === "Reg.Done") item.regDoneCalls++;
    });

    // Group registrations with multi-level attender resolution (ID, Name, and Contact lookup)
    const regCounts = {};
    filteredRegistrations.forEach(r => {
      let matchedAttenderId = r.attenderId;

      if (!matchedAttenderId && r.attenderName && r.attenderName !== "Unassigned") {
        const cleanName = r.attenderName.trim().toLowerCase();
        const found = (attenders || []).find(a => (a.name || "").trim().toLowerCase() === cleanName);
        if (found) matchedAttenderId = found.id || found._id;
      }

      if (!matchedAttenderId && r.contactId) {
        const matchedContact = (callLogs || []).find(c => String(c.id || c._id) === String(r.contactId));
        if (matchedContact) {
          matchedAttenderId = matchedContact.attenderId;
          if (!matchedAttenderId && matchedContact.attenderName) {
            const cleanName = matchedContact.attenderName.trim().toLowerCase();
            const found = (attenders || []).find(a => (a.name || "").trim().toLowerCase() === cleanName);
            if (found) matchedAttenderId = found.id || found._id;
          }
        }
      }

      if (!matchedAttenderId) matchedAttenderId = "unassigned";

      regCounts[matchedAttenderId] = (regCounts[matchedAttenderId] || 0) + 1;
    });

    return Object.values(map)
      .map(item => {
        const uniqueContactsCount = item.contactIds.size;
        const regCount = regCounts[item.id] || (item.name ? regCounts[item.name.trim().toLowerCase()] : 0) || 0;
        return {
          id: item.id,
          name: item.name,
          totalCalls: item.totalCalls,
          connectedCalls: item.connectedCalls,
          connectedRate: item.totalCalls > 0 ? ((item.connectedCalls / item.totalCalls) * 100).toFixed(1) : "0.0",
          interestedCalls: item.interestedCalls,
          regDoneCalls: item.regDoneCalls,
          registrationsCount: regCount,
          avgCallsPerContact: uniqueContactsCount > 0 ? (item.totalCalls / uniqueContactsCount).toFixed(1) : "0.0"
        };
      })
      .filter(item => !EXCLUDED_ATTENDER_NAMES.includes((item.name || "").toLowerCase().trim()) && (item.totalCalls > 0 || item.registrationsCount > 0 || (attenders || []).some(a => a.id === item.id)))
      .sort((a, b) => b.totalCalls - a.totalCalls);
  }, [filteredEvents, filteredRegistrations, attenders, callLogs]);

  // Attention Needed Lists (Actionable items)
  const attentionNeededLists = useMemo(() => {
    const now = new Date().getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const nurtureNoRecentCall = [];
    const stuckInAttempting = [];
    const stuckInInfoGiven = [];

    filteredContacts.forEach(c => {
      const stage = getCanonicalStage(c);
      const lastCallDate = parseTimestamp(c.lastCalledAt || c.updatedAt || c.createdAt);
      const lastCallMs = lastCallDate ? lastCallDate.getTime() : 0;
      const callCount = (c.history && c.history.length) || 1;

      if (stage === PIPELINE_STAGES.NURTURE_INTERESTED) {
        if (!lastCallMs || (now - lastCallMs) > sevenDaysMs) {
          nurtureNoRecentCall.push(c);
        }
      }

      if (stage === PIPELINE_STAGES.ATTEMPTING && callCount >= 5) {
        stuckInAttempting.push(c);
      }

      if (stage === PIPELINE_STAGES.INFO_GIVEN && (!lastCallMs || (now - lastCallMs) > 10 * 24 * 60 * 60 * 1000)) {
        stuckInInfoGiven.push(c);
      }
    });

    return {
      nurtureNoRecentCall,
      stuckInAttempting,
      stuckInInfoGiven
    };
  }, [filteredContacts]);

  // Helper for clicking stage cards
  const handleStageClick = (stageName, stageValue) => {
    const items = filteredContacts.filter(c => getCanonicalStage(c) === stageValue);
    setDrillDownModal({
      title: `${stageName} — Contacts (${items.length})`,
      type: "people",
      items
    });
  };

  const exportCSV = (filename, headers, rows) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(x => `"${String(x || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${getLocalDateStr(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Options Memos
  const programOptions = useMemo(() => {
    return (programs || []).map(p => ({ value: p.id || p._id || p.key || p.name, label: p.name }));
  }, [programs]);

  const attenderOptions = useMemo(() => {
    return (attenders || [])
      .filter(a => a.role !== 'admin' && !["admin", "super admin", "administrator", "admin test", "test 2", "test2", "test"].includes((a.name || "").toLowerCase().trim()))
      .map(a => ({ value: a.id || a._id, label: a.name }));
  }, [attenders]);

  const sourceOptions = useMemo(() => {
    const sources = new Set(settingsOptions?.sourceOptions || []);
    (callLogs || []).forEach(log => {
      const sourceKey = Object.keys(log).find(k => ["source", "sourse", "source of information", "source of informiton"].includes(k.toLowerCase()));
      const val = sourceKey ? String(log[sourceKey] || "").trim() : "";
      if (val) sources.add(val);
    });
    return Array.from(sources).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const calledForOptions = useMemo(() => {
    const values = new Set();
    (settingsOptions?.calledForOptions || []).forEach(opt => {
      if (opt && typeof opt === "object" && opt.name) values.add(opt.name);
      else if (typeof opt === "string") values.add(opt);
    });
    (callLogs || []).forEach(log => {
      const cfKey = Object.keys(log).find(k => ["calledfor", "called for", "programname"].includes(k.toLowerCase()));
      const val = cfKey ? String(log[cfKey] || "").trim() : "";
      if (val) values.add(val);
    });
    return Array.from(values).sort().map(v => ({ value: v, label: v }));
  }, [callLogs, settingsOptions]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(settingsOptions?.statusOptions || []);
    (callLogs || []).forEach(log => {
      if (log.status) statuses.add(String(log.status).trim());
      if (Array.isArray(log.history)) {
        log.history.forEach(h => {
          if (h.status) statuses.add(String(h.status).trim());
        });
      }
    });
    return Array.from(statuses).sort().map(s => ({ value: s, label: s }));
  }, [callLogs, settingsOptions]);

  const callTypeOptions = useMemo(() => [
    { value: "incoming", label: "Incoming" },
    { value: "outgoing", label: "Outgoing" }
  ], []);

  const khojiStatusOptions = useMemo(() => [
    { value: "Yes", label: "Yes (Khoji)" },
    { value: "No", label: "No (New)" },
    { value: "Dew drop khoji", label: "Dew drop khoji" }
  ], []);

  const activeFilters = [
    selectedProgramIds.length > 0 && selectedProgramIds.length < programOptions.length,
    selectedAttenderIds.length > 0 && selectedAttenderIds.length < attenderOptions.length,
    selectedSources.length > 0 && selectedSources.length < sourceOptions.length,
    selectedCalledFors.length > 0 && selectedCalledFors.length < calledForOptions.length,
    selectedStatuses.length > 0 && selectedStatuses.length < statusOptions.length,
    selectedCallTypes.length > 0 && selectedCallTypes.length < callTypeOptions.length,
    selectedKhojiStatuses.length > 0 && selectedKhojiStatuses.length < khojiStatusOptions.length,
    selectedPurposes.length > 0,
    selectedPipelineStages.length > 0,
    selectedOutcomes.length > 0,
    (dateFrom && dateFrom !== currentMonthFirstDay) || (dateTo && dateTo !== currentMonthLastDay)
  ].filter(Boolean).length;

  const resetFilters = () => {
    setDateFrom(currentMonthFirstDay);
    setDateTo(currentMonthLastDay);
    setSelectedProgramIds([]);
    setSelectedAttenderIds([]);
    setSelectedSources([]);
    setSelectedCalledFors([]);
    setSelectedStatuses([]);
    setSelectedCallTypes([]);
    setSelectedKhojiStatuses([]);
    setSelectedPurposes([]);
    setSelectedPipelineStages([]);
    setSelectedOutcomes([]);
  };

  return (
    <div className="space-y-6 pb-12 text-slate-800 animate-in fade-in duration-200 max-w-[1400px] mx-auto">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">📈</span>
            Pipeline & Call Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Executive operational overview separating calls, funnel stages, and registration records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV("Pipeline_Contacts", ["Contact Name", "Phone", "Pipeline Stage", "Attender", "Called For"], filteredContacts.map(c => [getContactName(c), getContactPhone(c), getCanonicalStage(c), c.attenderName || "Unassigned", c.calledFor || ""]))}
            className="flex items-center gap-1.5 h-8 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={13} /> Export Contacts
          </button>
          <button
            onClick={() => exportCSV("Call_Events", ["Call ID", "Contact Name", "Status", "Attender", "Call Date"], filteredEvents.map(e => [e.callId, e.contactName, e.status, e.attenderName, e.dateStr]))}
            className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={13} /> Export Calls
          </button>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
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

                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Mode:</span>
                    <button
                      type="button"
                      onClick={() => setDateMode("call")}
                      className={`h-7 px-2 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                        dateMode === "call"
                          ? "bg-slate-800 border-slate-800 text-white shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                      title="Filter contacts by Call Activity / Updated Date"
                    >
                      📞 Call Activity
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode("contact")}
                      className={`h-7 px-2 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                        dateMode === "contact"
                          ? "bg-slate-800 border-slate-800 text-white shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                      title="Filter contacts by Lead Creation Date"
                    >
                      👤 Lead Created
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{filteredEvents.length} activities ({activeFunnelPeopleCount} contacts)</span>

            {activeFilters > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 h-8 px-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-xs font-medium hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X size={12} /> Clear filters
                <span className="bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{activeFilters}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. EXECUTIVE SUMMARY — 4 KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-200 transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL CALLS</span>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{totalCallsCount.toLocaleString()}</p>
          <span className="text-[11px] font-medium text-slate-500 block mt-0.5">All historical call events</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-200 transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CONNECTED RATE</span>
          <p className="text-2xl font-black text-emerald-600 mt-0.5">{connectedRate}%</p>
          <span className="text-[11px] font-medium text-slate-500 block mt-0.5">{connectedCallsCount.toLocaleString()} of {totalCallsCount.toLocaleString()} calls</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-200 transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PEOPLE IN PIPELINE</span>
          <p className="text-2xl font-black text-blue-600 mt-0.5">{activeFunnelPeopleCount.toLocaleString()}</p>
          <span className="text-[11px] font-medium text-slate-500 block mt-0.5">Unique contacts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-200 transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CONFIRMED PROGRAM REGISTRATIONS</span>
          <p className="text-2xl font-black text-purple-600 mt-0.5">{registrationsCount.toLocaleString()}</p>
          <span className="text-[11px] font-medium text-slate-500 block mt-0.5">Registration records</span>
        </div>
      </div>

      {/* 2. PIPELINE & CALL ANALYTICS — SLEEK DENSE FLAT INTERFACE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        
        {/* Top Statistical Summary Header with Subtle Vertical Separators */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-6 divide-x divide-slate-200">
            <div className="pr-4">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">SALES FUNNEL</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black text-slate-900">{Object.values(pipelineStageCounts).reduce((a, b) => a + b, 0)}</span>
                <span className="text-xs font-semibold text-slate-500">leads</span>
              </div>
            </div>

            <div className="px-6">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">QUERY + REMINDER</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black text-amber-700">{activeFunnelPeopleCount - Object.values(pipelineStageCounts).reduce((a, b) => a + b, 0)}</span>
                <span className="text-xs font-semibold text-slate-500">leads</span>
              </div>
            </div>

            <div className="pl-6">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">TOTAL CONTACTS</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black text-indigo-600">{activeFunnelPeopleCount}</span>
                <span className="text-xs font-semibold text-slate-500">total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Header: Sales Pipeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              SALES PIPELINE
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {Object.values(pipelineStageCounts).reduce((a, b) => a + b, 0)} Leads
            </span>
          </div>

          {/* Continuous Strip Sales Pipeline */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/70 rounded-xl border border-slate-200/80 overflow-hidden">
            {[
              { key: "new_lead", label: "New Lead", stageValue: PIPELINE_STAGES.NEW_LEAD },
              { key: "attempting", label: "Attempting Contact", stageValue: PIPELINE_STAGES.ATTEMPTING },
              { key: "info_given", label: "Information Given", stageValue: PIPELINE_STAGES.INFO_GIVEN },
              { key: "nurture", label: "Nurture / Interested", stageValue: PIPELINE_STAGES.NURTURE_INTERESTED },
              { key: "future_pool", label: "Future Pool", stageValue: PIPELINE_STAGES.FUTURE_POOL },
              { key: "registered", label: "Registered / Won", stageValue: PIPELINE_STAGES.REGISTERED_WON, isWon: true }
            ].map(st => {
              const count = pipelineStageCounts[st.stageValue] || 0;
              const totalFunnel = Object.values(pipelineStageCounts).reduce((a, b) => a + b, 0);
              const pct = totalFunnel > 0 ? ((count / totalFunnel) * 100).toFixed(1) : "0.0";

              return (
                <div
                  key={st.key}
                  onClick={() => handleStageClick(st.label, st.stageValue)}
                  className={`p-3.5 hover:bg-white transition-all cursor-pointer group flex flex-col justify-between ${
                    st.isWon ? "bg-emerald-50/40" : ""
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate block">
                    {st.label}
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className={`text-2xl font-black transition-transform group-hover:scale-105 origin-left ${
                      st.isWon ? "text-emerald-600" : count > 0 ? "text-slate-900" : "text-slate-400"
                    }`}>
                      {count}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Previous Program Pending Insight */}
        {prevProgPendingBreakdown.length > 0 && (
          <div className="pt-2">
            <div className="p-3 bg-purple-50/50 border border-purple-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                  PREVIOUS PROGRAM PENDING
                </span>
                <span className="px-2 py-0.5 bg-purple-200 text-purple-900 font-extrabold text-[11px] rounded-full">
                  {prevProgPendingBreakdown.reduce((sum, item) => sum + item.count, 0)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {prevProgPendingBreakdown.map((item) => (
                  <div
                    key={item.name}
                    onClick={() => handleStageClick(`Previous Program Pending — ${item.name}`, PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING)}
                    className="px-2.5 py-1 bg-white border border-purple-200/80 rounded-lg text-xs font-semibold text-purple-900 flex items-center gap-1.5 shadow-2xs hover:bg-purple-100/60 cursor-pointer transition-colors"
                  >
                    <span>{item.name}</span>
                    <span className="font-black text-purple-700">({item.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Auxiliary Outcomes Row (Closed / Lost, Closed / Invalid, Existing Alumni, Legacy) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div
            onClick={() => handleStageClick("Closed / Lost", PIPELINE_STAGES.CLOSED_LOST)}
            className="p-3 bg-rose-50/40 border border-rose-200/80 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100/50 transition-colors"
          >
            <span className="text-xs font-bold text-rose-900">Closed / Lost</span>
            <span className="text-lg font-black text-rose-800">{pipelineStageCounts[PIPELINE_STAGES.CLOSED_LOST] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Closed / Invalid", PIPELINE_STAGES.CLOSED_INVALID)}
            className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-700">Closed / Invalid</span>
            <span className="text-lg font-black text-slate-800">{pipelineStageCounts[PIPELINE_STAGES.CLOSED_INVALID] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Existing Alumni", "Existing Alumni")}
            className="p-3 bg-violet-50/40 border border-violet-200/80 rounded-xl flex items-center justify-between cursor-pointer hover:bg-violet-100/50 transition-colors"
          >
            <span className="text-xs font-bold text-violet-900">Existing Alumni</span>
            <span className="text-lg font-black text-violet-800">{pipelineStageCounts["Existing Alumni"] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Unknown / Legacy", "Unknown / Legacy")}
            className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Info size={13} className="text-slate-400" /> Legacy / Unmapped
            </span>
            <span className="text-lg font-black text-slate-800">{pipelineStageCounts["Unknown / Legacy"] || 0}</span>
          </div>
        </div>

        {/* ── WORKSPACE SECTIONS: QUERY DESK & REMINDER ACTIVITY ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* QUERY DESK */}
          <div className="p-4 bg-slate-50/60 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle size={15} className="text-blue-600" /> QUERY DESK
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {Object.values(queryStageCounts).reduce((a, b) => a + b, 0)} active/history
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div 
                onClick={() => {
                  const items = filteredContacts.filter(c => getCanonicalQueryStage(c) === QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY);
                  setDrillDownModal({ title: `Query Desk: ${QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY} (${items.length})`, type: "people", items });
                }}
                className="p-2.5 bg-white border border-slate-200/80 rounded-lg text-center cursor-pointer hover:bg-slate-100/60 transition-colors"
              >
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Attempting</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{queryStageCounts[QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY] || 0}</span>
              </div>
              <div 
                onClick={() => {
                  const items = filteredContacts.filter(c => getCanonicalQueryStage(c) === QUERY_PIPELINE_STAGES.QUERY_PENDING);
                  setDrillDownModal({ title: `Query Desk: ${QUERY_PIPELINE_STAGES.QUERY_PENDING} (${items.length})`, type: "people", items });
                }}
                className="p-2.5 bg-white border border-amber-200/80 rounded-lg text-center cursor-pointer hover:bg-amber-50/50 transition-colors"
              >
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Pending</span>
                <span className="text-xl font-black text-amber-800 mt-0.5 block">{queryStageCounts[QUERY_PIPELINE_STAGES.QUERY_PENDING] || 0}</span>
              </div>
              <div 
                onClick={() => {
                  const items = filteredContacts.filter(c => getCanonicalQueryStage(c) === QUERY_PIPELINE_STAGES.QUERY_SOLVED);
                  setDrillDownModal({ title: `Query Desk: ${QUERY_PIPELINE_STAGES.QUERY_SOLVED} (${items.length})`, type: "people", items });
                }}
                className="p-2.5 bg-white border border-emerald-200/80 rounded-lg text-center cursor-pointer hover:bg-emerald-50/50 transition-colors"
              >
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Solved</span>
                <span className="text-xl font-black text-emerald-800 mt-0.5 block">{queryStageCounts[QUERY_PIPELINE_STAGES.QUERY_SOLVED] || 0}</span>
              </div>
            </div>
          </div>

          {/* REMINDER ACTIVITY */}
          <div className="p-4 bg-slate-50/60 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={15} className="text-orange-600" /> REMINDER ACTIVITY
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Activity Tracked
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Reminder Calls</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{reminderCounts.reminderCallsCount}</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Contacts</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">{reminderCounts.reminderContactsCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ATTENTION NEEDED — SEPARATE COMPACT ALERT BOX */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-600" /> ATTENTION NEEDED
          </h3>
          <span className="text-xs font-semibold text-slate-500">Actionable lead alerts</span>
        </div>

        <div className="divide-y divide-slate-100 bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden text-xs font-medium">
          <div
            onClick={() => {
              const items = attentionNeededLists.nurtureNoRecentCall;
              setDrillDownModal({ title: `Nurture (>7 days no call) (${items.length})`, type: "people", items });
            }}
            className="p-3.5 hover:bg-white transition-colors cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-600 font-bold text-sm">⚠</span>
              <span className="font-semibold text-slate-800 group-hover:text-amber-900 transition-colors">Nurture leads with no call &gt; 7 days</span>
            </div>
            <span className="font-black text-slate-900 text-sm">{attentionNeededLists.nurtureNoRecentCall.length}</span>
          </div>

          <div
            onClick={() => {
              const items = attentionNeededLists.stuckInAttempting;
              setDrillDownModal({ title: `Attempting (>5 calls stuck) (${items.length})`, type: "people", items });
            }}
            className="p-3.5 hover:bg-white transition-colors cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="text-rose-600 font-bold text-sm">⚠</span>
              <span className="font-semibold text-slate-800 group-hover:text-rose-900 transition-colors">Attempting leads with &gt; 5 calls</span>
            </div>
            <span className="font-black text-slate-900 text-sm">{attentionNeededLists.stuckInAttempting.length}</span>
          </div>

          <div
            onClick={() => {
              const items = attentionNeededLists.stuckInInfoGiven;
              setDrillDownModal({ title: `Information Given (>10 days old) (${items.length})`, type: "people", items });
            }}
            className="p-3.5 hover:bg-white transition-colors cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold text-sm">ℹ</span>
              <span className="font-semibold text-slate-800 group-hover:text-blue-900 transition-colors">Information Given &gt; 10 days old</span>
            </div>
            <span className="font-black text-slate-900 text-sm">{attentionNeededLists.stuckInInfoGiven.length}</span>
          </div>
        </div>
      </div>

      {/* 4. PIPELINE + CALL ACTIVITY MATRIX */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Pipeline Stage vs Calling Activity Breakdown
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">Click any row to inspect underlying contacts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">STAGE</th>
                <th className="px-4 py-2.5 text-indigo-700">PEOPLE</th>
                <th className="px-4 py-2.5 text-slate-900">CALLS</th>
                <th className="px-4 py-2.5">CALLS / PERSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pipelineVsCallsMatrix.map(row => (
                <tr
                  key={row.stage}
                  onClick={() => handleStageClick(row.stage, row.stage)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{row.stage}</td>
                  <td className="px-4 py-2.5 font-bold text-indigo-600">{row.people}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">{row.calls}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{row.avgCallsPerPerson}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. ATTENDER PERFORMANCE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Attender Performance
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">Click row for full detail drawer</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">ATTENDER</th>
                <th className="px-4 py-2.5">CALLS</th>
                <th className="px-4 py-2.5">CONNECTED %</th>
                <th className="px-4 py-2.5 text-amber-600">INTERESTED</th>
                <th className="px-4 py-2.5 text-purple-600">REGISTRATIONS</th>
                <th className="px-4 py-2.5">AVG CALLS / CONTACT</th>
                <th className="px-4 py-2.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {attenderPerformance.map(a => (
                <tr
                  key={a.id}
                  onClick={() => setAttenderDetailModal(a)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{a.name}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">{a.totalCalls}</td>
                  <td className="px-4 py-2.5 font-bold text-emerald-600">{a.connectedRate}%</td>
                  <td className="px-4 py-2.5 font-semibold text-amber-600">{a.interestedCalls}</td>
                  <td className="px-4 py-2.5 font-bold text-purple-600">{a.registrationsCount}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{a.avgCallsPerContact}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setAttenderDetailModal(a); }}
                      className="px-2 py-0.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye size={12} /> Details
                    </button>
                  </td>
                </tr>
              ))}
              {attenderPerformance.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">No attender records match current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>





      {/* ATTENDER DETAIL MODAL */}
      {attenderDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <UserCheck size={18} className="text-indigo-600" /> {attenderDetailModal.name} — Full Details
              </h3>
              <button onClick={() => setAttenderDetailModal(null)} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Calls</span>
                  <span className="text-lg font-black text-slate-900">{attenderDetailModal.totalCalls}</span>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">Connected Rate</span>
                  <span className="text-lg font-black text-emerald-600">{attenderDetailModal.connectedRate}%</span>
                </div>
                <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-700 font-bold uppercase block">Interested Calls</span>
                  <span className="text-lg font-black text-amber-600">{attenderDetailModal.interestedCalls}</span>
                </div>
                <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                  <span className="text-[10px] text-purple-700 font-bold uppercase block">Registrations</span>
                  <span className="text-lg font-black text-purple-600">{attenderDetailModal.registrationsCount}</span>
                </div>
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                  <span className="text-[10px] text-blue-700 font-bold uppercase block">Reg.Done Calls</span>
                  <span className="text-lg font-black text-blue-600">{attenderDetailModal.regDoneCalls}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Calls / Contact</span>
                  <span className="text-lg font-black text-slate-900">{attenderDetailModal.avgCallsPerContact}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-slate-500 font-medium">Inspect contacts assigned to {attenderDetailModal.name}:</span>
                <button
                  onClick={() => {
                    const items = filteredContacts.filter(c => (c.attenderId || "unassigned") === attenderDetailModal.id || (c.attenderName || "").toLowerCase().trim() === attenderDetailModal.name.toLowerCase().trim());
                    setAttenderDetailModal(null);
                    setDrillDownModal({ title: `${attenderDetailModal.name} — Contacts (${items.length})`, type: "people", items });
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-md font-semibold text-xs hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  View Assigned Contacts ({filteredContacts.filter(c => (c.attenderId || "unassigned") === attenderDetailModal.id || (c.attenderName || "").toLowerCase().trim() === attenderDetailModal.name.toLowerCase().trim()).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN MODAL */}
      {drillDownModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>🔍</span> {drillDownModal.title}
              </h3>
              <button onClick={() => setDrillDownModal(null)} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100 bg-white">
              <input
                type="text"
                placeholder="Search within drilldown items..."
                value={drillSearch}
                onChange={(e) => setDrillSearch(e.target.value)}
                className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Name & Phone</th>
                    <th className="p-2">Attender</th>
                    <th className="p-2">Stage / Status</th>
                    <th className="p-2">Called For / Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {drillDownModal.items
                    .filter(rawItem => {
                      const item = rawItem.contact || rawItem;
                      if (!drillSearch.trim()) return true;
                      const q = drillSearch.toLowerCase();
                      const name = String(getContactName(item) || "").toLowerCase();
                      const phone = String(getContactPhone(item) || "").toLowerCase();
                      return name.includes(q) || phone.includes(q);
                    })
                    .map((rawItem, idx) => {
                      const item = rawItem.contact || rawItem;
                      const name = getContactName(item) || (getContactPhone(item) ? `Contact (${getContactPhone(item)})` : `Contact #${(item.id || item._id || "").slice(-4)}`);
                      const phone = getContactPhone(item);
                      
                      const modalCategory = drillDownModal.category || 
                        (drillDownModal.title.toLowerCase().includes("query") ? "query" : 
                         drillDownModal.title.toLowerCase().includes("reminder") ? "reminder" : "sales");

                      const salesStage = getCanonicalStage(item);
                      const queryStage = getCanonicalQueryStage(item);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            <p className="font-bold text-slate-900">{name}</p>
                            {phone && <p className="text-[10px] text-indigo-600 font-mono">{phone}</p>}
                          </td>
                          <td className="p-2">{renderVal(item.attenderName || item.assignedTo)}</td>
                          <td className="p-2">
                            {modalCategory === "query" ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] inline-block">
                                  {queryStage || item.queryStatus || "Query Pending"}
                                </span>
                                {salesStage && salesStage !== "Query Desk" && salesStage !== "Reminder Desk" && (
                                  <p className="text-[9px] text-slate-500 font-medium">Sales: {salesStage}</p>
                                )}
                              </div>
                            ) : modalCategory === "reminder" ? (
                              <div className="space-y-0.5">
                                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-bold text-[10px] inline-block">
                                  {item.status || "Reminder"}
                                </span>
                                {salesStage && salesStage !== "Query Desk" && salesStage !== "Reminder Desk" && (
                                  <p className="text-[9px] text-slate-500 font-medium">Sales: {salesStage}</p>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                {salesStage || "1. New Lead"}
                              </span>
                            )}
                          </td>
                          <td className="p-2">{renderVal(item.calledFor || item.source)}</td>
                        </tr>
                      );
                    })}
                  {drillDownModal.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-medium">No contacts found for this criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
