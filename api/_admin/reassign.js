// api/_admin/reassign.js
// Explicit lead ownership transfer with full audit trail in ownerHistory[].
// This is the ONLY way to change leadOwner — not via incoming calls.
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      contactIds,           // optional: array of specific contact IDs to reassign
      fromId,               // source attender (required)
      toId,                 // destination attender (null/pool = unassign)
      toName,               // display name of destination attender
      transferredById,      // who initiated the transfer (admin/manager)
      transferredByName,
      reason,               // optional reason text
      programId,
      status,
      count = 50,
    } = req.body;

    if (!fromId) {
      return res.status(400).json({ error: 'fromId (source attender) is required' });
    }

    const client = await clientPromise;
    const db     = client.db('tgf_crm');
    const nowIso = new Date().toISOString();

    let targetContacts = [];

    if (Array.isArray(contactIds) && contactIds.length > 0) {
      // Explicit list of contacts to reassign
      const { ObjectId } = await import('mongodb');
      const objectIds = contactIds.map(id => {
        try { return ObjectId.isValid(id) ? new ObjectId(id) : id; } catch { return id; }
      });
      targetContacts = await db.collection('contacts')
        .find({ $or: [{ _id: { $in: objectIds } }, { id: { $in: contactIds } }] })
        .toArray();
    } else {
      // Filter-based bulk reassign (existing behaviour)
      const filter = { assignedTo: fromId };

      if (programId && programId !== 'ALL') {
        filter.$or = [
          { programId },
          { source: programId },
          { tags: programId },
        ];
      }

      if (status === 'Pending') {
        filter.$and = [
          { $or: [
            { [`attenderStates.${fromId}.status`]: 'Pending' },
            { [`attenderStates.${fromId}`]: { $exists: false } },
          ]},
        ];
      } else if (status === 'Callbacks') {
        filter[`attenderStates.${fromId}.callbackDate`] = { $ne: null };
      }

      const limitNum = Math.min(500, Math.max(1, parseInt(count, 10) || 50));
      targetContacts = await db.collection('contacts')
        .find(filter)
        .limit(limitNum)
        .toArray();
    }

    if (targetContacts.length === 0) {
      return res.status(200).json({
        success: true,
        count:   0,
        message: 'No contacts found matching the selected reassignment criteria.',
      });
    }

    const targetIds = targetContacts.map(c => c._id);

    // Build the ownership audit entry
    const ownerHistoryEntry = {
      previousOwner:      fromId,
      previousOwnerName:  targetContacts[0]?.leadOwnerName || '',
      newOwner:           toId || null,
      newOwnerName:       toName || '',
      transferredBy:      transferredById  || 'admin',
      transferredByName:  transferredByName || '',
      timestamp:          nowIso,
      reason:             reason || '',
      contactCount:       targetContacts.length,
    };

    // Build update operation
    let updateOp = {};
    const setFields = { updatedAt: nowIso };

    if (!toId || toId === 'pool' || toId === 'unassigned') {
      // Remove fromId from assignedTo; clear leadOwner
      setFields.leadOwner     = null;
      setFields.leadOwnerName = '';
      updateOp = {
        $pull:  { assignedTo: fromId },
        $set:   setFields,
        $push:  { ownerHistory: ownerHistoryEntry },
      };
    } else {
      // Transfer: remove fromId, add toId, update leadOwner
      setFields.leadOwner     = toId;
      setFields.leadOwnerName = toName || '';
      updateOp = {
        $pull:     { assignedTo: fromId },
        $addToSet: { assignedTo: toId },
        $set:      setFields,
        $push:     { ownerHistory: ownerHistoryEntry },
      };
    }

    const result = await db.collection('contacts').updateMany(
      { _id: { $in: targetIds } },
      updateOp
    );

    return res.status(200).json({
      success: true,
      count:   result.modifiedCount,
      message: `Successfully reassigned ${result.modifiedCount} contacts!`,
      ownerHistoryEntry,
    });
  } catch (error) {
    console.error('[REASSIGN ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
