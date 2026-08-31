export const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

export const INCOMING_PROGRAM_ID = "incoming";
export const INCOMING_PROGRAM_NAME = "Incoming Calls";
export const OUTGOING_PROGRAM_ID = "outgoing";
export const OUTGOING_PROGRAM_NAME = "Outgoing Calls";
export const DEFAULT_WHATSAPP_TEMPLATES = [];
export const DEFAULT_NOT_CONNECTED_STATUSES = ["NA", "Busy", "Call Cut", "switched off", "Invalid No", "Called by mistake", "No Network", "wrong no.", "no answer"];
export const DEFAULT_CONNECTED_STATUSES = ["Info given", "Interested", "Reg.Done", "reminder", "Query", "Already Reg.d", "Next time", "Shivir done", "Not possible", "Pending", "Not interested", "Not Attended", "Call Log Added"];



// API FETCH HELPERS
export const fetchAPI = async (endpoint, method = "GET", body = null) => {
  console.log(`%c[API CALL] %c${method} %c${endpoint}`, "color: #3b82f6; font-weight: bold", "color: #10b981; font-weight: bold", "color: gray");
  if (body) {
    console.log("%c[PAYLOAD]", "color: #f59e0b; font-weight: bold", body);
  }

  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) options.body = JSON.stringify(body);
  
  try {
    const res = await fetch(endpoint, options);
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { error: `Server error (${res.status})` };
      }
    }
    if (!res.ok) throw new Error(data.error || data.message || `API Error (${res.status})`);
    
    console.log(`%c[API SUCCESS] %c${endpoint}`, "color: #10b981; font-weight: bold", "color: gray", data);
    return data;
  } catch (error) {
    console.error(`%c[API ERROR] %c${endpoint}`, "color: #ef4444; font-weight: bold", "color: gray", error.message || error);
    throw error;
  }
};

// CONTACTS API
export const getAssignedContacts = async (attenderId) => {
  return fetchAPI(`/api/contacts/get-assigned?attenderId=${attenderId}`);
};

export const searchAttenderContacts = async (attenderId, query, limit = 50) => {
  return fetchAPI(`/api/contacts/search?attenderId=${attenderId}&search=${encodeURIComponent(query)}&limit=${limit}`);
};

export const globalSearchContacts = async (query) => {
  return fetchAPI(`/api/contacts/search?search=${encodeURIComponent(query)}&limit=100`);
};

export const updateCallLog = async (contactId, updates = {}, attenderId, attenderName, context = {}) => {
  return fetchAPI(`/api/contacts/log-call`, "POST", {
    contactId,
    attenderId,
    attenderName,
    status: updates.status,
    remark: updates.remark,
    callbackDate: updates.callbackDate,
    calledFor: updates.calledFor || updates["Called For"] || context.calledFor || "",
    ...updates
  });
};

export const undoCallLog = async (contactId, attenderId, historyId) => {
  return fetchAPI(`/api/contacts/undo-call`, "POST", { contactId, attenderId, historyId });
};

export const importContacts = async (arg1, arg2, arg3, arg4) => {
  let contactsList = [];
  let programId = "";
  let programName = "";
  let tags = [];

  if (Array.isArray(arg1)) {
    contactsList = arg1;
  } else if (Array.isArray(arg3)) {
    programId = arg1;
    programName = arg2;
    contactsList = arg3;
    tags = arg4 || [];
  } else {
    contactsList = arg1 || [];
  }

  const enriched = contactsList.map(c => ({
    ...c,
    programId: c.programId || programId,
    source: c.source || c.Source || programName || "Excel Import",
    tags: c.tags || tags
  }));

  const res = await fetchAPI(`/api/contacts/import-bulk`, "POST", { contacts: enriched });
  return (res.upsertedCount || 0) + (res.matchedCount || 0);
};

