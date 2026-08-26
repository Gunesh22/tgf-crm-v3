// api/contacts/get-assigned.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { attenderId } = req.query;
    if (!attenderId) {
      return res.status(400).json({ error: 'attenderId query parameter is required' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    // Query leads where attender is in assignedTo array
    const contacts = await db.collection('contacts')
      .find({ assignedTo: attenderId })
      .sort({ updatedAt: -1 })
      .toArray();

    // Map response to extract the specific attender's state for clean frontend rendering
    const formattedContacts = contacts.map(c => {
      const attState = (c.attenderStates && c.attenderStates[attenderId]) || {};
      return {
        id: c._id.toString(),
        phone: c.phone,
        name: c.name,
        email: c.email || '',
        city: c.city || '',
        source: c.source || '',
        status: attState.status || 'Pending',
        remark: attState.remark || '',
        callbackDate: attState.callbackDate || null,
        lastCalledAt: attState.lastCalledAt || null,
        history: c.history || [],
        attenderState: attState
      };
    });

    return res.status(200).json({ success: true, count: formattedContacts.length, data: formattedContacts });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
