// api/_admin/stats.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { programId } = req.query;

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    const filter = {};
    if (programId && programId !== 'ALL') {
      filter.$or = [
        { programId: programId },
        { source: programId },
        { tags: programId }
      ];
    }

    const [totalContacts, unassignedCount, sampleContacts] = await Promise.all([
      db.collection('contacts').countDocuments(filter),
      db.collection('contacts').countDocuments({ ...filter, $or: [{ assignedTo: { $exists: false } }, { assignedTo: { $size: 0 } }] }),
      db.collection('contacts').find(filter, { projection: { attenderStates: 1, history: 1 } }).limit(5000).toArray()
    ]);

    const outcomeCounts = {};
    let totalCalls = 0;

    sampleContacts.forEach(c => {
      if (Array.isArray(c.history)) {
        totalCalls += c.history.length;
      }
      if (c.attenderStates && typeof c.attenderStates === 'object') {
        Object.values(c.attenderStates).forEach(st => {
          if (st && st.status) {
            const status = st.status;
            outcomeCounts[status] = (outcomeCounts[status] || 0) + 1;
          }
        });
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalContacts,
        unassignedContacts: unassignedCount,
        assignedContacts: totalContacts - unassignedCount,
        totalCallsLogged: totalCalls,
        outcomes: outcomeCounts
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
