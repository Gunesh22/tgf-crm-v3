const callGhlApiProxy = async (endpoint, method = "POST", payload = null, params = null, signal = null) => {
  try {
    const proxyRes = await fetch("/api/ghl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, method, payload, params }),
      signal,
    });
    if (proxyRes.ok) {
      return await proxyRes.json();
    } else {
        throw new Error(proxyRes.statusText);
    }
  } catch (e) {
      throw e;
  }
};

export const testConnection = async () => {
  console.log(`%c[GHL CALL] %cTEST CONNECTION`, "color: #ec4899; font-weight: bold", "color: gray");
  try {
    const data = await callGhlApiProxy("testConnection", "GET", null, null);
    console.log(`%c[GHL SUCCESS] %cConnection OK`, "color: #ec4899; font-weight: bold", "color: gray", data);
    return { success: true, total: data.meta?.total || data.total || 0 };
  } catch (e) {
    console.error(`%c[GHL ERROR] %cTEST CONNECTION`, "color: #ef4444; font-weight: bold", "color: gray", e);
    return { success: false, error: e.message };
  }
};

export const fetchLocationTags = async () => {
  console.log(`%c[GHL CALL] %cFETCH TAGS`, "color: #ec4899; font-weight: bold", "color: gray");
  const data = await callGhlApiProxy("tags", "GET", null, null);
  console.log(`%c[GHL SUCCESS] %cFetched ${data.tags?.length || 0} Tags`, "color: #ec4899; font-weight: bold", "color: gray");
  return data.tags || [];
};

export const searchContacts = async (page = 1, limit = 100, query = "") => {
  const data = await callGhlApiProxy("searchContacts", "GET", null, { limit, query });
  return data;
};

export const searchCRM = async (query) => {
  console.log(`%c[GHL CALL] %cSEARCH Contacts by Query: "${query}"`, "color: #ec4899; font-weight: bold", "color: gray");
  const data = await searchContacts(1, 100, query);
  console.log(`%c[GHL SUCCESS] %cFound ${data.contacts?.length || 0} Contacts`, "color: #ec4899; font-weight: bold", "color: gray", data.contacts);
  return data.contacts || [];
};

export const searchCRMByPhone = async (phone) => {
  if (!phone) return [];
  const clean = String(phone).replace(/\D/g, '');
  const digits10 = clean.length >= 10 ? clean.slice(-10) : clean;

  console.log(`%c[GHL AUTOFILL LOG] %cInitiating instant GHL search for: "${phone}"`, "color: #3b82f6; font-weight: bold", "color: inherit");

  // Prioritize +91 format first since Indian GHL contacts store phone as +91XXXXXXXXXX
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
        console.log(`%c[GHL AUTOFILL INSTANT MATCH] %cFound ${matchedContacts.length} contact(s) for query "${q}"`, "color: #10b981; font-weight: bold", "color: inherit", matchedContacts);
        break;
      }
    } catch (err) {
      console.warn(`[GHL AUTOFILL WARN] GHL search query term "${q}" failed:`, err.message || err);
    }
  }

  return matchedContacts;
};

export const fetchContactsGroupedByTag = async (query, progressCallback, signal) => {
  let allContacts = [];
  let page = 1;
  const limit = 100;
  
  console.log(`%c[GHL BULK SYNC] %cStarting fetch loop for: "${query}"`, "color: #8b5cf6; font-weight: bold", "color: gray");

  while (true) {
    if (signal?.aborted) throw new Error("Aborted");
    
    console.log(`%c[GHL FETCH PAGE] %cFetching next batch (Page ${page})...`, "color: #8b5cf6; font-weight: bold", "color: gray");
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
  
  console.log(`%c[GHL BULK SYNC] %cTotal Contacts Downloaded: ${allContacts.length}`, "color: #8b5cf6; font-weight: bold", "color: gray");
  
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
