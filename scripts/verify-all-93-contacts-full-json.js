// scripts/verify-all-93-contacts-full-json.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, getEffectiveStage } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const newLeads = contacts.filter(c => getEffectiveStage(c) === PIPELINE_STAGES.NEW_LEAD);

  console.log(`Analyzing all ${newLeads.length} contacts currently classified as '1. New Lead':\n`);

  let withHistory = 0;
  let withAttender = 0;
  let withStatus = 0;

  const tableData = [];

  newLeads.forEach((c, idx) => {
    const hist = Array.isArray(c.history) ? c.history : [];
    if (hist.length > 0) withHistory++;
    if (c.attenderId || c.attenderName || c.assignedName) withAttender++;
    if (c.status) withStatus++;

    tableData.push({
      '#': idx + 1,
      'Contact ID': String(c._id || c.id),
      'Name': c.name || c.Name || '(blank)',
      'Phone': c.phone || c.Phone || c.Mobile || '(blank)',
      'Attender': c.attenderName || c.assignedName || 'Unassigned',
      'History Count': hist.length,
      'Status': c.status || '(blank)',
      'Called For': c['Called For'] || c.calledFor || '(blank)',
      'Source/Tag': (c.tags || []).join(', ') || c.Source || '(none)'
    });
  });

  console.log(`Summary Statistics for the 93 New Leads:`);
  console.log(`- Total New Leads: ${newLeads.length}`);
  console.log(`- Contacts with History Entries (history.length > 0): ${withHistory}`);
  console.log(`- Contacts assigned to an Attender: ${withAttender}`);
  console.log(`- Contacts with non-blank Status field: ${withStatus}\n`);

  console.log('Full Table of all 93 New Lead Contacts:');
  console.table(tableData);

  await client.close();
}

main().catch(console.error);
