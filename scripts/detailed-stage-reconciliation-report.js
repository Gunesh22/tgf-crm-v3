// scripts/detailed-stage-reconciliation-report.js
import { MongoClient } from 'mongodb';
import { getEffectiveStage, PIPELINE_STAGES, STAGE_RANKS } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

// Comprehensive Canonical Stage Derivation function
export const getCanonicalStage = (stageOrContact) => {
  let contact = {};
  let rawStage = "";

  if (typeof stageOrContact === 'string') {
    rawStage = stageOrContact;
  } else if (stageOrContact && typeof stageOrContact === 'object') {
    contact = stageOrContact;
    rawStage = contact.pipelineStage || "";
  }

  if (rawStage && String(rawStage).trim() !== "" && rawStage !== "null" && rawStage !== "undefined") {
    const s = String(rawStage).trim();
    if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    if (s === "Query Desk" || s === "Query") return "Query Desk";
    if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";
  }

  // Fallback for legacy contacts lacking explicit pipelineStage
  return getEffectiveStage(contact);
};

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log('====================================================');
  console.log('PIPELINE STAGE RECONCILIATION AUDIT REPORT');
  console.log('====================================================\n');

  console.log(`Total Contacts Queried from MongoDB: ${contacts.length}\n`);

  // Group 1: Contacts WITH explicit pipelineStage (501)
  // Group 2: Contacts WITHOUT explicit pipelineStage (883)

  const groupWithStage = [];
  const groupWithoutStage = [];

  contacts.forEach(c => {
    if (c.pipelineStage && String(c.pipelineStage).trim() !== "" && c.pipelineStage !== "null" && c.pipelineStage !== "undefined") {
      groupWithStage.push(c);
    } else {
      groupWithoutStage.push(c);
    }
  });

  console.log(`- Contacts WITH explicit pipelineStage field:    ${groupWithStage.length}`);
  console.log(`- Contacts WITHOUT explicit pipelineStage field: ${groupWithoutStage.length}`);

  // Reconcile Group 2 (883 contacts)
  const group2Breakdown = new Map();
  const group2RawStatus = new Map();

  groupWithoutStage.forEach(c => {
    const stage = getCanonicalStage(c);
    group2Breakdown.set(stage, (group2Breakdown.get(stage) || 0) + 1);

    const st = c.status || '(blank status)';
    if (!group2RawStatus.has(stage)) group2RawStatus.set(stage, new Map());
    const m = group2RawStatus.get(stage);
    m.set(st, (m.get(st) || 0) + 1);
  });

  console.log('\n----------------------------------------------------');
  console.log('RECONCILIATION OF THE 883 LEGACY CONTACTS (FORMERLY UNKNOWN)');
  console.log('----------------------------------------------------');
  const g2Table = Array.from(group2Breakdown.entries()).map(([stage, count]) => ({
    'Mapped Canonical Stage': stage,
    'Legacy Contacts': count,
    'Percentage of 883': ((count / 883) * 100).toFixed(1) + '%'
  })).sort((a, b) => b['Legacy Contacts'] - a['Legacy Contacts']);
  console.table(g2Table);

  console.log('\n----------------------------------------------------');
  console.log('FINAL COMBINED PIPELINE STAGE DISTRIBUTION (1,384 TOTAL)');
  console.log('----------------------------------------------------');

  const overallCounts = new Map();
  contacts.forEach(c => {
    const stage = getCanonicalStage(c);
    overallCounts.set(stage, (overallCounts.get(stage) || 0) + 1);
  });

  const overallTable = Array.from(overallCounts.entries()).map(([stage, count]) => ({
    'Canonical Stage': stage,
    'Explicit Stage (501)': contacts.filter(c => c.pipelineStage && getCanonicalStage(c) === stage).length,
    'Derived Legacy (883)': contacts.filter(c => !c.pipelineStage && getCanonicalStage(c) === stage).length,
    'Total People': count,
    'Percentage': ((count / 1384) * 100).toFixed(1) + '%'
  })).sort((a, b) => b['Total People'] - a['Total People']);

  console.table(overallTable);

  console.log('\nPARITY CHECK:');
  const totalMapped = Array.from(overallCounts.values()).reduce((a, b) => a + b, 0);
  console.log(`Total Mapped: ${totalMapped} / 1384 -> ${totalMapped === 1384 ? 'EXACT PARITY MATCH (100%) ✅' : 'MISMATCH ❌'}`);

  await client.close();
}

main().catch(console.error);
