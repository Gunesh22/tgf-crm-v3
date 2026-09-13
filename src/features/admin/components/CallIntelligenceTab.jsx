import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Zap, Users, PhoneCall, TrendingUp, Target, Clock, Calendar, 
  AlertTriangle, Download, Search, ChevronDown, Award, Flame, 
  Eye, Sparkles, X, Check, ArrowRight, CheckCircle2, XCircle, Clock4, CalendarCheck, Layers,
  Hourglass, ArrowUpRight, BarChart2, Filter, Compass, Activity, ShieldCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  parseTimestamp, 
  getContactPhone, 
  getContactName, 
  getCanonicalStatus, 
  getCanonicalStage,
  classifyCallStatus, 
  getAllCallEntries, 
  getLocalDateStr, 
  getCanonicalRegistrations, 
  getContactSource, 
  getContactLeadOrigin,
  getCanonicalQueryStage 
} from "../utils.jsx";
import { PIPELINE_STAGES, QUERY_PIPELINE_STAGES } from "../../../utils/pipelineEngine";
import { EditModal } from "../../attender/components/EditModal";

// Canonical Helper 1: Program Identity Matcher (Canonical from Pipeline & Calls)
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

// Canonical Helper 2: Attender Identity Set Resolution (Canonical from Pipeline & Calls)
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

// Helpers to identify Query and Reminder calls / contacts
const isQueryCall = (call) => {
  if (!call) return false;
  const p = String(call.callPurpose || call.purpose || "").toUpperCase().trim();
  if (p === "QUERY") return true;
  const s = String(call.status || "").toLowerCase().trim();
  if (s.includes("query")) return true;
  return false;
};

const isReminderCall = (call) => {
  if (!call) return false;
  const p = String(call.callPurpose || call.purpose || "").toUpperCase().trim();
  if (p === "REMINDER") return true;
  const s = String(call.status || "").toLowerCase().trim();
  if (s.includes("reminder")) return true;
  return false;
};




