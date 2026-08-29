// api/_contacts/create-incoming.js
// Creates a brand-new contact from an incoming call.
// Sets leadOwner on creation. Pipeline starts at New Lead.
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
    const db     = client.db('tgf_crm');
    const nowIso = new Date().toISOString();

    const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const historyItem = {
      callId,
      attenderId,
      attenderName:      attenderName || '',
      callAttenderId:    attenderId,
      callAttenderName:  attenderName || '',
      leadOwnerAtTime:   attenderId,
      leadOwnerNameAtTime: attenderName || '',
      callDirection:     'incoming',
      callPurpose:       (updates.callPurpose || 'QUERY').toUpperCase(),
      callStatus:        updates.callStatus || 'Connected',
      status:            updates.status || 'Pending',
      queryStatus:       updates.queryStatus || null,
      remark:            updates.remark || '',
      callbackDate:      updates.callbackDate || null,
      callbackTime:      updates.callbackTime || null,
      calledFor:         updates.calledFor || updates['Called For'] || '',
      timestamp:         nowIso,
    };

    const phoneVal  = String(updates.Phone  || updates.phone  || '').trim();
    const mobileVal = String(updates.Mobile || updates.mobile || phoneVal).trim();
    const nameVal   = String(updates.Name   || updates.name   || '').trim();

    const newContact = {
      ...updates,
      Name:   nameVal, name:   nameVal,
      Phone:  phoneVal, phone:  phoneVal,
      Mobile: mobileVal, mobile: mobileVal,
      normalizedPhone:  phoneVal.replace(/\D/g, ''),
      normalizedMobile: mobileVal.replace(/\D/g, ''),
      City:  updates.City  || updates.city  || '',
      city:  updates.City  || updates.city  || '',
      State: updates.State || updates.state || '',
      state: updates.State || updates.state || '',
      Source: updates.Source || updates.source || 'Incoming',
      source: updates.Source || updates.source || 'Incoming',
      original_source: updates.original_source || updates.Source || updates.source || 'Incoming',
      programId:   programId   || 'incoming',
      programName: programName || 'Incoming Calls',
      // Pipeline starts at New Lead for a new contact
      pipelineStage: '1. New Lead',
      // Lead Owner = the attender who received this call (first assignment)
      leadOwner:     attenderId,
      leadOwnerName: attenderName || '',
      ownerHistory:  [],
      programRelationships: [],
      assignedTo:    [attenderId],
      isAssigned:    true,
      assignedName:  attenderName || '',
      assignedAt:    nowIso,
      attenderId,
      attenderName:  attenderName || '',
      attenderStates: {
        [attenderId]: {
          attenderId,
          attenderName:  attenderName || '',
          callDirection: 'incoming',
          callPurpose:   (updates.callPurpose || 'QUERY').toUpperCase(),
          callStatus:    updates.callStatus || 'Connected',
          status:        updates.status || 'Pending',
          remark:        updates.remark || '',
          callbackDate:  updates.callbackDate || null,
          callbackTime:  updates.callbackTime || null,
          lastCalledAt:  nowIso,
          calledFor:     updates.calledFor || updates['Called For'] || '',
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      history:   [historyItem],
    };

    const insertResult = await db.collection('contacts').insertOne(newContact);
    const newId = insertResult.insertedId.toString();

    return res.status(200).json({ success: true, contactId: newId, id: newId });
  } catch (error) {
    console.error('[CREATE-INCOMING ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
