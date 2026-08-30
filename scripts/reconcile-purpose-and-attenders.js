// scripts/reconcile-purpose-and-attenders.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export const getCallPurpose = (h, contact = {}) => {
  const cp = (h.callPurpose || h.purpose || contact.purpose || '').toLowerCase().trim();

  if (cp === 'sales') return 'sales';
  if (cp === 'query') return 'query';
  if (cp === 'reminder') return 'reminder';

  const remark = (h.remark || h.comment || contact.remark || '').toLowerCase();
  const status = (h.status || contact.status || '').toLowerCase();

  const isQuery = remark.includes('query') || remark.includes('doubt') || remark.includes('question') || remark.includes('asking about') || remark.includes('shivir query') || remark.includes('fee detail') || status.includes('query');
  if (isQuery) return 'query';

  const isReminder = remark.includes('reminder') || remark.includes('remind') || remark.includes('payment link') || remark.includes('session link') || remark.includes('zoom link');
  if (isReminder) return 'reminder';

  return 'unknown_legacy';
};

async function reconcile() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('====================================================');
  console.log('FULL SYSTEM RECONCILIATION: MONGODB → API → ADMIN UI');
  console.log('====================================================\n');

  const contactsCol = db.collection('contacts');
  const attendersCol = db.collection('attenders');

  const contacts = await contactsCol.find({}).toArray();
  const attenders = await attendersCol.find({}).toArray();

  // 1. MONGODB DIRECT METRICS
  let mongoHistoryCalls = 0;
  contacts.forEach(c => {
    if (Array.isArray(c.history)) mongoHistoryCalls += c.history.length;
  });

  console.log('1. MONGODB DIRECT METRICS:');
  console.log(`   - Total Contacts:            ${contacts.length}`);
  console.log(`   - Total Attenders in DB:     ${attenders.length}`);
  console.log(`   - Total Call History Events: ${mongoHistoryCalls}`);

  // 2. DETERMINISTIC FRONTEND EVENT EXTRACTION
  const events = [];
  const seenCallIds = new Set();

  contacts.forEach(contact => {
    const cId = contact._id.toString();

    if (Array.isArray(contact.history) && contact.history.length > 0) {
      contact.history.forEach((h, idx) => {
        const callId = h.callId || h.id || `legacy_call_${cId}_${idx}`;
        if (seenCallIds.has(callId)) return;
        seenCallIds.add(callId);

        let attId = h.attenderId;
        let attName = h.attenderName;

        if (!attId && attName) {
          const cleanName = attName.trim().toLowerCase();
          const matchedAttender = (attenders || []).find(a => (a.name || '').trim().toLowerCase() === cleanName);
          if (matchedAttender) {
            attId = matchedAttender.id || matchedAttender._id.toString();
          }
        }

        if (!attId && !attName) {
          attId = contact.attenderId;
          attName = contact.attenderName;
          if (!attId && attName) {
            const cleanName = attName.trim().toLowerCase();
            const matchedAttender = (attenders || []).find(a => (a.name || '').trim().toLowerCase() === cleanName);
            if (matchedAttender) {
              attId = matchedAttender.id || matchedAttender._id.toString();
            }
          }
        }

        if (!attId) attId = 'unassigned';
        if (!attName) attName = 'Unassigned Attender';

        const purpose = getCallPurpose(h, contact);

        events.push({
          callId,
          contactId: cId,
          attenderId: attId,
          attenderName: attName,
          purpose,
          status: h.status || contact.status || 'Pending'
        });
      });
    }
  });

  console.log('\n2. ADMIN UI EVENT EXTRACTION METRICS:');
  console.log(`   - Extracted Call Events:     ${events.length} (Matches DB history: ${events.length === mongoHistoryCalls ? 'YES' : 'NO'})`);

  // 3. PURPOSE ANALYTICS RECONCILIATION
  const purposeMap = {
    sales: { calls: 0, contacts: new Set() },
    query: { calls: 0, contacts: new Set() },
    reminder: { calls: 0, contacts: new Set() },
    unknown_legacy: { calls: 0, contacts: new Set() }
  };

  events.forEach(e => {
    if (!purposeMap[e.purpose]) purposeMap[e.purpose] = { calls: 0, contacts: new Set() };
    purposeMap[e.purpose].calls++;
    purposeMap[e.purpose].contacts.add(e.contactId);
  });

  const purposeTable = [
    { Category: 'Sales', Calls: purposeMap.sales.calls, 'Unique People': purposeMap.sales.contacts.size, Status: purposeMap.sales.calls === 7 ? 'PASS' : 'FAIL' },
    { Category: 'Query', Calls: purposeMap.query.calls, 'Unique People': purposeMap.query.contacts.size, Status: purposeMap.query.calls === 78 ? 'PASS' : 'FAIL' },
    { Category: 'Reminder', Calls: purposeMap.reminder.calls, 'Unique People': purposeMap.reminder.contacts.size, Status: purposeMap.reminder.calls === 23 ? 'PASS' : 'FAIL' },
    { Category: 'Unknown / Legacy', Calls: purposeMap.unknown_legacy.calls, 'Unique People': purposeMap.unknown_legacy.contacts.size, Status: purposeMap.unknown_legacy.calls === 1986 ? 'PASS' : 'FAIL' },
    { Category: 'TOTAL', Calls: events.length, 'Unique People': new Set(contacts.map(c => c._id.toString())).size, Status: events.length === 2094 ? 'PASS' : 'FAIL' }
  ];

  console.log('\n3. CALL PURPOSE RECONCILIATION TABLE:');
  console.table(purposeTable);

  // 4. ATTENDER RECONCILIATION
  const attenderCalls = {};
  events.forEach(e => {
    attenderCalls[e.attenderId] = (attenderCalls[e.attenderId] || 0) + 1;
  });

  const testAttenderDoc = attenders.find(a => a.id === 'JW20HztSjMfwNbVaCpxz');
  const test2AttenderDoc = attenders.find(a => a.id === 'hbMzjgMkmYa0D6ysM9RA');

  const testContacts = contacts.filter(c => (c.attenderId || c.assignedTo) === 'JW20HztSjMfwNbVaCpxz' || (c.attenderName || '').trim() === 'Test');
  const test2Contacts = contacts.filter(c => (c.attenderId || c.assignedTo) === 'hbMzjgMkmYa0D6ysM9RA' || (c.attenderName || '').trim() === 'Test 2');

  const attenderTable = [
    {
      Attender: 'Test',
      ID: 'JW20HztSjMfwNbVaCpxz',
      MasterInDB: testAttenderDoc ? 'EXISTS' : 'MISSING',
      ContactsCount: testContacts.length,
      ExpectedContacts: 73,
      ContactParity: testContacts.length === 73 ? 'PASS' : 'FAIL',
      CallsCount: attenderCalls['JW20HztSjMfwNbVaCpxz'] || 0,
      ExpectedCalls: 130,
      CallParity: (attenderCalls['JW20HztSjMfwNbVaCpxz'] || 0) === 130 ? 'PASS' : 'FAIL'
    },
    {
      Attender: 'Test 2',
      ID: 'hbMzjgMkmYa0D6ysM9RA',
      MasterInDB: test2AttenderDoc ? 'EXISTS' : 'MISSING',
      ContactsCount: test2Contacts.length,
      ExpectedContacts: 3,
      ContactParity: test2Contacts.length === 3 ? 'PASS' : 'FAIL',
      CallsCount: attenderCalls['hbMzjgMkmYa0D6ysM9RA'] || 0,
      ExpectedCalls: 9,
      CallParity: (attenderCalls['hbMzjgMkmYa0D6ysM9RA'] || 0) === 9 ? 'PASS' : 'FAIL'
    }
  ];

  console.log('\n4. TEST & TEST 2 ATTENDER RECONCILIATION TABLE:');
  console.table(attenderTable);

  await client.close();
}

reconcile().catch(console.error);
