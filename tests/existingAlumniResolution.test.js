import assert from 'assert';
import { evaluatePipeline, PIPELINE_STAGES, canTransition, normalizeStageStr, getEffectiveStage } from '../src/utils/pipelineEngine.js';
import { isStageRegisteredWon, getCanonicalRegistrations } from '../src/utils/registrationEngine.js';

console.log('=== RUNNING EXISTING ALUMNI RESOLUTION TESTS ===');

// 1. evaluatePipeline with Alumni outcomes
{
  const testOutcomes = [
    'Already Reg.d',
    'already reg.d',
    'already reg done',
    'Already reg. done',
    'Already Registered',
    'already registered',
    'Shivir done',
    'shivir done',
    'Shivir Done',
    'Shivir already done',
    'shivir already done'
  ];

  for (const outcome of testOutcomes) {
    const contact = { pipelineStage: '3. Information Given', history: [] };
    const res = evaluatePipeline(contact, {
      callPurpose: 'SALES',
      callStatus: 'Connected',
      status: outcome
    });
    assert.strictEqual(
      res.pipelineStage,
      PIPELINE_STAGES.EXISTING_ALUMNI,
      `Outcome "${outcome}" should resolve to Existing Alumni stage, got: ${res.pipelineStage}`
    );
    assert.strictEqual(
      res.programRelationshipUpdate?.status,
      'Existing Alumni',
      `Outcome "${outcome}" should set programRelationshipUpdate to Existing Alumni`
    );
    assert.strictEqual(
      res.isAttenderCreditEligible,
      false,
      `Outcome "${outcome}" must NOT be eligible for registration credit`
    );
  }
  console.log('✓ 1. All variations of Already Reg.d and Shivir done resolve to Existing Alumni stage.');
}

// 2. Transition to Existing Alumni from any previous stage is permitted
{
  const priorStages = [
    '1. New Lead',
    '2. Attempting Contact',
    '3. Information Given',
    'Previous Program Pending',
    '4. Nurture / Interested',
    '5. Future Pool',
    '6. Registered / Won',
    'Closed / Lost',
    'Closed / Invalid'
  ];

  for (const st of priorStages) {
    assert.strictEqual(
      canTransition(st, 'Existing Alumni'),
      true,
      `Transition from "${st}" to Existing Alumni should be permitted`
    );
    assert.strictEqual(
      canTransition('Existing Alumni', st),
      true,
      `Transition from Existing Alumni to "${st}" should be permitted`
    );
  }
  console.log('✓ 2. Bidirectional transitions between Existing Alumni and all stages permitted.');
}

// 3. isStageRegisteredWon rejects Existing Alumni and Alumni statuses
{
  const alumniContact1 = { pipelineStage: 'Existing Alumni', status: 'Already Reg.d' };
  const alumniContact2 = { pipelineStage: 'Existing Alumni', status: 'Shivir done' };
  const alumniContact3 = { pipelineStage: 'Existing Alumni', status: 'Already reg. done' };
  const alumniContact4 = { pipelineStage: 'Existing Alumni', status: 'already registered' };
  const regContact = { pipelineStage: '6. Registered / Won', status: 'Reg.Done' };

  assert.strictEqual(isStageRegisteredWon(alumniContact1), false, 'Already Reg.d must not be registered');
  assert.strictEqual(isStageRegisteredWon(alumniContact2), false, 'Shivir done must not be registered');
  assert.strictEqual(isStageRegisteredWon(alumniContact3), false, 'Already reg. done must not be registered');
  assert.strictEqual(isStageRegisteredWon(alumniContact4), false, 'already registered must not be registered');
  assert.strictEqual(isStageRegisteredWon(regContact), true, 'Reg.Done must be registered');

  console.log('✓ 3. isStageRegisteredWon correctly excludes Alumni and identifies true registrations.');
}

