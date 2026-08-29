/**
 * Pipeline Engine V2 — Unit Tests
 * Tests all 30 required cases from the master architecture prompt.
 *
 * Run: node tests/pipelineEngine.test.js
 */

import {
  evaluatePipeline,
  getEffectiveStage,
  canTransition,
  shouldShowConvertToSales,
  PIPELINE_STAGES,
} from '../src/utils/pipelineEngine.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: '✅ PASS', label, detail });
  } else {
    failed++;
    results.push({ status: '❌ FAIL', label, detail });
    console.error(`FAIL: ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function makeContact(pipelineStage = '1. New Lead', extraHistory = [], extra = {}) {
  return { pipelineStage, history: extraHistory, attemptCount: 0, wasConnected: false, ...extra };
}

function makeCall(purpose = 'SALES', callStatus = 'Connected', status = 'Info Given', extra = {}) {
  return { callPurpose: purpose, callStatus, status, ...extra };
}

// ── Test 1: New Lead + Not Connected → Attempting Contact ─────────────────────
{
  const r = evaluatePipeline(makeContact('1. New Lead'), makeCall('SALES', 'Not Picked Up', 'Not Picked Up'));
  assert('1. New Lead + Not Connected → Attempting Contact', r.pipelineStage === PIPELINE_STAGES.ATTEMPTING, `got: ${r.pipelineStage}`);
}

// ── Test 2: Attempting + Not Connected → Attempting ───────────────────────────
{
  const r = evaluatePipeline(makeContact('2. Attempting Contact', [], { attemptCount: 2 }), makeCall('SALES', 'Not Picked Up', 'Not Picked Up'));
  assert('2. Attempting + Not Connected → remains Attempting', r.pipelineStage === PIPELINE_STAGES.ATTEMPTING, `got: ${r.pipelineStage}`);
}

// ── Test 3: Information Given + Not Connected → Information Given ──────────────
{
  const r = evaluatePipeline(makeContact('3. Information Given'), makeCall('SALES', 'Not Picked Up', 'Not Picked Up'));
  assert('3. Information Given + Not Connected → remains Information Given', r.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r.pipelineStage}`);
}

// ── Test 4: Information Given + Interested → Nurture ─────────────────────────
{
  const r = evaluatePipeline(makeContact('3. Information Given'), makeCall('SALES', 'Connected', 'Interested'));
  assert('4. Information Given + Interested → Nurture / Interested', r.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${r.pipelineStage}`);
}

// ── Test 5: Information Given + Not Interested → Closed ───────────────────────
{
  const r = evaluatePipeline(makeContact('3. Information Given'), makeCall('SALES', 'Connected', 'Not interested'));
  assert('5. Information Given + Not Interested → Closed / Lost', r.pipelineStage === PIPELINE_STAGES.CLOSED_LOST, `got: ${r.pipelineStage}`);
}

// ── Test 6: Information Given + Next Time → Future Pool ──────────────────────
{
  const r = evaluatePipeline(makeContact('3. Information Given'), makeCall('SALES', 'Connected', 'Next Time'));
  assert('6. Information Given + Next Time → Future Pool', r.pipelineStage === PIPELINE_STAGES.FUTURE_POOL, `got: ${r.pipelineStage}`);
}

// ── Test 7: Nurture + Not Connected → Nurture ─────────────────────────────────
{
  const r = evaluatePipeline(makeContact('4. Nurture / Interested'), makeCall('SALES', 'Not Picked Up', 'Not Picked Up'));
  assert('7. Nurture + Not Connected → remains Nurture / Interested', r.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${r.pipelineStage}`);
}

