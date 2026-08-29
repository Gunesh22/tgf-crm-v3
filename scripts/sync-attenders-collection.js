// scripts/sync-attenders-collection.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

const DEFAULT_ATTENDERS = [
  { id: "9VZZnV00X63PzUSaGTgq", name: "Manisha", role: "attender", password: "629001", isActive: true },
  { id: "E5Vy71mpJ7cQIw3acQgEm", name: "Sheetal Marne", role: "attender", password: "121313", isActive: true },
  { id: "VN6h9vevwXpXU0UXm5IQ", name: "Aparna Mule", role: "attender", password: "121312", isActive: true },
  { id: "WbND9Oa4yPUuWXVyibb3", name: "Geeta", role: "attender", password: "198291", isActive: true },
  { id: "ZJQsev2aLqi2ispr3j74", name: "Priyanka", role: "attender", password: "706321", isActive: true },
  { id: "a82GcDWY69r6k936b4GC", name: "Vaishali Golande", role: "attender", password: "121314", isActive: true },
  { id: "IrAgizMZzxqzUbJjHIBI", name: "Rakhi", role: "attender", password: "697984", isActive: true },
  { id: "o1FPWNvI7HO4O2ylSuZm", name: "Sreeja", role: "attender", password: "646080", isActive: true },
  { id: "pKfAHuc7UODJ8aOB1luFY", name: "Dipika", role: "attender", password: "121311", isActive: true }
];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('Replacing attenders collection with canonical master attender list...');
  await db.collection('attenders').deleteMany({});
  await db.collection('attenders').insertMany(DEFAULT_ATTENDERS);

  const res = await db.collection('attenders').find({}).toArray();
  console.log(`✅ Updated attenders collection. Current count: ${res.length}`);
  console.log(res);

  await client.close();
}

main().catch(console.error);
