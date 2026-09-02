// api/_contacts/override-stage.js
import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { PIPELINE_STAGES, STAGE_RANKS, getEffectiveStage } from '../../src/utils/pipelineEngine.js';

const VALID_STAGES = new Set([
  PIPELINE_STAGES.NEW_LEAD,
  PIPELINE_STAGES.ATTEMPTING,
  PIPELINE_STAGES.INFO_GIVEN,
  PIPELINE_STAGES.NURTURE_INTERESTED,
  PIPELINE_STAGES.FUTURE_POOL,
  PIPELINE_STAGES.REGISTERED_WON,
  PIPELINE_STAGES.CLOSED_LOST,
  PIPELINE_STAGES.CLOSED_INVALID,
]);

export function normalizeStageInput(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (VALID_STAGES.has(str)) return str;

  const lower = str.toLowerCase().trim();

  if (lower === "closed / invalid" || lower === "closed invalid" || lower === "invalid" || lower === "invalid number" || lower === "invalid no") return PIPELINE_STAGES.CLOSED_INVALID;
  if (lower === "closed / lost" || lower === "closed lost" || lower === "lost" || lower === "not interested") return PIPELINE_STAGES.CLOSED_LOST;
  if (lower === "1. new lead" || lower === "new lead" || lower === "new") return PIPELINE_STAGES.NEW_LEAD;
  if (lower === "2. attempting contact" || lower === "attempting contact" || lower === "attempting") return PIPELINE_STAGES.ATTEMPTING;
  if (lower === "3. information given" || lower === "information given" || lower === "info given" || lower === "info") return PIPELINE_STAGES.INFO_GIVEN;
  if (lower === "4. nurture / interested" || lower === "nurture / interested" || lower === "nurture" || (lower.includes("interested") && !lower.includes("not"))) return PIPELINE_STAGES.NURTURE_INTERESTED;
  if (lower === "5. future pool" || lower === "future pool" || lower === "future" || lower === "next time") return PIPELINE_STAGES.FUTURE_POOL;
  if (lower === "6. registered / won" || lower === "registered / won" || lower === "registered" || lower === "reg.done" || lower === "won") return PIPELINE_STAGES.REGISTERED_WON;

  return null;
}

export async function executeOverrideStage(db, payload) {
  const {
    contactId,
    newStage: rawNewStage,
    changedBy,
    changedByAttenderId,
    role = "attender",
    reason = "",
    program = ""
  } = payload || {};

  if (!contactId) throw new Error("contactId is required");
  if (!changedByAttenderId) throw new Error("changedByAttenderId is required");

  const canonicalNewStage = normalizeStageInput(rawNewStage);
  if (!canonicalNewStage) {
    throw new Error(`Invalid target pipeline stage: "${rawNewStage}"`);
  }

  const queryId = ObjectId.isValid(contactId) ? new ObjectId(contactId) : contactId;
  const existingContact = await db.collection("contacts").findOne({
    $or: [
      { _id: queryId },
      { _id: String(contactId) },
      { id: String(contactId) }
    ]
  });

  if (!existingContact) {
    throw new Error("Contact not found");
  }

  // Permission Check
  const isAdmin = role === "admin" || String(changedByAttenderId).toLowerCase().includes("admin");
  if (!isAdmin) {
    // Check if attender is authorized for this contact
    const assignedList = Array.isArray(existingContact.assignedTo) ? existingContact.assignedTo : [];
    const isAssigned = assignedList.includes(changedByAttenderId) ||
      existingContact.leadOwner === changedByAttenderId ||
      existingContact.attenderId === changedByAttenderId ||
      (existingContact.attenderStates && existingContact.attenderStates[changedByAttenderId]);

    // Attenders are authorized for assigned or accessible contacts
    if (assignedList.length > 0 && !isAssigned) {
      throw new Error("Unauthorized: Attender is not assigned to this contact");
    }
  }

  const previousStage = getEffectiveStage(existingContact, program) || existingContact.pipelineStage || PIPELINE_STAGES.NEW_LEAD;
  const previousRank = STAGE_RANKS[previousStage] || 0;
  const newRank = STAGE_RANKS[canonicalNewStage] || 0;

  // Attender demotion check: Attenders can reopen closed leads or adjust stage,
  // whereas Admins have unrestricted movement.
  // Both Attenders and Admins are permitted to explicitly override stage as requested.

  const nowIso = new Date().toISOString();
  const overrideCallId = 'override_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const auditHistoryItem = {
    callId: overrideCallId,
    changeType: "MANUAL_STAGE_OVERRIDE",
    contactId: String(existingContact._id || contactId),
    changedBy: changedBy || (isAdmin ? "Admin" : "Attender"),
    changedByAttenderId,
    attenderId: changedByAttenderId,
    attenderName: changedBy || (isAdmin ? "Admin" : "Attender"),
    timestamp: nowIso,
    previousStage,
    newStage: canonicalNewStage,
    reason: reason ? String(reason).trim() : "Manual Stage Override",
    status: "Manual Override",
    remark: `[MANUAL STAGE OVERRIDE] Stage changed from "${previousStage}" to "${canonicalNewStage}" by ${changedBy || (isAdmin ? 'Admin' : 'Attender')}${reason ? `: ${reason}` : ''}`
  };

  const setFields = {
    pipelineStage: canonicalNewStage,
    updatedAt: nowIso,
  };

  if (existingContact.attenderStates && existingContact.attenderStates[changedByAttenderId]) {
    setFields[`attenderStates.${changedByAttenderId}.pipelineStage`] = canonicalNewStage;
    setFields[`attenderStates.${changedByAttenderId}.updatedAt`] = nowIso;
  }

  // Clear closedReason if reopening from Closed to active
  if (previousRank === 7 && newRank < 7) {
    setFields.closedReason = null;
  } else if (newRank === 7) {
    setFields.closedReason = reason || `Manually closed to ${canonicalNewStage}`;
  }

  if (canonicalNewStage === PIPELINE_STAGES.REGISTERED_WON) {
    setFields.isAttenderCreditEligible = true;
  }

  const result = await db.collection("contacts").findOneAndUpdate(
    { _id: existingContact._id },
    {
      $set: setFields,
      $push: { history: auditHistoryItem }
    },
    { returnDocument: "after" }
  );

  // Update programRelationships for target program context if present
  const targetProg = program || existingContact["Called For"] || existingContact.calledFor;
  if (targetProg) {
    const calledForKey = String(targetProg).trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    if (calledForKey) {
      const relEntry = {
        program: targetProg,
        status: canonicalNewStage,
        pipelineStage: canonicalNewStage,
        calledForKey,
        updatedAt: nowIso,
        evidenceCallId: overrideCallId
      };
      try {
        await db.collection("contacts").updateOne(
          { _id: existingContact._id },
          { $pull: { programRelationships: { calledForKey } } }
        );
        await db.collection("contacts").updateOne(
          { _id: existingContact._id },
          { $push: { programRelationships: relEntry } }
        );
      } catch (prErr) {
        console.warn("[OVERRIDE-STAGE] programRelationship write failed:", prErr.message);
      }
    }
  }

  const updatedContact = result.value || result;

  return {
    success: true,
    contactId: String(existingContact._id || contactId),
    previousStage,
    newStage: canonicalNewStage,
    auditHistoryItem,
    contact: updatedContact
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("tgf_crm");
    const result = await executeOverrideStage(db, req.body || {});
    return res.status(200).json(result);
  } catch (err) {
    console.error("[api/_contacts/override-stage error]", err);
    return res.status(400).json({ success: false, error: err.message || "Failed to override pipeline stage" });
  }
}
