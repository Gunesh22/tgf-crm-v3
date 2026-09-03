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
  NEW_LEAD:                 "1. New Lead",
  ATTEMPTING:               "2. Attempting Contact",
  INFO_GIVEN:               "3. Information Given",
  PREVIOUS_PROGRAM_PENDING: "Previous Program Pending",
  NURTURE_INTERESTED:       "4. Nurture / Interested",
  FUTURE_POOL:              "5. Future Pool",
  REGISTERED_WON:           "6. Registered / Won",
  CLOSED_LOST:              "Closed / Lost",
  CLOSED_INVALID:           "Closed / Invalid",
};

// Query Pipeline stages (Separate, independent state machine for Query call purpose)
export const QUERY_PIPELINE_STAGES = {
  ATTEMPTING_QUERY: "Attempting Query",
  QUERY_PENDING:    "Query Pending",
  QUERY_SOLVED:     "Query Solved",
};

// Legacy / Auxiliary stages — recognized for DISPLAY & routing
export const LEGACY_DISPLAY_STAGES = {
  QUERY_DESK:      "Query Desk",
  REMINDER_DESK:   "Reminder Desk",
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
  "Previous Program Pending": 3.2,
  "4. Nurture / Interested": 4, "Nurture / Interested": 4, "Interested": 4,
  "5. Future Pool": 5, "Future Pool": 5, "Next Time": 5,
  "6. Registered / Won": 6, "Registered / Won": 6, "Reg.Done": 6, "Registered": 6,
  "Closed / Lost": 7, "Closed / Invalid": 7,
  // Legacy display-only (kept for backward compat with old data; NOT promotion targets)
  "Query Desk": 3.5, "Query": 3.5,
  "Reminder Desk": 3.5, "Reminder": 3.5,
  "Existing Alumni": 6, "Alumni": 6,
};

