/**
 * REGISTRATION RECONCILIATION REPORT — Read-Only
 *
 * Scans all contacts for historical Reg.Done evidence and cross-references
 * against the registrations collection. Produces a grouped JSON report.
 *
 * Groups:
 *   A. VALID_HISTORICAL   — clear Reg.Done evidence, no existing registration record
 *   B. DUPLICATE          — multiple Reg.Done events for same contactId+calledForKey
 *   C. ALREADY_EXISTS     — registration record already exists in registrations collection
 *   D. AMBIGUOUS          — uncertain evidence (e.g., no calledFor, conflicting data)
 *   E. INSUFFICIENT       — Reg.Done status found but no supporting evidence
 *
 * DOES NOT write, create, or delete anything.
 * Run: node --env-file=.env scripts/reg-reconciliation.js
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

function normalizeKey(val) {
  if (!val || typeof val !== 'string') return 'general';
  return val.trim().toLowerCase().replace(/[\s_-]+/g, '-');
}

// Indicators that a Reg.Done event is a genuine registration
const REG_DONE_VALUES = new Set([
  'reg.done', 'registered', 'registration done', 'reg done',
]);

function isRegDone(status) {
  return REG_DONE_VALUES.has(String(status || '').trim().toLowerCase());
}

// A "sales" history item — only count those with callPurpose SALES or absent
function isSalesEvent(h) {
  const cp = (h.callPurpose || '').toUpperCase();
  return !cp || cp === 'SALES';
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('✅ Connected to MongoDB (READ-ONLY mode)\n');

  const db = client.db('tgf_crm');

  try {
    // ── Load all existing registrations for lookup ────────────────────────────
    console.log('📋 Loading existing registrations...');
    const existingRegs = await db.collection('registrations').find({}).toArray();
    // Key: contactId|calledForKey
    const regByKey = new Map();
    for (const r of existingRegs) {
      const k = `${r.contactId}|${r.calledForKey || normalizeKey(r.calledFor)}`;
      regByKey.set(k, r);
    }
    console.log(`   Existing registrations: ${existingRegs.length}\n`);

    // ── Load contacts that may have Reg.Done evidence ─────────────────────────
    console.log('📋 Scanning contacts for Reg.Done evidence...');
    const contacts = await db.collection('contacts').find({}).toArray();
    console.log(`   Total contacts: ${contacts.length}\n`);

    const report = {
      generatedAt: new Date().toISOString(),
      readOnly: true,
      nothingWasWritten: true,
      totalContactsScanned: contacts.length,
      existingRegistrationCount: existingRegs.length,
      summary: { A_VALID_HISTORICAL: 0, B_DUPLICATE: 0, C_ALREADY_EXISTS: 0, D_AMBIGUOUS: 0, E_INSUFFICIENT: 0 },
      groups: { A_VALID_HISTORICAL: [], B_DUPLICATE: [], C_ALREADY_EXISTS: [], D_AMBIGUOUS: [], E_INSUFFICIENT: [] },
    };

    for (const contact of contacts) {
      const contactId  = String(contact._id || contact.id);
      const name       = contact.Name || contact.name || '';
      const phone      = contact.Phone || contact.phone || '';
      const history    = Array.isArray(contact.history) ? contact.history : [];
      const topStatus  = contact.status || '';
      const topCalledFor = contact['Called For'] || contact.calledFor || '';

      // Collect all Reg.Done events from history[]
      const regDoneEvents = history.filter(
        h => isSalesEvent(h) && isRegDone(h.status || h.purposeOutcome)
      ).map(h => ({
        callId:        h.callId || h.id || null,
        status:        h.status || h.purposeOutcome || '',
        calledFor:     h.calledFor || h['Called For'] || topCalledFor || '',
        calledForKey:  normalizeKey(h.calledFor || h['Called For'] || topCalledFor || ''),
        date:          h.timestamp || null,
        attenderId:    h.attenderId || '',
        attenderName:  h.attenderName || '',
        remark:        h.remark || '',
        callDirection: h.callDirection || h.callType || 'outgoing',
      }));

      // Also check top-level status
      const hasTopLevelRegDone = isRegDone(topStatus);

      if (regDoneEvents.length === 0 && !hasTopLevelRegDone) continue; // No reg evidence

      // If only top-level status, create synthetic event
      if (regDoneEvents.length === 0 && hasTopLevelRegDone) {
        const calledForKey = normalizeKey(topCalledFor);
        const regKey = `${contactId}|${calledForKey}`;
        const existingReg = regByKey.get(regKey);

        const entry = {
          contactId,
          name,
          phone,
          calledFor: topCalledFor || '(none)',
          calledForKey,
          source: 'top-level-status-only',
          regDoneDate: contact.updatedAt || contact.createdAt || null,
          callId: null,
          remark: contact.remark || '',
          existingRegistration: existingReg ? { id: existingReg._id, registrationId: existingReg.registrationId } : null,
          notes: 'Reg.Done found only in top-level status field — no history event',
        };

        if (existingReg) {
          report.summary.C_ALREADY_EXISTS++;
          report.groups.C_ALREADY_EXISTS.push({ ...entry, group: 'C_ALREADY_EXISTS' });
        } else if (!topCalledFor) {
          report.summary.E_INSUFFICIENT++;
          report.groups.E_INSUFFICIENT.push({ ...entry, group: 'E_INSUFFICIENT', reason: 'No calledFor / program identified' });
        } else {
          report.summary.D_AMBIGUOUS++;
          report.groups.D_AMBIGUOUS.push({ ...entry, group: 'D_AMBIGUOUS', reason: 'Top-level status only, no call history event' });
        }
        continue;
      }

      // Group Reg.Done events by calledForKey
      const byKey = {};
      for (const evt of regDoneEvents) {
        const k = evt.calledForKey || 'general';
        if (!byKey[k]) byKey[k] = [];
        byKey[k].push(evt);
      }

      for (const [calledForKey, events] of Object.entries(byKey)) {
        const calledFor   = events[0].calledFor || '';
        const regKey      = `${contactId}|${calledForKey}`;
        const existingReg = regByKey.get(regKey);
        const isDuplicate = events.length > 1;

        // Sort events by date
        events.sort((a, b) => {
          const da = a.date ? new Date(a.date) : new Date(0);
          const db = b.date ? new Date(b.date) : new Date(0);
          return da - db;
        });

        const firstEvent = events[0];
        const latestEvent = events[events.length - 1];

        const entry = {
          contactId,
          name,
          phone,
          calledFor: calledFor || '(none)',
          calledForKey,
          regDoneEventCount: events.length,
          firstRegDoneDate:  firstEvent.date,
          latestRegDoneDate: latestEvent.date,
          firstCallId:       firstEvent.callId,
          latestCallId:      latestEvent.callId,
          attenderId:        firstEvent.attenderId,
          attenderName:      firstEvent.attenderName,
          remark:            firstEvent.remark,
          allEvents: events.map(e => ({
            callId: e.callId,
            date: e.date,
            calledFor: e.calledFor,
            attenderId: e.attenderId,
            remark: e.remark,
          })),
          existingRegistration: existingReg
            ? { id: String(existingReg._id), registrationId: existingReg.registrationId, createdAt: existingReg.createdAt }
            : null,
        };

        // Classify
        if (existingReg && !isDuplicate) {
          // Already in registrations collection
          report.summary.C_ALREADY_EXISTS++;
          report.groups.C_ALREADY_EXISTS.push({ ...entry, group: 'C_ALREADY_EXISTS' });
        } else if (isDuplicate) {
          // Multiple Reg.Done events for same contact+program
          report.summary.B_DUPLICATE++;
          report.groups.B_DUPLICATE.push({
            ...entry,
            group: 'B_DUPLICATE',
            recommendation: existingReg
              ? 'Already has registration record — duplicates are harmless but flag for review'
              : 'Multiple Reg.Done events — use earliest as canonical; review for re-registrations',
          });
        } else if (!calledFor || calledForKey === 'general') {
          // No program identified
          report.summary.E_INSUFFICIENT++;
          report.groups.E_INSUFFICIENT.push({
            ...entry,
            group: 'E_INSUFFICIENT',
            reason: 'No calledFor / program identified — cannot determine which program',
          });
        } else {
          // Clear, single, unregistered Reg.Done event — valid historical registration
          report.summary.A_VALID_HISTORICAL++;
          report.groups.A_VALID_HISTORICAL.push({
            ...entry,
            group: 'A_VALID_HISTORICAL',
            proposal: `Create registration: contactId=${contactId}, calledFor=${calledFor}`,
            requiresManualApproval: true,
          });
        }
      }
    }

    // ── Print summary ─────────────────────────────────────────────────────────
    const total = Object.values(report.summary).reduce((a, b) => a + b, 0);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' REGISTRATION RECONCILIATION REPORT (READ-ONLY)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Contacts scanned:                      ${report.totalContactsScanned}`);
    console.log(`Existing registrations collection:     ${report.existingRegistrationCount}`);
    console.log(`Total Reg.Done contacts found:         ${total}`);
    console.log('');
    console.log(`A. Valid historical (no reg record):   ${report.summary.A_VALID_HISTORICAL}`);
    console.log(`B. Duplicate Reg.Done events:          ${report.summary.B_DUPLICATE}`);
    console.log(`C. Already has registration record:    ${report.summary.C_ALREADY_EXISTS}`);
    console.log(`D. Ambiguous:                          ${report.summary.D_AMBIGUOUS}`);
    console.log(`E. Insufficient evidence:              ${report.summary.E_INSUFFICIENT}`);
    console.log('');
    console.log('⚠️  NOTHING WAS WRITTEN TO THE DATABASE.');
    console.log('   Review the full JSON report before creating any registrations.');
    console.log('═══════════════════════════════════════════════════════════');

    // ── Save report ───────────────────────────────────────────────────────────
    const outPath = path.join(__dirname, '..', 'scratch', `reg-reconciliation-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report saved to: ${outPath}\n`);

  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed.');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
