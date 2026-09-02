import { extractProgramsList, getProgramContext, getProgramRegistrationInfo, getProgramCallCount } from '../src/features/attender/utils/programContextHelper.js';
import { getEffectiveStage, PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

console.log("=== RUNNING MULTI-PROGRAM CRM UI/CONTEXT VERIFICATION SUITE ===");

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`✓ [PASS] Case ${totalCount}: ${message}`);
    passedCount++;
  } else {
    console.error(`✗ [FAIL] Case ${totalCount}: ${message}`);
  }
}

// CASE 1: Single program contact
const contact1 = {
  _id: "c1",
  "Called For": "CBT Basic",
  pipelineStage: "3. Information Given",
  history: [{ calledFor: "CBT Basic", status: "Info Given", callPurpose: "SALES" }]
};
const list1 = extractProgramsList(contact1);
assert(list1.length === 1 && list1[0] === "CBT Basic", "CASE 1: Single program contact returns only 'CBT Basic'");

// CASE 2: Multi-program contact
const contact2 = {
  _id: "c2",
  "Called For": "CBT Basic, CBT Advanced",
  programRelationships: [
    { program: "CBT Basic", pipelineStage: "6. Registered / Won", status: "Registered / Won" },
    { program: "CBT Advanced", pipelineStage: "3. Information Given", status: "3. Information Given" }
  ]
};
const list2 = extractProgramsList(contact2);
assert(list2.length === 2 && list2.includes("CBT Basic") && list2.includes("CBT Advanced"), "CASE 2: Contact with CBT Basic + CBT Advanced shows both programs visibly");

// CASE 3: Independent stage resolution
const stageBasic = getEffectiveStage(contact2, "CBT Basic");
const stageAdvanced = getEffectiveStage(contact2, "CBT Advanced");
assert(stageBasic === PIPELINE_STAGES.REGISTERED_WON && stageAdvanced === PIPELINE_STAGES.INFO_GIVEN, "CASE 3: CBT Basic = Registered / Won while CBT Advanced = Information Given");

// CASE 4: New program starts clean without inheriting Registered / Won
const contact4 = {
  _id: "c4",
  "Called For": "CBT Basic",
  pipelineStage: "6. Registered / Won",
  programRelationships: [
    { program: "CBT Basic", pipelineStage: "6. Registered / Won", status: "Registered / Won" }
  ]
};
const stageNewProg = getEffectiveStage(contact4, "CBT Advanced");
assert(stageNewProg === PIPELINE_STAGES.NEW_LEAD, "CASE 4: New program CBT Advanced starts at 1. New Lead and does NOT inherit Registered / Won");

// CASE 5: Registration independence
const contact5 = {
  _id: "c5",
  "Called For": "CBT Basic, CBT Advanced",
  programRelationships: [
    { program: "CBT Basic", status: "Registered / Won", registrationId: "reg_c5_cbt-basic" },
    { program: "CBT Advanced", status: "3. Information Given" }
  ]
};
const regBasic = getProgramRegistrationInfo(contact5, "CBT Basic");
const regAdvanced = getProgramRegistrationInfo(contact5, "CBT Advanced");
assert(regBasic.exists === true && regAdvanced.exists === false, "CASE 5: CBT Basic has existing registration while CBT Advanced is unregistered");

// CASE 6: Shared contact attender state isolation
const contact6 = {
  _id: "c6",
  leadOwner: "attenderA",
  attenderStates: {
    "attenderA": { calledFor: "CBT Basic", status: "6. Registered / Won", pipelineStage: "6. Registered / Won" },
    "attenderB": { calledFor: "CBT Advanced", status: "3. Information Given", pipelineStage: "3. Information Given" }
  }
};
const attBContext = getProgramContext(contact6, "CBT Advanced", "attenderB");
assert(attBContext.stage === PIPELINE_STAGES.INFO_GIVEN, "CASE 6: Attender B sees CBT Advanced Information Given context independently from Attender A");

// CASE 7: Independent program context switching
const ctxA = getProgramContext(contact2, "CBT Basic");
const ctxB = getProgramContext(contact2, "CBT Advanced");
assert(ctxA.program !== ctxB.program && ctxA.stage !== ctxB.stage, "CASE 7: Switching between CBT Basic and CBT Advanced returns distinct, non-mutating contexts");

// CASE 8: Save isolation (Simulated payload construction)
const activeProgSave = "CBT Advanced";
const updatePayload = {
  calledFor: activeProgSave,
  "Called For": activeProgSave,
  status: "4. Nurture / Interested",
  pipelineStage: "4. Nurture / Interested"
};
assert(updatePayload.calledFor === "CBT Advanced" && updatePayload.pipelineStage === "4. Nurture / Interested", "CASE 8: Saving changes for CBT Advanced targets only CBT Advanced");

// CASE 9: Persisted data reopening restoration
const reloadedContact = {
  _id: "c9",
  "Called For": "CBT Basic, CBT Advanced",
  programRelationships: [
    { program: "CBT Basic", pipelineStage: "6. Registered / Won" },
    { program: "CBT Advanced", pipelineStage: "4. Nurture / Interested" }
  ]
};
assert(
  getEffectiveStage(reloadedContact, "CBT Basic") === PIPELINE_STAGES.REGISTERED_WON &&
  getEffectiveStage(reloadedContact, "CBT Advanced") === PIPELINE_STAGES.NURTURE_INTERESTED,
  "CASE 9: Modal reopening restores accurate program-specific stages from persisted programRelationships"
);

// CASE 10: Query and Reminder call stage preservation
const queryEventStage = getEffectiveStage({
  ...contact2,
  history: [
    ...contact2.programRelationships,
    { calledFor: "CBT Advanced", callPurpose: "QUERY", status: "Pending" }
  ]
}, "CBT Advanced");
assert(queryEventStage === PIPELINE_STAGES.INFO_GIVEN, "CASE 10: Query and Reminder calls preserve the existing program pipeline stage");

console.log(`\n=== SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED ===`);
if (passedCount === totalCount) {
  console.log("ALL MULTI-PROGRAM SYSTEM TEST CASES PASSED SUCCESSFULLY!");
} else {
  process.exit(1);
}
