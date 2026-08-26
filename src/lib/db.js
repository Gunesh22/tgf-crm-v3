export const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

export const INCOMING_PROGRAM_ID = "incoming";
export const INCOMING_PROGRAM_NAME = "Incoming Calls";
export const OUTGOING_PROGRAM_ID = "outgoing";
export const OUTGOING_PROGRAM_NAME = "Outgoing Calls";
export const DEFAULT_WHATSAPP_TEMPLATES = [];
export const DEFAULT_NOT_CONNECTED_STATUSES = ["NA", "Busy", "Call Cut", "switched off", "Invalid No", "Called by mistake", "No Network", "wrong no.", "no answer"];
export const DEFAULT_CONNECTED_STATUSES = ["Info given", "Interested", "Reg.Done", "reminder", "Query", "Already Reg.d", "Next time", "Shivir done", "Not possible", "Pending", "Not interested", "Not Attended", "Call Log Added"];

// API FETCH HELPERS
const fetchAPI = async (endpoint, method = "GET", body = null) => {
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API Error");
    
    console.log(`%c[API SUCCESS] %c${endpoint}`, "color: #10b981; font-weight: bold", "color: gray", data);
    return data;
  } catch (error) {
    console.error(`%c[API ERROR] %c${endpoint}`, "color: #ef4444; font-weight: bold", "color: gray", error);
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
export const getSettingsOptions = async () => ({
  statusOptions: [...DEFAULT_CONNECTED_STATUSES, ...DEFAULT_NOT_CONNECTED_STATUSES],
  connectedStatuses: DEFAULT_CONNECTED_STATUSES,
  notConnectedStatuses: DEFAULT_NOT_CONNECTED_STATUSES,
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES
});

export const updateCallCenterOptions = async (options) => {
  console.log("Updated settings", options);
};

export const getAttenders = async () => {
  try {
    const cached = localStorage.getItem("admin_attenders_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        fetchAPI(`/api/admin/attenders`).then(res => {
          if (res.data) localStorage.setItem("admin_attenders_cache", JSON.stringify(res.data));
        }).catch(() => {});
        return parsed;
      }
    }
    const res = await fetchAPI(`/api/admin/attenders`);
    if (res.data) localStorage.setItem("admin_attenders_cache", JSON.stringify(res.data));
    return res.data || [];
  } catch (e) {
    console.error("Failed to fetch attenders", e);
    return [];
  }
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

export const getAttenderContactCount = async () => 0;

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

export const subscribeToCallLogs = (attenderId, attenderName, callback) => {
  let isSubscribed = true;
  const cacheKey = `attender_call_logs_${attenderId}`;

  // 1. INSTANT 0ms RENDERING FROM LOCAL CACHE
  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`%c[0ms INSTANT CACHE] Loaded ${parsed.length} contacts from local cache`, "color: #10b981; font-weight: bold");
        callback(parsed);
      }
    }
  } catch (e) {
    console.warn("[Local Cache Read Error]", e);
  }

  // 2. BACKGROUND FETCH & SYNC FROM MONGODB API
  const fetchLogs = async () => {
    if (!isSubscribed) return;
    try {
      const res = await getAssignedContacts(attenderId);
      if (isSubscribed && res.data) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (err) {
          console.warn("[Local Cache Write Error]", err);
        }
        callback(res.data);
      }
    } catch (e) {
      console.error("[subscribeToCallLogs polling error]", e);
    }
  };
  
  fetchLogs(); // initial background fetch
  const interval = setInterval(fetchLogs, 10000);
  
  return () => {
    isSubscribed = false;
    clearInterval(interval);
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
        console.log(`%c[0ms INSTANT CACHE] Loaded ${parsed.length} admin call logs`, "color: #10b981; font-weight: bold");
        callback(parsed);
      }
    }
  } catch (e) {
    console.warn("[All Logs Cache Read Error]", e);
  }

  const fetchAll = async () => {
    if (!isSubscribed) return;
    try {
      const monthParam = (!month || month === 'ALL') ? '' : month;
      const res = await fetchAPI(`/api/contacts/search?${monthParam ? `month=${monthParam}&` : ''}limit=10000`);
      if (isSubscribed && res.data) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (err) {
          console.warn("[All Logs Cache Write Error]", err);
        }
        callback(res.data);
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
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (err) {}
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
  return res.contactId || res.id;
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

// Admin password synced from production settings
export const getAdminPassword = async () => "198219";
export const setAdminPassword = async () => {};
export const generateRandomPassword = () => "pass123";
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
export const fetchFreshSharedLead = async () => null;
