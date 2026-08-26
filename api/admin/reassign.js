// api/admin/reassign.js
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fromId, toId, programId, status, count = 50 } = req.body;

    if (!fromId) {
      return res.status(400).json({ error: 'fromId (source attender) is required' });
    }

    const client = await clientPromise;
    const db = client.db('tgf_crm');

    // 1. Build query filter to locate target contacts for reassignment
    const filter = { assignedTo: fromId };

    if (programId && programId !== 'ALL') {
      filter.$or = [
        { programId: programId },
        { source: programId },
        { tags: programId }
      ];
    }

    if (status === 'Pending') {
      filter.$or = [
        { [`attenderStates.${fromId}.status`]: 'Pending' },
        { [`attenderStates.${fromId}`]: { $exists: false } }
      ];
    } else if (status === 'Callbacks') {
      filter[`attenderStates.${fromId}.callbackDate`] = { $ne: null };
    }

    // Fetch contacts matching the criteria up to count limit
    const limitNum = Math.min(500, Math.max(1, parseInt(count, 10) || 50));
    const targetContacts = await db.collection('contacts')
      .find(filter)
      .limit(limitNum)
      .toArray();

    if (targetContacts.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: 'No contacts found matching the selected reassignment criteria.'
      });
    }

    const targetIds = targetContacts.map(c => c._id);

    // 2. Perform atomic bulk update / updateMany
    let updateOp = {};
    if (!toId || toId === 'pool' || toId === 'unassigned') {
      // Remove fromId from assignedTo array
      updateOp = {
        $pull: { assignedTo: fromId },
        $set: { updatedAt: new Date().toISOString() }
      };
    } else {
      // Remove fromId and add toId to assignedTo array
      updateOp = {
        $pull: { assignedTo: fromId },
        $addToSet: { assignedTo: toId },
        $set: { updatedAt: new Date().toISOString() }
      };
    }

    const result = await db.collection('contacts').updateMany(
      { _id: { $in: targetIds } },
      updateOp
    );

    return res.status(200).json({
      success: true,
      count: result.modifiedCount,
      message: `Successfully reassigned ${result.modifiedCount} contacts!`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
