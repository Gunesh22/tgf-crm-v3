/**
 * Central Automated Pipeline Engine (V2 Architecture)
 *
 * Key architectural rules:
 * - QUERY is a call PURPOSE, not a pipeline stage. Never changes pipelineStage.
 * - REMINDER is a call PURPOSE, not a pipeline stage. Never changes pipelineStage.
 * - Existing Alumni is a PROGRAM RELATIONSHIP, not a person-level pipeline stage.
 * - Follow-up is a task, not a pipeline stage.
 * - Pipeline never regresses from unanswered/unconnected calls for established contacts.
 * - "Already Reg.d" / "Shivir done" outcomes write to programRelationships[], not pipelineStage.
 */

// Core pipeline stages — the ONLY stages the system promotes contacts TO
export const PIPELINE_STAGES = {
  NEW_LEAD:          "1. New Lead",
  ATTEMPTING:        "2. Attempting Contact",
  INFO_GIVEN:        "3. Information Given",
  NURTURE_INTERESTED:"4. Nurture / Interested",
  FUTURE_POOL:       "5. Future Pool",
  REGISTERED_WON:    "6. Registered / Won",
  CLOSED_LOST:       "Closed / Lost",
  CLOSED_INVALID:    "Closed / Invalid",
};

// Legacy stages — recognized for DISPLAY / backward compat but NEVER promoted to
export const LEGACY_DISPLAY_STAGES = {
  QUERY_DESK:      "Query Desk",
  EXISTING_ALUMNI: "Existing Alumni",
};

export const UNCONNECTED_CALL_STATUSES = [
  "Not Picked Up", "Busy", "Call Cut", "Switched Off",
  "No Network", "NA", "no answer", "Not Attended",
];

export const INVALID_NUMBER_STATUSES = [
  "Invalid Number", "Invalid No", "Wrong No", "wrong no.", "Called by mistake",
];

export const STAGE_RANKS = {
  // Core
  "1. New Lead": 1, "New Lead": 1,
  "2. Attempting Contact": 2, "Attempting Contact": 2, "Attempting": 2,
  "3. Information Given": 3, "Information Given": 3, "Info Given": 3,
  "4. Nurture / Interested": 4, "Nurture / Interested": 4, "Interested": 4,
  "5. Future Pool": 5, "Future Pool": 5, "Next Time": 5,
  "6. Registered / Won": 6, "Registered / Won": 6, "Reg.Done": 6, "Registered": 6,
  "Closed / Lost": 7, "Closed / Invalid": 7,
  // Legacy display-only (kept for backward compat with old data; NOT promotion targets)
  "Query Desk": 3.5, "Query": 3.5,
  "Existing Alumni": 6, "Alumni": 6,
};

// Stages that are NOT real sales pipeline stages
// Contacts at these stages allow any forward Sales transition (treat as New Lead for rank checks)
const LEGACY_NON_PIPELINE_STAGES = new Set([
  "Query Desk", "Existing Alumni", "Alumni", "Query",
]);

/**
 * Validates whether a pipeline transition from `fromStage` → `toStage` is permitted.
 */
export function canTransition(fromStage, toStage, event = {}) {
  const fromRank = STAGE_RANKS[fromStage] || 1;
  const toRank   = STAGE_RANKS[toStage]   || 1;

  // Same stage is always valid
  if (fromStage === toStage || fromRank === toRank) return true;

  // Legacy non-pipeline stages: allow any Sales forward movement
  if (LEGACY_NON_PIPELINE_STAGES.has(fromStage)) return true;

  // Reactivation: closed lead receives a connected / positive-outcome call
  const isConnected = event.callStatus === "Connected" ||
    ["Info Given", "Interested", "Reg.Done", "Next Time"].includes(
      event.purposeOutcome || event.status
    );
  if (fromRank === 7 && isConnected) return true;

  // Automated 5-attempt close only applies to uncontacted leads (rank ≤ 2)
  if (event.closedReason?.includes("Automated")) return fromRank <= 2;

  // Block any backward demotion for established contacts
  if (fromRank > 1 && toRank < fromRank) return false;

  return true;
}

/**
 * Derives the highest SALES pipeline stage achieved by a contact.
 *
 * Rules:
 * - Only SALES call events affect the pipeline (callPurpose === "SALES" or absent for legacy).
 * - "Already Reg.d" / "Shivir done" are NOT pipeline promotions; they go to programRelationships[].
 * - Legacy pipelineStage values of "Query Desk" / "Existing Alumni" are treated as New Lead
 *   for rank purposes so a new Sales call can move the contact forward.
 */
