// scripts/persist-883-pipeline-stages.js
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contactsCollection = db.collection('contacts');

  const mappingPath = path.join(process.cwd(), 'legacy-pipeline-stage-mapping.json');
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

  console.log('====================================================');
  console.log('PHASE 4: PERSISTING 883 PIPELINE STAGES TO MONGODB ATLAS');
  console.log('====================================================\n');

  // Pre-write check: snapshot explicit stage contacts
  const preExplicitContacts = await contactsCollection.find({
    pipelineStage: { $exists: true, $ne: null, $nin: ["", "null", "undefined"] }
  }).toArray();
  const preExplicitCount = preExplicitContacts.length;

  console.log(`- Pre-write snapshot: ${preExplicitCount} contacts have explicit pipelineStage in MongoDB.`);

  const bulkOps = [];

  mapping.forEach(item => {
    let queryId = item.contactId;
    let _idFilter;
    try {
      _idFilter = { _id: new ObjectId(queryId) };
    } catch (e) {
      _idFilter = { _id: queryId };
    }

    // Strict filter enforcing pipelineStage must be missing, null, or empty string
    const strictFilter = {
      $and: [
        _idFilter,
        {
          $or: [
            { pipelineStage: { $exists: false } },
            { pipelineStage: null },
            { pipelineStage: "" },
            { pipelineStage: "null" },
            { pipelineStage: "undefined" }
          ]
        }
      ]
    };

    bulkOps.push({
      updateOne: {
        filter: strictFilter,
        update: {
          $set: {
            pipelineStage: item.correctPipelineStage,
            updatedAt: new Date().toISOString()
          }
        }
      }
    });
  });

  console.log(`Executing bulkWrite of ${bulkOps.length} updates...`);
  const bulkResult = await contactsCollection.bulkWrite(bulkOps);
  console.log(`BulkWrite Result: Matched ${bulkResult.matchedCount}, Modified ${bulkResult.modifiedCount} records.\n`);

  console.log('====================================================');
  console.log('PHASE 5: POST-WRITE MONGODB VERIFICATION');
  console.log('====================================================\n');

  const postContacts = await contactsCollection.find({}).toArray();
  const postMissing = postContacts.filter(c => !c.pipelineStage || String(c.pipelineStage).trim() === "" || c.pipelineStage === "null" || c.pipelineStage === "undefined");
  const postExplicit = postContacts.filter(c => c.pipelineStage && String(c.pipelineStage).trim() !== "" && c.pipelineStage !== "null" && c.pipelineStage !== "undefined");

  console.log(`1. Total Contacts in MongoDB: ${postContacts.length} (Expected: 1,384) -> ${postContacts.length === 1384 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`2. Contacts with Missing/Null pipelineStage: ${postMissing.length} (Expected: 0) -> ${postMissing.length === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`3. Total Contacts with Explicit pipelineStage: ${postExplicit.length} (Expected: 1,384) -> ${postExplicit.length === 1384 ? 'PASS ✅' : 'FAIL ❌'}`);

  // Verify that the original 501 explicit contacts were preserved without any modification
  let preservedCount = 0;
  preExplicitContacts.forEach(preC => {
    const postC = postContacts.find(c => String(c._id || c.id) === String(preC._id || preC.id));
    if (postC && postC.pipelineStage === preC.pipelineStage) {
      preservedCount++;
    }
  });

  console.log(`4. Original 501 Explicit Stages Preserved Intact: ${preservedCount} / ${preExplicitCount} -> ${preservedCount === preExplicitCount ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // Print final MongoDB Stage Distribution
  const finalStageCounts = {};
  postContacts.forEach(c => {
    const st = c.pipelineStage;
    finalStageCounts[st] = (finalStageCounts[st] || 0) + 1;
  });

  console.log('FINAL MONGODB ATLAS PIPELINE STAGE DISTRIBUTION:');
  console.table(finalStageCounts);

  await client.close();
}

main().catch(console.error);
