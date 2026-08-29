// scripts/check-mapping-match.js
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, '..', 'high_confidence_pipeline_mapping.json');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log(`Total contacts in MongoDB: ${contacts.length}`);

  // Build lookup maps for MongoDB contacts
  const byIdStr = new Map();
  const byIdField = new Map();
  const byPhone = new Map();

  for (const c of contacts) {
    const idStr = c._id.toString();
    byIdStr.set(idStr, c);
    if (c.id) byIdField.set(String(c.id), c);
    const p = (c.Phone || c.phone || '').replace(/\D/g, '');
    if (p) byPhone.set(p, c);
  }

  let matchedByIdStr = 0;
  let matchedByIdField = 0;
  let matchedByPhone = 0;
  let unmatched = [];

  for (const c of data.contacts) {
    const cid = c.contactId;
    if (byIdStr.has(cid)) {
      matchedByIdStr++;
    } else if (byIdField.has(cid)) {
      matchedByIdField++;
    } else {
      // Try stripping prefix/suffix or matching by phone
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanPhone && byPhone.has(cleanPhone)) {
        matchedByPhone++;
      } else {
        unmatched.push(c);
      }
    }
  }

  console.log(`Matched by _id string: ${matchedByIdStr}`);
  console.log(`Matched by id field:  ${matchedByIdField}`);
  console.log(`Matched by phone fallback: ${matchedByPhone}`);
  console.log(`Unmatched count: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\nSample unmatched contacts:');
    console.log(JSON.stringify(unmatched.slice(0, 5), null, 2));
  }

  await client.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
