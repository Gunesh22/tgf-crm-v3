/**
 * Final Test 228 — Browser UI State Simulation Test
 * Validates programStates lookup, pill switching, and dirty form state isolation.
 *
 * Run: node tests/finalTest228BrowserSimulation.test.js
 */

import {
  getEffectiveStage,
  getProgramSpecificStatus,
  evaluatePipeline,
  PIPELINE_STAGES,
  normalizeProgramStates
} from '../src/utils/pipelineEngine.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ PASS  ${label}`);
  } else {
    failed++;
    console.error(`❌ FAIL  ${label}${detail ? ` (${detail})` : ''}`);
  }
}

console.log('\n===================================================');
console.log(' FINAL TEST 228 — BROWSER UI STATE SIMULATION');
console.log('===================================================\n');

// Simulated Contact Document for "Final Test 228"
const rawFinalTest228Contact = {
  _id: "test228_doc_id",
  leadName: "Final Test 228",
  leadOwner: "attenderA",
  "Called For": "Studya Smater",
  pipelineStage: "3. Information Given",
  status: "Info Given",
  history: [
    {
      calledFor: "Studya Smater",
      status: "Info Given",
      callPurpose: "SALES",
      attenderId: "attenderA",
      timestamp: "2026-09-02T02:31:00Z"
    },
    {
      calledFor: "Yoga 1 Yr",
      status: "Not Connected",
      callStatus: "Not Connected",
      callPurpose: "SALES",
      attenderId: "attenderA",
      timestamp: "2026-09-02T02:32:00Z"
    }
  ]
};

// Normalize record into canonical programStates architecture
const contact = normalizeProgramStates(rawFinalTest228Contact);

// 1. Outside Contact List view for Attender A looking at Yoga 1 Yr
const outsideYogaStage = getEffectiveStage(contact, "Yoga 1 Yr", "attenderA");
assert("1. Outside Contact List: Yoga 1 Yr returns Attempting Contact", outsideYogaStage === PIPELINE_STAGES.ATTEMPTING, `got: ${outsideYogaStage}`);

// 2. Open Edit Modal -> Default selected program is Yoga 1 Yr
let activeProgram = "Yoga 1 Yr";
let activeAttenderId = "attenderA";
let modalYogaStage = getEffectiveStage(contact, activeProgram, activeAttenderId);
assert("2. Inside Edit Modal: Selected Program 'Yoga 1 Yr' returns 2. Attempting Contact", modalYogaStage === PIPELINE_STAGES.ATTEMPTING, `got: ${modalYogaStage}`);

// 3. User switches Program Pill to "Studya Smater"
activeProgram = "Studya Smater";
let modalStudyaStage = getEffectiveStage(contact, activeProgram, activeAttenderId);
assert("3. Inside Edit Modal: Switching to Pill 'Studya Smater' returns 3. Information Given", modalStudyaStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${modalStudyaStage}`);

// 4. User switches Program Pill back to "Yoga 1 Yr"
activeProgram = "Yoga 1 Yr";
let modalYogaStageReturn = getEffectiveStage(contact, activeProgram, activeAttenderId);
assert("4. Inside Edit Modal: Switching back to Pill 'Yoga 1 Yr' returns 2. Attempting Contact", modalYogaStageReturn === PIPELINE_STAGES.ATTEMPTING, `got: ${modalYogaStageReturn}`);

// 5. User changes form fields (dirty state) without clicking Save
const dirtyFormState = {
  ...contact,
  "Called For": "Yoga 1 Yr",
  status: "Interested", // User selected Interested in outcome dropdown but hasn't saved yet
  remark: "Thinking about it"
};

// The saved database row stage MUST remain Attempting Contact
const savedRowStage = getEffectiveStage(contact, "Yoga 1 Yr", "attenderA");
assert("5. Saved DB Row Stage remains 2. Attempting Contact despite dirty form state", savedRowStage === PIPELINE_STAGES.ATTEMPTING, `got: ${savedRowStage}`);

// 6. User submits call with outcome "Interested" for Yoga 1 Yr
const callEval = evaluatePipeline(contact, {
  callPurpose: "SALES",
  callStatus: "Connected",
  purposeOutcome: "Interested",
  calledFor: "Yoga 1 Yr",
  attenderId: "attenderA"
});

assert("6a. evaluatePipeline promotes Yoga 1 Yr to Nurture / Interested", callEval.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${callEval.pipelineStage}`);
assert("6b. evaluatePipeline outputs programStatesUpdate for Yoga 1 Yr", callEval.programStatesUpdate?.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${callEval.programStatesUpdate?.pipelineStage}`);

// Apply update to contact's programStates
const updatedContact = {
  ...contact,
  programStates: {
    ...contact.programStates,
    attenderA: {
      ...contact.programStates.attenderA,
      yoga1yr: callEval.programStatesUpdate
    }
  }
};

// 7. Re-check stages after save
const postSaveYogaStage = getEffectiveStage(updatedContact, "Yoga 1 Yr", "attenderA");
const postSaveStudyaStage = getEffectiveStage(updatedContact, "Studya Smater", "attenderA");

assert("7a. Post-Save: Yoga 1 Yr is now 4. Nurture / Interested", postSaveYogaStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${postSaveYogaStage}`);
assert("7b. Post-Save: Studya Smater remains isolated at 3. Information Given", postSaveStudyaStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${postSaveStudyaStage}`);

console.log('\n---------------------------------------------------');
console.log(`Total Tests: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log('===================================================\n');

if (failed > 0) process.exit(1);
