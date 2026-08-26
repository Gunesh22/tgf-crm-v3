// api/_contacts/undo-call.js
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
    const db = client.db('tgf_crm');
    
    // Support both new ObjectIds and legacy string IDs
    const queryId = ObjectId.isValid(contactId) ? new ObjectId(contactId) : contactId;

    // 1. Fetch the contact to analyze history and determine previous state
    const contact = await db.collection('contacts').findOne({ _id: queryId });
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const history = contact.history || [];
    
    // Check if the history item exists
    const historyItemIndex = history.findIndex(h => h.id === historyId);
    if (historyItemIndex === -1) {
      return res.status(404).json({ error: 'History item not found or already undone' });
    }

    // Find the previous history item for this specific attender
    let previousState = {
      attenderId,
      attenderName: '',
      status: 'Pending',
      remark: '',
      callbackDate: null,
      lastCalledAt: null,
      calledFor: ''
    };

    // Look backwards from the item being removed to find the last known state for this attender
    for (let i = historyItemIndex - 1; i >= 0; i--) {
      if (history[i].attenderId === attenderId) {
        previousState = {
          attenderId,
          attenderName: history[i].attenderName,
          status: history[i].status,
          remark: history[i].remark,
          callbackDate: history[i].callbackDate || null,
          lastCalledAt: history[i].timestamp,
          calledFor: history[i].calledFor || ''
        };
        break;
      }
    }

    // 2. Atomically pull the history item and reset the attender state
    const updateResult = await db.collection('contacts').updateOne(
      { 
        _id: queryId,
        // Ensure the history item is still there (concurrency check)
        'history.id': historyId 
      },
      {
        $pull: {
          history: { id: historyId }
        },
        $set: {
          [`attenderStates.${attenderId}`]: previousState,
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(409).json({ error: 'Failed to undo. The state may have been modified by another operation.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Call log undone successfully',
      restoredState: previousState
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
