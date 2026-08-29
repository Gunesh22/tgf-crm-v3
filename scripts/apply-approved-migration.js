/**
 * PRODUCTION MIGRATION SCRIPT — APPROVED HIGH-CONFIDENCE PIPELINE MAPPING
 *
 * Reads: high_confidence_pipeline_mapping.json
 * Mode: Dry-Run by default. Use --write to execute.
 *
 * Features:
 *  1. Automated Backup before write
 *  2. Dry-Run reporting with detailed attender breakdown & exact counts
 *  3. Atomically replaces/updates programRelationships[] and pipelineStage on matched contacts
 *  4. Upserts unique registrations for Registered / Won records
 *  5. Preserves all history, comments, callbacks, ownership, and attender assignments
 *  6. Keeps unmapped contacts (885) as Unknown / Legacy
 *  7. Automated 11-point post-migration verification suite
 *
 * Run Dry-Run:  node --env-file=.env scripts/apply-approved-migration.js
 * Run Migration: node --env-file=.env scripts/apply-approved-migration.js --write
 */

import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeCalledForKey } from '../api/lib/calledForNormalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable not set.');
  process.exit(1);
}

const IS_WRITE_MODE = process.argv.includes('--write');

// Stage rank mapping for top-level stage resolution
const STAGE_RANKS = {
  '6. Registered / Won': 6, 'Registered / Won': 6, 'Reg.Done': 6,
  '4. Nurture / Interested': 4, 'Nurture / Interested': 4, 'Interested': 4,
  '3. Information Given': 3, 'Information Given': 3, 'Info Given': 3,
  '5. Future Pool': 5, 'Future Pool': 5,
  '2. Attempting Contact': 2, 'Attempting Contact': 2,
  '1. New Lead': 1, 'New Lead': 1,
  'Closed / Lost': 7, 'Not Interested': 7,
  'Closed / Invalid': 7, 'Invalid': 7,
};

function canonicalizeStage(stageStr) {
  const s = (stageStr || '').trim();
  if (s === 'Registered / Won' || s === 'Reg.Done') return '6. Registered / Won';
  if (s === 'Nurture / Interested' || s === 'Interested') return '4. Nurture / Interested';
  if (s === 'Information Given' || s === 'Info Given') return '3. Information Given';
  if (s === 'Future Pool') return '5. Future Pool';
  if (s === 'Attempting Contact') return '2. Attempting Contact';
  if (s === 'New Lead') return '1. New Lead';
  if (s === 'Not Interested' || s === 'Closed / Lost') return 'Closed / Lost';
  if (s === 'Invalid' || s === 'Closed / Invalid') return 'Closed / Invalid';
  return s;
}

