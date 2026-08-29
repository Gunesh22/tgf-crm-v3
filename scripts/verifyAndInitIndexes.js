// scripts/verifyAndInitIndexes.js
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'tgf_crm';

if (!uri) {
  console.error("Missing MONGODB_URI in environment!");
  process.exit(1);
}

async function verifyAndInitIndexes() {
  console.log("=== CONNECTING TO MONGODB ATLAS FOR INDEX VERIFICATION ===");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log(`Connected to database: ${dbName}`);
    const regCollection = db.collection('registrations');

    // 1. Fetch existing indexes
    const existingIndexes = await regCollection.indexes();
    console.log("Current indexes on 'registrations':", JSON.stringify(existingIndexes, null, 2));

    const hasCompoundUnique = existingIndexes.some(idx => {
      const keys = Object.keys(idx.key);
      return idx.unique === true && keys.length === 2 && keys.includes('contactId') && keys.includes('calledForKey');
    });

    if (hasCompoundUnique) {
      console.log("✓ VERIFIED: Compound unique index { contactId: 1, calledForKey: 1 } ALREADY EXISTS!");
    } else {
      console.log("Creating compound unique index { contactId: 1, calledForKey: 1 } on 'registrations'...");
      const result = await regCollection.createIndex(
        { contactId: 1, calledForKey: 1 },
        { unique: true, name: "contactId_1_calledForKey_1" }
      );
      console.log("✓ INDEX CREATION SUCCESSFUL:", result);
    }

    // 2. Also ensure contacts history index for fast querying
    const contactsCollection = db.collection('contacts');
    await contactsCollection.createIndex({ "history.callId": 1 }, { sparse: true, name: "history_callId_sparse" });
    await contactsCollection.createIndex({ pipelineStage: 1 }, { name: "pipelineStage_idx" });
    console.log("✓ VERIFIED: Contacts collection performance indexes ensured!");

    return true;
  } catch (error) {
    console.error("Index initialization error:", error);
    throw error;
  } finally {
    await client.close();
  }
}

verifyAndInitIndexes()
  .then(() => {
    console.log("=== MONGODB INDEX VERIFICATION COMPLETE ===");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed index verification:", err);
    process.exit(1);
  });
