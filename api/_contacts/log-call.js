// api/_contacts/log-call.js
// V2 Architecture: QUERY/REMINDER never change pipelineStage.
// Alumni evidence writes to programRelationships[]. leadOwner is separate from callAttender.
import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { normalizeCalledForKey } from '../lib/calledForNormalizer.js';

// ── Constants ───────────────────────────────────────────────────────────────

const UNCONNECTED_CALL_STATUSES = [
  "Not Picked Up", "Busy", "Call Cut", "Switched Off",
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
  "4. Nurture / Interested": 4, "Nurture / Interested": 4, "Interested": 4,
  "5. Future Pool": 5, "Future Pool": 5, "Next Time": 5,
  "6. Registered / Won": 6, "Registered / Won": 6, "Reg.Done": 6, "Registered": 6,
  "Closed / Lost": 7, "Closed / Invalid": 7,
  "Query Desk": 3.5, "Query": 3.5,
  "Existing Alumni": 6, "Alumni": 6,
};

// ── Pipeline helpers ─────────────────────────────────────────────────────────

function canTransitionServer(fromStage, toStage, event = {}) {
  const fromRank = STAGE_RANKS[fromStage] || 1;
  const toRank   = STAGE_RANKS[toStage]   || 1;
  if (fromStage === toStage || fromRank === toRank) return true;
  if (LEGACY_NON_PIPELINE_STAGES.has(fromStage)) return true;
  const isConnected = event.callStatus === "Connected" ||
    ["Info Given", "Interested", "Reg.Done", "Next Time"].includes(event.purposeOutcome || event.status);
  if (fromRank === 7 && isConnected) return true;
  if (event.closedReason?.includes("Automated")) return fromRank <= 2;
  if (fromRank > 1 && toRank < fromRank) return false;
  return true;
}

function getEffectiveStageServer(lead) {
  const current  = lead.pipelineStage || "1. New Lead";
  const isLegacy = LEGACY_NON_PIPELINE_STAGES.has(current);
  let highestRank = isLegacy ? 1 : (STAGE_RANKS[current] || 1);
  let stage       = isLegacy ? "1. New Lead" : current;

  const history = Array.isArray(lead.history) ? lead.history : [];
  for (const h of history) {
    const callPurpose = (h.callPurpose || "").toUpperCase();
    if (callPurpose && callPurpose !== "SALES") continue; // Only SALES events affect pipeline

    const outcome = (h.status || h.purposeOutcome || "").trim().toLowerCase();
    let hStage = null;
    if (outcome === "info given" || outcome === "info")    hStage = "3. Information Given";
    else if (outcome === "interested")                      hStage = "4. Nurture / Interested";
    else if (outcome === "next time")                       hStage = "5. Future Pool";
    else if (outcome === "reg.done" || outcome === "registered") hStage = "6. Registered / Won";
    else if (["not interested", "not possible"].includes(outcome)) hStage = "Closed / Lost";
    // "already reg.d" / "shivir done" → programRelationships[] only, NOT pipeline

    if (hStage) {
      const hRank = STAGE_RANKS[hStage] || 1;
      if (hRank > highestRank) { highestRank = hRank; stage = hStage; }
    }
  }
  return stage;
}

