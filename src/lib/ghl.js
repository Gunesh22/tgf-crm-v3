const callGhlApiProxy = async (endpoint, method = "POST", payload = null, params = null, signal = null) => {
  try {
    const proxyRes = await fetch("/api/ghl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, method, payload, params }),
      signal,
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.configured === false) {
        throw new Error(data.error || "GHL not configured");
      }
      return data;
    } else {
      throw new Error(`GHL Proxy status ${proxyRes.status}: ${proxyRes.statusText}`);
    }
  } catch (e) {
    throw e;
  }
};

let pendingTestConnectionPromise = null;
let lastUnconfiguredResult = null;
let lastUnconfiguredTimestamp = 0;
const CACHE_TTL_MS = 60000;

export const testConnection = async (bypassCache = false) => {
  const now = Date.now();
  if (bypassCache) {
    lastUnconfiguredResult = null;
    lastUnconfiguredTimestamp = 0;
  }

  if (!bypassCache && lastUnconfiguredResult && (now - lastUnconfiguredTimestamp < CACHE_TTL_MS)) {
    return lastUnconfiguredResult;
  }

  if (!bypassCache && pendingTestConnectionPromise) {
    return pendingTestConnectionPromise;
  }

  pendingTestConnectionPromise = (async () => {
    try {
      const data = await callGhlApiProxy("testConnection", "GET", null, null);
      lastUnconfiguredResult = null;
      lastUnconfiguredTimestamp = 0;
      return { success: true, total: data.meta?.total || data.total || 0 };
    } catch (e) {
      if (e.message?.includes("GHL_TOKEN") || e.message?.includes("not configured")) {
        lastUnconfiguredResult = { success: false, error: e.message };
        lastUnconfiguredTimestamp = now;
      }
      return { success: false, error: e.message };
    } finally {
      pendingTestConnectionPromise = null;
    }
  })();

  return pendingTestConnectionPromise;
};

export const fetchLocationTags = async () => {
  try {
    const data = await callGhlApiProxy("tags", "GET", null, null);
    return data.tags || [];
  } catch {
    return [];
  }
};

export const searchContacts = async (page = 1, limit = 100, query = "") => {
  const data = await callGhlApiProxy("searchContacts", "GET", null, { limit, query });
  return data;
};

export const searchCRM = async (query) => {
  try {
    const data = await searchContacts(1, 100, query);
    return data.contacts || [];
  } catch {
    return [];
  }
};

export const searchCRMByPhone = async (phone) => {
  if (!phone) return [];
  const clean = String(phone).replace(/\D/g, '');
  const digits10 = clean.length >= 10 ? clean.slice(-10) : clean;

  const searchQueries = Array.from(new Set([
    `+91${digits10}`,
    digits10,
    clean,
    String(phone).trim()
  ])).filter(Boolean);

  let matchedContacts = [];

  for (const q of searchQueries) {
    try {
      const data = await callGhlApiProxy("searchContacts", "GET", null, { limit: 10, query: q });
      let list = data.contacts || data.data || [];
      if (!Array.isArray(list) && data.contact) list = [data.contact];

      if (Array.isArray(list) && list.length > 0) {
        matchedContacts = list;
        break;
      }
    } catch {
      // SILENT FALLBACK
    }
  }

  return matchedContacts;
};

export const fetchContactsGroupedByTag = async (query, progressCallback, signal) => {
  let allContacts = [];
  let page = 1;
  const limit = 100;

  while (true) {
    if (signal?.aborted) throw new Error("Aborted");
    
    const data = await callGhlApiProxy("searchContacts", "POST", { page, pageLimit: limit, query }, null, signal);
    
    if (data && data.contacts) {
      allContacts.push(...data.contacts);
    }
    
    if (progressCallback) {
      progressCallback(allContacts.length, data?.meta?.total || data?.total, `Downloaded ${allContacts.length} leads...`);
    }
    
    if (!data.contacts || data.contacts.length < limit || page > 500) {
      break;
    }
    page++;
  }
  
  const groups = {};
  for (const c of allContacts) {
    const tags = c.tags || [];
    for (const t of tags) {
      if (!groups[t]) groups[t] = [];
      groups[t].push({
        GHL_ID: c.id,
        Name: c.contactName || c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "",
        Phone: c.phone || "",
        Email: c.email || "",
        City: c.city || c.location?.city || "",
        State: c.state || c.location?.state || "",
        Source: c.source || "",
        Tags: tags.join(", ")
      });
    }
  }
  
  return groups;
};
