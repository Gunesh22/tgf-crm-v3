// api/contacts/import-bulk.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contacts } = req.body; // Array of raw contact objects
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts must be a non-empty array' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    // Build bulk upsert operations to prevent duplicates based on phone
    const bulkOps = contacts.map(c => {
      const cleanPhone = String(c.phone || c.Mobile || '').replace(/\D/g, '');
      return {
        updateOne: {
          filter: { phone: cleanPhone },
          update: {
            $setOnInsert: {
              phone: cleanPhone,
              name: c.name || c.Name || 'Unknown',
              email: c.email || c.Email || '',
              city: c.city || c.City || '',
              source: c.source || c.Source || 'Excel Import',
              assignedTo: Array.isArray(c.assignedTo) ? c.assignedTo : [],
              attenderStates: {},
              history: [],
              createdAt: new Date().toISOString()
            },
            $set: {
              updatedAt: new Date().toISOString()
            }
          },
          upsert: true
        }
      };
    });

    const result = await db.collection('contacts').bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      upsertedCount: result.upsertedCount,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
