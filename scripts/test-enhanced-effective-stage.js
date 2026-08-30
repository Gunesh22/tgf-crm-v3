// scripts/test-enhanced-effective-stage.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, STAGE_RANKS, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

function getEnhancedEffectiveStage(contact = {}) {
  let current = contact.pipelineStage || "";
  let highestRank = 0;
  let stage = null;

  if (current && String(current).trim() !== "" && current !== "null" && current !== "undefined") {
    current = String(current).trim();
    if (current === PIPELINE_STAGES.NEW_LEAD || current === "New Lead" || current === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (current === PIPELINE_STAGES.ATTEMPTING || current === "Attempting Contact" || current === "Attempting" || current === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (current === PIPELINE_STAGES.INFO_GIVEN || current === "Information Given" || current === "Info Given" || current === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (current === PIPELINE_STAGES.NURTURE_INTERESTED || current === "Nurture / Interested" || current === "Interested" || current === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (current === PIPELINE_STAGES.FUTURE_POOL || current === "Future Pool" || current === "Next Time" || current === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (current === PIPELINE_STAGES.REGISTERED_WON || current === "Registered / Won" || current === "Reg.Done" || current === "6. Registered / Won" || current === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (current === PIPELINE_STAGES.CLOSED_LOST || current === "Closed / Lost" || current === "Closed Lost" || current === "7. Closed / Lost" || current === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (current === PIPELINE_STAGES.CLOSED_INVALID || current === "Closed / Invalid" || current === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
  }

  // 1. Scan history for explicit connected sales outcomes
  const history = Array.isArray(contact.history) ? contact.history : [];
  let unconnectedAttempts = 0;
  let hasInvalidNumber = false;

  for (const h of history) {
    const callPurpose = (h.callPurpose || "").toUpperCase();
    if (callPurpose && callPurpose !== "SALES") continue;

    const outcome = (h.status || h.purposeOutcome || "").trim().toLowerCase();
    let hStage = null;

    if (outcome === "info given" || outcome === "info")             hStage = PIPELINE_STAGES.INFO_GIVEN;
    else if (outcome === "interested")                               hStage = PIPELINE_STAGES.NURTURE_INTERESTED;
    else if (outcome === "next time")                                hStage = PIPELINE_STAGES.FUTURE_POOL;
    else if (outcome === "reg.done" || outcome === "registered")     hStage = PIPELINE_STAGES.REGISTERED_WON;
    else if (["not interested", "not possible"].includes(outcome))   hStage = PIPELINE_STAGES.CLOSED_LOST;

    if (INVALID_NUMBER_STATUSES.some(inv => inv.toLowerCase() === outcome)) {
      hasInvalidNumber = true;
    }
    if (UNCONNECTED_CALL_STATUSES.some(unc => unc.toLowerCase() === outcome)) {
      unconnectedAttempts++;
    }

    if (hStage) {
      const hRank = STAGE_RANKS[hStage] || 1;
      if (hRank > highestRank) { highestRank = hRank; stage = hStage; }
    }
  }

  // 2. Check contact.status if history did not produce a stage
  if (!stage && contact.status) {
    const st = String(contact.status).trim().toLowerCase();
    if (st.includes("reg.done") || st.includes("registered")) stage = PIPELINE_STAGES.REGISTERED_WON;
    else if (st.includes("interested") && !st.includes("not interested")) stage = PIPELINE_STAGES.NURTURE_INTERESTED;
    else if (st.includes("info given") || st.includes("information given")) stage = PIPELINE_STAGES.INFO_GIVEN;
    else if (st.includes("next time")) stage = PIPELINE_STAGES.FUTURE_POOL;
    else if (st.includes("not interested") || st.includes("not possible")) stage = PIPELINE_STAGES.CLOSED_LOST;
    else if (st.includes("invalid") || st.includes("wrong no")) stage = PIPELINE_STAGES.CLOSED_INVALID;
  }

  // 3. If connected sales outcome is present, return it
  if (stage) return stage;

  // 4. If lead has invalid number or 5+ unanswered attempts -> Closed / Invalid
  if (hasInvalidNumber || unconnectedAttempts >= 5) return PIPELINE_STAGES.CLOSED_INVALID;

  // 5. If lead has 1 to 4 unanswered dial attempts -> Attempting Contact
  if (unconnectedAttempts >= 1) return PIPELINE_STAGES.ATTEMPTING;

  // 6. Otherwise fresh uncontacted lead -> 1. New Lead
  return PIPELINE_STAGES.NEW_LEAD;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const stageCounts = new Map();
  contacts.forEach(c => {
    const st = getEnhancedEffectiveStage(c);
    stageCounts.set(st, (stageCounts.get(st) || 0) + 1);
  });

  console.log('====================================================');
  console.log('ALL 1,384 CONTACTS WITH FULL SEMANTIC ATTEMPT STAGE DERIVATION');
  console.log('====================================================');

  let total = 0;
  for (const [st, cnt] of stageCounts.entries()) {
    console.log(`- ${st}: ${cnt}`);
    total += cnt;
  }
  console.log(`\nTotal Accounted For: ${total} / 1,384`);

  await client.close();
}

main().catch(console.error);
