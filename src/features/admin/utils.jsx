import React from "react";
import {
  BarChart3, FolderOpen, Upload, Users, ClipboardCheck, FileText, Settings, FileSpreadsheet, TrendingUp
} from "lucide-react";
import { isKhojiField } from "../../lib/khojiHelper";
import { PIPELINE_STAGES, getEffectiveStage, QUERY_PIPELINE_STAGES, getCanonicalQueryStage } from "../../utils/pipelineEngine";
export { QUERY_PIPELINE_STAGES, getCanonicalQueryStage };

export function parseTimestamp(t) {
  if (!t) return null;
  if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
  if (typeof t.toDate === "function") return t.toDate();
  if (typeof t.toMillis === "function") return new Date(t.toMillis());
  if (typeof t === "object") {
    if (t.seconds !== undefined || t._seconds !== undefined) {
      const sec = t.seconds !== undefined ? t.seconds : t._seconds;
      const nsec = t.nanoseconds !== undefined ? t.nanoseconds : (t._nanoseconds || 0);
      return new Date(sec * 1000 + Math.round(nsec / 1000000));
    }
    const inner = t.date || t.$date || t.value || t.iso || t.formatted || t.startDate || t.endDate;
    if (inner && inner !== t) return parseTimestamp(inner);
  }
  if (typeof t === "number") return new Date(t);
  if (typeof t === "string") {
    const parsed = new Date(t);
    if (!isNaN(parsed.getTime())) return parsed;
    const cleaned = t.replace(/-/g, "/");
    const parsedCleaned = new Date(cleaned);
    if (!isNaN(parsedCleaned.getTime())) return parsedCleaned;
  }
  return null;
}

