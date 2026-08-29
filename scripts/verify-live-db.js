// scripts/verify-live-db.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contactsWithRels = await db.collection('contacts').countDocuments({
    'programRelationships.0': { $exists: true }
  });

  const totalContacts = await db.collection('contacts').countDocuments({});
  const totalRegistrations = await db.collection('registrations').countDocuments({});

  const stageCounts = await db.collection('contacts').aggregate([
    { $group: { _id: '$pipelineStage', count: { $sum: 1 } } }
  ]).toArray();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' LIVE MONGODB REAL-TIME VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Database Name:                             tgf_crm`);
  console.log(`Total Contacts in DB:                      ${totalContacts}`);
  console.log(`Contacts with Migrated programRelationships:${contactsWithRels}`);
  console.log(`Total Records in Registrations Collection: ${totalRegistrations}`);
  console.log('\nPipeline Stage Breakdown in Live DB:');
  for (const s of stageCounts) {
    console.log(`  ${(s._id || '(none)').padEnd(30)} ${s.count}`);
  }
  console.log('═══════════════════════════════════════════════════════════');

  await client.close();
}

main().catch(console.error);
