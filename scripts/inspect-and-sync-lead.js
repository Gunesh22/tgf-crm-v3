import { MongoClient } from 'mongodb';
import fs from 'fs';
import { normalizeProgramStates, getEffectiveStage, getProgramSpecificStatus } from '../src/utils/pipelineEngine.js';

const env = fs.readFileSync('.env.local', 'utf8');
const mongoUriMatch = env.match(/MONGODB_URI=(.*)/);
const MONGODB_URI = mongoUriMatch ? mongoUriMatch[1].trim() : '';

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const query = {
    $or: [
      { phone: /9876500001/ },
      { Phone: /9876500001/ },
      { mobile: /9876500001/ },
      { Mobile: /9876500001/ }
    ]
  };

  const contact = await db.collection('contacts').findOne(query);

  if (!contact) {
    console.log('No contact found for phone 8883791273');
    await client.close();
    return;
  }

  console.log('\n--- RAW MONGODB RECORD BEFORE FIX ---');
  console.log(`ID: ${contact._id}`);
  console.log(`Name: ${contact.Name || contact.name}`);
  console.log(`Called For: ${contact['Called For'] || contact.calledFor}`);
  console.log(`Root pipelineStage: ${contact.pipelineStage}`);
  console.log(`Root status: ${contact.status}`);
  console.log(`Raw history in DB:`, JSON.stringify(contact.history || [], null, 2));
  console.log(`Raw attenderStates in DB:`, JSON.stringify(contact.attenderStates || {}, null, 2));
  console.log(`Raw programStates in DB:`, JSON.stringify(contact.programStates || {}, null, 2));

  console.log(`History count: ${contact.history?.length || 0}`);
  contact.history?.forEach((h, idx) => {
    const outcomeStr = String(h.status || h.callStatus || h.purposeOutcome || "").trim();
    const isUnconnected = ["Not Connected", "Not Picked Up", "Busy", "Call Cut", "Switched Off", "No Network", "NA", "no answer", "Not Attended"].some(unc => unc.toLowerCase() === outcomeStr.toLowerCase());
    console.log(`History item #${idx + 1}: calledFor="${h.calledFor}", status="${h.status}", h.pipelineStage="${h.pipelineStage}", isUnconnected=${isUnconnected}`);
  });

  // Clean history entry 2 if it had contaminated pipelineStage
  if (Array.isArray(contact.history)) {
    contact.history.forEach(h => {
      const outcomeStr = String(h.status || h.callStatus || h.purposeOutcome || "").trim();
      const isUnconnected = ["Not Connected", "Not Picked Up", "Busy", "Call Cut", "Switched Off", "No Network", "NA", "no answer", "Not Attended"].some(unc => unc.toLowerCase() === outcomeStr.toLowerCase());
      if (isUnconnected) {
        h.pipelineStage = "2. Attempting Contact";
      }
    });
  }

  const normalized = normalizeProgramStates(contact);
  console.log('\n--- NORMALIZED programs MAP THAT SHOULD BE IN DB ---');
  console.log(JSON.stringify(normalized.programs, null, 2));

  // Sync normalized programs & programStates directly into MongoDB
  if (normalized.programs && normalized.programStates) {
    const updateRes = await db.collection('contacts').updateOne(
      { _id: contact._id },
      { 
        $set: { 
          programs: normalized.programs,
          programStates: normalized.programStates,
          history: contact.history
        } 
      }
    );
    console.log(`\n✅ MongoDB Updated! Modified count: ${updateRes.modifiedCount}`);
  }

  const updatedContact = await db.collection('contacts').findOne({ _id: contact._id });
  console.log('\n--- CONFIRMED MONGODB RECORD AFTER FIX ---');
  console.log(`Yoga 1 Yr Stage: "${getEffectiveStage(updatedContact, 'Yoga 1 Yr', updatedContact.leadOwner)}"`);
  console.log(`Studya Smater Stage: "${getEffectiveStage(updatedContact, 'Studya Smater', updatedContact.leadOwner)}"`);

  await client.close();
}

main().catch(console.error);
