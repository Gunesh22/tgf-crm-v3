// api/contacts/check-duplicate.js
import clientPromise, { ensureIndexes } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { phone, excludeId } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone query parameter is required' });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return res.status(200).json({ success: true, count: 0, matches: [] });
    }

    const last10 = cleanPhone.slice(-10);

    const client = await clientPromise;
    const db = client.db('tgf_crm');
    ensureIndexes(db);

    const phoneVariations = Array.from(new Set([
      last10,
      cleanPhone,
      `91${last10}`,
      `+91${last10}`,
      `0${last10}`
    ]));

    const queryFilter = {
      $or: [
        { normalizedPhone: { $in: phoneVariations } },
        { phone: { $in: phoneVariations } },
        { Phone: { $in: phoneVariations } },
        { mobile: { $in: phoneVariations } },
        { Mobile: { $in: phoneVariations } },
        { normalizedMobile: { $in: phoneVariations } }
      ]
    };

    if (excludeId) {
      const excludeObjectIds = [];
      try {
        if (ObjectId.isValid(excludeId)) {
          excludeObjectIds.push(new ObjectId(excludeId));
        }
      } catch (e) {}
      excludeObjectIds.push(excludeId);

      queryFilter._id = { $nin: excludeObjectIds };
      queryFilter.id = { $ne: excludeId };
    }

    const matches = await db.collection('contacts')
      .find(queryFilter)
      .limit(10)
      .toArray();

    const formattedMatches = matches.map(m => ({
      ...m,
      id: m._id ? m._id.toString() : m.id,
      contactId: m._id ? m._id.toString() : m.id,
      Name: m.Name || m.name || '',
      Phone: m.Phone || m.phone || '',
      Mobile: m.Mobile || m.mobile || '',
      Email: m.Email || m.email || '',
      City: m.City || m.city || '',
      State: m.State || m.state || '',
      Tags: Array.isArray(m.tags) ? m.tags.join(', ') : (m.Tags || ''),
      assignedName: m.assignedName || m.attenderName || (Array.isArray(m.assignedTo) ? m.assignedTo.join(', ') : '')
    }));

    const allTags = new Set();
    formattedMatches.forEach(m => {
      if (Array.isArray(m.tags)) m.tags.forEach(t => allTags.add(t));
      if (m.Tags) String(m.Tags).split(',').map(x => x.trim()).filter(Boolean).forEach(t => allTags.add(t));
    });

    return res.status(200).json({
      success: true,
      count: formattedMatches.length,
      allTags: Array.from(allTags).sort(),
      matches: formattedMatches,
      first: formattedMatches[0] || null,
      programName: formattedMatches[0]?.programName || formattedMatches[0]?.programId || 'Call Center'
    });
  } catch (error) {
    console.error('[CHECK DUPLICATE ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
