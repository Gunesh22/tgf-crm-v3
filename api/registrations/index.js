// api/registrations/index.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { month, limit = 5000 } = req.query;

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    const queryFilter = {};

    if (month && month !== 'ALL') {
      const [y, m] = month.split('-').map(v => parseInt(v, 10));
      if (y && m) {
        const startD = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        const endD = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        queryFilter.$or = [
          { createdAt: { $gte: startD, $lte: endD } },
          { createdAt: { $gte: `${month}-01`, $lte: `${month}-31T23:59:59.999Z` } },
          { createdAt: { $regex: `^${month}` } }
        ];
      } else {
        queryFilter.createdAt = { $regex: `^${month}` };
      }
    }

    const limitNum = Math.min(15000, Math.max(1, parseInt(limit, 10)));

    const registrations = await db.collection('registrations')
      .find(queryFilter)
      .sort({ updatedAt: -1 })
      .limit(limitNum)
      .toArray();

    return res.status(200).json({
      success: true,
      data: registrations,
      total: registrations.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
