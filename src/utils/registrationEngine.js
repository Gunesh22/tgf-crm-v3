// src/utils/registrationEngine.js
import { PIPELINE_STAGES } from './pipelineEngine.js';

export function determineCallType(obj, linkedContact = null) {
  if (!obj && !linkedContact) return 'outgoing';

  const checkIncoming = (target) => {
    if (!target || typeof target !== 'object') return false;
    if (target.isIncoming === true) return true;
    
    const ct = String(target.callType || target.type || target.call_type || '').toLowerCase().trim();
    if (ct === 'incoming' || ct === 'in' || ct === 'incoming call' || ct === 'incoming calls' || ct.includes('incoming')) return true;

    const pid = String(target.programId || target.program_id || '').toLowerCase().trim();
    if (pid === 'incoming' || pid === 'incoming-calls' || pid === 'incoming calls' || pid.includes('incoming')) return true;

    const src = String(target.source || target.Source || '').toLowerCase().trim();
    if (src === 'incoming' || src === 'incoming calls' || src === 'incoming call') return true;

    const cp = String(target.callPurpose || target.call_purpose || '').toLowerCase().trim();
    if (cp === 'incoming') return true;

    return false;
  };

  const checkOutgoing = (target) => {
    if (!target || typeof target !== 'object') return false;
    if (target.isIncoming === false) return true;

    const ct = String(target.callType || target.type || target.call_type || '').toLowerCase().trim();
    if (ct === 'outgoing' || ct === 'out' || ct === 'outgoing call' || ct === 'outgoing calls' || ct.includes('outgoing')) return true;

    const cp = String(target.callPurpose || target.call_purpose || '').toLowerCase().trim();
    if (cp === 'outgoing') return true;

    return false;
  };

  // 1. Direct explicit call type on the registration record / object itself (only check callType/isIncoming, NOT source)
  const directType = String(obj?.callType || obj?.type || obj?.call_type || '').toLowerCase().trim();
  if (directType === 'outgoing' || directType === 'out' || obj?.isIncoming === false) return 'outgoing';
  if (directType === 'incoming' || directType === 'in' || obj?.isIncoming === true) return 'incoming';

  // Helper to extract converting call or latest call from a history array
  const evalHistory = (historyArr) => {
    if (!Array.isArray(historyArr) || historyArr.length === 0) return null;
    
    // Look for the call item where registration actually happened (Reg.Done / Registered)
    const regCall = [...historyArr].reverse().find(h => {
      const st = String(h?.status || '').toLowerCase();
      return st.includes('reg.done') || st.includes('registered');
    });

    if (regCall) {
      if (checkOutgoing(regCall)) return 'outgoing';
      if (checkIncoming(regCall)) return 'incoming';
    }

    // Fallback to the latest call entry
    const latestCall = historyArr[historyArr.length - 1];
    if (latestCall) {
      if (checkOutgoing(latestCall)) return 'outgoing';
      if (checkIncoming(latestCall)) return 'incoming';
    }

    return null;
  };

  // 2. Check history on obj itself or linkedContact
  if (Array.isArray(obj?.history)) {
    const histResult = evalHistory(obj.history);
    if (histResult) return histResult;
  }

  if (linkedContact) {
    if (Array.isArray(linkedContact.history)) {
      const histResult = evalHistory(linkedContact.history);
      if (histResult) return histResult;
    }
    const linkedType = String(linkedContact.callType || linkedContact.type || linkedContact.call_type || '').toLowerCase().trim();
    if (linkedType === 'outgoing' || linkedContact.isIncoming === false) return 'outgoing';
    if (linkedType === 'incoming' || linkedContact.isIncoming === true) return 'incoming';
  }

  // 3. Fallback check for source/incoming tags
  if (checkIncoming(obj)) return 'incoming';
  if (linkedContact && checkIncoming(linkedContact)) return 'incoming';

  return 'outgoing';
}

