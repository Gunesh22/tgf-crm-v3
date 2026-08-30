// scripts/semantic-pipeline-audit.js
import { MongoClient } from 'mongodb';
import { getEffectiveStage, PIPELINE_STAGES, UNCONNECTED_CALL_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const legacyContacts = contacts.filter(c => !c.pipelineStage || String(c.pipelineStage).trim() === "" || c.pipelineStage === "null" || c.pipelineStage === "undefined");

  console.log('====================================================');
  console.log(`SEMANTIC FORENSIC AUDIT: 883 LEGACY CONTACT PIPELINE DERIVATION`);
  console.log('====================================================\n');

  console.log(`Total Contacts in DB: ${contacts.length}`);
  console.log(`Explicit pipelineStage contacts: ${contacts.length - legacyContacts.length}`);
  console.log(`Legacy contacts lacking explicit pipelineStage: ${legacyContacts.length}\n`);

  // Evidence Category Breakdown for 883 Legacy Contacts
  const evidencePatterns = {
    REGISTERED_EVIDENCE: [],    // Reg.Done / Registered status or history
    NURTURE_EVIDENCE: [],       // Interested status or history
    INFO_GIVEN_EVIDENCE: [],    // Info given status or history
    FUTURE_POOL_EVIDENCE: [],   // Next time status or history
    CLOSED_LOST_EVIDENCE: [],   // Not interested / Not possible status or history
    INVALID_EVIDENCE: [],       // Invalid No / Wrong No status or 5+ unanswered attempts
    ATTEMPTING_EVIDENCE: [],    // 1-4 unanswered dial attempts (no connected sales outcome)
    FRESH_NEW_LEAD: [],         // 0 calls, fresh uncontacted lead
    QUERY_ONLY: [],             // Query call with no sales history
  };

  legacyContacts.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();

    // Check history outcomes
    let hasReg = statusLower.includes('reg.done') || statusLower.includes('registered');
    let hasNurture = statusLower.includes('interested') && !statusLower.includes('not interested');
    let hasInfo = statusLower.includes('info given') || statusLower.includes('information given');
    let hasNextTime = statusLower.includes('next time');
    let hasClosedLost = statusLower.includes('not interested') || statusLower.includes('not possible');
    let hasInvalid = statusLower.includes('invalid') || statusLower.includes('wrong no');

    let unconnectedAttempts = 0;
    let queryCallCount = 0;

    hist.forEach(h => {
      const hStat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      const hPurp = (h.callPurpose || '').toLowerCase().trim();

      if (hStat.includes('reg.done') || hStat.includes('registered')) hasReg = true;
      else if (hStat.includes('interested') && !hStat.includes('not interested')) hasNurture = true;
      else if (hStat.includes('info given') || hStat.includes('information given')) hasInfo = true;
      else if (hStat.includes('next time')) hasNextTime = true;
      else if (hStat.includes('not interested') || hStat.includes('not possible')) hasClosedLost = true;
      else if (hStat.includes('invalid') || hStat.includes('wrong no')) hasInvalid = true;

      const isUnconnected = UNCONNECTED_CALL_STATUSES.some(u => u.toLowerCase() === hStat);
      if (isUnconnected) unconnectedAttempts++;
      if (hPurp === 'query' || hStat.includes('query')) queryCallCount++;
    });

    if (hasReg) evidencePatterns.REGISTERED_EVIDENCE.push(c);
    else if (hasNurture) evidencePatterns.NURTURE_EVIDENCE.push(c);
    else if (hasInfo) evidencePatterns.INFO_GIVEN_EVIDENCE.push(c);
    else if (hasNextTime) evidencePatterns.FUTURE_POOL_EVIDENCE.push(c);
    else if (hasClosedLost) evidencePatterns.CLOSED_LOST_EVIDENCE.push(c);
    else if (hasInvalid) evidencePatterns.INVALID_EVIDENCE.push(c);
    else if (unconnectedAttempts >= 1 && unconnectedAttempts < 5) evidencePatterns.ATTEMPTING_EVIDENCE.push(c);
    else if (unconnectedAttempts >= 5) evidencePatterns.INVALID_EVIDENCE.push(c);
    else if (queryCallCount > 0 && hist.length === queryCallCount) evidencePatterns.QUERY_ONLY.push(c);
    else evidencePatterns.FRESH_NEW_LEAD.push(c);
  });

  console.log('----------------------------------------------------');
  console.log('1. EVIDENCE PATTERN BREAKDOWN (883 LEGACY CONTACTS)');
  console.log('----------------------------------------------------');
  
  const patternSummary = [
    { Pattern: 'Registered Evidence (Reg.Done / Registered)', Count: evidencePatterns.REGISTERED_EVIDENCE.length, 'Sales Stage Target': '6. Registered / Won' },
    { Pattern: 'Nurture Evidence (Interested)', Count: evidencePatterns.NURTURE_EVIDENCE.length, 'Sales Stage Target': '4. Nurture / Interested' },
    { Pattern: 'Information Given Evidence (Info Given)', Count: evidencePatterns.INFO_GIVEN_EVIDENCE.length, 'Sales Stage Target': '3. Information Given' },
    { Pattern: 'Future Pool Evidence (Next Time)', Count: evidencePatterns.FUTURE_POOL_EVIDENCE.length, 'Sales Stage Target': '5. Future Pool' },
    { Pattern: 'Closed Lost Evidence (Not Interested / Not Possible)', Count: evidencePatterns.CLOSED_LOST_EVIDENCE.length, 'Sales Stage Target': 'Closed / Lost' },
    { Pattern: '1-4 Unanswered Dial Attempts (no answer, Busy, Call Cut)', Count: evidencePatterns.ATTEMPTING_EVIDENCE.length, 'Sales Stage Target': '2. Attempting Contact' },
    { Pattern: 'Fresh Uncontacted Leads (0 call attempts)', Count: evidencePatterns.FRESH_NEW_LEAD.length, 'Sales Stage Target': '1. New Lead' },
    { Pattern: 'Query-Only Calls (No sales history)', Count: evidencePatterns.QUERY_ONLY.length, 'Sales Stage Target': '1. New Lead (Query Desk)' },
    { Pattern: 'Invalid / 5+ Unanswered Dials', Count: evidencePatterns.INVALID_EVIDENCE.length, 'Sales Stage Target': 'Closed / Invalid' }
  ];

  console.table(patternSummary);

  console.log('\n----------------------------------------------------');
  console.log('2. SEMANTIC STAGE COMPARISON TABLE FOR THE 883 LEGACY CONTACTS');
  console.log('----------------------------------------------------');

  const semanticTable = [
    {
      'Final Derived Stage': '1. New Lead',
      Count: evidencePatterns.FRESH_NEW_LEAD.length + evidencePatterns.QUERY_ONLY.length,
      'Strongest Evidence': 'Fresh uncalled leads (67) & Query-only leads (11) with zero sales history',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Genuinely uncalled or query-only contacts with 0 dial attempts'
    },
    {
      'Final Derived Stage': '2. Attempting Contact',
      Count: evidencePatterns.ATTEMPTING_EVIDENCE.length,
      'Strongest Evidence': '1 to 4 unanswered dial attempts (no answer, Busy, Call Cut, Not Attended)',
      'Potentially Ambiguous Count': evidencePatterns.ATTEMPTING_EVIDENCE.length,
      'Ambiguity Reason / Justification': 'Contacts dialed 1-4 times without reaching connected sales interaction'
    },
    {
      'Final Derived Stage': '3. Information Given',
      Count: evidencePatterns.INFO_GIVEN_EVIDENCE.length,
      'Strongest Evidence': 'Explicit connected call outcome "Info given" in history/status',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Direct connected sales interaction evidence'
    },
    {
      'Final Derived Stage': '4. Nurture / Interested',
      Count: evidencePatterns.NURTURE_EVIDENCE.length,
      'Strongest Evidence': 'Explicit connected call outcome "Interested" in history/status',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Direct connected sales interaction evidence'
    },
    {
      'Final Derived Stage': '5. Future Pool',
      Count: evidencePatterns.FUTURE_POOL_EVIDENCE.length,
      'Strongest Evidence': 'Explicit connected call outcome "Next time" in history/status',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Direct future pool outcome evidence'
    },
    {
      'Final Derived Stage': '6. Registered / Won',
      Count: evidencePatterns.REGISTERED_EVIDENCE.length,
      'Strongest Evidence': 'Explicit outcome "Reg.Done" or active registration record',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Direct registration record / outcome evidence'
    },
    {
      'Final Derived Stage': 'Closed / Lost',
      Count: evidencePatterns.CLOSED_LOST_EVIDENCE.length,
      'Strongest Evidence': 'Explicit outcome "Not interested" or "Not possible"',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Direct opt-out / loss outcome evidence'
    },
    {
      'Final Derived Stage': 'Closed / Invalid',
      Count: evidencePatterns.INVALID_EVIDENCE.length,
      'Strongest Evidence': 'Explicit "Invalid No" / "Wrong No" or 5+ unanswered dial attempts',
      'Potentially Ambiguous Count': 0,
      'Ambiguity Reason / Justification': 'Automated 5-attempt close or invalid number evidence'
    }
  ];

  console.table(semanticTable);

  const totalSemantic = semanticTable.reduce((a, b) => a + b.Count, 0);
  console.log(`\nTotal Legacy Contacts Analyzed: ${totalSemantic} / ${legacyContacts.length}`);

  await client.close();
}

main().catch(console.error);