// ADMIN API
export const reassignContactsBetweenAttenders = async (fromId, toId, programId, status, count) => {
  return fetchAPI(`/api/admin/reassign`, "POST", { fromId, toId, programId, status, count });
};

export const reassignContactsToPool = async (fromId, programId, status, count) => {
  return fetchAPI(`/api/admin/reassign`, "POST", { fromId, toId: "pool", programId, status, count });
};

export const getProgramContactStats = async (programId) => {
  try {
    const res = await fetchAPI(`/api/admin/stats${programId ? `?programId=${encodeURIComponent(programId)}` : ''}`);
    return res.stats || {};
  } catch (e) {
    return {};
  }
};

// ============================================
// ATTENDERS & PROGRAMS BACKEND INTEGRATION
// ============================================
let settingsCache = null;
let settingsFetchPromise = null;

const applyDynamicOptions = async (data) => {
  if (!data) return;
  try {
    const utils = await import("../features/attender/utils.js");
    if (utils && utils.updateDynamicOptions) {
      utils.updateDynamicOptions(data);
    }
  } catch (e) {}
};

export const getSettingsOptions = async (opts = {}) => {
  const forceRefresh = Boolean(opts && opts.forceRefresh);

  if (settingsCache && !forceRefresh) {
    return settingsCache;
  }

  if (settingsFetchPromise && !forceRefresh) {
    return settingsFetchPromise;
  }

  settingsFetchPromise = (async () => {
    try {
      const res = await fetchAPI(`/api/admin/settings`);
      if (res && res.data) {
        settingsCache = res.data;
        applyDynamicOptions(res.data);
        return res.data;
      }
    } catch (e) {
      console.error("Failed to fetch settings from DB, using defaults", e);
    } finally {
      settingsFetchPromise = null;
    }

    const fallback = {
      statusOptions: [...DEFAULT_CONNECTED_STATUSES, ...DEFAULT_NOT_CONNECTED_STATUSES],
      connectedStatuses: DEFAULT_CONNECTED_STATUSES,
      notConnectedStatuses: DEFAULT_NOT_CONNECTED_STATUSES,
      whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES
    };
    settingsCache = fallback;
    return fallback;
  })();

  return settingsFetchPromise;
};

export const updateCallCenterOptions = async (options) => {
  const res = await fetchAPI(`/api/admin/settings`, "POST", options);
  if (res && res.data) {
    settingsCache = res.data;
    applyDynamicOptions(res.data);
  }
  return res;
};

export const getAttenders = async () => {
  try {
    const res = await fetchAPI(`/api/admin/attenders`);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      localStorage.setItem("admin_attenders_cache", JSON.stringify(res.data));
      return res.data;
    }
  } catch (e) {
    console.error("Failed to fetch fresh attenders, falling back to cache", e);
  }
  try {
    const cached = localStorage.getItem("admin_attenders_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
};

export const createAttender = async (name, password) => {
  return fetchAPI(`/api/admin/attenders`, "POST", { name, password });
};

export const updateAttender = async (id, updates) => {
  return fetchAPI(`/api/admin/attenders`, "PUT", { id, ...(typeof updates === 'object' ? updates : {}) });
};

export const deleteAttender = async (id) => {
  return fetchAPI(`/api/admin/attenders?id=${encodeURIComponent(id)}`, "DELETE");
};

export const getAttenderContactCount = async (attenderId) => {
  if (!attenderId) return 0;
  try {
    const res = await fetchAPI(`/api/admin/attenders?countId=${encodeURIComponent(attenderId)}`);
    return typeof res?.count === 'number' ? res.count : 0;
  } catch (e) {
    console.error("Failed to fetch attender contact count", e);
    return 0;
  }
};

export const getPrograms = async () => {
  try {
    const cached = localStorage.getItem("admin_programs_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        fetchAPI(`/api/admin/programs`).then(res => {
          if (res.data) localStorage.setItem("admin_programs_cache", JSON.stringify(res.data));
        }).catch(() => {});
        return parsed;
      }
    }
    const res = await fetchAPI(`/api/admin/programs`);
    if (res.data) localStorage.setItem("admin_programs_cache", JSON.stringify(res.data));
    return res.data || [];
  } catch (e) {
    console.error("Failed to fetch programs", e);
    return [];
  }
};