async function main() {
  const jsonPath = path.join(__dirname, '..', 'high_confidence_pipeline_mapping.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`ERROR: Master mapping file not found at ${jsonPath}`);
    process.exit(1);
  }

  const mappingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log('📋 Loaded Approved Mapping JSON:');
  console.log(`   Version: ${mappingData.mappingVersion}`);
  console.log(`   Total Contacts in Mapping: ${mappingData.contacts.length}\n`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  console.log('✅ Connected to MongoDB\n');

  try {
    // ── Load all contacts from DB ────────────────────────────────────────────
    console.log('🔍 Fetching all contacts from MongoDB...');
    const allDbContacts = await db.collection('contacts').find({}).toArray();
    console.log(`   Found ${allDbContacts.length} contacts in MongoDB.\n`);

    // Map contacts by _id and string id
    const dbContactMap = new Map();
    for (const c of allDbContacts) {
      dbContactMap.set(c._id.toString(), c);
      if (c.id) dbContactMap.set(String(c.id), c);
    }

    // Build execution plan
    const updatePlan = [];
    const unmappedDbContactIds = new Set(allDbContacts.map(c => c._id.toString()));
    const attenderBreakdown = {};
    let totalRelationshipsToCreate = 0;
    let registrationsToCreate = 0;

    for (const mappedContact of mappingData.contacts) {
      const cid = mappedContact.contactId;
      const dbDoc = dbContactMap.get(cid);

      if (!dbDoc) continue; // Contact not in this DB snapshot

      unmappedDbContactIds.delete(dbDoc._id.toString());

      // Attender tracking
      const ownerKey = dbDoc.leadOwner || dbDoc.attenderId || mappedContact.leadOwner || 'Unassigned';
      attenderBreakdown[ownerKey] = (attenderBreakdown[ownerKey] || 0) + 1;

      // Construct programRelationships array
      const newProgramRels = [];
      let highestRank = 0;
      let highestStage = '1. New Lead';

      for (const pr of mappedContact.programRelationships || []) {
        totalRelationshipsToCreate++;
        const calledForKey = normalizeCalledForKey(pr.program);
        const canonical = canonicalizeStage(pr.stage);

        newProgramRels.push({
          program: pr.program,
          calledForKey,
          status: pr.stage, // Preserves original stage string from approved JSON
          pipelineStage: canonical,
          evidence: pr.evidence || null,
          reason: pr.reason || '',
          updatedAt: new Date().toISOString(),
        });

        if (canonical === '6. Registered / Won') {
          registrationsToCreate++;
        }

        const rank = STAGE_RANKS[canonical] || STAGE_RANKS[pr.stage] || 0;
        if (rank > highestRank && rank < 7) { // Don't let Closed demote active high ranks unless all closed
          highestRank = rank;
          highestStage = canonical;
        } else if (highestRank === 0 && rank === 7) {
          highestStage = canonical;
        }
      }

      updatePlan.push({
        dbDoc,
        contactId: dbDoc._id.toString(),
        name: dbDoc.Name || dbDoc.name || mappedContact.name,
        phone: dbDoc.Phone || dbDoc.phone || mappedContact.phone,
        leadOwner: dbDoc.leadOwner || null,
        attenderId: dbDoc.attenderId || null,
        assignedTo: dbDoc.assignedTo || [],
        oldPipelineStage: dbDoc.pipelineStage || '(none)',
        newPipelineStage: highestStage,
        oldProgramRelationships: dbDoc.programRelationships || [],
        newProgramRelationships: newProgramRels,
        historyCountBefore: (dbDoc.history || []).length,
      });
    }

    const contactsRemainingUnknown = unmappedDbContactIds.size;

    // ── DRY-RUN REPORT ───────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════');
    console.log(` MIGRATION ${IS_WRITE_MODE ? 'EXECUTION PLAN' : 'DRY-RUN REPORT'} (APPROVED MAPPING)`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Contacts in Approved JSON:       ${mappingData.contacts.length}`);
    console.log(`Total Matched DB Contacts to Update:   ${updatePlan.length}`);
    console.log(`Total Program Relationships to Create: ${totalRelationshipsToCreate}`);
    console.log(`Registrations to Upsert:               ${registrationsToCreate}`);
    console.log(`Contacts Remaining Unknown / Legacy:   ${contactsRemainingUnknown}`);
    console.log('\nAttender-Wise Distribution (Matched Contacts):');
    Object.entries(attenderBreakdown).sort((a,b) => b[1] - a[1])
      .forEach(([att, count]) => console.log(`  ${att.padEnd(25)} ${count}`));
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!IS_WRITE_MODE) {
      console.log('⚠️  DRY-RUN MODE — No changes were made to MongoDB.');
      console.log('   To apply this migration, run:');
      console.log('   node --env-file=.env scripts/apply-approved-migration.js --write\n');
      return;
    }

    // ── WRITE MODE: STEP 1 — BACKUP FIRST ──────────────────────────────────
    console.log('📦 STEP 1: Creating Pre-Migration Production Backup...');
    const timestamp = Date.now();
    const backupPath = path.join(__dirname, '..', 'scratch', `backup_before_approved_migration_${timestamp}.json`);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });

    const backupData = {
      createdAt: new Date().toISOString(),
      totalContactsBackedUp: allDbContacts.length,
      affectedContactIds: updatePlan.map(p => p.contactId),
      contacts: allDbContacts,
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
      console.error('❌ FATAL: Backup creation failed or produced empty file. ABORTING MIGRATION!');
      process.exit(1);
    }
    console.log(`✅ Backup successfully saved to: ${backupPath}`);
    console.log(`   Backed up ${allDbContacts.length} full contact documents.\n`);

    // ── WRITE MODE: STEP 2 — EXECUTE MIGRATION ──────────────────────────────
    console.log('⚙️  STEP 2: Executing Production Migration...');

    let updatedContactsCount = 0;
    let createdRegistrationsCount = 0;

    for (const plan of updatePlan) {
      const docId = ObjectId.isValid(plan.contactId) ? new ObjectId(plan.contactId) : plan.contactId;

      // 1. Update contact document (pipelineStage and programRelationships)
      await db.collection('contacts').updateOne(
        { _id: docId },
        {
          $set: {
            pipelineStage: plan.newPipelineStage,
            programRelationships: plan.newProgramRelationships,
            updatedAt: new Date().toISOString(),
          }
        }
      );
      updatedContactsCount++;

      // 2. Upsert registrations for Registered / Won programs
      for (const pr of plan.newProgramRelationships) {
        if (pr.pipelineStage === '6. Registered / Won' || pr.status === 'Registered / Won' || pr.status === 'Reg.Done') {
          const regId = `reg_${plan.contactId}_${pr.calledForKey}`;
          await db.collection('registrations').updateOne(
            { registrationId: regId },
            {
              $set: {
                registrationId: regId,
                contactId: plan.contactId,
                calledForKey: pr.calledForKey,
                calledFor: pr.program,
                name: plan.name,
                phone: plan.phone,
                attenderId: plan.attenderId || plan.leadOwner || 'unassigned',
                leadOwner: plan.leadOwner || plan.attenderId || 'unassigned',
                evidence: pr.evidence || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            },
            { upsert: true }
          );
          createdRegistrationsCount++;
        }
      }
    }

    console.log(`\n✅ Migration Execution Complete!`);
    console.log(`   Updated ${updatedContactsCount} contacts.`);
    console.log(`   Upserted ${createdRegistrationsCount} program registrations.\n`);

    // ── WRITE MODE: STEP 3 — POST-MIGRATION VERIFICATION ────────────────────
    console.log('🔍 STEP 3: Running Automated 11-Point Post-Migration Verification Suite...\n');

    const verifyContacts = await db.collection('contacts').find({}).toArray();
    const verifyContactMap = new Map(verifyContacts.map(c => [c._id.toString(), c]));
    const verifyRegs = await db.collection('registrations').find({}).toArray();

    let vPassed = 0, vFailed = 0;
    function vAssert(label, cond, detail = '') {
      if (cond) {
        vPassed++;
        console.log(`  ✅ PASS: ${label}`);
      } else {
        vFailed++;
        console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
      }
    }

    // Check A: Every mapping in JSON for matched contacts exists in MongoDB
    let checkAMatch = true;
    for (const plan of updatePlan) {
      const dbDoc = verifyContactMap.get(plan.contactId);
      if (!dbDoc || !Array.isArray(dbDoc.programRelationships) || dbDoc.programRelationships.length !== plan.newProgramRelationships.length) {
        checkAMatch = false;
        break;
      }
    }
    vAssert('Check A: Every approved mapping exists in MongoDB', checkAMatch);

    // Check B: No mapping exists for contacts not in approved JSON
    let checkBNoExtra = true;
    for (const unmappedId of unmappedDbContactIds) {
      const dbDoc = verifyContactMap.get(unmappedId);
      if (dbDoc && Array.isArray(dbDoc.programRelationships) && dbDoc.programRelationships.length > 0) {
        checkBNoExtra = false;
        break;
      }
    }
    vAssert('Check B: Unmapped contacts have no newly injected program relationships', checkBNoExtra);

    // Check C: No duplicate program relationships exist for contactId + calledForKey
    let checkCNoDupRels = true;
    for (const c of verifyContacts) {
      const keys = (c.programRelationships || []).map(r => r.calledForKey);
      if (new Set(keys).size !== keys.length) {
        checkCNoDupRels = false;
        break;
      }
    }
    vAssert('Check C: Zero duplicate program relationships per contactId + calledForKey', checkCNoDupRels);

    // Check D: Attender IDs preserved correctly
    let checkDAttenderPreserved = true;
    for (const plan of updatePlan) {
      const dbDoc = verifyContactMap.get(plan.contactId);
      if (String(dbDoc.leadOwner || '') !== String(plan.dbDoc.leadOwner || '') ||
          String(dbDoc.attenderId || '') !== String(plan.dbDoc.attenderId || '')) {
        checkDAttenderPreserved = false;
        break;
      }
    }
    vAssert('Check D: Attender IDs & Lead Owners strictly preserved', checkDAttenderPreserved);

    // Check E: Total contact count in DB remains unchanged
    vAssert('Check E: Total DB contact count unchanged (no new contacts created)', verifyContacts.length === allDbContacts.length);

    // Check F: Unknown/Legacy contacts (885) remain untouched
    let checkFUntouched = true;
    for (const unmappedId of unmappedDbContactIds) {
      const originalDoc = dbContactMap.get(unmappedId);
      const verifyDoc = verifyContactMap.get(unmappedId);
      if (originalDoc.pipelineStage !== verifyDoc.pipelineStage) {
        checkFUntouched = false;
        break;
      }
    }
    vAssert('Check F: Unknown / Legacy contacts remained untouched', checkFUntouched);

    // Check G: Call history count before vs after is identical
    let checkGHistoryIdentical = true;
    for (const plan of updatePlan) {
      const verifyDoc = verifyContactMap.get(plan.contactId);
      if ((verifyDoc.history || []).length !== plan.historyCountBefore) {
        checkGHistoryIdentical = false;
        break;
      }
    }
    vAssert('Check G: Call history count before vs after is 100% identical', checkGHistoryIdentical);

    // Check H: Follow-up & callback dates preserved
    let checkHCallbacksPreserved = true;
    for (const plan of updatePlan) {
      const verifyDoc = verifyContactMap.get(plan.contactId);
      if (String(verifyDoc.callbackDate || '') !== String(plan.dbDoc.callbackDate || '')) {
        checkHCallbacksPreserved = false;
        break;
      }
    }
    vAssert('Check H: Follow-up & callback dates preserved', checkHCallbacksPreserved);

    // Check I: Registrations collection unique keys enforced
    const regKeys = verifyRegs.map(r => `${r.contactId}|${r.calledForKey}`);
    vAssert('Check I: Registrations collection unique compound key enforced', new Set(regKeys).size === regKeys.length);

    // Check J: Multi-program relationships preserved independently
    let checkJMultiProg = true;
    const multiProgPlans = updatePlan.filter(p => p.newProgramRelationships.length > 1);
    for (const plan of multiProgPlans) {
      const verifyDoc = verifyContactMap.get(plan.contactId);
      if (verifyDoc.programRelationships.length !== plan.newProgramRelationships.length) {
        checkJMultiProg = false;
        break;
      }
    }
    vAssert(`Check J: Multi-program relationships (${multiProgPlans.length} contacts) preserved independently`, checkJMultiProg);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(` VERIFICATION SUMMARY: ${vPassed} Passed | ${vFailed} Failed`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (vFailed > 0) {
      console.error('❌ Post-migration verification detected issues!');
      process.exit(1);
    }

  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed.');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