// Stages that are NOT real sales pipeline stages
// Contacts at these stages allow any forward Sales transition (treat as New Lead for rank checks)
const LEGACY_NON_PIPELINE_STAGES = new Set([
  "Query Desk", "Reminder Desk", "Existing Alumni", "Alumni", "Query", "Reminder",
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

  // Previous Program Pending is a normal non-terminal pipeline stage and can transition to any stage or be transitioned to
  if (fromStage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || fromStage === "Previous Program Pending" ||
      toStage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || toStage === "Previous Program Pending") return true;

  // Legacy non-pipeline stages: allow any Sales forward movement
  if (LEGACY_NON_PIPELINE_STAGES.has(fromStage)) return true;

  // Reactivation: closed lead receives a connected / positive-outcome call
  const isConnected = event.callStatus === "Connected" ||
    ["Info Given", "Interested", "Reg.Done", "Next Time", "Previous Program Pending"].some(st =>
      String(event.purposeOutcome || event.status || "").toLowerCase().trim() === st.toLowerCase()
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
export function getEffectiveStage(contact = {}, targetCalledFor = null, attenderId = null) {
  if (!contact || typeof contact !== "object") return null;

  const normalizeStageStr = (s) => {
    if (!s) return null;
    const str = String(s).trim();
    if (str === PIPELINE_STAGES.NEW_LEAD || str === "New Lead" || str === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (str === PIPELINE_STAGES.ATTEMPTING || str === "Attempting Contact" || str === "Attempting" || str === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (str === PIPELINE_STAGES.INFO_GIVEN || str === "Information Given" || str === "Info Given" || str === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (str === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || str === "Previous Program Pending") return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
    if (str === PIPELINE_STAGES.NURTURE_INTERESTED || str === "Nurture / Interested" || str === "Interested" || str === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (str === PIPELINE_STAGES.FUTURE_POOL || str === "Future Pool" || str === "Next Time" || str === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (str === PIPELINE_STAGES.REGISTERED_WON || str === "Registered / Won" || str === "Reg.Done" || str === "6. Registered / Won" || str === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (str === PIPELINE_STAGES.CLOSED_LOST || str === "Closed / Lost" || str === "Closed Lost" || str === "7. Closed / Lost" || str === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (str === PIPELINE_STAGES.CLOSED_INVALID || str === "Closed / Invalid" || str === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    return null;
  };

  const normalizeKey = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.trim().toLowerCase().replace(/[\s_-]+/g, "");
  };

  const targetKey = targetCalledFor ? normalizeKey(targetCalledFor) : "";
  const normContact = normalizeProgramStates(contact);
  const states = normContact?.programStates || {};

  // 1. Both targetCalledFor and attenderId provided -> Direct O(1) lookup
  if (targetKey && attenderId) {
    const progMap = normContact?.programs?.[targetKey] || {};
    const attState = progMap[attenderId] || normContact?.programStates?.[attenderId]?.[targetKey];
    if (attState?.pipelineStage) {
      return normalizeStageStr(attState.pipelineStage);
    }
  }

  // 2. Only targetCalledFor provided -> Highest rank across attenders for targetKey
  if (targetKey) {
    let highestRank = 0;
    let highestStage = null;
    const progMap = normContact?.programs?.[targetKey] || {};
    Object.values(progMap).forEach(ps => {
      const st = normalizeStageStr(ps?.pipelineStage);
      if (st) {
        const r = STAGE_RANKS[st] || 0;
        if (r > highestRank) {
          highestRank = r;
          highestStage = st;
        }
      }
    });

    Object.values(states).forEach(attMap => {
      if (attMap && typeof attMap === "object") {
        Object.entries(attMap).forEach(([k, ps]) => {
          if (normalizeKey(k) === targetKey || normalizeKey(ps?.programKey || ps?.program) === targetKey) {
            const st = normalizeStageStr(ps?.pipelineStage);
            if (st) {
              const r = STAGE_RANKS[st] || 0;
              if (r > highestRank) {
                highestRank = r;
                highestStage = st;
              }
            }
          }
        });
      }
    });
    if (highestStage) return highestStage;

    const contactKey = normalizeKey(contact["Called For"] || contact.calledFor || contact.called_for);
    if (contactKey === targetKey && contact.pipelineStage) {
      return normalizeStageStr(contact.pipelineStage);
    }
    return null;
  }

  // 3. Neither provided -> Highest priority across all programStates (or root stage)
  const EFFECTIVE_PRIORITY = {
    [PIPELINE_STAGES.REGISTERED_WON]: 10,
    "Registered / Won": 10, "Reg.Done": 10, "Registered": 10,
    [PIPELINE_STAGES.NURTURE_INTERESTED]: 8,
    "Nurture / Interested": 8, "Interested": 8,
    [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: 7,
    "Previous Program Pending": 7,
    [PIPELINE_STAGES.INFO_GIVEN]: 6,
    "Information Given": 6, "Info Given": 6,
    [PIPELINE_STAGES.FUTURE_POOL]: 5,
    "Future Pool": 5, "Next Time": 5,
    [PIPELINE_STAGES.ATTEMPTING]: 4,
    "Attempting Contact": 4, "Attempting": 4,
    [PIPELINE_STAGES.NEW_LEAD]: 3,
    "New Lead": 3,
    [PIPELINE_STAGES.CLOSED_LOST]: 2,
    "Closed / Lost": 2, "Not Interested": 2,
    [PIPELINE_STAGES.CLOSED_INVALID]: 1,
    "Closed / Invalid": 1
  };

  let highestPriority = 0;
  let highestStage = null;
  Object.values(states).forEach(attMap => {
    if (attMap && typeof attMap === "object") {
      Object.values(attMap).forEach(ps => {
        const st = normalizeStageStr(ps?.pipelineStage);
        if (st) {
          const prio = EFFECTIVE_PRIORITY[st] || STAGE_RANKS[st] || 0;
          if (prio > highestPriority) {
            highestPriority = prio;
            highestStage = st;
          }
        }
      });
    }
  });

  return highestStage || normalizeStageStr(contact.pipelineStage);
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
  const calledFor = callEvent.calledFor || callEvent["Called For"] || contact["Called For"] || contact.calledFor || null;
  const attenderId = callEvent.attenderId || callEvent.callAttenderId || contact.attenderId || contact.leadOwner || null;
  const currentStage = getEffectiveStage(contact, calledFor, attenderId);
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
  else if (sLower === "previous program pending") {
    targetStage  = PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
    attemptCount = 0;
    wasConnected = true;
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

  let evaluatedQueryStatus = null;
  if (purpose === "QUERY") {
    if (isUnconnected) {
      evaluatedQueryStatus = QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY;
    } else {
      const qNorm = String(callEvent.queryStatus || callEvent.status || "").trim().toLowerCase();
      if (qNorm === "solved" || qNorm === "query solved") {
        evaluatedQueryStatus = QUERY_PIPELINE_STAGES.QUERY_SOLVED;
      } else {
        evaluatedQueryStatus = QUERY_PIPELINE_STAGES.QUERY_PENDING;
      }
    }
  }

  const targetProgKey = String(calledFor || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const activeAttId = callEvent.attenderId || contact.attenderId || null;
  const programStatesUpdate = (activeAttId && targetProgKey) ? {
    attenderId: activeAttId,
    programKey: targetProgKey,
    program: calledFor,
    pipelineStage: finalStage,
    status: outcome || callStatus || "Pending",
    queryStatus: evaluatedQueryStatus || callEvent.queryStatus || null,
    remark: callEvent.remark || "",
    callbackDate: callEvent.callbackDate || null,
    callbackTime: callEvent.callbackTime || null,
    source: callEvent.source || contact.source || "",
    updatedAt: new Date().toISOString()
  } : null;

  return {
    pipelineStage: finalStage,
    queryStatus: evaluatedQueryStatus,
    attemptCount,
    closedReason: allowed ? closedReason : (contact.closedReason || null),
    isAttenderCreditEligible,
    wasConnected,
    programRelationshipUpdate,
    programStatesUpdate
  };
}

/**
 * Returns true if the contact qualifies for the "Convert to Sales" button.
 * Only shown for genuinely new / query-only contacts (pipeline rank < 3).
 */
export function shouldShowConvertToSales(contact = {}, targetProgram = null) {
  const stage = getEffectiveStage(contact, targetProgram);
  if (!stage) return true;

  if (targetProgram) {
    const normProg = String(targetProgram).trim().toLowerCase();
    const rels = Array.isArray(contact?.programRelationships) ? contact.programRelationships : [];
    const isReg = rels.some(r => {
      if (!r) return false;
      const p = typeof r === "string" ? r : (r.calledForKey || r.calledFor || r.program || r["Called For"] || "");
      const pStat = typeof r === "string" ? "" : String(r.status || "").toLowerCase();
      return String(p).trim().toLowerCase() === normProg && (pStat.includes("registered") || pStat.includes("reg_done") || pStat.includes("alumni"));
    });
    if (isReg) return false;
  }

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
      return { label: "2. Attempting Contact", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-900 border-amber-300 font-semibold" };
    case "3. Information Given":
    case "Information Given":
    case "Info Given":
      return { label: "3. Information Given", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", badge: "bg-blue-100 text-blue-900 border-blue-300 font-semibold" };
    case "Previous Program Pending":
      return { label: "Previous Program Pending", bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", badge: "bg-indigo-100 text-indigo-900 border-indigo-300 font-semibold" };
    case "4. Nurture / Interested":
    case "Nurture / Interested":
    case "Interested":
      return { label: "4. Nurture / Interested", bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", badge: "bg-purple-100 text-purple-900 border-purple-300 font-semibold" };
    case "5. Future Pool":
    case "Future Pool":
    case "Next Time":
      return { label: "5. Future Pool", bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-800", badge: "bg-sky-100 text-sky-900 border-sky-300 font-semibold" };
    case "6. Registered / Won":
    case "Registered / Won":
    case "Registered":
    case "Reg.Done":
      return { label: "6. Registered / Won", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold" };
    case "Closed / Lost":
    case "Not Interested":
      return { label: "Closed / Lost", bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", badge: "bg-rose-100 text-rose-900 border-rose-300 font-semibold" };
    case "Closed / Invalid":
    case "Invalid":
      return { label: "Closed / Invalid", bg: "bg-gray-200", border: "border-gray-400", text: "text-gray-900", badge: "bg-gray-200 text-gray-900 border-gray-400 font-semibold" };
    // Legacy display-only
    case "Query Desk":
    case "Query":
      return { label: "Query Desk (Legacy)", bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", badge: "bg-orange-100 text-orange-900 border-orange-300 font-semibold" };
    case "Reminder Desk":
    case "Reminder":
      return { label: "Reminder Desk (Legacy)", bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-800", badge: "bg-sky-100 text-sky-900 border-sky-300 font-semibold" };
    case "Existing Alumni":
    case "Alumni":
      return { label: "Existing Alumni (Legacy)", bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-800", badge: "bg-cyan-100 text-cyan-900 border-cyan-300" };
    default:
      return { label: stage || "", bg: "bg-gray-100", border: "border-gray-200", text: "text-gray-700", badge: "bg-gray-100 text-gray-700 border-gray-200" };
  }
}

/**
 * Extracts program-specific status (purposeOutcome) from registrations, attenderStates, history, or active contact state.
 */
export function getProgramSpecificStatus(contact = {}, targetProg = "", attenderId = null) {
  const normalizeKey = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.trim().toLowerCase().replace(/[\s_-]+/g, "");
  };
  const targetKey = normalizeKey(targetProg);
  if (!targetKey) return contact.status || "";

  const normContact = normalizeProgramStates(contact);
  const states = normContact?.programStates || {};

  // 1. Explicit attenderId + targetProg -> Direct O(1) lookup
  if (attenderId && states[attenderId]) {
    const attMap = states[attenderId];
    if (attMap && typeof attMap === "object") {
      const foundEntry = Object.entries(attMap).find(([k, v]) => {
        return normalizeKey(k) === targetKey || normalizeKey(v?.programKey || v?.program) === targetKey;
      });
      if (foundEntry && (foundEntry[1]?.status || foundEntry[1]?.purposeOutcome)) {
        return foundEntry[1].status || foundEntry[1].purposeOutcome;
      }
    }
    return "";
  }

  // 2. Only targetProg (no attenderId) -> Search programStates across attenders
  for (const attMap of Object.values(states)) {
    if (attMap && typeof attMap === "object") {
      const foundEntry = Object.entries(attMap).find(([k, v]) => {
        return normalizeKey(k) === targetKey || normalizeKey(v?.programKey || v?.program) === targetKey;
      });
      if (foundEntry && (foundEntry[1]?.status || foundEntry[1]?.purposeOutcome)) {
        return foundEntry[1].status || foundEntry[1].purposeOutcome;
      }
    }
  }

  // 3. Fallback: check programRelationships for registration status
  if (Array.isArray(contact.programRelationships)) {
    const foundRel = contact.programRelationships.find(p => {
      if (!p) return false;
      const pStr = typeof p === "string" ? p : (p.calledForKey || p.calledFor || p.program || p["Called For"] || "");
      const pKey = normalizeKey(pStr);
      const pStat = typeof p === "string" ? "" : String(p.status || "").toLowerCase();
      return pKey === targetKey && (pStat.includes("registered") || pStat.includes("reg_done") || pStat.includes("alumni"));
    });
    if (foundRel) return "Reg.Done";
  }

  // 4. Fallback if contact.calledFor matches targetKey
  const contactKey = normalizeKey(contact["Called For"] || contact.calledFor);
  if (contactKey === targetKey && contact.status) {
    return contact.status;
  }

  return "";
}

/**
 * Normalizes legacy records into canonical programStates structure.
 */
export function normalizeProgramStates(contact = {}) {
  if (!contact || typeof contact !== "object") return contact;
  const rawStates = contact.programStates || {};
  const programStates = {};
  const programs = {};

  const deriveStageFromStatus = (status, purpose = "SALES") => {
    const p = String(purpose || "SALES").toUpperCase();
    if (p && p !== "SALES") return null;
    const s = String(status || "").toLowerCase().trim();
    if (s.includes("already reg") || s.includes("shivir done")) return "Existing Alumni";
    if (s.includes("reg.done") || s.includes("registered")) return PIPELINE_STAGES.REGISTERED_WON;
    if (s.includes("previous program pending")) return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
    if (s.includes("interested") && !s.includes("not interested")) return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s.includes("info given") || s.includes("information given") || s.includes("details send")) return PIPELINE_STAGES.INFO_GIVEN;
    if (s.includes("next time")) return PIPELINE_STAGES.FUTURE_POOL;
    if (s.includes("not interested")) return PIPELINE_STAGES.CLOSED_LOST;
    if (INVALID_NUMBER_STATUSES.some(inv => s.includes(inv.toLowerCase()))) return PIPELINE_STAGES.CLOSED_INVALID;
    if (UNCONNECTED_CALL_STATUSES.some(unc => s.includes(unc.toLowerCase()))) return PIPELINE_STAGES.ATTEMPTING;
    return null;
  };

  const normalizeKey = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.trim().toLowerCase().replace(/[\s_-]+/g, "");
  };

  const updateStateEntry = (attId, pKey, stateObj, isHistory = false) => {
    programStates[attId] = programStates[attId] || {};
    programs[pKey] = programs[pKey] || {};

    const existing = programs[pKey][attId];
    if (!existing) {
      programStates[attId][pKey] = { ...stateObj };
      programs[pKey][attId] = programStates[attId][pKey];
    } else if (isHistory) {
      if (stateObj.pipelineStage) {
        const curRank = STAGE_RANKS[existing.pipelineStage] || 0;
        const newRank = STAGE_RANKS[stateObj.pipelineStage] || 0;
        const isPrevProgPending = stateObj.pipelineStage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || stateObj.status === "Previous Program Pending";
        if (newRank >= curRank || isPrevProgPending || canTransition(existing.pipelineStage, stateObj.pipelineStage, stateObj)) {
          existing.pipelineStage = stateObj.pipelineStage;
          existing.status = stateObj.status || existing.status;
          existing.updatedAt = stateObj.updatedAt || existing.updatedAt;
        }
      }
    } else if (stateObj.pipelineStage) {
      const curRank = STAGE_RANKS[existing.pipelineStage] || 0;
      const newRank = STAGE_RANKS[stateObj.pipelineStage] || 0;
      const isPrevProgPending = stateObj.pipelineStage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || stateObj.status === "Previous Program Pending";
      if (newRank > curRank || isPrevProgPending || canTransition(existing.pipelineStage, stateObj.pipelineStage, stateObj)) {
        existing.pipelineStage = stateObj.pipelineStage;
        existing.status = stateObj.status || existing.status;
        existing.updatedAt = stateObj.updatedAt || existing.updatedAt;
      }
    }
  };

  // 0. Process pre-existing programStates / programs objects
  if (contact.programStates && typeof contact.programStates === "object") {
    Object.entries(contact.programStates).forEach(([attId, attMap]) => {
      if (attMap && typeof attMap === "object") {
        Object.entries(attMap).forEach(([pKeyRaw, stObj]) => {
          const pKey = normalizeKey(pKeyRaw || stObj.programKey || stObj.program);
          if (pKey && stObj) {
            updateStateEntry(attId, pKey, { ...stObj, programKey: pKey });
          }
        });
      }
    });
  }

  if (contact.programs && typeof contact.programs === "object") {
    Object.entries(contact.programs).forEach(([pKeyRaw, attMap]) => {
      if (attMap && typeof attMap === "object") {
        const pKey = normalizeKey(pKeyRaw);
        Object.entries(attMap).forEach(([attId, stObj]) => {
          if (pKey && stObj) {
            updateStateEntry(attId, pKey, { ...stObj, programKey: pKey });
          }
        });
      }
    });
  }

  // 1. Process physical history logs (Authoritative source for call events per program)
  if (Array.isArray(contact.history)) {
    contact.history.forEach(h => {
      if (!h || typeof h !== "object") return;
      const purpose = String(h.callPurpose || "").toUpperCase();
      if (purpose === "QUERY" || purpose === "REMINDER") return; // Query / Reminder calls do not modify Sales pipeline stage

      const attId = h.attenderId || h.callAttenderId || contact.leadOwner || "default";
      const prog = h.calledFor || h["Called For"] || h.called_for || "";
      const pKey = normalizeKey(prog);
      if (!pKey) return;

      const outcomeStr = String(h.status || h.callStatus || h.purposeOutcome || "").trim();
      const isUnconnected = UNCONNECTED_CALL_STATUSES.some(unc => unc.toLowerCase() === outcomeStr.toLowerCase());
      const callStage = isUnconnected ? PIPELINE_STAGES.ATTEMPTING : (h.pipelineStage || deriveStageFromStatus(outcomeStr, h.callPurpose));

      updateStateEntry(attId, pKey, {
        attenderId: attId,
        attenderName: h.attenderName || "",
        programKey: pKey,
        program: prog,
        pipelineStage: callStage || null,
        status: h.status || h.callStatus || h.purposeOutcome || "",
        remark: h.remark || "",
        callbackDate: h.callbackDate || null,
        callbackTime: h.callbackTime || null,
        source: h.callSource || contact.source || "",
        updatedAt: h.timestamp || new Date().toISOString()
      }, true);
    });
  }

  // 2. Process programRelationships (Authoritative source for registration/alumni)
  if (Array.isArray(contact.programRelationships)) {
    contact.programRelationships.forEach(rel => {
      if (!rel) return;
      const prog = typeof rel === "string" ? rel : (rel.program || rel.calledFor || rel.calledForKey || rel["Called For"] || "");
      const pKey = normalizeKey(typeof rel === "string" ? rel : (rel.calledForKey || prog));
      if (!pKey) return;
      const relStage = typeof rel === "string" ? null : (rel.pipelineStage || deriveStageFromStatus(rel.status));
      const attId = (typeof rel === "object" && rel.attenderId) || contact.leadOwner || "default";

      updateStateEntry(attId, pKey, {
        attenderId: attId,
        attenderName: (typeof rel === "object" && rel.attenderName) || "",
        programKey: pKey,
        program: prog,
        pipelineStage: relStage,
        status: typeof rel === "string" ? "Registered" : (rel.status || ""),
        updatedAt: (typeof rel === "object" && rel.registeredAt) || contact.updatedAt || new Date().toISOString()
      });
    });
  }

  // 3. Migrate attenderStates (Fallback ONLY for legacy records without history for that program)
  if (contact.attenderStates && typeof contact.attenderStates === "object") {
    Object.entries(contact.attenderStates).forEach(([attId, st]) => {
      if (!st || typeof st !== "object") return;
      const purpose = String(st.callPurpose || "").toUpperCase();
      if (purpose === "QUERY" || purpose === "REMINDER") return; // Skip Query / Reminder attenderStates
      const prog = st.calledFor || st["Called For"] || st.called_for || contact["Called For"] || contact.calledFor || "";
      const pKey = normalizeKey(st.calledForKey || prog);
      if (!pKey) return;

      const hasHistoryForProg = (programs[pKey] && programs[pKey][attId]) || (programStates[attId] && programStates[attId][pKey]);
      if (!hasHistoryForProg) {
        const stStatus = String(st.status || st.purposeOutcome || "").trim();
        const isUnconnected = UNCONNECTED_CALL_STATUSES.some(unc => unc.toLowerCase() === stStatus.toLowerCase());
        const derivedStage = isUnconnected ? PIPELINE_STAGES.ATTEMPTING : (st.pipelineStage || deriveStageFromStatus(stStatus, st.callPurpose) || null);

        updateStateEntry(attId, pKey, {
          attenderId: attId,
          attenderName: st.attenderName || "",
          programKey: pKey,
          program: prog,
          pipelineStage: derivedStage,
          status: st.status || st.purposeOutcome || "",
          remark: st.remark || "",
          callbackDate: st.callbackDate || null,
          callbackTime: st.callbackTime || null,
          source: st.source || contact.source || "",
          updatedAt: st.lastCalledAt || contact.updatedAt || new Date().toISOString()
        });
      }
    });
  }

  // 4. Fallback for root contact stage (ONLY if no history/attenderState exists for that program)
  const rootProg = contact["Called For"] || contact.calledFor || contact.called_for || "";
  const rootPKey = normalizeKey(rootProg);
  const rootAttId = contact.leadOwner || contact.attenderId || "default";
  const rootStage = contact.pipelineStage;

  if (rootStage && rootPKey) {
    updateStateEntry(rootAttId, rootPKey, {
      attenderId: rootAttId,
      attenderName: contact.leadOwnerName || "",
      programKey: rootPKey,
      program: rootProg,
      pipelineStage: rootStage,
      status: contact.status || "",
      remark: contact.remark || "",
      callbackDate: contact.callbackDate || null,
      callbackTime: contact.callbackTime || null,
      source: contact.source || "",
      updatedAt: contact.updatedAt || new Date().toISOString()
    });
  }

  return {
    ...contact,
    programStates,
    programs
  };
}

/**
 * Derives the Query Pipeline stage (Attempting Query, Query Pending, Query Solved, or null)
 * for a contact or call event cleanly isolated from the Sales Pipeline.
 */
export function getCanonicalQueryStage(contactOrEvent) {
  if (!contactOrEvent) return null;

  const purposeLower = String(contactOrEvent.callPurpose || "").trim().toLowerCase();
  const statusLower = String(contactOrEvent.status || "").trim().toLowerCase();
  const history = Array.isArray(contactOrEvent.history) ? contactOrEvent.history : [];
  
  // Check if contact has ANY actual Query activity
  const hasQueryCallInHistory = history.some(h => 
    String(h?.callPurpose || "").toLowerCase() === "query" ||
    (h?.queryStatus && String(h.queryStatus).toLowerCase().includes("query"))
  );
  
  const hasQueryAttenderState = contactOrEvent.attenderStates && typeof contactOrEvent.attenderStates === "object" && Object.values(contactOrEvent.attenderStates).some(st => 
    String(st?.callPurpose || "").toLowerCase() === "query" ||
    (st?.queryStatus && String(st.queryStatus).toLowerCase().includes("query"))
  );

  const isQueryRoot = purposeLower === "query" || statusLower.includes("query") || contactOrEvent.pipelineStage === "Query Desk";

  // A contact is ONLY in the Query Pipeline if they have actual Query purpose, Query history, or explicit Query attenderState!
  if (!isQueryRoot && !hasQueryCallInHistory && !hasQueryAttenderState) {
    return null;
  }

  // Resolve specific Query stage
  const qStatus = String(contactOrEvent.queryStatus || contactOrEvent.query_status || "").trim();
  const qStatusLower = qStatus.toLowerCase();

  if (qStatusLower === "query solved" || qStatusLower === "solved") return QUERY_PIPELINE_STAGES.QUERY_SOLVED;
  if (qStatusLower === "attempting query" || qStatusLower === "attempting") return QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY;

  // Check history (newest first)
  if (history.length > 0) {
    const historyRev = [...history].reverse();
    for (const h of historyRev) {
      if (!h) continue;
      const purpose = String(h.callPurpose || "").toUpperCase();
      const hQS = String(h.queryStatus || h.query_status || "").trim().toLowerCase();
      if (hQS === "query solved" || hQS === "solved") return QUERY_PIPELINE_STAGES.QUERY_SOLVED;
      if (hQS === "attempting query" || hQS === "attempting") return QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY;
      if (purpose === "QUERY") {
        const callStatus = String(h.callStatus || h.status || "").trim();
        const isUnconnected = UNCONNECTED_CALL_STATUSES.some(s => s.toLowerCase() === callStatus.toLowerCase());
        if (isUnconnected) {
          return QUERY_PIPELINE_STAGES.ATTEMPTING_QUERY;
        }
        return QUERY_PIPELINE_STAGES.QUERY_PENDING;
      }
    }
  }

  // Default for actual query leads if no specific status was set
  return QUERY_PIPELINE_STAGES.QUERY_PENDING;
}

