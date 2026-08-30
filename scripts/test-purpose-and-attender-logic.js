// scripts/test-purpose-and-attender-logic.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export const getCallPurpose = (h, contact) => {
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

async function test() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  const attenderMap = {};
  attenders.forEach(a => {
    attenderMap[a.name.toLowerCase().trim()] = a.id || a._id.toString();
  });

  const events = [];
  let totalHistoryCount = 0;

  contacts.forEach(c => {
    const cId = c._id.toString();
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        totalHistoryCount++;

        let attId = h.attenderId || c.attenderId || 'unassigned';
        let attName = h.attenderName || c.attenderName || 'Unassigned Attender';

        if ((!attId || attId === 'unassigned') && attName) {
          const matched = (attenders || []).find(a => (a.name || '').trim().toLowerCase() === attName.trim().toLowerCase());
          if (matched) {
            attId = matched.id || matched._id.toString();
          }
        }

        const purpose = getCallPurpose(h, c);

        events.push({
          callId: h.callId || `history_${cId}_${idx}`,
          contactId: cId,
          attenderId: attId,
          attenderName: attName,
          purpose,
          status: h.status || c.status || ''
        });
      });
    }
  });

  console.log(`Total Extracted History Events: ${events.length} (Matches DB history: ${events.length === 2094})`);

  // Purpose Aggregation
  const purposeMap = {
    sales: { calls: 0, contacts: new Set() },
    query: { calls: 0, contacts: new Set() },
    reminder: { calls: 0, contacts: new Set() },
    unknown_legacy: { calls: 0, contacts: new Set() }
  };

  events.forEach(e => {
    purposeMap[e.purpose].calls++;
    purposeMap[e.purpose].contacts.add(e.contactId);
  });

  console.log('\nPURPOSE METRICS:');
  const purposeRows = Object.entries(purposeMap).map(([p, data]) => ({
    Purpose: p,
    Calls: data.calls,
    UniquePeople: data.contacts.size
  }));
  console.table(purposeRows);

  // Attender Aggregation
  const attenderPerformanceMap = {};
  attenders.forEach(a => {
    attenderPerformanceMap[a.id || a._id.toString()] = {
      name: a.name,
      calls: 0,
      contacts: new Set()
    };
  });

  events.forEach(e => {
    const attId = e.attenderId;
    if (!attenderPerformanceMap[attId]) {
      attenderPerformanceMap[attId] = {
        name: e.attenderName,
        calls: 0,
        contacts: new Set()
      };
    }
    attenderPerformanceMap[attId].calls++;
    attenderPerformanceMap[attId].contacts.add(e.contactId);
  });

  const testPerf = attenderPerformanceMap['JW20HztSjMfwNbVaCpxz'];
  const test2Perf = attenderPerformanceMap['hbMzjgMkmYa0D6ysM9RA'];

  // Test contacts directly
  const testContacts = contacts.filter(c => (c.attenderId || c.assignedTo) === 'JW20HztSjMfwNbVaCpxz');
  const test2Contacts = contacts.filter(c => (c.attenderId || c.assignedTo) === 'hbMzjgMkmYa0D6ysM9RA');

  console.log('\nATTENDER RECONCILIATION:');
  console.log(`Test (JW20HztSjMfwNbVaCpxz):`);
  console.log(`  - Calls: ${testPerf ? testPerf.calls : 0} (Expected: 130) -> ${testPerf && testPerf.calls === 130 ? 'PASS' : 'FAIL'}`);
  console.log(`  - Contacts: ${testContacts.length} (Expected: 73) -> ${testContacts.length === 73 ? 'PASS' : 'FAIL'}`);

  console.log(`Test 2 (hbMzjgMkmYa0D6ysM9RA):`);
  console.log(`  - Calls: ${test2Perf ? test2Perf.calls : 0} (Expected: 9) -> ${test2Perf && test2Perf.calls === 9 ? 'PASS' : 'FAIL'}`);
  console.log(`  - Contacts: ${test2Contacts.length} (Expected: 3) -> ${test2Contacts.length === 3 ? 'PASS' : 'FAIL'}`);

  await client.close();
}

test().catch(console.error);
