// scripts/test-fixed-pipeline-engine.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, LEGACY_DISPLAY_STAGES, STAGE_RANKS, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

function getFixedEffectiveStage(contact = {}, registrations = []) {
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

  // 1. Check for registration evidence in structured documents
  const cid = String(contact._id || contact.id || "");
  const phoneClean = String(contact.phone || contact.Phone || contact.Mobile || "").replace(/\D/g, "");
  const hasRegDoc = registrations.some(r => String(r.contactId) === cid || (phoneClean && String(r.phone || r.Phone || r.mobile).replace(/\D/g, "") === phoneClean));
  if (hasRegDoc) return PIPELINE_STAGES.REGISTERED_WON;

  const history = Array.isArray(contact.history) ? contact.history : [];
  let highestRank = 0;
  let stage = null;
  let unconnectedAttempts = 0;
  let hasInvalidNumber = false;
  let hasQueryEvidence = false;

  const statusLower = (contact.status || "").toLowerCase().trim();
  const calledForLower = (contact["Called For"] || contact.calledFor || "").toLowerCase().trim();

  if (statusLower.includes("reg.done") || statusLower.includes("already reg") || statusLower.includes("registered")) {
    stage = PIPELINE_STAGES.REGISTERED_WON;
  }

  if (calledForLower.includes("query") || statusLower.includes("query")) {
    hasQueryEvidence = true;
  }

  for (const h of history) {
    const purp = (h.callPurpose || h.purpose || "").toLowerCase().trim();
    const stat = (h.status || h.purposeOutcome || "").trim().toLowerCase();
    const rem = (h.remark || "").toLowerCase().trim();
    const cfor = (h.calledFor || "").toLowerCase().trim();
    const combined = `${stat} ${rem} ${cfor}`;

    if (purp === "query" || stat.includes("query") || rem.includes("query") || cfor.includes("query") || rem.includes("doubt") || rem.includes("fees") || rem.includes("timing") || rem.includes("bus ki") || rem.includes("group me add")) {
      hasQueryEvidence = true;
    }

    // Evaluate sales stage evidence in status & remark
    let hStage = null;
    if (combined.includes("already reg") || combined.includes("reg.done") || combined.includes("registered") || combined.includes("registration done")) {
      hStage = PIPELINE_STAGES.REGISTERED_WON;
    } else if (combined.includes("info given") || combined.includes("information given") || combined.includes("info shared") || combined.includes("details send")) {
      hStage = PIPELINE_STAGES.INFO_GIVEN;
    } else if (combined.includes("interested") && !combined.includes("not interested") || rem.includes("she will register")) {
      hStage = PIPELINE_STAGES.NURTURE_INTERESTED;
    } else if (combined.includes("next time") || combined.includes("next batch")) {
      hStage = PIPELINE_STAGES.FUTURE_POOL;
    } else if (combined.includes("not interested") || combined.includes("not possible")) {
      hStage = PIPELINE_STAGES.CLOSED_LOST;
    }

    if (INVALID_NUMBER_STATUSES.some(inv => combined.includes(inv.toLowerCase())) || combined.includes("invalid") || combined.includes("wrong no")) {
      hasInvalidNumber = true;
    }

    if (UNCONNECTED_CALL_STATUSES.some(unc => combined.includes(unc.toLowerCase())) || combined.includes("call not received") || combined.includes("call not connected") || combined.includes("call log added")) {
      unconnectedAttempts++;
    }

    if (hStage) {
      const hRank = STAGE_RANKS[hStage] || 1;
      if (hRank > highestRank) {
        highestRank = hRank;
        stage = hStage;
      }
    }
  }

  // Check contact.status if history did not produce a connected sales stage
  if (!stage && contact.status) {
    const st = String(contact.status).trim().toLowerCase();
    if (st.includes("reg.done") || st.includes("registered") || st.includes("already reg")) stage = PIPELINE_STAGES.REGISTERED_WON;
    else if (st.includes("interested") && !st.includes("not interested")) stage = PIPELINE_STAGES.NURTURE_INTERESTED;
    else if (st.includes("info given") || st.includes("information given")) stage = PIPELINE_STAGES.INFO_GIVEN;
    else if (st.includes("next time")) stage = PIPELINE_STAGES.FUTURE_POOL;
    else if (st.includes("not interested") || st.includes("not possible")) stage = PIPELINE_STAGES.CLOSED_LOST;
    else if (st.includes("invalid") || st.includes("wrong no")) stage = PIPELINE_STAGES.CLOSED_INVALID;
  }

  // Return connected sales outcome if present
  if (stage) return stage;

  // Closed / Invalid if invalid number or 5+ unanswered attempts
  if (hasInvalidNumber || unconnectedAttempts >= 5 || (contact.attemptCount || 0) >= 5) return PIPELINE_STAGES.CLOSED_INVALID;

  // 1 to 4 unanswered dial attempts -> Attempting Contact
  if (unconnectedAttempts >= 1 || (contact.attemptCount || 0) >= 1) return PIPELINE_STAGES.ATTEMPTING;

  // Query Desk
  if (hasQueryEvidence) return LEGACY_DISPLAY_STAGES.QUERY_DESK;

  // Pure untouched fresh lead -> 1. New Lead
  return PIPELINE_STAGES.NEW_LEAD;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  const counts = {};
  contacts.forEach(c => {
    const st = getFixedEffectiveStage(c, registrations);
    counts[st] = (counts[st] || 0) + 1;
  });

  console.log('====================================================');
  console.log('RECONCILED STAGE DISTRIBUTION ACROSS ALL 1,384 CONTACTS');
  console.log('====================================================\n');
  console.table(counts);

  const totalSum = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Total Contacts Accounted For: ${totalSum} (Expected: 1,384)\n`);

  // Verify the 17 contacts explicitly
  const targetIds = [
    'Kee8MIxFwuVimZb7TCBd',
    'D8rIy7ZylB1LOgQ3jo79',
    'GFuCbeO6mPc2iRfXZ1R5',
    'JxGTla5Xm0lLqWETpVmf',
    'DNCNvcGmWf477FQs5uox',
    'bOSYXqxei501lhRC5Zz9',
    'X5fjjZaqlF0tO1fTQ5Je',
    'jifb4q9AWKkCvUkjrvtl',
    'krvejlm0kxVi60Mh7e8S',
    'dPOu0gBuJbkp6zqk6xPc',
    'c3BFEgD0WgDyP9U7EkBS',
    'Uzl3yngI4kmrazBemNyS',
    'eJNidWMayoxG6eemMbRy',
    'vjjUVGWMsugPC3cVUzSK',
    '4gVHLhRybffEmOGjboRA',
    'yLXhRaBG7Gs7ZDMBSK5U',
    'wNLvj8kO2xlMp8Bec0xQ'
  ];

  console.log('Verification of the 17 Regression Case Contacts:');
  const regResults = [];
  targetIds.forEach(id => {
    const c = contacts.find(ct => String(ct._id || ct.id) === id);
    if (c) {
      const st = getFixedEffectiveStage(c, registrations);
      regResults.push({
        id,
        name: c.name || c.Name,
        derivedStage: st,
        isNewLead: st === PIPELINE_STAGES.NEW_LEAD ? 'FAIL ❌' : 'PASS ✅'
      });
    }
  });
  console.table(regResults);

  await client.close();
}

main().catch(console.error);
