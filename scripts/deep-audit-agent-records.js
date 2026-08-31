import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const agentContacts = [];

  for (const c of contacts) {
    const isAgent = (c.attenderName === "Agent") || 
      (Array.isArray(c.history) && c.history.some(h => h.attenderName === "Agent"));
    if (isAgent) {
      agentContacts.push(c);
    }
  }

  console.log(`=== FULL AUDIT OF ALL ${agentContacts.length} 'AGENT' CONTACTS ===`);
  agentContacts.forEach((c, idx) => {
    console.log(`\n--- Record #${idx + 1} ---`);
    console.log(`Contact ID: ${c._id}`);
    console.log(`Name: ${c.name || c.contactName}`);
    console.log(`Phone: ${c.phone || c.contactPhone || c.mobile}`);
    console.log(`attenderName (top-level): "${c.attenderName}"`);
    console.log(`attenderId (top-level): "${c.attenderId}"`);
    console.log(`assignedTo: ${JSON.stringify(c.assignedTo)}`);
    console.log(`date_added / createdAt: ${c.createdAt || c.date_added || c.dateAdded}`);
    if (Array.isArray(c.history)) {
      console.log(`History events count: ${c.history.length}`);
      c.history.forEach((h, hIdx) => {
        console.log(`  [History #${hIdx + 1}] ID: ${h.id}, Timestamp: ${h.timestamp}, Status: ${h.status}, AttenderName: "${h.attenderName}", AttenderId: "${h.attenderId}", CalledFor: "${h.calledFor}"`);
      });
    }
  });

  await client.close();
}

main().catch(console.error);
