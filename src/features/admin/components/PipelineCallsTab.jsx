import React, { useState, useMemo } from "react";
import { 
  BarChart3, Users, PhoneCall, TrendingUp, Award, Filter, X, Download, 
  ArrowRight, CheckCircle2, AlertTriangle, Clock, RefreshCw, Layers, ShieldCheck, HelpCircle
} from "lucide-react";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, 
  PieChart, Pie, Cell, AreaChart, Area 
} from "recharts";
import { 
  parseTimestamp, renderVal, getCanonicalStatus, COLORS, getContactName, getContactPhone, getContactCity 
} from "../utils.jsx";
import { PIPELINE_STAGES } from "../../../utils/pipelineEngine";

// Utility to convert JS date to YYYY-MM-DD local format
const getLocalDateStr = (d) => {
  if (!d || isNaN(d.getTime())) return "";
  const yr = d.getFullYear();
  const mn = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
};

export default function PipelineCallsTab({ callLogs = [], registrations = [], programs = [], attenders = [], settingsOptions = {} }) {
  // Top Filter States
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateMode, setDateMode] = useState("call"); // "call" (historical event date) or "contact" (lead creation date)
  const [selectedAttenderIds, setSelectedAttenderIds] = useState([]);
  const [selectedProgramIds, setSelectedProgramIds] = useState([]);
  const [selectedPurposes, setSelectedPurposes] = useState([]); // "sales", "query", "reminder"
  const [selectedDirections, setSelectedDirections] = useState([]); // "incoming", "outgoing"
  const [selectedPipelineStages, setSelectedPipelineStages] = useState([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState([]);

  // Time Trend Granularity
  const [trendGranularity, setTrendGranularity] = useState("daily"); // "daily", "weekly", "monthly"

  // Drill-down Modal State
  const [drillDownModal, setDrillDownModal] = useState(null); // { title: string, type: "people" | "calls" | "registrations", items: Array }
  const [drillSearch, setDrillSearch] = useState("");

  // 1. EXTRACT ALL HISTORICAL CALL EVENTS (Source: contacts.history -> callId)
  const allCallEvents = useMemo(() => {
    const events = [];
    const seenCallIds = new Set();

    (callLogs || []).forEach(contact => {
      const cId = contact.id || contact._id || contact.Phone || contact.Name;
      const cName = getContactName(contact);
      const cPhone = getContactPhone(contact);
      const cCity = getContactCity(contact);
      const cStage = contact.pipelineStage || "Unknown / Legacy";

      // Flatten history array
      if (Array.isArray(contact.history) && contact.history.length > 0) {
        contact.history.forEach((h, idx) => {
          const ts = parseTimestamp(h.timestamp || h.date || h.createdAt);
          const callId = h.callId || h.id || `legacy_call_${cId}_${idx}_${ts ? ts.getTime() : idx}`;
          if (seenCallIds.has(callId)) return;
          seenCallIds.add(callId);

          events.push({
            callId,
            contactId: cId,
            contactName: cName,
            contactPhone: cPhone,
            contactCity: cCity,
            pipelineStage: cStage,
            status: h.status || contact.status || "Pending",
            callType: (h.callType || contact.callType || "outgoing").toLowerCase(),
            purpose: (h.purpose || contact.purpose || "sales").toLowerCase(),
            source: h.source || contact.source || "",
            calledFor: h.calledFor || contact.calledFor || contact.programName || "",
            programId: h.programId || contact.programId || "",
            attenderId: h.attenderId || contact.attenderId || "unassigned",
            attenderName: h.attenderName || contact.attenderName || "Unassigned Attender",
            timestamp: ts,
            dateStr: ts ? getLocalDateStr(ts) : "",
            remark: h.remark || "",
            contactCreatedAt: parseTimestamp(contact.createdAt || contact.date_added)
          });
        });
      } else if (contact.lastCalledAt || (contact.status && contact.status !== "Pending")) {
        // Fallback for contacts without explicit history array
        const callId = `legacy_call_${cId}_fallback`;
        if (!seenCallIds.has(callId)) {
          seenCallIds.add(callId);
          const ts = parseTimestamp(contact.lastCalledAt || contact.createdAt);
          events.push({
            callId,
            contactId: cId,
            contactName: cName,
            contactPhone: cPhone,
            contactCity: cCity,
            pipelineStage: cStage,
            status: contact.status || "Pending",
            callType: (contact.callType || "outgoing").toLowerCase(),
            purpose: (contact.purpose || "sales").toLowerCase(),
            source: contact.source || "",
            calledFor: contact.calledFor || contact.programName || "",
            programId: contact.programId || "",
            attenderId: contact.attenderId || "unassigned",
            attenderName: contact.attenderName || "Unassigned Attender",
            timestamp: ts,
            dateStr: ts ? getLocalDateStr(ts) : "",
            remark: contact.remark || "",
            contactCreatedAt: parseTimestamp(contact.createdAt || contact.date_added)
          });
        }
      }
    });

    return events;
  }, [callLogs]);

  // 2. FILTERED CALL EVENTS
  const filteredEvents = useMemo(() => {
    return allCallEvents.filter(ev => {
      // Date Filter
      if (dateFrom || dateTo) {
        const compareDate = dateMode === "call" ? ev.timestamp : ev.contactCreatedAt;
        if (!compareDate) return false;
        const dStr = getLocalDateStr(compareDate);
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
      }

      // Attender Filter
      if (selectedAttenderIds.length > 0) {
        if (!selectedAttenderIds.includes(ev.attenderId)) return false;
      }

      // Program Filter
      if (selectedProgramIds.length > 0) {
        const match = selectedProgramIds.some(pId => {
          const progObj = programs.find(p => p.id === pId);
          const pName = progObj ? progObj.name.toLowerCase() : pId.toLowerCase();
          return ev.programId === pId || (ev.calledFor || "").toLowerCase().includes(pName);
        });
        if (!match) return false;
      }

      // Purpose Filter
      if (selectedPurposes.length > 0) {
        if (!selectedPurposes.includes(ev.purpose)) return false;
      }

      // Direction Filter
      if (selectedDirections.length > 0) {
        const isInc = ev.callType.startsWith("in");
        if (selectedDirections.includes("incoming") && !isInc) return false;
        if (selectedDirections.includes("outgoing") && isInc) return false;
      }

      // Pipeline Stage Filter
      if (selectedPipelineStages.length > 0) {
        if (!selectedPipelineStages.includes(ev.pipelineStage)) return false;
      }

      // Call Outcome Filter
      if (selectedOutcomes.length > 0) {
        const cStatus = getCanonicalStatus(ev.status);
        if (!selectedOutcomes.includes(cStatus)) return false;
      }

      return true;
    });
  }, [allCallEvents, dateFrom, dateTo, dateMode, selectedAttenderIds, selectedProgramIds, selectedPurposes, selectedDirections, selectedPipelineStages, selectedOutcomes, programs]);

  // 3. FILTERED UNIQUE CONTACTS (Source: contacts collection -> contact.pipelineStage)
  const filteredContacts = useMemo(() => {
    return (callLogs || []).filter(c => {
      // Attender Filter
      if (selectedAttenderIds.length > 0) {
        const attId = c.attenderId || "unassigned";
        if (!selectedAttenderIds.includes(attId)) return false;
      }

      // Program Filter
      if (selectedProgramIds.length > 0) {
        const match = selectedProgramIds.some(pId => {
          const progObj = programs.find(p => p.id === pId);
          const pName = progObj ? progObj.name.toLowerCase() : pId.toLowerCase();
          return c.programId === pId || (c.calledFor || "").toLowerCase().includes(pName);
        });
        if (!match) return false;
      }

      // Pipeline Stage Filter
      if (selectedPipelineStages.length > 0) {
        const stage = c.pipelineStage || "1. New Lead";
        if (!selectedPipelineStages.includes(stage)) return false;
      }

      // Date Range Filter for Contacts (Creation date or explicitly selected date mode)
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
  }, [callLogs, selectedAttenderIds, selectedProgramIds, selectedPipelineStages, dateFrom, dateTo, dateMode, programs]);

  // 4. FILTERED REGISTRATIONS (Source: registrations collection -> registrationId)
  const filteredRegistrations = useMemo(() => {
    return (registrations || []).filter(r => {
      if (dateFrom || dateTo) {
        const rDate = parseTimestamp(r.registeredAt || r.createdAt || r.date);
        if (rDate) {
          const dStr = getLocalDateStr(rDate);
          if (dateFrom && dStr < dateFrom) return false;
          if (dateTo && dStr > dateTo) return false;
        }
      }

      if (selectedAttenderIds.length > 0) {
        if (!selectedAttenderIds.includes(r.attenderId || r.assignedTo)) return false;
      }

      if (selectedProgramIds.length > 0) {
        const match = selectedProgramIds.some(pId => {
          const progObj = programs.find(p => p.id === pId);
          const pName = progObj ? progObj.name.toLowerCase() : pId.toLowerCase();
          return r.programId === pId || (r.calledForKey || r.programName || "").toLowerCase().includes(pName);
        });
        if (!match) return false;
      }

      return true;
    });
  }, [registrations, dateFrom, dateTo, selectedAttenderIds, selectedProgramIds, programs]);

  // 5. METRICS COMPUTATION

  // KPI Row Values
  const totalCallsCount = filteredEvents.length;
  const connectedCallsCount = useMemo(() => {
    return filteredEvents.filter(ev => {
      const s = getCanonicalStatus(ev.status);
      return s !== "NA" && s !== "Busy" && s !== "Call Cut" && s !== "switched off" && s !== "Invalid No" && s !== "No Network" && s !== "wrong no.";
    }).length;
  }, [filteredEvents]);

  const connectedRate = totalCallsCount > 0 ? ((connectedCallsCount / totalCallsCount) * 100).toFixed(1) : "0.0";
  const activeFunnelPeopleCount = filteredContacts.length;
  const registrationsCount = filteredRegistrations.length;

  // Pipeline Stage Distribution (UNIQUE PEOPLE by contact.pipelineStage)
  const pipelineStageCounts = useMemo(() => {
    const counts = {
      [PIPELINE_STAGES.NEW_LEAD]: 0,
      [PIPELINE_STAGES.ATTEMPTING]: 0,
      [PIPELINE_STAGES.INFO_GIVEN]: 0,
      [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
      [PIPELINE_STAGES.FUTURE_POOL]: 0,
      [PIPELINE_STAGES.REGISTERED_WON]: 0,
      [PIPELINE_STAGES.EXISTING_ALUMNI]: 0,
      [PIPELINE_STAGES.QUERY_DESK]: 0,
      [PIPELINE_STAGES.CLOSED_LOST]: 0,
      "Unknown / Legacy": 0
    };

    filteredContacts.forEach(c => {
      const stage = c.pipelineStage;
      if (!stage || String(stage).trim() === "" || stage === "null" || stage === "undefined") {
        counts["Unknown / Legacy"]++;
      } else if (counts[stage] !== undefined) {
        counts[stage]++;
      } else {
        counts["Unknown / Legacy"]++;
      }
    });

    return counts;
  }, [filteredContacts]);

  // Calls Per Pipeline Stage Matrix (Comparison Table)
  const pipelineVsCallsMatrix = useMemo(() => {
    const stageCalls = {};
    filteredEvents.forEach(ev => {
      const stage = ev.pipelineStage || PIPELINE_STAGES.NEW_LEAD;
      stageCalls[stage] = (stageCalls[stage] || 0) + 1;
    });

    const stagesList = [
      PIPELINE_STAGES.NEW_LEAD,
      PIPELINE_STAGES.ATTEMPTING,
      PIPELINE_STAGES.INFO_GIVEN,
      PIPELINE_STAGES.NURTURE_INTERESTED,
      PIPELINE_STAGES.FUTURE_POOL,
      PIPELINE_STAGES.REGISTERED_WON,
      PIPELINE_STAGES.EXISTING_ALUMNI,
      PIPELINE_STAGES.QUERY_DESK,
      PIPELINE_STAGES.CLOSED_LOST,
      "Unknown / Legacy"
    ];

    return stagesList.map(st => ({
      stage: st,
      people: pipelineStageCounts[st] || 0,
      calls: stageCalls[st] || 0,
      avgCallsPerPerson: (pipelineStageCounts[st] || 0) > 0 ? ((stageCalls[st] || 0) / pipelineStageCounts[st]).toFixed(1) : "0.0"
    }));
  }, [pipelineStageCounts, filteredEvents]);

  // Calls Per Contact Distribution (Engagement Depth)
  const engagementDepth = useMemo(() => {
    const contactCallCounts = {};
    filteredEvents.forEach(ev => {
      const cId = ev.contactId;
      contactCallCounts[cId] = (contactCallCounts[cId] || 0) + 1;
    });

    const countsList = Object.values(contactCallCounts);
    const totalWithCalls = countsList.length;

    let bucket1 = 0;  // 1 call
    let bucket2 = 0;  // 2 calls
    let bucket3_5 = 0;// 3-5 calls
    let bucket6_10 = 0;// 6-10 calls
    let bucket11_plus = 0;// 11+ calls

    countsList.forEach(cnt => {
      if (cnt === 1) bucket1++;
      else if (cnt === 2) bucket2++;
      else if (cnt >= 3 && cnt <= 5) bucket3_5++;
      else if (cnt >= 6 && cnt <= 10) bucket6_10++;
      else if (cnt >= 11) bucket11_plus++;
    });

    const totalCallSum = countsList.reduce((a, b) => a + b, 0);
    const avgCallsPerPerson = totalWithCalls > 0 ? (totalCallSum / totalWithCalls).toFixed(1) : "0.0";

    // Median calculation
    const sorted = [...countsList].sort((a, b) => a - b);
    let medianCalls = 0;
    if (sorted.length > 0) {
      const mid = Math.floor(sorted.length / 2);
      medianCalls = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
    }

    return {
      avgCallsPerPerson,
      medianCalls,
      totalContactsWithCalls: totalWithCalls,
      buckets: [
        { name: "1 call", people: bucket1 },
        { name: "2 calls", people: bucket2 },
        { name: "3–5 calls", people: bucket3_5 },
        { name: "6–10 calls", people: bucket6_10 },
        { name: "11+ calls", people: bucket11_plus }
      ]
    };
  }, [filteredEvents]);

  // Call Outcomes Breakdown (Event Count)
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

    // Group call events
    filteredEvents.forEach(ev => {
      const attId = ev.attenderId;
      const attName = ev.attenderName;
      if (!map[attId]) {
        map[attId] = {
          id: attId,
          name: attName,
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

      const s = getCanonicalStatus(ev.status);
      if (s !== "NA" && s !== "Busy" && s !== "Call Cut" && s !== "switched off" && s !== "Invalid No" && s !== "No Network" && s !== "wrong no.") {
        item.connectedCalls++;
      }
      if (s === "Interested") item.interestedCalls++;
      if (s === "Reg.Done") item.regDoneCalls++;
    });

    // Group registrations
    const regCounts = {};
    filteredRegistrations.forEach(r => {
      const attId = r.attenderId || r.assignedTo || "unassigned";
      regCounts[attId] = (regCounts[attId] || 0) + 1;
    });

    return Object.values(map).map(item => {
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
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [filteredEvents, filteredRegistrations]);

  // Call Purpose Analytics (Sales vs Query vs Reminder)
  const purposeAnalytics = useMemo(() => {
    const map = {
      sales: { calls: 0, connected: 0, contacts: new Set() },
      query: { calls: 0, connected: 0, contacts: new Set() },
      reminder: { calls: 0, connected: 0, contacts: new Set() }
    };

    filteredEvents.forEach(ev => {
      const p = ev.purpose || "sales";
      if (!map[p]) map[p] = { calls: 0, connected: 0, contacts: new Set() };
      const item = map[p];
      item.calls++;
      item.contacts.add(ev.contactId);

      const s = getCanonicalStatus(ev.status);
      if (s !== "NA" && s !== "Busy" && s !== "Call Cut" && s !== "switched off" && s !== "Invalid No" && s !== "No Network" && s !== "wrong no.") {
        item.connected++;
      }
    });

    return Object.entries(map).map(([purpose, item]) => ({
      purpose: purpose.toUpperCase(),
      calls: item.calls,
      connected: item.connected,
      connectedRate: item.calls > 0 ? ((item.connected / item.calls) * 100).toFixed(1) : "0.0",
      uniqueContacts: item.contacts.size
    }));
  }, [filteredEvents]);

  // Attention Needed (Actionable Lists for Admin)
  const attentionNeededLists = useMemo(() => {
    const now = new Date().getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const nurtureNoRecentCall = [];
    const stuckInAttempting = [];
    const stuckInInfoGiven = [];

    filteredContacts.forEach(c => {
      const stage = c.pipelineStage || "1. New Lead";
      const lastCallDate = parseTimestamp(c.lastCalledAt || c.updatedAt || c.createdAt);
      const lastCallMs = lastCallDate ? lastCallDate.getTime() : 0;
      const callCount = (c.history && c.history.length) || 1;

      if (stage === PIPELINE_STAGES.NURTURE_INTERESTED) {
        if (!lastCallMs || (now - lastCallMs) > sevenDaysMs) {
          nurtureNoRecentCall.push({ contact: c, daysStale: lastCallMs ? Math.floor((now - lastCallMs) / (24 * 60 * 60 * 1000)) : "7+" });
        }
      }

      if (stage === PIPELINE_STAGES.ATTEMPTING && callCount >= 5) {
        stuckInAttempting.push({ contact: c, callCount });
      }

      if (stage === PIPELINE_STAGES.INFO_GIVEN && (!lastCallMs || (now - lastCallMs) > 10 * 24 * 60 * 60 * 1000)) {
        stuckInInfoGiven.push({ contact: c, daysStale: lastCallMs ? Math.floor((now - lastCallMs) / (24 * 60 * 60 * 1000)) : "10+" });
      }
    });

    return {
      nurtureNoRecentCall: nurtureNoRecentCall.slice(0, 50),
      stuckInAttempting: stuckInAttempting.slice(0, 50),
      stuckInInfoGiven: stuckInInfoGiven.slice(0, 50)
    };
  }, [filteredContacts]);

  // Export Data Helpers
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

  const activeFilterCount = [dateFrom, dateTo, selectedAttenderIds.length, selectedProgramIds.length, selectedPurposes.length, selectedDirections.length, selectedPipelineStages.length, selectedOutcomes.length].filter(Boolean).length;

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedAttenderIds([]);
    setSelectedProgramIds([]);
    setSelectedPurposes([]);
    setSelectedDirections([]);
    setSelectedPipelineStages([]);
    setSelectedOutcomes([]);
  };

  return (
    <div className="space-y-6 pb-12 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER & TOP FILTER BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">📈</span>
              Pipeline & Call Analytics
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Authoritative operational intelligence separating Call Events, Pipeline People, and Registration Records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV("Pipeline_Contacts", ["Contact Name", "Phone", "Pipeline Stage", "Attender", "Called For"], filteredContacts.map(c => [getContactName(c), getContactPhone(c), c.pipelineStage || "New Lead", c.attenderName || "Unassigned", c.calledFor || ""]))}
              className="flex items-center gap-1.5 h-8 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Download size={13} /> Export Contacts
            </button>
            <button
              onClick={() => exportCSV("Call_Events", ["Call ID", "Contact Name", "Status", "Attender", "Call Date"], filteredEvents.map(e => [e.callId, e.contactName, e.status, e.attenderName, e.dateStr]))}
              className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Download size={13} /> Export Calls
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {/* Date From */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Date Target Mode */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Filter By Date On</label>
            <select
              value={dateMode}
              onChange={(e) => setDateMode(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="call">Call Event Date</option>
              <option value="contact">Contact Created Date</option>
            </select>
          </div>

          {/* Attender Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Attender</label>
            <select
              value={selectedAttenderIds[0] || ""}
              onChange={(e) => setSelectedAttenderIds(e.target.value ? [e.target.value] : [])}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Attenders</option>
              {attenders.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Call Purpose */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Call Purpose</label>
            <select
              value={selectedPurposes[0] || ""}
              onChange={(e) => setSelectedPurposes(e.target.value ? [e.target.value] : [])}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Purposes</option>
              <option value="sales">Sales Calls</option>
              <option value="query">Query Calls</option>
              <option value="reminder">Reminder Calls</option>
            </select>
          </div>

          {/* Call Direction */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Call Direction</label>
            <select
              value={selectedDirections[0] || ""}
              onChange={(e) => setSelectedDirections(e.target.value ? [e.target.value] : [])}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Directions</option>
              <option value="outgoing">Outgoing</option>
              <option value="incoming">Incoming</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="w-full h-8 flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 disabled:opacity-40 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              <X size={13} /> Reset ({activeFilterCount})
            </button>
          </div>
        </div>
      </div>

      {/* TOP KPI CARD ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-indigo-50 transition-colors">
            <PhoneCall size={48} />
          </div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Calls Logged</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{totalCallsCount.toLocaleString()}</p>
          <p className="text-[11px] font-semibold text-indigo-600 mt-1 flex items-center gap-1">
            <span>•</span> Historical Call Events (callId)
          </p>
        </div>

        {/* Connected Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-emerald-50 transition-colors">
            <TrendingUp size={48} />
          </div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Call Connected Rate</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{connectedRate}%</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            {connectedCallsCount.toLocaleString()} connected / {totalCallsCount.toLocaleString()} total
          </p>
        </div>

        {/* Active Funnel People */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-blue-50 transition-colors">
            <Users size={48} />
          </div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">People in Funnel</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{activeFunnelPeopleCount.toLocaleString()}</p>
          <p className="text-[11px] font-semibold text-blue-600 mt-1 flex items-center gap-1">
            <span>•</span> Unique Contacts (contact.pipelineStage)
          </p>
        </div>

        {/* Total Registrations */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-purple-50 transition-colors">
            <Award size={48} />
          </div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Registrations</p>
          <p className="text-3xl font-black text-purple-600 mt-1">{registrationsCount.toLocaleString()}</p>
          <p className="text-[11px] font-semibold text-purple-600 mt-1 flex items-center gap-1">
            <span>•</span> Registration Records (registrationId)
          </p>
        </div>
      </div>

      {/* PIPELINE OVERVIEW & FUNNEL VISUALIZATION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>🎯</span> Pipeline Overview — Unique People Breakdown
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Every contact occupies exactly ONE pipeline stage. Derived exclusively from <code className="text-indigo-600 bg-indigo-50 px-1 rounded">contact.pipelineStage</code>.
            </p>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full self-start sm:self-auto">
            Total Pipeline Population: {activeFunnelPeopleCount}
          </span>
        </div>

        {/* Funnel Stage Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: PIPELINE_STAGES.NEW_LEAD, color: "border-slate-300 bg-slate-50/50 text-slate-700" },
            { label: PIPELINE_STAGES.ATTEMPTING, color: "border-amber-300 bg-amber-50/40 text-amber-800" },
            { label: PIPELINE_STAGES.INFO_GIVEN, color: "border-blue-300 bg-blue-50/40 text-blue-800" },
            { label: PIPELINE_STAGES.NURTURE_INTERESTED, color: "border-indigo-300 bg-indigo-50/40 text-indigo-800" },
            { label: PIPELINE_STAGES.FUTURE_POOL, color: "border-purple-300 bg-purple-50/40 text-purple-800" },
            { label: PIPELINE_STAGES.REGISTERED_WON, color: "border-emerald-300 bg-emerald-50/40 text-emerald-800" }
          ].map(st => {
            const count = pipelineStageCounts[st.label] || 0;
            const pct = activeFunnelPeopleCount > 0 ? ((count / activeFunnelPeopleCount) * 100).toFixed(1) : "0.0";
            return (
              <div 
                key={st.label} 
                onClick={() => {
                  const items = filteredContacts.filter(c => (c.pipelineStage || PIPELINE_STAGES.NEW_LEAD) === st.label);
                  setDrillDownModal({ title: `${st.label} — Contacts List (${count})`, type: "people", items });
                }}
                className={`p-4 rounded-xl border ${st.color} hover:shadow-md transition-all cursor-pointer group`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider">{st.label}</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white border border-current opacity-80">
                    {pct}%
                  </span>
                </div>
                <p className="text-3xl font-black mt-2 group-hover:scale-105 transition-transform origin-left">{count}</p>
                <p className="text-[10px] font-semibold opacity-70 mt-1">Click to inspect {count} contacts</p>
              </div>
            );
          })}
        </div>

        {/* Auxiliary Stages Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {[
            { label: PIPELINE_STAGES.EXISTING_ALUMNI, count: pipelineStageCounts[PIPELINE_STAGES.EXISTING_ALUMNI] || 0, color: "text-sky-700 bg-sky-50 border-sky-200" },
            { label: PIPELINE_STAGES.QUERY_DESK, count: pipelineStageCounts[PIPELINE_STAGES.QUERY_DESK] || 0, color: "text-amber-700 bg-amber-50 border-amber-200" },
            { label: PIPELINE_STAGES.CLOSED_LOST, count: pipelineStageCounts[PIPELINE_STAGES.CLOSED_LOST] || 0, color: "text-rose-700 bg-rose-50 border-rose-200" },
            { label: "Unknown / Legacy", count: pipelineStageCounts["Unknown / Legacy"] || 0, color: "text-slate-700 bg-slate-100 border-slate-300" }
          ].map(st => (
            <div 
              key={st.label}
              onClick={() => {
                const items = filteredContacts.filter(c => st.label === "Unknown / Legacy" ? (!c.pipelineStage || c.pipelineStage === "null") : c.pipelineStage === st.label);
                setDrillDownModal({ title: `${st.label} — Contacts (${st.count})`, type: "people", items });
              }}
              className={`p-3 rounded-xl border ${st.color} flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity`}
            >
              <span className="text-xs font-bold">{st.label}</span>
              <span className="text-lg font-black">{st.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PIPELINE VS CALL ACTIVITY COMPARISON MATRIX */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Pipeline Stage vs Calling Activity Breakdown
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Compares <span className="font-bold text-indigo-600">Unique People</span> (pipelineStage) against <span className="font-bold text-slate-800">Historical Calls Logged</span> (history.callId).
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Pipeline Stage</th>
                <th className="px-4 py-3 text-indigo-700">Unique People (contactId)</th>
                <th className="px-4 py-3 text-slate-800">Calls Logged (callId)</th>
                <th className="px-4 py-3">Avg Calls / Person</th>
                <th className="px-4 py-3">Stage Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pipelineVsCallsMatrix.map(row => (
                <tr key={row.stage} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.stage}</td>
                  <td className="px-4 py-3 font-extrabold text-indigo-600">{row.people}</td>
                  <td className="px-4 py-3 font-extrabold text-slate-900">{row.calls}</td>
                  <td className="px-4 py-3 text-slate-600">{row.avgCallsPerPerson}</td>
                  <td className="px-4 py-3">
                    <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full" 
                        style={{ width: `${activeFunnelPeopleCount > 0 ? Math.min(100, Math.round((row.people / activeFunnelPeopleCount) * 100)) : 0}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CALL OUTCOME DISTRIBUTION & ENGAGEMENT DEPTH */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Call Outcomes — Events */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Call Outcomes — Events ({totalCallsCount.toLocaleString()})
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Historical call event outcomes from <code className="text-indigo-600 bg-indigo-50 px-1 rounded">contacts.history</code>.
            </p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={callOutcomesData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {callOutcomesData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium max-h-[120px] overflow-y-auto pr-1">
            {callOutcomesData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between p-1.5 rounded-md bg-slate-50">
                <span className="flex items-center gap-1.5 truncate text-slate-700">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {renderVal(item.name)}
                </span>
                <span className="font-extrabold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Engagement Depth */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Contact Engagement Depth (People)
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Distribution of unique contacts by call volume received.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-indigo-600 block">Avg: {engagementDepth.avgCallsPerPerson} calls/person</span>
              <span className="text-[10px] font-semibold text-slate-400">Median: {engagementDepth.medianCalls} calls</span>
            </div>
          </div>
          <div className="h-[220px]">
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
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-900">Total Unique Contacts Receiving Calls:</span>
            <span className="font-black text-indigo-700 text-sm">{engagementDepth.totalContactsWithCalls}</span>
          </div>
        </div>
      </div>

      {/* ATTENDER PERFORMANCE TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Attender Call & Conversion Performance
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Strict separation between <span className="font-bold text-slate-800">Calls Done (Events)</span> and <span className="font-bold text-purple-600">Registrations (Records)</span>.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Attender</th>
                <th className="px-4 py-3">Calls Done (Events)</th>
                <th className="px-4 py-3">Connected Calls</th>
                <th className="px-4 py-3">Connected %</th>
                <th className="px-4 py-3 text-amber-600">Interested Calls</th>
                <th className="px-4 py-3 text-emerald-600">Reg.Done Calls</th>
                <th className="px-4 py-3 text-purple-600">Registrations (Records)</th>
                <th className="px-4 py-3">Avg Calls / Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {attenderPerformance.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{a.name}</td>
                  <td className="px-4 py-3 font-extrabold text-slate-900">{a.totalCalls}</td>
                  <td className="px-4 py-3">{a.connectedCalls}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{a.connectedRate}%</td>
                  <td className="px-4 py-3 font-semibold text-amber-600">{a.interestedCalls}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{a.regDoneCalls}</td>
                  <td className="px-4 py-3 font-extrabold text-purple-600">{a.registrationsCount}</td>
                  <td className="px-4 py-3 text-slate-600">{a.avgCallsPerContact}</td>
                </tr>
              ))}
              {attenderPerformance.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">No attender records match the current filter selection.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CALL PURPOSE ANALYTICS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Call Purpose Analytics (Sales vs Query vs Reminder)
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Reminder calls are kept isolated so they do not distort sales conversion metrics.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {purposeAnalytics.map(p => (
            <div key={p.purpose} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">{p.purpose}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{p.connectedRate}% Connected</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Calls</span>
                  <span className="text-lg font-black text-slate-900">{p.calls}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Unique Contacts</span>
                  <span className="text-lg font-black text-indigo-600">{p.uniqueContacts}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIONABLE INSIGHTS — ATTENTION NEEDED */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={16} />
            Attention Needed — Actionable Leads List
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Leads requiring immediate admin or attender follow-up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Nurture with no recent call */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
            <h4 className="font-extrabold text-amber-900 flex items-center justify-between">
              <span>Nurture (No call &gt;7 days)</span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold">{attentionNeededLists.nurtureNoRecentCall.length}</span>
            </h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
              {attentionNeededLists.nurtureNoRecentCall.map((item, idx) => (
                <div key={idx} className="p-2 rounded bg-white border border-amber-100 flex items-center justify-between font-medium">
                  <div>
                    <p className="font-bold text-slate-900">{getContactName(item.contact)}</p>
                    <p className="text-[10px] text-slate-400">{getContactPhone(item.contact)}</p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700">{item.daysStale}d stale</span>
                </div>
              ))}
              {attentionNeededLists.nurtureNoRecentCall.length === 0 && (
                <p className="text-slate-400 font-medium py-4 text-center">No stale Nurture leads!</p>
              )}
            </div>
          </div>

          {/* High calls stuck in Attempting */}
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
            <h4 className="font-extrabold text-rose-900 flex items-center justify-between">
              <span>Attempting (&gt;5 calls stuck)</span>
              <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded-full text-[10px] font-bold">{attentionNeededLists.stuckInAttempting.length}</span>
            </h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
              {attentionNeededLists.stuckInAttempting.map((item, idx) => (
                <div key={idx} className="p-2 rounded bg-white border border-rose-100 flex items-center justify-between font-medium">
                  <div>
                    <p className="font-bold text-slate-900">{getContactName(item.contact)}</p>
                    <p className="text-[10px] text-slate-400">{getContactPhone(item.contact)}</p>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700">{item.callCount} calls</span>
                </div>
              ))}
              {attentionNeededLists.stuckInAttempting.length === 0 && (
                <p className="text-slate-400 font-medium py-4 text-center">No stuck Attempting leads!</p>
              )}
            </div>
          </div>

          {/* Info Given stuck */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 space-y-2">
            <h4 className="font-extrabold text-blue-900 flex items-center justify-between">
              <span>Info Given (&gt;10d stale)</span>
              <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded-full text-[10px] font-bold">{attentionNeededLists.stuckInInfoGiven.length}</span>
            </h4>
            <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
              {attentionNeededLists.stuckInInfoGiven.map((item, idx) => (
                <div key={idx} className="p-2 rounded bg-white border border-blue-100 flex items-center justify-between font-medium">
                  <div>
                    <p className="font-bold text-slate-900">{getContactName(item.contact)}</p>
                    <p className="text-[10px] text-slate-400">{getContactPhone(item.contact)}</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700">{item.daysStale}d stale</span>
                </div>
              ))}
              {attentionNeededLists.stuckInInfoGiven.length === 0 && (
                <p className="text-slate-400 font-medium py-4 text-center">No stale Info Given leads!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DRILL-DOWN MODAL */}
      {drillDownModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>🔍</span> {drillDownModal.title}
              </h3>
              <button onClick={() => setDrillDownModal(null)} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200">
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
                    .filter(item => {
                      if (!drillSearch.trim()) return true;
                      const q = drillSearch.toLowerCase();
                      const name = getContactName(item).toLowerCase();
                      const phone = getContactPhone(item).toLowerCase();
                      return name.includes(q) || phone.includes(q);
                    })
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2">
                          <p className="font-bold text-slate-900">{getContactName(item)}</p>
                          <p className="text-[10px] text-indigo-600 font-mono">{getContactPhone(item)}</p>
                        </td>
                        <td className="p-2">{renderVal(item.attenderName || item.assignedTo)}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                            {item.pipelineStage || item.status || "Pending"}
                          </span>
                        </td>
                        <td className="p-2">{renderVal(item.calledFor || item.source)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
