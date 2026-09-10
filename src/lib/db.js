import { normalizeProgramStates } from "../utils/pipelineEngine.js";

export const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

export const INCOMING_PROGRAM_ID = "incoming";
export const INCOMING_PROGRAM_NAME = "Incoming Calls";
export const OUTGOING_PROGRAM_ID = "outgoing";
export const OUTGOING_PROGRAM_NAME = "Outgoing Calls";
export const DEFAULT_WHATSAPP_TEMPLATES = [];
export const DEFAULT_NOT_CONNECTED_STATUSES = ["Not Connected", "NA", "Busy", "Call Cut", "switched off", "Invalid Number", "Invalid No", "Called by mistake", "No Network", "wrong no.", "no answer", "Not Picked Up"];
export const DEFAULT_CONNECTED_STATUSES = ["Info Given", "Info given", "Interested", "Previous Program Pending", "Reg.Done", "reminder", "Reminder Given", "Reminder Pending", "Query", "Already Reg.d", "Next Time", "Next time", "Shivir done", "Not possible", "Pending", "Not Interested", "Not interested", "Not Attended", "Call Log Added"];
export const DEFAULT_SALES_OUTCOME_OPTIONS = [
  "Info Given",
  "Interested",
  "Previous Program Pending",
  "Next Time",
  "Not Interested",
  "Reg.Done",
  "Already Reg.d",
  "Shivir done"
];



// API FETCH HELPERS
export const fetchAPI = async (endpoint, method = "GET", body = null, extraOptions = {}) => {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...extraOptions
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
    if (res.status === 401) {
      if (typeof window !== "undefined" && !endpoint.includes('/api/auth/login')) {
        window.dispatchEvent(new CustomEvent('crm_unauthorized'));
      }
    }
    if (!res.ok) throw new Error(data.error || data.message || `API Error (${res.status})`);
    
    return data;
  } catch (error) {
    if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
      // Ignore silent fetch aborts
    } else if (error?.message?.includes("Unauthorized") || error?.message?.includes("401")) {
      // Handled via session verification
    } else {
      console.error(`[API ERROR] ${endpoint}:`, error.message || error);
    }
    throw error;
  }
};


// CONTACTS API
export const getAssignedContacts = async (attenderId, options = {}) => {
  const { signal, attenderName, purpose = 'initial_mount', device = 'desktop' } = options;
  const nameQuery = attenderName ? `&attenderName=${encodeURIComponent(attenderName)}` : '';
  const tagQuery = `&purpose=${purpose}&device=${device}`;
  return fetchAPI(`/api/contacts/get-assigned?attenderId=${attenderId}${nameQuery}${tagQuery}`, "GET", null, signal ? { signal } : {});
};

export const searchAttenderContacts = async (attenderId, query, limit = 50) => {
  return fetchAPI(`/api/contacts/search?attenderId=${attenderId}&search=${encodeURIComponent(query)}&limit=${limit}`);
};

export const globalSearchContacts = async (query) => {
  return fetchAPI(`/api/contacts/search?search=${encodeURIComponent(query)}&limit=100`);
};

export const updateCallLog = async (contactId, updates = {}, attenderId, attenderName, context = {}) => {
  const resolvedCalledFor = updates.calledFor || updates["Called For"] || context.calledFor || context["Called For"] || "";
  return fetchAPI(`/api/contacts/log-call`, "POST", {
    contactId,
    attenderId,
    attenderName,
    status: updates.status,
    remark: updates.remark,
    callbackDate: updates.callbackDate,
    ...updates,
    calledFor: resolvedCalledFor
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

  const enriched = contactsList.map(c => {
    const leadOrigin = c.leadOrigin || c.original_source || c.originalSource || "";
    const currentSource = c.source || c.currentSource || c.callSource || c.Source || "";
    return {
      ...c,
      programId: c.programId || programId,
      leadOrigin,
      source: currentSource,
      tags: c.tags || tags
    };
  });

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
const SETTINGS_CACHE_KEY = "crm_settings_options_cache";
let settingsCache = null;
let settingsFetchPromise = null;
let lastSettingsFetchTime = 0;
const settingsListeners = new Set();

export const subscribeToSettingsOptions = (callback) => {
  if (typeof callback !== "function") return () => {};
  settingsListeners.add(callback);
  if (settingsCache) {
    try {
      callback(settingsCache);
    } catch (e) {}
  }
  return () => {
    settingsListeners.delete(callback);
  };
};

const notifySettingsListeners = (data) => {
  if (!data) return;
  settingsListeners.forEach(cb => {
    try {
      cb(data);
    } catch (e) {
      console.error("Settings listener error:", e);
    }
  });
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("crm_settings_updated", { detail: data }));
    } catch (e) {}
  }
};

