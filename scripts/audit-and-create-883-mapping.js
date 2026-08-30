// scripts/audit-and-create-883-mapping.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

const UNCONNECTED_KEYWORDS = [
  'no answer', 'busy', 'call cut', 'not attended', 'na', 'no network',
  'switched off', 'call not received', 'call not connected', 'call log added', 'callback'
];

const INVALID_KEYWORDS = [
  'invalid', 'wrong no', 'wrong number', 'invalid number', 'out of service', 'does not exist'
];

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contactsCollection = db.collection('contacts');
  const registrationsCollection = db.collection('registrations');

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

  const explicitStageContacts = allContacts.filter(c => c.pipelineStage && String(c.pipelineStage).trim() !== "" && c.pipelineStage !== "null" && c.pipelineStage !== "undefined");
  const legacyContacts = allContacts.filter(c => !c.pipelineStage || String(c.pipelineStage).trim() === "" || c.pipelineStage === "null" || c.pipelineStage === "undefined");

  console.log('====================================================');
  console.log('PHASE 1: READ-ONLY AUDIT OF LEGACY CONTACTS');
  console.log('====================================================\n');

  console.log(`- Total Contacts in MongoDB: ${allContacts.length}`);
  console.log(`- Contacts with Explicit pipelineStage (Preserved): ${explicitStageContacts.length}`);
  console.log(`- Contacts with Missing/Null pipelineStage (Legacy Audit Target): ${legacyContacts.length}\n`);

  if (legacyContacts.length !== 883) {
    console.warn(`WARNING: Legacy count is ${legacyContacts.length}, expected 883.`);
  }

  const mapping = [];
  const stageCounts = {
    '1. New Lead': 0,
    '2. Attempting Contact': 0,
    '3. Information Given': 0,
    '4. Nurture / Interested': 0,
    '5. Future Pool': 0,
    '6. Registered / Won': 0,
    'Closed / Lost': 0,
    'Closed / Invalid': 0,
    'Query Desk': 0,
    'Unknown': 0
  };

  legacyContacts.forEach(c => {
    const cid = String(c._id || c.id);
    const name = c.name || c.Name || '(blank)';
    const phoneClean = String(c.phone || c.Phone || c.Mobile || '').replace(/\D/g, '');
    const attender = c.attenderName || c.assignedName || 'Unassigned';
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = String(c.status || '').toLowerCase().trim();
    const calledForLower = String(c['Called For'] || c.calledFor || '').toLowerCase().trim();

    const regRecord = regMap.get(cid) || (phoneClean ? regMap.get(phoneClean) : null);

    let correctPipelineStage = '1. New Lead';
    let evidence = 'Pure uncontacted lead with 0 history';
    let confidence = 'HIGH';

    // 1. REGISTRATION EVIDENCE (HIGHEST PRIORITY)
    let hasRegHistory = false;
    let hasInfoGiven = false;
    let hasInterested = false;
    let hasFuturePool = false;
    let hasClosedLost = false;
    let hasInvalid = false;
    let unconnectedAttempts = 0;
    let hasQuery = false;

    if (regRecord || statusLower.includes('reg.done') || statusLower.includes('already reg') || statusLower.includes('registered')) {
      hasRegHistory = true;
    }
    if (calledForLower.includes('query') || statusLower.includes('query')) {
      hasQuery = true;
    }

    hist.forEach(h => {
      const purp = String(h.callPurpose || h.purpose || '').toLowerCase().trim();
      const stat = String(h.status || h.purposeOutcome || '').trim().toLowerCase();
      const rem = String(h.remark || '').toLowerCase().trim();
      const cfor = String(h.calledFor || '').toLowerCase().trim();
      const combined = `${stat} ${rem} ${cfor}`;

      if (combined.includes('already reg') || combined.includes('reg.done') || combined.includes('registered') || combined.includes('registration done')) {
        hasRegHistory = true;
      }
      if (combined.includes('info given') || combined.includes('information given') || combined.includes('info shared') || combined.includes('details send')) {
        hasInfoGiven = true;
      }
      if ((combined.includes('interested') && !combined.includes('not interested')) || rem.includes('she will register')) {
        hasInterested = true;
      }
      if (combined.includes('next time') || combined.includes('next batch')) {
        hasFuturePool = true;
      }
      if (combined.includes('not interested') || combined.includes('not possible')) {
        hasClosedLost = true;
      }

      if (INVALID_KEYWORDS.some(k => combined.includes(k))) {
        hasInvalid = true;
      }
      if (UNCONNECTED_KEYWORDS.some(k => combined.includes(k))) {
        unconnectedAttempts++;
      }
      if (purp === 'query' || stat.includes('query') || rem.includes('query') || cfor.includes('query') || rem.includes('doubt') || rem.includes('fees') || rem.includes('timing') || rem.includes('bus ki') || rem.includes('group me add')) {
        hasQuery = true;
      }
    });

    if (hasRegHistory) {
      correctPipelineStage = '6. Registered / Won';
      evidence = regRecord ? 'Structured document in registrations collection' : 'Historical Reg.Done / Already Registered status or call log';
    } else if (hasInterested) {
      correctPipelineStage = '4. Nurture / Interested';
      evidence = 'Connected sales interaction: Interested / Follow-up';
    } else if (hasInfoGiven) {
      correctPipelineStage = '3. Information Given';
      evidence = 'Connected sales interaction: Information Given';
    } else if (hasFuturePool) {
      correctPipelineStage = '5. Future Pool';
      evidence = 'Connected sales interaction: Next Time / Future Batch';
    } else if (hasClosedLost) {
      correctPipelineStage = 'Closed / Lost';
      evidence = 'Connected sales interaction: Not Interested / Not Possible';
    } else if (hasInvalid || unconnectedAttempts >= 5) {
      correctPipelineStage = 'Closed / Invalid';
      evidence = hasInvalid ? 'Invalid / wrong number status or remark' : '5+ unsuccessful dial attempts';
    } else if (unconnectedAttempts >= 1) {
      correctPipelineStage = '2. Attempting Contact';
      evidence = `${unconnectedAttempts} unsuccessful sales dial attempt(s)`;
    } else if (hasQuery) {
      correctPipelineStage = 'Query Desk';
      evidence = 'Inbound/outbound query/inquiry with 0 sales attempts';
    } else {
      correctPipelineStage = '1. New Lead';
      evidence = 'Pure untouched lead with 0 history and 0 query/sales activity';
    }

    stageCounts[correctPipelineStage] = (stageCounts[correctPipelineStage] || 0) + 1;

    mapping.push({
      contactId: cid,
      name,
      currentPipelineStage: null,
      correctPipelineStage,
      attender,
      historyCount: hist.length,
      evidence,
      confidence
    });
  });

  console.log('====================================================');
  console.log('PHASE 2: PROPOSED STAGE MAPPING FOR THE 883 LEGACY CONTACTS');
  console.log('====================================================\n');

  console.table(stageCounts);
  const mappingTotal = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  console.log(`TOTAL MAPPED RECORDS: ${mappingTotal} (Target: 883)\n`);

  // Write mapping to JSON file
  const outputPath = path.join(process.cwd(), 'legacy-pipeline-stage-mapping.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2), 'utf8');
  console.log(`Successfully generated '${outputPath}' containing ${mapping.length} itemized records.`);

  await client.close();
}

main().catch(console.error);
