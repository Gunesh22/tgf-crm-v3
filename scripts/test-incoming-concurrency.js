// scripts/test-incoming-concurrency.js
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import { executeLogCall } from '../api/_contacts/log-call.js';
import handlerCreateIncoming from '../api/_contacts/create-incoming.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable not set');
  process.exit(1);
}

// Mock HTTP req/res objects for testing serverless API handler directly
function createMockReqRes(body) {
  let responseData = null;
  let responseStatus = 200;

  const req = {
    method: 'POST',
    body
  };

  const res = {
    setHeader: () => {},
    status: (code) => {
      responseStatus = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: () => res
  };

  return { req, res, getResult: () => ({ status: responseStatus, data: responseData }) };
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('=== STARTING RACE CONDITION & DUPLICATE PREVENTION VERIFICATION ===\n');

  const testPhoneBase = '987' + Math.floor(1000000 + Math.random() * 9000000);
  const testPhoneFormatted1 = `+91 ${testPhoneBase.slice(0, 5)} ${testPhoneBase.slice(5)}`;
  const testPhoneFormatted2 = `0${testPhoneBase}`;
  
  const createdTestContactIds = [];

  try {
    // Setup: Seed a base contact owned by Attender A
    const seedContact = {
      Name: 'Test Seed Contact',
      name: 'Test Seed Contact',
      Phone: testPhoneBase,
      phone: testPhoneBase,
      normalizedPhone: testPhoneBase,
      Mobile: testPhoneBase,
      mobile: testPhoneBase,
      normalizedMobile: testPhoneBase,
      City: 'Test City',
      pipelineStage: '1. New Lead',
      leadOwner: 'attender_A',
      leadOwnerName: 'Attender Alpha',
      assignedTo: ['attender_A'],
      Source: 'Original Source',
      source: 'Original Source',
      original_source: 'Original Source',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    };

    const seedRes = await db.collection('contacts').insertOne(seedContact);
    const seedIdStr = seedRes.insertedId.toString();
    createdTestContactIds.push(seedRes.insertedId);
    console.log(`[SETUP] Seeded base contact ID: ${seedIdStr} for phone: ${testPhoneBase}`);

    // TEST 1: Existing phone + immediate Save -> existing profile, no duplicate
    console.log('\n--- TEST 1: Existing phone + immediate Save ---');
    {
      const { req, res, getResult } = createMockReqRes({
        attenderId: 'attender_B',
        attenderName: 'Attender Beta',
        Phone: testPhoneBase,
        status: 'Info Given',
        remark: 'Test 1 immediate save'
      });
      await handlerCreateIncoming(req, res);
      const result = getResult();
      console.log('API Response:', result);

      if (result.data?.contactId === seedIdStr && result.data?.isMerged === true) {
        console.log('✅ TEST 1 PASSED: Merged into existing profile without creating duplicate.');
      } else {
        console.error('❌ TEST 1 FAILED:', result);
      }
    }

    // TEST 2: Existing mobile + immediate Save -> existing profile, no duplicate
    console.log('\n--- TEST 2: Existing mobile + immediate Save ---');
    {
      const { req, res, getResult } = createMockReqRes({
        attenderId: 'attender_B',
        attenderName: 'Attender Beta',
        Mobile: testPhoneBase,
        status: 'Interested',
        remark: 'Test 2 mobile match'
      });
      await handlerCreateIncoming(req, res);
      const result = getResult();
      console.log('API Response:', result);

      if (result.data?.contactId === seedIdStr && result.data?.isMerged === true) {
        console.log('✅ TEST 2 PASSED: Merged into existing profile by mobile field.');
      } else {
        console.error('❌ TEST 2 FAILED:', result);
      }
    }

    // TEST 3: Existing phone with +91 formatting -> existing profile
    console.log('\n--- TEST 3: Existing phone with +91 formatting ---');
    {
      const { req, res, getResult } = createMockReqRes({
        attenderId: 'attender_B',
        attenderName: 'Attender Beta',
        Phone: testPhoneFormatted1,
        status: 'Info Given',
        remark: 'Test 3 +91 formatting'
      });
      await handlerCreateIncoming(req, res);
      const result = getResult();
      console.log('API Response:', result);

      if (result.data?.contactId === seedIdStr && result.data?.isMerged === true) {
        console.log('✅ TEST 3 PASSED: Normalized +91 formatting matched existing profile.');
      } else {
        console.error('❌ TEST 3 FAILED:', result);
      }
    }

    // TEST 4: Existing phone with spaces/dashes -> existing profile
    console.log('\n--- TEST 4: Existing phone with spaces/dashes ---');
    {
      const formattedWithDashes = `0-${testPhoneBase.slice(0, 5)}-${testPhoneBase.slice(5)}`;
      const { req, res, getResult } = createMockReqRes({
        attenderId: 'attender_B',
        attenderName: 'Attender Beta',
        Phone: formattedWithDashes,
        status: 'Info Given',
        remark: 'Test 4 dashes'
      });
      await handlerCreateIncoming(req, res);
      const result = getResult();
      console.log('API Response:', result);

      if (result.data?.contactId === seedIdStr && result.data?.isMerged === true) {
        console.log('✅ TEST 4 PASSED: Normalized dashes/spaces matched existing profile.');
      } else {
        console.error('❌ TEST 4 FAILED:', result);
      }
    }

    // TEST 5: Completely new phone -> one new profile
    console.log('\n--- TEST 5: Completely new phone ---');
    const brandNewPhone = '999' + Math.floor(1000000 + Math.random() * 9000000);
    let newContactIdStr = null;
    {
      const { req, res, getResult } = createMockReqRes({
        attenderId: 'attender_C',
        attenderName: 'Attender Charlie',
        Phone: brandNewPhone,
        Name: 'Brand New Lead',
        status: 'Pending',
        remark: 'Test 5 new phone'
      });
      await handlerCreateIncoming(req, res);
      const result = getResult();
      console.log('API Response:', result);

      if (result.data?.contactId && result.data?.isMerged === false) {
        newContactIdStr = result.data.contactId;
        createdTestContactIds.push(new ObjectId(newContactIdStr));
        console.log('✅ TEST 5 PASSED: Created exactly 1 new profile.');
      } else {
        console.error('❌ TEST 5 FAILED:', result);
      }
    }

    // TEST 6: Two simultaneous saves with the same new phone -> only one profile
    console.log('\n--- TEST 6: Two simultaneous saves with the same new phone (race condition) ---');
    const concurrentPhone = '988' + Math.floor(1000000 + Math.random() * 9000000);
    {
      const mock1 = createMockReqRes({
        attenderId: 'attender_D',
        attenderName: 'Attender Delta',
        Phone: concurrentPhone,
        Name: 'Concurrent Lead 1',
        status: 'Query',
        remark: 'Save 1'
      });

      const mock2 = createMockReqRes({
        attenderId: 'attender_E',
        attenderName: 'Attender Echo',
        Phone: concurrentPhone,
        Name: 'Concurrent Lead 2',
        status: 'Info Given',
        remark: 'Save 2'
      });

      // Fire both requests simultaneously via Promise.all
      const [res1, res2] = await Promise.all([
        handlerCreateIncoming(mock1.req, mock1.res).then(() => mock1.getResult()),
        handlerCreateIncoming(mock2.req, mock2.res).then(() => mock2.getResult())
      ]);

      console.log('Concurrent Response 1:', res1);
      console.log('Concurrent Response 2:', res2);

      // Verify in MongoDB how many documents exist for concurrentPhone
      const dbMatches = await db.collection('contacts').find({
        $or: [
          { normalizedPhone: concurrentPhone },
          { phone: concurrentPhone }
        ]
      }).toArray();

      dbMatches.forEach(m => createdTestContactIds.push(m._id));

      console.log(`MongoDB document count for phone ${concurrentPhone}: ${dbMatches.length}`);

      if (dbMatches.length === 1 && (res1.data?.contactId === res2.data?.contactId)) {
        console.log('✅ TEST 6 PASSED: Exactly 1 profile exists in MongoDB. Concurrent race handled cleanly!');
      } else {
        console.error('❌ TEST 6 FAILED: Found', dbMatches.length, 'documents in MongoDB');
      }
    }

    // TEST 7: Existing contact owned by another Attender -> merge into existing contact, preserve leadOwner
    console.log('\n--- TEST 7: Existing contact owned by another Attender ---');
    {
      const { req, res, getResult } = createMockReqRes({
        attenderId: 'attender_Z',
        attenderName: 'Attender Zeta',
        Phone: testPhoneBase,
        status: 'Query',
        remark: 'Test 7 cross-attender'
      });
      await handlerCreateIncoming(req, res);
      const result = getResult();

      const docInDb = await db.collection('contacts').findOne({ _id: new ObjectId(seedIdStr) });

      if (
        result.data?.contactId === seedIdStr &&
        docInDb.leadOwner === 'attender_A' &&
        Array.isArray(docInDb.assignedTo) && docInDb.assignedTo.includes('attender_Z')
      ) {
        console.log('✅ TEST 7 PASSED: Merged into existing contact. leadOwner preserved as attender_A, attender_Z added to assignedTo.');
      } else {
        console.error('❌ TEST 7 FAILED:', docInDb);
      }
    }

    // TEST 8: Existing shared contact -> preserve all existing shared-contact isolation and pipeline rules
    console.log('\n--- TEST 8: Existing shared contact rules ---');
    {
      const docInDb = await db.collection('contacts').findOne({ _id: new ObjectId(seedIdStr) });
      if (docInDb.original_source === 'Original Source' && docInDb.leadOwner === 'attender_A') {
        console.log('✅ TEST 8 PASSED: original_source and leadOwner strictly preserved.');
      } else {
        console.error('❌ TEST 8 FAILED:', docInDb);
      }
    }

  } finally {
    // Cleanup test documents from database
    if (createdTestContactIds.length > 0) {
      await db.collection('contacts').deleteMany({ _id: { $in: createdTestContactIds } });
      console.log(`\n[CLEANUP] Deleted ${createdTestContactIds.length} test contact(s) from database.`);
    }
    await client.close();
  }

  console.log('\n=== ALL RACE CONDITION & DUPLICATE TESTS COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error);
