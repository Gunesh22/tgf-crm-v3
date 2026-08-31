import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({
    $or: [
      { name: /Final Test 1/i },
      { contactName: /Final Test 1/i },
      { Phone: /7927538529/ }
    ]
  }).toArray();

  contacts.forEach(c => {
    console.log("=== CONTACT FULL JSON DUMP ===");
    console.log(JSON.stringify(c, null, 2));
  });

  await client.close();
}

main().catch(console.error);
