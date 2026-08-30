// scripts/bulk-update-confirmed-stages.js
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contactsCollection = db.collection('contacts');

  const auditPath = path.join(process.cwd(), 'audit_209_proposed_changes_classified.json');
  if (!fs.existsSync(auditPath)) {
    console.error(`Error: File not found at ${auditPath}`);
    process.exit(1);
  }

  const allAuditedRecords = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

  const confirmedRecords = allAuditedRecords.filter(r => r.classification === 'CONFIRMED');
  const rejectRecords = allAuditedRecords.filter(r => r.classification === 'REJECT');
  const reviewRecords = allAuditedRecords.filter(r => r.classification === 'REVIEW');

  console.log('====================================================');
  console.log('PHASE 1: PRE-UPDATE AUDIT & SAFETY CHECKS');
  console.log('====================================================\n');

  console.log(`- Total Audited Proposed Changes: ${allAuditedRecords.length}`);
  console.log(`- CONFIRMED Records (Target for Update): ${confirmedRecords.length}`);
  console.log(`- REJECT Records (Will NOT be updated): ${rejectRecords.length}`);
  console.log(`- REVIEW Records (Will NOT be updated): ${reviewRecords.length}\n`);

  // Check unique contact IDs among CONFIRMED
  const confirmedIdSet = new Set();
  const duplicateIds = [];
  confirmedRecords.forEach(r => {
    if (confirmedIdSet.has(r.contactId)) duplicateIds.push(r.contactId);
    confirmedIdSet.add(r.contactId);
  });

  console.log(`1. Unique contactId Count among CONFIRMED: ${confirmedIdSet.size}`);
  console.log(`2. Duplicate IDs in CONFIRMED list: ${duplicateIds.length} ${duplicateIds.length === 0 ? '✅ (NONE)' : '⚠️'}`);

  // Fetch pre-write snapshots of all contacts
  const preAllContacts = await contactsCollection.find({}).toArray();
  const preContactMap = new Map();
  preAllContacts.forEach(c => preContactMap.set(String(c._id || c.id), c));

  const missingIds = [];
  confirmedRecords.forEach(r => {
    if (!preContactMap.has(r.contactId)) missingIds.push(r.contactId);
  });

  console.log(`3. Missing MongoDB IDs in Database: ${missingIds.length} ${missingIds.length === 0 ? '✅ (NONE)' : '⚠️'}`);
  if (missingIds.length > 0) {
    console.log('   Missing IDs:', missingIds);
    process.exit(1);
  }

  // Current -> Proposed transition counts for CONFIRMED records
  const transitionCounts = {};
  confirmedRecords.forEach(r => {
    transitionCounts[r.transition] = (transitionCounts[r.transition] || 0) + 1;
  });

  console.log('\nCONFIRMED STAGE TRANSITION COUNTS (CURRENT ➔ PROPOSED):');
  console.table(Object.entries(transitionCounts).map(([transition, count]) => ({ 'Transition': transition, 'Count': count })));

  console.log('\n====================================================');
  console.log('PHASE 2: EXECUTING BULK UPDATE FOR 101 CONFIRMED RECORDS');
  console.log('====================================================\n');

  const bulkOps = [];
  confirmedRecords.forEach(r => {
    let _idFilter;
    try {
      _idFilter = { _id: new ObjectId(r.contactId) };
    } catch (e) {
      _idFilter = { _id: r.contactId };
    }

    bulkOps.push({
      updateOne: {
        filter: _idFilter,
        update: {
          $set: {
            pipelineStage: r.proposedPipelineStage,
            updatedAt: new Date().toISOString()
          }
        }
      }
    });
  });

  console.log(`Executing bulkWrite of ${bulkOps.length} updates...`);
  const bulkResult = await contactsCollection.bulkWrite(bulkOps);
  console.log(`BulkWrite Output: Matched ${bulkResult.matchedCount}, Modified ${bulkResult.modifiedCount} records ✅\n`);

  console.log('====================================================');
  console.log('PHASE 3: POST-WRITE INTEGRITY VERIFICATION');
  console.log('====================================================\n');

  const postAllContacts = await contactsCollection.find({}).toArray();
  const postContactMap = new Map();
  postAllContacts.forEach(c => postContactMap.set(String(c._id || c.id), c));

  // 1. Verify exactly CONFIRMED records were modified to proposed stage
  let confirmedMatchCount = 0;
  confirmedRecords.forEach(r => {
    const postC = postContactMap.get(r.contactId);
    if (postC && postC.pipelineStage === r.proposedPipelineStage) {
      confirmedMatchCount++;
    }
  });

  console.log(`1. CONFIRMED Records Successfully Updated in MongoDB: ${confirmedMatchCount} / ${confirmedRecords.length} -> ${confirmedMatchCount === confirmedRecords.length ? 'PASS ✅' : 'FAIL ❌'}`);

  // 2. Verify REJECT and REVIEW records were UNTOUCHED
  let untouchedRejectCount = 0;
  rejectRecords.forEach(r => {
    const preC = preContactMap.get(r.contactId);
    const postC = postContactMap.get(r.contactId);
    if (preC && postC && preC.pipelineStage === postC.pipelineStage) {
      untouchedRejectCount++;
    }
  });

  let untouchedReviewCount = 0;
  reviewRecords.forEach(r => {
    const preC = preContactMap.get(r.contactId);
    const postC = postContactMap.get(r.contactId);
    if (preC && postC && preC.pipelineStage === postC.pipelineStage) {
      untouchedReviewCount++;
    }
  });

  console.log(`2. REJECT Records Untouched in MongoDB: ${untouchedRejectCount} / ${rejectRecords.length} -> ${untouchedRejectCount === rejectRecords.length ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`3. REVIEW Records Untouched in MongoDB: ${untouchedReviewCount} / ${reviewRecords.length} -> ${untouchedReviewCount === reviewRecords.length ? 'PASS ✅' : 'FAIL ❌'}`);

  // 3. Verify zero side effects on other fields (history, remarks, attender, name, phone)
  let nonStageFieldChanges = 0;
  postAllContacts.forEach(postC => {
    const cid = String(postC._id || postC.id);
    const preC = preContactMap.get(cid);
    if (preC) {
      if (JSON.stringify(preC.history) !== JSON.stringify(postC.history) ||
          preC.name !== postC.name ||
          preC.phone !== postC.phone ||
          preC.attenderName !== postC.attenderName ||
          preC.assignedName !== postC.assignedName) {
        nonStageFieldChanges++;
      }
    }
  });

  console.log(`4. Non-pipelineStage Field Alterations Across Database: ${nonStageFieldChanges} -> ${nonStageFieldChanges === 0 ? 'PASS ✅ (ZERO SIDE EFFECTS)' : 'FAIL ❌'}\n`);

  // 4. Final MongoDB Stage Distribution Table
  const finalStageCounts = {};
  postAllContacts.forEach(c => {
    const st = c.pipelineStage || '(blank/null)';
    finalStageCounts[st] = (finalStageCounts[st] || 0) + 1;
  });

  console.log('FINAL MONGODB ATLAS PIPELINE STAGE DISTRIBUTION (1,384 TOTAL CONTACTS):');
  console.table(Object.entries(finalStageCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([stage, count]) => ({ 'Pipeline Stage': stage, 'Total Contacts': count })));

  const totalFinalContacts = Object.values(finalStageCounts).reduce((a, b) => a + b, 0);
  console.log(`\nGrand Total MongoDB Contacts: ${totalFinalContacts} (Expected: 1,384) -> ${totalFinalContacts === 1384 ? 'PASS ✅' : 'FAIL ❌'}`);

  await client.close();
}

main().catch(console.error);
