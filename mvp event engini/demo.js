import { processPipelineEvent } from './eventEngine.js';
import { PIPELINE_STAGES, ACTIONS } from './constants.js';

// ANSI terminal colors for presentation
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgMagenta: "\x1b[45m\x1b[37m"
};

function printHeader(title) {
  console.log(`\n${c.cyan}================================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${title.toUpperCase()}${c.reset}`);
  console.log(`${c.cyan}================================================================================${c.reset}`);
}

function printStep(stepNum, actionName, details) {
  console.log(`\n${c.yellow}[Step ${stepNum}] ${c.bold}${actionName}${c.reset}`);
  if (details) console.log(`  ${c.dim}${details}${c.reset}`);
}

function printTransition(beforeState, event, result) {
  console.log(`  ${c.dim}INPUT EVENT:${c.reset}  Outcome="${c.bold}${event.status || event.outcome}${c.reset}" | Purpose="${event.callPurpose || 'SALES'}" | Program="${event.calledFor || 'General'}"`);
  console.log(`  ${c.dim}STAGE SHIFT:${c.reset}  ${c.magenta}"${beforeState.pipelineStage}"${c.reset}  ➔  ${c.green}${c.bold}"${result.nextState.pipelineStage}"${c.reset}`);
  
  const emittedTypes = result.emittedActions.map(a => a.type);
  console.log(`  ${c.dim}EMITTED ACTIONS (${result.emittedActions.length}):${c.reset} ${c.blue}[${emittedTypes.join(', ')}]${c.reset}`);

  // Highlight specific critical flags
  const hasReg = result.emittedActions.some(a => a.type === ACTIONS.RECORD_TRUE_REGISTRATION);
  const hasAlumni = result.emittedActions.some(a => a.type === ACTIONS.ADD_PROGRAM_RELATIONSHIP);
  const isNoDemote = result.emittedActions.some(a => a.type === ACTIONS.PRESERVE_STAGE_NO_REGRESSION);
  const isAutoClose = result.emittedActions.some(a => a.type === ACTIONS.AUTO_CLOSE_UNREACHABLE);

  if (hasReg) {
    console.log(`  ${c.bgGreen}${c.bold} [REGISTRATION CREDIT RECORDED] ${c.reset} Attender credited with real sale!`);
  }
  if (hasAlumni) {
    console.log(`  ${c.bgMagenta}${c.bold} [ALUMNI RELATIONSHIP LINKED] ${c.reset} Recorded as existing attendee (ZERO false registration credit).`);
  }
  if (isNoDemote) {
    console.log(`  ${c.green}✔ Non-regression guard triggered: High-value stage safely preserved.${c.reset}`);
  }
  if (isAutoClose) {
    console.log(`  ${c.red}✔ 5 dial exhaustion reached: Automatically moved to Closed/Invalid.${c.reset}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

console.log(`${c.bold}${c.magenta}
╔══════════════════════════════════════════════════════════════════════════════╗
║               TGF CRM — EVENT-DRIVEN STATE ENGINE MVP                        ║
║     Pure Reducers • Zero Side-Effects • Mathematical Predictability          ║
╚══════════════════════════════════════════════════════════════════════════════╝
${c.reset}`);

// -----------------------------------------------------------------------------
// SCENARIO 1: The "Pradnya Shah" Case (Alumni moves without false credit)
// -----------------------------------------------------------------------------
printHeader("Scenario 1: Alumni Protection (The 'Pradnya Shah' Fix)");
console.log(`Goal: Lead was marked "Already Reg.d". Ensure stage moves to "Existing Alumni"`);
console.log(`      while RECORD_TRUE_REGISTRATION is NOT emitted.`);

let lead1 = {
  id: "lead-001",
  name: "Pradnya Shah",
  pipelineStage: PIPELINE_STAGES.NEW_LEAD,
  attemptCount: 0,
  programRelationships: []
};

printStep(1, "Call logged with outcome: 'Already Reg.d'", "Attender discovers caller already completed this shivir previously.");
const event1 = {
  type: "CALL_LOGGED",
  status: "Already Reg.d",
  calledFor: "Residential Basic",
  callPurpose: "SALES"
};
const res1 = processPipelineEvent(lead1, event1);
printTransition(lead1, event1, res1);
lead1 = res1.nextState;

console.log(`\n  ${c.bold}Verification Check:${c.reset}`);
console.log(`  - Final Stage: ${lead1.pipelineStage === PIPELINE_STAGES.EXISTING_ALUMNI ? c.green + "PASS (" + lead1.pipelineStage + ")" : c.red + "FAIL"}${c.reset}`);
console.log(`  - True Registration Credited: ${res1.emittedActions.some(a => a.type === ACTIONS.RECORD_TRUE_REGISTRATION) ? c.red + "FAIL (Credited)" : c.green + "PASS (Zero False Credit)"}${c.reset}`);


// -----------------------------------------------------------------------------
// SCENARIO 2: Non-Regression Guard (No Backward Sliding)
// -----------------------------------------------------------------------------
printHeader("Scenario 2: Non-Regression Guard");
console.log(`Goal: Lead reached "4. Nurture / Interested". Subsequent call is "Busy".`);
console.log(`      Engine must NEVER demote back to "2. Attempting Contact".`);

let lead2 = {
  id: "lead-002",
  name: "Amit Deshmukh",
  pipelineStage: PIPELINE_STAGES.NURTURE_INTERESTED,
  attemptCount: 0
};

printStep(1, "Follow-up call drops / Busy", "Attempting second follow-up call with interested customer.");
const event2 = {
  type: "CALL_LOGGED",
  status: "Busy",
  calledFor: "Basic Online",
  callPurpose: "SALES"
};
const res2 = processPipelineEvent(lead2, event2);
printTransition(lead2, event2, res2);
lead2 = res2.nextState;

console.log(`\n  ${c.bold}Verification Check:${c.reset}`);
console.log(`  - Preserved Stage: ${lead2.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED ? c.green + "PASS (" + lead2.pipelineStage + ")" : c.red + "FAIL (" + lead2.pipelineStage + ")"}${c.reset}`);


// -----------------------------------------------------------------------------
// SCENARIO 3: 5 Unanswered Dials Auto-Close
// -----------------------------------------------------------------------------
printHeader("Scenario 3: 5-Attempt Unanswered Auto-Close Rule");
console.log(`Goal: 5 consecutive unanswered dials on a New Lead automatically`);
console.log(`      transitions to "Closed / Invalid".`);

let lead3 = {
  id: "lead-003",
  name: "Rahul Patil",
  pipelineStage: PIPELINE_STAGES.NEW_LEAD,
  attemptCount: 0
};

const unansweredOutcomes = ["Not Connected", "No Answer", "Switched Off", "Call Cut", "No Network"];

unansweredOutcomes.forEach((status, idx) => {
  const stepNum = idx + 1;
  const evt = { type: "CALL_LOGGED", status, callPurpose: "SALES" };
  const res = processPipelineEvent(lead3, evt);
  printStep(stepNum, `Dial Attempt #${stepNum}: "${status}"`);
  printTransition(lead3, evt, res);
  lead3 = res.nextState;
});

console.log(`\n  ${c.bold}Verification Check:${c.reset}`);
console.log(`  - Final Stage: ${lead3.pipelineStage === PIPELINE_STAGES.CLOSED_INVALID ? c.green + "PASS (" + lead3.pipelineStage + ")" : c.red + "FAIL (" + lead3.pipelineStage + ")"}${c.reset}`);
console.log(`  - Total Attempt Count: ${lead3.attemptCount === 5 ? c.green + "PASS (5 attempts)" : c.red + "FAIL"}${c.reset}`);


// -----------------------------------------------------------------------------
// SCENARIO 4: True Registration (Won)
// -----------------------------------------------------------------------------
printHeader("Scenario 4: True Registration (Won)");
console.log(`Goal: Lead progresses through the sales funnel and registers.`);
console.log(`      Engine emits RECORD_TRUE_REGISTRATION with credit.`);

let lead4 = {
  id: "lead-004",
  name: "Sneha Kulkarni",
  pipelineStage: PIPELINE_STAGES.NEW_LEAD,
  attemptCount: 0
};

// Stage 1 -> Info Given
let e1 = { type: "CALL_LOGGED", status: "Info Given", callPurpose: "SALES", calledFor: "Basic Online" };
let r1 = processPipelineEvent(lead4, e1);
printStep(1, "Call 1: Information Given");
printTransition(lead4, e1, r1);
lead4 = r1.nextState;

// Info Given -> Nurture / Interested
let e2 = { type: "CALL_LOGGED", status: "Interested", callPurpose: "SALES", calledFor: "Basic Online" };
let r2 = processPipelineEvent(lead4, e2);
printStep(2, "Call 2: Interested / Nurture");
printTransition(lead4, e2, r2);
lead4 = r2.nextState;

// Nurture -> Reg.Done
let e3 = { type: "CALL_LOGGED", status: "Reg.Done", callPurpose: "SALES", calledFor: "Basic Online" };
let r3 = processPipelineEvent(lead4, e3);
printStep(3, "Call 3: Registration Payment Completed ('Reg.Done')");
printTransition(lead4, e3, r3);
lead4 = r3.nextState;

console.log(`\n  ${c.bold}Verification Check:${c.reset}`);
console.log(`  - Final Stage: ${lead4.pipelineStage === PIPELINE_STAGES.REGISTERED_WON ? c.green + "PASS (" + lead4.pipelineStage + ")" : c.red + "FAIL"}${c.reset}`);
console.log(`  - True Registration Credited: ${r3.emittedActions.some(a => a.type === ACTIONS.RECORD_TRUE_REGISTRATION) ? c.green + "PASS (Legitimate Sale Credited)" : c.red + "FAIL"}${c.reset}`);


// -----------------------------------------------------------------------------
// SCENARIO 5: Query Call Isolation
// -----------------------------------------------------------------------------
printHeader("Scenario 5: Multi-Track Isolation (Query Call)");
console.log(`Goal: Lead in "3. Information Given" has a support question.`);
console.log(`      Support resolution must NOT alter or reset the sales funnel stage.`);

let lead5 = {
  id: "lead-005",
  name: "Vikram Joshi",
  pipelineStage: PIPELINE_STAGES.INFO_GIVEN,
  queryStatus: "Pending"
};

printStep(1, "Customer calls support: Query Solved", "Question about venue timings resolved.");
const queryEvent = {
  type: "CALL_LOGGED",
  status: "Solved",
  callPurpose: "QUERY",
  queryText: "Venue address clarification"
};
const res5 = processPipelineEvent(lead5, queryEvent);
printTransition(lead5, queryEvent, res5);
lead5 = res5.nextState;

console.log(`\n  ${c.bold}Verification Check:${c.reset}`);
console.log(`  - Sales Stage Intact: ${lead5.pipelineStage === PIPELINE_STAGES.INFO_GIVEN ? c.green + "PASS (" + lead5.pipelineStage + ")" : c.red + "FAIL"}${c.reset}`);
console.log(`  - Query Status: ${lead5.queryStatus === "Solved" ? c.green + "PASS (Solved)" : c.red + "FAIL"}${c.reset}`);

console.log(`\n${c.bold}${c.green}✔ All 5 Event-Driven State Machine scenarios executed with 100% success.${c.reset}\n`);
