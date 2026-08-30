// scripts/investigate-undefined-and-attenders.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('====================================================');
  console.log('READ-ONLY AUDIT: UNDEFINED CONTACTS & ATTENDER VISIBILITY');
  console.log('====================================================\n');

  // Collections
  const contactsCol = db.collection('contacts');
  const registrationsCol = db.collection('registrations');
  const attendersCol = db.collection('attenders');

  const contacts = await contactsCol.find({}).toArray();
  const registrations = await registrationsCol.find({}).toArray();
  const dbAttenders = await attendersCol.find({}).toArray();

  console.log(`1. MONGODB BASELINE DATA:`);
  console.log(`   - Total Contacts in MongoDB:       ${contacts.length}`);
  console.log(`   - Total Registrations in MongoDB:  ${registrations.length}`);
  console.log(`   - Total Attenders in DB:          ${dbAttenders.length}\n`);

  // ---------------------------------------------------------
  // AUDIT 1: CONTACT IDENTITY & UNDEFINED FIELDS
  // ---------------------------------------------------------
  console.log('====================================================');
  console.log('AUDIT 1: CONTACT IDENTITY & UNDEFINED FIELDS');
  console.log('====================================================');

  const contactsWithMissingName = [];
  const contactsWithMissingPhone = [];
  const contactsWithMissingAttender = [];
  const phoneToContactsMap = {};

  contacts.forEach((c) => {
    const id = c._id.toString();
    const name = c.Name || c.name || c.contactName || c['Full Name'] || c['Name'] || '';
    const phone = c.Phone || c.phone || c.contactPhone || c.Mobile || c.MobileNo || c['Mobile No'] || '';
    const attId = c.attenderId || c.assignedTo || c.leadOwner || '';

    if (!name || String(name).trim() === '' || String(name).toLowerCase() === 'undefined' || String(name).toLowerCase() === 'null') {
      contactsWithMissingName.push({ id, name, phone, attId, raw: c });
    }

    if (!phone || String(phone).trim() === '') {
      contactsWithMissingPhone.push({ id, name, phone, attId });
    }

    if (!attId || String(attId).trim() === '' || String(attId).toLowerCase() === 'unassigned') {
      contactsWithMissingAttender.push({ id, name, phone });
    }

    // Phone normalization for duplicate check
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone) {
      if (!phoneToContactsMap[cleanPhone]) phoneToContactsMap[cleanPhone] = [];
      phoneToContactsMap[cleanPhone].push({ id, name, rawPhone: phone, attId });
    }
  });

  console.log(`- Total contacts with missing/undefined Name:   ${contactsWithMissingName.length}`);
  if (contactsWithMissingName.length > 0) {
    console.log('\n  List of contacts with missing/blank Name field:');
    contactsWithMissingName.forEach(c => {
      console.log(`   * Contact ID: ${c.id} | Phone: "${c.phone}" | AttenderId: "${c.attId}"`);
    });
  }

  console.log(`\n- Contacts with missing/blank Phone:          ${contactsWithMissingPhone.length}`);
  console.log(`- Contacts with missing/unassigned Attender:  ${contactsWithMissingAttender.length}`);

  // Duplicate phones
  const duplicatePhones = Object.entries(phoneToContactsMap).filter(([p, list]) => list.length > 1);
  console.log(`- Duplicate 10-digit phone numbers:            ${duplicatePhones.length} groups affecting ${duplicatePhones.reduce((a, b) => a + b[1].length, 0)} contact documents`);
  if (duplicatePhones.length > 0) {
    console.log('\n  Duplicate Phone Number Details:');
    duplicatePhones.forEach(([phone, list]) => {
      console.log(`   * Phone: ${phone} (${list.length} docs): ${list.map(x => `${x.id} ("${x.name}")`).join(', ')}`);
    });
  }

  // ---------------------------------------------------------
  // AUDIT 2: CALL HISTORY & INVALID CONTACT REFERENCES
  // ---------------------------------------------------------
  console.log('\n====================================================');
  console.log('AUDIT 2: CALL HISTORY CONTACT RESOLUTION');
  console.log('====================================================');

  const validContactIds = new Set(contacts.map(c => c._id.toString()));
  let totalHistoryEntries = 0;
  let historyWithMissingContactRef = 0;
  let historyWithMissingNameOrPhone = 0;

  contacts.forEach(c => {
    const cId = c._id.toString();
    const cName = c.Name || c.name || c.contactName || '';
    const cPhone = c.Phone || c.phone || c.contactPhone || '';

    if (Array.isArray(c.history)) {
      totalHistoryEntries += c.history.length;
      c.history.forEach((h) => {
        const refId = String(h.contactId || cId);
        if (!validContactIds.has(refId)) {
          historyWithMissingContactRef++;
        }
        if (!cName || !cPhone) {
          historyWithMissingNameOrPhone++;
        }
      });
    }
  });

  console.log(`- Total Call History Entries in DB:           ${totalHistoryEntries}`);
  console.log(`- History entries with invalid contact reference: ${historyWithMissingContactRef}`);
  console.log(`- History entries attached to missing-name/phone contacts: ${historyWithMissingNameOrPhone}`);

  // ---------------------------------------------------------
  // AUDIT 3: REGISTRATIONS & PROGRAM RELATIONSHIPS
  // ---------------------------------------------------------
  console.log('\n====================================================');
  console.log('AUDIT 3: REGISTRATIONS & PROGRAM RELATIONSHIPS');
  console.log('====================================================');

  let invalidRegContactRefs = 0;
  let regWithMissingName = 0;

  registrations.forEach(r => {
    const refId = r.contactId;
    if (refId && !validContactIds.has(String(refId))) {
      invalidRegContactRefs++;
    }
    if (!r.contactName && !r.Name && !r.name) {
      regWithMissingName++;
    }
  });

  console.log(`- Registrations referencing non-existent contactId: ${invalidRegContactRefs}`);
  console.log(`- Registrations with missing contact name:         ${regWithMissingName}`);

  let totalProgRelationships = 0;
  let invalidProgRelRefs = 0;
  contacts.forEach(c => {
    if (Array.isArray(c.programRelationships)) {
      totalProgRelationships += c.programRelationships.length;
      c.programRelationships.forEach(pr => {
        if (pr.contactId && !validContactIds.has(String(pr.contactId))) {
          invalidProgRelRefs++;
        }
      });
    }
  });

  console.log(`- Total Program Relationships in contacts:        ${totalProgRelationships}`);
  console.log(`- Program Relationships with invalid contactId:    ${invalidProgRelRefs}`);

  // ---------------------------------------------------------
  // AUDIT 4: ATTENDER VISIBILITY AUDIT ("TEST" & "TEST 2")
  // ---------------------------------------------------------
  console.log('\n====================================================');
  console.log('AUDIT 4: ATTENDER VISIBILITY AUDIT ("TEST" & "TEST 2")');
  console.log('====================================================');

  console.log('Attenders in `attenders` MongoDB collection:');
  dbAttenders.forEach(a => {
    console.log(`   * DB Attender -> ID: "${a._id.toString()}" | name: "${a.name}" | idField: "${a.id || ''}" | active: ${a.active !== false}`);
  });

  // Track all attenders mentioned anywhere in contacts or history
  const attenderMap = {};

  const addAttenderMention = (attId, attName, context, cId) => {
    const rawKey = String(attId || attName || 'unassigned').trim();
    if (!attenderMap[rawKey]) {
      attenderMap[rawKey] = {
        key: rawKey,
        ids: new Set(),
        names: new Set(),
        assignedContacts: new Set(),
        callEvents: 0
      };
    }
    if (attId) attenderMap[rawKey].ids.add(String(attId));
    if (attName) attenderMap[rawKey].names.add(String(attName));
    if (context === 'contact') attenderMap[rawKey].assignedContacts.add(cId);
    if (context === 'call') attenderMap[rawKey].callEvents++;
  };

  contacts.forEach(c => {
    const cId = c._id.toString();
    const attId = c.attenderId || c.assignedTo || c.leadOwner;
    const attName = c.attenderName;
    addAttenderMention(attId, attName, 'contact', cId);

    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        addAttenderMention(h.attenderId, h.attenderName, 'call', cId);
      });
    }
  });

  console.log('\nAll Attender Keys Found Across Contacts and Call History:');
  const summaryRows = Object.values(attenderMap).map(a => ({
    Key: a.key,
    IDs: Array.from(a.ids).join(', '),
    Names: Array.from(a.names).join(', '),
    AssignedContacts: a.assignedContacts.size,
    CallEvents: a.callEvents
  }));
  console.table(summaryRows);

  // Search specifically for "Test", "Test 2", "Test1", "Test2"
  console.log('\nDeep-dive search for "Test" / "Test 2" in MongoDB:');
  const testRelatedAttenders = dbAttenders.filter(a => (a.name || '').toLowerCase().includes('test'));
  console.log(`- Attenders in 'attenders' collection matching 'test': ${testRelatedAttenders.length}`);
  testRelatedAttenders.forEach(a => {
    console.log(`   * ${JSON.stringify(a)}`);
  });

  const testContacts = contacts.filter(c => {
    const aId = String(c.attenderId || c.assignedTo || '');
    const aName = String(c.attenderName || '');
    return aId.toLowerCase().includes('test') || aName.toLowerCase().includes('test');
  });
  console.log(`- Contacts in 'contacts' collection assigned to 'test' / 'Test 2': ${testContacts.length}`);
  testContacts.forEach(c => {
    console.log(`   * Contact ID: ${c._id} | Name: "${c.Name}" | Phone: "${c.Phone}" | attenderId: "${c.attenderId}" | attenderName: "${c.attenderName}"`);
  });

  await client.close();
}

main().catch(console.error);