export const createProgram = async (name) => {
  const res = await fetchAPI(`/api/admin/programs`, "POST", { name });
  return res.id || (res.data && res.data.id) || "prog_" + Date.now();
};

export const deleteProgram = async (id) => {
  return fetchAPI(`/api/admin/programs?id=${encodeURIComponent(id)}`, "DELETE");
};

export const getProgramChunkContacts = async () => [];
export const remapProgramContacts = async () => {};
export const getProgramCallLogs = async () => [];

export const getRegistrationMonths = async () => [];
export const getActiveCacheMonths = async () => [];
export const getLockedMonthlyReports = async () => [];
export const exportCallCenterCacheToJson = async () => {};

const memoryCache = new Map();
const activeSubscriptionTimers = new Map();

function createLightweightCache(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts.map(c => {
    if (!c) return c;
    const history = Array.isArray(c.history) ? c.history.slice(-5) : [];
    return {
      ...c,
      history
    };
  });
}

export function safeSetLocalStorage(key, data) {
  try {
    const lightweight = createLightweightCache(data);
    const serialized = JSON.stringify(lightweight);
    localStorage.setItem(key, serialized);
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014 || String(err).includes('quota'))) {
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if ((k.startsWith('attender_call_logs_') || k.startsWith('all_call_logs_') || k.startsWith('registrations_cache_')) && k !== key) {
            localStorage.removeItem(k);
          }
        }
        const lightweight = createLightweightCache(data);
        localStorage.setItem(key, JSON.stringify(lightweight));
      } catch (retryErr) {
        // Silently handle if storage is full or disabled
      }
    }
  }
}

export const subscribeToCallLogs = (attenderId, attenderName, callback, onError) => {
  if (!attenderId) return () => {};

  let isSubscribed = true;
  let lastDataJson = null;
  const cacheKey = `attender_call_logs_${attenderId}`;

  // 1. INSTANT 0ms RENDERING FROM IN-MEMORY CACHE OR LOCAL STORAGE
  let cacheLoaded = false;
  
  if (memoryCache.has(attenderId)) {
    const cachedMemory = memoryCache.get(attenderId);
    if (Array.isArray(cachedMemory) && cachedMemory.length > 0) {
      console.log(`%c[0ms MEMORY CACHE] Loaded ${cachedMemory.length} contacts for ${attenderName || attenderId}`, "color: #10b981; font-weight: bold");
      lastDataJson = JSON.stringify(cachedMemory);
      callback(cachedMemory);
      cacheLoaded = true;
    }
  }

  if (!cacheLoaded) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`%c[0ms LOCAL CACHE] Loaded ${parsed.length} contacts from local storage`, "color: #10b981; font-weight: bold");
          lastDataJson = JSON.stringify(parsed);
          callback(parsed);
          cacheLoaded = true;
        }
      }
    } catch (e) {
      console.warn("[Local Cache Read Error]", e);
    }
  }

  // Clear existing active interval for this attender if present
  if (activeSubscriptionTimers.has(attenderId)) {
    clearInterval(activeSubscriptionTimers.get(attenderId));
    activeSubscriptionTimers.delete(attenderId);
  }

  // 2. BACKGROUND FETCH & SYNC FROM MONGODB API
  const fetchLogs = async () => {
    if (!isSubscribed) return;
    try {
      const res = await getAssignedContacts(attenderId);
      if (isSubscribed) {
        const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        memoryCache.set(attenderId, data);

        const newJson = JSON.stringify(data);
        if (newJson !== lastDataJson) {
          lastDataJson = newJson;
          safeSetLocalStorage(cacheKey, data);
          callback(data);
        }
      }
    } catch (e) {
      console.error("[subscribeToCallLogs polling error]", e);
      if (isSubscribed) {
        if (!cacheLoaded) {
          const mem = memoryCache.get(attenderId) || [];
          callback(mem);
        }
        if (onError && !cacheLoaded) {
          onError(e);
        }
      }
    }
  };
  
  fetchLogs(); // initial background fetch
  const interval = setInterval(fetchLogs, 30000);
  activeSubscriptionTimers.set(attenderId, interval);
  
  return () => {
    isSubscribed = false;
    if (activeSubscriptionTimers.get(attenderId) === interval) {
      clearInterval(interval);
      activeSubscriptionTimers.delete(attenderId);
    }
  };
};

