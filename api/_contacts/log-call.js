// api/_contacts/log-call.js
// V2 Architecture: QUERY/REMINDER never change pipelineStage.
// Alumni evidence writes to programRelationships[]. leadOwner is separate from callAttender.
import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { normalizeCalledForKey } from '../lib/calledForNormalizer.js';

// ── Constants ───────────────────────────────────────────────────────────────

const UNCONNECTED_CALL_STATUSES = [
  "Not Connected", "Not Picked Up", "Busy", "Call Cut", "Switched Off",
  "No Network", "NA", "no answer", "Not Attended",
];

const INVALID_NUMBER_STATUSES = [
  "Invalid Number", "Invalid No", "Wrong No", "wrong no.", "Called by mistake",
];

const LEGACY_NON_PIPELINE_STAGES = new Set([
  "Query Desk", "Existing Alumni", "Alumni", "Query",
]);

const STAGE_RANKS = {
  "1. New Lead": 1, "New Lead": 1,
  "2. Attempting Contact": 2, "Attempting Contact": 2, "Attempting": 2,
  "3. Information Given": 3, "Information Given": 3, "Info Given": 3,
  "Previous Program Pending": 3.2,
  "4. Nurture / Interested": 4, "Nurture / Interested": 4, "Interested": 4,
  "5. Future Pool": 5, "Future Pool": 5, "Next Time": 5,
  "6. Registered / Won": 6, "Registered / Won": 6, "Reg.Done": 6, "Registered": 6,
  "Closed / Lost": 7, "Closed / Invalid": 7,
  "Query Desk": 3.5, "Query": 3.5,
  "Existing Alumni": 6, "Alumni": 6,
};

// ── Pipeline helpers ─────────────────────────────────────────────────────────

function canTransitionServer(fromStage, toStage, event = {}) {
  if (!fromStage && toStage) return true;
  if (!fromStage && !toStage) return true;
  const fromRank = fromStage ? (STAGE_RANKS[fromStage] || 0) : 0;
  const toRank   = toStage   ? (STAGE_RANKS[toStage]   || 0) : 0;
  if (fromStage === toStage || fromRank === toRank) return true;
  if (fromStage === "Previous Program Pending" || toStage === "Previous Program Pending") return true;
  if (LEGACY_NON_PIPELINE_STAGES.has(fromStage)) return true;
  const isConnected = event.callStatus === "Connected" ||
    ["Info Given", "Interested", "Reg.Done", "Next Time", "Previous Program Pending"].includes(event.purposeOutcome || event.status);
  if (fromRank === 7 && isConnected) return true;
  if (event.closedReason?.includes("Automated")) return fromRank <= 2;
  if (fromRank > 1 && toRank < fromRank) return false;
  return true;
}

function getEffectiveStageServer(lead, targetProgram = null) {
  let programKey = targetProgram ? normalizeCalledForKey(targetProgram) : null;

  // 1. Direct O(1) lookup from programStates if targetProgram is supplied
  if (programKey && lead.programStates) {
    for (const attId of Object.keys(lead.programStates)) {
      const pMap = lead.programStates[attId];
      if (pMap && typeof pMap === 'object') {
        const found = Object.values(pMap).find(entry => {
          const entryKey = entry.programKey || normalizeCalledForKey(entry.program);
          return entryKey === programKey;
        });
        if (found?.pipelineStage) return found.pipelineStage;
      }
    }
  }

  const history = Array.isArray(lead.history) ? lead.history : [];
  let highestRank = 0;
  let stage = null;

  for (const h of history) {
    const callPurpose = (h.callPurpose || "").toUpperCase();
    if (callPurpose && callPurpose !== "SALES") continue; // Only SALES events affect pipeline

    if (programKey) {
      const hProg = h.calledFor || h.called_for || h["Called For"] || "";
      const hKey = normalizeCalledForKey(hProg);
      if (hKey && hKey !== programKey) continue; // Skip calls for OTHER programs!
    }

    const outcome = (h.status || h.purposeOutcome || "").trim().toLowerCase();
    let hStage = null;
    if (outcome === "info given" || outcome === "info")    hStage = "3. Information Given";
    else if (outcome === "previous program pending")        hStage = "Previous Program Pending";
    else if (outcome === "interested")                      hStage = "4. Nurture / Interested";
    else if (outcome === "next time")                       hStage = "5. Future Pool";
    else if (outcome === "reg.done" || outcome === "registered") hStage = "6. Registered / Won";
    else if (["not interested", "not possible"].includes(outcome)) hStage = "Closed / Lost";

    if (hStage) {
      const hRank = STAGE_RANKS[hStage] || 0;
      if (hRank > highestRank) { highestRank = hRank; stage = hStage; }
    }
  }
  return stage;
}

