/**
 * Event-Driven State Machine — Constants & Action Types
 * 
 * In an Event-Driven architecture:
 * 1. Attenders/System trigger EVENTS.
 * 2. The Engine calculates the NEXT STATE and emits discrete ACTIONS.
 * 3. Side-effects (DB writes, metrics) only execute if the action was emitted.
 */

export const PIPELINE_STAGES = {
  NEW_LEAD:                 "1. New Lead",
  ATTEMPTING:               "2. Attempting Contact",
  INFO_GIVEN:               "3. Information Given",
  PREVIOUS_PROGRAM_PENDING: "Previous Program Pending",
  NURTURE_INTERESTED:       "4. Nurture / Interested",
  FUTURE_POOL:              "5. Future Pool",
  REGISTERED_WON:           "6. Registered / Won",
  EXISTING_ALUMNI:          "Existing Alumni",
  CLOSED_LOST:              "Closed / Lost",
  CLOSED_INVALID:           "Closed / Invalid",
};

export const STAGE_RANKS = {
  [PIPELINE_STAGES.NEW_LEAD]: 1,
  [PIPELINE_STAGES.ATTEMPTING]: 2,
  [PIPELINE_STAGES.INFO_GIVEN]: 3,
  [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: 3.2,
  [PIPELINE_STAGES.NURTURE_INTERESTED]: 4,
  [PIPELINE_STAGES.FUTURE_POOL]: 5,
  [PIPELINE_STAGES.REGISTERED_WON]: 6,
  [PIPELINE_STAGES.EXISTING_ALUMNI]: 6, // Parallel high-priority tier
  [PIPELINE_STAGES.CLOSED_LOST]: 7,
  [PIPELINE_STAGES.CLOSED_INVALID]: 7,
};

export const EVENTS = {
  CALL_LOGGED: "CALL_LOGGED",
  QUERY_UPDATE: "QUERY_UPDATE",
  ADMIN_OVERRIDE: "ADMIN_OVERRIDE",
};

export const ACTIONS = {
  SET_STAGE: "SET_STAGE",
  ADD_PROGRAM_RELATIONSHIP: "ADD_PROGRAM_RELATIONSHIP",
  RECORD_TRUE_REGISTRATION: "RECORD_TRUE_REGISTRATION",
  AUTO_CLOSE_UNREACHABLE: "AUTO_CLOSE_UNREACHABLE",
  PRESERVE_STAGE_NO_REGRESSION: "PRESERVE_STAGE_NO_REGRESSION",
  SET_QUERY_STATUS: "SET_QUERY_STATUS",
};