export function parseTimestamp(t) {
  if (!t) return null;
  if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
  if (typeof t.toDate === 'function') return t.toDate();
  if (typeof t.toMillis === 'function') return new Date(t.toMillis());
  if (typeof t === 'object') {
    if (t.seconds !== undefined || t._seconds !== undefined) {
      const sec = t.seconds !== undefined ? t.seconds : t._seconds;
      const nsec = t.nanoseconds !== undefined ? t.nanoseconds : (t._nanoseconds || 0);
      return new Date(sec * 1000 + Math.round(nsec / 1000000));
    }
    const inner = t.date || t.$date || t.value || t.iso || t.formatted || t.startDate || t.endDate;
    if (inner && inner !== t) return parseTimestamp(inner);
  }
  if (typeof t === 'number') return new Date(t);
  if (typeof t === 'string') {
    const parsed = new Date(t);
    if (!isNaN(parsed.getTime())) return parsed;
    const cleaned = t.replace(/-/g, '/');
    const parsedCleaned = new Date(cleaned);
    if (!isNaN(parsedCleaned.getTime())) return parsedCleaned;
  }
  return null;
}

export function parseLocalDateBoundaries(dateStr, isEnd = false) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(p => parseInt(p, 10));
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

export function renderVal(val, fallback = '—') {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'object') {
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

export function getContactName(log, attempt) {
  if (attempt?.contactName && String(attempt.contactName).trim()) return String(attempt.contactName).trim();
  if (attempt?.name && String(attempt.name).trim()) return String(attempt.name).trim();
  if (!log || typeof log !== 'object') return 'Unknown';

  const candidates = [
    log.Name, log.name, log.leadName, log['Lead Name'], log['Full Name'],
    log.caller, log['Caller Name'], log['Name of Caller'], log.fullName
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') return String(c).trim();
  }
  return 'Unknown';
}

export function getContactPhone(log, attempt) {
  if (attempt?.contactPhone && String(attempt.contactPhone).trim()) return String(attempt.contactPhone).trim();
  if (attempt?.phone && String(attempt.phone).trim()) return String(attempt.phone).trim();
  if (attempt?.mobile && String(attempt.mobile).trim()) return String(attempt.mobile).trim();
  if (!log || typeof log !== 'object') return '';

  const candidates = [
    log.Phone, log.Mobile, log.phone, log.mobile, log.contactPhone,
    log.normalizedPhone, log.normalizedMobile, log['Mobile Number'],
    log['Phone Number'], log['Whatsapp Number'], log['WhatsApp Number'],
    log['Contact Number'], log['Contact No'], log['Phone No'], log['Mobile No']
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') return String(c).trim();
  }
  return '';
}

export function getContactCity(log, attempt) {
  if (attempt?.contactCity && String(attempt.contactCity).trim()) return String(attempt.contactCity).trim();
  if (attempt?.city && String(attempt.city).trim()) return String(attempt.city).trim();
  if (!log || typeof log !== 'object') return '';

  const candidates = [
    log.City, log.city, log.location, log.Location, log['Khoji City'],
    log['City Name'], log.place, log.town, log.district, log.address
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') return String(c).trim();
  }
  return '';
}

export function isStageRegisteredWon(c) {
  if (!c) return false;
  const stage = String(c.pipelineStage || '').toLowerCase();
  const status = String(c.status || '').toLowerCase();
  if (stage.includes('registered') || stage.includes('won') || stage === '6. registered / won') return true;
  if (status.includes('reg.done') || status.includes('registered')) return true;
  if (Array.isArray(c.history) && c.history.some(h => String(h.status || '').toLowerCase().includes('reg.done') || String(h.status || '').toLowerCase().includes('registered'))) return true;
  if (c.attenderStates && typeof c.attenderStates === 'object') {
    return Object.values(c.attenderStates).some(st => String(st?.status || '').toLowerCase().includes('reg.done') || String(st?.status || '').toLowerCase().includes('registered'));
  }
  return false;
}

/**
 * Single Source of Truth for Program Registrations.
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

  const getLocalDateStr = (d) => {
    if (!d) return '';
    const dateObj = d instanceof Date ? d : parseTimestamp(d) || new Date(d);
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const yr = dateObj.getFullYear();
    const mn = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dy = String(dateObj.getDate()).padStart(2, '0');
    return `${yr}-${mn}-${dy}`;
  };

  const getUTCDateStr = (d) => {
    if (!d) return '';
    const dateObj = d instanceof Date ? d : parseTimestamp(d) || new Date(d);
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const yr = dateObj.getUTCFullYear();
    const mn = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${yr}-${mn}-${dy}`;
  };

  const inDateRange = (ts) => {
    if (!ts) return true;
    const parsed = parseTimestamp(ts);
    if (!parsed || isNaN(parsed.getTime())) return true;
    const localStr = getLocalDateStr(parsed);
    const utcStr = getUTCDateStr(parsed);
    const isLocalMatch = (!startDate || localStr >= startDate) && (!endDate || localStr <= endDate);
    const isUtcMatch = (!startDate || utcStr >= startDate) && (!endDate || utcStr <= endDate);
    return isLocalMatch || isUtcMatch;
  };

  const matchesAttenderFilter = (attId, attName, contactAssigned) => {
    if (!selectedAttenderIds || selectedAttenderIds.length === 0) return true;
    if (attId && selectedAttenderIds.map(String).includes(String(attId))) return true;
    if (Array.isArray(contactAssigned) && selectedAttenderIds.some(id => contactAssigned.map(String).includes(String(id)))) return true;
    if (attName) {
      const cleanName = String(attName).trim().toLowerCase();
      return selectedAttenderIds.some(id => String(id).toLowerCase() === cleanName);
    }
    return false;
  };

  const matchesProgramFilter = (progId, calledFor, calledForKey) => {
    if (!selectedProgramIds || selectedProgramIds.length === 0) return true;
    const pId = String(progId || '').trim().toLowerCase();
    const cFor = String(calledFor || '').trim().toLowerCase();
    const cKey = String(calledForKey || '').trim().toLowerCase();
    return selectedProgramIds.some(sp => {
      const spClean = String(sp).trim().toLowerCase();
      return spClean === pId || spClean === cFor || spClean === cKey;
    });
  };

  const matchesSourceFilter = (source) => {
    if (!selectedSources || selectedSources.length === 0) return true;
    return selectedSources.includes(String(source || '').trim());
  };

  const matchesCalledForFilter = (calledFor) => {
    if (!selectedCalledFors || selectedCalledFors.length === 0) return true;
    return selectedCalledFors.includes(String(calledFor || '').trim());
  };

  const seenRegKeys = new Set();
  const result = [];

  // 1. Process explicit registrations collection records first
  (registrations || []).forEach(reg => {
    if (!reg || reg._deleted) return;
    const contactId = String(reg.contactId || reg.leadId || reg.contact_id || '').trim();
    const calledForKey = String(reg.calledForKey || reg.programKey || reg.calledFor || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!contactId || !calledForKey) return;

    const regKey = `${contactId}_${calledForKey}`;
    if (seenRegKeys.has(regKey)) return;

    const regDate = reg.registeredAt || reg.updatedAt || reg.createdAt || reg.timestamp || reg.date;
    if (!inDateRange(regDate)) return;

    const attId = reg.attenderId || reg.attender_id || reg.createdBy || '';
    const attName = renderVal(reg.attenderName || reg.assignedTo, 'Unassigned');
    if (!matchesAttenderFilter(attId, attName, reg.assignedTo)) return;
    if (!matchesProgramFilter(reg.programId, reg.calledFor, calledForKey)) return;
    if (!matchesSourceFilter(reg.source || reg.Source)) return;
    if (!matchesCalledForFilter(reg.calledFor || reg.programName)) return;

    const contact = (contacts || []).find(c => String(c.id || c._id || c.Phone || '').trim() === String(contactId).trim());
    const resolvedCallType = determineCallType(reg, contact);

    seenRegKeys.add(regKey);
    result.push({
      id: reg.id || reg._id || regKey,
      contactId,
      calledForKey,
      contactName: renderVal(reg.contactName || reg.name || reg.Name, 'Unknown'),
      name: renderVal(reg.contactName || reg.name || reg.Name, 'Unknown'),
      contactPhone: renderVal(reg.contactPhone || reg.phone || reg.Phone || reg.Mobile || reg.mobile || reg.normalizedMobile, '—'),
      phone: renderVal(reg.contactPhone || reg.phone || reg.Phone || reg.Mobile || reg.mobile || reg.normalizedMobile, '—'),
      contactCity: renderVal(reg.city || reg.City, '—'),
      city: renderVal(reg.city || reg.City, '—'),
      khoji: renderVal(reg.khoji || reg.Khoji, '—'),
      calledFor: renderVal(reg.calledFor || reg.programName, calledForKey),
      programName: renderVal(reg.calledFor || reg.programName, calledForKey),
      attenderName: attName,
      attender: attName,
      attenderId: attId,
      source: renderVal(reg.source || reg.Source, '—'),
      status: 'Reg.Done',
      stage: '6. Registered / Won',
      callType: resolvedCallType,
      type: resolvedCallType,
      registeredAt: regDate,
      timestamp: regDate,
      createdAt: regDate,
      lastCalledAt: regDate,
      feedback: renderVal(reg.feedback || reg.userFeedback, '—'),
      remark: renderVal(reg.remark || reg.Remark, '—'),
      tags: reg.tags || []
    });
  });

  // 2. Fallback Step: Deduplicated contacts whose stage/status is Reg.Done / Registered / Won but missing from registrations collection
  (contacts || []).forEach(c => {
    if (!c || c._deleted) return;
    const isRegistered = isStageRegisteredWon(c);
    if (!isRegistered) return;

    const contactId = String(c.id || c._id || c.Phone || c.Name || '').trim();
    const rawCalledFor = String(c.calledFor || c.programName || c['Called For'] || 'general').trim();
    const calledForKey = rawCalledFor.toLowerCase().replace(/[\s_-]+/g, '');
    if (!contactId || !calledForKey) return;

    const regKey = `${contactId}_${calledForKey}`;
    if (seenRegKeys.has(regKey)) return;

    const regDate = c.registeredAt || c.updatedAt || c.lastCalledAt || c.createdAt;
    if (!inDateRange(regDate)) return;

    const attId = c.attenderId || c.createdBy || '';
    const attName = renderVal(c.attenderName || c.assignedTo, 'Unassigned');
    if (!matchesAttenderFilter(attId, attName, c.assignedTo)) return;
    if (!matchesProgramFilter(c.programId, rawCalledFor, calledForKey)) return;
    if (!matchesSourceFilter(c.source || c.Source)) return;
    if (!matchesCalledForFilter(rawCalledFor)) return;

    const resolvedCallType = determineCallType(c);

    seenRegKeys.add(regKey);
    result.push({
      id: `fallback_${regKey}`,
      contactId,
      calledForKey,
      contactName: getContactName(c),
      name: getContactName(c),
      contactPhone: getContactPhone(c) || '—',
      phone: getContactPhone(c) || '—',
      contactCity: getContactCity(c) || '—',
      city: getContactCity(c) || '—',
      khoji: renderVal(c.Khoji || c.khoji, '—'),
      calledFor: rawCalledFor,
      programName: rawCalledFor,
      attenderName: attName,
      attender: attName,
      attenderId: attId,
      source: renderVal(c.source || c.Source, '—'),
      status: 'Reg.Done',
      stage: '6. Registered / Won',
      callType: resolvedCallType,
      type: resolvedCallType,
      registeredAt: regDate,
      timestamp: regDate,
      createdAt: regDate,
      lastCalledAt: regDate,
      feedback: renderVal(c.feedback || c.userFeedback, '—'),
      remark: renderVal(c.remark || c.Remark, '—'),
      tags: c.tags || []
    });
  });

  return result;
}

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

export function getCanonicalStage6People(contacts = [], filters = {}) {
  const { startDate, endDate } = filters;
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

    const contactId = String(c.id || c._id || c.Phone || c.Name || '').trim();
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
      khoji: renderVal(c.Khoji || c.khoji, '—'),
      calledFor: renderVal(c.calledFor || c.programName, '—'),
      attender: renderVal(c.attenderName || c.assignedTo, 'Unassigned'),
      status: renderVal(c.status, 'Reg.Done'),
      stage: c.pipelineStage || '6. Registered / Won',
      updatedAt: cDate
    });
  });

  return people;
}