function evaluateStageServer(lead, callEvent) {
  const targetProg = callEvent.calledFor || lead['Called For'] || lead.calledFor || null;
  const currentStage = getEffectiveStageServer(lead, targetProg);
  const currentRank  = currentStage ? (STAGE_RANKS[currentStage] || 0) : 0;

  const purpose    = (callEvent.callPurpose || "SALES").toUpperCase();
  const callStatus = (callEvent.callStatus || callEvent.status || "").trim();
  const outcome    = (callEvent.purposeOutcome || callEvent.status || "").trim();
  const sLower     = outcome.toLowerCase();

  let attemptCount = Number(lead.attemptCount || 0);
  const isUnconnected = UNCONNECTED_CALL_STATUSES.some(
    s => s.toLowerCase() === callStatus.toLowerCase() || s.toLowerCase() === sLower
  );
  const isInvalidNum = INVALID_NUMBER_STATUSES.some(
    s => s.toLowerCase() === callStatus.toLowerCase() || s.toLowerCase() === sLower
  );
  if (isUnconnected && purpose === "SALES") attemptCount += 1;

  let targetStage              = currentStage || null;
  let closedReason             = null;
  let isAttenderCreditEligible = false;
  let wasConnected             = lead.wasConnected || false;
  let programRelationshipUpdate = null; // { status, program } written by API layer

  // INVALID NUMBER
  if (isInvalidNum) {
    targetStage  = "Closed / Invalid";
    closedReason = "Invalid / Wrong Number";
    wasConnected = false;
  }
  let evaluatedQueryStatus = null;

  // QUERY — NEVER changes pipelineStage
  if (purpose === "QUERY") {
    targetStage = currentStage || null;
    if (callStatus === "Connected") wasConnected = true;
    if (isUnconnected) {
      evaluatedQueryStatus = "Attempting Query";
    } else {
      const qNorm = String(callEvent.queryStatus || callEvent.status || "").trim().toLowerCase();
      if (qNorm === "solved" || qNorm === "query solved") {
        evaluatedQueryStatus = "Query Solved";
      } else {
        evaluatedQueryStatus = "Query Pending";
      }
    }
  }
  // REMINDER — NEVER changes pipelineStage
  else if (purpose === "REMINDER") {
    targetStage = currentStage || null;
    if (callStatus === "Connected") wasConnected = true;
  }
  // SALES outcomes
  else if (sLower === "reg.done" || sLower === "registered") {
    targetStage              = "6. Registered / Won";
    isAttenderCreditEligible = true;
    wasConnected             = true;
  }
  else if (["already reg.d", "already registered", "shivir done", "shivir already done"].includes(sLower)) {
    // Alumni evidence: write to programRelationships[] only; pipelineStage unchanged
    targetStage               = currentStage || null;
    wasConnected              = true;
    programRelationshipUpdate = { status: "Existing Alumni" };
  }
  else if (sLower === "previous program pending") {
    targetStage  = "Previous Program Pending";
    attemptCount = 0;
    wasConnected = true;
  }
  else if (["not interested", "not possible"].includes(sLower)) {
    targetStage  = "Closed / Lost";
    closedReason = "Not Interested / Opt-Out";
    wasConnected = true;
  }
  else if (sLower === "next time") {
    targetStage  = "5. Future Pool";
    attemptCount = 0;
    wasConnected = true;
  }
  else if (sLower === "interested") {
    targetStage  = "4. Nurture / Interested";
    attemptCount = 0;
    wasConnected = true;
  }
  else if (sLower === "info given" || sLower === "info") {
    targetStage  = "3. Information Given";
    attemptCount = 0;
    wasConnected = true;
  }
  else if (isUnconnected) {
    if (attemptCount >= 5 && currentRank <= 2 && currentRank > 0) {
      targetStage  = "Closed / Invalid";
      closedReason = "Automated: 5 Unanswered Dial Attempts";
      wasConnected = false;
    } else {
      targetStage = currentRank >= 2 ? currentStage : "2. Attempting Contact";
    }
  }
  else if (purpose === "SALES" && !targetStage) {
    targetStage = "1. New Lead";
  }

  const allowed    = canTransitionServer(currentStage, targetStage, { ...callEvent, closedReason, purposeOutcome: outcome });
  const finalStage = allowed ? targetStage : currentStage;

  return {
    pipelineStage: finalStage,
    queryStatus: evaluatedQueryStatus,
    attemptCount,
    closedReason: allowed ? closedReason : (lead.closedReason || null),
    isAttenderCreditEligible,
    wasConnected,
    programRelationshipUpdate,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

// ── Core Log Call Logic (Callable directly from create-incoming or handler) ──
export async function executeLogCall(db, payload) {
  const {
    contactId, attenderId, attenderName,
    status, remark, callbackDate, callbackTime,
    calledFor, callPurpose, callStatus, queryStatus,
    queryDetails, previousProgram,
    ...rootUpdates
  } = payload;

  if (!contactId || !attenderId) {
    throw new Error('contactId and attenderId are required');
  }

  const queryId = ObjectId.isValid(contactId) ? new ObjectId(contactId) : contactId;
  const existingContact = await db.collection('contacts').findOne({
    $or: [{ _id: queryId }, { id: contactId }, { _id: contactId }]
  });

  if (!existingContact) {
    throw new Error('Contact not found');
  }

  // ── Direction ──────────────────────────────────────────────────────────
  const rawType      = String(rootUpdates.callType || "outgoing").toLowerCase();
  const callDirection = rawType.includes("incoming") ? "incoming" : "outgoing";

  // ── Purpose ────────────────────────────────────────────────────────────
  const callPurposeClean = (
    callPurpose ||
    (status === "Query" ? "QUERY" :
      String(calledFor || "").toLowerCase().includes("reminder") ? "REMINDER" : "SALES")
  ).toUpperCase();

  const callStatusClean = callStatus || (
    ["Invalid Number", "Invalid No", "Wrong No", "wrong no.", "Called by mistake"].includes(status)
      ? "Invalid Number"
      : ["NA", "Busy", "Call Cut", "switched off", "no answer", "Not Connected", "Not Picked Up"].includes(status)
      ? "Not Connected"
      : "Connected"
  );

  const targetCalledFor = calledFor || rootUpdates['Called For'] || existingContact['Called For'] || '';

  // ── Evaluate pipeline ──────────────────────────────────────────────────
  const evalResult = evaluateStageServer(existingContact, {
    calledFor:   targetCalledFor,
    callPurpose: callPurposeClean,
    callStatus:  callStatusClean,
    status,
    queryStatus,
  });

  const nowIso = new Date().toISOString();

  // ── Lead Ownership (ADDITIVE — only set if not already set) ────────────
  // The Lead Owner is the first attender who was assigned this contact.
  // It does NOT transfer automatically when a different attender handles a call.
  const currentLeadOwner     = existingContact.leadOwner     || null;
  const currentLeadOwnerName = existingContact.leadOwnerName || null;
  const isNewOwnerAssignment = !currentLeadOwner;

  // ── original_source — immutable ────────────────────────────────────────
  const originalSource = existingContact.original_source ||
    existingContact.originalSource ||
    existingContact.Source || existingContact.source ||
    rootUpdates.original_source || rootUpdates.originalSource ||
    rootUpdates.Source || rootUpdates.source || "Direct Entry";

  const currentCallSource = payload.callSource ||
    rootUpdates.Source || rootUpdates.source ||
    existingContact.Source || existingContact.source || originalSource;

  const resolvedPreviousProgram = previousProgram !== undefined
    ? previousProgram
    : (rootUpdates.previousProgram !== undefined ? rootUpdates.previousProgram : null);

  const callId = 'call_' + Date.now() + '_' + process.hrtime.bigint().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

  // ── Build history item ─────────────────────────────────────────────────
  const historyItem = {
    callId,                                    // unique call event ID
    // Call attender (person who handled THIS call)
    attenderId,
    attenderName: attenderName || '',
    callAttenderId:   attenderId,
    callAttenderName: attenderName || '',
    // Lead owner at time of this call (snapshot for audit trail)
    leadOwnerAtTime:      currentLeadOwner     || attenderId,
    leadOwnerNameAtTime:  currentLeadOwnerName || attenderName || '',
    // Call metadata
    callDirection,
    callPurpose: callPurposeClean,
    callStatus:  callStatusClean,
    status:      status || 'Pending',
    pipelineStage: evalResult.pipelineStage,
    queryStatus: evalResult.queryStatus || queryStatus || null,
    queryDetails: queryDetails || null,
    remark:       remark || queryDetails || '',
    callbackDate: callbackDate || null,
    callbackTime: callbackTime || null,
    calledFor:    calledFor || rootUpdates['Called For'] || existingContact['Called For'] || '',
    callSource:   currentCallSource,
    original_source: originalSource,
    previousProgram: resolvedPreviousProgram,
    timestamp: nowIso,
  };

  // ── Clean rootUpdates ──────────────────────────────────────────────────
  delete rootUpdates.contactId;
  delete rootUpdates.id;
  delete rootUpdates._id;
  delete rootUpdates.history;
  delete rootUpdates.attenderStates;
  delete rootUpdates.programStates;
  delete rootUpdates.programs;
  delete rootUpdates.assignedTo;
  delete rootUpdates.leadOwner;          // ownership never changes via log-call
  delete rootUpdates.leadOwnerName;
  delete rootUpdates.ownerHistory;

  const ownerCalledFor = existingContact.attenderStates?.[existingContact.leadOwner]?.calledFor ||
                         existingContact['Called For'] || existingContact.calledFor || '';

  const isNonOwnerSharedCall = !!(
    existingContact.leadOwner &&
    existingContact.leadOwner !== attenderId &&
    Array.isArray(existingContact.assignedTo) &&
    existingContact.assignedTo.length > 1
  );

  const isSameCalledFor = !targetCalledFor || !ownerCalledFor ||
    normalizeCalledForKey(targetCalledFor) === normalizeCalledForKey(ownerCalledFor);

  if (isNonOwnerSharedCall) {
    delete rootUpdates['Called For'];
    delete rootUpdates.calledFor;
    delete rootUpdates.Source;
    delete rootUpdates.source;
  }

  // Normalize phone numbers if modified
  if (rootUpdates.Phone || rootUpdates.phone) {
    const p = String(rootUpdates.Phone || rootUpdates.phone).trim();
    rootUpdates.Phone = p;
    rootUpdates.phone = p;
    rootUpdates.normalizedPhone = p.replace(/\D/g, "");
  }

  const currentStageInDb = existingContact.pipelineStage || "1. New Lead";

  // ── $set payload ───────────────────────────────────────────────────────
  const setPayload = {
    ...rootUpdates,
    pipelineStage: evalResult.pipelineStage,
    queryStatus:   evalResult.queryStatus || queryStatus || null,
    callPurpose:   callPurposeClean,
    status:        status || callStatusClean || 'Connected',
    callType:      callDirection,
    attemptCount:  evalResult.attemptCount,
    isAttenderCreditEligible: evalResult.isAttenderCreditEligible,
    closedReason: evalResult.closedReason,
    wasConnected: evalResult.wasConnected || existingContact.wasConnected || false,
    original_source: originalSource,
    updatedAt: nowIso,
    isAssigned: true,
    // Per-attender state (call-specific snapshot)
    [`attenderStates.${attenderId}`]: {
      attenderId,
      attenderName:  attenderName || '',
      callDirection,
      callPurpose:  callPurposeClean,
      callStatus:   callStatusClean,
      status:       status || callStatusClean || 'Connected',
      pipelineStage: evalResult.pipelineStage,
      queryStatus:  evalResult.queryStatus || queryStatus || null,
      queryDetails: queryDetails || null,
      remark:       remark || queryDetails || '',
      callbackDate: callbackDate || null,
      callbackTime: callbackTime || null,
      lastCalledAt: nowIso,
      calledFor:    targetCalledFor || existingContact['Called For'] || '',
      source:       currentCallSource,
      original_source: originalSource,
      previousProgram: resolvedPreviousProgram,
    },
  };

  const currentProgKey = normalizeCalledForKey(targetCalledFor || existingContact['Called For'] || '');
  if (attenderId && currentProgKey) {
    const progStateObj = {
      attenderId,
      attenderName:  attenderName || '',
      programKey:    currentProgKey,
      program:       targetCalledFor || existingContact['Called For'] || '',
      pipelineStage: evalResult.pipelineStage,
      status:        status || callStatusClean || 'Connected',
      callPurpose:   callPurposeClean,
      callStatus:    callStatusClean,
      queryStatus:   evalResult.queryStatus || queryStatus || null,
      remark:        remark || queryDetails || '',
      callbackDate:  callbackDate || null,
      callbackTime:  callbackTime || null,
      source:        currentCallSource,
      updatedAt:     nowIso
    };
    setPayload[`programs.${currentProgKey}.${attenderId}`] = progStateObj;
    setPayload[`programStates.${attenderId}.${currentProgKey}`] = progStateObj;
  }

  if (resolvedPreviousProgram !== undefined) {
    setPayload.previousProgram = resolvedPreviousProgram;
  }

  if (!isNonOwnerSharedCall) {
    setPayload.callPurpose = callPurposeClean;
    setPayload.callStatus = callStatusClean;
    setPayload.status = status || existingContact.status || 'Pending';
    setPayload.queryStatus = evalResult.queryStatus || queryStatus || existingContact.queryStatus || null;
    setPayload.queryDetails = queryDetails || existingContact.queryDetails || null;
    setPayload.Source = currentCallSource;
    setPayload.source = currentCallSource;
    if (calledFor || rootUpdates['Called For']) {
      setPayload['Called For'] = calledFor || rootUpdates['Called For'];
      setPayload.calledFor = calledFor || rootUpdates['Called For'];
    }
  } else if (isSameCalledFor) {
    // If working on the SAME program, update status/callPurpose on root for visibility
    setPayload.callPurpose = callPurposeClean;
    setPayload.callStatus = callStatusClean;
    setPayload.status = status || existingContact.status || 'Pending';
  }

  // Set leadOwner only on FIRST assignment (additive — never overwrites)
  if (isNewOwnerAssignment) {
    setPayload.leadOwner     = attenderId;
    setPayload.leadOwnerName = attenderName || '';
  }

  // Conditionally update pipelineStage (only if same program OR lead owner call)
  const stageChanged = evalResult.pipelineStage !== currentStageInDb;
  const shouldUpdateRootStage = !isNonOwnerSharedCall || isSameCalledFor;
  if (shouldUpdateRootStage && stageChanged && canTransitionServer(currentStageInDb, evalResult.pipelineStage, {
    callStatus: callStatusClean,
    status,
    closedReason: evalResult.closedReason,
  })) {
    setPayload.pipelineStage = evalResult.pipelineStage;
  }

  // ── programRelationships[] — ATOMIC merge strategy ────────────────────
  const calledForKey    = normalizeCalledForKey(targetCalledFor);
  const contactStrId    = String(existingContact._id || contactId);

  const hasProgramRelUpdate = !!(evalResult.programRelationshipUpdate && targetCalledFor);

  if (hasProgramRelUpdate) {
    setPayload.pendingProgramRelationship = {
      program:    targetCalledFor,
      calledForKey,
      status:     evalResult.programRelationshipUpdate.status,
      evidenceCallId: callId,
      pendingAt:  nowIso,
    };
  } else {
    setPayload.pendingProgramRelationship = null;
  }

  const updateOps = {
    $set:      setPayload,
    $addToSet: { assignedTo: attenderId },
    $push:     { history: historyItem },
  };

  const updateResult = await db.collection('contacts').updateOne(
    { $or: [{ _id: queryId }, { id: contactId }, { _id: contactId }] },
    updateOps
  );

  // ── Atomic programRelationships array swap ─────────────────────────────
  if (targetCalledFor && calledForKey) {
    const relEntry = {
      program:        targetCalledFor,
      status:         evalResult.programRelationshipUpdate ? evalResult.programRelationshipUpdate.status : (status || evalResult.pipelineStage),
      pipelineStage:  evalResult.pipelineStage,
      calledForKey,
      updatedAt:      nowIso,
      evidenceCallId: callId,
    };
    const contactQuery = { $or: [{ _id: queryId }, { id: contactId }] };
    try {
      await db.collection('contacts').updateOne(
        contactQuery,
        { $pull: { programRelationships: { calledForKey } } }
      );
      await db.collection('contacts').updateOne(
        contactQuery,
        {
          $push: { programRelationships: relEntry },
          $set:  { pendingProgramRelationship: null },
        }
      );
    } catch (prErr) {
      console.warn('[LOG-CALL] programRelationship write failed for', contactStrId, prErr.message);
    }
  }

  // ── Registrations collection ───────────────────────────────────────────
  if (status === "Reg.Done") {
    const cleanRegCalledFor = targetCalledFor.includes(",")
      ? targetCalledFor.split(",")[0].trim()
      : targetCalledFor;
    const regCalledForKey = normalizeCalledForKey(cleanRegCalledFor);
    const regId = `reg_${contactStrId}_${regCalledForKey}`;
    try {
      await db.collection('registrations').updateOne(
        { registrationId: regId },
        {
          $set: {
            registrationId: regId,
            contactId:   contactStrId,
            calledForKey: regCalledForKey,
            calledFor:   cleanRegCalledFor,
            name:        existingContact.Name || existingContact.name || rootUpdates.Name || '',
            phone:       existingContact.Phone || existingContact.phone || rootUpdates.Phone || '',
            attenderId,
            attenderName: attenderName || '',
            leadOwner:   currentLeadOwner || attenderId,
            original_source: originalSource,
            createdAt:   nowIso,
            updatedAt:   nowIso,
          },
        },
        { upsert: true }
      );
      const regRelEntry = {
        program: cleanRegCalledFor,
        status:  'Registered / Won',
        calledForKey: regCalledForKey,
        registrationId: regId,
        updatedAt: nowIso,
        evidenceCallId: callId,
      };
      const contactQuery = { $or: [{ _id: queryId }, { id: contactId }] };
      await db.collection('contacts').updateOne(
        contactQuery,
        { $pull: { programRelationships: { calledForKey: regCalledForKey } } }
      );
      await db.collection('contacts').updateOne(
        contactQuery,
        {
          $push: { programRelationships: regRelEntry },
          $set:  { pendingProgramRelationship: null },
        }
      );
    } catch (regErr) {
      if (regErr.code === 11000 || regErr.message?.includes('E11000')) {
        console.warn('[REGISTRATION DUP] Gracefully handled duplicate for:', contactStrId, regCalledForKey);
      } else {
        throw regErr;
      }
    }
  } else if (
    callPurposeClean === 'SALES' &&
    existingContact.status === 'Reg.Done' &&
    ['Not Interested', 'Wrong No', 'Called by mistake', 'Not possible'].includes(status)
  ) {
    await db.collection('registrations').deleteMany({
      $or: [
        { contactId: contactStrId, calledForKey },
        { registrationId: `reg_${contactStrId}_${calledForKey}` },
      ],
    });
  }

  // ── Return updated contact ─────────────────────────────────────────────
  const updatedDoc = await db.collection('contacts').findOne({ _id: existingContact._id });
  const formattedDoc = updatedDoc
    ? { ...updatedDoc, id: updatedDoc._id.toString(), _id: updatedDoc._id.toString() }
    : null;

  return {
    success:       true,
    modifiedCount: updateResult.modifiedCount,
    pipelineStage: evalResult.pipelineStage,
    attemptCount:  evalResult.attemptCount,
    callId,
    loggedHistory: historyItem,
    updatedContact: formattedDoc,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const client = await clientPromise;
    const db     = client.db('tgf_crm');
    const result = await executeLogCall(db, req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[LOG-CALL ERROR]', error);
    const statusCode = error.message === 'Contact not found' ? 404 : (error.message?.includes('required') ? 400 : 500);
    return res.status(statusCode).json({ success: false, error: error.message });
  }
}
