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
  "Not Connected", "Not Picked Up", "Busy", "Call Cut", "Switched Off",
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
  if (!fromStage && toStage) return true;
  if (!fromStage && !toStage) return true;
  const fromRank = fromStage ? (STAGE_RANKS[fromStage] || 0) : 0;
  const toRank   = toStage   ? (STAGE_RANKS[toStage]   || 0) : 0;

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
 *   only when evaluating sales pipeline progression.
 * - If no Sales pipeline activity exists, returns null (not "1. New Lead").
 */
export function getEffectiveStage(contact = {}, targetCalledFor = null) {
  const normalizeStageStr = (s) => {
    if (!s) return null;
    const str = String(s).trim();
    if (str === PIPELINE_STAGES.NEW_LEAD || str === "New Lead" || str === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (str === PIPELINE_STAGES.ATTEMPTING || str === "Attempting Contact" || str === "Attempting" || str === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (str === PIPELINE_STAGES.INFO_GIVEN || str === "Information Given" || str === "Info Given" || str === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (str === PIPELINE_STAGES.NURTURE_INTERESTED || str === "Nurture / Interested" || str === "Interested" || str === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (str === PIPELINE_STAGES.FUTURE_POOL || str === "Future Pool" || str === "Next Time" || str === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (str === PIPELINE_STAGES.REGISTERED_WON || str === "Registered / Won" || str === "Reg.Done" || str === "6. Registered / Won" || str === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (str === PIPELINE_STAGES.CLOSED_LOST || str === "Closed / Lost" || str === "Closed Lost" || str === "7. Closed / Lost" || str === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (str === PIPELINE_STAGES.CLOSED_INVALID || str === "Closed / Invalid" || str === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    return null;
  };

  // 1. Direct Source of Truth: MongoDB contact.pipelineStage
  let contactStage = normalizeStageStr(contact.pipelineStage);

  // If pipelineStage is missing on contact object, derive from programRelationships, attenderStates, or history
  if (!contactStage) {
    if (Array.isArray(contact.programRelationships)) {
      contact.programRelationships.forEach(r => {
        const st = normalizeStageStr(r.pipelineStage || r.status);
        if (st && (!contactStage || (STAGE_RANKS[st] || 0) > (STAGE_RANKS[contactStage] || 0))) {
          contactStage = st;
        }
      });
    }
    if (contact.attenderStates && typeof contact.attenderStates === "object") {
      Object.values(contact.attenderStates).forEach(st => {
        if (!st) return;
        const stPurpose = String(st.callPurpose || "").toUpperCase();
        if (stPurpose && stPurpose !== "SALES") return;
        const stStage = normalizeStageStr(st.status || st.pipelineStage);
        if (stStage && (!contactStage || (STAGE_RANKS[stStage] || 0) > (STAGE_RANKS[contactStage] || 0))) {
          contactStage = stStage;
        }
      });
    }
    const history = Array.isArray(contact.history) ? contact.history : [];
    if (history.length > 0) {
      let hRank = 0;
      let hStage = null;
      for (const h of history) {
        const callPurpose = (h.callPurpose || "").toUpperCase();
        if (callPurpose && callPurpose !== "SALES") continue; // Only SALES events affect pipeline

        const stat = (h.status || h.purposeOutcome || "").trim().toLowerCase();
        const rem = (h.remark || "").toLowerCase().trim();
        const combined = `${stat} ${rem}`;
        let st = null;
        if (combined.includes("already reg") || combined.includes("reg.done") || combined.includes("registered")) st = PIPELINE_STAGES.REGISTERED_WON;
        else if (combined.includes("info given") || combined.includes("information given") || combined.includes("details send")) st = PIPELINE_STAGES.INFO_GIVEN;
        else if (combined.includes("interested") && !combined.includes("not interested")) st = PIPELINE_STAGES.NURTURE_INTERESTED;
        else if (combined.includes("next time")) st = PIPELINE_STAGES.FUTURE_POOL;
        else if (combined.includes("not interested")) st = PIPELINE_STAGES.CLOSED_LOST;
        else if (INVALID_NUMBER_STATUSES.some(inv => combined.includes(inv.toLowerCase()))) st = PIPELINE_STAGES.CLOSED_INVALID;

        if (st) {
          const r = STAGE_RANKS[st] || 0;
          if (r > hRank) {
            hRank = r;
            hStage = st;
          }
        }
      }
      if (hStage && (!contactStage || (STAGE_RANKS[hStage] || 0) > (STAGE_RANKS[contactStage] || 0))) {
        contactStage = hStage;
      }
    }
  }

  const finalContactStage = contactStage || null;

  // 2. Program-specific evaluation ONLY if targetCalledFor is passed and non-empty
  const targetKey = targetCalledFor ? String(targetCalledFor).trim().toLowerCase() : "";
  if (targetKey) {
    // Check programRelationships for explicit targetKey match
    if (Array.isArray(contact.programRelationships) && contact.programRelationships.length > 0) {
      const rel = contact.programRelationships.find(r => {
        const progKey = String(r.program || r.calledForKey || "").trim().toLowerCase();
        return progKey === targetKey || (r.calledForKey && r.calledForKey === targetKey.replace(/[\s_-]/g, ""));
      });
      if (rel) {
        const relStage = normalizeStageStr(rel.pipelineStage || rel.status);
        if (relStage) return relStage;
      }
    }

    // Check attenderStates for explicit targetKey match
    if (contact.attenderStates && typeof contact.attenderStates === "object") {
      let highestAttenderStage = null;
      let highestAttenderRank = 0;
      Object.values(contact.attenderStates).forEach(st => {
        if (!st) return;
        const stPurpose = String(st.callPurpose || "").toUpperCase();
        if (stPurpose && stPurpose !== "SALES") return;
        const stCf = String(st["Called For"] || st.calledFor || "").trim().toLowerCase();
        if (stCf === targetKey) {
          const stStage = normalizeStageStr(st.pipelineStage || st.status);
          if (stStage) {
            const r = STAGE_RANKS[stStage] || 0;
            if (r > highestAttenderRank) {
              highestAttenderRank = r;
              highestAttenderStage = stStage;
            }
          }
        }
      });
      if (highestAttenderStage) return highestAttenderStage;
    }

    // Check history for explicit targetKey match
    const history = Array.isArray(contact.history) ? contact.history : [];
    const progHistory = history.filter(h => {
      const hPurpose = (h.callPurpose || "").toUpperCase();
      if (hPurpose && hPurpose !== "SALES") return false;
      const hCf = String(h.calledFor || h.called_for || h["Called For"] || "").trim().toLowerCase();
      return hCf === targetKey;
    });
    if (progHistory.length > 0) {
      let highestRank = 0;
      let stage = null;
      for (const h of progHistory) {
        const stat = (h.status || h.purposeOutcome || "").trim().toLowerCase();
        const rem = (h.remark || "").toLowerCase().trim();
        const combined = `${stat} ${rem}`;
        let hStage = null;
        if (combined.includes("already reg") || combined.includes("reg.done") || combined.includes("registered")) hStage = PIPELINE_STAGES.REGISTERED_WON;
        else if (combined.includes("info given") || combined.includes("information given") || combined.includes("details send")) hStage = PIPELINE_STAGES.INFO_GIVEN;
        else if (combined.includes("interested") && !combined.includes("not interested")) hStage = PIPELINE_STAGES.NURTURE_INTERESTED;
        else if (combined.includes("next time")) hStage = PIPELINE_STAGES.FUTURE_POOL;
        else if (combined.includes("not interested")) hStage = PIPELINE_STAGES.CLOSED_LOST;
        else if (INVALID_NUMBER_STATUSES.some(inv => combined.includes(inv.toLowerCase()))) hStage = PIPELINE_STAGES.CLOSED_INVALID;

        if (hStage) {
          const hRank = STAGE_RANKS[hStage] || 0;
          if (hRank > highestRank) {
            highestRank = hRank;
            stage = hStage;
          }
        }
      }
      if (stage) return stage;
    }
  }

  // 3. If no matching program journey exists for targetKey, return finalContactStage
  return finalContactStage;
}

/**
 * Evaluates which pipeline stage a contact should be at AFTER a new call event.
 *
 * Returns:
 *   pipelineStage          — new stage (or unchanged, null if no Sales stage)
 *   attemptCount           — updated unconnected attempt count
 *   closedReason           — reason string if closed
 *   isAttenderCreditEligible — true only for Reg.Done
 *   wasConnected           — true if this call or any prior was connected
 *   programRelationshipUpdate — { status, program } if alumni evidence found (API layer writes this)
 */
export function evaluatePipeline(contact = {}, callEvent = {}) {
  const currentStage = getEffectiveStage(contact);
  const currentRank  = currentStage ? (STAGE_RANKS[currentStage] || 0) : 0;

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

  if (isUnconnected && purpose === "SALES") attemptCount += 1;

  let targetStage             = currentStage || null;
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
    targetStage = currentStage || null;                  // Preserve exactly
    if (callStatus === "Connected") wasConnected = true;
  }

  // ── REMINDER — NEVER changes pipelineStage ────────────────────────────────
  else if (purpose === "REMINDER") {
    targetStage = currentStage || null;                  // Preserve exactly
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
    targetStage               = currentStage || null;
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
    if (attemptCount >= 5 && currentRank <= 2 && currentRank > 0) {
      targetStage  = PIPELINE_STAGES.CLOSED_INVALID;
      closedReason = "Automated: 5 Unanswered Dial Attempts";
      wasConnected = false;
    } else {
      // NEVER demote — keep current stage (or promote New Lead → Attempting)
      targetStage = currentRank >= 2 ? currentStage : PIPELINE_STAGES.ATTEMPTING;
    }
  }
  else if (purpose === "SALES" && !targetStage) {
    targetStage = PIPELINE_STAGES.NEW_LEAD;
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
  if (!stage) return true;
  const rank  = STAGE_RANKS[stage] || 0;
  return rank < 3;
}

/**
 * UI color tokens for all pipeline stages (includes legacy display stages).
 */
export function getPipelineStageConfig(stage) {
  if (!stage) {
    return { label: "No Sales Stage", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500", badge: "bg-slate-50 text-slate-500 border-slate-200 font-medium" };
  }
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
      return { label: stage || "", bg: "bg-gray-100", border: "border-gray-200", text: "text-gray-700", badge: "bg-gray-100 text-gray-700 border-gray-200" };
  }
}
