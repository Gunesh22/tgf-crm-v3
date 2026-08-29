// scripts/finalLegacyAudit.js
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'tgf_crm';

if (!uri) {
  console.error("Missing MONGODB_URI in environment!");
  process.exit(1);
}

const VALID_STAGES = [
  "1. New Lead",
  "2. Attempting Contact",
  "3. Information Given",
  "4. Nurture / Interested",
  "5. Future Pool",
  "6. Registered / Won",
  "Existing Alumni",
  "Query Desk",
  "Closed / Lost",
  "Closed / Invalid"
];

async function runFinalLegacyAudit() {
  console.log("=== RUNNING FINAL LEGACY DATA & PRODUCTION SAFETY AUDIT ===");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    const contactsCol = db.collection('contacts');
    const regsCol = db.collection('registrations');

    // 1. AUDIT CONTACTS & PIPELINE STAGES
    const totalContacts = await contactsCol.countDocuments({});
    console.log(`\n--- 1. CONTACTS AUDIT (Total: ${totalContacts}) ---`);

    const allContacts = await contactsCol.find({}).toArray();

    let missingPipelineStageCount = 0;
    let invalidPipelineStageCount = 0;
    let validPipelineStageCount = 0;

    const stageBreakdown = {
      "Unknown / Legacy": 0
    };
    VALID_STAGES.forEach(s => stageBreakdown[s] = 0);

    allContacts.forEach(c => {
      const stage = c.pipelineStage;
      if (!stage || String(stage).trim() === "" || stage === "null" || stage === "undefined") {
        missingPipelineStageCount++;
        stageBreakdown["Unknown / Legacy"]++;
      } else if (!VALID_STAGES.includes(stage)) {
        invalidPipelineStageCount++;
        stageBreakdown["Unknown / Legacy"]++;
        console.warn(`[INVALID STAGE] Contact ID: ${c._id}, Stage: "${stage}"`);
      } else {
        validPipelineStageCount++;
        stageBreakdown[stage]++;
      }
    });

    console.log("Pipeline Stage Breakdown (MongoDB Direct):");
    console.table(stageBreakdown);

    const sumReportedContacts = Object.values(stageBreakdown).reduce((a, b) => a + b, 0);
    console.log(`Verification: Sum of Stage Breakdown (${sumReportedContacts}) === Total Contacts (${totalContacts})`);
    if (sumReportedContacts !== totalContacts) {
      console.error("Mismatch in contact count verification!");
    } else {
      console.log("✓ VERIFIED: Known Pipeline Stages + Unknown / Legacy EQUALS Total Contacts!");
    }

    // 2. AUDIT LEGACY CALL HISTORY
    console.log(`\n--- 2. CALL HISTORY AUDIT ---`);
    let totalCallEvents = 0;
    let missingCallIdCount = 0;
    let malformedTimestampCount = 0;
    const seenCallIds = new Set();
    let duplicateCallIdCount = 0;

    allContacts.forEach(c => {
      const history = Array.isArray(c.history) ? c.history : [];
      history.forEach(h => {
        totalCallEvents++;
        if (!h.callId) {
          missingCallIdCount++;
        } else {
          if (seenCallIds.has(h.callId)) {
            duplicateCallIdCount++;
          } else {
            seenCallIds.add(h.callId);
          }
        }

        const ts = h.timestamp || h.date || h.createdAt;
        if (!ts || isNaN(new Date(ts).getTime())) {
          malformedTimestampCount++;
        }
      });
    });

    console.log(`Total Call Events in contacts.history: ${totalCallEvents}`);
    console.log(`Missing callId: ${missingCallIdCount}`);
    console.log(`Duplicate callId: ${duplicateCallIdCount}`);
    console.log(`Malformed Timestamps: ${malformedTimestampCount}`);

    // 3. AUDIT REGISTRATIONS
    console.log(`\n--- 3. REGISTRATIONS AUDIT ---`);
    const totalRegs = await regsCol.countDocuments({});
    const allRegs = await regsCol.find({}).toArray();

    let missingRegistrationIdCount = 0;
    let missingCalledForKeyCount = 0;
    let invalidContactRefCount = 0;

    allRegs.forEach(r => {
      if (!r.registrationId) missingRegistrationIdCount++;
      if (!r.calledForKey) missingCalledForKeyCount++;
      if (!r.contactId || r.contactId === 'null') invalidContactRefCount++;
    });

    console.log(`Total Documents in registrations collection: ${totalRegs}`);
    console.log(`Missing registrationId: ${missingRegistrationIdCount}`);
    console.log(`Missing calledForKey: ${missingCalledForKeyCount}`);
    console.log(`Invalid / Missing contactId ref: ${invalidContactRefCount}`);

    // 4. FINAL RECONCILIATION SUMMARY
    console.log("\n==================================================");
    console.log("FINAL AUDIT SUMMARY REPORT");
    console.log("==================================================");
    console.log(`Total Contacts: ${totalContacts}`);
    console.log(`Valid Pipeline Stage Contacts: ${validPipelineStageCount}`);
    console.log(`Missing Pipeline Stage: ${missingPipelineStageCount}`);
    console.log(`Invalid Pipeline Stage: ${invalidPipelineStageCount}`);
    console.log(`Legacy Contacts Classified as "Unknown / Legacy": ${missingPipelineStageCount + invalidPipelineStageCount}`);
    console.log(`Total Call Events Logged: ${totalCallEvents}`);
    console.log(`Legacy Calls Missing callId: ${missingCallIdCount}`);
    console.log(`Duplicate callIds: ${duplicateCallIdCount}`);
    console.log(`Total Registrations: ${totalRegs}`);
    console.log(`Legacy Registration Issues: ${missingRegistrationIdCount + missingCalledForKeyCount + invalidContactRefCount}`);

    return {
      totalContacts,
      validPipelineStageCount,
      missingPipelineStageCount,
      invalidPipelineStageCount,
      unknownLegacyCount: missingPipelineStageCount + invalidPipelineStageCount,
      totalCallEvents,
      missingCallIdCount,
      duplicateCallIdCount,
      totalRegs,
      invalidContactRefCount
    };
  } finally {
    await client.close();
  }
}

runFinalLegacyAudit()
  .then(res => {
    console.log("\nAudit script finished successfully.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Audit script failed:", err);
    process.exit(1);
  });