export function formatDateTimeNoSeconds(t) {
  const d = parseTimestamp(t);
  if (!d || isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const monthStr = months[d.getMonth()];
  const yr = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${monthStr} ${yr}, ${hours}:${minutes} ${ampm}`;
}

export function renderVal(val, fallback = "—") {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "object") {
    if (val.name) return String(val.name);
    if (val.label) return String(val.label);
    if (val.value) return String(val.value);
    if (val.title) return String(val.title);
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return String(val);
}

export const getContactPhone = (log, attempt) => {
  if (attempt?.contactPhone && String(attempt.contactPhone).trim()) return String(attempt.contactPhone).trim();
  if (attempt?.phone && String(attempt.phone).trim()) return String(attempt.phone).trim();
  if (attempt?.mobile && String(attempt.mobile).trim()) return String(attempt.mobile).trim();

  if (!log || typeof log !== "object") return "";

  const directCandidates = [
    log.Phone, log.Mobile, log.phone, log.mobile, log.contactPhone,
    log.normalizedPhone, log.normalizedMobile, log["Mobile Number"],
    log["Phone Number"], log["Whatsapp Number"], log["WhatsApp Number"],
    log["Contact Number"], log["Contact No"], log["Phone No"], log["Mobile No"],
    log.contact_no, log.whatsapp, log.number
  ];

  for (const c of directCandidates) {
    if (c !== undefined && c !== null && String(c).trim() !== "") {
      return String(c).trim();
    }
  }

  const keys = Object.keys(log);
  const phoneKey = keys.find(k => {
    const lk = k.toLowerCase();
    return lk.includes("phone") || lk.includes("mobile") || lk.includes("whatsapp") || lk.includes("contact") || lk.includes("number");
  });

  return (phoneKey && log[phoneKey]) ? String(log[phoneKey]).trim() : "";
};

export const getContactName = (log, attempt) => {
  if (attempt?.contactName && String(attempt.contactName).trim()) return String(attempt.contactName).trim();
  if (attempt?.name && String(attempt.name).trim()) return String(attempt.name).trim();

  if (!log || typeof log !== "object") return "Unknown";

  const directCandidates = [
    log.Name, log.name, log.leadName, log["Lead Name"], log["Full Name"],
    log.caller, log["Caller Name"], log["Name of Caller"], log.fullName
  ];

  for (const c of directCandidates) {
    if (c !== undefined && c !== null && String(c).trim() !== "") {
      return String(c).trim();
    }
  }

  const keys = Object.keys(log);
  const nameKey = keys.find(k => {
    const lk = k.toLowerCase();
    return lk.includes("name") || lk.includes("caller") || lk.includes("lead");
  });

  return (nameKey && log[nameKey]) ? String(log[nameKey]).trim() : "Unknown";
};

export const getContactCity = (log, attempt) => {
  if (attempt?.contactCity && String(attempt.contactCity).trim()) return String(attempt.contactCity).trim();
  if (attempt?.city && String(attempt.city).trim()) return String(attempt.city).trim();

  if (!log || typeof log !== "object") return "";

  const directCandidates = [
    log.City, log.city, log.location, log.Location, log["Khoji City"],
    log["City Name"], log.place, log.town, log.district, log.address
  ];

  for (const c of directCandidates) {
    if (c !== undefined && c !== null && String(c).trim() !== "") {
      return String(c).trim();
    }
  }

  const keys = Object.keys(log);
  const cityKey = keys.find(k => {
    const lk = k.toLowerCase();
    return lk.includes("city") || lk.includes("location") || lk.includes("place") || lk.includes("town");
  });

  return (cityKey && log[cityKey]) ? String(log[cityKey]).trim() : "";
};

export const getContactKhoji = (log, attempt) => {
  if (attempt?.Khoji && String(attempt.Khoji).trim()) return String(attempt.Khoji).trim();
  if (attempt?.khoji && String(attempt.khoji).trim()) return String(attempt.khoji).trim();

  if (!log || typeof log !== "object") return "";

  const directCandidates = [
    log.Khoji, log.khoji, log["Khoji Type"], log["Khoji Yes or No"],
    log["Have you done Maha Asmani"], log["Maha Asmani"], log["Mahaasmani"], log["Khoji Status"]
  ];

  for (const c of directCandidates) {
    if (c !== undefined && c !== null && String(c).trim() !== "") {
      return String(c).trim();
    }
  }

  const keys = Object.keys(log);
  const khojiKey = keys.find(k => {
    const lk = k.toLowerCase();
    return lk.includes("khoji") || lk.includes("asmani");
  });

  return (khojiKey && log[khojiKey]) ? String(log[khojiKey]).trim() : "";
};

export const getCanonicalStage = (stageOrContact) => {
  if (!stageOrContact) return PIPELINE_STAGES.NEW_LEAD;

  if (typeof stageOrContact === "object") {
    const contact = stageOrContact;

    let latestAttenderState = null;
    if (contact.attenderStates && typeof contact.attenderStates === "object") {
      const states = Object.values(contact.attenderStates);
      if (states.length > 0) {
        latestAttenderState = states[states.length - 1];
      }
    }

    const rawCallPurpose = String(contact.callPurpose || latestAttenderState?.callPurpose || "").toUpperCase();
    const rawStatus = String(contact.status || latestAttenderState?.status || "").trim();
    const rawQueryStatus = String(contact.queryStatus || latestAttenderState?.queryStatus || "").trim();

    // 0. Registered / Won Check (Top Priority: Once registered, Sales pipeline stage remains Registered / Won)
    const hasRegHistory =
      String(contact.status || "").toLowerCase().includes("reg.done") ||
      String(contact.pipelineStage || "").toLowerCase().includes("registered") ||
      (Array.isArray(contact.history) && contact.history.some(h => String(h.status || "").toLowerCase().includes("reg.done") || String(h.status || "").toLowerCase().includes("registered"))) ||
      (contact.attenderStates && typeof contact.attenderStates === "object" && Object.values(contact.attenderStates).some(st => String(st?.status || "").toLowerCase().includes("reg.done") || String(st?.status || "").toLowerCase().includes("registered")));

    if (hasRegHistory) {
      return PIPELINE_STAGES.REGISTERED_WON;
    }

    // 0b. Query or Reminder Workstream Check
    const isExplicitQuery = rawCallPurpose === "QUERY" || rawStatus === "Query" || (rawQueryStatus && rawCallPurpose !== "SALES");
    if (isExplicitQuery) {
      return "Query Desk";
    }

    const isExplicitReminder = rawCallPurpose === "REMINDER" || rawStatus.toLowerCase().includes("reminder");
    if (isExplicitReminder) {
      return "Reminder Desk";
    }

    const statusLower = rawStatus.toLowerCase();

    // 1c. Previous Program Pending Check
    const lastHistStatus = Array.isArray(contact.history) && contact.history.length > 0
      ? String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase()
      : "";

    if (statusLower === "previous program pending" || statusLower.includes("previous program pending") || lastHistStatus === "previous program pending" || lastHistStatus.includes("previous program pending")) {
      return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
    }

    // 1d. Nurture / Interested Check
    if (statusLower === "interested" || statusLower === "nurture / interested" || statusLower === "4. nurture / interested") {
      return PIPELINE_STAGES.NURTURE_INTERESTED;
    }

    // 1e. Info Given Check
    if (statusLower === "info given" || statusLower === "information given" || statusLower === "3. information given") {
      return PIPELINE_STAGES.INFO_GIVEN;
    }

    // 1f. Future Pool Check
    if (statusLower === "next time" || statusLower === "future pool" || statusLower === "5. future pool") {
      return PIPELINE_STAGES.FUTURE_POOL;
    }

    // 1g. Closed / Lost Status Check
    if (statusLower === "not interested" || statusLower === "closed / lost" || lastHistStatus === "not interested" || lastHistStatus === "closed / lost") {
      return PIPELINE_STAGES.CLOSED_LOST;
    }

    // 1h. Closed / Invalid Status Check
    if (statusLower.includes("invalid") || statusLower.includes("wrong number") || lastHistStatus.includes("invalid") || lastHistStatus.includes("wrong number")) {
      return PIPELINE_STAGES.CLOSED_INVALID;
    }

    // 1i. Attempting Contact Check
    if (statusLower === "not connected" || statusLower === "not picked up" || statusLower === "attempting contact" || statusLower === "2. attempting contact") {
      return PIPELINE_STAGES.ATTEMPTING;
    }

    // 2. Resolve stage from rawStage fallback
    const rawStage = String(contact.pipelineStage || "").trim();
    if (rawStage) {
      const s = rawStage;
      if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
      if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
      if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
      if (s === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || s === "Previous Program Pending") return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
      if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
      if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
      if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
      if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
      if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
      if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";
    }

    return PIPELINE_STAGES.NEW_LEAD;
  }

  const s = String(stageOrContact).trim();
  if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
  if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
  if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
  if (s === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || s === "Previous Program Pending") return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
  if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
  if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
  if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
  if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
  if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
  if (s === "Query Desk" || s === "Query") return "Query Desk";
  if (s === "Reminder Desk" || s === "Reminder") return "Reminder Desk";
  if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";

  return PIPELINE_STAGES.NEW_LEAD;
};

export function isStageNurtureInterested(stageOrContact) {
  const stage = getCanonicalStage(stageOrContact);
  return stage === PIPELINE_STAGES.NURTURE_INTERESTED;
}

export function isStageRegisteredWon(stageOrContact) {
  const stage = getCanonicalStage(stageOrContact);
  return stage === PIPELINE_STAGES.REGISTERED_WON;
}

export function countUniqueContacts(contacts = [], filterFn = null) {
  const uniqueIds = new Set();
  (contacts || []).forEach(c => {
    const id = c.id || c._id;
    if (!id) return;
    if (!filterFn || filterFn(c)) {
      uniqueIds.add(String(id));
    }
  });
  return uniqueIds.size;
}

/**
 * Canonical function for Program Registrations.
 * The ONLY source of truth for Program Registrations is the `registrations` collection
 * (or fallback deduplicated contact + calledForKey entries).
 * Identity: (contactId + calledForKey).
 */
export function getCanonicalRegistrations(registrations = [], contacts = [], filters = {}) {
  const {
    startDate,
    endDate,
    selectedAttenderIds = [],
    selectedProgramIds = [],
    selectedSources = [],
    selectedCalledFors = [],
  } = filters;

  let startMs = null;
  let endMs = null;
  if (startDate) {
    const s = parseLocalDateBoundaries(startDate, false);
    if (s && !isNaN(s.getTime())) startMs = s.getTime();
  }
  if (endDate) {
    const e = parseLocalDateBoundaries(endDate, true);
    if (e && !isNaN(e.getTime())) endMs = e.getTime();
  }

  const seenRegKeys = new Set();
  const result = [];

  const inDateRange = (ts) => {
    if (!ts) return true;
    const parsed = parseTimestamp(ts);
    if (!parsed || isNaN(parsed.getTime())) return true;
    const ms = parsed.getTime();
    if (startMs !== null && ms < startMs) return false;
    if (endMs !== null && ms > endMs) return false;
    return true;
  };

  // 1. Process explicit registrations collection records first
  (registrations || []).forEach(reg => {
    if (!reg || reg._deleted) return;
    const contactId = String(reg.contactId || reg.leadId || reg.contact_id || "").trim();
    const calledForKey = String(reg.calledForKey || reg.programKey || reg.calledFor || "").trim().toLowerCase();
    if (!contactId || !calledForKey) return;

    const regKey = `${contactId}_${calledForKey}`;
    if (seenRegKeys.has(regKey)) return;

    const regDate = reg.registeredAt || reg.createdAt || reg.timestamp || reg.date;
    if (!inDateRange(regDate)) return;

    seenRegKeys.add(regKey);
    result.push({
      id: reg.id || reg._id || regKey,
      contactId,
      calledForKey,
      contactName: renderVal(reg.contactName || reg.name || reg.Name, "Unknown"),
      name: renderVal(reg.contactName || reg.name || reg.Name, "Unknown"),
      contactPhone: renderVal(reg.contactPhone || reg.phone || reg.Phone || reg.Mobile || reg.mobile || reg.normalizedMobile, "—"),
      phone: renderVal(reg.contactPhone || reg.phone || reg.Phone || reg.Mobile || reg.mobile || reg.normalizedMobile, "—"),
      contactCity: renderVal(reg.city || reg.City, "—"),
      city: renderVal(reg.city || reg.City, "—"),
      khoji: renderVal(reg.khoji || reg.Khoji, "—"),
      calledFor: renderVal(reg.calledFor || reg.programName, calledForKey),
      programName: renderVal(reg.calledFor || reg.programName, calledForKey),
      attenderName: renderVal(reg.attenderName || reg.assignedTo, "Unassigned"),
      attender: renderVal(reg.attenderName || reg.assignedTo, "Unassigned"),
      attenderId: reg.attenderId || reg.attender_id || reg.createdBy || "",
      source: renderVal(reg.source || reg.Source, "—"),
      status: "Reg.Done",
      stage: "6. Registered / Won",
      registeredAt: regDate,
      timestamp: regDate,
      createdAt: regDate,
      lastCalledAt: regDate,
      feedback: renderVal(reg.feedback || reg.userFeedback, "—"),
      remark: renderVal(reg.remark || reg.Remark, "—"),
      tags: reg.tags || []
    });
  });

  return result;
}

/**
 * Canonical Registered People (Unique contactId with at least 1 registration).
 */
export function getCanonicalRegisteredPeople(registrations = [], contacts = [], filters = {}) {
  const regList = getCanonicalRegistrations(registrations, contacts, filters);
  const seenContacts = new Set();
  const people = [];

  regList.forEach(reg => {
    if (!seenContacts.has(reg.contactId)) {
      seenContacts.add(reg.contactId);
      people.push(reg);
    }
  });

  return people;
}

/**
 * Canonical Stage 6 People (Unique contacts currently in Stage 6).
 */
export function getCanonicalStage6People(contacts = [], filters = {}) {
  const {
    startDate,
    endDate
  } = filters;

  let startMs = null;
  let endMs = null;
  if (startDate) {
    const s = parseLocalDateBoundaries(startDate, false);
    if (s && !isNaN(s.getTime())) startMs = s.getTime();
  }
  if (endDate) {
    const e = parseLocalDateBoundaries(endDate, true);
    if (e && !isNaN(e.getTime())) endMs = e.getTime();
  }

  const seen = new Set();
  const people = [];

  (contacts || []).forEach(c => {
    if (!c || c._deleted) return;
    if (!isStageRegisteredWon(c)) return;

    const contactId = String(c.id || c._id || c.Phone || c.Name || "").trim();
    if (!contactId || seen.has(contactId)) return;

    const cDate = c.updatedAt || c.lastCalledAt || c.createdAt;
    if (cDate) {
      const parsed = parseTimestamp(cDate);
      if (parsed && !isNaN(parsed.getTime())) {
        const ms = parsed.getTime();
        if (startMs !== null && ms < startMs) return;
        if (endMs !== null && ms > endMs) return;
      }
    }

    seen.add(contactId);
    people.push({
      id: contactId,
      contactId,
      name: getContactName(c),
      phone: getContactPhone(c),
      city: getContactCity(c),
      khoji: getContactKhoji(c),
      calledFor: renderVal(c.calledFor || c.programName, "—"),
      attender: renderVal(c.attenderName || c.assignedTo, "Unassigned"),
      status: renderVal(c.status, "Reg.Done"),
      stage: c.pipelineStage || "6. Registered / Won",
      updatedAt: cDate
    });
  });

  return people;
}

function getContactValue(c, keysList) {
  if (!c || typeof c !== "object") return "";
  const matchingKeys = Object.keys(c).filter(k => keysList.includes(k.toLowerCase()));
  for (const k of matchingKeys) {
    const val = String(c[k] || "").trim();
    if (val) return val;
  }
  return "";
}

export function getLocalDateStr(d = new Date()) {
  if (!d) return "";
  const dateObj = d instanceof Date ? d : parseTimestamp(d) || new Date(d);
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const yr = dateObj.getFullYear();
  const mn = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dy = String(dateObj.getDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
}

export function parseLocalDateBoundaries(dateStr, isEnd = false) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-").map(p => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  let yr, mn, dy;
  if (parts[0] > 1000) {
    [yr, mn, dy] = parts;
  } else {
    [dy, mn, yr] = parts;
  }
  if (isEnd) {
    return new Date(yr, mn - 1, dy, 23, 59, 59, 999);
  } else {
    return new Date(yr, mn - 1, dy, 0, 0, 0, 0);
  }
}

export function getCanonicalPhysicalCalls(contacts = [], filters = {}) {
  const {
    startDate,
    endDate,
    selectedAttenderIds = [],
    selectedProgramIds = [],
    selectedSources = [],
    selectedCalledFors = [],
    selectedStatuses = [],
    selectedCallTypes = [],
    selectedKhojiStatuses = []
  } = filters;

  let startMs = null;
  let endMs = null;
  if (startDate) {
    const s = parseLocalDateBoundaries(startDate, false);
    if (s && !isNaN(s.getTime())) {
      startMs = s.getTime();
    }
  }
  if (endDate) {
    const e = parseLocalDateBoundaries(endDate, true);
    if (e && !isNaN(e.getTime())) {
      endMs = e.getTime();
    }
  }

  const physicalCalls = [];
  const seenCallIds = new Set();

  (contacts || []).forEach(c => {
    if (!c || c._deleted) return;

    if (selectedProgramIds.length > 0) {
      const contactTags = Array.isArray(c.tags) ? c.tags : [];
      const matchesProgram = selectedProgramIds.includes(c.programId) || contactTags.some(t => selectedProgramIds.includes(t));
      if (!matchesProgram) return;
    }

    const sourceVal = c.source || getContactValue(c, ["source", "sourse", "source of information", "source of informiton"]);
    if (selectedSources.length > 0 && !selectedSources.includes(sourceVal)) return;

    const calledForVal = c.calledFor || getContactValue(c, ["called for", "called_for", "calledfor"]);
    const logCalledFors = String(calledForVal).split(",").map(x => x.trim()).filter(Boolean);
    if (selectedCalledFors.length > 0 && !logCalledFors.some(cf => selectedCalledFors.includes(cf))) return;

    const khojiVal = getContactKhoji(c);
    if (selectedKhojiStatuses.length > 0 && !selectedKhojiStatuses.includes(khojiVal)) return;

    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        const callId = h.callId || h.id || `legacy_${c._id}_${idx}`;
        if (seenCallIds.has(callId)) return;

        const attId = h.attenderId || c.attenderId || "legacy";
        if (selectedAttenderIds.length > 0 && !selectedAttenderIds.includes(attId)) return;

        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        if (!ts) return;
        const timeMs = ts.getTime();
        if (startMs !== null && timeMs < startMs) return;
        if (endMs !== null && timeMs > endMs) return;

        const status = getCanonicalStatus(h.status || "Pending");
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) return;

        const callType = (h.callType || h.callDirection || "outgoing").toLowerCase();
        if (selectedCallTypes.length > 0) {
          const matchesType = selectedCallTypes.some(t => callType.startsWith(t.toLowerCase()));
          if (!matchesType) return;
        }

        seenCallIds.add(callId);

        physicalCalls.push({
          callId,
          contactId: String(c._id || c.id),
          contactName: getContactName(c),
          contactPhone: getContactPhone(c),
          attenderId: attId,
          attenderName: h.attenderName || c.attenderName || "Unknown",
          status,
          remark: h.remark || "",
          timestamp: ts,
          timeMs,
          callType,
          calledFor: h.calledFor || calledForVal,
          source: h.source || sourceVal,
          isHistory: true
        });
      });
    }
  });

  return physicalCalls;
}

export function getConnectedCalls(calls = []) {
  return (calls || []).filter(c => classifyCallStatus(c.status) === "CONNECTED");
}

export function getNotConnectedCalls(calls = []) {
  return (calls || []).filter(c => classifyCallStatus(c.status) === "NOT_CONNECTED");
}

export function getIncomingCalls(calls = []) {
  return (calls || []).filter(c => String(c.callType || "").toLowerCase().startsWith("incoming"));
}

export function getOutgoingCalls(calls = []) {
  return (calls || []).filter(c => String(c.callType || "").toLowerCase().startsWith("outgoing"));
}

export const COLORS = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

export const TAB_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={18} /> },
  { id: "pipeline-calls", label: "Pipeline & Calls 📈", icon: <TrendingUp size={18} /> },
  { id: "monthly", label: "Report", icon: <FileText size={18} /> },
  { id: "abhivyakti", label: "Abhivyakti", icon: <ClipboardCheck size={18} /> },
  { id: "all-attenders", label: "All Attenders Sheet", icon: <FileSpreadsheet size={18} /> },
  { id: "programs", label: "Programs", icon: <FolderOpen size={18} /> },
  { id: "import", label: "Lead Distribution 📂", icon: <Upload size={18} /> },
  { id: "attenders", label: "Attenders", icon: <Users size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

export const CONNECTED_STATUSES = ["Info given", "Interested", "Previous Program Pending", "Reg.Done", "reminder", "Reminder Given", "Reminder Pending", "Query", "Already Reg.d", "Next time", "Shivir done", "Not possible", "Pending", "Not interested", "Not Attended", "Call Log Added"];
export const NOT_CONNECTED_STATUSES = ["NA", "Busy", "Call Cut", "switched off", "Invalid No", "Called by mistake", "No Network", "wrong no.", "no answer"];

export function classifyCallStatus(rawStatus) {
  if (!rawStatus) return "NOT_CONNECTED";
  const canonical = getCanonicalStatus(rawStatus);
  const sLower = String(rawStatus).trim().toLowerCase();

  // Explicit Not Connected matches
  if (
    NOT_CONNECTED_STATUSES.includes(canonical) ||
    NOT_CONNECTED_STATUSES.some(ns => ns.toLowerCase() === sLower) ||
    sLower.includes("busy") ||
    sLower.includes("call cut") ||
    sLower.includes("switched off") ||
    sLower.includes("invalid") ||
    sLower.includes("no answer") ||
    sLower.includes("no network") ||
    sLower.includes("wrong no") ||
    sLower.includes("not picked") ||
    sLower.includes("no response") ||
    sLower.includes("not reachable") ||
    sLower.includes("unreachable")
  ) {
    return "NOT_CONNECTED";
  }

  // Explicit Connected matches
  if (
    CONNECTED_STATUSES.includes(canonical) ||
    CONNECTED_STATUSES.some(cs => cs.toLowerCase() === sLower) ||
    sLower.includes("info given") ||
    sLower.includes("interested") ||
    sLower.includes("previous program pending") ||
    sLower.includes("reg.done") ||
    sLower.includes("registered") ||
    sLower.includes("reminder") ||
    sLower.includes("query") ||
    sLower.includes("shivir") ||
    sLower.includes("alumni") ||
    sLower.includes("attended")
  ) {
    return "CONNECTED";
  }

  return "NOT_CONNECTED";
}

export const STANDARD_TARGETS = ["Name", "Phone", "Mobile", "Email", "City", "State", "Khoji", "Source", "Tags", "Ignore"];

export const getDefaultExcelMapping = (colName) => {
  const c = colName.trim().toLowerCase();
  if (["name", "caller", "caller name", "lead name", "lead", "name of caller", "first name", "last name", "contact name"].includes(c)) return "Name";
  if (["mobile", "mobile no", "mobile number"].includes(c)) return "Mobile";
  if (["phone", "whatsapp", "phone number", "whatsapp number", "whatsappno", "contact", "contact number", "cont no", "contact no", "contact_no"].includes(c)) return "Phone";
  if (["email", "mail", "e-mail", "email id", "emailaddress"].includes(c)) return "Email";
  if (["city", "location", "khoji city", "place", "city name"].includes(c)) return "City";
  if (["state", "state name", "province", "region"].includes(c)) return "State";
  if (isKhojiField(c)) return "Khoji";
  if (["tags", "tag"].includes(c)) return "Tags";
  if (["source of informiton", "source of information"].includes(c)) return "Source";
  if (["source", "sourse", "origin"].includes(c)) return "Ignore";
  return "Ignore";
};

export const cleanExportRow = (log) => {
  const INTERNAL_KEYS = [
    "id", "programId", "programName", "contactId", "attenderId", "createdAt", "updatedAt",
    "history", "_callbackDue", "_deleted", "isCallbackDue", "isHotLead", "callCount",
    "callbackStatus", "lastCalledAt", "firstCalledAt", "registeredAt", "conversionSource",
    "convertedBy", "subProgram", "objectionReason"
  ];

  const row = {};
  
  // Find standard field mappings
  const findValue = (obj, keysList) => {
    const matchingKeys = Object.keys(obj).filter(k => keysList.includes(k.toLowerCase()));
    for (const k of matchingKeys) {
      const val = String(obj[k] || "").trim();
      if (val) return val;
    }
    return "";
  };

  const nameVal = findValue(log, ["name", "caller", "caller name", "lead name", "lead", "name of caller"]);
  const phoneVal = findValue(log, ["phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno", "contact", "contact number", "mobile number"]);
  const emailVal = findValue(log, ["email", "mail", "e-mail", "email id", "emailaddress"]);
  const cityVal = findValue(log, ["city", "location", "khoji city", "place", "city name"]);
  const countryVal = findValue(log, ["country", "nation"]);
  const tagsVal = findValue(log, ["tags", "tag"]);
  const sourceVal = log.source || findValue(log, ["source", "sourse", "source of information", "source of informiton"]);
  const calledForVal = log.calledFor || findValue(log, ["called for", "called_for", "calledfor"]);
  const statusVal = log.status || "Pending";
  const remarkVal = log.remark || "";
  const subProgramVal = log["Sub Program"] || log.subProgram || "";

  let callbackDateStr = "";
  if (log.callbackDate) {
    const d = parseTimestamp(log.callbackDate);
    if (d && !isNaN(d.getTime())) {
      callbackDateStr = d.toLocaleDateString("en-IN");
    }
  }

  row["Name"] = nameVal;
  row["Phone"] = phoneVal;
  row["Email"] = emailVal;
  row["City"] = cityVal;
  row["Country"] = countryVal;
  row["Tags"] = tagsVal;
  row["Source"] = sourceVal;
  row["Called For"] = calledForVal;
  row["Sub Program"] = subProgramVal;
  row["Status"] = statusVal;
  row["Remark"] = remarkVal;
  row["Callback Date"] = callbackDateStr;

  // Add all other dynamic/custom keys from GHL / Excel
  Object.keys(log).forEach(key => {
    if (INTERNAL_KEYS.includes(key) || key.startsWith("_")) return;
    
    // Skip if it was mapped to a standard field above
    const isStandard = [
      "name", "caller", "caller name", "lead name", "lead", "name of caller",
      "phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno", "contact", "contact number", "mobile number",
      "email", "mail", "e-mail", "email id", "emailaddress",
      "city", "location", "khoji city", "place", "city name",
      "country", "nation", "tags", "tag", "status", "remark", "callbackdate", "sub program",
      "source", "sourse", "source of information", "source of informiton",
      "called for", "called_for", "calledfor"
    ].includes(key.toLowerCase());
    
    if (!isStandard) {
      row[key] = log[key];
    }
  });

  if (log.attenderName) {
    row["Attended By"] = log.attenderName;
  }

  let historyStr = "";
  if (log.history && Array.isArray(log.history)) {
    historyStr = log.history.map(h => {
      const d = parseTimestamp(h.timestamp);
      const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "Invalid Date";
      return `[${dateStr}] ${h.attenderName}: ${h.status} - ${h.remark}`;
    }).join(" | ");
  }
  row["Call History Timeline"] = historyStr;

  return row;
};

export function getCanonicalStatus(status) {
  if (!status) return "";
  const sLower = status.trim().toLowerCase();
  if (sLower === "interested") return "Interested";
  if (sLower === "reg.done" || sLower === "registered") return "Reg.Done";
  if (sLower === "previous program pending") return "Previous Program Pending";
  if (sLower === "not interested" || sLower === "not intrested") return "Not interested";
  if (sLower === "na") return "NA";
  if (sLower === "busy") return "Busy";
  if (sLower === "call cut") return "Call Cut";
  if (sLower === "switched off") return "switched off";
  if (sLower === "invalid no") return "Invalid No";
  if (sLower === "already reg.d" || sLower === "already registered") return "Already Reg.d";
  if (sLower === "info given") return "Info given";
  if (sLower === "next time") return "Next time";
  if (sLower === "reminder") return "reminder";
  if (sLower === "query") return "Query";
  if (sLower === "called by mistake") return "Called by mistake";
  if (sLower === "not possible") return "Not possible";
  if (sLower === "shivir done") return "Shivir done";
  if (sLower === "no answer") return "no answer";
  if (sLower === "not attended") return "Not Attended";
  if (sLower === "call log added") return "Call Log Added";
  if (sLower === "no network") return "No Network";
  if (sLower === "wrong no" || sLower === "wrong no.") return "wrong no.";
  return status;
}

export const getAllCallEntries = (log) => {
  if (!log || typeof log !== "object") return [];

  const calls = [];
  const seenKeys = new Set();

  const addCall = (timestamp, status, remark, attenderName, callType) => {
    const rTrim = String(remark || "").trim();
    const sTrim = String(status || "").trim();
    if (!sTrim && !rTrim) return;

    const d = parseTimestamp(timestamp);
    const timeMs = d && !isNaN(d.getTime()) ? d.getTime() : 0;
    const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "";

    const key = `${timeMs}_${sTrim.toLowerCase()}_${rTrim.toLowerCase()}_${String(attenderName || "").toLowerCase()}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    calls.push({
      timestamp: d,
      timeMs,
      dateStr,
      status: sTrim || log.status || "Pending",
      remark: rTrim,
      attenderName: attenderName || log.attenderName || "Unassigned",
      callType: callType || log.callType || "outgoing"
    });
  };

  // 1. Array history on log
  if (Array.isArray(log.history)) {
    log.history.forEach(h => {
      addCall(
        h.timestamp || h.date || h.createdAt || h.updatedAt,
        h.status,
        h.remark,
        h.attenderName,
        h.callType
      );
    });
  }

  // 2. attenderStates
  if (log.attenderStates && typeof log.attenderStates === "object") {
    Object.keys(log.attenderStates).forEach(attId => {
      const state = log.attenderStates[attId];
      if (!state) return;
      if (Array.isArray(state.history)) {
        state.history.forEach(h => {
          if ((!h.status || h.status === "Pending") && !h.timestamp) return;
          addCall(
            h.timestamp || h.date || h.createdAt,
            h.status,
            h.remark,
            h.attenderName || state.attenderName,
            h.callType
          );
        });
      }
      if (state.remark || (state.status && state.status !== "Pending") || state.lastCalledAt) {
        const ts = state.lastCalledAt ? new Date(state.lastCalledAt).getTime() : 0;
        const existsInHistory = Array.isArray(state.history) && state.history.some(h => {
          const hTs = h.timestamp || h.date ? new Date(h.timestamp || h.date).getTime() : 0;
          return hTs && ts && Math.abs(hTs - ts) < 5000;
        });
        if (!existsInHistory) {
          addCall(
            state.lastCalledAt || state.createdAt,
            state.status,
            state.remark,
            state.attenderName,
            state.callType
          );
        }
      }
    });
  }

  // 3. Standalone log.remark or log.status (only if no calls were collected from attenderStates or history)
  if (calls.length === 0 && (log.remark || (log.status && log.status !== "Pending") || log.lastCalledAt)) {
    addCall(
      log.lastCalledAt || log.createdAt,
      log.status,
      log.remark,
      log.attenderName,
      log.callType
    );
  }

  // Sort calls chronologically (ascending: earliest call to latest call)
  calls.sort((a, b) => a.timeMs - b.timeMs);

  // If no call history entries found at all, return default entry
  if (calls.length === 0) {
    const d = parseTimestamp(log.createdAt || log.date_added);
    calls.push({
      timestamp: d,
      timeMs: d ? d.getTime() : 0,
      dateStr: d && !isNaN(d.getTime()) ? d.toLocaleString("en-IN") : "",
      status: log.status || "Pending",
      remark: log.remark || "",
      attenderName: log.attenderName || "Unassigned",
      callType: log.callType || "outgoing"
    });
  }

  return calls;
};

export const getCallsDoneCount = (log) => {
  if (!log) return 0;
  const calls = getAllCallEntries(log);
  if (
    calls.length === 1 &&
    calls[0].status === "Pending" &&
    !calls[0].remark &&
    (!log.history || log.history.length === 0) &&
    !log.lastCalledAt
  ) {
    return 0;
  }
  return calls.length;
};


