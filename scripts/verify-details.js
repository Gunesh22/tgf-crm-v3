// scripts/verify-details.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const backupFiles = fs.readdirSync(path.join(__dirname, '..', 'scratch'))
    .filter(f => f.startsWith('backup_before_approved_migration_'))
    .sort();

  if (backupFiles.length === 0) {
    console.log('No backup file found!');
    return;
  }

  const latestBackup = backupFiles[backupFiles.length - 1];
  const backupPath = path.join(__dirname, '..', 'scratch', latestBackup);
  console.log(`Reading backup: ${latestBackup}`);
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const verifyContacts = await db.collection('contacts').find({}).toArray();
  console.log(`Total current contacts in DB: ${verifyContacts.length}`);

  const backupMap = new Map();
  for (const c of backupData.contacts) {
    backupMap.set(c._id.toString(), c);
  }

  let leadOwnerDiffs = 0;
  let attenderIdDiffs = 0;
  let callbackDiffs = 0;
  let historyDiffs = 0;
  let assignedToDiffs = 0;

  for (const curr of verifyContacts) {
    const orig = backupMap.get(curr._id.toString());
    if (!orig) continue;

    if (String(curr.leadOwner || '') !== String(orig.leadOwner || '')) {
      leadOwnerDiffs++;
      console.log(`leadOwner diff on ${curr._id}: orig='${orig.leadOwner}' vs curr='${curr.leadOwner}'`);
    }
    if (String(curr.attenderId || '') !== String(orig.attenderId || '')) {
      attenderIdDiffs++;
      console.log(`attenderId diff on ${curr._id}: orig='${orig.attenderId}' vs curr='${curr.attenderId}'`);
    }
    if (String(curr.callbackDate || '') !== String(orig.callbackDate || '')) {
      callbackDiffs++;
      console.log(`callbackDate diff on ${curr._id}: orig='${orig.callbackDate}' vs curr='${curr.callbackDate}'`);
    }
    if ((curr.history || []).length !== (orig.history || []).length) {
      historyDiffs++;
    }
    if (JSON.stringify(curr.assignedTo || []) !== JSON.stringify(orig.assignedTo || [])) {
      assignedToDiffs++;
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Lead Owner Differences:    ${leadOwnerDiffs}`);
  console.log(`Attender ID Differences:   ${attenderIdDiffs}`);
  console.log(`Callback Date Differences: ${callbackDiffs}`);
  console.log(`History Length Diffs:     ${historyDiffs}`);
  console.log(`Assigned To Diffs:         ${assignedToDiffs}`);
  console.log('─────────────────────────────────────────');

  await client.close();
}

main().catch(console.error);
