// scripts/detailed-registration-duplicates-audit.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

function normalizeProgramKey(val) {
  if (!val) return 'unknown_program';
  let s = String(val).trim().toLowerCase();
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

  const contacts = await db.collection('contacts').find({}).toArray();
  const rawRegistrationsDocs = await db.collection('registrations').find({}).toArray();

  console.log('====================================================');
  console.log('DETAILED ANALYSIS OF REGISTRATION DUPLICATES');
  console.log('====================================================\n');

  // Check 1: Reg.Done calls inside contacts.history[] only
  const historyComboMap = new Map();
  let multiRegDoneHistoryCalls = 0;

  contacts.forEach(c => {
    const cid = String(c._id);
    const mainCalledFor = c['Called For'] || c.calledFor || c.programName || '';
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        if (getCanonicalStatus(h.status) === 'Reg.Done') {
          const prog = h.calledFor || mainCalledFor || 'Unknown';
          const key = `${cid}:::${normalizeProgramKey(prog)}`;
          if (!historyComboMap.has(key)) historyComboMap.set(key, []);
          historyComboMap.get(key).push({
            contactId: cid,
            name: c.Name || c.name || 'Unknown',
            calledFor: prog,
            attender: h.attenderName || c.attenderName || 'Unknown',
            date: h.timestamp || h.date || h.createdAt,
            idx
          });
        }
      });
    }
  });

  const historyMultiCalls = [];
  historyComboMap.forEach((list, key) => {
    if (list.length > 1) {
      historyMultiCalls.push(list);
    }
  });

  console.log(`1. Multiple Reg.Done entries within contacts.history[] for SAME (contactId + program):`);
  console.log(`   Count of contacts with multiple Reg.Done calls for same program: ${historyMultiCalls.length}\n`);

  historyMultiCalls.forEach((list, i) => {
    console.log(`   ${i + 1}. Contact: ${list[0].name} (${list[0].contactId}) | Program: ${list[0].calledFor} | Total Reg.Done calls: ${list.length}`);
    list.forEach((item, idx) => {
      console.log(`      - Call #${idx + 1}: Attender: ${item.attender} | Date: ${item.date || 'N/A'}`);
    });
  });

  // Check 2: Shared attender Reg.Done calls across different attenders for SAME program
  console.log('\n2. Shared Attender Reg.Done calls for SAME (contactId + program):');
  const sharedAttenderDiffAttenders = [];

  historyMultiCalls.forEach(list => {
    const attenders = new Set(list.map(l => (l.attender || '').trim().toLowerCase()));
    if (attenders.size > 1) {
      sharedAttenderDiffAttenders.push(list);
    }
  });

  console.log(`   Count of contacts handled by MULTIPLE attenders with Reg.Done for same program: ${sharedAttenderDiffAttenders.length}\n`);
  sharedAttenderDiffAttenders.forEach((list, i) => {
    console.log(`   ${i + 1}. Contact: ${list[0].name} (${list[0].contactId}) | Program: ${list[0].calledFor}`);
    list.forEach((item, idx) => {
      console.log(`      - Call #${idx + 1}: Attender: ${item.attender} | Date: ${item.date || 'N/A'}`);
    });
  });

  // Check 3: Multi-program contacts (Contacts with Reg.Done or Registration for DIFFERENT programs)
  console.log('\n3. Multi-Program Registrations (Same contact, DIFFERENT programs):');
  const contactProgramsMap = new Map();

  // Combine contacts.history Reg.Done and registrations collection docs
  contacts.forEach(c => {
    const cid = String(c._id);
    const mainCalledFor = c['Called For'] || c.calledFor || c.programName || '';
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        if (getCanonicalStatus(h.status) === 'Reg.Done') {
          const prog = h.calledFor || mainCalledFor || 'Unknown';
          const key = `${cid}`;
          if (!contactProgramsMap.has(key)) contactProgramsMap.set(key, new Set());
          contactProgramsMap.get(key).add(normalizeProgramKey(prog));
        }
      });
    }
  });

  rawRegistrationsDocs.forEach(r => {
    const cid = String(r.contactId || r._id);
    const prog = r.programName || r.calledFor || 'Unknown';
    if (!contactProgramsMap.has(cid)) contactProgramsMap.set(cid, new Set());
    contactProgramsMap.get(cid).add(normalizeProgramKey(prog));
  });

  const multiProgramContacts = [];
  contactProgramsMap.forEach((progs, cid) => {
    if (progs.size > 1) {
      const c = contacts.find(x => String(x._id) === cid);
      multiProgramContacts.push({
        contactId: cid,
        name: c ? (c.Name || c.name) : 'Unknown',
        programs: Array.from(progs)
      });
    }
  });

  console.log(`   Count of contacts registered for MULTIPLE DIFFERENT programs: ${multiProgramContacts.length}\n`);
  multiProgramContacts.forEach((mp, i) => {
    console.log(`   ${i + 1}. Contact: ${mp.name} (${mp.contactId}) | Programs (${mp.programs.length}): ${mp.programs.join(', ')}`);
  });

  await client.close();
}

main().catch(console.error);
