// scripts/test-query-desk-derivation.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, LEGACY_DISPLAY_STAGES, STAGE_RANKS, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

function getUpdatedEffectiveStage(contact = {}) {
  const current = contact.pipelineStage || "";

  if (current && String(current).trim() !== "" && current !== "null" && current !== "undefined") {
    const s = String(current).trim();
    if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
  }

  // Fallback derivation for legacy contacts lacking explicit pipelineStage
  let highestRank = 0;
  let stage = null;
  let unconnectedAttempts = 0;
  let hasInvalidNumber = false;

  const history = Array.isArray(contact.history) ? contact.history : [];
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

  // Check contact.status if history did not produce a connected sales stage
  if (!stage && contact.status) {
    const st = String(contact.status).trim().toLowerCase();
    if (st.includes("reg.done") || st.includes("registered")) stage = PIPELINE_STAGES.REGISTERED_WON;
    else if (st.includes("interested") && !st.includes("not interested")) stage = PIPELINE_STAGES.NURTURE_INTERESTED;
    else if (st.includes("info given") || st.includes("information given")) stage = PIPELINE_STAGES.INFO_GIVEN;
    else if (st.includes("next time")) stage = PIPELINE_STAGES.FUTURE_POOL;
    else if (st.includes("not interested") || st.includes("not possible")) stage = PIPELINE_STAGES.CLOSED_LOST;
    else if (st.includes("invalid") || st.includes("wrong no")) stage = PIPELINE_STAGES.CLOSED_INVALID;
  }

  // If connected sales outcome was found, return it
  if (stage) return stage;

  // If invalid number or 5+ unanswered attempts -> Closed / Invalid
  if (hasInvalidNumber || unconnectedAttempts >= 5 || (contact.attemptCount || 0) >= 5) return PIPELINE_STAGES.CLOSED_INVALID;

  // If 1 to 4 unanswered dial attempts -> Attempting Contact
  if (unconnectedAttempts >= 1 || (contact.attemptCount || 0) >= 1) return PIPELINE_STAGES.ATTEMPTING;

  // Check for Query evidence before defaulting to 1. New Lead
  let hasQueryEvidence = false;
  const statusLower = (contact.status || "").toLowerCase().trim();
  const calledForLower = (contact["Called For"] || contact.calledFor || "").toLowerCase().trim();
  if (calledForLower.includes("query") || statusLower.includes("query")) {
    hasQueryEvidence = true;
  }
  for (const h of history) {
    const hPurp = (h.callPurpose || h.purpose || "").toLowerCase().trim();
    const hStat = (h.status || h.purposeOutcome || "").trim().toLowerCase();
    const hRem = (h.remark || "").toLowerCase().trim();
    const hCalledFor = (h.calledFor || "").toLowerCase().trim();
    if (hPurp === "query" || hStat.includes("query") || hRem.includes("query") || hCalledFor.includes("query") || hRem.includes("doubt") || hRem.includes("fees") || hRem.includes("timing")) {
      hasQueryEvidence = true;
      break;
    }
  }

  if (hasQueryEvidence) return LEGACY_DISPLAY_STAGES.QUERY_DESK;

  // Otherwise fresh uncontacted lead -> 1. New Lead
  return PIPELINE_STAGES.NEW_LEAD;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const counts = {};
  contacts.forEach(c => {
    const st = getUpdatedEffectiveStage(c);
    counts[st] = (counts[st] || 0) + 1;
  });

  console.log('====================================================');
  console.log('UPDATED PIPELINE STAGE DISTRIBUTION (QUERY DESK SEPARATED)');
  console.log('====================================================\n');
  console.table(counts);

  await client.close();
}

main().catch(console.error);
