/**
 * MIGRATION DRY-RUN SCRIPT V2 — Enhanced Evidence Report
 *
 * Categories:
 *   CONFIDENTLY_MAPPABLE — strong evidence, safe to auto-migrate
 *   AMBIGUOUS            — partial evidence, needs human review
 *   NO_EVIDENCE          — keep as Unknown / Legacy, do not guess
 *
 * CRITICAL LEGACY RULES:
 *   - Old Query → Information Given ONLY if history confirms a sales interaction.
 *   - Old follow-up → Nurture ONLY if history confirms genuine interest.
 *   - Missing pipelineStage → NOT automatically "New Lead" — stays Unknown / Legacy.
 *
 * NEVER writes to production data.
 * Run: node --env-file=.env scripts/migration-dry-run.js
 *      node --env-file=.env scripts/migration-dry-run.js --limit=100
 *      node --env-file=.env scripts/migration-dry-run.js --write   ← DANGEROUS, not yet
 */

import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable not set.');
  process.exit(1);
}

const IS_WRITE_MODE = process.argv.includes('--write');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 0;

if (IS_WRITE_MODE) {
  console.warn('\n⚠️  WRITE MODE ACTIVE — This will modify production data!');
  console.warn('   Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise(r => setTimeout(r, 5000));
}

// ── Stage rank table ───────────────────────────────────────────────────────────
const STAGE_RANKS = {
  '1. New Lead': 1, 'New Lead': 1,
  '2. Attempting Contact': 2, 'Attempting Contact': 2, 'Attempting': 2,
  '3. Information Given': 3, 'Information Given': 3, 'Info Given': 3,
  '4. Nurture / Interested': 4, 'Nurture / Interested': 4, 'Interested': 4,
  '5. Future Pool': 5, 'Future Pool': 5, 'Next Time': 5,
  '6. Registered / Won': 6, 'Registered / Won': 6, 'Reg.Done': 6, 'Registered': 6,
  'Closed / Lost': 7, 'Closed / Invalid': 7,
  'Query Desk': 3.5, 'Query': 3.5,
  'Existing Alumni': 6, 'Alumni': 6,
};

const LEGACY_NON_PIPELINE = new Set(['Query Desk', 'Existing Alumni', 'Alumni', 'Query']);

const SALES_OUTCOMES = new Set(['info given', 'info', 'interested', 'next time', 'reg.done', 'registered', 'not interested', 'not possible']);
const ALUMNI_OUTCOMES = new Set(['already reg.d', 'already registered', 'shivir done', 'shivir already done']);

function outcomeToStage(outcome) {
  const s = (outcome || '').trim().toLowerCase();
  if (s === 'info given' || s === 'info')          return '3. Information Given';
  if (s === 'interested')                           return '4. Nurture / Interested';
  if (s === 'next time')                            return '5. Future Pool';
  if (s === 'reg.done' || s === 'registered')       return '6. Registered / Won';
  if (['not interested', 'not possible'].includes(s)) return 'Closed / Lost';
  if (ALUMNI_OUTCOMES.has(s))                       return '__ALUMNI__';
  return null;
}

function isSalesEvent(h) {
  const cp = (h.callPurpose || '').toUpperCase();
  return !cp || cp === 'SALES';
}

// ── CRITICAL: Tighter classification rules ────────────────────────────────────
// Only classify as a stage if the EVIDENCE actually supports it.
// Do NOT promote based on old status alone if the status is query-related.
const QUERY_STATUSES = new Set(['query', 'pending', 'solved']);
const REMINDER_STATUSES = new Set(['reminder', 'reminder given', 'reminder confirmed']);

function isQueryOrReminderStatus(status) {
  return QUERY_STATUSES.has((status || '').toLowerCase()) ||
         REMINDER_STATUSES.has((status || '').toLowerCase());
}

function classifyContact(contact, registrationMap) {
  const id           = String(contact._id || contact.id);
  const history      = Array.isArray(contact.history) ? contact.history : [];
  const currentStage = contact.pipelineStage || null;
  const topStatus    = contact.status || '';
  const callbackDate = contact.callbackDate || null;
  const callbackStatus = contact.callbackStatus || null;
  const calledFor    = contact['Called For'] || contact.calledFor || '';
  const hasRegistration = registrationMap.has(id);

  // Evidence collector (every decision must reference evidence)
  const evidence = {
    existingPipelineStage: currentStage,
    topLevelStatus: topStatus,
    historyCount: history.length,
    salesHistoryCount: history.filter(isSalesEvent).length,
    hasRegistration,
    calledFor,
    callbackDate,
    callbackStatus,
    lastSalesOutcome: null,
    lastSalesDate: null,
    activeFollowUp: false,
    futureFollowUp: false,
    alumniPrograms: [],
    evidenceSource: 'none',
    rawEvidenceItems: [],
  };

  const now = new Date();
  const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);

  const reasons = [];
  let proposedStage = null;
  let confidence    = 'NO_EVIDENCE';
  let programRelationships = [];

  // ── Check active follow-up ─────────────────────────────────────────────────
  if (callbackDate) {
    const cbDate = new Date(callbackDate);
    if (cbDate > now && callbackStatus === 'pending') {
      evidence.futureFollowUp = true;
      evidence.activeFollowUp = true;
    }
  }

  // ── 1. Trust existing VALID V2 pipeline stage ──────────────────────────────
  if (currentStage && !LEGACY_NON_PIPELINE.has(currentStage) && STAGE_RANKS[currentStage] !== undefined) {
    proposedStage = currentStage;
    confidence    = 'CONFIDENTLY_MAPPABLE';
    evidence.evidenceSource = 'existing-valid-stage';
    reasons.push(`Existing valid V2 pipelineStage: ${currentStage}`);
  }

  // ── 2. Registration record = Registered / Won ──────────────────────────────
  if (hasRegistration) {
    const prevRank = STAGE_RANKS[proposedStage] || 0;
    if (prevRank < 6) {
      proposedStage = '6. Registered / Won';
      confidence    = 'CONFIDENTLY_MAPPABLE';
      evidence.evidenceSource = 'registration-record';
      reasons.push('Has registration record in registrations collection → Registered / Won');
    }
  }

  // ── 3. Scan SALES history for highest stage evidence ──────────────────────
  let highestSalesStage = null;
  let highestSalesRank  = 0;
  let lastSalesEventDate = null;
  let hasRecentSalesActivity = false;

  for (const h of history) {
    if (!isSalesEvent(h)) continue;

    const ts = h.timestamp ? new Date(h.timestamp) : null;
    if (ts && ts > sixMonthsAgo) hasRecentSalesActivity = true;
    if (!lastSalesEventDate || (ts && ts > new Date(lastSalesEventDate))) {
      lastSalesEventDate = h.timestamp || null;
    }

    const outcome = h.status || h.purposeOutcome || '';
    const hStage  = outcomeToStage(outcome);

    if (!hStage) continue;

    if (hStage === '__ALUMNI__' && calledFor) {
      if (!programRelationships.some(r => r.program === calledFor)) {
        programRelationships.push({ program: calledFor, status: 'Existing Alumni', updatedAt: h.timestamp || null });
        evidence.alumniPrograms.push(calledFor);
        evidence.rawEvidenceItems.push({ type: 'alumni', outcome, date: h.timestamp, calledFor });
      }
      continue;
    }

    const rank = STAGE_RANKS[hStage] || 0;
    if (rank > highestSalesRank) {
      highestSalesRank  = rank;
      highestSalesStage = hStage;
      evidence.lastSalesOutcome = outcome;
      evidence.lastSalesDate    = h.timestamp || null;
      evidence.rawEvidenceItems.push({ type: 'sales-history', outcome, stage: hStage, date: h.timestamp });
    }
  }

  evidence.lastSalesDate = lastSalesEventDate;

  if (highestSalesStage) {
    const currentRank = STAGE_RANKS[proposedStage] || 0;
    if (highestSalesRank > currentRank) {
      proposedStage = highestSalesStage;
      confidence    = 'CONFIDENTLY_MAPPABLE';
      evidence.evidenceSource = 'sales-history';
      reasons.push(`Sales history evidence highest stage: ${highestSalesStage} (outcome: ${evidence.lastSalesOutcome})`);
    }
  }

  // ── 4. Top-level status — STRICT rules ────────────────────────────────────
  // CRITICAL: Only use top-level status if it is a genuine SALES outcome.
  // NEVER promote Query/Reminder status to a pipeline stage.
  if (!proposedStage && topStatus && !isQueryOrReminderStatus(topStatus)) {
    const stageFromStatus = outcomeToStage(topStatus);
    if (stageFromStatus && stageFromStatus !== '__ALUMNI__') {
      const isRecent = hasRecentSalesActivity || evidence.futureFollowUp;
      proposedStage = stageFromStatus;
      confidence    = isRecent ? 'CONFIDENTLY_MAPPABLE' : 'AMBIGUOUS';
      evidence.evidenceSource = `top-level-status${isRecent ? '' : '-stale'}`;
      reasons.push(`Top-level status: ${topStatus} → ${stageFromStatus}${isRecent ? '' : ' (possibly stale — no recent activity)'}`);
    } else if (stageFromStatus === '__ALUMNI__' && calledFor) {
      if (!programRelationships.some(r => r.program === calledFor)) {
        programRelationships.push({ program: calledFor, status: 'Existing Alumni', updatedAt: contact.updatedAt || null });
      }
      // Status is alumni — keep stage unknown unless other evidence exists
    }
  }

  // ── 5. Legacy Query Desk contacts — strict no-promotion ───────────────────
  // RULE: Old Query → Information Given ONLY if history confirms a sales interaction.
  // If no sales history, NEVER promote to Info Given just because it's Query Desk.
  if (!proposedStage && (currentStage === 'Query Desk' || topStatus === 'Query')) {
    if (highestSalesStage) {
      // Sales history found — already handled in step 3
      reasons.push('Legacy Query Desk with sales history — stage derived from sales evidence');
    } else if (evidence.futureFollowUp) {
      // Future follow-up but no sales evidence — ambiguous
      proposedStage = 'Unknown / Legacy';
      confidence    = 'AMBIGUOUS';
      evidence.evidenceSource = 'query-desk-with-followup-no-sales';
      reasons.push('Legacy Query Desk with active follow-up but NO sales history — needs review');
    } else {
      // No evidence to promote
      proposedStage = 'Unknown / Legacy';
      confidence    = 'NO_EVIDENCE';
      evidence.evidenceSource = 'query-desk-no-evidence';
      reasons.push('Legacy Query Desk with no sales history — Unknown / Legacy');
    }
  }

  // ── 6. Active follow-up WITHOUT confirmed sales stage ─────────────────────
  // RULE: Old follow-up → Nurture ONLY if evidence supports genuine interest.
  // If evidence is insufficient, stay Unknown / Legacy.
  if (!proposedStage && evidence.activeFollowUp) {
    if (highestSalesStage) {
      proposedStage = highestSalesStage;
      confidence    = 'CONFIDENTLY_MAPPABLE';
      evidence.evidenceSource = 'followup-with-sales-evidence';
      reasons.push(`Active follow-up + sales evidence: ${highestSalesStage}`);
    } else {
      proposedStage = 'Unknown / Legacy';
      confidence    = 'AMBIGUOUS';
      evidence.evidenceSource = 'followup-no-sales-evidence';
      reasons.push('Has active follow-up but no sales outcome evidence — needs review');
    }
  }

  // ── 7. Contacts with no evidence → Unknown / Legacy ───────────────────────
  // RULE: Missing pipelineStage is NOT automatically "New Lead".
  if (!proposedStage) {
    proposedStage = 'Unknown / Legacy';
    confidence    = 'NO_EVIDENCE';
    evidence.evidenceSource = 'no-reliable-evidence';
    reasons.push('No reliable evidence found — Unknown / Legacy');
  }

  // ── 8. Derive leadOwner from existing data ────────────────────────────────
  let derivedLeadOwner     = contact.leadOwner     || null;
  let derivedLeadOwnerName = contact.leadOwnerName || null;
  if (!derivedLeadOwner) {
    const assignedTo = Array.isArray(contact.assignedTo) ? contact.assignedTo : [];
    if (assignedTo.length > 0) {
      derivedLeadOwner     = assignedTo[0];
      derivedLeadOwnerName = contact.assignedName || contact.attenderName || '';
      reasons.push(`leadOwner derived from assignedTo[0]: ${derivedLeadOwner}`);
    }
  }

  return {
    _id:  id,
    name: contact.Name || contact.name || '',
    phone: contact.Phone || contact.phone || '',
    currentPipelineStage:  currentStage || '(none)',
    proposedPipelineStage: proposedStage,
    confidence,
    reasons,
    evidence,
    programRelationships,
    leadOwner:        derivedLeadOwner,
    leadOwnerName:    derivedLeadOwnerName,
    needsLeadOwner:   !contact.leadOwner,
    calledFor,
    historyCount:     history.length,
    hasRegistration,
    hasActiveFollowUp: evidence.activeFollowUp,
  };
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  console.log('✅ Connected to MongoDB\n');

  try {
    console.log('📋 Loading registrations...');
    const allRegs = await db.collection('registrations').find({}).toArray();
    const registrationMap = new Set(allRegs.map(r => String(r.contactId)));
    console.log(`   Found ${allRegs.length} registrations for ${registrationMap.size} unique contacts.\n`);

    console.log('📋 Loading contacts...');
    const cursor = LIMIT > 0
      ? db.collection('contacts').find({}).limit(LIMIT)
      : db.collection('contacts').find({});
    const contacts = await cursor.toArray();
    console.log(`   Found ${contacts.length} contacts.\n`);

    const report = {
      generatedAt:  new Date().toISOString(),
      isDryRun:     !IS_WRITE_MODE,
      isSafeToWrite: false, // Must be explicitly reviewed before --write
      totalContacts: contacts.length,
      summary: { CONFIDENTLY_MAPPABLE: 0, AMBIGUOUS: 0, NO_EVIDENCE: 0 },
      stageProposals: {},
      classifications: [],
    };

    for (const contact of contacts) {
      const result = classifyContact(contact, registrationMap);
      report.summary[result.confidence] = (report.summary[result.confidence] || 0) + 1;
      report.stageProposals[result.proposedPipelineStage] =
        (report.stageProposals[result.proposedPipelineStage] || 0) + 1;
      report.classifications.push(result);
    }

    // ── Print summary ────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' MIGRATION DRY-RUN REPORT V2 (Enhanced Evidence)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total contacts:                ${report.totalContacts}`);
    console.log(`Confidently Mappable:          ${report.summary.CONFIDENTLY_MAPPABLE}`);
    console.log(`Ambiguous (needs review):      ${report.summary.AMBIGUOUS}`);
    console.log(`No Evidence (Unknown/Legacy):  ${report.summary.NO_EVIDENCE}`);
    console.log('\nProposed Stage Distribution:');
    Object.entries(report.stageProposals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([stage, count]) => console.log(`  ${stage.padEnd(35)} ${count}`));
    console.log('\nEvidence Source Breakdown:');
    const evidenceSources = {};
    report.classifications.forEach(c => {
      const src = c.evidence?.evidenceSource || 'unknown';
      evidenceSources[src] = (evidenceSources[src] || 0) + 1;
    });
    Object.entries(evidenceSources).sort((a, b) => b[1] - a[1])
      .forEach(([src, count]) => console.log(`  ${src.padEnd(40)} ${count}`));
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nℹ️  DRY-RUN — no data was modified.');
    console.log('   The 20 AMBIGUOUS and', report.summary.NO_EVIDENCE, 'NO_EVIDENCE contacts will NOT be auto-migrated.');
    console.log('   Re-run with --write only after reviewing the full JSON report.\n');

    // Save report
    const reportPath = path.join(__dirname, '..', 'scratch', `migration-report-v2-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report (with per-record evidence) saved to: ${reportPath}\n`);

    // ── WRITE MODE ───────────────────────────────────────────────────────────
    if (IS_WRITE_MODE) {
      const confidently = report.classifications.filter(c => c.confidence === 'CONFIDENTLY_MAPPABLE');
      console.log(`\n⚙️  Applying ${confidently.length} confident migrations...`);
      let successCount = 0, errorCount = 0;

      for (const c of confidently) {
        try {
          const contactInDb = contacts.find(x => String(x._id) === c._id);
          const existingStage = contactInDb?.pipelineStage;
          const isLegacy = !existingStage || LEGACY_NON_PIPELINE.has(existingStage) || !STAGE_RANKS[existingStage];

          const setOp = { updatedAt: new Date().toISOString() };
          if (isLegacy && c.proposedPipelineStage !== 'Unknown / Legacy') {
            setOp.pipelineStage = c.proposedPipelineStage;
          }
          if (c.needsLeadOwner && c.leadOwner) {
            setOp.leadOwner     = c.leadOwner;
            setOp.leadOwnerName = c.leadOwnerName || '';
          }
          if (!contactInDb?.ownerHistory)          setOp.ownerHistory = [];
          if (!contactInDb?.programRelationships && c.programRelationships.length > 0) {
            setOp.programRelationships = c.programRelationships;
          }

          const docId = ObjectId.isValid(c._id) ? new ObjectId(c._id) : c._id;
          await db.collection('contacts').updateOne({ _id: docId }, { $set: setOp });
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`  Error migrating ${c._id}: ${err.message}`);
        }
      }

      console.log(`\n✅ Migration complete: ${successCount} updated, ${errorCount} errors.`);
      console.log('⚠️  Ambiguous and No-Evidence contacts were NOT modified.');
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
