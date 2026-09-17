import assert from 'assert';
import {
  resolveRegistrationAttribution,
  getCanonicalRegistrations
} from '../src/utils/registrationEngine.js';
import { canTransition, PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

console.log('=== RUNNING SHARED REGISTRATION ATTRIBUTION TESTS ===\n');

// -------------------------------------------------------------
// Test 1: Null safety of resolveRegistrationAttribution
// -------------------------------------------------------------
console.log('Test 1: Null safety test for resolveRegistrationAttribution...');
try {
  const nullAttr = resolveRegistrationAttribution(null, null, null);
  assert.strictEqual(typeof nullAttr, 'object');
  assert.strictEqual(nullAttr.isSharedConversion, false);
  console.log('✓ TEST 1 PASSED: resolveRegistrationAttribution handles null/undefined arguments safely without throwing.');
} catch (err) {
  console.error('✗ TEST 1 FAILED:', err);
  process.exit(1);
}

// -------------------------------------------------------------
// Test 2: Normal registration (Lead Owner == Converter)
// -------------------------------------------------------------
console.log('\nTest 2: Normal registration attribution (Priyanka owns and Priyanka converts)...');
const normalReg = {
  id: 'reg_normal_1',
  contactId: 'c_normal_1',
  calledForKey: 'cbtbasic',
  programName: 'CBT Basic',
  attenderName: 'Priyanka',
  attenderId: 'priyanka_id',
  leadOwnerName: 'Priyanka',
  leadOwner: 'priyanka_id',
  convertedBy: 'Priyanka',
  convertingAttenderId: 'priyanka_id',
  registeredAt: '2026-09-10T10:00:00Z'
};

const normalContact = {
  id: 'c_normal_1',
  Name: 'Test Normal Lead',
  Phone: '9999990001',
  attenderName: 'Priyanka',
  leadOwnerName: 'Priyanka',
  leadOwner: 'priyanka_id',
  status: 'Reg.Done',
  pipelineStage: '6. Registered / Won'
};

const normalAttr = resolveRegistrationAttribution(normalReg, normalContact, 'cbtbasic');
assert.strictEqual(normalAttr.leadOwnerName, 'Priyanka');
assert.strictEqual(normalAttr.convertedBy, 'Priyanka');
assert.strictEqual(normalAttr.isSharedConversion, false);

const normalCanonical = getCanonicalRegistrations([normalReg], [normalContact], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

assert.strictEqual(normalCanonical.length, 1, 'Total registrations must be exactly 1');
assert.strictEqual(normalCanonical[0].attenderName, 'Priyanka', 'Primary attribution must be Priyanka');
assert.strictEqual(normalCanonical[0].isSharedConversion, false);
console.log('✓ TEST 2 PASSED: Normal registration correctly credits Priyanka with 0 assists.');

// -------------------------------------------------------------
// Test 3: Shared registration (Priyanka owns lead, Geeta converts)
// -------------------------------------------------------------
console.log('\nTest 3: Shared registration attribution (Priyanka owns lead, Geeta converts)...');
const sharedReg = {
  id: 'reg_shared_1',
  contactId: 'c_shared_1',
  calledForKey: 'offma',
  programName: 'Off MA',
  attenderName: 'Geeta', // Converter made the call
  attenderId: 'geeta_id',
  convertedBy: 'Geeta',
  convertingAttenderId: 'geeta_id',
  leadOwner: 'priyanka_id',
  leadOwnerName: 'Priyanka',
  registeredAt: '2026-09-10T11:00:00Z'
};

const sharedContact = {
  id: 'c_shared_1',
  Name: 'Test Shared Lead',
  Phone: '9999990002',
  assignedTo: ['priyanka_id', 'geeta_id'],
  attenderName: 'Geeta',
  leadOwnerName: 'Priyanka',
  leadOwner: 'priyanka_id',
  status: 'Reg.Done',
  pipelineStage: '6. Registered / Won'
};

const sharedAttr = resolveRegistrationAttribution(sharedReg, sharedContact, 'offma');
assert.strictEqual(sharedAttr.leadOwnerName, 'Priyanka', 'Lead Owner must be Priyanka');
assert.strictEqual(sharedAttr.convertedBy, 'Geeta', 'Converter must be Geeta');
assert.strictEqual(sharedAttr.isSharedConversion, true, 'Must be flagged as shared conversion');

const sharedCanonical = getCanonicalRegistrations([sharedReg], [sharedContact], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

assert.strictEqual(sharedCanonical.length, 1, 'Total registrations must be exactly 1 (NEVER double-counted)');
assert.strictEqual(sharedCanonical[0].leadOwnerName, 'Priyanka', 'Lead Owner must be Priyanka');
assert.strictEqual(sharedCanonical[0].attenderName, 'Priyanka', 'Primary attender on canonical record must be the Lead Owner');
assert.strictEqual(sharedCanonical[0].convertedBy, 'Geeta', 'Converting attender must be Geeta');
assert.strictEqual(sharedCanonical[0].isSharedConversion, true);
console.log('✓ TEST 3 PASSED: Shared registration attributes primary credit to Priyanka and assist to Geeta with count = 1.');

// -------------------------------------------------------------
// Test 4: Attender filtering modes (owner, converter, either)
// -------------------------------------------------------------
console.log('\nTest 4: Attender filtering modes...');
// Test Priyanka (Owner)
const priyankaOwnerRegs = getCanonicalRegistrations([sharedReg], [sharedContact], {
  selectedAttenderIds: ['priyanka_id'],
  attenderRoleMode: 'owner'
});
assert.strictEqual(priyankaOwnerRegs.length, 1, 'Priyanka matches as owner');

const priyankaConverterRegs = getCanonicalRegistrations([sharedReg], [sharedContact], {
  selectedAttenderIds: ['priyanka_id'],
  attenderRoleMode: 'converter'
});
assert.strictEqual(priyankaConverterRegs.length, 0, 'Priyanka does NOT match as converter');

const priyankaAnyRegs = getCanonicalRegistrations([sharedReg], [sharedContact], {
  selectedAttenderIds: ['priyanka_id'],
  attenderRoleMode: 'any'
});
assert.strictEqual(priyankaAnyRegs.length, 1, 'Priyanka matches under any');

// Test Geeta (Converter)
const geetaOwnerRegs = getCanonicalRegistrations([sharedReg], [sharedContact], {
  selectedAttenderIds: ['geeta_id'],
  attenderRoleMode: 'owner'
});
assert.strictEqual(geetaOwnerRegs.length, 0, 'Geeta does NOT match as owner');

const geetaConverterRegs = getCanonicalRegistrations([sharedReg], [sharedContact], {
  selectedAttenderIds: ['geeta_id'],
  attenderRoleMode: 'converter'
});
assert.strictEqual(geetaConverterRegs.length, 1, 'Geeta matches as converter');

const geetaAnyRegs = getCanonicalRegistrations([sharedReg], [sharedContact], {
  selectedAttenderIds: ['geeta_id'],
  attenderRoleMode: 'any'
});
assert.strictEqual(geetaAnyRegs.length, 1, 'Geeta matches under any');
console.log('✓ TEST 4 PASSED: getCanonicalRegistrations correctly respects attenderRoleMode (owner vs converter vs any).');

// -------------------------------------------------------------
// Test 5: Pipeline stage invariant (6. Registered / Won cannot demote to Closed / Lost or Closed / Invalid)
// -------------------------------------------------------------
console.log('\nTest 5: Pipeline stage invariant enforcement...');

const checkRegToLost = canTransition(PIPELINE_STAGES.STAGE_6, PIPELINE_STAGES.CLOSED_LOST);
assert.strictEqual(checkRegToLost, false, '6. Registered / Won must NOT be allowed to transition to Closed / Lost');

const checkRegToInvalid = canTransition(PIPELINE_STAGES.STAGE_6, PIPELINE_STAGES.CLOSED_INVALID);
assert.strictEqual(checkRegToInvalid, false, '6. Registered / Won must NOT be allowed to transition to Closed / Invalid');

// Ensure Existing Alumni can still transition to Closed / Lost if requested
const checkAlumniToLost = canTransition(PIPELINE_STAGES.ALUMNI, PIPELINE_STAGES.CLOSED_LOST);
assert.strictEqual(checkAlumniToLost, true, 'Existing Alumni transition to Closed / Lost must remain allowed');

console.log('✓ TEST 5 PASSED: Pipeline invariant blocks demotion of Registered / Won while preserving Alumni transitions.');

console.log('\n=== ALL SHARED REGISTRATION ATTRIBUTION TESTS PASSED (5/5) ===\n');
