// scripts/audit-8-contact-discrepancy.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, getEffectiveStage, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  console.log('====================================================');
  console.log('FORENSIC AUDIT: 8-CONTACT NEW LEAD DISCREPANCY');
  console.log('====================================================\n');

  console.log(`Total Contacts in DB: ${contacts.length}`);

  const discrepancyContacts = [];

  contacts.forEach(c => {
    // 1. Previous legacy derivation logic (from semantic audit):
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();

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

    let prevStage = PIPELINE_STAGES.NEW_LEAD;
    if (hasReg) prevStage = PIPELINE_STAGES.REGISTERED_WON;
    else if (hasNurture) prevStage = PIPELINE_STAGES.NURTURE_INTERESTED;
    else if (hasInfo) prevStage = PIPELINE_STAGES.INFO_GIVEN;
    else if (hasNextTime) prevStage = PIPELINE_STAGES.FUTURE_POOL;
    else if (hasClosedLost) prevStage = PIPELINE_STAGES.CLOSED_LOST;
    else if (hasInvalid || unconnectedAttempts >= 5) prevStage = PIPELINE_STAGES.CLOSED_INVALID;
    else if (unconnectedAttempts >= 1) prevStage = PIPELINE_STAGES.ATTEMPTING;

    // 2. Current implementation getEffectiveStage(contact):
    const currentStage = getEffectiveStage(c);

    // Track contacts where previous expected stage was New Lead, but current is different
    if (prevStage === PIPELINE_STAGES.NEW_LEAD && currentStage !== PIPELINE_STAGES.NEW_LEAD) {
      discrepancyContacts.push({
        contactId: c._id ? String(c._id) : c.id,
        name: c.name || 'Unnamed',
        explicitPipelineStage: c.pipelineStage || '(none)',
        contactStatus: c.status || '(blank)',
        currentStage,
        prevStage,
        dialAttempts: unconnectedAttempts,
        historyCount: hist.length,
        historyOutcomes: hist.map(h => `${h.callPurpose || 'SALES'}:${h.status || h.purposeOutcome || 'blank'}`).join(', ') || '(no history)'
      });
    }
  });

  console.log(`Found ${discrepancyContacts.length} contacts where Previous Audit derived 'New Lead' but Current Engine derived a different stage:\n`);

  discrepancyContacts.forEach((dc, idx) => {
    console.log(`[${idx + 1}] ID: ${dc.contactId} | Name: ${dc.name}`);
    console.log(`    Explicit MongoDB pipelineStage: "${dc.explicitPipelineStage}"`);
    console.log(`    Contact Status: "${dc.contactStatus}"`);
    console.log(`    Previous Derived Stage: "${dc.prevStage}" → Current Stage: "${dc.currentStage}"`);
    console.log(`    Dial Attempts: ${dc.dialAttempts} | Total History Entries: ${dc.historyCount}`);
    console.log(`    History Outcomes: ${dc.historyOutcomes}`);
    console.log('---');
  });

  await client.close();
}

main().catch(console.error);
