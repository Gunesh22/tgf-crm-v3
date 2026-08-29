// scripts/investigate-discrepancy.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('=== INVESTIGATING DATASET & 2-CONTACT DISCREPANCY ===\n');

  const contacts = await db.collection('contacts').find({}).toArray();
  const mappingJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'high_confidence_pipeline_mapping.json'), 'utf8'));
  const approvedMapping = mappingJson.contacts || [];

  console.log(`Total MongoDB Contacts:                  ${contacts.length}`);
  console.log(`Total Approved High Confidence Mapping: ${approvedMapping.length}`);

  const approvedIdsSet = new Set(approvedMapping.map(m => m.contactId));

  // Identify contacts with pipelineStage set in DB
  const pipelineClassifiedContacts = contacts.filter(c => c.pipelineStage && c.pipelineStage !== '(none)' && c.pipelineStage !== 'Unknown / Legacy');
  console.log(`Total Pipeline Classified Contacts in DB: ${pipelineClassifiedContacts.length}`);

  const extraContacts = [];
  for (const c of pipelineClassifiedContacts) {
    if (!approvedIdsSet.has(c._id.toString())) {
      extraContacts.push(c);
    }
  }

  console.log(`\nExtra Contacts classified in DB NOT present in approved JSON (${extraContacts.length}):`);
  extraContacts.forEach(c => {
    console.log({
      contactId: c._id.toString(),
      name: c.Name || c.name,
      phone: c.Phone || c.phone,
      pipelineStage: c.pipelineStage,
      programRelationships: c.programRelationships,
      leadOwner: c.leadOwner,
      attenderId: c.attenderId,
      assignedTo: c.assignedTo,
      calledFor: c['Called For'] || c.calledFor
    });
  });

  // Also check if any contact in approved mapping has multiple programRelationships or distinct pipeline stage
  console.log('\n--- BREAKDOWN OF PIPELINE STAGES ACROSS 501 CONTACTS ---');
  const stageCounts = {};
  for (const c of pipelineClassifiedContacts) {
    const st = c.pipelineStage;
    stageCounts[st] = (stageCounts[st] || 0) + 1;
  }
  console.table(Object.entries(stageCounts).map(([stage, count]) => ({ stage, count })));
  console.log(`Sum of Pipeline Stages: ${Object.values(stageCounts).reduce((a, b) => a + b, 0)}`);

  // --- QUESTION 1: FULL CALL HISTORY BREAKDOWN ---
  console.log('\n--- CALL HISTORY BASELINE AUDIT ---');
  let totalCallEvents = 0;
  let totalCallsWithCallId = 0;
  let totalCallsLegacyNoCallId = 0;
  let contactsWithHistoryCount = 0;
  const callsByAttender = {};

  for (const c of contacts) {
    const history = c.history || [];
    if (history.length > 0) contactsWithHistoryCount++;
    totalCallEvents += history.length;

    for (const h of history) {
      if (h.callId) totalCallsWithCallId++;
      else totalCallsLegacyNoCallId++;

      const att = h.attenderId || h.assignedTo || c.attenderId || 'Unknown';
      callsByAttender[att] = (callsByAttender[att] || 0) + 1;
    }
  }

  console.log(`Total Contacts with History:          ${contactsWithHistoryCount}`);
  console.log(`Total Historical Call Events:         ${totalCallEvents}`);
  console.log(`Calls with callId:                    ${totalCallsWithCallId}`);
  console.log(`Legacy Calls without callId:          ${totalCallsLegacyNoCallId}`);
  console.log('\nTotal Call Events by Attender ID (Direct DB):');
  console.table(Object.entries(callsByAttender).map(([attenderId, totalCalls]) => ({ attenderId, totalCalls })));

  await client.close();
}

main().catch(console.error);
