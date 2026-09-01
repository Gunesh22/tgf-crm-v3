import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  BarChart3, Users, PhoneCall, TrendingUp, Award, Filter, X, Download, 
  ArrowRight, CheckCircle2, AlertTriangle, Clock, RefreshCw, Layers, ShieldCheck, HelpCircle,
  ChevronDown, ChevronUp, Info, UserCheck, Eye, Search, Check
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  PieChart, Pie, Cell 
} from "recharts";
import { 
  parseTimestamp, renderVal, getCanonicalStatus, classifyCallStatus, COLORS, getContactName, getContactPhone, getContactCity, getCanonicalStage, getLocalDateStr, getCanonicalPhysicalCalls, getCanonicalRegistrations 
} from "../utils.jsx";
import { PIPELINE_STAGES, getEffectiveStage } from "../../../utils/pipelineEngine";

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

  // Advanced Analytics Collapsible
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

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

          events.push({
            callId,
            contactId: cId,
            contactName: cName,
            contactPhone: cPhone,
            contactCity: cCity,
            pipelineStage: cStage,
            status: h.status || contact.status || "Pending",
            callType: (h.callType || contact.callType || "outgoing").toLowerCase(),
            purpose: getCallPurpose(h, contact),
            source: h.source || contact.source || "",
            calledFor: h.calledFor || contact.calledFor || contact.programName || "",
            programId: h.programId || contact.programId || "",
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
        if (!selectedAttenderIds.includes(ev.attenderId)) return false;
      }

      if (selectedProgramIds.length > 0) {
        const match = selectedProgramIds.some(pId => {
          const progObj = programs.find(p => p.id === pId);
          const pName = progObj ? progObj.name.toLowerCase() : pId.toLowerCase();
          return ev.programId === pId || (ev.calledFor || "").toLowerCase().includes(pName);
        });
        if (!match) return false;
      }

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
        const isInc = (ev.callType || "").startsWith("in");
        if (selectedCallTypes.includes("incoming") && !isInc) return false;
        if (selectedCallTypes.includes("outgoing") && isInc) return false;
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
  }, [allCallEvents, dateFrom, dateTo, dateMode, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors, selectedStatuses, selectedCallTypes, selectedPipelineStages, selectedOutcomes, programs]);

  // 3. FILTERED CONTACTS
  const filteredContacts = useMemo(() => {
    return (callLogs || []).filter(c => {
      if (selectedAttenderIds.length > 0) {
        const attId = c.attenderId || "unassigned";
        if (!selectedAttenderIds.includes(attId)) return false;
      }

      if (selectedProgramIds.length > 0) {
        const match = selectedProgramIds.some(pId => {
          const progObj = programs.find(p => p.id === pId);
          const pName = progObj ? progObj.name.toLowerCase() : pId.toLowerCase();
          return c.programId === pId || (c.calledFor || "").toLowerCase().includes(pName);
        });
        if (!match) return false;
      }

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
        if (selectedCallTypes.includes("incoming") && !isInc) return false;
        if (selectedCallTypes.includes("outgoing") && isInc) return false;
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
        const cDate = parseTimestamp(c.createdAt || c.date_added);
        if (cDate) {
          const dStr = getLocalDateStr(cDate);
          if (dateMode === "contact") {
            if (dateFrom && dStr < dateFrom) return false;
            if (dateTo && dStr > dateTo) return false;
          }
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

  // Pipeline Stage Counts (Canonicalized)
  const pipelineStageCounts = useMemo(() => {
    const counts = {
      [PIPELINE_STAGES.NEW_LEAD]: 0,
      [PIPELINE_STAGES.ATTEMPTING]: 0,
      [PIPELINE_STAGES.INFO_GIVEN]: 0,
      [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
      [PIPELINE_STAGES.FUTURE_POOL]: 0,
      [PIPELINE_STAGES.REGISTERED_WON]: 0,
      [PIPELINE_STAGES.CLOSED_LOST]: 0,
      [PIPELINE_STAGES.CLOSED_INVALID]: 0,
      "Query Desk": 0,
      "Existing Alumni": 0,
      "Unknown / Legacy": 0
    };

    filteredContacts.forEach(c => {
      const stage = getCanonicalStage(c);
      if (counts[stage] !== undefined) {
        counts[stage]++;
      } else {
        counts["Unknown / Legacy"]++;
      }
    });

    return counts;
  }, [filteredContacts]);

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
      PIPELINE_STAGES.NURTURE_INTERESTED,
      PIPELINE_STAGES.FUTURE_POOL,
      PIPELINE_STAGES.REGISTERED_WON,
      PIPELINE_STAGES.CLOSED_LOST,
      PIPELINE_STAGES.CLOSED_INVALID,
      "Unknown / Legacy"
    ];

    return stagesList.map(st => ({
      stage: st,
      people: pipelineStageCounts[st] || 0,
      calls: stageCalls[st] || 0,
      avgCallsPerPerson: (pipelineStageCounts[st] || 0) > 0 ? ((stageCalls[st] || 0) / pipelineStageCounts[st]).toFixed(1) : "0.0"
    }));
  }, [pipelineStageCounts, filteredEvents]);

  // Engagement Depth
  const engagementDepth = useMemo(() => {
    const contactCallCounts = {};
    filteredEvents.forEach(ev => {
      const cId = ev.contactId;
      contactCallCounts[cId] = (contactCallCounts[cId] || 0) + 1;
    });

    const countsList = Object.values(contactCallCounts);
    const totalWithCalls = countsList.length;

    let b1 = 0, b2 = 0, b3_5 = 0, b6_10 = 0, b11_plus = 0;
    countsList.forEach(cnt => {
      if (cnt === 1) b1++;
      else if (cnt === 2) b2++;
      else if (cnt >= 3 && cnt <= 5) b3_5++;
      else if (cnt >= 6 && cnt <= 10) b6_10++;
      else if (cnt >= 11) b11_plus++;
    });

    const totalCallSum = countsList.reduce((a, b) => a + b, 0);
    const avgCallsPerPerson = totalWithCalls > 0 ? (totalCallSum / totalWithCalls).toFixed(1) : "0.0";

    return {
      avgCallsPerPerson,
      totalContactsWithCalls: totalWithCalls,
      buckets: [
        { name: "1 call", people: b1 },
        { name: "2 calls", people: b2 },
        { name: "3–5 calls", people: b3_5 },
        { name: "6–10 calls", people: b6_10 },
        { name: "11+ calls", people: b11_plus }
      ]
    };
  }, [filteredEvents]);

  // Call Outcomes Data
  const callOutcomesData = useMemo(() => {
    const map = {};
    filteredEvents.forEach(ev => {
      const s = getCanonicalStatus(ev.status) || "Pending";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredEvents]);

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

    // Group registrations
    const regCounts = {};
    filteredRegistrations.forEach(r => {
      const attId = r.attenderId || r.assignedTo || "unassigned";
      regCounts[attId] = (regCounts[attId] || 0) + 1;
    });

    return Object.values(map)
      .map(item => {
        const uniqueContactsCount = item.contactIds.size;
        return {
          id: item.id,
          name: item.name,
          totalCalls: item.totalCalls,
          connectedCalls: item.connectedCalls,
          connectedRate: item.totalCalls > 0 ? ((item.connectedCalls / item.totalCalls) * 100).toFixed(1) : "0.0",
          interestedCalls: item.interestedCalls,
          regDoneCalls: item.regDoneCalls,
          registrationsCount: regCounts[item.id] || 0,
          avgCallsPerContact: uniqueContactsCount > 0 ? (item.totalCalls / uniqueContactsCount).toFixed(1) : "0.0"
        };
      })
      .filter(item => !EXCLUDED_ATTENDER_NAMES.includes((item.name || "").toLowerCase().trim()) && (item.totalCalls > 0 || item.registrationsCount > 0 || (attenders || []).some(a => a.id === item.id)))
      .sort((a, b) => b.totalCalls - a.totalCalls);
  }, [filteredEvents, filteredRegistrations, attenders]);

  // Purpose Analytics
  const purposeAnalytics = useMemo(() => {
    const map = {
      sales: { calls: 0, connected: 0, contacts: new Set() },
      query: { calls: 0, connected: 0, contacts: new Set() },
      reminder: { calls: 0, connected: 0, contacts: new Set() },
      unknown_legacy: { calls: 0, connected: 0, contacts: new Set() }
    };

    filteredEvents.forEach(ev => {
      const p = ev.purpose || "unknown_legacy";
      if (!map[p]) map[p] = { calls: 0, connected: 0, contacts: new Set() };
      const item = map[p];
      item.calls++;
      item.contacts.add(ev.contactId);

      if (classifyCallStatus(ev.status) === "CONNECTED") {
        item.connected++;
      }
    });

    const labels = {
      sales: "Sales",
      query: "Query",
      reminder: "Reminder",
      unknown_legacy: "Unknown / Legacy"
    };

    return Object.entries(map).map(([key, item]) => ({
      purposeKey: key,
      purpose: labels[key] || key,
      calls: item.calls,
      uniqueContacts: item.contacts.size,
      connectedRate: item.calls > 0 ? ((item.connected / item.calls) * 100).toFixed(1) : "0.0"
    }));
  }, [filteredEvents]);

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
    return (programs || []).map(p => ({ value: p.id, label: p.name }));
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

      {/* 2. PIPELINE OVERVIEW — MAIN FUNNEL SECTION */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>🎯</span> PIPELINE OVERVIEW
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Total Pipeline Contacts: <strong className="text-slate-900">{activeFunnelPeopleCount}</strong>
          </span>
        </div>

        {/* Funnel Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { key: "new_lead", stageName: "1. New Lead", stageValue: PIPELINE_STAGES.NEW_LEAD, bg: "bg-slate-50 border-slate-200 text-slate-700" },
            { key: "attempting", stageName: "2. Attempting Contact", stageValue: PIPELINE_STAGES.ATTEMPTING, bg: "bg-amber-50/50 border-amber-200 text-amber-900" },
            { key: "info_given", stageName: "3. Information Given", stageValue: PIPELINE_STAGES.INFO_GIVEN, bg: "bg-blue-50/50 border-blue-200 text-blue-900" },
            { key: "prev_prog_pending", stageName: "Previous Program Pending", stageValue: PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING, bg: "bg-purple-50/50 border-purple-200 text-purple-900" },
            { key: "nurture", stageName: "4. Nurture / Interested", stageValue: PIPELINE_STAGES.NURTURE_INTERESTED, bg: "bg-indigo-50/50 border-indigo-200 text-indigo-900" },
            { key: "future_pool", stageName: "5. Future Pool", stageValue: PIPELINE_STAGES.FUTURE_POOL, bg: "bg-purple-50/50 border-purple-200 text-purple-900" },
            { key: "registered", stageName: "6. Registered / Won", stageValue: PIPELINE_STAGES.REGISTERED_WON, bg: "bg-emerald-50/50 border-emerald-200 text-emerald-900" }
          ].map(st => {
            const count = pipelineStageCounts[st.stageValue] || 0;
            const pct = activeFunnelPeopleCount > 0 ? ((count / activeFunnelPeopleCount) * 100).toFixed(1) : "0.0";

            return (
              <div
                key={st.key}
                onClick={() => handleStageClick(st.stageName, st.stageValue)}
                className={`p-3 rounded-lg border ${st.bg} hover:shadow-sm transition-all cursor-pointer group`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold truncate">{st.stageName}</span>
                  <span className="text-[10px] font-bold opacity-65">{pct}%</span>
                </div>
                <p className="text-2xl font-black mt-1 group-hover:scale-105 transition-transform origin-left">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Previous Program Pending Breakdown */}
        {prevProgPendingBreakdown.length > 0 && (
          <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                <span>⏳</span> PREVIOUS PROGRAM PENDING BACKLOG BY PROGRAM
              </span>
              <span className="text-[11px] font-bold text-purple-700">
                {prevProgPendingBreakdown.reduce((sum, item) => sum + item.count, 0)} Total Leads
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {prevProgPendingBreakdown.map((item) => (
                <div 
                  key={item.name}
                  onClick={() => handleStageClick(`Previous Program Pending — ${item.name}`, PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING)}
                  className="px-2.5 py-1 bg-white border border-purple-200 rounded-md text-xs font-semibold text-purple-900 flex items-center gap-2 shadow-2xs hover:bg-purple-100/50 cursor-pointer transition-colors"
                >
                  <span>{item.name}</span>
                  <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded-full text-[10px] font-extrabold">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auxiliary & Legacy Stages Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          <div
            onClick={() => handleStageClick("Closed / Lost", PIPELINE_STAGES.CLOSED_LOST)}
            className="p-2.5 bg-rose-50/50 border border-rose-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-rose-100/50 transition-colors"
          >
            <span className="text-xs font-bold text-rose-900">Closed / Lost</span>
            <span className="text-lg font-black text-rose-900">{pipelineStageCounts[PIPELINE_STAGES.CLOSED_LOST] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Closed / Invalid", PIPELINE_STAGES.CLOSED_INVALID)}
            className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-200/60 transition-colors"
          >
            <span className="text-xs font-bold text-slate-700">Closed / Invalid</span>
            <span className="text-lg font-black text-slate-800">{pipelineStageCounts[PIPELINE_STAGES.CLOSED_INVALID] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Query Desk (Legacy)", "Query Desk")}
            className="p-2.5 bg-cyan-50/50 border border-cyan-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-cyan-100/50 transition-colors"
          >
            <span className="text-xs font-bold text-cyan-900">Query Desk</span>
            <span className="text-lg font-black text-cyan-900">{pipelineStageCounts["Query Desk"] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Existing Alumni (Legacy)", "Existing Alumni")}
            className="p-2.5 bg-teal-50/50 border border-teal-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-teal-100/50 transition-colors"
          >
            <span className="text-xs font-bold text-teal-900">Existing Alumni</span>
            <span className="text-lg font-black text-teal-900">{pipelineStageCounts["Existing Alumni"] || 0}</span>
          </div>

          <div
            onClick={() => handleStageClick("Unknown / Legacy", "Unknown / Legacy")}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Info size={13} className="text-slate-400" /> Legacy / Unmapped
            </span>
            <span className="text-lg font-black text-indigo-600">{pipelineStageCounts["Unknown / Legacy"] || 0}</span>
          </div>
        </div>
      </div>

      {/* 3. ACTIONABLE INSIGHTS — ATTENTION NEEDED */}
      <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-600" /> ATTENTION NEEDED
          </h3>
          <span className="text-[11px] font-medium text-amber-700">Actionable leads requiring follow-up</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-medium">
          <div
            onClick={() => {
              const items = attentionNeededLists.nurtureNoRecentCall;
              setDrillDownModal({
                title: `Nurture (No call >7 days) — Contacts (${items.length})`,
                type: "people",
                items
              });
            }}
            className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div>
              <span className="font-bold text-amber-900 block">Nurture leads with no call &gt;7 days</span>
              <span className="text-[10px] text-amber-700 font-medium">Click to inspect list</span>
            </div>
            <span className="text-lg font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md ml-2">{attentionNeededLists.nurtureNoRecentCall.length}</span>
          </div>

          <div
            onClick={() => {
              const items = attentionNeededLists.stuckInAttempting;
              setDrillDownModal({
                title: `Attempting (>5 calls stuck) — Contacts (${items.length})`,
                type: "people",
                items
              });
            }}
            className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div>
              <span className="font-bold text-rose-900 block">Attempting leads with &gt;5 calls</span>
              <span className="text-[10px] text-rose-700 font-medium">Click to inspect list</span>
            </div>
            <span className="text-lg font-black text-rose-900 bg-rose-200/80 px-2 py-0.5 rounded-md ml-2">{attentionNeededLists.stuckInAttempting.length}</span>
          </div>

          <div
            onClick={() => {
              const items = attentionNeededLists.stuckInInfoGiven;
              setDrillDownModal({
                title: `Information Given (>10 days old) — Contacts (${items.length})`,
                type: "people",
                items
              });
            }}
            className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div>
              <span className="font-bold text-blue-900 block">Information Given &gt;10 days old</span>
              <span className="text-[10px] text-blue-700 font-medium">Click to inspect list</span>
            </div>
            <span className="text-lg font-black text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded-md ml-2">{attentionNeededLists.stuckInInfoGiven.length}</span>
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

      {/* 6. CALL ANALYTICS (Outcomes + Purpose Summary) */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Call Purpose Analytics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3">PURPOSE</th>
                  <th className="py-2 px-3">CALLS</th>
                  <th className="py-2 px-3">UNIQUE PEOPLE</th>
                  <th className="py-2 px-3">CONNECTED %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {purposeAnalytics.map(p => (
                  <tr key={p.purposeKey}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{p.purpose}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{p.calls.toLocaleString()}</td>
                    <td className="py-2 px-3 font-bold text-indigo-600">{p.uniqueContacts.toLocaleString()}</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">{p.connectedRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              CALL OUTCOMES
            </h3>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Historical call events ({totalCallsCount.toLocaleString()})</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={callOutcomesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {callOutcomesData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: "6px", color: "#fff", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium max-h-[140px] overflow-y-auto pr-1 flex-1">
              {callOutcomesData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-1 rounded bg-slate-50 text-[11px]">
                  <span className="flex items-center gap-1 truncate text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {renderVal(item.name)}
                  </span>
                  <span className="font-bold text-slate-900 ml-1">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 7. ADVANCED ANALYTICS (COLLAPSIBLE BY DEFAULT) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <button
          onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
          className="w-full px-4 py-3 flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/70 transition-colors cursor-pointer text-xs font-extrabold text-slate-800 uppercase tracking-wider"
        >
          <span className="flex items-center gap-1.5">
            <BarChart3 size={15} className="text-indigo-600" /> ADVANCED ANALYTICS (ENGAGEMENT DEPTH)
          </span>
          {showAdvancedAnalytics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvancedAnalytics && (
          <div className="p-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Distribution of Unique Contacts by Call Volume Received</span>
              <span className="font-bold text-indigo-600">Avg Calls / Person: {engagementDepth.avgCallsPerPerson}</span>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementDepth.buckets}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
                  <Bar dataKey="people" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
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
                      const name = getContactName(item).toLowerCase();
                      const phone = getContactPhone(item).toLowerCase();
                      return name.includes(q) || phone.includes(q);
                    })
                    .map((rawItem, idx) => {
                      const item = rawItem.contact || rawItem;
                      const name = getContactName(item) || (getContactPhone(item) ? `Contact (${getContactPhone(item)})` : `Contact #${(item.id || item._id || "").slice(-4)}`);
                      const phone = getContactPhone(item);
                      const stage = getCanonicalStage(item);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            <p className="font-bold text-slate-900">{name}</p>
                            {phone && <p className="text-[10px] text-indigo-600 font-mono">{phone}</p>}
                          </td>
                          <td className="p-2">{renderVal(item.attenderName || item.assignedTo)}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                              {stage || item.status || "Pending"}
                            </span>
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