export const subscribeToAllCallLogs = (programId, month, callback) => {
  let isSubscribed = true;
  const cacheKey = `all_call_logs_${programId || 'all'}_${month || 'all'}`;

  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`%c[PREVIEW CACHE] Loaded ${parsed.length} admin call logs (preview)`, "color: #10b981; font-weight: bold");
        callback(parsed, false);
      }
    }
  } catch (e) {
    console.warn("[All Logs Cache Read Error]", e);
  }

  const fetchAll = async () => {
    if (!isSubscribed) return;
    try {
      const monthParam = (!month || month === 'ALL') ? '' : month;
      const res = await fetchAPI(`/api/contacts/search?includeHistory=true&${monthParam ? `month=${monthParam}&` : ''}limit=15000`);
      if (isSubscribed && res.data) {
        safeSetLocalStorage(cacheKey, res.data);
        callback(res.data, true);
      }
    } catch (e) {
      console.error("[subscribeToAllCallLogs polling error]", e);
    }
  };
  
  fetchAll();
  
  return () => {
    isSubscribed = false;
  };
};

export const subscribeToRegistrations = (programId, callback) => {
  let isSubscribed = true;
  const cacheKey = `registrations_cache_${programId || 'all'}`;

  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed);
      }
    }
  } catch (e) {}

  const fetchRegs = async () => {
    if (!isSubscribed) return;
    try {
      const res = await fetchAPI(`/api/registrations`);
      if (isSubscribed && res.data) {
        safeSetLocalStorage(cacheKey, res.data);
        callback(res.data);
      }
    } catch (e) {
      console.error("[subscribeToRegistrations polling error]", e);
    }
  };
  
  fetchRegs();
  
  return () => {
    isSubscribed = false;
  };
};

export const addIncomingCallLog = async (attenderId, attenderName, updates = {}, programId = "incoming", programName = "Incoming Calls") => {
  const payload = {
    attenderId,
    attenderName,
    programId,
    programName,
    ...updates
  };
  const res = await fetchAPI(`/api/contacts/create-incoming`, "POST", payload);
  if (res && typeof res === 'object') {
    res.id = res.contactId || res.id;
  }
  return res;
};

export const overridePipelineStage = async (contactId, newStage, attenderId, attenderName, role = "attender", reason = "") => {
  const payload = {
    contactId,
    newStage,
    changedByAttenderId: attenderId,
    changedBy: attenderName,
    role,
    reason
  };
  return fetchAPI(`/api/contacts/override-stage`, "POST", payload);
};

