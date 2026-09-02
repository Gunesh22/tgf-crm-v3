require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://shivam:Shivam123@cluster0.n4n5w.mongodb.net/tgf_crm?retryWrites=true&w=majority";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const purposeCounts = {};
  let totalHistoryCalls = 0;

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        totalHistoryCalls++;
        const p = h.callPurpose || h.purpose || "(missing)";
        purposeCounts[p] = (purposeCounts[p] || 0) + 1;
      });
    }
  });

  console.log(`Total Call History Items in DB: ${totalHistoryCalls}`);
  console.log(`Call Purpose Distribution in MongoDB:`);
  console.log(JSON.stringify(purposeCounts, null, 2));

  // Show a few sample history items
  const sampleWithPurpose = [];
  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        if (sampleWithPurpose.length < 5 && (h.callPurpose || h.purpose)) {
          sampleWithPurpose.push({ callPurpose: h.callPurpose, purpose: h.purpose, status: h.status, remark: h.remark });
        }
      });
    }
  });

  console.log(`\nSample DB History Items:`);
  console.log(JSON.stringify(sampleWithPurpose, null, 2));

  await client.close();
}

main().catch(console.error);
