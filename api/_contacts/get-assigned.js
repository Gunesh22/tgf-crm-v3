// api/_contacts/get-assigned.js
import clientPromise, { ensureIndexes } from '../lib/mongodb.js';

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
    ensureIndexes(db);

    // Query leads where attender is in assignedTo array
    const contacts = await db.collection('contacts')
      .find({ assignedTo: attenderId })
      .sort({ updatedAt: -1 })
      .toArray();

    // Map response to preserve all contact fields for clean frontend rendering
    const formattedContacts = contacts.map(c => {
      const attState = (c.attenderStates && c.attenderStates[attenderId]) || {};
      const idStr = c._id.toString();
      const phoneVal = c.Phone || c.phone || c.Mobile || c.mobile || '';
      const nameVal = c.Name || c.name || '';
      
      return {
        ...c,
        id: idStr,
        contactId: idStr,
        _id: idStr,
        Name: nameVal,
        name: nameVal,
        Phone: phoneVal,
        phone: phoneVal,
        Mobile: c.Mobile || c.mobile || phoneVal,
        mobile: c.Mobile || c.mobile || phoneVal,
        City: c.City || c.city || '',
        State: c.State || c.state || '',
        Source: c.Source || c.source || c.Sourse || c.sourse || '',
        status: attState.status || c.status || 'Pending',
        remark: attState.remark !== undefined ? attState.remark : (c.remark || ''),
        callbackDate: attState.callbackDate || c.callbackDate || null,
        lastCalledAt: attState.lastCalledAt || c.lastCalledAt || null,
        history: c.history || []
      };
    });

    return res.status(200).json({ success: true, count: formattedContacts.length, data: formattedContacts });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