export function getEffectiveStage(contact = {}) {
  const current = contact.pipelineStage || PIPELINE_STAGES.NEW_LEAD;
  const isLegacy = LEGACY_NON_PIPELINE_STAGES.has(current);

  let highestRank = isLegacy ? 1 : (STAGE_RANKS[current] || 1);
  let stage       = isLegacy ? PIPELINE_STAGES.NEW_LEAD : current;

  const history = Array.isArray(contact.history) ? contact.history : [];
  for (const h of history) {
    // Only consider SALES events for pipeline; skip QUERY and REMINDER
    const callPurpose = (h.callPurpose || "").toUpperCase();
    if (callPurpose && callPurpose !== "SALES") continue;

    const outcome = (h.status || h.purposeOutcome || "").trim().toLowerCase();
    let hStage = null;

    if (outcome === "info given" || outcome === "info")    hStage = PIPELINE_STAGES.INFO_GIVEN;
    else if (outcome === "interested")                      hStage = PIPELINE_STAGES.NURTURE_INTERESTED;
    else if (outcome === "next time")                       hStage = PIPELINE_STAGES.FUTURE_POOL;
    else if (outcome === "reg.done" || outcome === "registered") hStage = PIPELINE_STAGES.REGISTERED_WON;
    else if (["not interested", "not possible"].includes(outcome)) hStage = PIPELINE_STAGES.CLOSED_LOST;
    // NOTE: "already reg.d", "shivir done" → programRelationships[] only, never pipeline

    if (hStage) {
      const hRank = STAGE_RANKS[hStage] || 1;
      if (hRank > highestRank) { highestRank = hRank; stage = hStage; }
    }
  }

  return stage;
}

/**
 * Evaluates which pipeline stage a contact should be at AFTER a new call event.
 *
 * Returns:
 *   pipelineStage          — new stage (or unchanged)
 *   attemptCount           — updated unconnected attempt count
 *   closedReason           — reason string if closed
 *   isAttenderCreditEligible — true only for Reg.Done
 *   wasConnected           — true if this call or any prior was connected
 *   programRelationshipUpdate — { status, program } if alumni evidence found (API layer writes this)
 */
export function evaluatePipeline(contact = {}, callEvent = {}) {
  const currentStage = getEffectiveStage(contact);
  const currentRank  = STAGE_RANKS[currentStage] || 1;

  const purpose    = (callEvent.callPurpose || "SALES").toUpperCase();
  const callStatus = (callEvent.callStatus || callEvent.status || "").trim();
  const outcome    = (callEvent.purposeOutcome || callEvent.outcome || callEvent.status || "").trim();
  const sLower     = outcome.toLowerCase();

  let attemptCount  = Number(contact.attemptCount || 0);
  const isUnconnected = UNCONNECTED_CALL_STATUSES.some(
    s => s.toLowerCase() === callStatus.toLowerCase() || s.toLowerCase() === sLower
  );
  const isInvalidNum = INVALID_NUMBER_STATUSES.some(
    s => s.toLowerCase() === callStatus.toLowerCase() || s.toLowerCase() === sLower
  );

  if (isUnconnected) attemptCount += 1;

  let targetStage             = currentStage;
  let closedReason            = null;
  let isAttenderCreditEligible = false;
  let wasConnected             = contact.wasConnected || false;
  let programRelationshipUpdate = null;

  // ── INVALID NUMBER ─────────────────────────────────────────────────────────
  if (isInvalidNum) {
    targetStage  = PIPELINE_STAGES.CLOSED_INVALID;
    closedReason = "Invalid / Wrong Number";
    wasConnected = false;
  }

  // ── QUERY — NEVER changes pipelineStage ───────────────────────────────────
  else if (purpose === "QUERY") {
    targetStage = currentStage;                  // Preserve exactly
    if (callStatus === "Connected") wasConnected = true;
  }

  // ── REMINDER — NEVER changes pipelineStage ────────────────────────────────
  else if (purpose === "REMINDER") {
    targetStage = currentStage;                  // Preserve exactly
    if (callStatus === "Connected") wasConnected = true;
  }

  // ── SALES outcomes ─────────────────────────────────────────────────────────
  else if (sLower === "reg.done" || sLower === "registered") {
    targetStage              = PIPELINE_STAGES.REGISTERED_WON;
    isAttenderCreditEligible = true;
    wasConnected             = true;
  }
  else if (["already reg.d", "already registered", "shivir done", "shivir already done"].includes(sLower)) {
    // Alumni evidence → programRelationships[] ONLY, pipelineStage unchanged
    targetStage               = currentStage;
    wasConnected              = true;
    programRelationshipUpdate = { status: "Existing Alumni" };
  }
  else if (["not interested", "not possible"].includes(sLower)) {
    targetStage  = PIPELINE_STAGES.CLOSED_LOST;
    closedReason = "Not Interested / Opt-Out";
    wasConnected = true;
  }
  else if (sLower === "next time") {
    targetStage  = PIPELINE_STAGES.FUTURE_POOL;
    attemptCount = 0;
    wasConnected = true;
  }
  else if (sLower === "interested") {
    targetStage  = PIPELINE_STAGES.NURTURE_INTERESTED;
    attemptCount = 0;
    wasConnected = true;
  }
  else if (sLower === "info given" || sLower === "info") {
    targetStage  = PIPELINE_STAGES.INFO_GIVEN;
    attemptCount = 0;
    wasConnected = true;
  }
  else if (isUnconnected) {
    // 5-attempt auto-close only for uncontacted leads (rank ≤ 2)
    if (attemptCount >= 5 && currentRank <= 2) {
      targetStage  = PIPELINE_STAGES.CLOSED_INVALID;
      closedReason = "Automated: 5 Unanswered Dial Attempts";
      wasConnected = false;
    } else {
      // NEVER demote — keep current stage (or promote New Lead → Attempting)
      targetStage = currentRank >= 2 ? currentStage : PIPELINE_STAGES.ATTEMPTING;
    }
  }

  const allowed    = canTransition(currentStage, targetStage, { ...callEvent, closedReason, purposeOutcome: outcome });
  const finalStage = allowed ? targetStage : currentStage;

  return {
    pipelineStage: finalStage,
    attemptCount,
    closedReason: allowed ? closedReason : (contact.closedReason || null),
    isAttenderCreditEligible,
    wasConnected,
    programRelationshipUpdate,
  };
}

