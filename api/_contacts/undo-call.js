// api/_contacts/undo-call.js
// Bug fix: history items created by log-call.js use `callId` not `id`.
// This handler now supports BOTH field names for backward compatibility.
import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { contactId, attenderId, historyId } = req.body;

    if (!contactId || !attenderId || !historyId) {
      return res.status(400).json({ error: 'contactId, attenderId, and historyId are required' });
    }

    const client = await clientPromise;
    const db     = client.db('tgf_crm');

    const queryId = ObjectId.isValid(contactId) ? new ObjectId(contactId) : contactId;
    const contact = await db.collection('contacts').findOne({ _id: queryId });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const history = contact.history || [];

    // Support BOTH `callId` (new format) and `id` (legacy format)
    const historyItemIndex = history.findIndex(
      h => h.callId === historyId || h.id === historyId
    );
    if (historyItemIndex === -1) {
      return res.status(404).json({ error: 'History item not found or already undone' });
    }

    // Determine which field was used so we can match it in $pull
    const foundItem = history[historyItemIndex];
    const matchField = foundItem.callId ? 'callId' : 'id';

    // Restore previous state for this attender by scanning backward
    let previousState = {
      attenderId,
      attenderName: '',
      status:       'Pending',
      remark:       '',
      callbackDate:  null,
      callbackTime:  null,
      lastCalledAt:  null,
      calledFor:     '',
    };

    for (let i = historyItemIndex - 1; i >= 0; i--) {
      if (history[i].attenderId === attenderId) {
        previousState = {
          attenderId,
          attenderName:  history[i].attenderName  || '',
          status:        history[i].status        || 'Pending',
          remark:        history[i].remark        || '',
          callbackDate:  history[i].callbackDate  || null,
          callbackTime:  history[i].callbackTime  || null,
          lastCalledAt:  history[i].timestamp     || null,
          calledFor:     history[i].calledFor     || '',
        };
        break;
      }
    }

    // Atomically remove the history item and restore attender state
    const updateResult = await db.collection('contacts').updateOne(
      {
        _id: queryId,
        [`history.${matchField}`]: historyId,    // concurrency guard
      },
      {
        $pull: { history: { [matchField]: historyId } },
        $set: {
          [`attenderStates.${attenderId}`]: previousState,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(409).json({
        error: 'Failed to undo. The state may have been modified by another operation.',
      });
    }

    return res.status(200).json({
      success:       true,
      message:       'Call log undone successfully',
      restoredState: previousState,
    });
  } catch (error) {
    console.error('[UNDO-CALL ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
