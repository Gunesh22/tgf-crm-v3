import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Zap, Users, PhoneCall, TrendingUp, Target, Clock, Calendar, 
  AlertTriangle, Download, Search, ChevronDown, Award, Flame, 
  Eye, Sparkles, X, Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  parseTimestamp, 
  getContactPhone, 
  getContactName, 
  getCanonicalStatus, 
  classifyCallStatus, 
  getAllCallEntries, 
  getLocalDateStr, 
  getCanonicalRegistrations, 
  getContactSource, 
  getContactLeadOrigin 
} from "../utils.jsx";
import { EditModal } from "../../attender/components/EditModal";

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
    funnelSteps,
    biggestLeakage,
    outcomeBreakdown,
    attenderRows,
    winningPatterns,
    priorityQueue
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

    const contacts = [];
    const contactCallsMap = new Map();
    let totalCallsCount = 0;
    let connectedCallsCount = 0;

    const hourBuckets = TIME_SLOTS.map(s => ({ ...s, total: 0, connected: 0, rate: "0.0", isLowVolume: false }));
    const dayBuckets = DAYS_OF_WEEK.map(day => ({ day, total: 0, connected: 0, rate: "0.0" }));
    const attemptBuckets = [
      { attempt: "1st Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "2nd Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "3rd Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "4th Call", total: 0, registered: 0, rate: "0.0" },
      { attempt: "5th+ Call", total: 0, registered: 0, rate: "0.0" }
    ];

    callLogs.forEach(c => {
      const entries = getAllCallEntries(c);
      const aId = String(c.attenderId || "").trim();
      const aName = String(c.attenderName || "").trim();
      const assigned = Array.isArray(c.assignedTo) ? c.assignedTo.map(String) : [];
      const callAttenders = entries.map(call => String(call.attenderName || call.attenderId || "").trim()).filter(Boolean);

      if (selectedPrograms.length > 0) {
        const rawP = String(c.calledFor || c["Called For"] || c.programName || "");
        const contactProgs = rawP.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        const callProgs = entries.map(call => String(call.calledFor || "").trim().toLowerCase()).filter(Boolean);
        const allProgs = [...contactProgs, ...callProgs];
        const matches = selectedPrograms.some(sel => {
          const sLower = sel.trim().toLowerCase();
          return allProgs.some(p => p === sLower || p.includes(sLower));
        });
        if (!matches) return;
      }

      if (selectedAttenders.length > 0) {
        const matchesAtt = selectedAttenders.some(sel => 
          sel === aId || sel === aName || assigned.includes(sel) || callAttenders.includes(sel)
        );
        if (!matchesAtt) return;
      }

      if (selectedSources.length > 0) {
        const s = String(getContactSource(c) || getContactLeadOrigin(c) || "").trim();
        if (!selectedSources.includes(s)) return;
      }

      const inRangeCalls = entries.filter(call => {
        if (!call.timestamp) return false;
        const dt = getLocalDateStr(call.timestamp);
        if ((startDate && dt < startDate) || (endDate && dt > endDate)) return false;
        if (selectedAttenders.length > 0) {
          const callAtt = String(call.attenderName || call.attenderId || "").trim();
          const matchesCall = selectedAttenders.some(sel => sel === callAtt);
          const matchesRoot = selectedAttenders.some(sel => sel === aId || sel === aName || assigned.includes(sel));
          return matchesCall || (!callAtt && matchesRoot);
        }
        return true;
      });

      const lastActivity = c.lastCalledAt || c.updatedAt || c.createdAt;
      const lastDt = lastActivity ? getLocalDateStr(lastActivity) : "";
      const isActivityInRange = (!startDate || lastDt >= startDate) && (!endDate || lastDt <= endDate);

      if (inRangeCalls.length > 0 || isActivityInRange) {
        const cId = String(c.id || c._id);
        contacts.push(c);
        contactCallsMap.set(cId, inRangeCalls);

        inRangeCalls.forEach(call => {
          totalCallsCount++;
          const isConn = classifyCallStatus(call.status) === "CONNECTED";
          if (isConn) connectedCallsCount++;

          const d = parseTimestamp(call.timestamp);
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
        });
      }
    });

    const canonRegs = getCanonicalRegistrations(registrations, contacts, {
      startDate,
      endDate,
      selectedProgramIds: selectedPrograms,
      selectedAttenderIds: selectedAttenders,
      selectedSources
    });
    const regIds = new Set(canonRegs.map(r => String(r.contactId || "")).filter(Boolean));
    const regCloserMap = new Map();
    canonRegs.forEach(r => {
      if (r.contactId) regCloserMap.set(String(r.contactId), r.attenderName || r.attender || "Unassigned");
    });

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

    contacts.forEach(c => {
      const cId = String(c.id || c._id);
      const calls = contactCallsMap.get(cId) || [];
      const isReg = regIds.has(cId);
      const count = calls.length;

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
      const isContactAttempted = isContactConnected || count > 0;

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

    const totalLeads = contacts.length;
    const totalRegistrations = regIds.size;
    const calcRate = (num, den) => den > 0 ? Math.min(100, Math.max(0, (num / den) * 100)).toFixed(1) : "0.0";
    const calcDrop = (num, den) => den > 0 ? Math.min(100, Math.max(0, ((den - num) / den) * 100)).toFixed(1) : "0.0";

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

    const execMetrics = {
      totalPeople: totalLeads,
      totalCalls: totalCallsCount,
      totalRegistrations,
      connectedCallsCount,
      connectedPeopleCount,
      leadToRegRate: calcRate(totalRegistrations, totalLeads),
      connectedToRegRate: calcRate(totalRegistrations, connectedPeopleCount),
      overallConnectRate: calcRate(connectedCallsCount, totalCallsCount),
      avgCallsPerPerson: totalLeads > 0 ? (totalCallsCount / totalLeads).toFixed(2) : "0.0",
      callsPerRegistration: totalRegistrations > 0 ? (totalCallsCount / totalRegistrations).toFixed(1) : "—"
    };

    return {
      executiveMetrics: execMetrics,
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
      }
    };
  }, [callLogs, registrations, attenders, selectedPrograms, selectedAttenders, selectedSources, startDate, endDate, todayStr]);

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
            desc: `${executiveMetrics.connectedCallsCount} of ${executiveMetrics.totalCalls} attempts answered by prospects.`,
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
            title: "Active Leads in Scope",
            icon: Users,
            iconBg: "bg-blue-50 text-blue-600 border-blue-200/60",
            val: executiveMetrics.totalPeople,
            subVal: "contacts",
            desc: `Across ${executiveMetrics.totalCalls} total call attempts logged in this date range.`,
            footerLabel: "Lead → Reg Rate:",
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

      {/* ── SECTION 2: DROP-OFF PIPELINE FUNNEL ───────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Where Are We Losing People? (Drop-Off Funnel)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Step-by-step attrition across the calling journey to pinpoint exact operational leakage
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold shrink-0">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>Primary Leak: {biggestLeakage}</span>
          </div>
        </div>

        {/* Funnel Step Cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {funnelSteps.map((step, idx) => (
            <div key={step.name} className="flex flex-col bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 relative">
              <span className="text-[11px] font-bold text-slate-500 truncate">{step.name}</span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900">{step.count}</span>
                <span className="text-[10px] font-semibold text-slate-500">({step.pctOfTotal}%)</span>
              </div>
              {idx > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-700 font-semibold">{step.passRate}% pass</span>
                  <span className="text-rose-600 font-bold">-{step.dropRate}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Why Aren't People Registering Breakdown */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Why Aren't People Registering? (Outcome Breakdown of Un-registered Leads)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {Object.entries(outcomeBreakdown).map(([label, count]) => {
              const totalUnreg = executiveMetrics.totalPeople - executiveMetrics.totalRegistrations;
              const pct = totalUnreg > 0 ? ((count / totalUnreg) * 100).toFixed(1) : 0;
              return (
                <div key={label} className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">{label}</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-black text-slate-800">{count}</span>
                    <span className="text-[10px] font-semibold text-slate-400">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
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
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 shrink-0">
                Optimal: 2nd–3rd Attempt
              </span>
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

          <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            💡 <strong>Guideline:</strong> Dials beyond 4–5 attempts have diminishing returns. Keep calling effort concentrated on attempts 1–3 for maximum conversion per dial.
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
