// src/utils/registrationEngine.js
import { PIPELINE_STAGES } from './pipelineEngine.js';

export function determineCallType(obj, linkedContact = null) {
  if (!obj && !linkedContact) return 'outgoing';

  const checkIncoming = (target) => {
    if (!target || typeof target !== 'object') return false;
    if (target.isIncoming === true) return true;
    
    const ct = String(target.callType || target.callDirection || target.type || target.call_type || target.call_direction || '').toLowerCase().trim();
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

    const ct = String(target.callType || target.callDirection || target.type || target.call_type || target.call_direction || '').toLowerCase().trim();
    if (ct === 'outgoing' || ct === 'out' || ct === 'outgoing call' || ct === 'outgoing calls' || ct.includes('outgoing')) return true;

    const cp = String(target.callPurpose || target.call_purpose || '').toLowerCase().trim();
    if (cp === 'outgoing') return true;

    return false;
  };

  // 1. Direct explicit call type on the registration record / object itself (only check callType/callDirection/isIncoming, NOT source)
  const directType = String(obj?.callType || obj?.callDirection || obj?.type || obj?.call_type || obj?.call_direction || '').toLowerCase().trim();
  if (directType === 'outgoing' || directType === 'out' || obj?.isIncoming === false) return 'outgoing';
  if (directType === 'incoming' || directType === 'in' || obj?.isIncoming === true) return 'incoming';

  // Helper to extract converting call or latest call from a history array
  const evalHistory = (historyArr) => {
    if (!Array.isArray(historyArr) || historyArr.length === 0) return null;
    
    // Look for the call item where registration actually happened (Reg.Done / Registered)
    const regCall = [...historyArr].reverse().find(h => {
      const st = String(h?.status || '').toLowerCase();
      if (st.includes('already reg') || st.includes('shivir done') || st.includes('alumni')) return false;
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
    const linkedType = String(linkedContact.callType || linkedContact.callDirection || linkedContact.type || linkedContact.call_type || linkedContact.call_direction || '').toLowerCase().trim();
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
  const attName = attempt?.Name || attempt?.contactName || attempt?.name;
  if (attName && String(attName).trim()) return String(attName).trim();
  if (!log || typeof log !== 'object') return 'Unknown';

  const val = log.Name || log.name || log.leadName || log['Lead Name'] || log['Full Name'] || log.caller || log.fullName;
  if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  return 'Unknown';
}

export function getContactPhone(log, attempt) {
  const attPhone = attempt?.Phone || attempt?.contactPhone || attempt?.phone || attempt?.Mobile || attempt?.mobile;
  if (attPhone && String(attPhone).trim()) return String(attPhone).trim();
  if (!log || typeof log !== 'object') return '';

  const val = log.Phone || log.Mobile || log.phone || log.mobile || log.contactPhone || log.normalizedPhone || log['Mobile Number'] || log['Phone Number'];
  if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  return '';
}

export function getContactCity(log, attempt) {
  const attCity = attempt?.City || attempt?.city || attempt?.contactCity;
  if (attCity && String(attCity).trim() && String(attCity).trim() !== '—') return String(attCity).trim();
  if (!log || typeof log !== 'object') return '';

  const val = log.City || log.city || log.location || log['Khoji City'];
  if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '—') return String(val).trim();
  return '';
}

export function getContactLeadOrigin(log, attempt) {
  const extractFromObj = (obj, allowFallbackSource = true) => {
    if (!obj || typeof obj !== 'object') return '';
    const directVal = obj.leadOrigin || obj.original_source || obj.originalSource || obj['Lead Origin'] || obj.lead_origin;
    if (directVal && String(directVal).trim() && String(directVal).trim() !== '—') {
      return String(directVal).trim();
    }
    if (allowFallbackSource) {
      const srcVal = obj.source || obj.Source || obj.currentSource;
      if (srcVal && String(srcVal).trim() && String(srcVal).trim() !== '—') {
        return String(srcVal).trim();
      }
    }
    return '';
  };

  // 1. Direct check on attempt object (only explicit original_source / leadOrigin)
  if (attempt && typeof attempt === 'object') {
    const attOrigin = extractFromObj(attempt, false);
    if (attOrigin) return attOrigin;
  }

  // 2. Determine target program key / name from attempt
  let targetProgramKey = '';
  if (typeof attempt === 'string') {
    targetProgramKey = attempt.trim().toLowerCase().replace(/[\s_-]+/g, '');
  } else if (attempt && typeof attempt === 'object') {
    const rawProg = attempt.calledFor || attempt.called_for || attempt.calledForKey || attempt.programName || attempt.programId || '';
    if (rawProg) targetProgramKey = String(rawProg).trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  // 3. Check log object itself if log is a registration/history record for that program
  if (log && typeof log === 'object') {
    const logProgKey = String(log.calledFor || log.called_for || log.calledForKey || log.programName || log.programId || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (targetProgramKey && logProgKey && (logProgKey === targetProgramKey || logProgKey.includes(targetProgramKey) || targetProgramKey.includes(logProgKey))) {
      const logOrigin = extractFromObj(log);
      if (logOrigin) return logOrigin;
    }
  }

  if (!log || typeof log !== 'object') return '';

  // 4. Search history for specific program context (earliest call for lead origin)
  if (targetProgramKey && Array.isArray(log.history) && log.history.length > 0) {
    for (let i = 0; i < log.history.length; i++) {
      const h = log.history[i];
      const hProgKey = String(h?.calledFor || h?.called_for || h?.calledForKey || h?.programName || h?.programId || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (hProgKey && (hProgKey === targetProgramKey || hProgKey.includes(targetProgramKey) || targetProgramKey.includes(hProgKey))) {
        const hOrigin = extractFromObj(h);
        if (hOrigin) return hOrigin;
      }
    }
  }

  // 4b. Search programStates for specific program key
  if (targetProgramKey && log.programStates && typeof log.programStates === 'object') {
    for (const attMap of Object.values(log.programStates)) {
      if (attMap && typeof attMap === 'object') {
        for (const [pKey, pObj] of Object.entries(attMap)) {
          const cleanPKey = String(pKey).trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (cleanPKey === targetProgramKey || cleanPKey.includes(targetProgramKey) || targetProgramKey.includes(cleanPKey)) {
            const pOrigin = extractFromObj(pObj);
            if (pOrigin) return pOrigin;
          }
        }
      }
    }
  }

  // 4c. Search attenderStates for specific program key or calledFor
  if (targetProgramKey && log.attenderStates && typeof log.attenderStates === 'object') {
    for (const stObj of Object.values(log.attenderStates)) {
      if (stObj && typeof stObj === 'object') {
        const stProg = stObj.calledFor || stObj.called_for || stObj.calledForKey || stObj.program || '';
        const cleanStKey = String(stProg).trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (cleanStKey && (cleanStKey === targetProgramKey || cleanStKey.includes(targetProgramKey) || targetProgramKey.includes(cleanStKey))) {
          const stOrigin = extractFromObj(stObj);
          if (stOrigin) return stOrigin;
        }
      }
    }
  }

  // 5. Fallback: direct extract from log object
  let origin = extractFromObj(log);
  if (origin) return origin;

  // 6. Fallback: earliest history entry
  if (Array.isArray(log.history) && log.history.length > 0) {
    for (let i = 0; i < log.history.length; i++) {
      const hOrigin = extractFromObj(log.history[i]);
      if (hOrigin) return hOrigin;
    }
  }

  return '';
}

export function getContactSource(log, attempt) {
  const extractFromObj = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    const directVal = obj.source || obj.Source || obj.currentSource || obj.conversionSource || obj.callSource;
    if (directVal && String(directVal).trim() && String(directVal).trim() !== '—') {
      return String(directVal).trim();
    }
    return '';
  };

  // 1. Direct check on attempt object
  if (attempt && typeof attempt === 'object') {
    const attSrc = extractFromObj(attempt);
    if (attSrc) return attSrc;
  }

  // 2. Determine target program key / name from attempt
  let targetProgramKey = '';
  if (typeof attempt === 'string') {
    targetProgramKey = attempt.trim().toLowerCase().replace(/[\s_-]+/g, '');
  } else if (attempt && typeof attempt === 'object') {
    const rawProg = attempt.calledFor || attempt.called_for || attempt.calledForKey || attempt.programName || attempt.programId || '';
    if (rawProg) targetProgramKey = String(rawProg).trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  // 3. Check log object itself if log is a registration/history record for that program
  if (log && typeof log === 'object') {
    const logProgKey = String(log.calledFor || log.called_for || log.calledForKey || log.programName || log.programId || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (targetProgramKey && logProgKey && (logProgKey === targetProgramKey || logProgKey.includes(targetProgramKey) || targetProgramKey.includes(logProgKey))) {
      const logSrc = extractFromObj(log);
      if (logSrc) return logSrc;
    }
  }

  if (!log || typeof log !== 'object') return '';

  // 4. Search history for specific program context (latest call for that specific program)
  if (targetProgramKey && Array.isArray(log.history) && log.history.length > 0) {
    for (let i = log.history.length - 1; i >= 0; i--) {
      const h = log.history[i];
      const hProgKey = String(h?.calledFor || h?.called_for || h?.calledForKey || h?.programName || h?.programId || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (hProgKey && (hProgKey === targetProgramKey || hProgKey.includes(targetProgramKey) || targetProgramKey.includes(hProgKey))) {
        const hSrc = extractFromObj(h);
        if (hSrc) return hSrc;
      }
    }
  }

  // 4b. Search programStates for specific program key
  if (targetProgramKey && log.programStates && typeof log.programStates === 'object') {
    for (const attMap of Object.values(log.programStates)) {
      if (attMap && typeof attMap === 'object') {
        for (const [pKey, pObj] of Object.entries(attMap)) {
          const cleanPKey = String(pKey).trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (cleanPKey === targetProgramKey || cleanPKey.includes(targetProgramKey) || targetProgramKey.includes(cleanPKey)) {
            const pSrc = extractFromObj(pObj);
            if (pSrc) return pSrc;
          }
        }
      }
    }
  }

  // 5. Search attenderStates for specific program key or calledFor
  if (targetProgramKey && log.attenderStates && typeof log.attenderStates === 'object') {
    for (const stObj of Object.values(log.attenderStates)) {
      if (stObj && typeof stObj === 'object') {
        const stProg = stObj.calledFor || stObj.called_for || stObj.calledForKey || stObj.program || '';
        const cleanStKey = String(stProg).trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (cleanStKey && (cleanStKey === targetProgramKey || cleanStKey.includes(targetProgramKey) || targetProgramKey.includes(cleanStKey))) {
          const stSrc = extractFromObj(stObj);
          if (stSrc) return stSrc;
        }
      }
    }
  }

  // 6. If targetProgramKey is specified but NOT found in history/states for that program:
  // Return root extractFromObj(log) ONLY if root log explicitly has source AND log's own program matches or is unspecified.
  if (targetProgramKey) {
    const logProgKey = String(log.calledFor || log.called_for || log.calledForKey || log.programName || log.programId || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!logProgKey || logProgKey === targetProgramKey || logProgKey.includes(targetProgramKey) || targetProgramKey.includes(logProgKey)) {
      const directSrc = extractFromObj(log);
      if (directSrc) return directSrc;
    }
    return '';
  }

  // 7. General fallback when no target program context is specified:
  let src = extractFromObj(log);
  if (src) return src;

  if (Array.isArray(log.history) && log.history.length > 0) {
    for (let i = log.history.length - 1; i >= 0; i--) {
      const hSrc = extractFromObj(log.history[i]);
      if (hSrc) return hSrc;
    }
  }

  if (log.attenderStates && typeof log.attenderStates === 'object') {
    for (const st of Object.values(log.attenderStates)) {
      const stSrc = extractFromObj(st);
      if (stSrc) return stSrc;
    }
  }

  return '';
}

export function isStageRegisteredWon(c) {
  if (!c) return false;
  const stage = String(c.pipelineStage || '').toLowerCase().trim();
  const status = String(c.status || '').toLowerCase().trim();
  if (stage === 'existing alumni' || stage === 'alumni') return false;
  if (status.includes('already reg') || status.includes('shivir done') || status.includes('alumni')) {
    return false;
  }
  if (stage.includes('registered') || stage.includes('won') || stage === '6. registered / won') return true;
  if ((status.includes('reg.done') || status.includes('registered')) && !status.includes('already reg')) return true;
  if (Array.isArray(c.history) && c.history.some(h => {
    const hs = String(h.status || '').toLowerCase().trim();
    if (hs.includes('already reg') || hs.includes('shivir done') || hs.includes('alumni')) return false;
    return hs.includes('reg.done') || hs.includes('registered');
  })) return true;
  if (c.attenderStates && typeof c.attenderStates === 'object') {
    return Object.values(c.attenderStates).some(st => {
      const ss = String(st?.status || '').toLowerCase().trim();
      if (ss.includes('already reg') || ss.includes('shivir done') || ss.includes('alumni')) return false;
      return ss.includes('reg.done') || ss.includes('registered');
    });
  }
  return false;
}

export function isRawIdString(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (/^[a-fA-F0-9]{24}$/.test(trimmed)) return true;
  if (/^[a-zA-Z0-9_-]{15,32}$/.test(trimmed)) {
    const cleanLower = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
    const knownPrograms = [
      'tgfinfo', 'cbtbasic', 'cbtavd', 'offma', 'onma', 'onmahindi', 'kidsshivir',
      'yoga1month', 'nisargdhyan', 'shsh', 'other', 'book', 'incomingcalls', 'general',
      'querydesk', 'reminderdesk', 'existingalumni', 'unassigned'
    ];
    if (knownPrograms.includes(cleanLower)) return false;
    if (/[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed) && /[0-9]/.test(trimmed) && !trimmed.includes(' ')) return true;
    if (/[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed) && trimmed.length >= 18 && !trimmed.includes(' ')) return true;
    if (trimmed.length >= 20 && !trimmed.includes(' ')) return true;
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
    selectedLeadOrigins = [],
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

  const matchesLeadOriginFilter = (leadOrigin) => {
    if (!selectedLeadOrigins || selectedLeadOrigins.length === 0) return true;
    return selectedLeadOrigins.includes(String(leadOrigin || '').trim());
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
    let rawProg = reg.calledFor || reg.programName || reg.calledForKey || reg.programId || '';
    if (isRawIdString(rawProg)) {
      rawProg = reg.programName || reg.calledFor || 'Other';
      if (isRawIdString(rawProg)) rawProg = 'Other';
    }
    const calledForKey = String(rawProg).trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!contactId || !calledForKey) return;

    const regKey = `${contactId}_${calledForKey}`;
    if (seenRegKeys.has(regKey)) return;

    const regDate = reg.registeredAt || reg.updatedAt || reg.createdAt || reg.timestamp || reg.date;
    if (!inDateRange(regDate)) return;

    const contact = (contacts || []).find(c => {
      const cId = String(c.id || c._id || '').trim();
      const cPhone = String(c.Phone || c.phone || c.Mobile || c.mobile || '').trim();
      const regPhone = String(reg.contactPhone || reg.phone || reg.Phone || reg.Mobile || reg.mobile || '').trim();
      const targetId = String(contactId).trim();
      return (cId && cId === targetId) || (cPhone && cPhone === targetId) || (regPhone && cPhone && regPhone === cPhone);
    });

    const resolvedSource = getContactSource(reg) || getContactSource(contact) || '—';
    const resolvedLeadOrigin = getContactLeadOrigin(reg) || getContactLeadOrigin(contact) || '—';

    const attId = reg.attenderId || reg.attender_id || reg.createdBy || '';
    let attName = renderVal(reg.attenderName || reg.assignedTo, 'Unassigned');
    if (isRawIdString(attName)) attName = 'Unassigned';

    let cleanCalledFor = renderVal(reg.calledFor || reg.programName, rawProg);
    if (isRawIdString(cleanCalledFor)) cleanCalledFor = 'Other';

    if (!matchesAttenderFilter(attId, attName, reg.assignedTo)) return;
    if (!matchesProgramFilter(reg.programId, cleanCalledFor, calledForKey)) return;
    if (!matchesSourceFilter(resolvedSource)) return;
    if (!matchesLeadOriginFilter(resolvedLeadOrigin)) return;
    if (!matchesCalledForFilter(cleanCalledFor)) return;

    const resolvedCallType = determineCallType(reg, contact);
    const resolvedCity = getContactCity(contact) || getContactCity(reg) || renderVal(reg.city || reg.City, '—');
    const resolvedKhoji = renderVal(reg.khoji || reg.Khoji || contact?.Khoji || contact?.khoji, '—');

    seenRegKeys.add(regKey);
    result.push({
      id: reg.id || reg._id || regKey,
      contactId,
      calledForKey,
      contactName: getContactName(contact, reg),
      name: getContactName(contact, reg),
      contactPhone: getContactPhone(contact, reg) || '—',
      phone: getContactPhone(contact, reg) || '—',
      contactCity: resolvedCity,
      city: resolvedCity,
      khoji: resolvedKhoji,
      calledFor: cleanCalledFor,
      programName: cleanCalledFor,
      attenderName: attName,
      attender: attName,
      attenderId: attId,
      source: resolvedSource,
      leadOrigin: resolvedLeadOrigin,
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
    if (!contactId) return;

    const isStatusRegDone = (st) => {
      const s = String(st || '').toLowerCase().trim();
      if (s.includes('already reg') || s.includes('shivir done') || s.includes('alumni')) return false;
      return s.includes('reg.done') || s.includes('registered') || s.includes('won');
    };

    // Collect all distinct program contexts present on contact c where registration actually occurred
    const programMap = new Map();

    if (Array.isArray(c.programRelationships)) {
      c.programRelationships.forEach(rel => {
        if (!rel) return;
        const relProg = typeof rel === 'string' ? rel : (rel.program || rel.calledFor || rel.calledForKey || rel['Called For'] || '');
        const relStatus = typeof rel === 'string' ? 'Registered' : (rel.status || (rel.pipelineStage !== 'Existing Alumni' ? rel.pipelineStage : '') || '');
        if (relProg && isStatusRegDone(relStatus) && !isRawIdString(relProg)) {
          const k = String(relProg).trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (k) {
            programMap.set(k, {
              rawCalledFor: relProg,
              date: (typeof rel === 'object' && rel.updatedAt) || c.registeredAt || c.updatedAt || c.lastCalledAt || c.createdAt
            });
          }
        }
      });
    }

    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        if (!h) return;
        const hProg = String(h.calledFor || h.programName || h.calledForKey || '').trim();
        const hStatus = String(h.status || h.callStatus || h.purposeOutcome || (h.pipelineStage !== 'Existing Alumni' ? h.pipelineStage : '') || '').trim();
        if (hProg && isStatusRegDone(hStatus) && !isRawIdString(hProg)) {
          const k = hProg.toLowerCase().replace(/[\s_-]+/g, '');
          if (k && !programMap.has(k)) {
            programMap.set(k, {
              rawCalledFor: hProg,
              date: h.timestamp || h.date || h.createdAt || c.registeredAt || c.updatedAt || c.createdAt
            });
          }
        }
      });
    }

    if (c.attenderStates && typeof c.attenderStates === 'object') {
      Object.values(c.attenderStates).forEach(stObj => {
        if (stObj && typeof stObj === 'object') {
          const stProg = String(stObj.calledFor || stObj.called_for || stObj.calledForKey || stObj.program || stObj.programName || stObj.programId || '').trim();
          const stStatus = String(stObj.status || (stObj.pipelineStage !== 'Existing Alumni' ? stObj.pipelineStage : '') || stObj.purposeOutcome || '').trim();
          if (stProg && isStatusRegDone(stStatus) && !isRawIdString(stProg)) {
            const k = stProg.toLowerCase().replace(/[\s_-]+/g, '');
            if (k && !programMap.has(k)) {
              programMap.set(k, {
                rawCalledFor: stProg,
                date: stObj.updatedAt || stObj.lastCalledAt || c.registeredAt || c.updatedAt || c.createdAt
              });
            }
          }
        }
      });
    }

    const rootCalledFor = String(c.calledFor || c.programName || c['Called For'] || '').trim();
    if (rootCalledFor && !isRawIdString(rootCalledFor)) {
      const k = rootCalledFor.toLowerCase().replace(/[\s_-]+/g, '');
      if (k && (!programMap.has(k) && (programMap.size === 0 || isStatusRegDone(c.status || c.pipelineStage)))) {
        programMap.set(k, {
          rawCalledFor: rootCalledFor,
          date: c.registeredAt || c.updatedAt || c.lastCalledAt || c.createdAt
        });
      }
    }

    programMap.forEach(({ rawCalledFor, date: regDate }, calledForKey) => {
      const regKey = `${contactId}_${calledForKey}`;
      if (seenRegKeys.has(regKey)) return;

      if (!inDateRange(regDate)) return;

      let cleanCalledFor = rawCalledFor;
      if (isRawIdString(cleanCalledFor)) cleanCalledFor = 'Other';

      const resolvedSource = getContactSource(c, cleanCalledFor) || getContactSource(c, calledForKey) || '—';
      const resolvedLeadOrigin = getContactLeadOrigin(c, cleanCalledFor) || getContactLeadOrigin(c, calledForKey) || '—';

      const attId = c.attenderId || c.createdBy || '';
      let attName = renderVal(c.attenderName || c.assignedTo, 'Unassigned');
      if (isRawIdString(attName)) attName = 'Unassigned';

      if (!matchesAttenderFilter(attId, attName, c.assignedTo)) return;
      if (!matchesProgramFilter(c.programId, cleanCalledFor, calledForKey)) return;
      if (!matchesSourceFilter(resolvedSource)) return;
      if (!matchesLeadOriginFilter(resolvedLeadOrigin)) return;
      if (!matchesCalledForFilter(cleanCalledFor)) return;

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
        calledFor: cleanCalledFor,
        programName: cleanCalledFor,
        attenderName: attName,
        attender: attName,
        attenderId: attId,
        source: resolvedSource,
        leadOrigin: resolvedLeadOrigin,
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
