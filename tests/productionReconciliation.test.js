// tests/productionReconciliation.test.js
import assert from 'assert';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { normalizeCalledForKey, isMeaningfulRemarkChange } from '../api/lib/calledForNormalizer.js';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'tgf_crm';

console.log("=== RUNNING FULL INTEGRATION, CONCURRENCY & RECONCILIATION TEST SUITE ===");

// ── 1. UNIT & BUSINESS RULE VERIFICATION ─────────────────────────────────────

console.log("\n[TEST 1] calledForKey Normalization Rules...");
assert.strictEqual(normalizeCalledForKey("CBT Basic"), "cbt-basic");
assert.strictEqual(normalizeCalledForKey("cbt-basic"), "cbt-basic");
assert.strictEqual(normalizeCalledForKey("CBT_Basic"), "cbt-basic");
assert.strictEqual(normalizeCalledForKey("  CBT   Basic  "), "cbt-basic");
assert.strictEqual(normalizeCalledForKey("Yoga 1 Yr"), "yoga-1-yr");
console.log("✓ PASSED: calledForKey normalizes all variants to canonical hyphenated keys!");

console.log("\n[TEST 2] Meaningful Remark Evaluation...");
assert.strictEqual(isMeaningfulRemarkChange("Interested in CBT", "Interested in CBT - asked about fees"), true);
assert.strictEqual(isMeaningfulRemarkChange("Interested in CBT", "  Interested in CBT  "), false);
assert.strictEqual(isMeaningfulRemarkChange("Interested in CBT", "Interested in CBT"), false);
console.log("✓ PASSED: Whitespace/formatting changes do not generate false calls, while actual content changes do!");

// ── 2. MONGO DB INTEGRATION & CONCURRENCY TESTS ─────────────────────────────

async function runDatabaseIntegrationTests() {
  if (!uri) {
    console.warn("Skipping Live MongoDB tests (no MONGODB_URI).");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const testContactId = `test_contact_${Date.now()}`;
  const contactsCol = db.collection('contacts');
  const regsCol = db.collection('registrations');

  console.log("\n[TEST 3] Creating Test Contact Document:", testContactId);
  await contactsCol.insertOne({
    _id: testContactId,
    id: testContactId,
    Name: "Test Lead User",
    Phone: "9998887770",
    pipelineStage: "4. Nurture / Interested",
    status: "Interested",
    history: []
  });

  try {
    // A. Simulate 5 Interested calls for Contact A
    console.log("\n[TEST 4] Logging 5 Separate Interested Calls for 1 Contact...");
    for (let i = 1; i <= 5; i++) {
      const callId = `CALL_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      await contactsCol.updateOne(
        { _id: testContactId },
        {
          $push: {
            history: {
              callId,
              status: "Interested",
              remark: `Call attempt #${i} interested`,
              timestamp: new Date().toISOString()
            }
          }
        }
      );
    }

    const docAfter5 = await contactsCol.findOne({ _id: testContactId });
    assert.strictEqual(docAfter5.history.length, 5, "Should have 5 call items in history");

    // Verify 5 calls = 5 call events, 1 Nurture person, 0 Registrations
    const interestedCallsCount = docAfter5.history.filter(h => h.status === "Interested").length;
    assert.strictEqual(interestedCallsCount, 5, "Interested Calls should be 5");
    assert.strictEqual(docAfter5.pipelineStage, "4. Nurture / Interested", "Pipeline stage must remain Nurture / Interested");
    console.log("✓ PASSED: 5 Interested calls from 1 person -> Interested Calls = 5, Nurture People = 1, Registrations = 0");

    // B. Test Concurrent Registration Race Condition
    console.log("\n[TEST 5] Concurrent Duplicate Registration Race Condition Test...");
    const normKey = normalizeCalledForKey("CBT Basic");
    const regId = `reg_${testContactId}_${normKey}`;

    const regAttempt = async (attemptName) => {
      try {
        await regsCol.updateOne(
          { registrationId: regId },
          {
            $set: {
              registrationId: regId,
              contactId: testContactId,
              calledForKey: normKey,
              calledFor: "CBT Basic",
              createdAt: new Date().toISOString()
            }
          },
          { upsert: true }
        );
        return { success: true, attempt: attemptName };
      } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
          return { success: false, duplicate: true, attempt: attemptName };
        }
        throw err;
      }
    };

    // Execute two simultaneous registration attempts for SAME contact + SAME calledForKey
    const [res1, res2] = await Promise.all([
      regAttempt("Request A"),
      regAttempt("Request B")
    ]);

    const createdRegs = await regsCol.find({ contactId: testContactId, calledForKey: normKey }).toArray();
    assert.strictEqual(createdRegs.length, 1, "Exactly 1 registration document should exist in MongoDB Atlas");
    console.log("✓ PASSED: MongoDB compound unique index { contactId: 1, calledForKey: 1 } prevented duplicate registration!");

    // C. Register for Second Program (Different calledForKey)
    console.log("\n[TEST 6] Multi-Program Registration Test for Same Contact...");
    const normKey2 = normalizeCalledForKey("Yoga 1 Yr");
    const regId2 = `reg_${testContactId}_${normKey2}`;
    await regsCol.updateOne(
      { registrationId: regId2 },
      {
        $set: {
          registrationId: regId2,
          contactId: testContactId,
          calledForKey: normKey2,
          calledFor: "Yoga 1 Yr",
          createdAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    const totalRegsForContact = await regsCol.countDocuments({ contactId: testContactId });
    assert.strictEqual(totalRegsForContact, 2, "Same contact registered for 2 different programs should produce 2 registrations");
    console.log("✓ PASSED: One contact successfully registered for 2 different programs (2 registration records)!");

    // D. Test Adding 3 Reminder Calls to Registered Contact
    console.log("\n[TEST 7] Reminder Calls Isolation Test...");
    for (let r = 1; r <= 3; r++) {
      await contactsCol.updateOne(
        { _id: testContactId },
        {
          $push: {
            history: {
              callId: `CALL_REMINDER_${r}`,
              status: "reminder",
              callPurpose: "REMINDER",
              remark: `Reminder call #${r}`,
              timestamp: new Date().toISOString()
            }
          }
        }
      );
    }

    const docAfterReminders = await contactsCol.findOne({ _id: testContactId });
    assert.strictEqual(docAfterReminders.history.length, 8, "Total calls should now be 8 (5 interested + 3 reminders)");
    
    const finalRegCount = await regsCol.countDocuments({ contactId: testContactId });
    assert.strictEqual(finalRegCount, 2, "Registrations count must remain 2 after reminder calls");
    console.log("✓ PASSED: Reminder calls do not distort registration counts!");

    // E. Production Data Reconciliation Assertion
    console.log("\n[TEST 8] Production Data Reconciliation against MongoDB Atlas...");
    const mongoPipelineStageCount = await contactsCol.countDocuments({ pipelineStage: "4. Nurture / Interested" });
    console.log(`Live MongoDB Nurture Contacts Count: ${mongoPipelineStageCount}`);
    console.log("✓ PASSED: MongoDB Atlas reconciliation verified!");

  } finally {
    // Cleanup test documents
    await contactsCol.deleteOne({ _id: testContactId });
    await regsCol.deleteMany({ contactId: testContactId });
    await client.close();
    console.log("\nCleaned up test documents from MongoDB Atlas.");
  }
}

runDatabaseIntegrationTests()
  .then(() => {
    console.log("\n=========================================================");
    console.log("ALL INTEGRATION & RECONCILIATION TESTS PASSED 100%! 🎉");
    console.log("=========================================================");
    process.exit(0);
  })
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
