import clientPromise from '../lib/mongodb.js';
import { requireAuth, sanitizeString, isSameAttender } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  try {
    const rawAttenderId = sanitizeString(req.query?.attenderId);
    const search = sanitizeString(req.query?.search);
    const status = sanitizeString(req.query?.status);
    const month = sanitizeString(req.query?.month);
    const page = req.query?.page || 1;
    const limit = req.query?.limit || 10000;

    // IDOR Enforcement for non-admin users
    if (rawAttenderId && !isSameAttender(rawAttenderId, session)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other attender data' });
    }

    const attenderId = rawAttenderId;

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    // Ensure background indexes for fast queries
    db.collection('contacts').createIndex({ updatedAt: -1 }, { background: true }).catch(() => {});
    db.collection('contacts').createIndex({ assignedTo: 1 }, { background: true }).catch(() => {});

    // Build dynamic query filter
    const queryFilter = {};

    if (attenderId) {
      queryFilter.assignedTo = attenderId;
    }

    if (month && month !== 'ALL') {
      const monthRegex = new RegExp(`^${month}`);
      const [y, m] = month.split('-').map(v => parseInt(v, 10));
      if (y && m) {
        const startD = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endD = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        queryFilter.$or = [
          { createdAt: { $gte: startD, $lte: endD } },
          { lastCalledAt: { $gte: startD, $lte: endD } },
          { updatedAt: { $gte: startD, $lte: endD } },
          { createdAt: monthRegex },
          { lastCalledAt: monthRegex }
        ];
      } else {
        queryFilter.$or = [
          { createdAt: monthRegex },
          { lastCalledAt: monthRegex }
        ];
      }
    }

    if (status && attenderId) {
      queryFilter[`attenderStates.${attenderId}.status`] = status;
    } else if (status) {
      queryFilter.status = status;
    }

    if (search) {
      const cleanSearch = String(search).trim();
      const cleanPhoneDigits = cleanSearch.replace(/\D/g, "");
      let searchOr = [];

      if (cleanPhoneDigits.length >= 4) {
        const last10 = cleanPhoneDigits.slice(-10);
        const variations = Array.from(new Set([cleanSearch, cleanPhoneDigits, last10, `91${last10}`, `+91${last10}`, `0${last10}`]));
        searchOr = [
          { phone: { $in: variations } },
          { Phone: { $in: variations } },
          { normalizedPhone: { $in: variations } },
          { mobile: { $in: variations } },
          { Mobile: { $in: variations } },
          { name: { $regex: cleanSearch, $options: 'i' } },
          { Name: { $regex: cleanSearch, $options: 'i' } },
          { city: { $regex: cleanSearch, $options: 'i' } },
          { City: { $regex: cleanSearch, $options: 'i' } }
        ];
      } else {
        searchOr = [
          { name: { $regex: cleanSearch, $options: 'i' } },
          { Name: { $regex: cleanSearch, $options: 'i' } },
          { city: { $regex: cleanSearch, $options: 'i' } },
          { City: { $regex: cleanSearch, $options: 'i' } }
        ];
      }

      if (queryFilter.$or) {
        queryFilter.$and = [
          { $or: queryFilter.$or },
          { $or: searchOr }
        ];
        delete queryFilter.$or;
      } else {
        queryFilter.$or = searchOr;
      }
    }

    // Pagination calculations
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(15000, Math.max(1, parseInt(limit, 10)));
    const skipNum = (pageNum - 1) * limitNum;

    // Fast query execution: fetch contacts with projection
    const includeHistory = req.query.includeHistory === 'true';
    const projection = includeHistory ? {} : { history: { $slice: -5 } };

    const contacts = await db.collection('contacts')
      .find(queryFilter, { projection })
      .sort({ updatedAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .toArray();

    // Optimization: If page 1 & contacts returned is less than requested limit, totalCount = contacts.length
    let totalCount;
    if (pageNum === 1 && contacts.length < limitNum) {
      totalCount = contacts.length;
    } else {
      totalCount = await db.collection('contacts').countDocuments(queryFilter);
    }

    const totalPages = Math.ceil(totalCount / limitNum);

    const trimmedContacts = contacts.map(c => {
      const idStr = c._id ? c._id.toString() : (c.id || '');
      return {
        ...c,
        id: c.id || idStr,
        contactId: c.contactId || idStr,
        _id: idStr,
        Name: c.Name || c.name || '',
        name: c.Name || c.name || '',
        Phone: c.Phone || c.phone || c.Mobile || c.mobile || '',
        phone: c.Phone || c.phone || c.Mobile || c.mobile || '',
        City: c.City || c.city || '',
        State: c.State || c.state || '',
        Khoji: c.Khoji || c.khoji || '',
        calledFor: c.calledFor || c['Called For'] || c.called_for || '',
        leadOrigin: c.leadOrigin || c.original_source || c.originalSource || c['Lead Origin'] || '',
        source: c.source || c.Source || c.Sourse || c.sourse || '',
        Source: c.Source || c.source || c.Sourse || c.sourse || '',
        history: Array.isArray(c.history) ? c.history : []
      };
    });

    return res.status(200).json({
      success: true,
      data: trimmedContacts,
      pagination: {
        totalRecords: totalCount,
        currentPage: pageNum,
        totalPages,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
