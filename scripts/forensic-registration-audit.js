// scripts/forensic-registration-audit.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

function normalizeProgramKey(val) {
  if (!val) return 'unknown_program';
  let s = String(val).trim().toLowerCase();
  // Normalize common program names/aliases
  s = s.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!s) return 'unknown_program';
  return s;
}

function getCanonicalStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).trim();
  const sLower = s.toLowerCase();
  if (['reg.done', 'reg done', 'reg. done', 'registered', 'registration done', 'already registered', 'already reg', 'already reg.'].includes(sLower)) return 'Reg.Done';
  return s;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contactsCollection = db.collection('contacts');
  const registrationsCollection = db.collection('registrations');

  const contacts = await contactsCollection.find({}).toArray();
  const rawRegistrationsDocs = await registrationsCollection.find({}).toArray();

  console.log('====================================================');
  console.log('COMPREHENSIVE FORENSIC AUDIT OF REGISTRATION COUNTS');
  console.log('====================================================\n');

  // A. RAW REG.DONE CALL EVENTS (From contact.history[])
  let totalRawRegDoneHistoryEvents = 0;
  const rawRegDoneEventsList = [];

  // B. UNIQUE REGISTERED CONTACTS (Set of contactIds with Reg.Done or Registered/Won stage)
  const registeredContactIds = new Set();

  // C. UNIQUE REGISTRATIONS (Set of contactId + normalized calledFor/program)
  const uniqueRegistrationsMap = new Map(); // key: `cid_prog` -> array of evidence entries
  const duplicatesList = [];

  contacts.forEach(contact => {
    const cid = String(contact._id || contact.id);
    const name = contact.Name || contact.name || 'Unknown';
    const phone = contact.Phone || contact.phone || contact.Mobile || '';
    const stage = contact.pipelineStage || '';

    let hasRegEvidence = stage === '6. Registered / Won';
    if (hasRegEvidence) registeredContactIds.add(cid);

    const mainCalledFor = contact['Called For'] || contact.calledFor || contact.programName || '';

    // Inspect contact.history[]
    if (Array.isArray(contact.history)) {
      contact.history.forEach((h, idx) => {
        const status = getCanonicalStatus(h.status);
        if (status === 'Reg.Done') {
          totalRawRegDoneHistoryEvents++;
          registeredContactIds.add(cid);
          hasRegEvidence = true;

          const progKey = normalizeProgramKey(h.calledFor || mainCalledFor);
          const comboKey = `${cid}:::${progKey}`;

          const entry = {
            source: 'contacts.history[]',
            contactId: cid,
            name,
            phone,
            attender: h.attenderName || contact.attenderName || 'Unknown',
            calledFor: h.calledFor || mainCalledFor || 'Unknown Program',
            normalizedProgramKey: progKey,
            timestamp: h.timestamp || h.date || h.createdAt || contact.createdAt,
            idx
          };

          rawRegDoneEventsList.push(entry);

          if (!uniqueRegistrationsMap.has(comboKey)) {
            uniqueRegistrationsMap.set(comboKey, []);
          }
          uniqueRegistrationsMap.get(comboKey).push(entry);
        }
      });
    }

    // Inspect attenderStates[]
    if (contact.attenderStates && typeof contact.attenderStates === 'object') {
      Object.entries(contact.attenderStates).forEach(([attId, state]) => {
        if (!state) return;
        const attName = state.attenderName || 'Unknown';
        if (Array.isArray(state.history)) {
          state.history.forEach((h, idx) => {
            const status = getCanonicalStatus(h.status);
            if (status === 'Reg.Done') {
              registeredContactIds.add(cid);
              const progKey = normalizeProgramKey(h.calledFor || state['Called For'] || state.calledFor || mainCalledFor);
              const comboKey = `${cid}:::${progKey}`;
              const entry = {
                source: `attenderStates[${attName}].history[]`,
                contactId: cid,
                name,
                phone,
                attender: attName,
                calledFor: h.calledFor || state['Called For'] || state.calledFor || mainCalledFor || 'Unknown Program',
                normalizedProgramKey: progKey,
                timestamp: h.timestamp || h.date || h.createdAt,
                idx
              };

              if (!uniqueRegistrationsMap.has(comboKey)) {
                uniqueRegistrationsMap.set(comboKey, []);
              }
              uniqueRegistrationsMap.get(comboKey).push(entry);
            }
          });
        }
      });
    }
  });

  // D. REGISTRATIONS COLLECTION AUDIT
  const rawRegistrationsCollectionCount = rawRegistrationsDocs.length;
  const uniqueRegCollectionMap = new Map();

  rawRegistrationsDocs.forEach((doc, idx) => {
    const cid = String(doc.contactId || doc._id);
    const progKey = normalizeProgramKey(doc.programId || doc.programName || doc.calledFor || 'unknown_program');
    const comboKey = `${cid}:::${progKey}`;
    const entry = {
      source: 'registrations collection',
      docId: String(doc._id),
      contactId: cid,
      name: doc.Name || doc.name || 'Unknown',
      calledFor: doc.programName || doc.calledFor || 'Unknown',
      normalizedProgramKey: progKey,
      idx
    };

    if (!uniqueRegCollectionMap.has(comboKey)) {
      uniqueRegCollectionMap.set(comboKey, []);
    }
    uniqueRegCollectionMap.get(comboKey).push(entry);

    // Also include in global unique registrations check if genuine
    if (!uniqueRegistrationsMap.has(comboKey)) {
      uniqueRegistrationsMap.set(comboKey, []);
    }
    uniqueRegistrationsMap.get(comboKey).push(entry);
  });

  // E. PIPELINE 6. REGISTERED / WON CONTACTS
  const registeredWonContactsCount = contacts.filter(c => c.pipelineStage === '6. Registered / Won').length;

  // Build itemized duplicates list for comboKeys with > 1 occurrence
  let totalDuplicateEventsCount = 0;
  uniqueRegistrationsMap.forEach((occurrences, comboKey) => {
    if (occurrences.length > 1) {
      const [cid, progKey] = comboKey.split(':::');
      totalDuplicateEventsCount += (occurrences.length - 1);
      duplicatesList.push({
        contactId: cid,
        name: occurrences[0].name,
        phone: occurrences[0].phone || '',
        calledFor: occurrences[0].calledFor,
        normalizedProgramKey: progKey,
        totalOccurrences: occurrences.length,
        duplicateCount: occurrences.length - 1,
        occurrences: occurrences.map(o => ({
          source: o.source,
          attender: o.attender,
          timestamp: o.timestamp
        }))
      });
    }
  });

  console.log('--- A. RAW REG.DONE CALL EVENTS ---');
  console.log(`- Total Reg.Done call-history events in contacts.history[]: ${totalRawRegDoneHistoryEvents}\n`);

  console.log('--- B. UNIQUE REGISTERED CONTACTS ---');
  console.log(`- Total unique contactIds with registration evidence / stage: ${registeredContactIds.size}\n`);

  console.log('--- C. UNIQUE REGISTRATIONS (contactId + calledFor/program) ---');
  console.log(`- Total unique (contactId + program) registrations: ${uniqueRegistrationsMap.size}\n`);

  console.log('--- D. REGISTRATIONS COLLECTION ---');
  console.log(`- Raw document count in 'registrations' MongoDB collection: ${rawRegistrationsCollectionCount}`);
  console.log(`- Deduplicated (contactId + program) count in 'registrations': ${uniqueRegCollectionMap.size}\n`);

  console.log('--- E. PIPELINE 6. REGISTERED / WON CONTACTS ---');
  console.log(`- Unique contacts with pipelineStage == "6. Registered / Won": ${registeredWonContactsCount}\n`);

  console.log('====================================================');
  console.log('ITEMIZED DUPLICATE OCCURRENCES (contactId + program)');
  console.log('====================================================\n');

  console.log(`Found ${duplicatesList.length} unique contact-program combinations that appear multiple times (accounting for ${totalDuplicateEventsCount} duplicate records):\n`);

  duplicatesList.slice(0, 15).forEach((d, i) => {
    console.log(`${i + 1}. Contact: ${d.name} (${d.contactId}) | Program: ${d.calledFor}`);
    console.log(`   Occurrences Count: ${d.totalOccurrences} (Duplicates: ${d.duplicateCount})`);
    d.occurrences.forEach((occ, oIdx) => {
      console.log(`   - Occurrence #${oIdx + 1}: Source [${occ.source}] | Attender: ${occ.attender || 'N/A'}`);
    });
    console.log('');
  });

  // Save audit output to file
  const auditOutPath = path.join(process.cwd(), 'forensic_registration_audit_output.json');
  fs.writeFileSync(auditOutPath, JSON.stringify({
    rawRegDoneEvents: totalRawRegDoneHistoryEvents,
    uniqueRegisteredContacts: registeredContactIds.size,
    uniqueRegistrations: uniqueRegistrationsMap.size,
    rawRegistrationsCollectionDocs: rawRegistrationsCollectionCount,
    deduplicatedRegistrationsCollection: uniqueRegCollectionMap.size,
    pipelineRegisteredWonPeople: registeredWonContactsCount,
    duplicatesCount: duplicatesList.length,
    totalDuplicateEntries: totalDuplicateEventsCount,
    duplicatesList
  }, null, 2), 'utf8');

  console.log(`Audit saved to ${auditOutPath}\n`);

  await client.close();
}

main().catch(console.error);
