import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { getCanonicalStage } from '../src/features/admin/utils.jsx';
import { PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log(`Total Contacts in DB: ${contacts.length}`);

  const counts = {};
  const prevPendingContacts = [];

  contacts.forEach(c => {
    const stage = getCanonicalStage(c);
    counts[stage] = (counts[stage] || 0) + 1;
    if (stage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || stage === "Previous Program Pending") {
      prevPendingContacts.push({
        id: c._id,
        name: c.Name || c.name,
        phone: c.Phone || c.phone || c.Mobile || c.mobile,
        pipelineStage: c.pipelineStage,
        status: c.status,
        previousProgram: c.previousProgram || c.Source || c.source || c["Called For"] || c.calledFor
      });
    }
  });

  console.log('\n--- CANONICAL STAGE COUNTS ACROSS ALL CONTACTS ---');
  console.table(counts);

  console.log(`\n--- PREVIOUS PROGRAM PENDING CONTACTS (${prevPendingContacts.length}) ---`);
  console.table(prevPendingContacts);

  await client.close();
}

main().catch(console.error);