function evaluateStageServer(lead, callEvent) {
  const currentStage = getEffectiveStageServer(lead);
  const currentRank  = STAGE_RANKS[currentStage] || 1;

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
  if (isUnconnected) attemptCount += 1;

  let targetStage              = currentStage;
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
  // QUERY — NEVER changes pipelineStage
  else if (purpose === "QUERY") {
    targetStage = currentStage;
    if (callStatus === "Connected") wasConnected = true;
  }
  // REMINDER — NEVER changes pipelineStage
  else if (purpose === "REMINDER") {
    targetStage = currentStage;
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
    targetStage               = currentStage;
    wasConnected              = true;
    programRelationshipUpdate = { status: "Existing Alumni" };
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
    if (attemptCount >= 5 && currentRank <= 2) {
      targetStage  = "Closed / Invalid";
      closedReason = "Automated: 5 Unanswered Dial Attempts";
      wasConnected = false;
    } else {
      targetStage = currentRank >= 2 ? currentStage : "2. Attempting Contact";
    }
  }

  const allowed    = canTransitionServer(currentStage, targetStage, { ...callEvent, closedReason, purposeOutcome: outcome });
  const finalStage = allowed ? targetStage : currentStage;

  return {
    pipelineStage: finalStage,
    attemptCount,
    closedReason: allowed ? closedReason : (lead.closedReason || null),
    isAttenderCreditEligible,
    wasConnected,
    programRelationshipUpdate,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      contactId, attenderId, attenderName,
      status, remark, callbackDate, callbackTime,
      calledFor, callPurpose, callStatus, queryStatus,
      queryDetails,
      ...rootUpdates
    } = req.body;

    if (!contactId || !attenderId) {
      return res.status(400).json({ error: 'contactId and attenderId are required' });
    }

    const client = await clientPromise;
    const db     = client.db('tgf_crm');

    const queryId = ObjectId.isValid(contactId) ? new ObjectId(contactId) : contactId;
    const existingContact = await db.collection('contacts').findOne({
      $or: [{ _id: queryId }, { id: contactId }, { _id: contactId }]
    });

    if (!existingContact) {
      return res.status(404).json({ error: 'Contact not found' });
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
      ["NA", "Busy", "Call Cut", "switched off", "Invalid No", "no answer"].includes(status)
        ? "Not Picked Up"
        : "Connected"
    );

    // ── Evaluate pipeline ──────────────────────────────────────────────────
    const evalResult = evaluateStageServer(existingContact, {
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
      existingContact.Source || existingContact.source ||
      rootUpdates.Source || rootUpdates.source || "Direct Entry";

    // ── Build callId ───────────────────────────────────────────────────────
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
      queryStatus: queryStatus || null,
      queryDetails: queryDetails || null,
      remark:       remark || '',
      callbackDate: callbackDate || null,
      callbackTime: callbackTime || null,
      calledFor:    calledFor || rootUpdates['Called For'] || existingContact['Called For'] || '',
      original_source: originalSource,
      timestamp: nowIso,
    };

    // ── Clean rootUpdates ──────────────────────────────────────────────────
    delete rootUpdates.contactId;
    delete rootUpdates.id;
    delete rootUpdates._id;
    delete rootUpdates.history;
    delete rootUpdates.attenderStates;
    delete rootUpdates.assignedTo;
    delete rootUpdates.leadOwner;          // ownership never changes via log-call
    delete rootUpdates.leadOwnerName;
    delete rootUpdates.ownerHistory;

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
      callType:    callDirection,
      callPurpose: callPurposeClean,
      callStatus:  callStatusClean,
      status:      status || existingContact.status || 'Pending',
      attemptCount: evalResult.attemptCount,
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
        status:       status || 'Pending',
        remark:       remark || '',
        callbackDate: callbackDate || null,
        callbackTime: callbackTime || null,
        lastCalledAt: nowIso,
        calledFor:    calledFor || rootUpdates['Called For'] || existingContact['Called For'] || '',
      },
    };

    // Set leadOwner only on FIRST assignment (additive — never overwrites)
    if (isNewOwnerAssignment) {
      setPayload.leadOwner     = attenderId;
      setPayload.leadOwnerName = attenderName || '';
    }

    // Conditionally update pipelineStage (only if a valid forward transition occurred)
    const stageChanged = evalResult.pipelineStage !== currentStageInDb;
    if (stageChanged && canTransitionServer(currentStageInDb, evalResult.pipelineStage, {
      callStatus: callStatusClean,
      status,
      closedReason: evalResult.closedReason,
    })) {
      setPayload.pipelineStage = evalResult.pipelineStage;
    }

    // ── programRelationships[] — ATOMIC merge strategy ────────────────────
    //
    // MongoDB does not allow $pull and $push on the same array in one op.
    // Strategy: use a pendingProgramRelationship sentinel field written with
    // the main update. A second op completes the array swap.
    // If the second op crashes, the sentinel is detectable and retryable
    // by a reconciliation sweep without data loss.
    //
    const targetCalledFor = calledFor || rootUpdates['Called For'] || existingContact['Called For'] || '';
    const calledForKey    = normalizeCalledForKey(targetCalledFor);
    const contactStrId    = String(existingContact._id || contactId);

    const hasProgramRelUpdate = !!(evalResult.programRelationshipUpdate && targetCalledFor);

    // If we need a programRelationship update, embed the pending intent with the
    // main write so it is always recorded even if the array-swap op fails.
    if (hasProgramRelUpdate) {
      setPayload.pendingProgramRelationship = {
        program:    targetCalledFor,
        calledForKey,
        status:     evalResult.programRelationshipUpdate.status,
        evidenceCallId: callId,
        pendingAt:  nowIso,
      };
    } else {
      // Clear any stale sentinel (idempotent safety)
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
    // Two-op swap: pull old entry then push new entry.
    // If pull succeeds but push fails → sentinel remains → detectable.
    // Reconciliation can re-run this block idempotently.
    if (hasProgramRelUpdate) {
      const relEntry = {
        program:        targetCalledFor,
        status:         evalResult.programRelationshipUpdate.status,
        calledForKey,
        updatedAt:      nowIso,
        evidenceCallId: callId,
      };
      const contactQuery = { $or: [{ _id: queryId }, { id: contactId }] };
      try {
        // Op 1: pull old entry for same program
        await db.collection('contacts').updateOne(
          contactQuery,
          { $pull: { programRelationships: { calledForKey } } }
        );
        // Op 2: push new entry + clear sentinel
        await db.collection('contacts').updateOne(
          contactQuery,
          {
            $push: { programRelationships: relEntry },
            $set:  { pendingProgramRelationship: null },
          }
        );
      } catch (prErr) {
        // Sentinel remains set — reconciliation will retry this contact.
        // Main call log is already saved — no data lost.
        console.warn('[LOG-CALL] programRelationship write failed for', contactStrId, prErr.message);
        console.warn('[LOG-CALL] Sentinel pendingProgramRelationship is set — reconciliation required.');
      }
    }

    // ── Registrations collection ───────────────────────────────────────────
    if (status === "Reg.Done") {
      const regId = `reg_${contactStrId}_${calledForKey}`;
      try {
        await db.collection('registrations').updateOne(
          { registrationId: regId },
          {
            $set: {
              registrationId: regId,
              contactId:   contactStrId,
              calledForKey,
              calledFor:   targetCalledFor,
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
        // programRelationships: Registered / Won
        const regRelEntry = {
          program: targetCalledFor,
          status:  'Registered / Won',
          calledForKey,
          registrationId: regId,
          updatedAt: nowIso,
          evidenceCallId: callId,
        };
        const contactQuery = { $or: [{ _id: queryId }, { id: contactId }] };
        await db.collection('contacts').updateOne(
          contactQuery,
          { $pull: { programRelationships: { calledForKey } } }
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
          console.warn('[REGISTRATION DUP] Gracefully handled duplicate for:', contactStrId, calledForKey);
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

    return res.status(200).json({
      success:       true,
      modifiedCount: updateResult.modifiedCount,
      pipelineStage: evalResult.pipelineStage,
      attemptCount:  evalResult.attemptCount,
      callId,
      loggedHistory: historyItem,
      updatedContact: formattedDoc,
    });
  } catch (error) {
    console.error('[LOG-CALL ERROR]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
