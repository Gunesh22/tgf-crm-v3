// scripts/generate-50-query-list.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, getEffectiveStage } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const newLeads = contacts.filter(c => getEffectiveStage(c) === PIPELINE_STAGES.NEW_LEAD);

  const queryContacts = [];

  newLeads.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();
    const calledForLower = (c['Called For'] || c.calledFor || '').toLowerCase().trim();

    let hasQuery = calledForLower.includes('query') || statusLower.includes('query');

    hist.forEach(h => {
      const hPurp = (h.callPurpose || h.purpose || '').toLowerCase().trim();
      const hStat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      const hRem = (h.remark || '').toLowerCase().trim();
      const hCalledFor = (h.calledFor || '').toLowerCase().trim();

      if (hPurp === 'query' || hStat.includes('query') || hRem.includes('query') || hCalledFor.includes('query') || hRem.includes('doubt') || hRem.includes('fees') || hRem.includes('timing')) {
        hasQuery = true;
      }
    });

    if (hasQuery) {
      const firstHist = hist[0] || {};
      queryContacts.push({
        id: String(c._id || c.id),
        name: c.name || c.Name || 'Unnamed',
        phone: c.phone || c.Phone || 'N/A',
        attender: c.attenderName || c.assignedName || firstHist.attenderName || 'Unassigned',
        calledFor: c['Called For'] || c.calledFor || firstHist.calledFor || 'N/A',
        remark: firstHist.remark || c.remark || '(no remark)'
      });
    }
  });

  console.log(`Total Query-Only Contacts found under New Lead: ${queryContacts.length}\n`);
  console.log(JSON.stringify(queryContacts, null, 2));

  await client.close();
}

main().catch(console.error);
