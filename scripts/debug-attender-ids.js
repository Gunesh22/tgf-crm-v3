// scripts/debug-attender-ids.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  console.log('--- ATTENDERS COLLECTION ---');
  console.log(attenders);

  const assignedToValues = new Set();
  const leadOwnerValues = new Set();
  const attenderIdValues = new Set();

  for (const c of contacts) {
    if (Array.isArray(c.assignedTo)) {
      c.assignedTo.forEach(a => assignedToValues.add(a));
    }
    if (c.leadOwner) leadOwnerValues.add(c.leadOwner);
    if (c.attenderId) attenderIdValues.add(c.attenderId);
  }

  console.log('\n--- CONTACTS ASSIGNED_TO DISTINCT VALUES ---');
  console.log(Array.from(assignedToValues));

  console.log('\n--- CONTACTS LEAD_OWNER DISTINCT VALUES ---');
  console.log(Array.from(leadOwnerValues));

  console.log('\n--- CONTACTS ATTENDER_ID DISTINCT VALUES ---');
  console.log(Array.from(attenderIdValues));

  await client.close();
}

main().catch(console.error);
