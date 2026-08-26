// api/_contacts/create-incoming.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { attenderId, attenderName, programId, programName, ...updates } = req.body;

    if (!attenderId) {
      return res.status(400).json({ error: 'attenderId is required' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    const nowIso = new Date().toISOString();
    const historyItem = {
      id: 'hist_' + Date.now(),
      attenderId,
      attenderName: attenderName || '',
      status: updates.status || 'Pending',
      remark: updates.remark || '',
      callbackDate: updates.callbackDate || null,
      calledFor: updates.calledFor || updates['Called For'] || '',
      timestamp: nowIso
    };

    const phoneVal = String(updates.Phone || updates.phone || '').trim();
    const mobileVal = String(updates.Mobile || updates.mobile || phoneVal).trim();
    const nameVal = String(updates.Name || updates.name || '').trim();

    const newContact = {
      ...updates,
      Name: nameVal,
      name: nameVal,
      Phone: phoneVal,
      phone: phoneVal,
      Mobile: mobileVal,
      mobile: mobileVal,
      normalizedPhone: phoneVal.replace(/\D/g, ""),
      normalizedMobile: mobileVal.replace(/\D/g, ""),
      City: updates.City || updates.city || '',
      city: updates.City || updates.city || '',
      State: updates.State || updates.state || '',
      state: updates.State || updates.state || '',
      Source: updates.Source || updates.source || 'Incoming',
      source: updates.Source || updates.source || 'Incoming',
      programId: programId || 'incoming',
      programName: programName || 'Incoming Calls',
      assignedTo: [attenderId],
      isAssigned: true,
      assignedName: attenderName || '',
      assignedAt: nowIso,
      attenderId: attenderId,
      attenderName: attenderName || '',
      createdAt: nowIso,
      updatedAt: nowIso,
      attenderStates: {
        [attenderId]: {
          attenderId,
          attenderName: attenderName || '',
          status: updates.status || 'Pending',
          remark: updates.remark || '',
          callbackDate: updates.callbackDate || null,
          lastCalledAt: nowIso
        }
      },
      history: [historyItem]
    };

    const insertResult = await db.collection('contacts').insertOne(newContact);
    const newId = insertResult.insertedId.toString();

    return res.status(200).json({
      success: true,
      contactId: newId,
      id: newId
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
