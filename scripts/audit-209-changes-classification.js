// scripts/audit-209-changes-classification.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

const INVALID_KEYWORDS = [
  'invalid', 'wrong no', 'wrong number', 'invalid number', 'out of service', 'does not exist', 'number invalid'
];

const UNCONNECTED_KEYWORDS = [
  'no answer', 'busy', 'call cut', 'not attended', 'na', 'no network',
  'switched off', 'call not received', 'call not connected', 'call log added', 'callback'
];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contactsCollection = db.collection('contacts');
  const registrationsCollection = db.collection('registrations');

  const reviewPath = path.join(process.cwd(), 'proposed_209_stage_changes_review.json');
  const proposedChanges = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));

  const allContacts = await contactsCollection.find({}).toArray();
  const registrations = await registrationsCollection.find({}).toArray();

  const regMap = new Map();
  registrations.forEach(r => {
    if (r.contactId) regMap.set(String(r.contactId), r);
    if (r.phone || r.Phone || r.mobile) {
      const p = String(r.phone || r.Phone || r.mobile).replace(/\D/g, '');
      if (p) regMap.set(p, r);
    }
  });

  const contactMap = new Map();
  allContacts.forEach(c => {
    contactMap.set(String(c._id || c.id), c);
  });

  console.log('====================================================');
  console.log('FORENSIC AUDIT OF 209 PROPOSED STAGE CHANGES');
  console.log('====================================================\n');

  const classifiedResults = [];

  const summaryByCategory = {};

  proposedChanges.forEach(item => {
    const cid = String(item.contactId);
    const dbDoc = contactMap.get(cid);
    const currentStage = item.currentPipelineStage;
    const proposedStage = item.proposedPipelineStage;
    const transition = item.transition;

    if (!summaryByCategory[transition]) {
      summaryByCategory[transition] = { CONFIRMED: 0, REJECT: 0, REVIEW: 0, TOTAL: 0 };
    }
    summaryByCategory[transition].TOTAL++;

    if (!dbDoc) {
      classifiedResults.push({
        contactId: cid,
        name: item.name,
        currentStage,
        proposedStage,
        transition,
        classification: 'REJECT',
        reason: 'Contact ID does not exist in MongoDB Atlas contacts collection'
      });
      summaryByCategory[transition].REJECT++;
      return;
    }

    const hist = Array.isArray(dbDoc.history) ? dbDoc.history : [];
    const phoneClean = String(dbDoc.phone || dbDoc.Phone || dbDoc.Mobile || '').replace(/\D/g, '');
    const regRecord = regMap.get(cid) || (phoneClean ? regMap.get(phoneClean) : null);
    const statusLower = String(dbDoc.status || '').toLowerCase().trim();
    const calledForLower = String(dbDoc['Called For'] || dbDoc.calledFor || '').toLowerCase().trim();

    // Check complete history evidence
    let hasRegEvidence = !!regRecord || statusLower.includes('reg.done') || statusLower.includes('already reg') || statusLower.includes('registered');
    let hasInfoGiven = statusLower.includes('info given') || statusLower.includes('information given');
    let hasInterested = statusLower.includes('interested') && !statusLower.includes('not interested');
    let hasFuturePool = statusLower.includes('next time') || statusLower.includes('next batch');
    let hasClosedLost = statusLower.includes('not interested') || statusLower.includes('not possible');
    let hasExplicitInvalid = INVALID_KEYWORDS.some(k => statusLower.includes(k));
    let hasQuery = calledForLower.includes('query') || statusLower.includes('query');

    hist.forEach(h => {
      const purp = String(h.callPurpose || h.purpose || '').toLowerCase().trim();
      const stat = String(h.status || h.purposeOutcome || '').trim().toLowerCase();
      const rem = String(h.remark || '').toLowerCase().trim();
      const cfor = String(h.calledFor || '').toLowerCase().trim();
      const combined = `${stat} ${rem} ${cfor}`;

      if (combined.includes('already reg') || combined.includes('reg.done') || combined.includes('registered')) {
        hasRegEvidence = true;
      }
      if (combined.includes('info given') || combined.includes('information given') || combined.includes('details send')) {
        hasInfoGiven = true;
      }
      if (combined.includes('interested') && !combined.includes('not interested')) {
        hasInterested = true;
      }
      if (combined.includes('next time') || combined.includes('next batch') || rem.includes('next batch')) {
        hasFuturePool = true;
      }
      if (combined.includes('not interested') || combined.includes('not possible')) {
        hasClosedLost = true;
      }
      if (INVALID_KEYWORDS.some(k => combined.includes(k))) {
        hasExplicitInvalid = true;
      }
      if (purp === 'query' || stat.includes('query') || rem.includes('query') || cfor.includes('query') || rem.includes('doubt') || rem.includes('fees') || rem.includes('timing') || rem.includes('group me add')) {
        hasQuery = true;
      }
    });

    let classification = 'CONFIRMED';
    let reason = 'Evidence matches proposed stage';

    // APPLY BUSINESS RULES STRICTLY:

    // Rule 1: Do NOT classify as Closed / Invalid merely because of 4-5 unanswered attempts without explicit invalid keyword
    if (proposedStage === 'Closed / Invalid') {
      if (!hasExplicitInvalid) {
        classification = 'REJECT';
        reason = `REJECT: Proposed stage is Closed / Invalid, but history contains 0 explicit invalid/wrong-number keywords. (Rule 1 violation)`;
      } else {
        classification = 'CONFIRMED';
        reason = 'CONFIRMED: Explicit invalid/wrong-number status or remark verified in history.';
      }
    }
    // Rule 2: Query Desk only if genuine query activity AND no stronger Sales progression
    else if (proposedStage === 'Query Desk') {
      if (hasRegEvidence || hasInterested || hasInfoGiven) {
        classification = 'REJECT';
        reason = `REJECT: Proposed stage is Query Desk, but contact has higher sales progression (Reg/Interested/InfoGiven). (Rule 2 violation)`;
      } else if (!hasQuery) {
        classification = 'REVIEW';
        reason = `REVIEW: Proposed stage is Query Desk, but explicit query evidence in history is weak or ambiguous.`;
      } else {
        classification = 'CONFIRMED';
        reason = 'CONFIRMED: Genuine query/support interaction with 0 connected sales progression.';
      }
    }
    // Rule 3: Future Pool should NOT automatically become Attempting Contact merely because a later call attempt exists
    else if (currentStage === '5. Future Pool' && proposedStage === '2. Attempting Contact') {
      if (hasFuturePool && !hasInfoGiven && !hasInterested && !hasRegEvidence) {
        classification = 'REJECT';
        reason = `REJECT: Contact belongs in Future Pool (next batch scheduled). Later unanswered call attempt does not demote to Attempting. (Rule 3 violation)`;
      } else if (hasInfoGiven || hasInterested) {
        classification = 'REVIEW';
        reason = `REVIEW: History has sales progression (Info Given/Interested) alongside Future Pool notes.`;
      } else {
        classification = 'CONFIRMED';
        reason = 'CONFIRMED: No valid Future Pool evidence; contact is active Attempting Contact.';
      }
    }
    // Rule 4: Registered / Won takes priority when registration is evidenced
    else if (hasRegEvidence && proposedStage !== '6. Registered / Won') {
      classification = 'REJECT';
      reason = `REJECT: Registration evidence exists (Reg.Done/registrations record), but proposed stage is '${proposedStage}'. (Rule 4 violation)`;
    }
    // Rule 5: A contact with meaningful historical interaction should NOT be New Lead
    else if (proposedStage === '1. New Lead' && hist.length > 0) {
      classification = 'REJECT';
      reason = `REJECT: Proposed stage is New Lead, but contact has ${hist.length} history entries. (Rule 5 violation)`;
    }
    else {
      classification = 'CONFIRMED';
      reason = `CONFIRMED: Proposed transition '${transition}' is supported by history evidence.`;
    }

    summaryByCategory[transition][classification]++;

    classifiedResults.push({
      contactId: cid,
      name: item.name,
      attender: item.attender,
      currentPipelineStage: currentStage,
      proposedPipelineStage: proposedStage,
      transition,
      historyCount: hist.length,
      classification,
      reason,
      historyDetails: hist.map(h => ({ date: h.timestamp, status: h.status, remark: h.remark, calledFor: h.calledFor }))
    });
  });

  // Save audit output
  const outJsonPath = path.join(process.cwd(), 'audit_209_proposed_changes_classified.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(classifiedResults, null, 2), 'utf8');

  console.log('====================================================');
  console.log('AUDIT SUMMARY BY TRANSITION CATEGORY');
  console.log('====================================================\n');

  console.table(summaryByCategory);

  const totalConfirmed = classifiedResults.filter(r => r.classification === 'CONFIRMED').length;
  const totalReject = classifiedResults.filter(r => r.classification === 'REJECT').length;
  const totalReview = classifiedResults.filter(r => r.classification === 'REVIEW').length;

  console.log('\n--- GRAND TOTALS ---');
  console.log(`- Total Records Audited: ${classifiedResults.length}`);
  console.log(`- CONFIRMED (Valid & Safe to Update): ${totalConfirmed}`);
  console.log(`- REJECT (Violates Business Rules): ${totalReject}`);
  console.log(`- REVIEW (Ambiguous Evidence): ${totalReview}\n`);

  await client.close();
}

main().catch(console.error);