export const ensureIncomingProgram = async () => {};
export const ensureOutgoingProgram = async () => {};
export const getActiveTags = async () => [];
export const checkGlobalDuplicate = async (phone, excludeId = null) => {
  if (!phone) return null;
  const cleanPhone = String(phone).replace(/\D/g, "");
  if (cleanPhone.length < 10) return null;
  const last10 = cleanPhone.slice(-10);

  // 1. INSTANT 0ms DUP CHECK FROM LOCAL CACHE
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('attender_call_logs_') || k.startsWith('all_call_logs_'));
    for (const key of keys) {
      const cached = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(cached)) {
        const localMatch = cached.find(m => {
          if (excludeId && (m.id === excludeId || m._id === excludeId)) return false;
          const p = String(m.Phone || m.phone || m.Mobile || m.mobile || "").replace(/\D/g, "");
          return p.endsWith(last10);
        });
        if (localMatch) {
          console.log(`%c[0ms DUP MATCH FROM LOCAL CACHE] %cFound duplicate for ${last10}`, "color: #10b981; font-weight: bold", "color: inherit", localMatch);
          return {
            count: 1,
            allTags: Array.isArray(localMatch.tags) ? localMatch.tags : (localMatch.Tags ? [localMatch.Tags] : []),
            matches: [localMatch],
            first: localMatch,
            programName: localMatch.programName || localMatch.programId
          };
        }
      }
    }
  } catch (e) {}

  // 2. ULTRA-FAST GLOBAL DATABASE QUERY (<20ms)
  try {
    const url = `/api/contacts/check-duplicate?phone=${encodeURIComponent(last10)}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''}`;
    const res = await fetchAPI(url);
    if (res && res.success && res.matches && res.matches.length > 0) {
      console.log(`%c[INSTANT GLOBAL DUP FOUND] %cMatched ${res.matches.length} contact(s) across database for ${last10}`, "color: #f59e0b; font-weight: bold", "color: inherit", res);
      return res;
    }
    return null;
  } catch (err) {
    console.error("[checkGlobalDuplicate error]", err);
    return null;
  }
};

// Database-backed Admin Authentication & Security
export const setAdminPassword = async (newPassword, currentPassword) => {
  return fetchAPI(`/api/admin/admin-auth`, "POST", {
    action: "change-password",
    currentPassword,
    newPassword
  });
};

export const generateRandomPassword = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
export const runAutoLockAndPurgeCheck = async () => {};

export const findMatchingAttenderState = (attenderStates, attenderId, attenderName) => {
  if (!attenderStates || typeof attenderStates !== "object") return null;
  if (attenderId && attenderStates[attenderId]) return attenderStates[attenderId];
  
  const keys = Object.keys(attenderStates);
  if (attenderId) {
    const keyMatch = keys.find(k => k.toLowerCase() === String(attenderId).toLowerCase());
    if (keyMatch) return attenderStates[keyMatch];
  }
  if (attenderName) {
    const nameMatch = keys.find(k => {
      const st = attenderStates[k];
      return st && st.attenderName && String(st.attenderName).toLowerCase().trim() === String(attenderName).toLowerCase().trim();
    });
    if (nameMatch) return attenderStates[nameMatch];
  }
  return null;
};
export const combineContactHistories = (h1 = [], h2 = []) => [...(h1 || []), ...(h2 || [])];
export const isLeadShared = () => false;
export const assignContactsToAttender = async () => {};
export const claimContact = async () => {};
export const removeAttenderFromContact = async () => {};
export const claimCRMContact = async () => {};
export const getSingleContact = async (contactIdOrPhone) => {
  if (!contactIdOrPhone) return null;
  try {
    const cleanStr = String(contactIdOrPhone).trim();
    const isPhone = /^\+?\d{7,15}$/.test(cleanStr.replace(/[\s-]/g, ''));
    const param = isPhone ? `phone=${encodeURIComponent(cleanStr)}` : `id=${encodeURIComponent(cleanStr)}`;
    const res = await fetchAPI(`/api/contacts/get-single?${param}`);
    return (res && res.success) ? res.data : null;
  } catch (err) {
    console.error(`[DB] Failed to fetch single contact:`, err);
    return null;
  }
};

export const fetchFreshSharedLead = async (row, attenderId, attenderName, force = false) => {
  const contactId = row?.id || row?.contactId || row?._id;
  const phone = row?.Phone || row?.phone || row?.Mobile || row?.mobile;
  if (!contactId && !phone) return null;
  return getSingleContact(contactId || phone);
};
