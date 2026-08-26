// api/_contacts/import-bulk.js
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
      const cleanPhone = String(c.phone || c.Phone || c.Mobile || c.mobile || '').replace(/\D/g, '');
      const contactPhone = cleanPhone || `no_phone_${Date.now()}_${Math.random().toString(36).slice(-5)}`;

      const setOnInsertObj = {
        phone: contactPhone,
        name: c.name || c.Name || 'Unknown',
        email: c.email || c.Email || '',
        city: c.city || c.City || '',
        state: c.state || c.State || '',
        source: c.source || c.Source || 'Excel Import',
        programId: c.programId || '',
        tags: c.tags || c.Tags || [],
        khoji: c.khoji || c.Khoji || '',
        assignedTo: Array.isArray(c.assignedTo) ? c.assignedTo : [],
        attenderStates: c.attenderStates || {},
        history: c.history || [],
        createdAt: new Date().toISOString()
      };

      return {
        updateOne: {
          filter: { phone: contactPhone },
          update: {
            $setOnInsert: setOnInsertObj,
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
      upsertedCount: result.upsertedCount || 0,
      matchedCount: result.matchedCount || 0,
      modifiedCount: result.modifiedCount || 0
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
