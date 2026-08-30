// scripts/inspect-all-93-histories.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, getEffectiveStage, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const currentNewLeads = contacts.filter(c => getEffectiveStage(c) === PIPELINE_STAGES.NEW_LEAD);

  console.log('====================================================');
  console.log(`FORENSIC INSPECTION OF ALL ${currentNewLeads.length} CURRENT NEW LEADS`);
  console.log('====================================================\n');

  const detailedAudit = [];

  currentNewLeads.forEach((c, idx) => {
    const cid = String(c._id || c.id);
    const hist = Array.isArray(c.history) ? c.history : [];
    const name = c.name || c.Name || '(blank)';
    const attender = c.attenderName || c.assignedName || 'Unassigned';

    const historyItems = hist.map((h, i) => {
      return `[Call ${i+1}] purpose=${h.callPurpose || 'blank'}, status="${h.status || h.purposeOutcome || 'blank'}", calledFor="${h.calledFor || ''}", remark="${h.remark || ''}"`;
    });

    detailedAudit.push({
      index: idx + 1,
      contactId: cid,
      name,
      phone: c.phone || c.Phone || c.Mobile || '(blank)',
      attender,
      rawPipelineStage: c.pipelineStage || '(none)',
      currentStatus: c.status || '(blank)',
      historyCount: hist.length,
      historyDetails: historyItems.join('\n      ') || '(no history entries)'
    });
  });

  const withHistory = detailedAudit.filter(d => d.historyCount > 0);
  const zeroHistory = detailedAudit.filter(d => d.historyCount === 0);

  console.log(`Summary of the 93 Current New Leads:`);
  console.log(`- ZERO History Calls (Pure untouched leads): ${zeroHistory.length}`);
  console.log(`- HAS History Calls (1 or more call entries): ${withHistory.length}\n`);

  console.log('====================================================');
  console.log(`DETAILED INSPECTION OF THE ${withHistory.length} CONTACTS WITH HISTORY CALLED UNDER NEW LEAD:`);
  console.log('====================================================\n');

  withHistory.forEach(d => {
    console.log(`[#${d.index}] ID: ${d.contactId} | Name: ${d.name} | Phone: ${d.phone}`);
    console.log(`    Attender: ${d.attender} | Status: "${d.currentStatus}" | History Count: ${d.historyCount}`);
    console.log(`    History details:\n      ${d.historyDetails}`);
    console.log('---');
  });

  await client.close();
}

main().catch(console.error);