// ── Test 8: Nurture + Interested call → remains Nurture ──────────────────────
{
  const r = evaluatePipeline(makeContact('4. Nurture / Interested'), makeCall('SALES', 'Connected', 'Interested'));
  assert('8. Nurture + Interested → remains Nurture / Interested', r.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${r.pipelineStage}`);
}

// ── Test 9: Nurture + Reg.Done → Registered ───────────────────────────────────
{
  const r = evaluatePipeline(makeContact('4. Nurture / Interested'), makeCall('SALES', 'Connected', 'Reg.Done'));
  assert('9. Nurture + Reg.Done → Registered / Won', r.pipelineStage === PIPELINE_STAGES.REGISTERED_WON, `got: ${r.pipelineStage}`);
  assert('9b. Reg.Done sets isAttenderCreditEligible', r.isAttenderCreditEligible === true);
}

// ── Test 10: Registered + Reminder Not Connected → remains Registered ─────────
{
  const r = evaluatePipeline(makeContact('6. Registered / Won'), makeCall('REMINDER', 'Not Picked Up', 'Not Picked Up'));
  assert('10. Registered + Reminder Not Connected → remains Registered / Won', r.pipelineStage === PIPELINE_STAGES.REGISTERED_WON, `got: ${r.pipelineStage}`);
}

// ── Test 11: Registered + Query → remains Registered ─────────────────────────
{
  const r = evaluatePipeline(makeContact('6. Registered / Won'), makeCall('QUERY', 'Connected', 'Query', { queryStatus: 'Pending' }));
  assert('11. Registered + Query → remains Registered / Won', r.pipelineStage === PIPELINE_STAGES.REGISTERED_WON, `got: ${r.pipelineStage}`);
}

// ── Test 12: Query Pending + Follow-up → pipeline unchanged ──────────────────
{
  const contact = makeContact('3. Information Given');
  const r = evaluatePipeline(contact, makeCall('QUERY', 'Connected', 'Query', { queryStatus: 'Pending' }));
  assert('12. Query Pending + Follow-up → pipeline unchanged (Info Given)', r.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r.pipelineStage}`);
}

// ── Test 13: New Query + Convert to Sales → Info Given ────────────────────────
{
  const newContact = makeContact('1. New Lead');
  // Step 1: query call (stays at New Lead)
  const r1 = evaluatePipeline(newContact, makeCall('QUERY', 'Connected', 'Query', { queryStatus: 'Pending' }));
  assert('13a. New Query → pipeline stays New Lead', r1.pipelineStage === PIPELINE_STAGES.NEW_LEAD, `got: ${r1.pipelineStage}`);
  // Step 2: convert to sales (info given)
  const r2 = evaluatePipeline(makeContact(r1.pipelineStage), makeCall('SALES', 'Connected', 'Info Given'));
  assert('13b. Convert to Sales from New Lead → Information Given', r2.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r2.pipelineStage}`);
}

// ── Test 14: Existing Info Given + Query → no Convert to Sales ───────────────
{
  const contact = makeContact('3. Information Given');
  assert('14. Existing Info Given → shouldShowConvertToSales = false', shouldShowConvertToSales(contact) === false);
}

// ── Test 15: Existing Nurture + Query → no Convert to Sales ──────────────────
{
  const contact = makeContact('4. Nurture / Interested');
  assert('15. Existing Nurture → shouldShowConvertToSales = false', shouldShowConvertToSales(contact) === false);
}

// ── Test 16: Reminder has no pipeline change ──────────────────────────────────
{
  // Verify that evaluatePipeline for REMINDER always returns currentStage
  const stages = ['1. New Lead', '3. Information Given', '4. Nurture / Interested', '6. Registered / Won'];
  for (const stage of stages) {
    const r = evaluatePipeline(makeContact(stage), makeCall('REMINDER', 'Connected', 'Reminder Given'));
    assert(`16. Reminder (${stage}) → pipelineStage unchanged`, r.pipelineStage === stage, `got: ${r.pipelineStage}`);
  }
}

// ── Test 17: Alumni Program A does NOT pollute Sales for Program B ─────────
{
  // Contact is at Nurture/Interested for CBT Advanced (their current sales program).
  // They also have a CBT Basic alumni relationship stored in programRelationships.
  // A Sales "Info Given" call for CBT Advanced should NOT demote them from Nurture.
  const alumniContact = {
    pipelineStage: '4. Nurture / Interested', // current stage for CBT Advanced
    programRelationships: [{ program: 'CBT Basic', status: 'Existing Alumni' }],
    history: [],
    attemptCount: 0,
  };
  const r = evaluatePipeline(alumniContact, makeCall('SALES', 'Connected', 'Info Given'));
  // Info Given (rank 3) < Nurture (rank 4) → canTransition returns false → stays at Nurture
  assert('17. Alumni Program A: Info Given does not demote from Nurture (no backward)', r.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${r.pipelineStage}`);
  assert('17b. programRelationshipUpdate is null for Info Given', r.programRelationshipUpdate === null);

  // Also verify a NEW contact with alumni relationship (no current stage) gets Info Given
  const newAlumniContact = {
    pipelineStage: '1. New Lead',
    programRelationships: [{ program: 'CBT Basic', status: 'Existing Alumni' }],
    history: [],
    attemptCount: 0,
  };
  const r2 = evaluatePipeline(newAlumniContact, makeCall('SALES', 'Connected', 'Info Given'));
  assert('17c. New contact with alumni relationship + Sales Info Given → Information Given', r2.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r2.pipelineStage}`);
}


// ── Test 18: Alumni + Reg.Done same program → repeat registration ─────────────
{
  const alumniContact = makeContact('1. New Lead'); // fresh sales context for same program
  const r = evaluatePipeline(alumniContact, makeCall('SALES', 'Connected', 'Reg.Done'));
  assert('18. Alumni + Reg.Done same program → Registered / Won', r.pipelineStage === PIPELINE_STAGES.REGISTERED_WON);
  assert('18b. isAttenderCreditEligible = true', r.isAttenderCreditEligible === true);
}

// ── Test 19: Already Reg.d → programRelationshipUpdate, not pipelineStage ─────
{
  const contact = makeContact('3. Information Given');
  const r = evaluatePipeline(contact, makeCall('SALES', 'Connected', 'Already Reg.d'));
  assert('19. Already Reg.d → pipelineStage UNCHANGED', r.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r.pipelineStage}`);
  assert('19b. Already Reg.d → programRelationshipUpdate set', r.programRelationshipUpdate?.status === 'Existing Alumni');
}