// 4. normalizeStageStr returns Existing Alumni
{
  assert.strictEqual(normalizeStageStr('Existing Alumni'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('existing alumni'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('alumni'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('Already Reg.d'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('Already reg. done'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('already registered'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('Shivir done'), 'Existing Alumni');
  assert.strictEqual(normalizeStageStr('shivir already done'), 'Existing Alumni');

  console.log('✓ 4. normalizeStageStr correctly resolves Existing Alumni across case variations.');
}

// 5. getCanonicalRegistrations excludes Existing Alumni from fallback synthesis
{
  const contacts = [
    {
      id: 'contact_alumni',
      pipelineStage: 'Existing Alumni',
      status: 'Already Reg.d',
      calledFor: 'Digestive Avd',
      updatedAt: '2026-09-10T12:00:00.000Z',
      history: [
        {
          calledFor: 'Digestive Avd',
          status: 'Already Reg.d',
          pipelineStage: 'Existing Alumni',
          timestamp: '2026-09-10T12:00:00.000Z'
        }
      ]
    },
    {
      id: 'contact_real_reg',
      pipelineStage: '6. Registered / Won',
      status: 'Reg.Done',
      calledFor: 'CBT Basic',
      updatedAt: '2026-09-10T12:00:00.000Z',
      history: [
        {
          calledFor: 'CBT Basic',
          status: 'Reg.Done',
          pipelineStage: '6. Registered / Won',
          timestamp: '2026-09-10T12:00:00.000Z'
        }
      ]
    }
  ];

  const regs = getCanonicalRegistrations([], contacts, {
    startDate: '2026-09-01',
    endDate: '2026-09-30'
  });

  assert.strictEqual(regs.length, 1, `Expected 1 registration, got ${regs.length}`);
  assert.strictEqual(regs[0].contactId, 'contact_real_reg');
  assert.strictEqual(regs[0].calledFor, 'CBT Basic');

  console.log('✓ 5. getCanonicalRegistrations synthesizes only true registrations, ignoring Existing Alumni.');
}

// 6. determineCallType does not mistake an alumni call for a registration call
{
  const { determineCallType } = await import('../src/utils/registrationEngine.js');
  const regRecord = {
    history: [
      { status: 'Reg.Done', callType: 'incoming', isIncoming: true },
      { status: 'already registered', callType: 'outgoing', isIncoming: false }
    ]
  };
  assert.strictEqual(
    determineCallType(regRecord),
    'incoming',
    'determineCallType should match the real registration call (incoming), not the later alumni call'
  );
  console.log('✓ 6. determineCallType correctly ignores alumni calls when finding converting registration call.');
}

// 7. STATUS_OPTIONS contains Shivir done and Already Reg.d by default, and updateDynamicOptions updates accurately
{
  const { STATUS_OPTIONS, updateDynamicOptions, SALES_OUTCOME_OPTIONS, SOURCE_OPTIONS } = await import('../src/features/attender/utils.js');
  assert.ok(STATUS_OPTIONS.includes('Shivir done'), 'STATUS_OPTIONS must include "Shivir done"');
  assert.ok(STATUS_OPTIONS.includes('Already Reg.d'), 'STATUS_OPTIONS must include "Already Reg.d"');

  // Test updateDynamicOptions accurately updates and honors deletions/customizations
  updateDynamicOptions({
    salesOutcomeOptions: ['Interested', 'Info Given', 'Reg.Done', 'Custom Outcome'],
    sourceOptions: ['Website', 'Facebook', 'Custom Source'],
    statusOptions: ['Interested', 'Info Given', 'Custom Status']
  });

  assert.ok(SALES_OUTCOME_OPTIONS.includes('Custom Outcome'), 'SALES_OUTCOME_OPTIONS must include "Custom Outcome"');
  assert.ok(!SALES_OUTCOME_OPTIONS.includes('NonExistent Outcome'), 'SALES_OUTCOME_OPTIONS must not contain non-existent outcome');
  assert.ok(SOURCE_OPTIONS.includes('Custom Source'), 'SOURCE_OPTIONS must include "Custom Source"');
  assert.ok(STATUS_OPTIONS.includes('Custom Status'), 'STATUS_OPTIONS must include "Custom Status"');

  console.log('✓ 7. STATUS_OPTIONS and dynamic options update verified.');
}

console.log('\nALL EXISTING ALUMNI RESOLUTION TESTS PASSED! 🚀');
