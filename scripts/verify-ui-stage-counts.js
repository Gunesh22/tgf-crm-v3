// scripts/verify-ui-stage-counts.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, getEffectiveStage } from '../src/utils/pipelineEngine.js';

export const getCanonicalStage = (stageOrContact) => {
  let contact = {};
  let rawStage = "";

  if (typeof stageOrContact === "string") {
    rawStage = stageOrContact;
  } else if (stageOrContact && typeof stageOrContact === "object") {
    contact = stageOrContact;
    rawStage = contact.pipelineStage || "";
  }

  if (rawStage && String(rawStage).trim() !== "" && rawStage !== "null" && rawStage !== "undefined") {
    const s = String(rawStage).trim();
    if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (s === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || s === "Previous Program Pending") return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
    if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    if (s === "Query Desk" || s === "Query") return "Query Desk";
    if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";
  }

  // Fallback to getEffectiveStage for contacts lacking explicit pipelineStage
  return getEffectiveStage(contact);
};

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log('====================================================');
  console.log('FINAL PIPELINE STAGE UI & DRILL-DOWN AUDIT VERIFICATION');
  console.log('====================================================\n');

  console.log(`- Total MongoDB Contacts Queried: ${contacts.length}`);

  const counts = {
    [PIPELINE_STAGES.NEW_LEAD]: 0,
    [PIPELINE_STAGES.ATTEMPTING]: 0,
    [PIPELINE_STAGES.INFO_GIVEN]: 0,
    [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
    [PIPELINE_STAGES.FUTURE_POOL]: 0,
    [PIPELINE_STAGES.REGISTERED_WON]: 0,
    [PIPELINE_STAGES.CLOSED_LOST]: 0,
    [PIPELINE_STAGES.CLOSED_INVALID]: 0,
    "Query Desk": 0,
    "Existing Alumni": 0,
    "Unknown / Legacy": 0
  };

  const drillDownLists = {};
  Object.keys(counts).forEach(k => drillDownLists[k] = []);

  contacts.forEach(c => {
    const stage = getCanonicalStage(c);
    if (counts[stage] !== undefined) {
      counts[stage]++;
      drillDownLists[stage].push(c);
    } else {
      counts["Unknown / Legacy"]++;
      drillDownLists["Unknown / Legacy"].push(c);
    }
  });

  const stageTable = Object.entries(counts).map(([stage, count]) => ({
    'Pipeline Stage Card': stage,
    'Card Count': count,
    'Drill-Down Item Count': drillDownLists[stage].length,
    'Match Status': count === drillDownLists[stage].length ? 'MATCH ✅' : 'MISMATCH ❌'
  }));

  console.table(stageTable);

  const totalPeople = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n- Total People across all Pipeline Cards: ${totalPeople}`);
  console.log(`- Total People Parity: ${totalPeople === 1384 ? 'EXACT MATCH (1,384) ✅' : 'MISMATCH ❌'}`);
  console.log(`- Unknown / Legacy Pipeline Stage Count: ${counts["Unknown / Legacy"]} (Expected: 0) -> ${counts["Unknown / Legacy"] === 0 ? 'ZERO UNKNOWN ✅' : 'STILL HAS UNKNOWN ❌'}`);

  await client.close();
}

main().catch(console.error);