// ── Test 20: Shivir done → programRelationshipUpdate, not pipelineStage ───────
{
  const contact = makeContact('6. Registered / Won');
  const r = evaluatePipeline(contact, makeCall('SALES', 'Connected', 'Shivir done'));
  assert('20. Shivir done → pipelineStage UNCHANGED (Registered / Won)', r.pipelineStage === PIPELINE_STAGES.REGISTERED_WON, `got: ${r.pipelineStage}`);
  assert('20b. Shivir done → programRelationshipUpdate = Existing Alumni', r.programRelationshipUpdate?.status === 'Existing Alumni');
}

// ── Test 21: Five Interested calls → 5 events, same pipeline stage ────────────
{
  let contact = makeContact('1. New Lead');
  for (let i = 0; i < 5; i++) {
    const r = evaluatePipeline(contact, makeCall('SALES', 'Connected', 'Interested'));
    contact = { ...contact, pipelineStage: r.pipelineStage };
  }
  assert('21. Five Interested calls → pipeline = Nurture / Interested', contact.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${contact.pipelineStage}`);
}

// ── Test 22: Five Reminder calls → pipeline stays Registered ─────────────────
{
  let contact = makeContact('6. Registered / Won');
  for (let i = 0; i < 5; i++) {
    const r = evaluatePipeline(contact, makeCall('REMINDER', 'Connected', 'Reminder Given'));
    contact = { ...contact, pipelineStage: r.pipelineStage };
  }
  assert('22. Five Reminder calls → pipeline remains Registered / Won', contact.pipelineStage === PIPELINE_STAGES.REGISTERED_WON, `got: ${contact.pipelineStage}`);
}

// ── Test 23: Query does NOT become Query Desk ─────────────────────────────────
{
  const r = evaluatePipeline(makeContact('1. New Lead'), makeCall('QUERY', 'Connected', 'Query', { queryStatus: 'Pending' }));
  assert('23. QUERY call → pipelineStage is NOT Query Desk', r.pipelineStage !== 'Query Desk', `got: ${r.pipelineStage}`);
  assert('23b. QUERY call on New Lead → remains New Lead', r.pipelineStage === PIPELINE_STAGES.NEW_LEAD, `got: ${r.pipelineStage}`);
}

// ── Test 24: Legacy Query Desk contact + Sales → forward transition ────────────
{
  const legacyContact = makeContact('Query Desk');
  const effectiveStage = getEffectiveStage(legacyContact);
  assert('24a. Legacy Query Desk → getEffectiveStage = New Lead', effectiveStage === PIPELINE_STAGES.NEW_LEAD, `got: ${effectiveStage}`);
  const r = evaluatePipeline(legacyContact, makeCall('SALES', 'Connected', 'Info Given'));
  assert('24b. Legacy Query Desk + Sales Info Given → Information Given', r.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r.pipelineStage}`);
}

