// api/_admin/reassign.js
// Explicit lead ownership transfer with full audit trail in ownerHistory[].
// This is the ONLY way to change leadOwner — not via incoming calls.
import clientPromise from '../lib/mongodb.js';
import { requireAdmin, sanitizeString } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

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
    } = req.body || {};

    const cleanFromId = sanitizeString(fromId);
    if (!cleanFromId) {
      return res.status(400).json({ error: 'fromId (source attender) is required' });
    }

    const cleanToId = sanitizeString(toId);
    const cleanToName = sanitizeString(toName);
    const cleanProgramId = sanitizeString(programId);
    const cleanStatus = sanitizeString(status);
    const cleanReason = sanitizeString(reason);

    const client = await clientPromise;
    const db     = client.db('tgf_crm');
    const nowIso = new Date().toISOString();

    let targetContacts = [];

    if (Array.isArray(contactIds) && contactIds.length > 0) {
      // Explicit list of contacts to reassign
      const { ObjectId } = await import('mongodb');
      const sanitizedContactIds = contactIds.map(id => sanitizeString(id)).filter(Boolean);
      const objectIds = sanitizedContactIds.map(id => {
        try { return ObjectId.isValid(id) ? new ObjectId(id) : id; } catch { return id; }
      });
      targetContacts = await db.collection('contacts')
        .find({ $or: [{ _id: { $in: objectIds } }, { id: { $in: sanitizedContactIds } }] }, { projection: { _id: 1, leadOwnerName: 1 } })
        .toArray();
    } else {
      // Filter-based bulk reassign (existing behaviour)
      const filter = { assignedTo: cleanFromId };

      if (cleanProgramId && cleanProgramId !== 'ALL') {
        filter.$or = [
          { programId: cleanProgramId },
          { source: cleanProgramId },
          { tags: cleanProgramId },
        ];
      }

      if (cleanStatus === 'Pending') {
        filter.$and = [
          { $or: [
            { [`attenderStates.${cleanFromId}.status`]: 'Pending' },
            { [`attenderStates.${cleanFromId}`]: { $exists: false } },
          ]},
        ];
      } else if (cleanStatus === 'Callbacks') {
        filter[`attenderStates.${cleanFromId}.callbackDate`] = { $ne: null };
      }

      const limitNum = Math.min(500, Math.max(1, parseInt(count, 10) || 50));
      targetContacts = await db.collection('contacts')
        .find(filter, { projection: { _id: 1, leadOwnerName: 1 } })
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
      previousOwner:      cleanFromId,
      previousOwnerName:  targetContacts[0]?.leadOwnerName || '',
      newOwner:           cleanToId || null,
      newOwnerName:       cleanToName || '',
      transferredBy:      session.id || 'admin',
      transferredByName:  session.name || 'Super Admin',
      timestamp:          nowIso,
      reason:             cleanReason || '',
      contactCount:       targetContacts.length,
    };

    // Build update operation
    let updateOp = {};
    const setFields = { updatedAt: nowIso };

    if (!cleanToId || cleanToId === 'pool' || cleanToId === 'unassigned') {
      // Remove fromId from assignedTo; clear leadOwner
      setFields.leadOwner     = null;
      setFields.leadOwnerName = '';
      updateOp = {
        $pull:  { assignedTo: cleanFromId },
        $set:   setFields,
        $push:  { ownerHistory: ownerHistoryEntry },
      };
    } else {
      // Transfer: remove fromId, add toId, update leadOwner
      setFields.leadOwner     = cleanToId;
      setFields.leadOwnerName = cleanToName || '';
      updateOp = {
        $pull:     { assignedTo: cleanFromId },
        $addToSet: { assignedTo: cleanToId },
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
