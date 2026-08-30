// scripts/forensic-provenance-audit.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contactsCollection = db.collection('contacts');
  const callEventsCollection = db.collection('call_events');

  const dbContacts = await contactsCollection.find({}).toArray();
  let dbCallEvents = [];
  try {
    dbCallEvents = await callEventsCollection.find({}).toArray();
  } catch (e) {
    dbCallEvents = [];
  }

  // Read high_confidence_pipeline_mapping.json
  const mappingPath = path.join(process.cwd(), 'high_confidence_pipeline_mapping.json');
  const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

  console.log('====================================================');
  console.log('STRUCTURAL FORENSIC AUDIT — PROVENANCE & IDENTIFIERS');
  console.log('====================================================\n');

  console.log(`1. Mapping File Version: ${mappingData.mappingVersion}`);
  console.log(`2. Mapping File Source: ${mappingData.source}`);
  console.log(`3. Total Records in high_confidence_pipeline_mapping.json: ${mappingData.contacts.length}`);
  console.log(`4. Total Documents in MongoDB 'contacts' Collection: ${dbContacts.length}`);
  console.log(`5. Total Documents in MongoDB 'call_events' Collection: ${dbCallEvents.length}\n`);

  // Analyze Contact IDs in mapping file
  const jsonContactIdCounts = new Map();
  const jsonBaseIdCounts = new Map();

  mappingData.contacts.forEach((item, index) => {
    const rawId = item.contactId;
    // Check if ID contains underscore (composite ID e.g. "TynjXxF0yMv1NMvqmrNj_WbND9Oa4yPUuWXVyibb3")
    const baseId = rawId.includes('_') ? rawId.split('_')[0] : rawId;

    if (!jsonContactIdCounts.has(rawId)) jsonContactIdCounts.set(rawId, []);
    jsonContactIdCounts.get(rawId).push({ index, item });

    if (!jsonBaseIdCounts.has(baseId)) jsonBaseIdCounts.set(baseId, []);
    jsonBaseIdCounts.get(baseId).push({ index, item });
  });

  console.log('--- EXPORT ID BREAKDOWN ---');
  console.log(`Total JSON Array Records: ${mappingData.contacts.length}`);
  console.log(`Unique Raw 'contactId' Strings in JSON: ${jsonContactIdCounts.size}`);
  console.log(`Unique Base Contact IDs (without composite suffix): ${jsonBaseIdCounts.size}`);

  const repeatedRawIds = [...jsonContactIdCounts.entries()].filter(([k, v]) => v.length > 1);
  const repeatedBaseIds = [...jsonBaseIdCounts.entries()].filter(([k, v]) => v.length > 1);

  console.log(`Raw contactId strings appearing >1 times: ${repeatedRawIds.length}`);
  console.log(`Base Contact IDs appearing >1 times across composite entries: ${repeatedBaseIds.length}\n`);

  // Inspect composite keys vs base keys in MongoDB
  const dbContactIdMap = new Map();
  dbContacts.forEach(c => {
    const idStr = String(c._id);
    dbContactIdMap.set(idStr, c);
  });

  console.log('--- REPEATED ID FORENSIC DETAILS ---');
  repeatedBaseIds.forEach(([baseId, appearances]) => {
    const mongoDoc = dbContactIdMap.get(baseId);
    console.log(`\nBase Contact ID: '${baseId}'`);
    console.log(`  Number of appearances in JSON: ${appearances.length}`);
    console.log(`  Exists as exact _id in MongoDB: ${mongoDoc ? 'YES ✅' : 'NO ❌'}`);
    if (mongoDoc) {
      const hist = Array.isArray(mongoDoc.history) ? mongoDoc.history : [];
      console.log(`  MongoDB Contact Name: '${mongoDoc.name || mongoDoc.Name}'`);
      console.log(`  MongoDB Primary Attender: '${mongoDoc.attenderName || mongoDoc.assignedName || 'Unassigned'}'`);
      console.log(`  MongoDB Shared Attenders: ${JSON.stringify(mongoDoc.sharedWithAttenderIds || [])}`);
      console.log(`  MongoDB Total History Call Entries: ${hist.length}`);
    }
    console.log(`  Appearances Details in JSON:`);
    appearances.forEach((app, i) => {
      console.log(`    [App ${i+1}] raw contactId: '${app.item.contactId}' | Lead Owner: '${app.item.leadOwner}' | Programs: ${app.item.programRelationships ? app.item.programRelationships.map(p => p.program + ':' + p.stage).join(', ') : 'none'}`);
    });
  });

  // Total call count verification across MongoDB history arrays
  let totalHistoryCallsInDb = 0;
  dbContacts.forEach(c => {
    if (Array.isArray(c.history)) {
      totalHistoryCallsInDb += c.history.length;
    }
  });

  console.log('\n--- CALL COUNTS & HISTORY VERIFICATION ---');
  console.log(`Total History Call Events across all MongoDB contacts: ${totalHistoryCallsInDb}`);
  console.log(`Total Documents in call_events collection: ${dbCallEvents.length}`);

  await client.close();
}

main().catch(console.error);
