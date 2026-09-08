// api/_contacts/sync-ghl-tags.js
import clientPromise, { ensureIndexes } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { buildPhoneDuplicateFilter, extractLast10, normalizePhone } from '../lib/phoneNormalizer.js';
import { requireAuth, sanitizeString } from '../lib/auth.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const session = requireAuth(req, res);
  if (!session) return;

  try {
    const contactId = sanitizeString(req.body?.contactId || req.query?.contactId);
    const rawPhone = sanitizeString(req.body?.phone || req.query?.phone);
    const providedGhlTags = req.body?.ghlTags || req.query?.ghlTags;

    if (!contactId && !rawPhone) {
      return res.status(400).json({ success: false, error: 'contactId or phone parameter is required' });
    }

    const cleanPhone = normalizePhone(rawPhone);
    const last10 = extractLast10(rawPhone);

    if (!contactId && (!last10 || last10.length < 10)) {
      return res.status(200).json({ success: true, updated: false, reason: 'Invalid phone number (less than 10 digits)' });
    }

    let ghlTags = [];

    // Option A: Use pre-provided GHL tags if available
    if (Array.isArray(providedGhlTags) && providedGhlTags.length > 0) {
      ghlTags = providedGhlTags.map(t => String(t).trim()).filter(Boolean);
    } else {
      // Option B: Fetch tags ONLY from GoHighLevel (GHL) via GHL API / Proxy
      const searchQueries = Array.from(new Set([
        `+91${last10}`,
        `91${last10}`,
        `0${last10}`,
        last10,
        cleanPhone,
        rawPhone
      ])).filter(Boolean);

      let ghlContact = null;
      const GHL_TOKEN = process.env.GHL_TOKEN || process.env.VITE_GHL_TOKEN || process.env.GHL_API_KEY || process.env.GHL_KEY || process.env.GOHIGHLEVEL_TOKEN || '';
      const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || process.env.VITE_GHL_LOCATION_ID || process.env.LOCATION_ID || process.env.GHL_LOCATION || '';
      
      if (GHL_TOKEN) {
        const isV1 = !GHL_TOKEN.startsWith("pit-");
        const headers = { "Authorization": `Bearer ${GHL_TOKEN}` };
        if (!isV1) {
          headers["Content-Type"] = "application/json";
          headers["Version"] = process.env.GHL_VERSION || process.env.VITE_GHL_VERSION || "2021-07-28";
        }

        for (const q of searchQueries) {
          try {
            let targetUrl = "";
            if (isV1) {
              targetUrl = `https://rest.gohighlevel.com/v1/contacts/?limit=5&query=${encodeURIComponent(q)}`;
            } else {
              const locParam = GHL_LOCATION_ID ? `&locationId=${encodeURIComponent(GHL_LOCATION_ID)}` : '';
              targetUrl = `https://services.leadconnectorhq.com/contacts/search?limit=5&query=${encodeURIComponent(q)}${locParam}`;
            }

            const response = await fetch(targetUrl, { method: "GET", headers });
            if (response.ok) {
              const data = await response.json();
              let list = data.contacts || data.data || [];
              if (!Array.isArray(list) && data.contact) list = [data.contact];
              if (Array.isArray(list) && list.length > 0) {
                ghlContact = list[0];
                break;
              }
            }
          } catch (err) {
            console.warn("[GHL Tag Fetch Exception]:", err.message);
          }
        }
      }

      if (ghlContact) {
        // RESTRICTION REQUIREMENT: Extract ONLY tags from GHL contact.
        // Do NOT process or touch name, email, phone, custom fields, pipeline, stage, status, etc.
        const rawGhlTags = ghlContact.tags || ghlContact.Tags || [];
        ghlTags = (Array.isArray(rawGhlTags) ? rawGhlTags : String(rawGhlTags || '').split(','))
          .map(t => String(t).trim())
          .filter(Boolean);
      }
    }

    if (!ghlTags || ghlTags.length === 0) {
      return res.status(200).json({ success: true, updated: false, reason: 'No GHL tags found or GHL contact missing' });
    }

    // 2. Locate existing lead document in MongoDB contacts collection
    const client = await clientPromise;
    const db = client.db('tgf_crm');
    ensureIndexes(db);

    const collection = db.collection('contacts');
    let existingDoc = null;

    if (contactId) {
      if (ObjectId.isValid(contactId)) {
        try {
          existingDoc = await collection.findOne({ _id: new ObjectId(contactId) });
        } catch (e) {}
      }
      if (!existingDoc) {
        existingDoc = await collection.findOne({
          $or: [{ _id: contactId }, { id: contactId }, { contactId: contactId }]
        });
      }
    }

    if (!existingDoc && (last10 || cleanPhone)) {
      const queryFilter = buildPhoneDuplicateFilter(rawPhone, null);
      if (queryFilter) {
        existingDoc = await collection.findOne(queryFilter);
      }
    }

    if (!existingDoc) {
      return res.status(200).json({ success: true, updated: false, reason: 'CRM lead document not found in database' });
    }

    // 3. Compare GHL tags with existing CRM tags (case-preserving with case-insensitive deduplication)
    const existingTagsArr = Array.isArray(existingDoc.tags)
      ? existingDoc.tags.map(t => String(t).trim()).filter(Boolean)
      : (existingDoc.Tags ? String(existingDoc.Tags).split(',').map(t => String(t).trim()).filter(Boolean) : []);

    const existingLowerSet = new Set(existingTagsArr.map(t => t.toLowerCase()));
    const missingTags = ghlTags.filter(tag => !existingLowerSet.has(tag.toLowerCase()));

    if (missingTags.length === 0) {
      return res.status(200).json({ success: true, updated: false, reason: 'All GHL tags already exist in CRM' });
    }

    // 4. ATOMIC DATABASE UPDATE: Add ONLY missing tags via $addToSet
    const finalAllTagsArr = Array.from(new Set([...existingTagsArr, ...missingTags]));
    const finalTagsString = finalAllTagsArr.join(', ');

    const updateResult = await collection.updateOne(
      { _id: existingDoc._id },
      {
        $addToSet: { tags: { $each: missingTags } },
        $set: {
          Tags: finalTagsString,
          updatedAt: new Date().toISOString()
        }
      }
    );

    return res.status(200).json({
      success: true,
      updated: updateResult.modifiedCount > 0 || updateResult.matchedCount > 0,
      addedTags: missingTags,
      allTags: finalAllTagsArr,
      tagsString: finalTagsString
    });

  } catch (error) {
    console.error('[SYNC GHL TAGS EXCEPTION]', error);
    // Non-blocking error handling requirement
    return res.status(200).json({ success: false, error: error.message, updated: false });
  }
}