// Initialize settingsCache immediately from persistent local cache if present
try {
  const localSettings = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_CACHE_KEY) : null;
  if (localSettings) {
    settingsCache = JSON.parse(localSettings);
    if (settingsCache && !settingsCache.salesOutcomeOptions) {
      settingsCache.salesOutcomeOptions = DEFAULT_SALES_OUTCOME_OPTIONS;
    }
  }
} catch (e) {}

const applyDynamicOptions = async (data) => {
  if (!data) return;
  try {
    const utils = await import("../features/attender/utils.js");
    if (utils && utils.updateDynamicOptions) {
      utils.updateDynamicOptions(data);
    }
  } catch (e) {}
};

// Immediately apply local cached settings on startup for instant 0ms availability
if (settingsCache) {
  applyDynamicOptions(settingsCache);
}

const fetchAndSyncSettings = async () => {
  try {
    const res = await fetchAPI(`/api/admin/settings`);
    if (res && res.data) {
      if (!res.data.salesOutcomeOptions) {
        res.data.salesOutcomeOptions = DEFAULT_SALES_OUTCOME_OPTIONS;
      }
      lastSettingsFetchTime = Date.now();
      settingsCache = res.data;
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(res.data));
        }
      } catch (e) {}
      await applyDynamicOptions(res.data);
      notifySettingsListeners(res.data);
      return res.data;
    }
  } catch (e) {
    if (!e?.message?.includes("Unauthorized") && !e?.message?.includes("401")) {
      console.error("Failed to fetch settings from DB, using fallback/cache", e);
    }
  } finally {
    settingsFetchPromise = null;
  }

  if (settingsCache) return settingsCache;

  const fallback = {
    statusOptions: [...DEFAULT_CONNECTED_STATUSES, ...DEFAULT_NOT_CONNECTED_STATUSES],
    salesOutcomeOptions: DEFAULT_SALES_OUTCOME_OPTIONS,
    connectedStatuses: DEFAULT_CONNECTED_STATUSES,
    notConnectedStatuses: DEFAULT_NOT_CONNECTED_STATUSES,
    sourceOptions: DEFAULT_SOURCE_OPTIONS,
    calledForOptions: DEFAULT_CALLED_FOR_OPTIONS,
    whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES
  };
  settingsCache = fallback;
  await applyDynamicOptions(fallback);
  notifySettingsListeners(fallback);
  return fallback;
};

export const getSettingsOptions = async (opts = {}) => {
  const forceRefresh = Boolean(opts && opts.forceRefresh);
  const now = Date.now();
  const isStale = forceRefresh || (now - lastSettingsFetchTime > 15000);

  // If memory cache exists and forceRefresh is not requested: return 0ms immediately,
  // and trigger a background revalidation if stale
  if (settingsCache && !forceRefresh) {
    applyDynamicOptions(settingsCache);
    if (isStale && !settingsFetchPromise) {
      settingsFetchPromise = fetchAndSyncSettings();
    }
    return settingsCache;
  }

  // If local storage has it, use it for 0ms return, and trigger background revalidation if stale
  try {
    const cachedStr = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_CACHE_KEY) : null;
    if (cachedStr && !forceRefresh) {
      const parsed = JSON.parse(cachedStr);
      if (parsed && typeof parsed === "object") {
        if (!parsed.salesOutcomeOptions) {
          parsed.salesOutcomeOptions = DEFAULT_SALES_OUTCOME_OPTIONS;
        }
        settingsCache = parsed;
        applyDynamicOptions(parsed);
        if (isStale && !settingsFetchPromise) {
          settingsFetchPromise = fetchAndSyncSettings();
        }
        return parsed;
      }
    }
  } catch (e) {}

  if (settingsFetchPromise && !forceRefresh) {
    return settingsFetchPromise;
  }

  settingsFetchPromise = fetchAndSyncSettings();
  return settingsFetchPromise;
};

