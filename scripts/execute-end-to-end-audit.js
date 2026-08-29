// scripts/execute-end-to-end-audit.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('=== STARTING READ-ONLY END-TO-END SYSTEM AUDIT ===\n');

  const contacts = await db.collection('contacts').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  // Load pre-migration backup for baseline comparison if available
  const backupFiles = fs.readdirSync(path.join(__dirname, '..', 'scratch'))
    .filter(f => f.startsWith('backup_before_approved_migration_'))
    .sort();

  let backupData = null;
  if (backupFiles.length > 0) {
    const backupPath = path.join(__dirname, '..', 'scratch', backupFiles[backupFiles.length - 1]);
    backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`Loaded Baseline Pre-Migration Backup: ${backupFiles[backupFiles.length - 1]}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION A: ATTENDER ↔ ADMIN SYNCHRONIZATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION A: ATTENDER ↔ ADMIN SYNCHRONIZATION ---');
  
  const attenderMap = new Map();
  for (const a of attenders) {
    attenderMap.set(a.id || a._id.toString(), a.name);
  }

  // Counts by attender in Admin view (leadOwner or assignedTo)
  const adminCounts = {};
  const sheetCounts = {};

  for (const aId of attenderMap.keys()) {
    adminCounts[aId] = 0;
    sheetCounts[aId] = 0;
  }

  for (const c of contacts) {
    const assignedArr = Array.isArray(c.assignedTo) ? c.assignedTo : (c.assignedTo ? [c.assignedTo] : []);
    const leadOwnerId = c.leadOwner || c.attenderId;

    // Admin count includes all assigned to this attender ID or owned
    for (const aId of assignedArr) {
      adminCounts[aId] = (adminCounts[aId] || 0) + 1;
      sheetCounts[aId] = (sheetCounts[aId] || 0) + 1; // get-assigned query uses $or assignedTo / attenderId
    }
  }

  console.table(Object.keys(adminCounts).map(aId => ({
    'Attender ID': aId,
    'Attender Name': attenderMap.get(aId) || 'Unknown/Legacy ID',
    'Admin Count': adminCounts[aId],
    'Sheet Count': sheetCounts[aId],
    'Difference': adminCounts[aId] - sheetCounts[aId]
  })));

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION B & C: PROGRAM RELATIONSHIPS STRUCTURE & MULTI-PROGRAM PIPELINE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION B & C: PROGRAM RELATIONSHIPS STRUCTURE & MULTI-PROGRAM ---');
  
  let totalProgramRels = 0;
  let objectTypeRels = 0;
  let stringTypeRels = 0;
  let duplicateRelsCount = 0;
  let multiProgramContactsCount = 0;
  const relKeysSet = new Set();
  const sampleRelStructures = [];

  for (const c of contacts) {
    const rels = c.programRelationships || [];
    if (rels.length > 1) multiProgramContactsCount++;

    const contactKeys = new Set();
    for (const r of rels) {
      totalProgramRels++;
      if (typeof r === 'object' && r !== null) {
        objectTypeRels++;
        if (sampleRelStructures.length < 3) {
          sampleRelStructures.push(r);
        }
      } else {
        stringTypeRels++;
      }

      const key = `${c._id}|${r.calledForKey || r.program}`;
      if (contactKeys.has(key)) {
        duplicateRelsCount++;
      }
      contactKeys.add(key);
      relKeysSet.add(key);
    }
  }

  console.log(`Total Contacts with programRelationships: ${contacts.filter(c => (c.programRelationships || []).length > 0).length}`);
  console.log(`Total Program Relationship Records:        ${totalProgramRels}`);
  console.log(`Object Structure Rels:                     ${objectTypeRels}`);
  console.log(`String Structure Rels:                     ${stringTypeRels}`);
  console.log(`Multi-Program Contacts (>1 program):       ${multiProgramContactsCount}`);
  console.log(`Duplicate Program Relationships:           ${duplicateRelsCount}`);
  console.log('\nSample Database `programRelationships` Object Schema:');
  console.log(JSON.stringify(sampleRelStructures[0], null, 2));

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION E: CALL HISTORY INTEGRITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION E: CALL HISTORY INTEGRITY ---');
  let totalCallEventsCurrent = 0;
  for (const c of contacts) {
    totalCallEventsCurrent += (c.history || []).length;
  }

  let totalCallEventsBackup = 0;
  if (backupData) {
    for (const c of backupData.contacts) {
      totalCallEventsBackup += (c.history || []).length;
    }
  }

  console.log(`Total Call Events in Current DB:  ${totalCallEventsCurrent}`);
  if (backupData) {
    console.log(`Total Call Events in Backup:      ${totalCallEventsBackup}`);
    console.log(`Call Event Count Difference:      ${totalCallEventsCurrent - totalCallEventsBackup}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION F: PIPELINE COUNT RECONCILIATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION F: PIPELINE COUNT RECONCILIATION ---');
  const stageCountsDb = {};
  for (const c of contacts) {
    const stage = c.pipelineStage || '(none)';
    stageCountsDb[stage] = (stageCountsDb[stage] || 0) + 1;
  }

  console.table(Object.entries(stageCountsDb).map(([stage, count]) => ({
    'Stage': stage,
    'MongoDB Count': count,
  })));

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION G: REGISTRATION INTEGRITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION G: REGISTRATION INTEGRITY ---');
  console.log(`Total Documents in Registrations Collection: ${registrations.length}`);
  const regUniqueKeys = new Set(registrations.map(r => `${r.contactId}|${r.calledForKey}`));
  console.log(`Unique contactId + calledForKey Registrations: ${regUniqueKeys.size}`);
  console.log(`Duplicate Registrations in Collection:        ${registrations.length - regUniqueKeys.size}`);

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION I: LEGACY / UNKNOWN CONTACTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION I: LEGACY CONTACTS ---');
  const legacyContacts = contacts.filter(c => !c.pipelineStage || c.pipelineStage === '(none)' || c.pipelineStage === 'Unknown / Legacy');
  console.log(`Contacts in Unknown / Legacy: ${legacyContacts.length}`);

  await client.close();
}

main().catch(console.error);
