// scripts/check-mapping-match-v2.js
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, '..', 'high_confidence_pipeline_mapping.json');

const MONGODB_URI = process.env.MONGODB_URI;
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function normalizePhone(p) {
  if (!p) return '';
  let digits = String(p).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log(`Total contacts in MongoDB: ${contacts.length}`);

  // Lookups
  const byObjectId = new Map();
  const byIdField = new Map();
  const byNormalizedPhone = new Map();

  for (const c of contacts) {
    const oid = c._id.toString();
    byObjectId.set(oid, c);

    if (c.id) byIdField.set(String(c.id), c);

    const p1 = normalizePhone(c.Phone || c.phone);
    const p2 = normalizePhone(c.Mobile || c.mobile);
    if (p1 && p1.length >= 10) byNormalizedPhone.set(p1.slice(-10), c);
    if (p2 && p2.length >= 10) byNormalizedPhone.set(p2.slice(-10), c);
  }

  let directIdMatch = 0;
  let compositeIdMatch = 0;
  let phoneMatch = 0;
  let nameMatch = 0;
  let totallyUnmatched = [];

  for (const item of data.contacts) {
    const cid = item.contactId;

    // 1. Direct ObjectId match
    if (byObjectId.has(cid)) {
      directIdMatch++;
      continue;
    }

    // 2. Composite ID match (e.g. "TynjXxF0yMv1NMvqmrNj_WbND9Oa4yPUuWXVyibb3")
    const baseId = cid.split('_')[0];
    if (byObjectId.has(baseId)) {
      compositeIdMatch++;
      continue;
    }

    // 3. id field match
    if (byIdField.has(cid) || byIdField.has(baseId)) {
      directIdMatch++;
      continue;
    }

    // 4. Normalized Phone Match (last 10 digits)
    const normP = normalizePhone(item.phone);
    if (normP && normP.length >= 10 && byNormalizedPhone.has(normP.slice(-10))) {
      phoneMatch++;
      continue;
    }

    totallyUnmatched.push(item);
  }

  console.log('─────────────────────────────────────────');
  console.log(`Direct _id / id match:     ${directIdMatch}`);
  console.log(`Composite _id split match: ${compositeIdMatch}`);
  console.log(`Normalized Phone match:    ${phoneMatch}`);
  console.log(`Total Mappable:            ${directIdMatch + compositeIdMatch + phoneMatch}`);
  console.log(`Totally Unmatched:         ${totallyUnmatched.length}`);
  console.log('─────────────────────────────────────────');

  if (totallyUnmatched.length > 0) {
    console.log('\nSample Totally Unmatched Contacts from JSON:');
    for (const u of totallyUnmatched.slice(0, 5)) {
      console.log(`- ID: ${u.contactId} | Name: ${u.name} | Phone: ${u.phone}`);
    }
  }

  await client.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