// Eager background sync on client startup
if (typeof window !== "undefined") {
  setTimeout(() => {
    getSettingsOptions().catch(() => {});
  }, 100);
}

export const updateCallCenterOptions = async (options) => {
  // Update memory and local cache immediately before API call so UI updates with 0ms delay!
  if (settingsCache) {
    settingsCache = { ...settingsCache, ...options };
  } else {
    settingsCache = { ...options };
  }
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settingsCache));
    }
  } catch (e) {}
  await applyDynamicOptions(settingsCache);
  notifySettingsListeners(settingsCache);

  const res = await fetchAPI(`/api/admin/settings`, "POST", options);
  if (res && res.data) {
    settingsCache = res.data;
    lastSettingsFetchTime = Date.now();
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(res.data));
      }
    } catch (e) {}
    await applyDynamicOptions(res.data);
    notifySettingsListeners(res.data);
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
    if (!e?.message?.includes("Unauthorized") && !e?.message?.includes("401")) {
      console.error("Failed to fetch fresh attenders, falling back to cache", e);
    }
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
    if (!e?.message?.includes("Unauthorized") && !e?.message?.includes("401")) {
      console.error("Failed to fetch attender contact count", e);
    }
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
    if (!e?.message?.includes("Unauthorized") && !e?.message?.includes("401")) {
      console.error("Failed to fetch programs", e);
    }
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

export const subscribeToCallLogs = (attenderId, nameOrCb, cbOrErr, optionalErr) => {
  if (!attenderId) return () => {};

  const attenderName = typeof nameOrCb === 'string' ? nameOrCb : (typeof attenderId === 'string' ? attenderId : '');
  const callback = typeof nameOrCb === 'function' ? nameOrCb : (typeof cbOrErr === 'function' ? cbOrErr : () => {});
  const onError = typeof cbOrErr === 'function' && typeof nameOrCb === 'string' ? cbOrErr : optionalErr;

  let isSubscribed = true;
  const controller = new AbortController();
  let lastDataJson = null;
  const cacheKey = `attender_call_logs_${attenderId}`;

  const normalizeList = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map(c => normalizeProgramStates(c));
  };

  // 1. INSTANT 0ms RENDERING FROM IN-MEMORY CACHE OR LOCAL STORAGE
  let cacheLoaded = false;
  
  if (memoryCache.has(attenderId)) {
    const cachedMemory = memoryCache.get(attenderId);
    if (Array.isArray(cachedMemory) && cachedMemory.length > 0) {
      const normMem = normalizeList(cachedMemory);
      lastDataJson = JSON.stringify(normMem);
      callback(normMem);
      cacheLoaded = true;
    }
  }

  if (!cacheLoaded) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normParsed = normalizeList(parsed);
          lastDataJson = JSON.stringify(normParsed);
          callback(normParsed);
          cacheLoaded = true;
        }
      }
    } catch (e) {
    }
  }

  // 2. INITIAL NETWORK FETCH FROM MONGODB API (Runs ONCE on mount)
  const fetchLogs = async () => {
    if (!isSubscribed || controller.signal.aborted) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await getAssignedContacts(attenderId, { signal: controller.signal, attenderName, purpose: 'initial_mount', device: 'desktop' });
      if (isSubscribed && !controller.signal.aborted) {
        const rawData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const data = normalizeList(rawData);
        memoryCache.set(attenderId, data);

        const newJson = JSON.stringify(data);
        if (newJson !== lastDataJson) {
          lastDataJson = newJson;
          safeSetLocalStorage(cacheKey, data);
          callback(data);
        }
      }
    } catch (e) {
      if (e?.name === "AbortError" || e?.message?.includes("aborted") || controller.signal.aborted) {
        return;
      }
      console.error("[subscribeToCallLogs error]", e);
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
  
  fetchLogs(); // Initial load from MongoDB on mount

  return () => {
    isSubscribed = false;
    controller.abort();
  };
};

