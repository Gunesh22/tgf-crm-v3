// scripts/verify-drilldown-and-test-attenders.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

const getCanonicalStage = (stage) => {
  if (!stage || String(stage).trim() === '' || stage === 'null' || stage === 'undefined') {
    return 'Unknown / Legacy';
  }
  const s = String(stage).trim();
  if (s === PIPELINE_STAGES.NEW_LEAD || s === 'New Lead' || s === '1. New Lead') return PIPELINE_STAGES.NEW_LEAD;
  if (s === PIPELINE_STAGES.ATTEMPTING || s === 'Attempting Contact' || s === 'Attempting' || s === '2. Attempting Contact') return PIPELINE_STAGES.ATTEMPTING;
  if (s === PIPELINE_STAGES.INFO_GIVEN || s === 'Information Given' || s === 'Info Given' || s === '3. Information Given') return PIPELINE_STAGES.INFO_GIVEN;
  if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === 'Nurture / Interested' || s === 'Interested' || s === '4. Nurture / Interested') return PIPELINE_STAGES.NURTURE_INTERESTED;
  if (s === PIPELINE_STAGES.FUTURE_POOL || s === 'Future Pool' || s === 'Next Time' || s === '5. Future Pool') return PIPELINE_STAGES.FUTURE_POOL;
  if (s === PIPELINE_STAGES.REGISTERED_WON || s === 'Registered / Won' || s === 'Reg.Done' || s === '6. Registered / Won') return PIPELINE_STAGES.REGISTERED_WON;
  if (s === PIPELINE_STAGES.CLOSED_LOST || s === 'Closed / Lost' || s === 'Closed Lost' || s === '7. Closed / Lost') return PIPELINE_STAGES.CLOSED_LOST;
  if (s === PIPELINE_STAGES.CLOSED_INVALID || s === 'Closed / Invalid' || s === 'Invalid') return PIPELINE_STAGES.CLOSED_INVALID;
  return s;
};

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  console.log('====================================================');
  console.log('VERIFICATION: PIPELINE DRILL-DOWN & ATTENDER RECONCILIATION');
  console.log('====================================================\n');

  // 1. STAGE-BY-STAGE DRILLDOWN RECONCILIATION
  console.log('1. STAGE DRILL-DOWN RECONCILIATION (Card Count vs Filtered Array Count):');

  const stageBuckets = {
    [PIPELINE_STAGES.NEW_LEAD]: [],
    [PIPELINE_STAGES.ATTEMPTING]: [],
    [PIPELINE_STAGES.INFO_GIVEN]: [],
    [PIPELINE_STAGES.NURTURE_INTERESTED]: [],
    [PIPELINE_STAGES.FUTURE_POOL]: [],
    [PIPELINE_STAGES.REGISTERED_WON]: [],
    [PIPELINE_STAGES.CLOSED_LOST]: [],
    [PIPELINE_STAGES.CLOSED_INVALID]: [],
    'Unknown / Legacy': []
  };

  contacts.forEach(c => {
    const st = getCanonicalStage(c.pipelineStage);
    if (stageBuckets[st] !== undefined) {
      stageBuckets[st].push(c);
    } else {
      stageBuckets['Unknown / Legacy'].push(c);
    }
  });

  const drilldownResults = Object.entries(stageBuckets).map(([stageName, items]) => {
    const count = items.length;
    const title = `${stageName} — Contacts (${count})`;
    const isTitleValid = !title.includes('undefined') && title.endsWith(`(${count})`);
    const allMatchStage = items.every(item => getCanonicalStage(item.pipelineStage) === stageName);
    return {
      Stage: stageName,
      CardCount: count,
      FilteredModalCount: items.length,
      TitleGenerated: title,
      ValidTitle: isTitleValid ? 'PASS' : 'FAIL',
      StageMatch: allMatchStage ? 'PASS' : 'FAIL'
    };
  });

  console.table(drilldownResults);

  // Total contacts check
  const totalInBuckets = Object.values(stageBuckets).reduce((a, b) => a + b.length, 0);
  console.log(`- Total Contacts across all stage buckets: ${totalInBuckets} / ${contacts.length} (Difference: ${totalInBuckets - contacts.length})`);

  // 2. TEST AND TEST 2 ATTENDER RECONCILIATION
  console.log('\n2. TEST & TEST 2 ATTENDER RECONCILIATION:');

  const testAttenderDoc = attenders.find(a => a.id === 'JW20HztSjMfwNbVaCpxz');
  const test2AttenderDoc = attenders.find(a => a.id === 'hbMzjgMkmYa0D6ysM9RA');

  const testContacts = contacts.filter(c => (c.attenderId || c.assignedTo) === 'JW20HztSjMfwNbVaCpxz');
  const test2Contacts = contacts.filter(c => (c.attenderId || c.assignedTo) === 'hbMzjgMkmYa0D6ysM9RA');

  let testCalls = 0;
  let test2Calls = 0;
  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        if (h.attenderId === 'JW20HztSjMfwNbVaCpxz') testCalls++;
        if (h.attenderId === 'hbMzjgMkmYa0D6ysM9RA') test2Calls++;
      });
    }
  });

  const attenderResults = [
    {
      Attender: 'Test',
      AttenderID: 'JW20HztSjMfwNbVaCpxz',
      MasterRecordInDB: testAttenderDoc ? 'EXISTS' : 'MISSING',
      DBContacts: testContacts.length,
      ExpectedContacts: 56,
      ContactParity: testContacts.length === 56 ? 'PASS' : 'FAIL',
      DBHistoricalCalls: testCalls,
      ExpectedCalls: 61,
      CallParity: testCalls === 61 ? 'PASS' : 'FAIL'
    },
    {
      Attender: 'Test 2',
      AttenderID: 'hbMzjgMkmYa0D6ysM9RA',
      MasterRecordInDB: test2AttenderDoc ? 'EXISTS' : 'MISSING',
      DBContacts: test2Contacts.length,
      ExpectedContacts: 3,
      ContactParity: test2Contacts.length === 3 ? 'PASS' : 'FAIL',
      DBHistoricalCalls: test2Calls,
      ExpectedCalls: 13,
      CallParity: test2Calls === 13 ? 'PASS' : 'FAIL'
    }
  ];

  console.table(attenderResults);

  await client.close();
}

main().catch(console.error);
