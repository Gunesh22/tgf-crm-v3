// api/_contacts/create-incoming.js
// Creates or merges an incoming call entry.
// Server-side canonical authority on duplicate detection and atomic profile merging.
import clientPromise from '../lib/mongodb.js';
import { buildPhoneDuplicateFilter } from '../lib/phoneNormalizer.js';
import { executeLogCall } from './log-call.js';
import { requireAuth, sanitizeString, isSameAttender } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  try {
    const { attenderId, attenderName, programId, programName, ...updates } = req.body || {};

    const cleanAttenderId = sanitizeString(attenderId);
    const cleanAttenderName = sanitizeString(attenderName);

    if (!cleanAttenderId) {
      return res.status(400).json({ error: 'attenderId is required' });
    }

    if (!isSameAttender(cleanAttenderId, session)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot create incoming call for another attender' });
    }

    const label = cleanAttenderName ? `${cleanAttenderName} (${cleanAttenderId})` : cleanAttenderId;
    console.log(`[ATTENDER API REQ] /api/contacts/create-incoming | Attender: "${label}" | Action: "Create Lead"`);

    const client = await clientPromise;
    const db     = client.db('tgf_crm');
    const nowIso = new Date().toISOString();

    const phoneVal  = String(updates.Phone  || updates.phone  || '').trim();
    const mobileVal = String(updates.Mobile || updates.mobile || phoneVal).trim();
    const nameVal   = String(updates.Name   || updates.name   || '').trim();

    // 1. Server-side canonical duplicate lookup across MongoDB contacts collection
    const queryFilter = buildPhoneDuplicateFilter(phoneVal, mobileVal);

    if (queryFilter) {
      const existingContact = await db.collection('contacts').findOne(queryFilter);

      if (existingContact) {
        console.log(`[CREATE-INCOMING DUP MATCH] Merging incoming call into existing contact ${existingContact._id.toString()} (${existingContact.Name || existingContact.phone})`);

        const logRes = await executeLogCall(db, {
          contactId: existingContact._id.toString(),
          attenderId: cleanAttenderId,
          attenderName: cleanAttenderName,
          programId: programId || 'incoming',
          programName: programName || 'Incoming Calls',
          callType: updates.callType || 'incoming',
          status: updates.status || 'Pending',
          remark: updates.remark || '',
          calledFor: updates.calledFor || updates['Called For'] || '',
          callbackDate: updates.callbackDate || null,
          callbackTime: updates.callbackTime || null,
          callPurpose: updates.callPurpose || (updates.status === 'Query' ? 'QUERY' : 'SALES'),
          ...updates
        });

        return res.status(200).json({
          success: true,
          contactId: existingContact._id.toString(),
          id: existingContact._id.toString(),
          isMerged: true,
          updatedContact: logRes.updatedContact || null,
          ...logRes
        });
      }
    }

    // 2. Genuinely new contact creation
    const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const leadOriginVal = updates.leadOrigin || updates.original_source || updates.originalSource || updates['Lead Origin'] || updates.Source || updates.source || 'Incoming';
    const currentSourceVal = updates.currentSource || updates.callSource || updates['Current Source'] || updates.Source || updates.source || leadOriginVal;
    const targetCalledForVal = updates.calledFor || updates['Called For'] || '';

    const historyItem = {
      callId,
      attenderId: cleanAttenderId,
      attenderName:      cleanAttenderName || '',
      callAttenderId:    cleanAttenderId,
      callAttenderName:  cleanAttenderName || '',
      leadOwnerAtTime:   cleanAttenderId,
      leadOwnerNameAtTime: cleanAttenderName || '',
      callDirection:     'incoming',
      callPurpose:       (updates.callPurpose || (updates.status === 'Query' ? 'QUERY' : 'SALES')).toUpperCase(),
      callStatus:        updates.callStatus || 'Connected',
      status:            updates.status || 'Pending',
      queryStatus:       updates.queryStatus || null,
      remark:            updates.remark || '',
      callbackDate:      updates.callbackDate || null,
      callbackTime:      updates.callbackTime || null,
      calledFor:         targetCalledForVal,
      leadOrigin:        leadOriginVal,
      original_source:   leadOriginVal,
      originalSource:    leadOriginVal,
      currentSource:     currentSourceVal,
      source:            currentSourceVal,
      callSource:        currentSourceVal,
      timestamp:         nowIso,
    };

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
      leadOrigin: leadOriginVal,
      original_source: leadOriginVal,
      originalSource:  leadOriginVal,
      currentSource:   currentSourceVal,
      source:          currentSourceVal,
      Source:          currentSourceVal,
      programId:   programId   || 'incoming',
      programName: programName || 'Incoming Calls',
      pipelineStage: '1. New Lead',
      leadOwner:     cleanAttenderId,
      leadOwnerName: cleanAttenderName || '',
      ownerHistory:  [],
      programRelationships: [],
      assignedTo:    [cleanAttenderId],
      isAssigned:    true,
      assignedName:  cleanAttenderName || '',
      assignedAt:    nowIso,
      attenderId: cleanAttenderId,
      attenderName:  cleanAttenderName || '',
      attenderStates: {
        [cleanAttenderId]: {
          attenderId: cleanAttenderId,
          attenderName:  cleanAttenderName || '',
          callDirection: 'incoming',
          callPurpose:   (updates.callPurpose || (updates.status === 'Query' ? 'QUERY' : 'SALES')).toUpperCase(),
          callStatus:    updates.callStatus || 'Connected',
          status:        updates.status || 'Pending',
          remark:        updates.remark || '',
          callbackDate:  updates.callbackDate || null,
          callbackTime:  updates.callbackTime || null,
          lastCalledAt:  nowIso,
          calledFor:     targetCalledForVal,
          leadOrigin:    leadOriginVal,
          original_source: leadOriginVal,
          currentSource: currentSourceVal,
          source:        currentSourceVal,
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      history:   [historyItem],
    };

    const insertResult = await db.collection('contacts').insertOne(newContact);
    const insertedIdStr = insertResult.insertedId.toString();

    // 3. Concurrency self-healing check (race condition protection)
    if (queryFilter) {
      const matches = await db.collection('contacts')
        .find(queryFilter, { projection: { _id: 1, createdAt: 1 } })
        .sort({ createdAt: 1 })
        .toArray();

      if (matches.length > 1) {
        const earliestContact = matches[0];
        if (earliestContact._id.toString() !== insertedIdStr) {
          console.warn(`[CONCURRENCY RACE HANDLED] Duplicate detected post-insert for ${phoneVal || mobileVal}. Deleting ${insertedIdStr} and merging into ${earliestContact._id.toString()}`);
          await db.collection('contacts').deleteOne({ _id: insertResult.insertedId });

          const logRes = await executeLogCall(db, {
            contactId: earliestContact._id.toString(),
            attenderId: cleanAttenderId,
            attenderName: cleanAttenderName,
            programId: programId || 'incoming',
            programName: programName || 'Incoming Calls',
            callType: updates.callType || 'incoming',
            status: updates.status || 'Pending',
            remark: updates.remark || '',
            calledFor: updates.calledFor || updates['Called For'] || '',
            callbackDate: updates.callbackDate || null,
            callbackTime: updates.callbackTime || null,
            callPurpose: updates.callPurpose || (updates.status === 'Query' ? 'QUERY' : 'SALES'),
            ...updates
          });

          return res.status(200).json({
            success: true,
            contactId: earliestContact._id.toString(),
            id: earliestContact._id.toString(),
            isMerged: true,
            updatedContact: logRes.updatedContact || null,
            ...logRes
          });
        }
      }
    }

    const createdDoc = await db.collection('contacts').findOne({ _id: insertResult.insertedId });
    const formattedCreatedDoc = createdDoc
      ? { ...createdDoc, id: createdDoc._id.toString(), _id: createdDoc._id.toString() }
      : null;

    return res.status(200).json({
      success: true,
      contactId: insertedIdStr,
      id: insertedIdStr,
      isMerged: false,
      updatedContact: formattedCreatedDoc
    });

  } catch (error) {
    console.error('[CREATE-INCOMING ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
