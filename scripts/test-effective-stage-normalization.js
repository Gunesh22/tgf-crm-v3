// scripts/test-effective-stage-normalization.js
import { MongoClient } from 'mongodb';
import { getEffectiveStage, PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

// Normalized getCanonicalStage that handles legacy status and pipelineStage values
export const getCanonicalStageNormalized = (contact = {}) => {
  const rawStage = contact.pipelineStage;
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

  // Derive effective stage from contact history & status if pipelineStage is missing
  return getEffectiveStage(contact);
};

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log(`Total Contacts: ${contacts.length}`);

  const normalizedCounts = new Map();
  const rawStatusBreakdown = new Map();

  contacts.forEach(c => {
    const stage = getCanonicalStageNormalized(c);
    normalizedCounts.set(stage, (normalizedCounts.get(stage) || 0) + 1);

    if (!rawStatusBreakdown.has(stage)) {
      rawStatusBreakdown.set(stage, new Map());
    }
    const statMap = rawStatusBreakdown.get(stage);
    const st = c.status || '(blank status)';
    statMap.set(st, (statMap.get(st) || 0) + 1);
  });

  console.log('\n====================================================');
  console.log('RECONCILED PIPELINE STAGE DISTRIBUTION (ALL 1,384 CONTACTS)');
  console.log('====================================================');
  
  const summaryTable = Array.from(normalizedCounts.entries()).map(([stage, count]) => ({
    'Canonical Stage': stage,
    'Contact Count': count,
    'Percentage': ((count / contacts.length) * 100).toFixed(1) + '%'
  })).sort((a, b) => b['Contact Count'] - a['Contact Count']);

  console.table(summaryTable);

  console.log('\n====================================================');
  console.log('DETAILED BREAKDOWN BY CANONICAL STAGE & RAW CONTACT STATUS');
  console.log('====================================================');
  for (const [stage, statMap] of rawStatusBreakdown.entries()) {
    console.log(`\n--- ${stage} (Total: ${normalizedCounts.get(stage)}) ---`);
    const t = Array.from(statMap.entries()).map(([st, cnt]) => ({
      'Raw Status': st,
      Count: cnt
    })).sort((a, b) => b.Count - a.Count);
    console.table(t);
  }

  await client.close();
}

main().catch(console.error);
