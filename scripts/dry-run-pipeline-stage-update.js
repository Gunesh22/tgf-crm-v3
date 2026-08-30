// scripts/dry-run-pipeline-stage-update.js
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contactsCollection = db.collection('contacts');

  const jsonPath = path.join(process.cwd(), 'tgf_pipeline_stage_mapping_all_contacts.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}`);
    process.exit(1);
  }

  const mappingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log('====================================================');
  console.log('DRY-RUN REPORT: PIPELINE STAGE BULK UPDATE');
  console.log('====================================================\n');

  // 1. Total JSON Records & Duplicate Check
  const totalJsonRecords = mappingData.length;
  const idCounts = new Map();
  mappingData.forEach(item => {
    const id = item.contactId;
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });

  const duplicateEntries = [...idCounts.entries()].filter(([_, count]) => count > 1);

  console.log(`1. Total JSON Records: ${totalJsonRecords}`);
  console.log(`2. Unique contactId Count in JSON: ${idCounts.size}`);
  console.log(`3. Duplicate contactId Entries in JSON: ${duplicateEntries.length} ${duplicateEntries.length === 0 ? '✅ (NONE)' : '⚠️'}`);
  if (duplicateEntries.length > 0) {
    console.log('   Duplicates:', duplicateEntries);
  }
  console.log('');

  // 2. Fetch all MongoDB Contacts
  const allDbContacts = await contactsCollection.find({}).toArray();
  const dbContactMap = new Map();
  allDbContacts.forEach(c => {
    dbContactMap.set(String(c._id || c.id), c);
  });

  console.log(`- Total Contacts currently in MongoDB: ${allDbContacts.length}\n`);

  // 3. Match Analysis
  let contactsFound = 0;
  let contactsNotFound = 0;
  const notFoundList = [];

  const transitions = new Map(); // e.g. "3. Information Given -> 4. Nurture / Interested": count
  const finalProjectedStages = new Map();
  let unchangedCount = 0;

  // Track matched DB IDs to check if any DB contacts are not present in JSON
  const matchedDbIds = new Set();

  mappingData.forEach(item => {
    const cid = String(item.contactId);
    const newStage = item.pipelineStage;

    const dbDoc = dbContactMap.get(cid);
    if (dbDoc) {
      contactsFound++;
      matchedDbIds.add(String(dbDoc._id || dbDoc.id));
      const currentStage = dbDoc.pipelineStage || '(blank/null)';
      const transitionKey = `${currentStage} ➔ ${newStage}`;

      transitions.set(transitionKey, (transitions.get(transitionKey) || 0) + 1);
      finalProjectedStages.set(newStage, (finalProjectedStages.get(newStage) || 0) + 1);

      if (currentStage === newStage) {
        unchangedCount++;
      }
    } else {
      contactsNotFound++;
      notFoundList.push(cid);
    }
  });

  // Account for any DB contacts not covered in JSON
  allDbContacts.forEach(c => {
    const cid = String(c._id || c.id);
    if (!matchedDbIds.has(cid)) {
      const st = c.pipelineStage || '(blank/null)';
      finalProjectedStages.set(st, (finalProjectedStages.get(st) || 0) + 1);
    }
  });

  console.log('----------------------------------------------------');
  console.log('MATCHING RESULTS');
  console.log('----------------------------------------------------');
  console.log(`- Contacts Found in MongoDB: ${contactsFound} / ${totalJsonRecords} ✅`);
  console.log(`- Contacts Not Found in MongoDB: ${contactsNotFound} ${contactsNotFound === 0 ? '✅ (NONE)' : '⚠️'}`);
  if (notFoundList.length > 0) {
    console.log('  Not Found IDs:', notFoundList);
  }
  console.log(`- Stages Already Matching (No-Op): ${unchangedCount}`);
  console.log(`- Stages Changing: ${contactsFound - unchangedCount}\n`);

  console.log('----------------------------------------------------');
  console.log('STAGE TRANSITION BREAKDOWN (CURRENT ➔ NEW)');
  console.log('----------------------------------------------------');
  const transitionTable = [];
  [...transitions.entries()].sort((a, b) => b[1] - a[1]).forEach(([trans, count]) => {
    transitionTable.push({ 'Current Stage ➔ Proposed New Stage': trans, 'Contacts Count': count });
  });
  console.table(transitionTable);

  console.log('\n----------------------------------------------------');
  console.log('PROJECTED FINAL MONGODB PIPELINE DISTRIBUTION (1,384 CONTACTS)');
  console.log('----------------------------------------------------');
  const finalTable = [];
  [...finalProjectedStages.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([stage, count]) => {
    finalTable.push({ 'Pipeline Stage': stage, 'Final Contacts': count });
  });
  console.table(finalTable);

  const grandTotal = Object.values(Object.fromEntries(finalProjectedStages)).reduce((a, b) => a + b, 0);
  console.log(`\nGrand Total MongoDB Contacts: ${grandTotal} (Expected: 1,384) -> ${grandTotal === 1384 ? 'PASS ✅' : 'FAIL ❌'}`);

  console.log('\n====================================================');
  console.log('DRY-RUN COMPLETE: NO WRITING PERFORMED.');
  console.log('Awaiting user approval before proceeding to bulk update.');
  console.log('====================================================');

  await client.close();
}

main().catch(console.error);
