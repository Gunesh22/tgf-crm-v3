// scripts/get-8-contact-details.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const ids = [
    "RaG3sWwQLDN0uss1tUOX",
    "R2B06jFNhO4LN1wrb9hH",
    "sHG3yk8fbmrf4I9m2pa5",
    "MHqqyNyCnOg9yqWBFfeI",
    "yqzYgpEvlX5oYctpmXHn",
    "n0f2jzGIFONZBdnYp8oZ",
    "kYzR74X3duUvHvKFMatC",
    "qOLmnoEWQyhrgKfjdxZs"
  ];

  const contacts = await db.collection('contacts').find({ _id: { $in: ids } }).toArray();
  // Also try string id search in case _id is ObjectId or string
  if (contacts.length < 8) {
    const all = await db.collection('contacts').find({}).toArray();
    const matched = all.filter(c => ids.includes(String(c._id)) || ids.includes(c.id));
    console.log(JSON.stringify(matched, null, 2));
  } else {
    console.log(JSON.stringify(contacts, null, 2));
  }

  await client.close();
}

main().catch(console.error);
