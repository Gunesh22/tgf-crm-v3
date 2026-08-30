// scripts/validate-mapping-and-preview-total.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const allContacts = await db.collection('contacts').find({}).toArray();

  const mappingPath = path.join(process.cwd(), 'legacy-pipeline-stage-mapping.json');
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

  console.log('====================================================');
  console.log('PHASE 3: VALIDATE MAPPING BEFORE MONGODB WRITE');
  console.log('====================================================\n');

  console.log(`1. Mapping File Record Count: ${mapping.length} (Expected: 883) -> ${mapping.length === 883 ? 'PASS ✅' : 'FAIL ❌'}`);

  const explicitContacts = allContacts.filter(c => c.pipelineStage && String(c.pipelineStage).trim() !== "" && c.pipelineStage !== "null" && c.pipelineStage !== "undefined");
  const explicitIds = new Set(explicitContacts.map(c => String(c._id || c.id)));

  console.log(`2. Total Explicit Stage Contacts in DB: ${explicitContacts.length} (Expected: 501) -> ${explicitContacts.length === 501 ? 'PASS ✅' : 'FAIL ❌'}`);

  let overlapWithExplicit = 0;
  mapping.forEach(m => {
    if (explicitIds.has(m.contactId)) overlapWithExplicit++;
  });

  console.log(`3. Overlap with Existing Explicit Stage Contacts: ${overlapWithExplicit} (Expected: 0) -> ${overlapWithExplicit === 0 ? 'PASS ✅' : 'FAIL ❌'}`);

  const legacyIdsInDb = new Set(allContacts.filter(c => !c.pipelineStage || String(c.pipelineStage).trim() === "" || c.pipelineStage === "null" || c.pipelineStage === "undefined").map(c => String(c._id || c.id)));

  let missingInDb = 0;
  mapping.forEach(m => {
    if (!legacyIdsInDb.has(m.contactId)) missingInDb++;
  });

  console.log(`4. Mapping Contact IDs Match DB Legacy IDs: ${missingInDb === 0 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Calculate final proposed MongoDB distribution across all 1,384 contacts
  const finalDistribution = {};

  // Add the 501 explicit contacts
  explicitContacts.forEach(c => {
    const st = c.pipelineStage;
    finalDistribution[st] = (finalDistribution[st] || 0) + 1;
  });

  // Add the 883 legacy mapped contacts
  mapping.forEach(m => {
    const st = m.correctPipelineStage;
    finalDistribution[st] = (finalDistribution[st] || 0) + 1;
  });

  console.log('\n====================================================');
  console.log('PROJECTED TOTAL MONGODB STAGE DISTRIBUTION (1,384 CONTACTS)');
  console.log('====================================================\n');
  console.table(finalDistribution);

  const grandTotal = Object.values(finalDistribution).reduce((a, b) => a + b, 0);
  console.log(`GRAND TOTAL CONTACTS: ${grandTotal} (Expected: 1,384) -> ${grandTotal === 1384 ? 'PASS ✅' : 'FAIL ❌'}\n`);

  await client.close();
}

main().catch(console.error);
