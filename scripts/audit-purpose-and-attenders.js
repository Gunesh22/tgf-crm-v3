// scripts/audit-purpose-and-attenders.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function audit() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('====================================================');
  console.log('READ-ONLY AUDIT: CALL PURPOSE & ATTENDER VISIBILITY');
  console.log('====================================================\n');

  const contactsCol = db.collection('contacts');
  const attendersCol = db.collection('attenders');

  const contacts = await contactsCol.find({}).toArray();
  const attenders = await attendersCol.find({}).toArray();

  // ---------------------------------------------------------
  // 1. CALL PURPOSE DEEP-DIVE AUDIT
  // ---------------------------------------------------------
  console.log('----------------------------------------------------');
  console.log('1. CALL PURPOSE DISTRIBUTION IN MONGODB HISTORY');
  console.log('----------------------------------------------------');

  let totalCallEvents = 0;
  const rawPurposeCounts = { sales: 0, query: 0, reminder: 0, missing: 0 };
  const rawCallPurposeCounts = { sales: 0, query: 0, reminder: 0, missing: 0 };

  const explicitSales = [];
  const explicitQuery = [];
  const explicitReminder = [];
  const legacyNoPurpose = [];

  const evidenceQuery = [];
  const evidenceReminder = [];
  const ambiguousLegacy = [];

  const isConnected = (status) => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    const unconn = ['na', 'busy', 'call cut', 'switched off', 'invalid no', 'no network', 'wrong no.', 'not picked up', 'no answer'];
    return !unconn.some(u => s.includes(u));
  };

  contacts.forEach(c => {
    const cId = c._id.toString();
    const cName = c.Name || c.name || c.contactName || '';
    const cPhone = c.Phone || c.phone || c.contactPhone || '';

    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        totalCallEvents++;
        const p = h.purpose ? String(h.purpose).toLowerCase().trim() : '';
        const cp = h.callPurpose ? String(h.callPurpose).toLowerCase().trim() : '';
        const remark = (h.remark || h.comment || c.remark || '').toLowerCase();
        const status = (h.status || c.status || '').toLowerCase();
        const calledFor = (h.calledFor || c.calledFor || '').toLowerCase();

        if (p) rawPurposeCounts[p] = (rawPurposeCounts[p] || 0) + 1;
        else rawPurposeCounts.missing++;

        if (cp) rawCallPurposeCounts[cp] = (rawCallPurposeCounts[cp] || 0) + 1;
        else rawCallPurposeCounts.missing++;

        const effectivePurpose = cp || p;

        const eventRecord = {
          contactId: cId,
          contactName: cName,
          contactPhone: cPhone,
          status: h.status || c.status || '',
          remark: h.remark || h.comment || '',
          calledFor: h.calledFor || c.calledFor || '',
          attenderId: h.attenderId || c.attenderId || 'unassigned',
          attenderName: h.attenderName || c.attenderName || 'Unassigned',
          purposeField: effectivePurpose,
          isConnected: isConnected(h.status || c.status)
        };

        if (effectivePurpose === 'sales') {
          explicitSales.push(eventRecord);
        } else if (effectivePurpose === 'query') {
          explicitQuery.push(eventRecord);
        } else if (effectivePurpose === 'reminder') {
          explicitReminder.push(eventRecord);
        } else {
          legacyNoPurpose.push(eventRecord);

          // Check evidence for query
          const isQueryEvidence = remark.includes('query') || remark.includes('doubt') || remark.includes('question') || remark.includes('asking about') || status.includes('query');
          // Check evidence for reminder
          const isReminderEvidence = remark.includes('reminder') || remark.includes('remind') || remark.includes('payment link') || remark.includes('session link') || remark.includes('zoom link');

          if (isQueryEvidence) {
            evidenceQuery.push(eventRecord);
          } else if (isReminderEvidence) {
            evidenceReminder.push(eventRecord);
          } else {
            ambiguousLegacy.push(eventRecord);
          }
        }
      });
    }
  });

  console.log(`Total Historical Call Events in MongoDB: ${totalCallEvents}`);
  console.log(`- Raw 'purpose' field breakdown:`, rawPurposeCounts);
  console.log(`- Raw 'callPurpose' field breakdown:`, rawCallPurposeCounts);
  console.log(`- Legacy call events with NO purpose field: ${legacyNoPurpose.length}`);

  // Summary helper
  const calcMetrics = (events) => {
    const calls = events.length;
    const people = new Set(events.map(e => e.contactId)).size;
    const connected = events.filter(e => e.isConnected).length;
    const rate = calls > 0 ? ((connected / calls) * 100).toFixed(1) : '0.0';
    return { calls, people, connected, rate };
  };

  const mExplicitSales = calcMetrics(explicitSales);
  const mExplicitQuery = calcMetrics(explicitQuery);
  const mExplicitReminder = calcMetrics(explicitReminder);
  const mEvidenceQuery = calcMetrics(evidenceQuery);
  const mEvidenceReminder = calcMetrics(evidenceReminder);
  const mAmbiguousLegacy = calcMetrics(ambiguousLegacy);

  console.log('\n--- BREAKDOWN BY CLASSIFICATION ---');
  console.log(`1. Explicit Sales (V2 explicit purpose):    ${mExplicitSales.calls} calls | ${mExplicitSales.people} people | Connected: ${mExplicitSales.rate}%`);
  console.log(`2. Explicit Query (V2 explicit purpose):    ${mExplicitQuery.calls} calls | ${mExplicitQuery.people} people | Connected: ${mExplicitQuery.rate}%`);
  console.log(`3. Explicit Reminder (V2 explicit purpose): ${mExplicitReminder.calls} calls | ${mExplicitReminder.people} people | Connected: ${mExplicitReminder.rate}%`);
  console.log(`4. Confident Query (Evidence in remarks):   ${mEvidenceQuery.calls} calls | ${mEvidenceQuery.people} people | Connected: ${mEvidenceQuery.rate}%`);
  console.log(`5. Confident Reminder (Evidence in remarks):${mEvidenceReminder.calls} calls | ${mEvidenceReminder.people} people | Connected: ${mEvidenceReminder.rate}%`);
  console.log(`6. Unknown / Legacy / Unclassified:         ${mAmbiguousLegacy.calls} calls | ${mAmbiguousLegacy.people} people | Connected: ${mAmbiguousLegacy.rate}%`);

  // Aggregate proposed final classifications
  const finalSales = explicitSales;
  const finalQuery = [...explicitQuery, ...evidenceQuery];
  const finalReminder = [...explicitReminder, ...evidenceReminder];
  const finalUnknown = ambiguousLegacy;

  const mFinalSales = calcMetrics(finalSales);
  const mFinalQuery = calcMetrics(finalQuery);
  const mFinalReminder = calcMetrics(finalReminder);
  const mFinalUnknown = calcMetrics(finalUnknown);

  console.log('\n--- PROPOSED FINAL DISTRIBUTION TABLE ---');
  const summaryTable = [
    { Category: 'Sales', Calls: mFinalSales.calls, 'Unique People': mFinalSales.people, 'Connected Rate': `${mFinalSales.rate}%` },
    { Category: 'Query', Calls: mFinalQuery.calls, 'Unique People': mFinalQuery.people, 'Connected Rate': `${mFinalQuery.rate}%` },
    { Category: 'Reminder', Calls: mFinalReminder.calls, 'Unique People': mFinalReminder.people, 'Connected Rate': `${mFinalReminder.rate}%` },
    { Category: 'Unknown / Legacy', Calls: mFinalUnknown.calls, 'Unique People': mFinalUnknown.people, 'Connected Rate': `${mFinalUnknown.rate}%` },
    { Category: 'TOTAL', Calls: totalCallEvents, 'Unique People': new Set(contacts.map(c => c._id.toString())).size, 'Connected Rate': '-' }
  ];
  console.table(summaryTable);

  // ---------------------------------------------------------
  // 2. ATTENDER AUDIT (TEST & TEST 2)
  // ---------------------------------------------------------
  console.log('\n----------------------------------------------------');
  console.log('2. TEST AND TEST 2 ATTENDER RECONCILIATION LAYER BY LAYER');
  console.log('----------------------------------------------------');

  console.log('\n[LAYER A: MONGODB ATTENDERS COLLECTION]');
  attenders.forEach(a => {
    console.log(`  * _id: ${a._id.toString()} | id: "${a.id}" | name: "${a.name}" | role: "${a.role}" | isActive: ${a.isActive}`);
  });

  const testMasterDoc = attenders.find(a => a.id === 'JW20HztSjMfwNbVaCpxz' || a.name === 'Test');
  const test2MasterDoc = attenders.find(a => a.id === 'hbMzjgMkmYa0D6ysM9RA' || a.name === 'Test 2');

  console.log('\n[LAYER B: MONGODB CONTACTS & CALL HISTORY RECORDS]');

  // Test
  const testContactsByAttenderId = contacts.filter(c => c.attenderId === 'JW20HztSjMfwNbVaCpxz' || c.assignedTo === 'JW20HztSjMfwNbVaCpxz');
  const testContactsByAttenderName = contacts.filter(c => c.attenderName === 'Test');
  let testHistoryByAttenderId = 0;
  let testHistoryByAttenderName = 0;

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        if (h.attenderId === 'JW20HztSjMfwNbVaCpxz') testHistoryByAttenderId++;
        if (h.attenderName === 'Test') testHistoryByAttenderName++;
      });
    }
  });

  // Test 2
  const test2ContactsByAttenderId = contacts.filter(c => c.attenderId === 'hbMzjgMkmYa0D6ysM9RA' || c.assignedTo === 'hbMzjgMkmYa0D6ysM9RA');
  const test2ContactsByAttenderName = contacts.filter(c => c.attenderName === 'Test 2');
  let test2HistoryByAttenderId = 0;
  let test2HistoryByAttenderName = 0;

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        if (h.attenderId === 'hbMzjgMkmYa0D6ysM9RA') test2HistoryByAttenderId++;
        if (h.attenderName === 'Test 2') test2HistoryByAttenderName++;
      });
    }
  });

  console.log(`\nTest (JW20HztSjMfwNbVaCpxz):`);
  console.log(`  - Master Record in DB: ${testMasterDoc ? `FOUND (_id: ${testMasterDoc._id}, id: "${testMasterDoc.id}", name: "${testMasterDoc.name}")` : 'NOT FOUND'}`);
  console.log(`  - Contacts matching attenderId == 'JW20HztSjMfwNbVaCpxz': ${testContactsByAttenderId.length}`);
  console.log(`  - Contacts matching attenderName == 'Test':             ${testContactsByAttenderName.length}`);
  console.log(`  - History events matching attenderId == 'JW20HztSjMfwNbVaCpxz': ${testHistoryByAttenderId}`);
  console.log(`  - History events matching attenderName == 'Test':             ${testHistoryByAttenderName}`);

  console.log(`\nTest 2 (hbMzjgMkmYa0D6ysM9RA):`);
  console.log(`  - Master Record in DB: ${test2MasterDoc ? `FOUND (_id: ${test2MasterDoc._id}, id: "${test2MasterDoc.id}", name: "${test2MasterDoc.name}")` : 'NOT FOUND'}`);
  console.log(`  - Contacts matching attenderId == 'hbMzjgMkmYa0D6ysM9RA': ${test2ContactsByAttenderId.length}`);
  console.log(`  - Contacts matching attenderName == 'Test 2':             ${test2ContactsByAttenderName.length}`);
  console.log(`  - History events matching attenderId == 'hbMzjgMkmYa0D6ysM9RA': ${test2HistoryByAttenderId}`);
  console.log(`  - History events matching attenderName == 'Test 2':             ${test2HistoryByAttenderName}`);

  await client.close();
}

audit().catch(console.error);
