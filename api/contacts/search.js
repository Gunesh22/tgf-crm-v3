// api/contacts/search.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { 
      attenderId, 
      search, 
      status, 
      month, 
      page = 1, 
      limit = 30 
    } = req.query;

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    // Build dynamic query filter
    const queryFilter = {};

    if (attenderId) {
      queryFilter.assignedTo = attenderId;
    }

    if (month) {
      // Filter by creation or update year-month (e.g. 2026-08)
      queryFilter.createdAt = { $regex: `^${month}` };
    }

    if (status && attenderId) {
      queryFilter[`attenderStates.${attenderId}.status`] = status;
    } else if (status) {
      queryFilter.status = status;
    }

    if (search) {
      const cleanSearch = String(search).trim();
      queryFilter.$or = [
        { phone: { $regex: cleanSearch, $options: 'i' } },
        { name: { $regex: cleanSearch, $options: 'i' } },
        { city: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    // Pagination calculations
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10))); // Max 200 items per page
    const skipNum = (pageNum - 1) * limitNum;

    // Execute paginated query & total count in parallel
    const [contacts, totalCount] = await Promise.all([
      db.collection('contacts')
        .find(queryFilter)
        .sort({ updatedAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .toArray(),
      db.collection('contacts').countDocuments(queryFilter)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      data: contacts,
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
