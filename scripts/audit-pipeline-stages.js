// scripts/audit-pipeline-stages.js
import { MongoClient } from 'mongodb';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

// Current getCanonicalStage implementation from PipelineCallsTab.jsx
const PIPELINE_STAGES = {
  NEW_LEAD: "1. New Lead",
  ATTEMPTING: "2. Attempting Contact",
  INFO_GIVEN: "3. Information Given",
  NURTURE_INTERESTED: "4. Nurture / Interested",
  FUTURE_POOL: "5. Future Pool",
  REGISTERED_WON: "6. Registered / Won",
  CLOSED_LOST: "7. Closed / Lost",
  CLOSED_INVALID: "Closed / Invalid",
};

const getCanonicalStageCurrent = (stage) => {
  if (!stage || String(stage).trim() === "" || stage === "null" || stage === "undefined") {
    return "Unknown / Legacy";
  }
  const s = String(stage).trim();
  if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
  if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
  if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
  if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
  if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
  if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won") return PIPELINE_STAGES.REGISTERED_WON;
  if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost") return PIPELINE_STAGES.CLOSED_LOST;
  if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
  if (s === "Query Desk" || s === "Query") return "Query Desk";
  if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";
  return s;
};

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log(`Total Contacts queried: ${contacts.length}`);

  // Frequency table of raw pipelineStage values
  const rawStageFreq = new Map();
  // Frequency table of status values for contacts with missing/unrecognized pipelineStage
  const statusFreqForUnknownStage = new Map();

  // Itemized breakdown of contacts current classification
  const currentCategoryBreakdown = new Map();

  contacts.forEach(c => {
    const rawStage = c.pipelineStage !== undefined ? c.pipelineStage : '(missing field)';
    const key = typeof rawStage === 'string' ? `"${rawStage}"` : String(rawStage);
    rawStageFreq.set(key, (rawStageFreq.get(key) || 0) + 1);

    const currentCanonical = getCanonicalStageCurrent(c.pipelineStage);
    currentCategoryBreakdown.set(currentCanonical, (currentCategoryBreakdown.get(currentCanonical) || 0) + 1);

    if (currentCanonical === 'Unknown / Legacy' || currentCanonical.startsWith('"') || !Object.values(PIPELINE_STAGES).includes(currentCanonical)) {
      const rawStatus = c.status !== undefined ? c.status : '(missing status)';
      const statusKey = typeof rawStatus === 'string' ? `"${rawStatus}"` : String(rawStatus);
      statusFreqForUnknownStage.set(statusKey, (statusFreqForUnknownStage.get(statusKey) || 0) + 1);
    }
  });

  console.log('\n====================================================');
  console.log('1. CURRENT CANONICAL STAGE BREAKDOWN ACROSS 1,384 CONTACTS');
  console.log('====================================================');
  console.table(Array.from(currentCategoryBreakdown.entries()).map(([stage, count]) => ({
    Stage: stage,
    Count: count,
    Percentage: ((count / contacts.length) * 100).toFixed(1) + '%'
  })));

  console.log('\n====================================================');
  console.log('2. RAW pipelineStage FREQUENCY TABLE');
  console.log('====================================================');
  const rawStageTable = Array.from(rawStageFreq.entries()).map(([rawVal, count]) => ({
    'Raw pipelineStage': rawVal,
    Count: count,
    'Current getCanonicalStage() Output': getCanonicalStageCurrent(rawVal.startsWith('"') ? rawVal.slice(1, -1) : rawVal)
  })).sort((a, b) => b.Count - a.Count);
  console.table(rawStageTable);

  console.log('\n====================================================');
  console.log('3. STATUS FREQUENCY FOR UNKNOWN/UNRECOGNIZED STAGE CONTACTS');
  console.log('====================================================');
  const statusTable = Array.from(statusFreqForUnknownStage.entries()).map(([rawStatus, count]) => ({
    'Contact status field': rawStatus,
    Count: count
  })).sort((a, b) => b.Count - a.Count);
  console.table(statusTable);

  await client.close();
}

main().catch(console.error);
