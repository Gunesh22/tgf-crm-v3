import { PIPELINE_STAGES, STAGE_RANKS, ACTIONS } from './constants.js';
import { MACHINE_BLUEPRINT } from './machineConfig.js';

const UNCONNECTED_STATUSES = new Set([
  "not connected", "busy", "call cut", "switched off",
  "no answer", "no network", "na", "not attended", "not picked up"
]);

/**
 * Pure Event-Driven Pipeline Reducer
 * 
 * Takes: (currentState, incomingEvent)
 * Returns: { nextState, emittedActions, logMessage }
 * 
 * Zero side-effects: 100% mathematical, deterministic, and predictable.
 */
export function processPipelineEvent(currentState, event) {
  const currentStage = currentState.pipelineStage || PIPELINE_STAGES.NEW_LEAD;
  const currentAttempts = currentState.attemptCount || 0;
  const purpose = (event.callPurpose || "SALES").toUpperCase().trim();
  const rawStatus = (event.status || event.outcome || "").trim().toLowerCase();
  const program = event.calledFor || currentState.calledFor || "General";

  const emittedActions = [];

  // ── TRACK 1: QUERY & REMINDER PURPOSE ISOLATION ────────────────────────────
  if (purpose === "QUERY") {
    const qStatus = rawStatus.includes("solve") ? "Solved" : "Pending";
    emittedActions.push({ type: ACTIONS.SET_QUERY_STATUS, queryStatus: qStatus });
    return {
      nextState: {
        ...currentState,
        queryStatus: qStatus
      },
      emittedActions,
      logMessage: `[QUERY ISOLATION] Kept sales stage "${currentStage}", updated queryStatus to "${qStatus}".`
    };
  }

  if (purpose === "REMINDER") {
    return {
      nextState: {
        ...currentState,
        lastReminderAt: new Date().toISOString()
      },
      emittedActions,
      logMessage: `[REMINDER ISOLATION] Kept sales stage "${currentStage}", logged reminder event.`
    };
  }

  // ── TRACK 2: UNCONNECTED CALLS & 5-ATTEMPT AUTO-CLOSE ───────────────────────
  const isUnconnected = UNCONNECTED_STATUSES.has(rawStatus);
  if (isUnconnected) {
    const newAttemptCount = currentAttempts + 1;
    const currentRank = STAGE_RANKS[currentStage] || 1;

    // 5 unanswered calls on a lead who has never been contacted (Rank <= 2)
    if (newAttemptCount >= 5 && currentRank <= 2) {
      emittedActions.push({
        type: ACTIONS.AUTO_CLOSE_UNREACHABLE,
        reason: "5 Unanswered Dial Attempts"
      });
      return {
        nextState: {
          ...currentState,
          pipelineStage: PIPELINE_STAGES.CLOSED_INVALID,
          attemptCount: newAttemptCount,
          closedReason: "Automated: 5 Unanswered Dial Attempts"
        },
        emittedActions,
        logMessage: `[AUTO-CLOSE] Reached 5 failed dials. Transitioned to "${PIPELINE_STAGES.CLOSED_INVALID}".`
      };
    }

    // Lead is already in stage 3, 4, 5, or 6: NEVER demote backward!
    if (currentRank > 2) {
      emittedActions.push({ type: ACTIONS.PRESERVE_STAGE_NO_REGRESSION });
      return {
        nextState: {
          ...currentState,
          attemptCount: newAttemptCount
        },
        emittedActions,
        logMessage: `[NO-REGRESSION] Unconnected call ("${event.status}") ignored for high-rank lead. Kept "${currentStage}".`
      };
    }

    // Move New Lead -> Attempting Contact
    emittedActions.push({ type: ACTIONS.SET_STAGE, targetStage: PIPELINE_STAGES.ATTEMPTING });
    return {
      nextState: {
        ...currentState,
        pipelineStage: PIPELINE_STAGES.ATTEMPTING,
        attemptCount: newAttemptCount
      },
      emittedActions,
      logMessage: `[ATTEMPT] Dial recorded (Attempt #${newAttemptCount}). Moved to "${PIPELINE_STAGES.ATTEMPTING}".`
    };
  }

  // ── TRACK 3: GLOBAL OUTCOMES (Reg.Done, Alumni, Terminal) ─────────────────
  const globalMatch = MACHINE_BLUEPRINT.globalOutcomes[rawStatus];
  if (globalMatch) {
    globalMatch.actions.forEach(actionType => {
      if (actionType === ACTIONS.RECORD_TRUE_REGISTRATION) {
        emittedActions.push({
          type: ACTIONS.RECORD_TRUE_REGISTRATION,
          program,
          isAttenderCreditEligible: true
        });
      } else if (actionType === ACTIONS.ADD_PROGRAM_RELATIONSHIP) {
        emittedActions.push({
          type: ACTIONS.ADD_PROGRAM_RELATIONSHIP,
          program,
          status: "Existing Alumni"
        });
      } else if (actionType === ACTIONS.SET_STAGE) {
        emittedActions.push({
          type: ACTIONS.SET_STAGE,
          targetStage: globalMatch.targetStage
        });
      }
    });

    // Notice: For Alumni, RECORD_TRUE_REGISTRATION is NEVER emitted!
    const isReg = emittedActions.some(a => a.type === ACTIONS.RECORD_TRUE_REGISTRATION);

    return {
      nextState: {
        ...currentState,
        pipelineStage: globalMatch.targetStage,
        attemptCount: 0,
        // Update relationships immutably
        programRelationships: [
          ...(currentState.programRelationships || []).filter(r => r.program !== program),
          { program, status: globalMatch.targetStage === PIPELINE_STAGES.EXISTING_ALUMNI ? "Existing Alumni" : "Registered" }
        ]
      },
      emittedActions,
      logMessage: `[GLOBAL MATCH] Outcome "${event.status}" ➔ "${globalMatch.targetStage}". RegisteredCredit=${isReg}.`
    };
  }

  // ── TRACK 4: STAGE-SPECIFIC PROGRESSION ────────────────────────────────────
  const stageRules = MACHINE_BLUEPRINT.outcomesByStage[currentStage] || {};
  const stageTransition = stageRules[rawStatus];

  if (stageTransition) {
    emittedActions.push({ type: ACTIONS.SET_STAGE, targetStage: stageTransition.targetStage });
    return {
      nextState: {
        ...currentState,
        pipelineStage: stageTransition.targetStage,
        attemptCount: 0
      },
      emittedActions,
      logMessage: `[STAGE MOVE] Progressed from "${currentStage}" ➔ "${stageTransition.targetStage}".`
    };
  }

  // Fallback: If outcome does not permit forward move from currentStage, preserve stage
  emittedActions.push({ type: ACTIONS.PRESERVE_STAGE_NO_REGRESSION });
  return {
    nextState: currentState,
    emittedActions,
    logMessage: `[GUARD] Outcome "${event.status}" not permitted from "${currentStage}". Preserved current stage.`
  };
}
