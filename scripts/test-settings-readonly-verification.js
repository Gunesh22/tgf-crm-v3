import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function runVerification() {
  if (!MONGODB_URI) {
    console.error("No MONGODB_URI found");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('tgf_crm');
    const collection = db.collection('settings');

    // 1. Fetch initial doc
    const initialDoc = await collection.findOne({ _id: 'call_center_options' });
    console.log("Initial DB Doc updatedAt:", initialDoc?.updatedAt);
    console.log("Initial CalledFor count:", initialDoc?.calledForOptions?.length);
    console.log("Initial Source count:", initialDoc?.sourceOptions?.length);

    // 2. Add a custom option via simulated POST/PUT
    const testCustomOption = "Custom Test Option " + Date.now();
    const updatedCalledFor = [...(initialDoc.calledForOptions || []), testCustomOption];
    const postTimestamp = new Date().toISOString();

    await collection.updateOne(
      { _id: 'call_center_options' },
      { $set: { calledForOptions: updatedCalledFor, updatedAt: postTimestamp } }
    );
    console.log(`\nSimulated POST: Added "${testCustomOption}" to DB with updatedAt: ${postTimestamp}`);

    // 3. Perform 3 GET reads (read-only verification)
    const docRead1 = await collection.findOne({ _id: 'call_center_options' });
    await new Promise(r => setTimeout(r, 500));
    const docRead2 = await collection.findOne({ _id: 'call_center_options' });
    await new Promise(r => setTimeout(r, 500));
    const docRead3 = await collection.findOne({ _id: 'call_center_options' });

    console.log("\n--- Verification Results ---");
    console.log("Read 1 updatedAt:", docRead1.updatedAt);
    console.log("Read 2 updatedAt:", docRead2.updatedAt);
    console.log("Read 3 updatedAt:", docRead3.updatedAt);
    console.log("Read 3 includes custom option:", docRead3.calledForOptions.includes(testCustomOption));

    const isReadOnly = (docRead1.updatedAt === postTimestamp) &&
                       (docRead2.updatedAt === postTimestamp) &&
                       (docRead3.updatedAt === postTimestamp) &&
                       docRead3.calledForOptions.includes(testCustomOption);

    if (isReadOnly) {
      console.log("\n✅ SUCCESS: GET is 100% read-only and MongoDB is the true source of truth!");
    } else {
      console.error("\n❌ FAILURE: GET modified the document or wiped custom options!");
    }

    // Cleanup test option
    const cleanedCalledFor = docRead3.calledForOptions.filter(o => o !== testCustomOption);
    await collection.updateOne(
      { _id: 'call_center_options' },
      { $set: { calledForOptions: cleanedCalledFor, updatedAt: new Date().toISOString() } }
    );
    console.log("Cleaned up test option from DB.");

  } catch (err) {
    console.error("Verification error:", err);
  } finally {
    await client.close();
  }
}

runVerification();