export const subscribeToAllCallLogs = (programId, month, callback, forceRefresh = false, includeHistory = false) => {
  let isSubscribed = true;
  const cacheKey = `all_call_logs_${programId || 'all'}_${month || 'all'}`;

  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed, false);
      }
    }
  } catch (e) {
  }

  const fetchAll = async () => {
    if (!isSubscribed) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const monthParam = (!month || month === 'ALL') ? '' : month;
      const historyParam = includeHistory ? '&includeHistory=true' : '';
      const res = await fetchAPI(`/api/contacts/search?${monthParam ? `month=${monthParam}&` : ''}limit=10000${historyParam}`);
      if (isSubscribed && res.data) {
        safeSetLocalStorage(cacheKey, res.data);
        callback(res.data, true);
      }
    } catch (e) {
      if (!e?.message?.includes("Unauthorized") && !e?.message?.includes("401")) {
        console.error("[subscribeToAllCallLogs polling error]", e);
      }
    }
  };
  
  fetchAll();
  
  return () => {
    isSubscribed = false;
  };
};

export const subscribeToRegistrations = (programId, month, callback) => {
  let isSubscribed = true;
  if (typeof month === 'function') {
    callback = month;
    month = 'ALL';
  }
  const targetMonth = month || 'ALL';
  const cacheKey = `registrations_cache_${programId || 'all'}_${targetMonth}`;

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
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const monthParam = (!targetMonth || targetMonth === 'ALL') ? '' : targetMonth;
      const res = await fetchAPI(`/api/registrations${monthParam ? `?month=${monthParam}` : ''}`);
      if (isSubscribed && res.data) {
        safeSetLocalStorage(cacheKey, res.data);
        callback(res.data);
      }
    } catch (e) {
      if (!e?.message?.includes("Unauthorized") && !e?.message?.includes("401")) {
        console.error("[subscribeToRegistrations polling error]", e);
      }
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

export const overridePipelineStage = async (contactId, newStage, attenderId, attenderName, role = "attender", reason = "", program = "") => {
  const payload = {
    contactId,
    newStage,
    changedByAttenderId: attenderId,
    changedBy: attenderName,
    role,
    reason,
    program
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
      return res;
    }
    return null;
  } catch (err) {
    console.error("[checkGlobalDuplicate error]", err);
    return null;
  }
};

export const syncGhlTagsForLead = async (contactId, phone, ghlTags = null) => {
  if (!contactId && !phone) return null;
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  if (!contactId && (!last10 || last10.length < 10)) return null;

  try {
    const res = await fetchAPI('/api/contacts/sync-ghl-tags', 'POST', {
      contactId: contactId || null,
      phone: last10 || phone,
      ghlTags: Array.isArray(ghlTags) ? ghlTags : null
    });
    return res;
  } catch (err) {
    console.warn('[syncGhlTagsForLead error]', err);
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
export function updateLocalContactCache(contact) {
  if (!contact || typeof contact !== 'object') return;
  const normalized = normalizeProgramStates(contact);
  const contactId = String(normalized._id || normalized.id || "");
  const phone = String(normalized.Phone || normalized.phone || normalized.Mobile || normalized.mobile || "");

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("attender_call_logs_")) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let modified = false;
          const newList = list.map(item => {
            const iId = String(item._id || item.id || "");
            const iPhone = String(item.Phone || item.phone || item.Mobile || item.mobile || "");
            if ((contactId && iId === contactId) || (phone && iPhone === phone)) {
              modified = true;
              return { ...item, ...normalized };
            }
            return item;
          });
          if (modified) {
            safeSetLocalStorage(key, newList);
          }
        }
      }
    }
  } catch (e) {
    console.warn("[DB Cache Sync Error]", e);
  }
}

export const getSingleContact = async (contactIdOrPhone) => {
  if (!contactIdOrPhone) return null;
  try {
    const cleanStr = String(contactIdOrPhone).trim();
    const isPhone = /^\+?\d{7,15}$/.test(cleanStr.replace(/[\s-]/g, ''));
    const param = isPhone ? `phone=${encodeURIComponent(cleanStr)}` : `id=${encodeURIComponent(cleanStr)}`;
    const res = await fetchAPI(`/api/contacts/get-single?${param}`);
    if (res && res.success && res.data) {
      const norm = normalizeProgramStates(res.data);
      updateLocalContactCache(norm);
      return norm;
    }
    return null;
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
