// scripts/debug-unmatched.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const names = ['Amrendra Kumar', 'Santosh Gangurde', 'Rashmee Pruthviraj Shah', 'Anand Kumar'];
  const phones = ['9890567001', '9021335725', '9423149722'];

  console.log('Searching by name/phone regex in MongoDB...');
  for (const n of names) {
    const res = await db.collection('contacts').find({
      $or: [
        { Name: { $regex: n, $options: 'i' } },
        { name: { $regex: n, $options: 'i' } }
      ]
    }).toArray();
    console.log(`\nName search "${n}": found ${res.length}`);
    for (const r of res) {
      console.log(`  _id: ${r._id} | id: ${r.id} | Name: ${r.Name || r.name} | Phone: ${r.Phone || r.phone}`);
    }
  }

  for (const p of phones) {
    const res = await db.collection('contacts').find({
      $or: [
        { Phone: { $regex: p } },
        { phone: { $regex: p } },
        { Mobile: { $regex: p } },
        { mobile: { $regex: p } }
      ]
    }).toArray();
    console.log(`\nPhone search "${p}": found ${res.length}`);
    for (const r of res) {
      console.log(`  _id: ${r._id} | id: ${r.id} | Name: ${r.Name || r.name} | Phone: ${r.Phone || r.phone}`);
    }
  }

  await client.close();
}

main().catch(console.error);