/**
 * Returns true if the contact qualifies for the "Convert to Sales" button.
 * Only shown for genuinely new / query-only contacts (pipeline rank < 3).
 */
export function shouldShowConvertToSales(contact = {}) {
  const stage = getEffectiveStage(contact);
  const rank  = STAGE_RANKS[stage] || 1;
  return rank < 3;
}

/**
 * UI color tokens for all pipeline stages (includes legacy display stages).
 */
export function getPipelineStageConfig(stage) {
  switch (stage) {
    case "1. New Lead":
    case "New Lead":
      return { label: "1. New Lead", bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-700", badge: "bg-slate-100 text-slate-800 border-slate-200" };
    case "2. Attempting Contact":
    case "Attempting Contact":
    case "Attempting":
      return { label: "2. Attempting Contact", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-900 border-amber-300" };
    case "3. Information Given":
    case "Information Given":
    case "Info Given":
      return { label: "3. Information Given", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", badge: "bg-purple-100 text-purple-900 border-purple-300" };
    case "4. Nurture / Interested":
    case "Nurture / Interested":
    case "Interested":
      return { label: "4. Nurture / Interested", bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", badge: "bg-indigo-100 text-indigo-900 border-indigo-300 font-bold" };
    case "5. Future Pool":
    case "Future Pool":
    case "Next Time":
      return { label: "5. Future Pool", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", badge: "bg-blue-100 text-blue-900 border-blue-300" };
    case "6. Registered / Won":
    case "Registered / Won":
    case "Registered":
    case "Reg.Done":
      return { label: "6. Registered / Won", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold" };
    case "Closed / Lost":
      return { label: "Closed / Lost", bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-600", badge: "bg-gray-200 text-gray-700 border-gray-300" };
    case "Closed / Invalid":
      return { label: "Closed / Invalid", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-800 border-rose-200" };
    // Legacy display-only
    case "Query Desk":
    case "Query":
      return { label: "Query Desk (Legacy)", bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", badge: "bg-orange-100 text-orange-900 border-orange-300 font-semibold" };
    case "Existing Alumni":
    case "Alumni":
      return { label: "Existing Alumni (Legacy)", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-800", badge: "bg-cyan-100 text-cyan-900 border-cyan-300" };
    default:
      return { label: stage || "1. New Lead", bg: "bg-gray-100", border: "border-gray-200", text: "text-gray-700", badge: "bg-gray-100 text-gray-700 border-gray-200" };
  }
}
