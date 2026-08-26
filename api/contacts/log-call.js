// api/contacts/log-call.js
import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contactId, attenderId, attenderName, status, remark, callbackDate, calledFor } = req.body;

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

    // Atomic update of attender state map entry and history array append
    const updateResult = await db.collection('contacts').updateOne(
      { _id: new ObjectId(contactId) },
      {
        $set: {
          updatedAt: nowIso,
          [`attenderStates.${attenderId}`]: {
            attenderId,
            attenderName,
            status,
            remark,
            callbackDate: callbackDate || null,
            lastCalledAt: nowIso,
            calledFor: calledFor || ''
          }
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
