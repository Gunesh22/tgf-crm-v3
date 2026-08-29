// scripts/auditAndBackfillRegistrations.js
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { normalizeCalledForKey } from '../api/lib/calledForNormalizer.js';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'tgf_crm';

if (!uri) {
  console.error("Missing MONGODB_URI in environment!");
  process.exit(1);
}

async function auditAndBackfill() {
  console.log("=== RUNNING PRODUCTION DATA QUALITY AUDIT & REGISTRATION BACKFILL ===");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const regCollection = db.collection('registrations');

    const totalRegs = await regCollection.countDocuments({});
    console.log(`Total documents in 'registrations' collection: ${totalRegs}`);

    const allRegs = await regCollection.find({}).toArray();

    let missingContactIdCount = 0;
    let missingCalledForKeyCount = 0;
    let nullDuplicateCount = 0;
    let validUpdatedCount = 0;

    const seenKeys = new Set();
    const idsToDelete = [];

    for (const reg of allRegs) {
      const cId = reg.contactId || reg.id || reg._id?.toString();
      const rawCalledFor = reg.calledFor || reg.calledForKey || reg.programName || reg.programId || 'general';
      const normKey = normalizeCalledForKey(rawCalledFor);

      if (!reg.contactId || reg.contactId === 'null' || reg.contactId === 'undefined') {
        missingContactIdCount++;
        // Identify garbage test records with null contactId for removal
        idsToDelete.push(reg._id);
        continue;
      }

      if (!reg.calledForKey) {
        missingCalledForKeyCount++;
      }

      const compoundKey = `${cId}_${normKey}`;

      if (seenKeys.has(compoundKey)) {
        console.warn(`[DUPLICATE REGISTRATION FOUND] ID: ${reg._id}, Contact: ${cId}, CalledForKey: ${normKey}`);
        idsToDelete.push(reg._id);
        nullDuplicateCount++;
      } else {
        seenKeys.add(compoundKey);

        // Update record with normalized calledForKey and registrationId
        const newRegId = `reg_${cId}_${normKey}`;
        await regCollection.updateOne(
          { _id: reg._id },
          {
            $set: {
              contactId: String(cId),
              calledForKey: normKey,
              calledFor: reg.calledFor || rawCalledFor,
              registrationId: reg.registrationId || newRegId,
              updatedAt: new Date().toISOString()
            }
          }
        );
        validUpdatedCount++;
      }
    }

    console.log("\n=== DATA QUALITY AUDIT SUMMARY ===");
    console.log(`Total Records Audited: ${totalRegs}`);
    console.log(`Records Missing contactId: ${missingContactIdCount}`);
    console.log(`Records Missing calledForKey (Backfilled): ${missingCalledForKeyCount}`);
    console.log(`Duplicate Registrations Identified & Cleaned: ${nullDuplicateCount}`);
    console.log(`Valid Registrations Successfully Normalized: ${validUpdatedCount}`);

    if (idsToDelete.length > 0) {
      console.log(`Cleaning ${idsToDelete.length} unidentifiable / duplicate test registration documents...`);
      const delResult = await regCollection.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`✓ Cleaned ${delResult.deletedCount} legacy duplicate/invalid documents.`);
    }

    // Now create compound unique index
    console.log("\nAttempting creation of compound unique index { contactId: 1, calledForKey: 1 }...");
    const indexResult = await regCollection.createIndex(
      { contactId: 1, calledForKey: 1 },
      { unique: true, name: "contactId_1_calledForKey_1" }
    );
    console.log("🎉 SUCCESS: Compound Unique Index Created:", indexResult);

    return true;
  } catch (error) {
    console.error("Audit / Backfill error:", error);
    throw error;
  } finally {
    await client.close();
  }
}

auditAndBackfill()
  .then(() => {
    console.log("=== REGISTRATION DATA QUALITY AUDIT & BACKFILL COMPLETE ===");
    process.exit(0);
  })
  .catch(err => {
    console.error("Failed backfill:", err);
    process.exit(1);
  });
