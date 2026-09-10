// api/_contacts/get-single.js
import clientPromise, { ensureIndexes } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { requireAuth, sanitizeString } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  try {
    const rawId = sanitizeString(req.query?.id);
    const rawContactId = sanitizeString(req.query?.contactId);
    const rawPhone = sanitizeString(req.query?.phone);

    const targetId = rawId || rawContactId;
    const phone = rawPhone;

    if (!targetId && !phone) {
      return res.status(400).json({ error: 'id or phone query parameter is required' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');
    ensureIndexes(db);

    const collection = db.collection('contacts');
    let contact = null;

    if (targetId) {
      // 1. Try finding by ObjectId
      if (ObjectId.isValid(targetId)) {
        try {
          contact = await collection.findOne({ _id: new ObjectId(targetId) });
        } catch (e) {
          contact = null;
        }
      }
      // 2. If not found by ObjectId, try string _id, id, or contactId
      if (!contact) {
        contact = await collection.findOne({
          $or: [
            { _id: targetId },
            { id: targetId },
            { contactId: targetId }
          ]
        });
      }
    }

    // 3. If still not found and phone is supplied
    if (!contact && phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone) {
        contact = await collection.findOne({
          $or: [
            { normalizedPhone: cleanPhone },
            { phone: cleanPhone },
            { Phone: cleanPhone },
            { Mobile: cleanPhone }
          ]
        });
      }
    }

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const idStr = contact._id.toString();
    const formatted = {
      ...contact,
      id: idStr,
      contactId: idStr,
      _id: idStr,
      Name: contact.Name || contact.name || '',
      name: contact.Name || contact.name || '',
      Phone: contact.Phone || contact.phone || contact.Mobile || contact.mobile || '',
      phone: contact.Phone || contact.phone || contact.Mobile || contact.mobile || '',
      Mobile: contact.Mobile || contact.mobile || contact.Phone || contact.phone || '',
      mobile: contact.Mobile || contact.mobile || contact.Phone || contact.phone || '',
      City: contact.City || contact.city || '',
      State: contact.State || contact.state || '',
      Khoji: contact.Khoji || contact.khoji || '',
      calledFor: contact.calledFor || contact['Called For'] || contact.called_for || '',
      leadOrigin: contact.leadOrigin || contact.original_source || contact.originalSource || contact['Lead Origin'] || '',
      source: contact.source || contact.Source || contact.Sourse || contact.sourse || '',
      Source: contact.Source || contact.source || contact.Sourse || contact.sourse || '',
      history: Array.isArray(contact.history) ? contact.history : [],
      attenderStates: contact.attenderStates || {},
      programRelationships: Array.isArray(contact.programRelationships) ? contact.programRelationships : []
    };

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[API ERROR STACK IN GET-SINGLE]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
