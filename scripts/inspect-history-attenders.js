import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const historyAttenderNames = new Set();
  const historyAttenderIds = new Set();
  const historyCallers = new Set();
  const sampleAgentRecords = [];

  for (const c of contacts) {
    if (Array.isArray(c.history)) {
      for (const h of c.history) {
        if (h.attenderName) historyAttenderNames.add(h.attenderName);
        if (h.attenderId) historyAttenderIds.add(h.attenderId);
        if (h.caller) historyCallers.add(h.caller);
        if (h.callerName) historyCallers.add(h.callerName);

        const str = JSON.stringify(h).toLowerCase();
        if (str.includes("agent") || (h.attenderName && h.attenderName.toLowerCase().includes("agent")) || (h.attenderId && h.attenderId.toLowerCase().includes("agent"))) {
          sampleAgentRecords.push({ contactId: c._id, name: c.name || c.contactName, history: h });
        }
      }
    }
    // Also check top level
    const topStr = `${c.attenderName} ${c.attenderId} ${c.assignedTo}`.toLowerCase();
    if (topStr.includes("agent")) {
      sampleAgentRecords.push({ contactId: c._id, name: c.name || c.contactName, topLevel: { attenderName: c.attenderName, attenderId: c.attenderId, assignedTo: c.assignedTo } });
    }
  }

  console.log('=== DISTINCT HISTORY ATTENDER NAMES ===');
  console.log(Array.from(historyAttenderNames));

  console.log('\n=== DISTINCT HISTORY ATTENDER IDS ===');
  console.log(Array.from(historyAttenderIds));

  console.log('\n=== DISTINCT HISTORY CALLERS ===');
  console.log(Array.from(historyCallers));

  console.log(`\n=== SAMPLE AGENT RECORDS IN DB (${sampleAgentRecords.length} found) ===`);
  console.log(JSON.stringify(sampleAgentRecords.slice(0, 10), null, 2));

  await client.close();
}

main().catch(console.error);
