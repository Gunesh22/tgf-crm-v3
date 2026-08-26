// api/_contacts/log-call.js
import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contactId, attenderId, attenderName, status, remark, callbackDate, calledFor, ...rootUpdates } = req.body;

    if (!contactId || !attenderId) {
      return res.status(400).json({ error: 'contactId and attenderId are required' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    const nowIso = new Date().toISOString();
    const historyItem = {
      id: 'hist_' + Date.now(),
      attenderId,
      attenderName: attenderName || '',
      status: status || 'Pending',
      remark: remark || '',
      callbackDate: callbackDate || null,
      calledFor: calledFor || '',
      timestamp: nowIso
    };
    
    // Support both new ObjectIds and legacy string IDs
    const queryId = ObjectId.isValid(contactId) ? new ObjectId(contactId) : contactId;

    // Clean up internal non-persisted parameters from rootUpdates
    delete rootUpdates.contactId;
    delete rootUpdates.id;
    delete rootUpdates._id;
    delete rootUpdates.history;
    delete rootUpdates.attenderStates;
    delete rootUpdates.assignedTo;

    // Normalize phone numbers if modified
    if (rootUpdates.Phone || rootUpdates.phone) {
      const p = String(rootUpdates.Phone || rootUpdates.phone).trim();
      rootUpdates.Phone = p;
      rootUpdates.phone = p;
      rootUpdates.normalizedPhone = p.replace(/\D/g, "");
    }
    if (rootUpdates.Mobile || rootUpdates.mobile) {
      const m = String(rootUpdates.Mobile || rootUpdates.mobile).trim();
      rootUpdates.Mobile = m;
      rootUpdates.mobile = m;
      rootUpdates.normalizedMobile = m.replace(/\D/g, "");
    }

    // Atomic update of root fields, attender state map entry, and history array append
    const setPayload = {
      ...rootUpdates,
      updatedAt: nowIso,
      isAssigned: true,
      [`attenderStates.${attenderId}`]: {
        attenderId,
        attenderName: attenderName || '',
        status: status || 'Pending',
        remark: remark || '',
        callbackDate: callbackDate || null,
        lastCalledAt: nowIso,
        calledFor: calledFor || ''
      }
    };

    const updateResult = await db.collection('contacts').updateOne(
      { $or: [{ _id: queryId }, { id: contactId }, { _id: contactId }] },
      {
        $set: setPayload,
        $addToSet: {
          assignedTo: attenderId
        },
        $push: {
          history: historyItem
        }
      }
    );

    return res.status(200).json({
      success: true,
      modifiedCount: updateResult.modifiedCount,
      loggedHistory: historyItem
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