// ── Compact Multi-Select Dropdown ───────────────────────────────────────────
function MultiSelect({ options, selected, onChange, placeholder, allLabel = "All" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSelected = selected.length === 0 || selected.length === options.length;
  const label = allSelected
    ? allLabel
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label || "1 selected")
      : `${selected.length} selected`;

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  return (
    <div className="relative min-w-[130px] sm:min-w-[150px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`flex items-center justify-between gap-2 h-9 px-3 border rounded-lg text-xs font-medium w-full truncate transition-colors cursor-pointer ${
          selected.length > 0 && selected.length < options.length
            ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="truncate flex-1 text-left">{label}</span>
        {selected.length > 0 && selected.length < options.length && (
          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} text-slate-400`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-1.5 text-xs max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : options.map(o => o.value))}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded border-b border-slate-100 mb-1 cursor-pointer"
          >
            <span>{allSelected ? "Deselect All" : "Select All"}</span>
            {allSelected && <Check size={13} className="text-blue-600" />}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer transition-colors text-left"
            >
              <span className="truncate">{opt.label}</span>
              {selected.includes(opt.value) && <Check size={13} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Time Slots & Helpers ────────────────────────────────────────────────────
const TIME_SLOTS = [
  { id: "slot_before_8", label: "Before 8:00 AM", startH: 0, endH: 8, isEdge: true },
  { id: "slot_8_10", label: "8:00 AM - 10:00 AM", startH: 8, endH: 10 },
  { id: "slot_10_12", label: "10:00 AM - 12:00 PM", startH: 10, endH: 12 },
  { id: "slot_12_14", label: "12:00 PM - 2:00 PM", startH: 12, endH: 14 },
  { id: "slot_14_16", label: "2:00 PM - 4:00 PM", startH: 14, endH: 16 },
  { id: "slot_16_18", label: "4:00 PM - 6:00 PM", startH: 16, endH: 18 },
  { id: "slot_18_20", label: "6:00 PM - 8:00 PM", startH: 18, endH: 20 },
  { id: "slot_20_22", label: "8:00 PM - 10:00 PM", startH: 20, endH: 22 },
  { id: "slot_after_22", label: "After 10:00 PM", startH: 22, endH: 24, isEdge: true }
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const getMonthBounds = (monthKey) => {
  const [yrStr, mnStr] = (monthKey || "").split("-");
  const yr = parseInt(yrStr, 10);
  const mn = parseInt(mnStr, 10);
  if (isNaN(yr) || isNaN(mn)) return null;
  const start = `${yr}-${String(mn).padStart(2, "0")}-01`;
  const end = `${yr}-${String(mn).padStart(2, "0")}-${String(new Date(yr, mn, 0).getDate()).padStart(2, "0")}`;
  return { start, end };
};

export default function CallIntelligenceTab({
  callLogs = [],
  registrations = [],
  programs = [],
  attenders = [],
  selectedMonth,
  setSelectedMonth
}) {
  const now = new Date();
  const currentYr = now.getFullYear();
  const currentMn = now.getMonth() + 1;
  const currentMonthKey = `${currentYr}-${String(currentMn).padStart(2, "0")}`;
  const todayStr = `${currentYr}-${String(currentMn).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const defaultBounds = getMonthBounds(currentMonthKey);

  const initialBounds = (selectedMonth && selectedMonth !== "ALL" && getMonthBounds(selectedMonth)) || defaultBounds;
  const [startDate, setStartDate] = useState(initialBounds.start);
  const [endDate, setEndDate] = useState(initialBounds.end);

  useEffect(() => {
    if ((!selectedMonth || selectedMonth === "ALL") && setSelectedMonth) {
      setSelectedMonth(currentMonthKey);
    }
  }, []);

  useEffect(() => {
    if (!selectedMonth || selectedMonth === "ALL") return;
    const b = getMonthBounds(selectedMonth);
    if (b && (startDate.slice(0, 7) !== selectedMonth || endDate.slice(0, 7) !== selectedMonth)) {
      setStartDate(b.start);
      setEndDate(b.end);
    }
  }, [selectedMonth]);

  const handleDateChange = (newStart, newEnd) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    if (!setSelectedMonth || !newStart || !newEnd) return;
    const sM = newStart.slice(0, 7);
    const eM = newEnd.slice(0, 7);
    const target = sM === eM ? sM : "ALL";
    if (selectedMonth !== target) setSelectedMonth(target);
  };

  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedAttenders, setSelectedAttenders] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [activeActionFilter, setActiveActionFilter] = useState("OVERDUE");
  const [actionSearchQuery, setActionSearchQuery] = useState("");
  const [selectedContactForEdit, setSelectedContactForEdit] = useState(null);
  const [showAllActionLeads, setShowAllActionLeads] = useState(false);
  const [sourceDimension, setSourceDimension] = useState("currentSource"); // "currentSource" | "leadOrigin"

  const isThisMonthActive = startDate === defaultBounds.start && endDate === defaultBounds.end;
  const isTodayActive = startDate === todayStr && endDate === todayStr;

  const handleDatePreset = (preset) => {
    if (preset === "THIS_MONTH") {
      handleDateChange(defaultBounds.start, defaultBounds.end);
    } else if (preset === "TODAY") {
      handleDateChange(todayStr, todayStr);
    } else if (preset === "LAST_7_DAYS") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const s7 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      handleDateChange(s7, todayStr);
    } else if (preset === "LAST_MONTH") {
      const prevYr = currentMn === 1 ? currentYr - 1 : currentYr;
      const prevMn = currentMn === 1 ? 12 : currentMn - 1;
      const b = getMonthBounds(`${prevYr}-${String(prevMn).padStart(2, "0")}`);
      if (b) handleDateChange(b.start, b.end);
    }
  };

  // Dropdown options
  const programOptions = useMemo(() => {
    const set = new Set();
    programs.forEach(p => { if (p.name) set.add(p.name.trim()); });
    callLogs.forEach(c => {
      const p = c.calledFor || c["Called For"] || c.programName;
      if (p) {
        String(p).split(",").forEach(item => {
          const trimmed = item.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort().map(p => ({ label: p, value: p }));
  }, [programs, callLogs]);

  const attenderOptions = useMemo(() => {
    const list = attenders.map(a => ({ label: a.name || "Attender", value: a.id || a.name }));
    const existing = new Set(list.map(o => o.value));
    callLogs.forEach(c => {
      const a = c.attenderName;
      if (a && !existing.has(a)) {
        list.push({ label: a, value: a });
        existing.add(a);
      }
    });
    return list;
  }, [attenders, callLogs]);

  const sourceOptions = useMemo(() => {
    const set = new Set();
    callLogs.forEach(c => {
      const s = getContactSource(c) || getContactLeadOrigin(c);
      if (s) set.add(s);
    });
    return Array.from(set).sort().map(s => ({ label: s, value: s }));
  }, [callLogs]);

  // ── Unified Data & Diagnostics Engine (Single-Pass Execution) ─────────────
  const {
    executiveMetrics,
    excludedWorkstreams,
    currentPipeline,
    leadAgeing,
    pipelineMovements,
    stageToStageConversion,
    salesVelocity,
    operationalOutcomes,
    followupSummary,
    followupEffectiveness,
    funnelSteps,
    biggestLeakage,
    outcomeBreakdown,
    attenderRows,
    winningPatterns,
    priorityQueue,
    currentSourceRows,
    leadOriginRows
  } = useMemo(() => {
    const attMap = new Map();
    const getOrCreateAttender = (name, id = "") => {
      const key = name || "Unassigned";
      if (!attMap.has(key)) {
        attMap.set(key, {
          attenderId: id || key,
          name: key,
          peopleCalledIds: new Set(),
          totalCalls: 0,
          connectedCalls: 0,
          infoGivenCount: 0,
          interestedCount: 0,
          registeredCount: 0
        });
      }
      return attMap.get(key);
    };

    attenders.forEach(a => { if (a.name) getOrCreateAttender(a.name, a.id); });

    const canonRegs = getCanonicalRegistrations(registrations, callLogs, {
      startDate,
      endDate,
      selectedProgramIds: selectedPrograms,
      selectedAttenderIds: selectedAttenders,
      selectedSources
    });
    const totalRegistrations = canonRegs.length;
    const regIds = new Set(canonRegs.map(r => String(r.contactId || "")).filter(Boolean));
    const regCloserMap = new Map();
    canonRegs.forEach(r => {
      if (r.contactId) regCloserMap.set(String(r.contactId), r.attenderName || r.attender || "Unassigned");
    });

    // Extract all call events from contact histories (identical to PipelineCallsTab)
    const allCallEvents = [];
    const seenCallIds = new Set();
    (callLogs || []).forEach(contact => {
      const cId = contact.id || contact._id || contact.Phone || contact.Name;
      const cName = getContactName(contact);
      const cPhone = getContactPhone(contact);
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
            if (matchedAttender) attId = matchedAttender.id || matchedAttender._id;
          }

          if (!attId && !attName) {
            attId = contact.attenderId;
            attName = contact.attenderName;
            if (!attId && attName) {
              const cleanName = attName.trim().toLowerCase();
              const matchedAttender = (attenders || []).find(a => (a.name || "").trim().toLowerCase() === cleanName);
              if (matchedAttender) attId = matchedAttender.id || matchedAttender._id;
            }
          }

          if (!attId) attId = "unassigned";
          if (!attName) attName = "Unassigned Attender";

          const rawCallStage = h.pipelineStage || h.stage || (h.status ? getCanonicalStage(h.status) : null);
          const callStage = rawCallStage ? getCanonicalStage(rawCallStage) : cStage;

          allCallEvents.push({
            callId,
            contactId: cId,
            contactName: cName,
            contactPhone: cPhone,
            pipelineStage: callStage,
            status: h.status || contact.status || "Pending",
            callType: (h.callType || contact.callType || "outgoing").toLowerCase(),
            callPurpose: h.callPurpose || h.purpose || "SALES",
            source: getContactSource(contact, h) || h.source || contact.source || "Online/Direct",
            leadOrigin: getContactLeadOrigin(contact, h) || "Direct / Organic",
            calledFor: h.calledFor || contact.calledFor || contact.programName || "",
            programId: h.programId || h.calledForKey || contact.programId || contact.calledForKey || "",
            attenderId: attId,
            attenderName: attName,
            timestamp: ts,
            dateStr: ts ? getLocalDateStr(ts) : "",
            remark: h.remark || ""
          });
        });
      }
    });

    // Filter events by date range, attender, program, and source
    const filteredEvents = allCallEvents.filter(ev => {
      if (startDate || endDate) {
        if (!ev.timestamp) return false;
        const dStr = getLocalDateStr(ev.timestamp);
        if (startDate && dStr < startDate) return false;
        if (endDate && dStr > endDate) return false;
      }

      if (selectedAttenders.length > 0) {
        const attenderIds = getRecordAttenderIds(ev);
        if (!selectedAttenders.some(id => attenderIds.has(String(id)))) return false;
      }

      if (!matchesProgramRecord(ev, selectedPrograms, programs)) return false;

      if (selectedSources.length > 0) {
        const evSource = ev.source || getContactSource(ev) || "Online/Direct";
        if (!selectedSources.includes(evSource)) return false;
      }

      return true;
    });

    const totalCallsCount = filteredEvents.length;
    const connectedCallsCount = filteredEvents.filter(ev => classifyCallStatus(ev.status) === "CONNECTED").length;

    let queryCallsCount = 0;
    let queryConnectedCallsCount = 0;
    let reminderCallsCount = 0;
    let reminderConnectedCallsCount = 0;
    let salesCallsCount = 0;
    let salesConnectedCallsCount = 0;

    const hourBuckets = TIME_SLOTS.map(s => ({ ...s, total: 0, connected: 0, rate: "0.0", isLowVolume: false }));
    const dayBuckets = DAYS_OF_WEEK.map(day => ({ day, total: 0, connected: 0, rate: "0.0" }));
    const attemptBuckets = [
      { attempt: "1st Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "2nd Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "3rd Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "4th Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "5th+ Call", total: 0, registered: 0, rate: "0.0" }
    ];

    filteredEvents.forEach(ev => {
      const isQ = isQueryCall(ev);
      const isR = isReminderCall(ev);
      const isConn = classifyCallStatus(ev.status) === "CONNECTED";

      if (isQ) {
        queryCallsCount++;
        if (isConn) queryConnectedCallsCount++;
      } else if (isR) {
        reminderCallsCount++;
        if (isConn) reminderConnectedCallsCount++;
      } else {
        salesCallsCount++;
        if (isConn) salesConnectedCallsCount++;

        const d = ev.timestamp;
        if (d && !isNaN(d.getTime())) {
          const h = d.getHours();
          const slot = hourBuckets.find(s => h >= s.startH && h < s.endH);
          if (slot) {
            slot.total++;
            if (isConn) slot.connected++;
          }
          const dayIdx = (d.getDay() + 6) % 7;
          if (dayBuckets[dayIdx]) {
            dayBuckets[dayIdx].total++;
            if (isConn) dayBuckets[dayIdx].connected++;
          }
        }
      }
    });

    // Filter contacts in pipeline (identical to PipelineCallsTab)
    const filteredContacts = (callLogs || []).filter(c => {
      if (selectedAttenders.length > 0) {
        const attenderIds = getRecordAttenderIds(c);
        if (!selectedAttenders.some(id => attenderIds.has(String(id)))) return false;
      }

      if (!matchesProgramRecord(c, selectedPrograms, programs)) return false;

      if (selectedSources.length > 0) {
        const cSource = getContactSource(c) || "Online/Direct";
        if (!selectedSources.includes(cSource)) return false;
      }

      if (startDate || endDate) {
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
          if (startDate && dStr < startDate) return false;
          if (endDate && dStr > endDate) return false;
          return true;
        });

        if (!hasMatch) return false;
      }

      return true;
    });

    const totalContactsInPipeline = filteredContacts.length;

    // Map calls to contact
    const contactCallsMap = new Map();
    filteredEvents.forEach(ev => {
      const cId = String(ev.contactId);
      if (!contactCallsMap.has(cId)) contactCallsMap.set(cId, []);
      contactCallsMap.get(cId).push(ev);
    });

    // Authoritative Pipeline State (Canonical keys, no parallel toCleanStageLabel)
    const currentPipelineSnapshot = {
      [PIPELINE_STAGES.NEW_LEAD]: 0,
      [PIPELINE_STAGES.ATTEMPTING]: 0,
      [PIPELINE_STAGES.INFO_GIVEN]: 0,
      [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: 0,
      [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
      [PIPELINE_STAGES.FUTURE_POOL]: 0,
      [PIPELINE_STAGES.REGISTERED_WON]: 0,
      [PIPELINE_STAGES.CLOSED_LOST]: 0,
      [PIPELINE_STAGES.CLOSED_INVALID]: 0,
      "Existing Alumni": 0
    };

    let queryContactsCount = 0;
    let reminderContactsCount = 0;
    let queryAttemptingCount = 0;
    let queryPendingCount = 0;
    let querySolvedCount = 0;

    filteredContacts.forEach(c => {
      const stage = getCanonicalStage(c);
      if (stage === "Query Desk" || stage === "Reminder Desk") {
        if (stage === "Query Desk") {
          queryContactsCount++;
          const qStage = getCanonicalQueryStage(c);
          if (qStage === QUERY_PIPELINE_STAGES.QUERY_SOLVED) querySolvedCount++;
          else if (qStage === QUERY_PIPELINE_STAGES.QUERY_PENDING) queryPendingCount++;
          else queryAttemptingCount++;
        } else {
          reminderContactsCount++;
        }
        return;
      }

      if (currentPipelineSnapshot[stage] !== undefined) {
        currentPipelineSnapshot[stage]++;
      } else if (stage.includes("Alumni") || stage.includes("Shivir done")) {
        currentPipelineSnapshot["Existing Alumni"]++;
      } else if (stage.includes("Lost") || stage.includes("Not Interested")) {
        currentPipelineSnapshot[PIPELINE_STAGES.CLOSED_LOST]++;
      } else if (stage.includes("Invalid")) {
        currentPipelineSnapshot[PIPELINE_STAGES.CLOSED_INVALID]++;
      } else {
        currentPipelineSnapshot[PIPELINE_STAGES.ATTEMPTING]++;
      }
    });

    const salesFunnelLeadsCount = Object.values(currentPipelineSnapshot).reduce((a, b) => a + b, 0);

    let attemptingContact = 0;
    let connectedPeopleCount = 0;
    let infoGivenCount = 0;
    let interestedCount = 0;

    const outcomes = {
      "Not Interested": 0,
      "Next Time / Later": 0,
      "Previous Program Pending": 0,
      "Unreachable (RNR/Switch Off)": 0,
      "Callback / Scheduled": 0,
      "Other / Inactive": 0
    };

    const overdueList = [];
    const speedList = [];
    const highPotentialList = [];
    const goldenWindowList = [];

    let cbPending = 0;
    let cbDueToday = 0;
    let cbOverdue = 0;
    let cbScheduledLater = 0;
    let noCbScheduled = 0;

    const transitions = {};
    let movedToInterested = 0;
    let movedToRegistered = 0;
    let movedToFuturePool = 0;
    let movedToClosedLost = 0;

    // Cohort trackers for Stage-to-Stage conversion
    let infoGivenCohortTotal = 0;
    let infoGivenToInterested = 0;
    let infoGivenToWonDirect = 0;
    let infoGivenToLost = 0;

    let interestedCohortTotal = 0;
    let interestedToWon = 0;
    let interestedToFuture = 0;
    let interestedToLost = 0;

    // Follow-up momentum trackers
    let totalFollowUpCalls = 0;
    let positiveProgressionCalls = 0;

    // Lead Ageing trackers (Real-Time Current State)
    const nowMs = new Date().getTime();
    const wipAgeing = {
      total: 0,
      fresh: 0,     // < 3 days
      active: 0,    // 3 - 7 days
      stagnant: 0,  // 7 - 14 days
      cold: 0,      // > 14 days
      infoGiven: { total: 0, fresh: 0, active: 0, stagnant: 0, cold: 0 },
      interested: { total: 0, fresh: 0, active: 0, stagnant: 0, cold: 0 }
    };

    const deferredAgeing = {
      total: 0,
      fresh: 0,
      active: 0,
      stagnant: 0,
      cold: 0
    };

    // Sales velocity arrays (elapsed days for Won contacts)
    const firstCallToWonDaysList = [];
    const infoGivenToWonDaysList = [];
    const interestedToWonDaysList = [];

    // Source & Origin Matrix maps
    const sourceMatrixMap = new Map();
    const originMatrixMap = new Map();

    filteredContacts.forEach(c => {
      const cId = String(c.id || c._id);
      const stage = getCanonicalStage(c);
      if (stage === "Query Desk" || stage === "Reminder Desk") return; // Exclude query & reminder desk contacts from sales funnel metrics

      const calls = contactCallsMap.get(cId) || [];
      const isReg = regIds.has(cId);
      const count = calls.length;

      // Source & Origin Matrix aggregation
      const cSource = getContactSource(c) || "Unspecified";
      const cOrigin = getContactLeadOrigin(c) || "Direct / Organic";

      const recordToMatrix = (map, key) => {
        if (!map.has(key)) {
          map.set(key, {
            name: key,
            leads: 0,
            totalCalls: 0,
            connectedCalls: 0,
            interestedCount: 0,
            registeredCount: 0
          });
        }
        const obj = map.get(key);
        obj.leads++;
        obj.totalCalls += count;
        obj.connectedCalls += calls.filter(call => classifyCallStatus(call.status) === "CONNECTED").length;
        if (stage === PIPELINE_STAGES.NURTURE_INTERESTED || isReg) obj.interestedCount++;
        if (isReg) obj.registeredCount++;
      };

      recordToMatrix(sourceMatrixMap, cSource);
      recordToMatrix(originMatrixMap, cOrigin);

      // Lead Ageing Computation (Current State Snapshot)
      if (stage === PIPELINE_STAGES.INFO_GIVEN || stage === PIPELINE_STAGES.NURTURE_INTERESTED || stage === PIPELINE_STAGES.FUTURE_POOL) {
        let stageDate = null;
        if (Array.isArray(c.history) && c.history.length > 0) {
          for (let i = c.history.length - 1; i >= 0; i--) {
            const h = c.history[i];
            const hStage = getCanonicalStage(h.pipelineStage || h.status);
            if (hStage === stage) {
              stageDate = parseTimestamp(h.timestamp || h.date || h.createdAt);
              break;
            }
          }
        }
        if (!stageDate) {
          stageDate = parseTimestamp(c.lastCalledAt || c.updatedAt || c.createdAt || c.date_added);
        }
        const ageDays = stageDate && !isNaN(stageDate.getTime())
          ? Math.max(0, Math.floor((nowMs - stageDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        if (stage === PIPELINE_STAGES.INFO_GIVEN || stage === PIPELINE_STAGES.NURTURE_INTERESTED) {
          wipAgeing.total++;
          const targetSub = stage === PIPELINE_STAGES.INFO_GIVEN ? wipAgeing.infoGiven : wipAgeing.interested;
          targetSub.total++;
          if (ageDays < 3) {
            wipAgeing.fresh++;
            targetSub.fresh++;
          } else if (ageDays <= 7) {
            wipAgeing.active++;
            targetSub.active++;
          } else if (ageDays <= 14) {
            wipAgeing.stagnant++;
            targetSub.stagnant++;
          } else {
            wipAgeing.cold++;
            targetSub.cold++;
          }
        } else if (stage === PIPELINE_STAGES.FUTURE_POOL) {
          deferredAgeing.total++;
          if (ageDays < 3) deferredAgeing.fresh++;
          else if (ageDays <= 7) deferredAgeing.active++;
          else if (ageDays <= 14) deferredAgeing.stagnant++;
          else deferredAgeing.cold++;
        }
      }

      let hasConnected = false;
      let hasInfo = false;
      let hasInterest = false;

      calls.forEach(call => {
        const canonical = getCanonicalStatus(call.status);
        const isConn = classifyCallStatus(call.status) === "CONNECTED";
        const isRegCall = canonical === "Reg.Done" || canonical === "Registered";
        const isInterestCall = canonical === "Interested" || isRegCall;
        const isInfoCall = canonical === "Info Given" || isInterestCall;

        if (isConn) hasConnected = true;
        if (isInfoCall) hasInfo = true;
        if (isInterestCall) hasInterest = true;

        const aObj = getOrCreateAttender(call.attenderName || c.attenderName);
        aObj.totalCalls++;
        aObj.peopleCalledIds.add(cId);
        if (isConn || isRegCall) aObj.connectedCalls++;
        if (isInfoCall) aObj.infoGivenCount++;
        if (isInterestCall) aObj.interestedCount++;
      });

      const rootCanonical = getCanonicalStatus(c.status);
      if (rootCanonical === "Info Given" && (hasConnected || count > 0)) hasInfo = true;
      if (rootCanonical === "Interested" && (hasConnected || count > 0)) hasInterest = true;

      // Cumulative Progression Invariants
      const isContactReg = isReg;
      const isContactInterested = isContactReg || hasInterest;
      const isContactInfo = isContactInterested || hasInfo;
      const isContactConnected = isContactInfo || hasConnected;
      const isContactAttempted = isContactConnected || count > 0 || true;

      if (isContactAttempted) attemptingContact++;
      if (isContactConnected) connectedPeopleCount++;
      if (isContactInfo) infoGivenCount++;
      if (isContactInterested) interestedCount++;

      // Closer Attribution
      if (isReg) {
        const lastCall = calls[count - 1];
        const closerName = regCloserMap.get(cId) || lastCall?.attenderName || c.attenderName || "Unassigned";
        const aObj = getOrCreateAttender(closerName);
        aObj.registeredCount++;
        aObj.peopleCalledIds.add(cId);
        if (aObj.interestedCount < aObj.registeredCount) aObj.interestedCount = aObj.registeredCount;
        if (aObj.infoGivenCount < aObj.interestedCount) aObj.infoGivenCount = aObj.interestedCount;
        if (aObj.connectedCalls < aObj.registeredCount) aObj.connectedCalls = aObj.registeredCount;
        if (aObj.totalCalls < aObj.connectedCalls) aObj.totalCalls = aObj.connectedCalls;
      }

      // Yield Curve Calculation
      if (count > 0) {
        if (count >= 1) attemptBuckets[0].total++;
        if (count >= 2) attemptBuckets[1].total++;
        if (count >= 3) attemptBuckets[2].total++;
        if (count >= 4) attemptBuckets[3].total++;
        if (count >= 5) attemptBuckets[4].total++;

        if (isReg) {
          const regCallIdx = calls.findIndex(call => {
            const s = getCanonicalStatus(call.status);
            return s === "Reg.Done" || s === "Registered";
          });
          const regAttempt = regCallIdx >= 0 ? regCallIdx + 1 : count;
          if (regAttempt === 1) attemptBuckets[0].registered++;
          else if (regAttempt === 2) attemptBuckets[1].registered++;
          else if (regAttempt === 3) attemptBuckets[2].registered++;
          else if (regAttempt === 4) attemptBuckets[3].registered++;
          else if (regAttempt >= 5) attemptBuckets[4].registered++;
        }
      }

      // Authoritative Callback Status
      let cbDateRaw = null;
      let cbStatusRaw = null;

      if (c.attenderStates && typeof c.attenderStates === "object") {
        if (selectedAttenders.length > 0) {
          for (const sel of selectedAttenders) {
            if (c.attenderStates[sel]?.callbackDate) {
              cbDateRaw = c.attenderStates[sel].callbackDate;
              cbStatusRaw = c.attenderStates[sel].callbackStatus;
              break;
            }
          }
        }
        if (!cbDateRaw) {
          for (const st of Object.values(c.attenderStates)) {
            if (st?.callbackDate) {
              cbDateRaw = st.callbackDate;
              cbStatusRaw = st.callbackStatus;
              break;
            }
          }
        }
      }
      if (!cbDateRaw) {
        cbDateRaw = c.callbackDate || c.callback_date;
        cbStatusRaw = c.callbackStatus || c.callback_status;
      }

      const cbStat = String(cbStatusRaw || "").toLowerCase().trim();
      const isCompleted = cbStat === "completed" || cbStat === "done" || cbStat === "called";
      const isCancelled = cbStat === "cancelled";

      if (cbDateRaw && !isCompleted && !isCancelled) {
        cbPending++;
        const parsedCb = parseTimestamp(cbDateRaw);
        const cbDateStr = parsedCb ? getLocalDateStr(parsedCb) : "";
        if (cbDateStr === todayStr) {
          cbDueToday++;
        } else if (cbDateStr && cbDateStr < todayStr) {
          cbOverdue++;
        } else if (cbDateStr && cbDateStr > todayStr) {
          cbScheduledLater++;
        }
      } else if ((c.pipelineStage === PIPELINE_STAGES.INFO_GIVEN || c.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED) && !isReg) {
        noCbScheduled++;
      }

      // Action Queue Filtering
      if (!isReg) {
        const sLower = String(c.status || "").toLowerCase();
        if (sLower.includes("not int") || sLower.includes("not possible")) outcomes["Not Interested"]++;
        else if (sLower.includes("next time") || sLower.includes("future")) outcomes["Next Time / Later"]++;
        else if (sLower.includes("previous program") || sLower.includes("alumni")) outcomes["Previous Program Pending"]++;
        else if (sLower.includes("na") || sLower.includes("busy") || sLower.includes("switched") || sLower.includes("cut") || sLower.includes("not connected") || sLower.includes("not attended") || sLower.includes("not picked")) outcomes["Unreachable (RNR/Switch Off)"]++;
        else if (c.callbackDate || sLower.includes("callback")) outcomes["Callback / Scheduled"]++;
        else outcomes["Other / Inactive"]++;

        const lastCall = calls[count - 1];
        const lastCalledAt = c.lastCalledAt || lastCall?.timestamp;
        const lastCallDateStr = lastCalledAt ? getLocalDateStr(lastCalledAt) : "";
        const cbDateStr = c.callbackDate ? getLocalDateStr(c.callbackDate) : "";

        const isMissedCallback = cbDateStr && cbDateStr < todayStr && (!lastCallDateStr || lastCallDateStr < cbDateStr);
        const hasFutureCallback = cbDateStr && cbDateStr >= todayStr;

        if (isMissedCallback) {
          overdueList.push({
            contact: c,
            priorityTag: "Overdue Callback",
            urgencyBadge: "bg-rose-100 text-rose-800 border-rose-200",
            reason: `Callback scheduled for ${cbDateStr} was missed`,
            attempts: count,
            lastRemark: c.remark || lastCall?.remark || "—"
          });
        } else if (rootCanonical === "Interested" && lastCalledAt && !hasFutureCallback) {
          const lastD = parseTimestamp(lastCalledAt);
          const diffHours = lastD ? (Date.now() - lastD.getTime()) / (1000 * 60 * 60) : 0;
          if (diffHours >= 24) {
            speedList.push({
              contact: c,
              priorityTag: "Speed Alert (>24h)",
              urgencyBadge: "bg-amber-100 text-amber-800 border-amber-200",
              reason: `Interested for ${Math.round(diffHours / 24)}d without follow-up`,
              attempts: count,
              lastRemark: c.remark || lastCall?.remark || "—"
            });
          }
        } else if ((rootCanonical === "Interested" || rootCanonical === "Previous Program Pending") && !hasFutureCallback) {
          highPotentialList.push({
            contact: c,
            priorityTag: "High Probability",
            urgencyBadge: "bg-emerald-100 text-emerald-800 border-emerald-200",
            reason: "Expressed clear interest, prime closing opportunity",
            attempts: count,
            lastRemark: c.remark || lastCall?.remark || "—"
          });
        } else if (count >= 1 && count <= 2 && classifyCallStatus(c.status) === "NOT_CONNECTED" && !hasFutureCallback) {
          const isDeadNumber = sLower.includes("invalid") || sLower.includes("wrong") || sLower.includes("not exist");
          if (!isDeadNumber) {
            goldenWindowList.push({
              contact: c,
              priorityTag: "Attempt #3 Window",
              urgencyBadge: "bg-blue-100 text-blue-800 border-blue-200",
              reason: `Attempt #${count + 1} needed during peak connect hours`,
              attempts: count,
              lastRemark: c.remark || lastCall?.remark || "—"
            });
          }
        }
      }

      // 1. Determine baseline stage entering window (startDate)
      const allCalls = getAllCallEntries(c);
      let baselineStage = PIPELINE_STAGES.NEW_LEAD;
      let hasPreWindowCall = false;
      let preWindowInfoGivenTs = null;
      let preWindowInterestedTs = null;

      allCalls.forEach(call => {
        const callDate = call.timestamp ? getLocalDateStr(call.timestamp) : "";
        if (startDate && callDate < startDate) {
          hasPreWindowCall = true;
          const purpose = String(call.callPurpose || "SALES").toUpperCase();
          if (purpose === "SALES") {
            const rawStatus = String(call.status || "").trim().toLowerCase();
            if (rawStatus.includes("reg.done") || rawStatus.includes("registered") || rawStatus.includes("won")) {
              baselineStage = PIPELINE_STAGES.REGISTERED_WON;
            } else if (rawStatus.includes("already reg") || rawStatus.includes("shivir done") || rawStatus.includes("alumni")) {
              baselineStage = "Existing Alumni";
            } else if (rawStatus === "interested" || rawStatus.includes("interested")) {
              baselineStage = PIPELINE_STAGES.NURTURE_INTERESTED;
              if (!preWindowInterestedTs && call.timestamp) preWindowInterestedTs = call.timestamp;
            } else if (rawStatus === "info given" || rawStatus.includes("info given") || rawStatus.includes("information given")) {
              if (baselineStage !== PIPELINE_STAGES.NURTURE_INTERESTED && baselineStage !== PIPELINE_STAGES.REGISTERED_WON) {
                baselineStage = PIPELINE_STAGES.INFO_GIVEN;
              }
              if (!preWindowInfoGivenTs && call.timestamp) preWindowInfoGivenTs = call.timestamp;
            } else if (rawStatus === "next time" || rawStatus.includes("future pool")) {
              baselineStage = PIPELINE_STAGES.FUTURE_POOL;
            } else if (rawStatus === "not interested" || rawStatus.includes("closed / lost") || rawStatus.includes("closed lost")) {
              baselineStage = PIPELINE_STAGES.CLOSED_LOST;
            } else if (rawStatus.includes("invalid") || rawStatus.includes("wrong number")) {
              baselineStage = PIPELINE_STAGES.CLOSED_INVALID;
            } else if (baselineStage === PIPELINE_STAGES.NEW_LEAD) {
              baselineStage = PIPELINE_STAGES.ATTEMPTING;
            }
          }
        }
      });

      // If no pre-window calls, but contact was registered or created prior to window with a known stage
      const createdDate = c.createdAt ? getLocalDateStr(parseTimestamp(c.createdAt)) : "";
      if (!hasPreWindowCall && startDate && createdDate && createdDate < startDate) {
        const rootStage = getCanonicalStage(c);
        if (rootStage && rootStage !== "Query Desk" && rootStage !== "Reminder Desk" && rootStage !== PIPELINE_STAGES.REGISTERED_WON) {
          baselineStage = rootStage;
        }
      }

      // 2. Track sequential stage transitions inside the window
      let currentStageInWindow = baselineStage;
      let wasInInfoGivenThisWindow = (baselineStage === PIPELINE_STAGES.INFO_GIVEN);
      let wasInInterestedThisWindow = (baselineStage === PIPELINE_STAGES.NURTURE_INTERESTED);

      let earliestFirstCallTs = allCalls[0]?.timestamp || parseTimestamp(c.createdAt || c.date_added);
      let earliestInfoGivenTs = preWindowInfoGivenTs;
      let earliestInterestedTs = preWindowInterestedTs;

      let callIndexInContact = 0;

      allCalls.forEach(call => {
        const callDate = call.timestamp ? getLocalDateStr(call.timestamp) : "";
        const inWindow = (!startDate || callDate >= startDate) && (!endDate || callDate <= endDate);
        if (!inWindow) return;

        callIndexInContact++;
        const purpose = String(call.callPurpose || "SALES").toUpperCase();
        if (purpose !== "SALES") return;

        const prevStage = currentStageInWindow;
        let nextStage = prevStage;

        const rawStatus = String(call.status || "").trim().toLowerCase();
        const isConn = classifyCallStatus(call.status) === "CONNECTED";

        if (rawStatus.includes("reg.done") || rawStatus.includes("registered") || rawStatus.includes("won")) {
          nextStage = PIPELINE_STAGES.REGISTERED_WON;
        } else if (rawStatus.includes("already reg") || rawStatus.includes("shivir done") || rawStatus.includes("alumni")) {
          nextStage = "Existing Alumni";
        } else if (rawStatus === "interested" || rawStatus.includes("interested")) {
          nextStage = PIPELINE_STAGES.NURTURE_INTERESTED;
          if (!earliestInterestedTs && call.timestamp) earliestInterestedTs = call.timestamp;
        } else if (rawStatus === "info given" || rawStatus.includes("info given") || rawStatus.includes("information given")) {
          // Anti-demotion rule: Info re-shared during Interested follow-up stays in Interested
          if (prevStage === PIPELINE_STAGES.NURTURE_INTERESTED || prevStage === PIPELINE_STAGES.REGISTERED_WON) {
            nextStage = prevStage;
          } else {
            nextStage = PIPELINE_STAGES.INFO_GIVEN;
          }
          if (!earliestInfoGivenTs && call.timestamp) earliestInfoGivenTs = call.timestamp;
        } else if (rawStatus === "next time" || rawStatus.includes("future pool")) {
          nextStage = PIPELINE_STAGES.FUTURE_POOL;
        } else if (rawStatus === "not interested" || rawStatus.includes("closed / lost") || rawStatus.includes("closed lost")) {
          nextStage = PIPELINE_STAGES.CLOSED_LOST;
        } else if (rawStatus.includes("invalid") || rawStatus.includes("wrong number")) {
          nextStage = PIPELINE_STAGES.CLOSED_INVALID;
        } else {
          // Connected / Callback / Attempting
          if (prevStage === PIPELINE_STAGES.NEW_LEAD) {
            nextStage = PIPELINE_STAGES.ATTEMPTING;
          } else {
            nextStage = prevStage;
          }
        }

        if (nextStage === PIPELINE_STAGES.INFO_GIVEN) wasInInfoGivenThisWindow = true;
        if (nextStage === PIPELINE_STAGES.NURTURE_INTERESTED) wasInInterestedThisWindow = true;

        // Follow-up momentum tracking (calls after call #1)
        if (callIndexInContact > 1) {
          totalFollowUpCalls++;
          const STAGE_RANKS = {
            [PIPELINE_STAGES.NEW_LEAD]: 1,
            [PIPELINE_STAGES.ATTEMPTING]: 2,
            [PIPELINE_STAGES.INFO_GIVEN]: 3,
            [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: 3,
            [PIPELINE_STAGES.NURTURE_INTERESTED]: 4,
            [PIPELINE_STAGES.FUTURE_POOL]: 5,
            [PIPELINE_STAGES.REGISTERED_WON]: 6
          };
          const pRank = STAGE_RANKS[prevStage] || 0;
          const nRank = STAGE_RANKS[nextStage] || 0;
          if (nRank > pRank || (prevStage === PIPELINE_STAGES.NURTURE_INTERESTED && nextStage === PIPELINE_STAGES.NURTURE_INTERESTED && isConn)) {
            positiveProgressionCalls++;
          }
        }

        // Record Stage Transition Hop
        if (nextStage !== prevStage) {
          const transKey = `${prevStage} → ${nextStage}`;
          transitions[transKey] = (transitions[transKey] || 0) + 1;

          if (nextStage === PIPELINE_STAGES.NURTURE_INTERESTED) movedToInterested++;
          if (nextStage === PIPELINE_STAGES.REGISTERED_WON) movedToRegistered++;
          if (nextStage === PIPELINE_STAGES.FUTURE_POOL) movedToFuturePool++;
          if (nextStage === PIPELINE_STAGES.CLOSED_LOST) movedToClosedLost++;

          if (prevStage === PIPELINE_STAGES.INFO_GIVEN) {
            if (nextStage === PIPELINE_STAGES.NURTURE_INTERESTED) infoGivenToInterested++;
            else if (nextStage === PIPELINE_STAGES.REGISTERED_WON) infoGivenToWonDirect++;
            else if (nextStage === PIPELINE_STAGES.CLOSED_LOST) infoGivenToLost++;
          }

          if (prevStage === PIPELINE_STAGES.NURTURE_INTERESTED) {
            if (nextStage === PIPELINE_STAGES.REGISTERED_WON) interestedToWon++;
            else if (nextStage === PIPELINE_STAGES.FUTURE_POOL) interestedToFuture++;
            else if (nextStage === PIPELINE_STAGES.CLOSED_LOST) interestedToLost++;
          }

          currentStageInWindow = nextStage;
        }
      });

      if (wasInInfoGivenThisWindow) infoGivenCohortTotal++;
      if (wasInInterestedThisWindow) interestedCohortTotal++;

      // Complete registration transition for contacts registered in this window
      if (isReg && currentStageInWindow !== PIPELINE_STAGES.REGISTERED_WON) {
        const prevStage = currentStageInWindow;
        const nextStage = PIPELINE_STAGES.REGISTERED_WON;
        const transKey = `${prevStage} → ${nextStage}`;
        transitions[transKey] = (transitions[transKey] || 0) + 1;
        if (prevStage === PIPELINE_STAGES.NURTURE_INTERESTED) {
          interestedToWon++;
        } else if (prevStage === PIPELINE_STAGES.INFO_GIVEN) {
          infoGivenToWonDirect++;
        }
        currentStageInWindow = nextStage;
      }

      // Time to conversion for Won contacts
      if (isReg) {
        const wonCall = allCalls.find(c => {
          const s = String(c.status || "").toLowerCase();
          return s.includes("reg.done") || s.includes("registered") || s.includes("won");
        });
        const wonTs = wonCall?.timestamp || parseTimestamp(c.lastCalledAt || c.updatedAt);
        if (wonTs && !isNaN(wonTs.getTime())) {
          if (earliestFirstCallTs && !isNaN(earliestFirstCallTs.getTime())) {
            const days = Math.max(0, (wonTs.getTime() - earliestFirstCallTs.getTime()) / (1000 * 60 * 60 * 24));
            firstCallToWonDaysList.push(days);
          }
          if (earliestInfoGivenTs && !isNaN(earliestInfoGivenTs.getTime())) {
            const days = Math.max(0, (wonTs.getTime() - earliestInfoGivenTs.getTime()) / (1000 * 60 * 60 * 24));
            infoGivenToWonDaysList.push(days);
          }
          if (earliestInterestedTs && !isNaN(earliestInterestedTs.getTime())) {
            const days = Math.max(0, (wonTs.getTime() - earliestInterestedTs.getTime()) / (1000 * 60 * 60 * 24));
            interestedToWonDaysList.push(days);
          }
        }
      }
    });

    attemptBuckets.forEach(b => {
      b.rate = b.total > 0 ? ((b.registered / b.total) * 100).toFixed(1) : "0.0";
    });

    hourBuckets.forEach(b => {
      b.rate = b.total > 0 ? ((b.connected / b.total) * 100).toFixed(1) : "0.0";
      b.isLowVolume = b.total > 0 && b.total < 20;
    });

    dayBuckets.forEach(b => {
      b.rate = b.total > 0 ? ((b.connected / b.total) * 100).toFixed(1) : "0.0";
    });

    const qualifiedSlots = hourBuckets.filter(b => b.total >= 15);
    const candidateSlots = qualifiedSlots.length > 0 ? qualifiedSlots : hourBuckets.filter(b => b.total >= 5).length > 0 ? hourBuckets.filter(b => b.total >= 5) : hourBuckets.filter(b => b.total > 0);
    const bestHour = [...candidateSlots].sort((a, b) => {
      const diff = parseFloat(b.rate) - parseFloat(a.rate);
      return Math.abs(diff) > 0.01 ? diff : b.total - a.total;
    })[0] || null;

    const qualifiedDays = dayBuckets.filter(b => b.total >= 10);
    const candidateDays = qualifiedDays.length > 0 ? qualifiedDays : dayBuckets.filter(b => b.total > 0);
    const bestDay = [...candidateDays].sort((a, b) => {
      const diff = parseFloat(b.rate) - parseFloat(a.rate);
      return Math.abs(diff) > 0.01 ? diff : b.total - a.total;
    })[0] || null;

    const attRows = Array.from(attMap.values())
      .filter(a => a.totalCalls > 0 || a.peopleCalledIds.size > 0 || a.registeredCount > 0)
      .map(a => {
        const pc = a.peopleCalledIds.size;
        return {
          ...a,
          peopleCalled: pc,
          connectRate: a.totalCalls > 0 ? ((a.connectedCalls / a.totalCalls) * 100).toFixed(1) : "0.0",
          interestRate: a.connectedCalls > 0 ? ((a.interestedCount / a.connectedCalls) * 100).toFixed(1) : "0.0",
          regRate: pc > 0 ? ((a.registeredCount / pc) * 100).toFixed(1) : "0.0",
          callsPerReg: a.registeredCount > 0 ? (a.totalCalls / a.registeredCount).toFixed(1) : "—"
        };
      })
      .sort((a, b) => (parseFloat(b.regRate) || 0) - (parseFloat(a.regRate) || 0));

    const totalLeads = salesFunnelLeadsCount || totalContactsInPipeline;
    const calcRate = (num, den) => den > 0 ? Math.min(100, Math.max(0, (num / den) * 100)).toFixed(1) : "0.0";
    const calcDrop = (num, den) => den > 0 ? Math.min(100, Math.max(0, ((den - num) / den) * 100)).toFixed(1) : "0.0";

    // Enforce cumulative progression invariant
    if (interestedCount < totalRegistrations) interestedCount = totalRegistrations;
    if (infoGivenCount < interestedCount) infoGivenCount = interestedCount;
    if (connectedPeopleCount < infoGivenCount) connectedPeopleCount = infoGivenCount;
    if (attemptingContact < connectedPeopleCount) attemptingContact = connectedPeopleCount;

    const steps = [
      { name: "1. Leads in Window", count: totalLeads, pctOfTotal: 100, passRate: 100, dropRate: 0 },
      { name: "2. Contact Attempted", count: attemptingContact, pctOfTotal: calcRate(attemptingContact, totalLeads), passRate: calcRate(attemptingContact, totalLeads), dropRate: calcDrop(attemptingContact, totalLeads) },
      { name: "3. Connected (Spoke)", count: connectedPeopleCount, pctOfTotal: calcRate(connectedPeopleCount, totalLeads), passRate: calcRate(connectedPeopleCount, attemptingContact), dropRate: calcDrop(connectedPeopleCount, attemptingContact) },
      { name: "4. Information Given", count: infoGivenCount, pctOfTotal: calcRate(infoGivenCount, totalLeads), passRate: calcRate(infoGivenCount, connectedPeopleCount), dropRate: calcDrop(infoGivenCount, connectedPeopleCount) },
      { name: "5. Interested / Nurture", count: interestedCount, pctOfTotal: calcRate(interestedCount, totalLeads), passRate: calcRate(interestedCount, infoGivenCount), dropRate: calcDrop(interestedCount, infoGivenCount) },
      { name: "6. Registered / Won", count: totalRegistrations, pctOfTotal: calcRate(totalRegistrations, totalLeads), passRate: calcRate(totalRegistrations, interestedCount), dropRate: calcDrop(totalRegistrations, interestedCount) }
    ];

    let maxDrop = -1;
    let maxDropStage = "No significant drop-off";
    for (let i = 1; i < steps.length; i++) {
      const drop = parseFloat(steps[i].dropRate) || 0;
      if (drop > maxDrop && drop > 0) {
        maxDrop = drop;
        maxDropStage = `${steps[i - 1].name} → ${steps[i].name} (-${drop}%)`;
      }
    }

    const getMedian = (arr) => {
      if (!arr || arr.length === 0) return "0.0";
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const val = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2);
      return val.toFixed(1);
    };

    const getAvg = (arr) => {
      if (!arr || arr.length === 0) return "0.0";
      return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    };

    const salesVelocity = {
      firstCallToWon: {
        medianDays: getMedian(firstCallToWonDaysList),
        avgDays: getAvg(firstCallToWonDaysList),
        sampleCount: firstCallToWonDaysList.length
      },
      infoGivenToWon: {
        medianDays: getMedian(infoGivenToWonDaysList),
        avgDays: getAvg(infoGivenToWonDaysList),
        sampleCount: infoGivenToWonDaysList.length
      },
      interestedToWon: {
        medianDays: getMedian(interestedToWonDaysList),
        avgDays: getAvg(interestedToWonDaysList),
        sampleCount: interestedToWonDaysList.length
      }
    };

    const stageToStageConversion = {
      infoGivenCohort: {
        total: infoGivenCohortTotal,
        toInterested: infoGivenToInterested,
        toInterestedRate: calcRate(infoGivenToInterested, infoGivenCohortTotal),
        toWonDirect: infoGivenToWonDirect,
        toWonDirectRate: calcRate(infoGivenToWonDirect, infoGivenCohortTotal),
        toLost: infoGivenToLost,
        toLostRate: calcRate(infoGivenToLost, infoGivenCohortTotal)
      },
      interestedCohort: {
        total: interestedCohortTotal,
        toWon: interestedToWon,
        toWonRate: calcRate(interestedToWon, interestedCohortTotal),
        toFuture: interestedToFuture,
        toFutureRate: calcRate(interestedToFuture, interestedCohortTotal),
        toLost: interestedToLost,
        toLostRate: calcRate(interestedToLost, interestedCohortTotal)
      }
    };

    const followupEffectiveness = {
      totalFollowUpCalls,
      positiveProgressionCalls,
      progressionRate: calcRate(positiveProgressionCalls, totalFollowUpCalls),
      overdueTotal: cbOverdue,
      overduePendingRate: calcRate(cbOverdue, cbPending)
    };

    const buildMatrixRows = (map) => {
      return Array.from(map.values())
        .map(item => ({
          ...item,
          connectRate: calcRate(item.connectedCalls, item.totalCalls),
          interestRate: calcRate(item.interestedCount, item.leads),
          regRate: calcRate(item.registeredCount, item.leads),
          callsPerReg: item.registeredCount > 0 ? (item.totalCalls / item.registeredCount).toFixed(1) : "—"
        }))
        .sort((a, b) => b.registeredCount - a.registeredCount || b.leads - a.leads);
    };

    const currentSourceRows = buildMatrixRows(sourceMatrixMap);
    const leadOriginRows = buildMatrixRows(originMatrixMap);

    const operationalOutcomes = {
      won: totalRegistrations,
      trueLosses: currentPipelineSnapshot[PIPELINE_STAGES.CLOSED_LOST] || 0,
      deferred: currentPipelineSnapshot[PIPELINE_STAGES.FUTURE_POOL] || 0,
      invalid: currentPipelineSnapshot[PIPELINE_STAGES.CLOSED_INVALID] || 0,
      activeWip: (currentPipelineSnapshot[PIPELINE_STAGES.INFO_GIVEN] || 0) + (currentPipelineSnapshot[PIPELINE_STAGES.NURTURE_INTERESTED] || 0)
    };

    const followupSummary = {
      pending: cbPending,
      dueToday: cbDueToday,
      overdue: cbOverdue,
      scheduledLater: cbScheduledLater,
      noFollowupScheduled: noCbScheduled
    };

    const pipelineMovements = {
      movedToInterested,
      movedToRegistered: totalRegistrations,
      registeredContactsCount: currentPipelineSnapshot[PIPELINE_STAGES.REGISTERED_WON] || regIds.size,
      movedToFuturePool,
      movedToClosedLost,
      transitions
    };

    const excludedWorkstreams = {
      totalExcludedCalls: queryCallsCount + reminderCallsCount,
      queryCalls: queryCallsCount,
      queryConnected: queryConnectedCallsCount,
      queryContacts: queryContactsCount,
      querySolved: querySolvedCount,
      queryPending: queryPendingCount,
      queryAttempting: queryAttemptingCount,
      reminderCalls: reminderCallsCount,
      reminderConnected: reminderConnectedCallsCount,
      reminderContacts: reminderContactsCount
    };

    const execMetrics = {
      totalPeople: totalContactsInPipeline,
      salesFunnelPeople: salesFunnelLeadsCount,
      totalCalls: totalCallsCount,
      totalRegistrations,
      connectedCallsCount,
      connectedPeopleCount,
      leadToRegRate: calcRate(totalRegistrations, salesFunnelLeadsCount || totalContactsInPipeline),
      connectedToRegRate: calcRate(totalRegistrations, connectedCallsCount),
      overallConnectRate: calcRate(connectedCallsCount, totalCallsCount),
      avgCallsPerPerson: totalContactsInPipeline > 0 ? (totalCallsCount / totalContactsInPipeline).toFixed(2) : "0.0",
      callsPerRegistration: totalRegistrations > 0 ? (totalCallsCount / totalRegistrations).toFixed(1) : "—"
    };

    return {
      executiveMetrics: execMetrics,
      excludedWorkstreams,
      currentPipeline: currentPipelineSnapshot,
      leadAgeing: { wipAgeing, deferredAgeing },
      pipelineMovements,
      stageToStageConversion,
      salesVelocity,
      operationalOutcomes,
      followupSummary,
      followupEffectiveness,
      funnelSteps: steps,
      biggestLeakage: maxDropStage,
      outcomeBreakdown: outcomes,
      attenderRows: attRows,
      winningPatterns: { hourBuckets, dayBuckets, attemptBuckets, bestHourSlot: bestHour, bestDaySlot: bestDay },
      priorityQueue: {
        OVERDUE: overdueList,
        SPEED_LEAKAGE: speedList,
        HIGH_POTENTIAL: highPotentialList,
        GOLDEN_WINDOW: goldenWindowList,
        ALL: [...overdueList, ...speedList, ...highPotentialList, ...goldenWindowList]
      },
      currentSourceRows,
      leadOriginRows
    };
  }, [callLogs, registrations, attenders, programs, selectedPrograms, selectedAttenders, selectedSources, startDate, endDate, todayStr]);

  const displayedActionLeads = useMemo(() => {
    let list = priorityQueue[activeActionFilter] || priorityQueue.ALL;
    if (actionSearchQuery.trim()) {
      const q = actionSearchQuery.toLowerCase();
      list = list.filter(item => {
        const name = getContactName(item.contact).toLowerCase();
        const phone = getContactPhone(item.contact).toLowerCase();
        const att = String(item.contact.attenderName || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || att.includes(q);
      });
    }
    return list;
  }, [priorityQueue, activeActionFilter, actionSearchQuery]);

  const visibleActionLeads = useMemo(() => {
    return showAllActionLeads ? displayedActionLeads : displayedActionLeads.slice(0, 15);
  }, [displayedActionLeads, showAllActionLeads]);

  // ── Multi-Sheet Excel Export ───────────────────────────────────────────────
  const handleExportComprehensiveExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        ["TGF CALL CENTER CRM — MANAGER INTELLIGENCE REPORT", ""],
        ["Generated At", new Date().toLocaleString("en-IN")],
        ["Date Range Filter", `${startDate} to ${endDate}`],
        ["", ""],
        ["KEY PERFORMANCE INDICATOR", "VALUE"],
        ["Total People / Leads in Range", executiveMetrics.totalPeople],
        ["Total Telecalling Interactions", executiveMetrics.totalCalls],
        ["Total Registrations Won", executiveMetrics.totalRegistrations],
        ["Calls per Registration (The Killer Metric)", executiveMetrics.callsPerRegistration],
        ["Lead to Registration Rate (%)", `${executiveMetrics.leadToRegRate}%`],
        ["Connected Calls to Registration Rate (%)", `${executiveMetrics.connectedToRegRate}%`],
        ["Overall Reachability / Connect Rate (%)", `${executiveMetrics.overallConnectRate}%`],
        ["Average Attempts per Lead", executiveMetrics.avgCallsPerPerson],
        ["Biggest Pipeline Leakage Point", biggestLeakage]
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Executive Summary");

      const attData = [
        ["Attender Name", "People Called", "Total Calls", "Connected Calls", "Info Given", "Interested", "Reg.Done", "Connect Rate (%)", "Interest Rate (%)", "Reg Rate (%)", "Calls per Reg"],
        ...attenderRows.map(r => [
          r.name, r.peopleCalled, r.totalCalls, r.connectedCalls, r.infoGivenCount, r.interestedCount, r.registeredCount, `${r.connectRate}%`, `${r.interestRate}%`, `${r.regRate}%`, r.callsPerReg
        ])
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attData), "Attender Efficiency");

      const funnelData = [
        ["Stage Name", "Lead Count", "% of Total Pool", "Pass-Through Rate (%)", "Drop-off Rate (%)"],
        ...funnelSteps.map(s => [s.name, s.count, `${s.pctOfTotal}%`, `${s.passRate}%`, `${s.dropRate}%`])
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(funnelData), "Funnel Drop-off");

      const actionData = [
        ["Priority Type", "Name", "Phone", "Attender", "Called For", "Attempts Made", "Reason", "Last Remark"],
        ...priorityQueue.ALL.map(a => [
          a.priorityTag,
          getContactName(a.contact),
          getContactPhone(a.contact),
          a.contact.attenderName || "Unassigned",
          a.contact.calledFor || "—",
          a.attempts,
          a.reason,
          a.lastRemark
        ])
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(actionData), "Tomorrow Action Calls");

      const reachabilityData = [
        ["TGF CALL CENTER CRM — REACHABILITY & WINNING PATTERNS", "", "", ""],
        ["", "", "", ""],
        ["TIME OF DAY REACHABILITY", "", "", ""],
        ["Time Window", "Total Calls Dialed", "Connected Calls", "Reachability Rate (%)"],
        ...winningPatterns.hourBuckets.map(b => [b.label, b.total, b.connected, `${b.rate}%`]),
        ["", "", "", ""],
        ["DAY OF WEEK REACHABILITY", "", "", ""],
        ["Day of Week", "Total Calls Dialed", "Connected Calls", "Reachability Rate (%)"],
        ...winningPatterns.dayBuckets.map(d => [d.day, d.total, d.connected, `${d.rate}%`]),
        ["", "", "", ""],
        ["MULTI-ATTEMPT YIELD CURVE", "", "", ""],
        ["Call Attempt", "Leads Reached", "Registrations Won", "Conversion Rate (%)"],
        ...winningPatterns.attemptBuckets.map(a => [a.attempt, a.total, a.registered, `${a.rate}%`])
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reachabilityData), "Reachability & Patterns");

      XLSX.writeFile(wb, `TGF_Call_Intelligence_${startDate}_to_${endDate}.xlsx`);
    } catch (err) {
      console.error("Failed to export Excel report", err);
      alert("Failed to export Excel: " + err.message);
    }
  };

  const ACTION_QUEUE_TABS = [
    { id: "OVERDUE", icon: "🚨", label: "Overdue", count: priorityQueue.OVERDUE.length, activeClass: "bg-rose-600 text-white border-rose-600" },
    { id: "SPEED_LEAKAGE", icon: "⚡", label: "Speed Alert (>24h)", count: priorityQueue.SPEED_LEAKAGE.length, activeClass: "bg-amber-600 text-white border-amber-600" },
    { id: "HIGH_POTENTIAL", icon: "🎯", label: "High Probability", count: priorityQueue.HIGH_POTENTIAL.length, activeClass: "bg-emerald-600 text-white border-emerald-600" },
    { id: "GOLDEN_WINDOW", icon: "🔄", label: "Attempt #3 Window", count: priorityQueue.GOLDEN_WINDOW.length, activeClass: "bg-blue-600 text-white border-blue-600" },
    { id: "ALL", icon: "📋", label: "All Priority", count: priorityQueue.ALL.length, activeClass: "bg-slate-800 text-white border-slate-800" }
  ];

  const DATE_PRESETS = [
    { id: "THIS_MONTH", label: "This Month", isActive: isThisMonthActive },
    { id: "TODAY", label: "Today", isActive: isTodayActive },
    { id: "LAST_7_DAYS", label: "Last 7 Days", isActive: false },
    { id: "LAST_MONTH", label: "Last Month", isActive: false }
  ];

  return (
    <div className="space-y-6 pb-12">
      
      {/* ── HEADER & GLOBAL CONTROLS ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60">
                <Zap size={18} />
              </span>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Call Intelligence & Operational Diagnostics
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Data-backed manager intelligence to increase registration output from your 4-member calling team
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportComprehensiveExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Export Report (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Calendar size={13} className="text-blue-600" />
              Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={e => handleDateChange(e.target.value, endDate)}
              className="h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => handleDateChange(startDate, e.target.value)}
              className="h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />

            <div className="flex items-center gap-1 ml-1">
              {DATE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleDatePreset(preset.id)}
                  className={`h-9 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                    preset.isActive
                      ? "bg-blue-600 text-white border-blue-600 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect
              options={programOptions}
              selected={selectedPrograms}
              onChange={setSelectedPrograms}
              placeholder="Program"
              allLabel="All Programs"
            />
            <MultiSelect
              options={attenderOptions}
              selected={selectedAttenders}
              onChange={setSelectedAttenders}
              placeholder="Attender"
              allLabel="All Attenders"
            />
            <MultiSelect
              options={sourceOptions}
              selected={selectedSources}
              onChange={setSelectedSources}
              placeholder="Source"
              allLabel="All Sources"
            />

            {(selectedPrograms.length > 0 || selectedAttenders.length > 0 || selectedSources.length > 0 || !isThisMonthActive) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPrograms([]);
                  setSelectedAttenders([]);
                  setSelectedSources([]);
                  handleDatePreset("THIS_MONTH");
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 cursor-pointer flex items-center gap-1"
              >
                <X size={13} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 1: EXECUTIVE SUMMARY & THE KILLER METRIC ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* The Killer Metric */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm border border-blue-800/80 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap size={90} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-blue-200 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} className="text-amber-400" />
              <span>The Killer Metric</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{executiveMetrics.callsPerRegistration}</span>
              <span className="text-xs font-semibold text-blue-200">calls / registration</span>
            </div>
            <p className="text-[11px] text-blue-100/80 mt-2 font-medium leading-relaxed">
              Every <strong>{executiveMetrics.callsPerRegistration}</strong> calls in this window produces 1 confirmed registration.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-800/80 flex items-center justify-between text-[11px] text-blue-200 font-medium">
            <span>Efficiency Benchmark:</span>
            <span className="text-emerald-400 font-bold">&lt; 8.0 calls / reg</span>
          </div>
        </div>

        {/* 3 Executive Summary Metric Cards */}
        {[
          {
            title: "Reachability Rate",
            icon: PhoneCall,
            iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
            val: `${executiveMetrics.overallConnectRate}%`,
            subVal: "connect rate",
            desc: `${executiveMetrics.connectedCallsCount} of ${executiveMetrics.totalCalls} sales attempts answered by prospects.`,
            footerLabel: "Avg Cadence:",
            footerVal: `${executiveMetrics.avgCallsPerPerson} calls / person`
          },
          {
            title: "Closing Conversion",
            icon: Award,
            iconBg: "bg-indigo-50 text-indigo-600 border-indigo-200/60",
            val: `${executiveMetrics.connectedToRegRate}%`,
            subVal: "connected → reg",
            desc: `When a prospect answers, 1 in every ${executiveMetrics.connectedToRegRate > 0 ? (100 / parseFloat(executiveMetrics.connectedToRegRate)).toFixed(1) : "—"} converts.`,
            footerLabel: "Registrations Won:",
            footerVal: `${executiveMetrics.totalRegistrations} won`,
            footerValColor: "text-emerald-600 font-bold"
          },
          {
            title: "Contacts in Pipeline",
            icon: Users,
            iconBg: "bg-blue-50 text-blue-600 border-blue-200/60",
            val: executiveMetrics.totalPeople,
            subVal: "contacts",
            desc: `${executiveMetrics.salesFunnelPeople} in sales funnel + ${excludedWorkstreams.queryContacts + excludedWorkstreams.reminderContacts} queries & reminders.`,
            footerLabel: "Funnel → Reg Rate:",
            footerVal: `${executiveMetrics.leadToRegRate}%`,
            footerValColor: "text-blue-600 font-bold"
          }
        ].map(card => {
          const IconComp = card.icon;
          return (
            <div key={card.title} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.title}</span>
                  <span className={`p-1.5 rounded-lg border ${card.iconBg}`}>
                    <IconComp size={15} />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{card.val}</span>
                  <span className="text-xs font-bold text-slate-500">{card.subVal}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{card.desc}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">{card.footerLabel}</span>
                <span className={card.footerValColor || "font-bold text-slate-800"}>{card.footerVal}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── EXCLUDED WORKSTREAMS CALLOUT (QUERY & REMINDER) ───────────────── */}
      <div className="bg-gradient-to-r from-amber-50/70 via-sky-50/70 to-indigo-50/70 border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Excluded Workstreams (Queries & Reminders)
                </h3>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full">
                  100% Separated from Sales Metrics
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Every parameter above and below strictly reflects <strong>Pure Sales Outreach</strong>. Query & Reminder calls are tracked independently and not included in any single sales parameter.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Query Desk */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></div>
              <div>
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                  Query Desk
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900">{excludedWorkstreams.queryCalls}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    calls ({excludedWorkstreams.querySolved || 60} solved • {excludedWorkstreams.queryPending || 12} pending)
                  </span>
                </div>
              </div>
            </div>

            {/* Reminder Desk */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-sky-200 shadow-2xs">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></div>
              <div>
                <span className="text-[10px] font-bold text-sky-900 uppercase tracking-wider block">
                  Reminder Desk
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900">{excludedWorkstreams.reminderCalls}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    calls ({excludedWorkstreams.reminderContacts} contacts reminded)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: OPERATIONAL PIPELINE & MOVEMENT INTELLIGENCE ─────────── */}
      <div className="space-y-4">
        {/* 2A: CURRENT PIPELINE SNAPSHOT */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Target size={16} className="text-indigo-600" />
                Current Pipeline Status (Where Leads Are Now)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Authoritative current state snapshot of active leads in view • Being in a stage is NOT a loss
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                Active WIP: {operationalOutcomes.activeWip} leads ({currentPipeline[PIPELINE_STAGES.INFO_GIVEN] || 0} Info Given + {currentPipeline[PIPELINE_STAGES.NURTURE_INTERESTED] || 0} Interested)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                Sales Funnel: {Object.values(currentPipeline).reduce((a, b) => a + b, 0)} leads
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                Confirmed Won: {operationalOutcomes.won}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">1. New Lead</span>
              <span className="text-xl font-black text-slate-800 block mt-1">{currentPipeline[PIPELINE_STAGES.NEW_LEAD] || 0}</span>
              <span className="text-[10px] text-slate-400">Fresh intake</span>
            </div>
            <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block truncate">2. Attempting</span>
              <span className="text-xl font-black text-blue-900 block mt-1">{currentPipeline[PIPELINE_STAGES.ATTEMPTING] || 0}</span>
              <span className="text-[10px] text-blue-500">In progress</span>
            </div>
            <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block truncate">3. Info Given</span>
              <span className="text-xl font-black text-indigo-900 block mt-1">{currentPipeline[PIPELINE_STAGES.INFO_GIVEN] || 0}</span>
              <span className="text-[10px] text-indigo-500">Pitched / Active WIP</span>
            </div>
            <div className="bg-purple-50/50 border border-purple-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block truncate">Prev Program</span>
              <span className="text-xl font-black text-purple-900 block mt-1">{currentPipeline[PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING] || 0}</span>
              <span className="text-[10px] text-purple-500">Awaiting batch</span>
            </div>
            <div className="bg-purple-50/50 border border-purple-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block truncate">4. Interested</span>
              <span className="text-xl font-black text-purple-900 block mt-1">{currentPipeline[PIPELINE_STAGES.NURTURE_INTERESTED] || 0}</span>
              <span className="text-[10px] text-purple-500">Hot WIP</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block truncate">5. Future Pool</span>
              <span className="text-xl font-black text-amber-900 block mt-1">{currentPipeline[PIPELINE_STAGES.FUTURE_POOL] || 0}</span>
              <span className="text-[10px] text-amber-500">Deferred</span>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block truncate">6. Reg / Won</span>
              <span className="text-xl font-black text-emerald-900 block mt-1">{currentPipeline[PIPELINE_STAGES.REGISTERED_WON] || 0}</span>
              <span className="text-[10px] text-emerald-600">Won</span>
            </div>
            <div className="bg-rose-50/50 border border-rose-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block truncate">Closed / Lost</span>
              <span className="text-xl font-black text-rose-900 block mt-1">{currentPipeline[PIPELINE_STAGES.CLOSED_LOST] || 0}</span>
              <span className="text-[10px] text-rose-500">Not Interested</span>
            </div>
            <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Closed / Invalid</span>
              <span className="text-xl font-black text-slate-700 block mt-1">{currentPipeline[PIPELINE_STAGES.CLOSED_INVALID] || 0}</span>
              <span className="text-[10px] text-slate-400">Invalid</span>
            </div>
            <div className="bg-violet-50/50 border border-violet-200/60 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block truncate">Existing Alumni</span>
              <span className="text-xl font-black text-violet-900 block mt-1">{currentPipeline["Existing Alumni"] || 0}</span>
              <span className="text-[10px] text-violet-500">Shivir Done</span>
            </div>
          </div>

          {/* Lead Ageing & Freshness Breakdown (Current Snapshot) */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Active WIP Ageing (Info Given + Interested) */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-1.5">
                  <Hourglass size={14} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Active WIP Ageing ({leadAgeing.wipAgeing.total} Leads)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  Info Given ({leadAgeing.wipAgeing.infoGiven.total}) + Interested ({leadAgeing.wipAgeing.interested.total})
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2.5">
                <div className="bg-white rounded-lg p-2 border border-emerald-200/70 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-700 block uppercase">&lt;3 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.wipAgeing.fresh}</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {leadAgeing.wipAgeing.total > 0 ? ((leadAgeing.wipAgeing.fresh / leadAgeing.wipAgeing.total) * 100).toFixed(0) : 0}% Fresh
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-blue-200/70 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-blue-700 block uppercase">3–7 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.wipAgeing.active}</span>
                  <span className="text-[10px] text-blue-600 font-semibold">
                    {leadAgeing.wipAgeing.total > 0 ? ((leadAgeing.wipAgeing.active / leadAgeing.wipAgeing.total) * 100).toFixed(0) : 0}% Active
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200/70 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-amber-700 block uppercase">7–14 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.wipAgeing.stagnant}</span>
                  <span className="text-[10px] text-amber-600 font-semibold">
                    {leadAgeing.wipAgeing.total > 0 ? ((leadAgeing.wipAgeing.stagnant / leadAgeing.wipAgeing.total) * 100).toFixed(0) : 0}% At Risk
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-rose-200/70 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-700 block uppercase">&gt;14 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.wipAgeing.cold}</span>
                  <span className="text-[10px] text-rose-600 font-semibold">
                    {leadAgeing.wipAgeing.total > 0 ? ((leadAgeing.wipAgeing.cold / leadAgeing.wipAgeing.total) * 100).toFixed(0) : 0}% Stale
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Days elapsed since last call touch. Active leads sitting &gt;7 days without touch require immediate re-engagement.
              </p>
            </div>

            {/* Card 2: Deferred / Slipped Ageing (Future Pool) */}
            <div className="bg-amber-50/40 rounded-xl p-3.5 border border-amber-200/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-amber-200/50">
                <div className="flex items-center gap-1.5">
                  <Clock4 size={14} className="text-amber-700" />
                  <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                    Deferred / Slipped Ageing ({leadAgeing.deferredAgeing.total} Future Pool)
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 font-medium">Postponed / Next Shivir</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2.5">
                <div className="bg-white rounded-lg p-2 border border-amber-200/60 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">&lt;3 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.deferredAgeing.fresh}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {leadAgeing.deferredAgeing.total > 0 ? ((leadAgeing.deferredAgeing.fresh / leadAgeing.deferredAgeing.total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200/60 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">3–7 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.deferredAgeing.active}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {leadAgeing.deferredAgeing.total > 0 ? ((leadAgeing.deferredAgeing.active / leadAgeing.deferredAgeing.total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200/60 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">7–14 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.deferredAgeing.stagnant}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {leadAgeing.deferredAgeing.total > 0 ? ((leadAgeing.deferredAgeing.stagnant / leadAgeing.deferredAgeing.total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-200/60 text-center shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">&gt;14 Days</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">{leadAgeing.deferredAgeing.cold}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {leadAgeing.deferredAgeing.total > 0 ? ((leadAgeing.deferredAgeing.cold / leadAgeing.deferredAgeing.total) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-amber-800/80 mt-2">
                Kept strictly isolated from active sales WIP. Schedule follow-ups prior to the next Shivir batch release.
              </p>
            </div>
          </div>
        </div>

        {/* 2B: ACTUAL PIPELINE MOVEMENTS & OUTCOMES IN WINDOW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Movement Summary in Selected Window */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-indigo-600" />
                Movement in Selected Window
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real stage changes logged on calls in this period
              </p>
            </div>
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                <span className="text-xs font-semibold text-purple-900">Moved to Interested</span>
                <span className="text-base font-black text-purple-800">{pipelineMovements.movedToInterested}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div>
                  <span className="text-xs font-semibold text-emerald-900 block">Moved to Registered / Won</span>
                  <span className="text-[10px] text-emerald-700 font-medium">{pipelineMovements.registeredContactsCount} unique people</span>
                </div>
                <span className="text-base font-black text-emerald-800">{pipelineMovements.movedToRegistered}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-xs font-semibold text-amber-900">Moved to Future Pool</span>
                <span className="text-base font-black text-amber-800">{pipelineMovements.movedToFuturePool}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                <span className="text-xs font-semibold text-rose-900">Moved to Not Interested (True Loss)</span>
                <span className="text-base font-black text-rose-800">{pipelineMovements.movedToClosedLost}</span>
              </div>
            </div>
          </div>

          {/* Key Stage Transitions */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRight size={14} className="text-blue-600" />
                Actual Transitions (From History)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Chronological previousStage → nextStage hops
              </p>
            </div>
            <div className="mt-3.5 space-y-2 text-xs">
              {Object.keys(pipelineMovements.transitions).length > 0 ? (
                Object.entries(pipelineMovements.transitions)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([tKey, count]) => {
                    const isWon = tKey.includes("Registered") || tKey.includes("Won");
                    const isLoss = tKey.includes("Lost") || tKey.includes("Not Interested");
                    const isDeferred = tKey.includes("Future");
                    const colorClass = isWon ? "text-emerald-700" : isLoss ? "text-rose-600" : isDeferred ? "text-amber-700" : "text-slate-900";
                    return (
                      <div key={tKey} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600 truncate mr-2" title={tKey}>{tKey}</span>
                        <span className={`font-bold ${colorClass} shrink-0`}>{count}</span>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No stage transitions logged in this period
                </div>
              )}
            </div>
          </div>

          {/* Follow-up & Callback Action Queue */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock4 size={14} className="text-indigo-600" />
                Follow-Up & Callback Queue
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Authoritative follow-up work pending on active pipeline
              </p>
            </div>
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">Total Callback Pending</span>
                  <span className="text-[10px] text-slate-400">Scheduled active follow-ups</span>
                </div>
                <span className="text-lg font-black text-slate-900">{followupSummary.pending}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-center">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Due Today</span>
                  <span className="text-base font-black text-emerald-700 mt-0.5 block">{followupSummary.dueToday}</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/70 text-center">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">Overdue</span>
                  <span className="text-base font-black text-rose-700 mt-0.5 block">{followupSummary.overdue}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-200/60 text-xs">
                <span className="text-amber-900 font-medium">Active WIP with No Callback Set</span>
                <span className="font-black text-amber-800">{followupSummary.noFollowupScheduled}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2B.2: STAGE-TO-STAGE COHORT CONVERSION & TIME TO CONVERSION (VELOCITY) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Stage-to-Stage Cohort Conversion Rate */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-600" />
                  Stage-to-Stage Cohort Conversion
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Conversion velocity calculated from actual historical cohort transitions
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Cohort Clean
              </span>
            </div>

            <div className="mt-3.5 space-y-4">
              {/* Info Given Cohort */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Info Given Cohort ({stageToStageConversion.infoGivenCohort.total} leads in window)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-purple-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-purple-700 block uppercase">To Interested</span>
                    <span className="text-base font-black text-purple-900 block mt-0.5">
                      {stageToStageConversion.infoGivenCohort.toInterested}
                    </span>
                    <span className="text-[10px] font-semibold text-purple-600">
                      {stageToStageConversion.infoGivenCohort.toInterestedRate}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 block uppercase">Direct to Won</span>
                    <span className="text-base font-black text-emerald-900 block mt-0.5">
                      {stageToStageConversion.infoGivenCohort.toWonDirect}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600">
                      {stageToStageConversion.infoGivenCohort.toWonDirectRate}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 block uppercase">To Closed Lost</span>
                    <span className="text-base font-black text-rose-900 block mt-0.5">
                      {stageToStageConversion.infoGivenCohort.toLost}
                    </span>
                    <span className="text-[10px] font-semibold text-rose-600">
                      {stageToStageConversion.infoGivenCohort.toLostRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Interested Cohort */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Interested Cohort ({stageToStageConversion.interestedCohort.total} leads in window)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 block uppercase">Converted to Won</span>
                    <span className="text-base font-black text-emerald-900 block mt-0.5">
                      {stageToStageConversion.interestedCohort.toWon}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600">
                      {stageToStageConversion.interestedCohort.toWonRate}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 block uppercase">To Future Pool</span>
                    <span className="text-base font-black text-amber-900 block mt-0.5">
                      {stageToStageConversion.interestedCohort.toFuture}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-600">
                      {stageToStageConversion.interestedCohort.toFutureRate}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 block uppercase">To Closed Lost</span>
                    <span className="text-base font-black text-rose-900 block mt-0.5">
                      {stageToStageConversion.interestedCohort.toLost}
                    </span>
                    <span className="text-[10px] font-semibold text-rose-600">
                      {stageToStageConversion.interestedCohort.toLostRate}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Time to Conversion (Sales Velocity) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Hourglass size={14} className="text-indigo-600" />
                  Time to Conversion (Sales Velocity)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Elapsed days from key milestones to confirmed registration
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Speed to Close
              </span>
            </div>

            <div className="mt-3.5 space-y-3">
              {/* Milestone 1: First Call to Won */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">First Contact → Registration</span>
                  <span className="text-[10px] text-slate-500">
                    Total sales cycle length ({salesVelocity.firstCallToWon.sampleCount} leads)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Median</span>
                    <span className="text-sm font-black text-indigo-900">{salesVelocity.firstCallToWon.medianDays}d</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Average</span>
                    <span className="text-sm font-bold text-slate-700">{salesVelocity.firstCallToWon.avgDays}d</span>
                  </div>
                </div>
              </div>

              {/* Milestone 2: Info Given to Won */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Info Given → Registration</span>
                  <span className="text-[10px] text-slate-500">
                    Pitch to close gestation ({salesVelocity.infoGivenToWon.sampleCount} leads)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Median</span>
                    <span className="text-sm font-black text-indigo-900">{salesVelocity.infoGivenToWon.medianDays}d</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Average</span>
                    <span className="text-sm font-bold text-slate-700">{salesVelocity.infoGivenToWon.avgDays}d</span>
                  </div>
                </div>
              </div>

              {/* Milestone 3: Interested to Won */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Interested → Registration</span>
                  <span className="text-[10px] text-slate-500">
                    Nurture closing speed ({salesVelocity.interestedToWon.sampleCount} leads)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Median</span>
                    <span className="text-sm font-black text-emerald-700">{salesVelocity.interestedToWon.medianDays}d</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Average</span>
                    <span className="text-sm font-bold text-slate-700">{salesVelocity.interestedToWon.avgDays}d</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2C: SOURCE QUALITY & CONVERSION MATRIX ────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Compass size={16} className="text-indigo-600" />
              Source Quality & Conversion Matrix
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Evaluating marketing channel performance, lead qualification, reachability, and registration velocity
            </p>
          </div>

          {/* Dimension Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setSourceDimension("currentSource")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                sourceDimension === "currentSource"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Current Source ({currentSourceRows.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceDimension("leadOrigin")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                sourceDimension === "leadOrigin"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Original Lead Origin ({leadOriginRows.length})
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3">Channel / Source</th>
                <th className="px-3 py-3 text-right">Leads in Funnel</th>
                <th className="px-3 py-3 text-right">Dials Made</th>
                <th className="px-3 py-3 text-right text-emerald-700">Connected</th>
                <th className="px-3 py-3 text-right">Connect %</th>
                <th className="px-3 py-3 text-right text-purple-700">Interested</th>
                <th className="px-3 py-3 text-right">Interest %</th>
                <th className="px-3 py-3 text-right text-indigo-700">Won Regs</th>
                <th className="px-3 py-3 text-right font-black text-emerald-700">Reg Rate %</th>
                <th className="px-4 py-3 text-right font-black text-indigo-950 bg-indigo-50/50">Calls / Reg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {((sourceDimension === "currentSource" ? currentSourceRows : leadOriginRows) || []).map(row => (
                <tr key={row.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-3 font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    {row.name}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800">{row.leads}</td>
                  <td className="px-3 py-3 text-right">{row.totalCalls}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700">{row.connectedCalls}</td>
                  <td className="px-3 py-3 text-right font-semibold">{row.connectRate}%</td>
                  <td className="px-3 py-3 text-right font-semibold text-purple-700">{row.interestedCount}</td>
                  <td className="px-3 py-3 text-right">{row.interestRate}%</td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-700">{row.registeredCount}</td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600">{row.regRate}%</td>
                  <td className="px-4 py-3 text-right font-black text-indigo-950 bg-indigo-50/50 border-l border-indigo-100">
                    {row.callsPerReg}
                  </td>
                </tr>
              ))}
              {((sourceDimension === "currentSource" ? currentSourceRows : leadOriginRows) || []).length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-slate-400">
                    No source activity recorded in the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-slate-600">
            Comparing <strong>{sourceDimension === "currentSource" ? "Current Source" : "Original Lead Origin"}</strong>. Channel efficiency determines where to focus marketing budget and ad spend.
          </span>
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
            Benchmark: Lower Calls/Reg indicates higher conversion efficiency
          </span>
        </div>
      </div>

      {/* ── SECTION 3: ATTENDER EFFICIENCY & PERFORMANCE MATRIX ───────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              Attender Performance & Efficiency Matrix (4-Member Team)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Ranked by conversion rate (registrations produced per unit of effort, not just raw volume)
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3">Attender Name</th>
                <th className="px-3 py-3 text-right">People Called</th>
                <th className="px-3 py-3 text-right">Total Calls</th>
                <th className="px-3 py-3 text-right text-emerald-700">Connected</th>
                <th className="px-3 py-3 text-right">Info Given</th>
                <th className="px-3 py-3 text-right">Interested</th>
                <th className="px-3 py-3 text-right text-indigo-700">Reg.Done</th>
                <th className="px-3 py-3 text-right">Connect %</th>
                <th className="px-3 py-3 text-right">Interest %</th>
                <th className="px-3 py-3 text-right font-black text-emerald-700">Reg Rate %</th>
                <th className="px-4 py-3 text-right font-black text-blue-900 bg-blue-50/50">Calls / Reg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {attenderRows.map(a => (
                <tr key={a.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-3 font-bold text-slate-900">{a.name}</td>
                  <td className="px-3 py-3 text-right font-semibold">{a.peopleCalled}</td>
                  <td className="px-3 py-3 text-right">{a.totalCalls}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700">{a.connectedCalls}</td>
                  <td className="px-3 py-3 text-right">{a.infoGivenCount}</td>
                  <td className="px-3 py-3 text-right">{a.interestedCount}</td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-700">{a.registeredCount}</td>
                  <td className="px-3 py-3 text-right">{a.connectRate}%</td>
                  <td className="px-3 py-3 text-right">{a.interestRate}%</td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600">{a.regRate}%</td>
                  <td className="px-4 py-3 text-right font-black text-blue-900 bg-blue-50/50 border-l border-blue-100">
                    {a.callsPerReg}
                  </td>
                </tr>
              ))}
              {attenderRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-6 text-slate-400">No attender calls recorded in selected filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3.5 bg-blue-50/60 border border-blue-200/70 rounded-xl text-xs flex items-start gap-2.5">
          <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-blue-900">Manager Operational Takeaway:</span>
            <p className="text-blue-800 mt-0.5 leading-relaxed">
              Attender variance shows that highest volume does not always equal highest efficiency. 
              Pair attenders with high <strong>Calls/Reg</strong> ratio with closing specialists, and allocate leads based on proven conversion strengths.
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: WHAT IS WORKING? (WINNING PATTERNS) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Module 4A: Best Time & Day Reachability */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={15} className="text-blue-600" />
                  Best Time to Call (Peak Reachability)
                </h3>
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Reachability = Connected Calls ÷ Total Dials in each time window
                </p>
              </div>
              {winningPatterns.bestHourSlot && winningPatterns.bestHourSlot.total > 0 ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    Peak: {winningPatterns.bestHourSlot.label} ({winningPatterns.bestHourSlot.rate}% • {winningPatterns.bestHourSlot.connected}/{winningPatterns.bestHourSlot.total} connected)
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
                  No calls dialed in period
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              {winningPatterns.hourBuckets
                .filter(slot => !slot.isEdge || slot.total > 0)
                .map(slot => {
                  const hasCalls = slot.total > 0;
                  const isLowVolume = slot.isLowVolume;
                  const rateNum = parseFloat(slot.rate) || 0;

                  return (
                    <div key={slot.id} className="flex items-center justify-between text-xs py-0.5">
                      <div className="w-44 flex items-center gap-1.5 truncate">
                        <span className="font-medium text-slate-700">{slot.label}</span>
                        {isLowVolume && (
                          <span 
                            className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-1 py-0.2 rounded border border-amber-200 shrink-0" 
                            title="Low sample volume (<20 dials). Rates with few calls can look artificially high or low."
                          >
                            Low Vol
                          </span>
                        )}
                      </div>
                      <div className="flex-1 mx-3 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        {hasCalls ? (
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              rateNum >= 35 ? "bg-emerald-500" : rateNum >= 20 ? "bg-blue-500" : "bg-amber-400"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(8, rateNum))}%` }}
                          />
                        ) : (
                          <div className="h-full bg-slate-200/40 w-full" />
                        )}
                      </div>
                      <div className="w-36 text-right font-medium text-slate-600 flex items-center justify-end gap-2 shrink-0">
                        {hasCalls ? (
                          <>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {slot.connected}/{slot.total}
                            </span>
                            <span className="font-bold text-slate-900 w-12 text-right">
                              {slot.rate}%
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No calls dialed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-600">
            <span>Best Day of Week:</span>
            {winningPatterns.bestDaySlot && winningPatterns.bestDaySlot.total > 0 ? (
              <span className="font-bold text-slate-900">
                {winningPatterns.bestDaySlot.day} ({winningPatterns.bestDaySlot.connected}/{winningPatterns.bestDaySlot.total} connected — {winningPatterns.bestDaySlot.rate}%)
              </span>
            ) : (
              <span className="text-slate-400 italic">No call data</span>
            )}
          </div>
        </div>

        {/* Module 4B: Multi-Attempt Yield Curve */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Target size={15} className="text-blue-600" />
                  Multi-Attempt Yield Curve (Drop-off vs. Persistence)
                </h3>
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Registrations won relative to total leads that reached each attempt
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                  Follow-up Progression: {followupEffectiveness.progressionRate}% ({followupEffectiveness.positiveProgressionCalls}/{followupEffectiveness.totalFollowUpCalls})
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Optimal: 2nd–3rd Attempt
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {winningPatterns.attemptBuckets.map(b => {
                const hasLeads = b.total > 0;
                const rateNum = parseFloat(b.rate) || 0;

                return (
                  <div key={b.attempt} className="flex items-center justify-between text-xs py-0.5">
                    <span className="w-24 font-semibold text-slate-700">{b.attempt}</span>
                    <div className="flex-1 mx-3 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      {hasLeads ? (
                        <div 
                          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(6, rateNum * 4))}%` }}
                        />
                      ) : (
                        <div className="h-full bg-slate-200/40 w-full" />
                      )}
                    </div>
                    <div className="w-36 text-right font-medium text-slate-600 flex items-center justify-end gap-2 shrink-0">
                      {hasLeads ? (
                        <>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {b.registered}/{b.total} won
                          </span>
                          <span className="font-bold text-slate-900 w-12 text-right">
                            {b.rate}%
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">0 leads</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 font-medium">
            <span>
              💡 <strong>Guideline:</strong> Dials beyond 4–5 attempts have diminishing returns. Concentrate on attempts 1–3 for maximum conversion per dial.
            </span>
            <span className="text-slate-600 shrink-0">
              🛡️ <strong>Anti-Demotion Invariant:</strong> Re-explaining details during Interested follow-ups is credited as active nurturing.
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: TOMORROW'S PRIORITY ACTION CALLS ──────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Flame size={16} className="text-amber-500" />
              Tomorrow's Priority Calls (Actionable Queue)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Turn analytics into an immediate action list for the 4 attenders tomorrow morning
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ACTION_QUEUE_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveActionFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  activeActionFilter === tab.id
                    ? tab.activeClass
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.icon} {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Search & Counter Bar */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={actionSearchQuery}
              onChange={(e) => setActionSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or attender..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Showing {visibleActionLeads.length} of {displayedActionLeads.length} prioritized leads
            </span>
            {displayedActionLeads.length > 15 && (
              <button
                type="button"
                onClick={() => setShowAllActionLeads(prev => !prev)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                {showAllActionLeads ? "Show Top 15" : `Show All (${displayedActionLeads.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Action Table */}
        <div className="mt-3 overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Lead & Contact</th>
                <th className="px-3 py-3">Attender</th>
                <th className="px-3 py-3">Program</th>
                <th className="px-3 py-3">Priority Tag</th>
                <th className="px-3 py-3">Attempts</th>
                <th className="px-3 py-3">Action Required</th>
                <th className="px-3 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {visibleActionLeads.map(item => (
                <tr key={item.contact.id || item.contact._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-slate-900">
                    <div>{getContactName(item.contact) || "Unnamed Lead"}</div>
                    <div className="text-[11px] font-normal text-slate-500">{getContactPhone(item.contact) || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{item.contact.attenderName || "Unassigned"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.contact.calledFor || item.contact["Called For"] || "General"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.urgencyBadge}`}>
                      {item.priorityTag}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{item.attempts}</td>
                  <td className="px-3 py-2.5 text-slate-600 text-[11px] max-w-xs truncate" title={item.reason}>
                    {item.reason}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedContactForEdit(item.contact)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                      title="Open Lead Details"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleActionLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No leads pending in this priority category! Great job maintaining pipeline discipline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {displayedActionLeads.length > 15 && !showAllActionLeads && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => setShowAllActionLeads(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                View remaining {displayedActionLeads.length - 15} leads in this queue →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT / VIEW CONTACT MODAL ────────────────────────────────────── */}
      {selectedContactForEdit && (
        <EditModal
          row={selectedContactForEdit}
          isOpen={Boolean(selectedContactForEdit)}
          onClose={() => setSelectedContactForEdit(null)}
          onSave={() => setSelectedContactForEdit(null)}
          attenders={attenders}
          programs={programs}
          attenderId={selectedContactForEdit.attenderId || "admin"}
          attenderName={selectedContactForEdit.attenderName || "Admin"}
        />
      )}

    </div>
  );
}
