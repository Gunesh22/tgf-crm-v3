// tests/registrationMismatchResolution.test.js
import assert from 'assert';
import { getCanonicalRegistrations, getCanonicalRegisteredPeople } from '../src/utils/registrationEngine.js';
import { PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

console.log('=== RUNNING REGISTRATION MISMATCH RESOLUTION TESTS ===');

// Test Case 1: Contact has status "Reg.Done" in contacts but missing from registrations collection
const contactsWithUnlinkedReg = [
  {
    id: 'contact_001',
    Name: 'Bhanwar Lal',
    Phone: '9876543210',
    status: 'Reg.Done',
    pipelineStage: '6. Registered / Won',
    calledFor: 'CBT Basic',
    updatedAt: '2026-09-02T10:00:00Z',
    attenderName: 'Manisha'
  }
];

const emptyRegistrations = [];

const result1 = getCanonicalRegistrations(emptyRegistrations, contactsWithUnlinkedReg, {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 1 Result (Unlinked Contact Registration):', result1.length);
assert.strictEqual(result1.length, 1, 'Test 1: Registered contact missing from registrations collection must be synthesized as fallback registration');
assert.strictEqual(result1[0].contactName, 'Bhanwar Lal');
assert.strictEqual(result1[0].calledForKey, 'cbtbasic');
console.log('✓ TEST 1 PASSED: Unlinked registered contact correctly fallback-synthesized.');

// Test Case 2: Contact has BOTH an explicit registration collection document AND a contact record
const explicitRegistrations = [
  {
    id: 'reg_001',
    contactId: 'contact_001',
    calledForKey: 'cbtbasic',
    contactName: 'Bhanwar Lal',
    contactPhone: '9876543210',
    calledFor: 'CBT Basic',
    registeredAt: '2026-09-02T10:00:00Z',
    attenderName: 'Manisha'
  }
];

const result2 = getCanonicalRegistrations(explicitRegistrations, contactsWithUnlinkedReg, {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 2 Result (Explicit + Contact Deduplication):', result2.length);
assert.strictEqual(result2.length, 1, 'Test 2: Explicit registration record and contact fallback must be deduplicated by (contactId + calledForKey)');
assert.strictEqual(result2[0].id, 'reg_001');
console.log('✓ TEST 2 PASSED: Explicit registration prioritized over fallback without duplicate count.');

// Test Case 3: Registration with updatedAt in September but createdAt in August
const augustCreatedReg = [
  {
    id: 'reg_002',
    contactId: 'contact_002',
    calledForKey: 'mahaasmani',
    contactName: 'Ramesh Kumar',
    contactPhone: '9123456789',
    calledFor: 'Maha Asmani',
    createdAt: '2026-08-25T10:00:00Z',
    registeredAt: '2026-09-05T14:30:00Z',
    updatedAt: '2026-09-05T14:30:00Z',
    attenderName: 'Sanjay'
  }
];

const result3 = getCanonicalRegistrations(augustCreatedReg, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 3 Result (Month boundary on registeredAt/updatedAt):', result3.length);
assert.strictEqual(result3.length, 1, 'Test 3: Registration registeredAt/updatedAt in September must be matched even if createdAt was in August');
console.log('✓ TEST 3 PASSED: Month boundary matching on registeredAt/updatedAt works correctly.');

// Test Case 4: Registration on first day of month (2026-09-01 00:05:00)
const firstDayReg = [
  {
    id: 'reg_003',
    contactId: 'contact_003',
    calledForKey: 'cbtbasic',
    contactName: 'Anita Sharma',
    contactPhone: '9988776655',
    calledFor: 'CBT Basic',
    registeredAt: '2026-09-01T00:05:00Z',
    attenderName: 'Manisha'
  }
];

const result4 = getCanonicalRegistrations(firstDayReg, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 4 Result (First day boundary):', result4.length);
assert.strictEqual(result4.length, 1, 'Test 4: First day boundary registration must be included');
console.log('✓ TEST 4 PASSED: First day boundary included.');

// Test Case 5: Registration on last day of month (2026-09-30 23:55:00)
const lastDayReg = [
  {
    id: 'reg_004',
    contactId: 'contact_004',
    calledForKey: 'cbtbasic',
    contactName: 'Sunil Verma',
    contactPhone: '9988776644',
    calledFor: 'CBT Basic',
    registeredAt: '2026-09-30T23:55:00Z',
    attenderName: 'Manisha'
  }
];

const result5 = getCanonicalRegistrations(lastDayReg, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 5 Result (Last day boundary):', result5.length);
assert.strictEqual(result5.length, 1, 'Test 5: Last day boundary registration must be included');
console.log('✓ TEST 5 PASSED: Last day boundary included.');

// Test Case 6: Multiple registration events for SAME contact and SAME program
const duplicateRegEvents = [
  { id: 'reg_1', contactId: 'contact_dup', calledForKey: 'cbtbasic', registeredAt: '2026-09-02T10:00:00Z' },
  { id: 'reg_2', contactId: 'contact_dup', calledForKey: 'cbtbasic', registeredAt: '2026-09-03T10:00:00Z' }
];

const result6 = getCanonicalRegistrations(duplicateRegEvents, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 6 Result (Multiple registration events same program):', result6.length);
assert.strictEqual(result6.length, 1, 'Test 6: 1 contact + 1 program = 1 registration (deduplicated)');
console.log('✓ TEST 6 PASSED: Unique contact + program constraint enforced.');

// Test Case 7: Multiple registrations for SAME contact but DIFFERENT programs (e.g. CBT Basic AND Maha Asmani)
const multiProgramRegs = [
  { id: 'reg_prog1', contactId: 'contact_multi', calledForKey: 'cbtbasic', calledFor: 'CBT Basic', registeredAt: '2026-09-02T10:00:00Z' },
  { id: 'reg_prog2', contactId: 'contact_multi', calledForKey: 'mahaasmani', calledFor: 'Maha Asmani', registeredAt: '2026-09-03T10:00:00Z' }
];

const result7 = getCanonicalRegistrations(multiProgramRegs, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 7 Result (Multiple registrations different programs):', result7.length);
assert.strictEqual(result7.length, 2, 'Test 7: 1 contact + 2 distinct programs = 2 program registrations');
console.log('✓ TEST 7 PASSED: Multi-program registrations correctly counted.');

// Test Case 8: Unique Registered People calculation
const peopleResult = getCanonicalRegisteredPeople(multiProgramRegs, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 8 Result (Registered People count for multi-program contact):', peopleResult.length);
assert.strictEqual(peopleResult.length, 1, 'Test 8: 1 contact registered for 2 programs = 1 unique registered person');
console.log('✓ TEST 8 PASSED: Registered people deduplicated per contact.');

// Test Case 9: Attender filter matching
const attenderFilterResult = getCanonicalRegistrations(augustCreatedReg, [], {
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  selectedAttenderIds: ['Sanjay']
});

console.log('Test 9 Result (Attender filter by name alias):', attenderFilterResult.length);
assert.strictEqual(attenderFilterResult.length, 1, 'Test 9: Attender filter matching by name alias must include record');
console.log('✓ TEST 9 PASSED: Attender filter by name alias matched correctly.');

// Test Case 10: Non-registered person
const nonRegisteredContact = [
  {
    id: 'contact_non_reg',
    status: 'Interested',
    pipelineStage: '4. Nurture / Interested',
    calledFor: 'CBT Basic',
    updatedAt: '2026-09-02T10:00:00Z'
  }
];

const result10 = getCanonicalRegistrations([], nonRegisteredContact, {
  startDate: '2026-09-01',
  endDate: '2026-09-30'
});

console.log('Test 10 Result (Non-registered contact):', result10.length);
assert.strictEqual(result10.length, 0, 'Test 10: Non-registered contact must yield 0 registrations');
console.log('✓ TEST 10 PASSED: Non-registered contact ignored.');

console.log('\nALL 10 REGISTRATION MISMATCH RESOLUTION TESTS PASSED 100%! 🎉');
