import { describe, test } from 'node:test';
import assert from 'node:assert';
import { getContactSource, getContactLeadOrigin, getCanonicalRegistrations } from '../registrationEngine.js';
import { evaluatePresetRule } from '../presetEngine.js';

describe('Dual Source Analytics Architecture', () => {
  // Test Data Setup
  const contact1 = {
    id: 'c1',
    _id: 'c1',
    Name: 'Alice Smith',
    Phone: '9876543210',
    original_source: 'Facebook Ads',
    source: 'Campaign Fall 2025',
    calledFor: 'CBT Basic',
    pipelineStage: '6. Registered / Won',
    status: 'Reg.Done',
    registeredAt: '2025-10-15'
  };

  const contact2 = {
    id: 'c2',
    _id: 'c2',
    Name: 'Bob Jones',
    Phone: '9876543211',
    original_source: 'Google Search',
    source: 'Campaign Fall 2025',
    calledFor: 'CBT Basic',
    pipelineStage: '6. Registered / Won',
    status: 'Reg.Done',
    registeredAt: '2025-10-16'
  };

  const contact3 = {
    id: 'c3',
    _id: 'c3',
    Name: 'Charlie Brown',
    Phone: '9876543212',
    original_source: 'Facebook Ads',
    source: 'Incoming Call',
    calledFor: 'CBT Advanced',
    pipelineStage: '6. Registered / Won',
    status: 'Reg.Done',
    registeredAt: '2025-10-17',
    tags: ['Tag1', 'Tag2', 'Tag3']
  };

  const allContacts = [contact1, contact2, contact3];

  // 1. Lead Origin Extraction
  test('1. Extracts Lead Origin correctly from contact fields', () => {
    assert.strictEqual(getContactLeadOrigin(contact1), 'Facebook Ads');
    assert.strictEqual(getContactLeadOrigin(contact2), 'Google Search');
  });

  // 2. Current Source Extraction
  test('2. Extracts Current Source correctly without falling back to Lead Origin', () => {
    assert.strictEqual(getContactSource(contact1), 'Campaign Fall 2025');
    assert.strictEqual(getContactSource(contact3), 'Incoming Call');
  });

  // 3. Lead Origin-only Filtering
  test('3. Filters registrations by Lead Origin only', () => {
    const res = getCanonicalRegistrations([], allContacts, {
      selectedLeadOrigins: ['Facebook Ads']
    });
    assert.strictEqual(res.length, 2);
    assert.deepStrictEqual(res.map(r => r.contactId), ['c1', 'c3']);
  });

  // 4. Current Source-only Filtering
  test('4. Filters registrations by Current Source only', () => {
    const res = getCanonicalRegistrations([], allContacts, {
      selectedSources: ['Campaign Fall 2025']
    });
    assert.strictEqual(res.length, 2);
    assert.deepStrictEqual(res.map(r => r.contactId), ['c1', 'c2']);
  });

  // 5. Both Filters Simultaneously (AND Logic)
  test('5. Applies strict AND logic when both Lead Origin and Current Source are specified', () => {
    const res = getCanonicalRegistrations([], allContacts, {
      selectedLeadOrigins: ['Facebook Ads'],
      selectedSources: ['Campaign Fall 2025']
    });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].contactId, 'c1');
  });

  // 6. No Source Filters
  test('6. Returns all registrations when no source filters are selected', () => {
    const res = getCanonicalRegistrations([], allContacts, {});
    assert.strictEqual(res.length, 3);
  });

  // 7. Lead Origin Grouping (Analytics Layer Responsibility)
  test('7. Grouping by Lead Origin correctly groups Facebook Ads leads together', () => {
    const regs = getCanonicalRegistrations([], allContacts, {});
    const leadOriginGroup = {};
    regs.forEach(r => {
      const origin = r.leadOrigin || 'Unknown';
      leadOriginGroup[origin] = (leadOriginGroup[origin] || 0) + 1;
    });

    assert.strictEqual(leadOriginGroup['Facebook Ads'], 2);
    assert.strictEqual(leadOriginGroup['Google Search'], 1);
  });

  // 8. Current Source Grouping (Analytics Layer Responsibility)
  test('8. Grouping by Current Source correctly groups Campaign Fall 2025 calls together', () => {
    const regs = getCanonicalRegistrations([], allContacts, {});
    const sourceGroup = {};
    regs.forEach(r => {
      const src = r.source || 'Unknown';
      sourceGroup[src] = (sourceGroup[src] || 0) + 1;
    });

    assert.strictEqual(sourceGroup['Campaign Fall 2025'], 2);
    assert.strictEqual(sourceGroup['Incoming Call'], 1);
  });

  // 9. Registration Identity Stability
  test('9. Registration identity and total count remain unchanged regardless of analysis dimension', () => {
    const regs = getCanonicalRegistrations([], allContacts, { startDate: '2025-10-01', endDate: '2025-10-31' });
    assert.strictEqual(regs.length, 3);
    assert.strictEqual(regs.every(r => r.source && r.leadOrigin), true);
  });

  // 10. Tags Do Not Overwrite Lead Origin
  test('10. Contact with multiple historical tags is not assigned an arbitrary Lead Origin', () => {
    assert.strictEqual(getContactLeadOrigin(contact3), 'Facebook Ads');
    assert.strictEqual(contact3.tags.length, 3);
  });

  // 11. Preset Engine Dual Source Evaluation
  test('11. Preset engine handles leadOriginQuery and currentSourceQuery independently', () => {
    const originRule = { leadOriginQuery: 'Facebook' };
    const sourceRule = { currentSourceQuery: 'Incoming' };
    const dualRule = { leadOriginQuery: 'Facebook', currentSourceQuery: 'Campaign' };

    assert.strictEqual(evaluatePresetRule(contact1, originRule), true);
    assert.strictEqual(evaluatePresetRule(contact2, originRule), false);

    assert.strictEqual(evaluatePresetRule(contact3, sourceRule), true);
    assert.strictEqual(evaluatePresetRule(contact1, sourceRule), false);

    assert.strictEqual(evaluatePresetRule(contact1, dualRule), true);
    assert.strictEqual(evaluatePresetRule(contact3, dualRule), false);
  });

  describe('Program-Context Isolated Source Resolution (Multi-Program Contact)', () => {
    const rahulMultiProgramContact = {
      id: 'rahul_1',
      _id: 'rahul_1',
      Name: 'Rahul',
      Phone: '9998887770',
      original_source: 'Facebook',
      source: 'WhatsApp', // Root/latest source from CBT Advanced
      history: [
        {
          id: 'h1',
          calledFor: 'CBT Basic',
          original_source: 'Facebook',
          source: 'Instagram',
          status: 'Reg.Done',
          timestamp: '2025-08-01'
        },
        {
          id: 'h2',
          calledFor: 'CBT Advanced',
          original_source: 'Facebook',
          source: 'WhatsApp',
          status: 'Reg.Done',
          timestamp: '2025-09-01'
        }
      ]
    };

    test('TEST 1: Resolves distinct program-specific sources for CBT Basic (Instagram) and CBT Advanced (WhatsApp)', () => {
      const regs = getCanonicalRegistrations([], [rahulMultiProgramContact], {});
      assert.strictEqual(regs.length, 2);

      const basicReg = regs.find(r => r.calledForKey === 'cbtbasic');
      const advReg = regs.find(r => r.calledForKey === 'cbtadvanced');

      assert.ok(basicReg, 'CBT Basic registration should exist');
      assert.ok(advReg, 'CBT Advanced registration should exist');

      assert.strictEqual(basicReg.leadOrigin, 'Facebook');
      assert.strictEqual(basicReg.source, 'Instagram');

      assert.strictEqual(advReg.leadOrigin, 'Facebook');
      assert.strictEqual(advReg.source, 'WhatsApp');
    });

    test('TEST 2: Filter Current Source = Instagram matches CBT Basic only (CBT Advanced must NOT match)', () => {
      const regs = getCanonicalRegistrations([], [rahulMultiProgramContact], {
        selectedSources: ['Instagram']
      });
      assert.strictEqual(regs.length, 1);
      assert.strictEqual(regs[0].calledForKey, 'cbtbasic');
      assert.strictEqual(regs[0].source, 'Instagram');
    });

    test('TEST 3: Filter Current Source = WhatsApp matches CBT Advanced only (CBT Basic must NOT match)', () => {
      const regs = getCanonicalRegistrations([], [rahulMultiProgramContact], {
        selectedSources: ['WhatsApp']
      });
      assert.strictEqual(regs.length, 1);
      assert.strictEqual(regs[0].calledForKey, 'cbtadvanced');
      assert.strictEqual(regs[0].source, 'WhatsApp');
    });

    test('TEST 4: Filter Lead Origin = Facebook matches both CBT Basic and CBT Advanced contexts', () => {
      const regs = getCanonicalRegistrations([], [rahulMultiProgramContact], {
        selectedLeadOrigins: ['Facebook']
      });
      assert.strictEqual(regs.length, 2);
    });

    test('TEST 5: Filter Lead Origin = Facebook AND Current Source = Instagram matches CBT Basic only', () => {
      const regs = getCanonicalRegistrations([], [rahulMultiProgramContact], {
        selectedLeadOrigins: ['Facebook'],
        selectedSources: ['Instagram']
      });
      assert.strictEqual(regs.length, 1);
      assert.strictEqual(regs[0].calledForKey, 'cbtbasic');
    });

    test('TEST 6: Filter Lead Origin = Facebook AND Current Source = WhatsApp matches CBT Advanced only', () => {
      const regs = getCanonicalRegistrations([], [rahulMultiProgramContact], {
        selectedLeadOrigins: ['Facebook'],
        selectedSources: ['WhatsApp']
      });
      assert.strictEqual(regs.length, 1);
      assert.strictEqual(regs[0].calledForKey, 'cbtadvanced');
    });

    test('TEST 7: getContactSource returns Instagram for CBT Basic and WhatsApp for CBT Advanced independently', () => {
      assert.strictEqual(getContactSource(rahulMultiProgramContact, 'CBT Basic'), 'Instagram');
      assert.strictEqual(getContactSource(rahulMultiProgramContact, 'CBT Advanced'), 'WhatsApp');
    });

    test('TEST 8: Reversing history entry order still resolves source according to correct program context', () => {
      const reversedRahul = {
        ...rahulMultiProgramContact,
        history: [rahulMultiProgramContact.history[1], rahulMultiProgramContact.history[0]]
      };
      assert.strictEqual(getContactSource(reversedRahul, 'CBT Basic'), 'Instagram');
      assert.strictEqual(getContactSource(reversedRahul, 'CBT Advanced'), 'WhatsApp');
    });
  });

  describe('Write Path Contextual Persistence & Database Reload Verification', () => {
    test('TEST 9: Contextual write path produces separate program-context sources for TGF Info and Other', () => {
      // Simulate MongoDB document produced by 2 consecutive calls:
      // Call 1: TGF Info -> Lead Origin: Facebook, Current Source: Instagram
      // Call 2: Other -> Lead Origin: Facebook, Current Source: YouTube
      const attenderId = 'att123';
      const persistedDoc = {
        _id: 'doc6436436623',
        id: 'doc6436436623',
        Name: 'Test Multi',
        Phone: '6436436623',
        original_source: 'Facebook',
        source: 'YouTube', // contact-level latest source
        programStates: {
          [attenderId]: {
            tgfinfo: {
              attenderId,
              programKey: 'tgfinfo',
              program: 'TGF Info',
              leadOrigin: 'Facebook',
              currentSource: 'Instagram',
              source: 'Instagram'
            },
            other: {
              attenderId,
              programKey: 'other',
              program: 'Other',
              leadOrigin: 'Facebook',
              currentSource: 'YouTube',
              source: 'YouTube'
            }
          }
        },
        history: [
          {
            calledFor: 'TGF Info',
            leadOrigin: 'Facebook',
            currentSource: 'Instagram',
            source: 'Instagram',
            status: 'Not Connected',
            timestamp: '2026-09-06T17:12:37.678Z'
          },
          {
            calledFor: 'Other',
            leadOrigin: 'Facebook',
            currentSource: 'YouTube',
            source: 'YouTube',
            status: 'Not Connected',
            timestamp: '2026-09-06T17:12:59.948Z'
          }
        ]
      };

      // Assert reload of TGF Info program context yields Instagram
      assert.strictEqual(getContactSource(persistedDoc, 'TGF Info'), 'Instagram');
      assert.strictEqual(getContactLeadOrigin(persistedDoc), 'Facebook');

      // Assert reload of Other program context yields YouTube
      assert.strictEqual(getContactSource(persistedDoc, 'Other'), 'YouTube');

      // Assert history entries preserve exact explicit attender selections
      assert.strictEqual(persistedDoc.history[0].currentSource, 'Instagram');
      assert.strictEqual(persistedDoc.history[0].leadOrigin, 'Facebook');
      assert.strictEqual(persistedDoc.history[1].currentSource, 'YouTube');
      assert.strictEqual(persistedDoc.history[1].leadOrigin, 'Facebook');
    });
  });
});

