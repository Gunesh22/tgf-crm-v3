import { PIPELINE_STAGES, ACTIONS } from './constants.js';

/**
 * Declarative State Machine Blueprint
 * 
 * Each stage explicitly declares:
 * 1. Which outcomes it accepts.
 * 2. What the next stage is.
 * 3. Which exact actions/side-effects must be triggered.
 * 
 * There are NO nested if/else ladders here. It is a readable, auditable rulebook.
 */
export const MACHINE_BLUEPRINT = {
  // Global Outcomes (handlable from ANY stage)
  globalOutcomes: {
    // True Registration
    "reg.done": {
      targetStage: PIPELINE_STAGES.REGISTERED_WON,
      actions: [ACTIONS.SET_STAGE, ACTIONS.RECORD_TRUE_REGISTRATION]
    },
    // Alumni Outcomes (Already Reg.d or Shivir done)
    "already reg.d": {
      targetStage: PIPELINE_STAGES.EXISTING_ALUMNI,
      actions: [ACTIONS.SET_STAGE, ACTIONS.ADD_PROGRAM_RELATIONSHIP]
    },
    "already reg. done": {
      targetStage: PIPELINE_STAGES.EXISTING_ALUMNI,
      actions: [ACTIONS.SET_STAGE, ACTIONS.ADD_PROGRAM_RELATIONSHIP]
    },
    "already registered": {
      targetStage: PIPELINE_STAGES.EXISTING_ALUMNI,
      actions: [ACTIONS.SET_STAGE, ACTIONS.ADD_PROGRAM_RELATIONSHIP]
    },
    "shivir done": {
      targetStage: PIPELINE_STAGES.EXISTING_ALUMNI,
      actions: [ACTIONS.SET_STAGE, ACTIONS.ADD_PROGRAM_RELATIONSHIP]
    },
    "shivir already done": {
      targetStage: PIPELINE_STAGES.EXISTING_ALUMNI,
      actions: [ACTIONS.SET_STAGE, ACTIONS.ADD_PROGRAM_RELATIONSHIP]
    },
    // Terminal Disqualification
    "invalid number": {
      targetStage: PIPELINE_STAGES.CLOSED_INVALID,
      actions: [ACTIONS.SET_STAGE]
    },
    "not interested": {
      targetStage: PIPELINE_STAGES.CLOSED_LOST,
      actions: [ACTIONS.SET_STAGE]
    }
  },

  // Standard Sales Funnel Progression Rules
  outcomesByStage: {
    [PIPELINE_STAGES.NEW_LEAD]: {
      "info given": { targetStage: PIPELINE_STAGES.INFO_GIVEN, actions: [ACTIONS.SET_STAGE] },
      "interested": { targetStage: PIPELINE_STAGES.NURTURE_INTERESTED, actions: [ACTIONS.SET_STAGE] },
      "previous program pending": { targetStage: PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING, actions: [ACTIONS.SET_STAGE] },
      "next time": { targetStage: PIPELINE_STAGES.FUTURE_POOL, actions: [ACTIONS.SET_STAGE] },
    },
    [PIPELINE_STAGES.ATTEMPTING]: {
      "info given": { targetStage: PIPELINE_STAGES.INFO_GIVEN, actions: [ACTIONS.SET_STAGE] },
      "interested": { targetStage: PIPELINE_STAGES.NURTURE_INTERESTED, actions: [ACTIONS.SET_STAGE] },
      "previous program pending": { targetStage: PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING, actions: [ACTIONS.SET_STAGE] },
      "next time": { targetStage: PIPELINE_STAGES.FUTURE_POOL, actions: [ACTIONS.SET_STAGE] },
    },
    [PIPELINE_STAGES.INFO_GIVEN]: {
      "interested": { targetStage: PIPELINE_STAGES.NURTURE_INTERESTED, actions: [ACTIONS.SET_STAGE] },
      "previous program pending": { targetStage: PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING, actions: [ACTIONS.SET_STAGE] },
      "next time": { targetStage: PIPELINE_STAGES.FUTURE_POOL, actions: [ACTIONS.SET_STAGE] },
    },
    [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: {
      "interested": { targetStage: PIPELINE_STAGES.NURTURE_INTERESTED, actions: [ACTIONS.SET_STAGE] },
      "next time": { targetStage: PIPELINE_STAGES.FUTURE_POOL, actions: [ACTIONS.SET_STAGE] },
    },
    [PIPELINE_STAGES.NURTURE_INTERESTED]: {
      "next time": { targetStage: PIPELINE_STAGES.FUTURE_POOL, actions: [ACTIONS.SET_STAGE] },
    },
    [PIPELINE_STAGES.FUTURE_POOL]: {
      "interested": { targetStage: PIPELINE_STAGES.NURTURE_INTERESTED, actions: [ACTIONS.SET_STAGE] },
      "info given": { targetStage: PIPELINE_STAGES.INFO_GIVEN, actions: [ACTIONS.SET_STAGE] },
    },
    [PIPELINE_STAGES.REGISTERED_WON]: {
      // Once Won, leads never demote to New Lead or Attempting
    },
    [PIPELINE_STAGES.EXISTING_ALUMNI]: {
      // Alumni can re-enter sales funnel for a NEW shivir
      "info given": { targetStage: PIPELINE_STAGES.INFO_GIVEN, actions: [ACTIONS.SET_STAGE] },
      "interested": { targetStage: PIPELINE_STAGES.NURTURE_INTERESTED, actions: [ACTIONS.SET_STAGE] },
    }
  }
};
