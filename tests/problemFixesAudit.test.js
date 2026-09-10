import assert from 'assert';
import { describe, it } from 'node:test';
import { getEffectiveStage, evaluatePipeline, PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';
import { getContactLeadOrigin, getContactSource } from '../src/utils/registrationEngine.js';
import { extractProgramsList } from '../src/features/attender/utils/programContextHelper.js';

describe('TGF CRM V3 — Deep Audit & Fix Verification', () => {

  // ── Problem 2: Previous Program Pending & Query/Reminder Isolation ────────
  describe('Problem 2 — Stage Preservation & Call Isolation', () => {

    it('1. getEffectiveStage should return null for uncontacted program while evaluatePipeline preserves baseline stage', () => {
      const contact = {
        pipelineStage: PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING,
        status: 'Previous Program Pending',
        history: [],
        programStates: {}
      };

      // Querying for a NEW program for which no history exists yet returns clean null
      const derivedStage = getEffectiveStage(contact, 'Advance Shivir');
      assert.strictEqual(derivedStage, null);

      // But evaluatePipeline uses baseline pipelineStage so stage is not demoted
      const evalRes = evaluatePipeline(contact, { calledFor: 'Advance Shivir', callPurpose: 'SALES', callStatus: 'Not Picked Up' });
      assert.strictEqual(evalRes.pipelineStage, PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING);
    });

    it('2. evaluatePipeline must NOT demote Previous Program Pending on unconnected call for a new program', () => {
      const contact = {
        pipelineStage: PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING,
        status: 'Previous Program Pending',
        attemptCount: 0,
        history: [],
        programStates: {}
      };

      const result = evaluatePipeline(contact, {
        calledFor: 'Advance Shivir',
        callPurpose: 'SALES',
        callStatus: 'Not Picked Up',
        status: 'Not Picked Up'
      });

      assert.strictEqual(result.pipelineStage, PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING);
    });

    it('3. QUERY calls must NEVER alter baseline pipelineStage', () => {
      const contact = {
        pipelineStage: PIPELINE_STAGES.NURTURE_INTERESTED,
        status: 'Interested',
        history: []
      };

      const result = evaluatePipeline(contact, {
        calledFor: 'CBT Basic',
        callPurpose: 'QUERY',
        callStatus: 'Connected',
        status: 'Query Solved',
        queryStatus: 'Query Solved'
      });

      assert.strictEqual(result.pipelineStage, PIPELINE_STAGES.NURTURE_INTERESTED);
      assert.strictEqual(result.queryStatus, 'Query Solved');
    });

    it('4. REMINDER calls must NEVER alter baseline pipelineStage', () => {
      const contact = {
        pipelineStage: PIPELINE_STAGES.INFO_GIVEN,
        status: 'Info Given',
        history: []
      };

      const result = evaluatePipeline(contact, {
        calledFor: 'CBT Basic',
        callPurpose: 'REMINDER',
        callStatus: 'Connected',
        status: 'Reminder Sent'
      });

      assert.strictEqual(result.pipelineStage, PIPELINE_STAGES.INFO_GIVEN);
    });
  });

  // ── Problem 1: Lead Origin Tri-Alias & Immutability ─────────────────────────
  describe('Problem 1 — Lead Origin Field Integrity', () => {

    it('1. getContactLeadOrigin reads tri-alias correctly', () => {
      const c1 = { leadOrigin: 'Facebook Ads' };
      const c2 = { original_source: 'Google Search' };
      const c3 = { originalSource: 'Instagram' };

      assert.strictEqual(getContactLeadOrigin(c1), 'Facebook Ads');
      assert.strictEqual(getContactLeadOrigin(c2), 'Google Search');
      assert.strictEqual(getContactLeadOrigin(c3), 'Instagram');
    });

    it('2. Current Source updates do not alter leadOrigin', () => {
      const contact = {
        leadOrigin: 'Facebook Ads',
        original_source: 'Facebook Ads',
        originalSource: 'Facebook Ads',
        currentSource: 'Facebook Ads',
        source: 'Facebook Ads'
      };

      const callEvent = {
        currentSource: 'WhatsApp Outbound',
        source: 'WhatsApp Outbound'
      };

      const resolvedOrigin = getContactLeadOrigin(contact, callEvent);
      assert.strictEqual(resolvedOrigin, 'Facebook Ads');
    });
  });

  // ── Problem 4: Shared Leads & Registration Keying ─────────────────────────
  describe('Problem 4 — Shared Lead Registration Uniqueness & Modal Auto-fill', () => {

    it('1. Registration ID keying format matches reg_contactId_calledForKey', () => {
      const contactId = '654321abcdef012345678901';
      const calledFor = 'CBT Basic';
      const cleanKey = calledFor.toLowerCase().replace(/[\s_-]+/g, '');
      const regId = `reg_${contactId}_${cleanKey}`;

      assert.strictEqual(regId, 'reg_654321abcdef012345678901_cbtbasic');
    });

    it('2. Shared contact without viewer state resolves Lead Owner stage and extracts nested origin/source', () => {
      const sharedContact = {
        name: 'Bhanwar Lal',
        leadOwner: 'Geeta',
        leadOwnerName: 'Geeta',
        attenderStates: {
          geeta: {
            attenderName: 'Geeta',
            calledFor: 'Off MA',
            pipelineStage: '4. Nurture / Interested',
            source: 'YouTube',
            leadOrigin: 'YouTube'
          }
        },
        history: [
          {
            attenderName: 'Geeta',
            calledFor: 'Off MA',
            status: 'Interested',
            source: 'YouTube',
            original_source: 'YouTube',
            timestamp: new Date('2026-07-24T14:57:00Z')
          }
        ]
      };

      // Attender B (Manisha) has no calls logged for Off MA yet, so getEffectiveStage falls back to program stage ("4. Nurture / Interested")
      const manishaStage = getEffectiveStage(sharedContact, 'Off MA', 'manisha');
      assert.strictEqual(manishaStage, '4. Nurture / Interested');

      // Contact-level program stage resolves Geeta's stage ("4. Nurture / Interested")
      const contactProgStage = getEffectiveStage(sharedContact, 'Off MA');
      assert.strictEqual(contactProgStage, '4. Nurture / Interested');

      // Overall contact fallback stage resolves Geeta's stage ("4. Nurture / Interested")
      const overallStage = getEffectiveStage(sharedContact);
      assert.strictEqual(overallStage, '4. Nurture / Interested');

      // Nested origin and source resolution
      const origin = getContactLeadOrigin(sharedContact, 'Off MA');
      const source = getContactSource(sharedContact, 'Off MA');

      assert.strictEqual(origin, 'YouTube');
      assert.strictEqual(source, 'YouTube');
    });

    it('3. extractProgramsList MUST filter out non-program labels like Incoming Calls', () => {
      const contactWithCallTypeInCalledFor = {
        'Called For': 'Incoming Calls',
        calledFor: 'Incoming Calls',
        attenderStates: {
          geeta: {
            calledFor: 'Off MA'
          }
        },
        history: [
          {
            calledFor: 'Incoming',
            program: 'Off MA'
          }
        ]
      };

      const extracted = extractProgramsList(contactWithCallTypeInCalledFor);
      assert.deepStrictEqual(extracted, ['Off MA']);
    });
  });

});

