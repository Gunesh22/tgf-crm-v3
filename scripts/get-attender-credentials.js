// scripts/get-attender-credentials.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const attenders = await db.collection('attenders').find({}).toArray();
  console.log(`Found ${attenders.length} attenders in database:\n`);

  for (const a of attenders) {
    console.log(`ID: ${a.id || a._id} | Name: ${a.name} | Role: ${a.role || 'attender'} | PIN/Pass: ${a.password || '(none)'}`);
  }

  await client.close();
}

main().catch(console.error);