// ── Test 25: Legacy Existing Alumni contact + Sales → forward transition ───────
{
  const legacyContact = makeContact('Existing Alumni');
  const effectiveStage = getEffectiveStage(legacyContact);
  assert('25a. Legacy Existing Alumni → getEffectiveStage = New Lead', effectiveStage === PIPELINE_STAGES.NEW_LEAD, `got: ${effectiveStage}`);
  const r = evaluatePipeline(legacyContact, makeCall('SALES', 'Connected', 'Interested'));
  assert('25b. Legacy Existing Alumni + Sales Interested → Nurture', r.pipelineStage === PIPELINE_STAGES.NURTURE_INTERESTED, `got: ${r.pipelineStage}`);
}

// ── Test 26: 5 attempts auto-close (only for rank ≤ 2) ───────────────────────
{
  const contact = makeContact('2. Attempting Contact', [], { attemptCount: 4 });
  const r = evaluatePipeline(contact, makeCall('SALES', 'Not Picked Up', 'Not Picked Up'));
  assert('26. 5 unconnected attempts → Closed / Invalid (rank ≤ 2)', r.pipelineStage === PIPELINE_STAGES.CLOSED_INVALID, `got: ${r.pipelineStage}`);
  assert('26b. closedReason = Automated', r.closedReason?.includes('Automated'));
}

// ── Test 27: 5 attempts do NOT close established leads ────────────────────────
{
  const contact = makeContact('3. Information Given', [], { attemptCount: 10 });
  const r = evaluatePipeline(contact, makeCall('SALES', 'Not Picked Up', 'Not Picked Up'));
  assert('27. 5+ unconnected attempts on Info Given → remains Info Given', r.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r.pipelineStage}`);
}

// ── Test 28: Closed lead reactivation ────────────────────────────────────────
{
  const contact = makeContact('Closed / Lost');
  const r = evaluatePipeline(contact, makeCall('SALES', 'Connected', 'Info Given'));
  assert('28. Closed + Connected Info Given → reactivated to Info Given', r.pipelineStage === PIPELINE_STAGES.INFO_GIVEN, `got: ${r.pipelineStage}`);
}

// ── Test 29: canTransition backward demotion blocked ─────────────────────────
{
  assert('29a. canTransition Nurture→Info Given = false (backward)', canTransition('4. Nurture / Interested', '3. Information Given') === false);
  assert('29b. canTransition Registered→Nurture = false (backward)', canTransition('6. Registered / Won', '4. Nurture / Interested') === false);
}

// ── Test 30: shouldShowConvertToSales logic ────────────────────────────────────
{
  assert('30a. New Lead → showConvertToSales = true',  shouldShowConvertToSales(makeContact('1. New Lead')) === true);
  assert('30b. Attempting → showConvertToSales = true', shouldShowConvertToSales(makeContact('2. Attempting Contact')) === true);
  assert('30c. Info Given → showConvertToSales = false', shouldShowConvertToSales(makeContact('3. Information Given')) === false);
  assert('30d. Nurture → showConvertToSales = false', shouldShowConvertToSales(makeContact('4. Nurture / Interested')) === false);
  assert('30e. Registered → showConvertToSales = false', shouldShowConvertToSales(makeContact('6. Registered / Won')) === false);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════');
console.log(' PIPELINE ENGINE V2 — TEST RESULTS');
console.log('═══════════════════════════════════════');
results.forEach(r => console.log(`${r.status}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`));
console.log('───────────────────────────────────────');
console.log(`Total: ${passed + failed}  ✅ Passed: ${passed}  ❌ Failed: ${failed}`);
console.log('═══════════════════════════════════════\n');

if (failed > 0) process.exit(1);
