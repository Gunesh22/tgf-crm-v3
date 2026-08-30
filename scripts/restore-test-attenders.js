// scripts/restore-test-attenders.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function restoreTestAttenders() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const attendersCol = db.collection('attenders');

  console.log('====================================================');
  console.log('RESTOURING TEST & TEST 2 MASTER ATTENDER RECORDS');
  console.log('====================================================\n');

  const testAttenders = [
    {
      id: 'JW20HztSjMfwNbVaCpxz',
      name: 'Test',
      role: 'attender',
      password: '123456',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'hbMzjgMkmYa0D6ysM9RA',
      name: 'Test 2',
      role: 'attender',
      password: '123456',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  for (const att of testAttenders) {
    const existing = await attendersCol.findOne({ id: att.id });
    if (existing) {
      console.log(`- Attender record "${att.name}" (${att.id}) already exists in DB.`);
    } else {
      const res = await attendersCol.insertOne(att);
      console.log(`+ Restored attender record "${att.name}" (${att.id}) -> Inserted _id: ${res.insertedId}`);
    }
  }

  const allAttenders = await attendersCol.find({}).toArray();
  console.log(`\nTotal Attenders in DB after restoration: ${allAttenders.length}`);
  console.table(allAttenders.map(a => ({ ID: a.id, Name: a.name, Role: a.role, Active: a.isActive })));

  await client.close();
}

restoreTestAttenders().catch(console.error);
