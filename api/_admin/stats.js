// api/_admin/stats.js
// V2: Three completely separate metric categories per master architecture:
// A. CALL EVENTS  — from contacts.history[] (callId = unit)
// B. PIPELINE PEOPLE — from contacts.pipelineStage (contact = unit)
// C. REGISTRATIONS — from registrations collection (registrationId = unit)
import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { programId, attenderId } = req.query;

    const client = await clientPromise;
    const db     = client.db('tgf_crm');

    // ── Contact base filter ──────────────────────────────────────────────────
    const contactFilter = {};
    if (programId && programId !== 'ALL') {
      contactFilter.$or = [
        { programId },
        { source: programId },
        { tags: programId },
      ];
    }
    if (attenderId && attenderId !== 'ALL') {
      contactFilter.assignedTo = attenderId;
    }

    // ── Registration filter ──────────────────────────────────────────────────
    const regFilter = {};
    if (programId && programId !== 'ALL') {
      regFilter.calledForKey = programId.toLowerCase().replace(/\s+/g, '_');
    }
    if (attenderId && attenderId !== 'ALL') {
      regFilter.attenderId = attenderId;
    }

    // ── A: PIPELINE PEOPLE — one count per pipelineStage ───────────────────
    // Source: contacts collection. Unit: one contact per stage.
    const pipelineAgg = await db.collection('contacts').aggregate([
      { $match: contactFilter },
      { $group: { _id: '$pipelineStage', count: { $sum: 1 } } },
    ]).toArray();

    const pipelinePeople = {
      'New Lead': 0,
      'Attempting Contact': 0,
      'Information Given': 0,
      'Nurture / Interested': 0,
      'Future Pool': 0,
      'Registered / Won': 0,
      'Closed / Lost': 0,
      'Closed / Invalid': 0,
      'Query Desk (Legacy)': 0,
      'Existing Alumni (Legacy)': 0,
      'Unknown / Legacy': 0,
    };
    let totalPipelinePeople = 0;

    for (const row of pipelineAgg) {
      const s = row._id || '';
      totalPipelinePeople += row.count;
      if (s.includes('New Lead') || s === '1. New Lead') pipelinePeople['New Lead'] += row.count;
      else if (s.includes('Attempting') || s === '2. Attempting Contact') pipelinePeople['Attempting Contact'] += row.count;
      else if (s.includes('Information Given') || s === '3. Information Given') pipelinePeople['Information Given'] += row.count;
      else if (s.includes('Nurture') || s === '4. Nurture / Interested') pipelinePeople['Nurture / Interested'] += row.count;
      else if (s.includes('Future Pool') || s === '5. Future Pool') pipelinePeople['Future Pool'] += row.count;
      else if (s.includes('Registered') || s === '6. Registered / Won') pipelinePeople['Registered / Won'] += row.count;
      else if (s === 'Closed / Lost') pipelinePeople['Closed / Lost'] += row.count;
      else if (s === 'Closed / Invalid') pipelinePeople['Closed / Invalid'] += row.count;
      else if (s === 'Query Desk' || s === 'Query') pipelinePeople['Query Desk (Legacy)'] += row.count;
      else if (s === 'Existing Alumni' || s === 'Alumni') pipelinePeople['Existing Alumni (Legacy)'] += row.count;
      else pipelinePeople['Unknown / Legacy'] += row.count;
    }

    // ── B: CALL EVENTS — from history[] arrays. Unit: one callId per event ─
    // Source: contacts.history[]. Each entry with a callId/id = one call event.
    const callEventAgg = await db.collection('contacts').aggregate([
      { $match: contactFilter },
      { $unwind: '$history' },
      { $group: {
          _id: null,
          totalCalls:        { $sum: 1 },
          salesCalls:        { $sum: { $cond: [{ $eq: ['$history.callPurpose', 'SALES'] }, 1, 0] } },
          queryCalls:        { $sum: { $cond: [{ $eq: ['$history.callPurpose', 'QUERY'] }, 1, 0] } },
          reminderCalls:     { $sum: { $cond: [{ $eq: ['$history.callPurpose', 'REMINDER'] }, 1, 0] } },
          incomingCalls:     { $sum: { $cond: [{ $eq: ['$history.callDirection', 'incoming'] }, 1, 0] } },
          outgoingCalls:     { $sum: { $cond: [{ $eq: ['$history.callDirection', 'outgoing'] }, 1, 0] } },
          connectedCalls:    { $sum: { $cond: [{ $eq: ['$history.callStatus', 'Connected'] }, 1, 0] } },
          notConnectedCalls: { $sum: { $cond: [{ $ne: ['$history.callStatus', 'Connected'] }, 1, 0] } },
          interestedCalls:   { $sum: { $cond: [{ $in: ['$history.status', ['Interested', 'interested']] }, 1, 0] } },
          regDoneCalls:      { $sum: { $cond: [{ $in: ['$history.status', ['Reg.Done', 'Registered', 'registered']] }, 1, 0] } },
      }},
    ]).toArray();

    const callEvents = callEventAgg[0] || {
      totalCalls: 0, salesCalls: 0, queryCalls: 0, reminderCalls: 0,
      incomingCalls: 0, outgoingCalls: 0, connectedCalls: 0,
      notConnectedCalls: 0, interestedCalls: 0, regDoneCalls: 0,
    };
    delete callEvents._id;

    // ── C: REGISTRATIONS — from registrations collection ───────────────────
    // Source: registrations. Unit: registrationId (one per contactId+calledForKey).
    const [totalRegs, regsByProgram] = await Promise.all([
      db.collection('registrations').countDocuments(regFilter),
      db.collection('registrations').aggregate([
        { $match: regFilter },
        { $group: { _id: '$calledForKey', count: { $sum: 1 }, program: { $first: '$calledFor' } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]).toArray(),
    ]);

    // General contact counts
    const [totalContacts, unassignedCount] = await Promise.all([
      db.collection('contacts').countDocuments(contactFilter),
      db.collection('contacts').countDocuments({
        ...contactFilter,
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: { $size: 0 } }],
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        // Contact metadata
        totalContacts,
        unassignedContacts: unassignedCount,
        assignedContacts:   totalContacts - unassignedCount,

        // A. CALL EVENTS (source: history[])
        callEvents,

        // B. PIPELINE PEOPLE (source: pipelineStage per contact)
        pipelinePeople,
        totalPipelinePeople,

        // C. REGISTRATIONS (source: registrations collection)
        totalRegistrations: totalRegs,
        registrationsByProgram: regsByProgram,
      },
    });
  } catch (error) {
    console.error('[STATS ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
