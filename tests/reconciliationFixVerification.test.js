// tests/reconciliationFixVerification.test.js
import assert from 'assert';
import { 
  getCanonicalStage, 
  isStageNurtureInterested, 
  isStageRegisteredWon, 
  countUniqueContacts, 
  countInterestedPeople, 
  countRegisteredPeople, 
  classifyCallStatus 
} from '../src/features/admin/utils.jsx';
import { PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

console.log("=== RUNNING RECONCILIATION FIX VERIFICATION TESTS ===");

// 1. CANONICAL STAGE MAPPING TESTS
console.log("\n1. Testing Canonical Stage Helper...");
assert.strictEqual(getCanonicalStage("1. New Lead"), PIPELINE_STAGES.NEW_LEAD);
assert.strictEqual(getCanonicalStage("2. Attempting Contact"), PIPELINE_STAGES.ATTEMPTING);
assert.strictEqual(getCanonicalStage("3. Information Given"), PIPELINE_STAGES.INFO_GIVEN);
assert.strictEqual(getCanonicalStage("Previous Program Pending"), PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING);
assert.strictEqual(getCanonicalStage({ Phone: "9422748665", pipelineStage: "Previous Program Pending" }), PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING);
assert.strictEqual(getCanonicalStage({ Phone: "9422748665", status: "Previous Program Pending" }), PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING);
assert.strictEqual(getCanonicalStage("4. Nurture / Interested"), PIPELINE_STAGES.NURTURE_INTERESTED);
assert.strictEqual(getCanonicalStage("5. Future Pool"), PIPELINE_STAGES.FUTURE_POOL);
assert.strictEqual(getCanonicalStage("6. Registered / Won"), PIPELINE_STAGES.REGISTERED_WON);
assert.strictEqual(getCanonicalStage("7. Closed / Lost"), PIPELINE_STAGES.CLOSED_LOST);
assert.strictEqual(getCanonicalStage("8. Closed / Invalid"), PIPELINE_STAGES.CLOSED_INVALID);
assert.strictEqual(getCanonicalStage("Query Desk"), "Query Desk");
assert.strictEqual(getCanonicalStage("Existing Alumni"), "Existing Alumni");
console.log("✓ Canonical Stage Mapping passed!");

// 2. INTERESTED & REGISTERED DEFINITION TESTS
console.log("\n2. Testing Interested & Registered People Helpers...");
const sampleContacts = [
  { id: "c1", pipelineStage: "4. Nurture / Interested" },
  { id: "c2", pipelineStage: "Interested" }, // maps to Stage 4
  { id: "c3", pipelineStage: "6. Registered / Won" },
  { id: "c4", pipelineStage: "Reg.Done" }, // maps to Stage 6
  { id: "c5", pipelineStage: "1. New Lead" },
  { id: "c6", pipelineStage: "Query Desk" },
  { id: "c7", pipelineStage: "Existing Alumni" }
];

assert.strictEqual(isStageNurtureInterested(sampleContacts[0]), true);
assert.strictEqual(isStageNurtureInterested(sampleContacts[1]), true);
assert.strictEqual(isStageNurtureInterested(sampleContacts[2]), false);
assert.strictEqual(isStageNurtureInterested("Interested - High Priority"), false); // custom stage not canonical

assert.strictEqual(isStageRegisteredWon(sampleContacts[2]), true);
assert.strictEqual(isStageRegisteredWon(sampleContacts[3]), true);
assert.strictEqual(isStageRegisteredWon(sampleContacts[0]), false);

assert.strictEqual(countInterestedPeople(sampleContacts), 2);
assert.strictEqual(countRegisteredPeople(sampleContacts), 2);
console.log("✓ Interested & Registered People helpers passed!");

// 3. CALL STATUS CLASSIFICATION TESTS
console.log("\n3. Testing Call Status Classification Invariant...");
const explicitNotConnectedStatuses = [
  "Busy", "Call Cut", "switched off", "Invalid No", "No Network", "wrong no.", "no answer",
  "No answer", "Not Picked Up", "Not Connected", "Called by mistake", "wrong number", "no response", "invalid number"
];

const explicitConnectedStatuses = [
  "Info given", "Interested", "Reg.Done", "reminder", "Query", "Already Reg.d", 
  "Next time", "Shivir done", "Not possible", "Pending", "Not interested", "Not Attended", "Call Log Added",
  "info given", "interested", "registered", "shivir", "attended"
];

explicitNotConnectedStatuses.forEach(st => {
  assert.strictEqual(classifyCallStatus(st), "NOT_CONNECTED", `Status '${st}' must classify as NOT_CONNECTED`);
});

explicitConnectedStatuses.forEach(st => {
  assert.strictEqual(classifyCallStatus(st), "CONNECTED", `Status '${st}' must classify as CONNECTED`);
});

const testCallStatuses = [...explicitConnectedStatuses, ...explicitNotConnectedStatuses, "random unknown status"];

let connectedCount = 0;
let notConnectedCount = 0;

testCallStatuses.forEach(st => {
  const category = classifyCallStatus(st);
  assert(category === "CONNECTED" || category === "NOT_CONNECTED", `Status ${st} must resolve to CONNECTED or NOT_CONNECTED`);
  if (category === "CONNECTED") connectedCount++;
  else notConnectedCount++;
});

assert.strictEqual(connectedCount + notConnectedCount, testCallStatuses.length);
console.log(`✓ Call Status Classification passed! Total (${testCallStatuses.length}) === Connected (${connectedCount}) + Not Connected (${notConnectedCount})`);

// 4. PIPELINE STAGE RECONCILIATION INVARIANT TEST
console.log("\n4. Testing Pipeline Stage Reconciliation Invariant...");
const allStageContacts = [
  ...Array(40).fill({ id: "nl", pipelineStage: "1. New Lead" }).map((c, i) => ({ id: `nl_${i}`, ...c })),
  ...Array(433).fill({ id: "att", pipelineStage: "2. Attempting Contact" }).map((c, i) => ({ id: `att_${i}`, ...c })),
  ...Array(301).fill({ id: "info", pipelineStage: "3. Information Given" }).map((c, i) => ({ id: `info_${i}`, ...c })),
  ...Array(15).fill({ id: "ppp", pipelineStage: "Previous Program Pending" }).map((c, i) => ({ id: `ppp_${i}`, ...c })),
  ...Array(20).fill({ id: "fut", pipelineStage: "5. Future Pool" }).map((c, i) => ({ id: `fut_${i}`, ...c })),
  ...Array(183).fill({ id: "reg", pipelineStage: "6. Registered / Won" }).map((c, i) => ({ id: `reg_${i}`, ...c })),
  ...Array(96).fill({ id: "cl", pipelineStage: "Closed / Lost" }).map((c, i) => ({ id: `cl_${i}`, ...c })),
  ...Array(28).fill({ id: "inv", pipelineStage: "Closed / Invalid" }).map((c, i) => ({ id: `inv_${i}`, ...c })),
  ...Array(32).fill({ id: "qd", pipelineStage: "Query Desk" }).map((c, i) => ({ id: `qd_${i}`, ...c })),
  ...Array(12).fill({ id: "ea", pipelineStage: "Existing Alumni" }).map((c, i) => ({ id: `ea_${i}`, ...c }))
];

const counts = {};
allStageContacts.forEach(c => {
  const stage = getCanonicalStage(c);
  counts[stage] = (counts[stage] || 0) + 1;
});

const sumDisplayed = Object.values(counts).reduce((a, b) => a + b, 0);
assert.strictEqual(counts[PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING], 15, "Previous Program Pending count should be 15");
assert.strictEqual(counts["Query Desk"], 32, "Query Desk count should be 32");
assert.strictEqual(counts["Existing Alumni"], 12, "Existing Alumni count should be 12");
console.log("✓ Pipeline Stage Reconciliation passed!");

console.log("\nALL RECONCILIATION VERIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉");
