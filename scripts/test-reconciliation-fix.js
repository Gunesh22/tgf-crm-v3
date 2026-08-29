// scripts/test-reconciliation-fix.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log('=== VERIFYING FULL DATABASE RECONCILIATION BASELINE ===\n');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  console.log(`Total Contacts:                    ${contacts.length}`);
  console.log(`Total Registrations:               ${registrations.length}`);

  let totalCallEvents = 0;
  let totalCallsWithCallId = 0;
  let totalCallsLegacyNoCallId = 0;

  const attenderCalls = {};
  const attenderIncoming = {};
  const attenderOutgoing = {};
  const attenderInterested = {};
  const attenderRegDone = {};

  contacts.forEach(c => {
    const history = Array.isArray(c.history) ? c.history : [];
    totalCallEvents += history.length;

    history.forEach(h => {
      if (h.callId) totalCallsWithCallId++;
      else totalCallsLegacyNoCallId++;

      // Canonical Attender resolution
      const attId = h.attenderId || c.attenderId || 'unknown';
      const attName = h.attenderName || c.attenderName || 'Unknown';

      // Map alias IDs to canonical IDs
      let canonicalId = attId;
      if (['ZJQsev2aLqi2ispr3j74', 'Priyanka'].includes(attId) || attName.toLowerCase().includes('priyanka')) canonicalId = 'ZJQsev2aLqi2ispr3j74';
      else if (['WbND9Oa4yPUuWXVyibb3', 'Geeta'].includes(attId) || attName.toLowerCase().includes('geeta')) canonicalId = 'WbND9Oa4yPUuWXVyibb3';
      else if (['9VZZnV00X63PzUSaGTgq', 'Manisha'].includes(attId) || attName.toLowerCase().includes('manisha')) canonicalId = '9VZZnV00X63PzUSaGTgq';

      attenderCalls[canonicalId] = (attenderCalls[canonicalId] || 0) + 1;

      const cType = (h.callType || 'outgoing').toLowerCase();
      if (cType.startsWith('in')) {
        attenderIncoming[canonicalId] = (attenderIncoming[canonicalId] || 0) + 1;
      } else {
        attenderOutgoing[canonicalId] = (attenderOutgoing[canonicalId] || 0) + 1;
      }

      const status = (h.status || '').toLowerCase();
      if (status === 'interested' || status.includes('interested')) {
        attenderInterested[canonicalId] = (attenderInterested[canonicalId] || 0) + 1;
      }
      if (status === 'reg.done' || status.includes('reg')) {
        attenderRegDone[canonicalId] = (attenderRegDone[canonicalId] || 0) + 1;
      }
    });
  });

  console.log(`Total Call Events in History:      ${totalCallEvents}`);
  console.log(`Calls with callId:                 ${totalCallsWithCallId}`);
  console.log(`Legacy Calls without callId:       ${totalCallsLegacyNoCallId}\n`);

  console.log('--- RECONCILED ATTENDER HISTORICAL CALL EVENTS (DIRECT DB) ---');
  const attenderSummary = [
    { attenderId: 'ZJQsev2aLqi2ispr3j74', name: 'Priyanka', totalCalls: attenderCalls['ZJQsev2aLqi2ispr3j74'] || 0, incoming: attenderIncoming['ZJQsev2aLqi2ispr3j74'] || 0, outgoing: attenderOutgoing['ZJQsev2aLqi2ispr3j74'] || 0 },
    { attenderId: 'WbND9Oa4yPUuWXVyibb3', name: 'Geeta', totalCalls: attenderCalls['WbND9Oa4yPUuWXVyibb3'] || 0, incoming: attenderIncoming['WbND9Oa4yPUuWXVyibb3'] || 0, outgoing: attenderOutgoing['WbND9Oa4yPUuWXVyibb3'] || 0 },
    { attenderId: '9VZZnV00X63PzUSaGTgq', name: 'Manisha', totalCalls: attenderCalls['9VZZnV00X63PzUSaGTgq'] || 0, incoming: attenderIncoming['9VZZnV00X63PzUSaGTgq'] || 0, outgoing: attenderOutgoing['9VZZnV00X63PzUSaGTgq'] || 0 },
    { attenderId: 'Legacy / Other', name: 'Legacy / Unassigned', totalCalls: totalCallEvents - ((attenderCalls['ZJQsev2aLqi2ispr3j74'] || 0) + (attenderCalls['WbND9Oa4yPUuWXVyibb3'] || 0) + (attenderCalls['9VZZnV00X63PzUSaGTgq'] || 0)), incoming: 0, outgoing: 0 }
  ];

  console.table(attenderSummary);

  await client.close();
}

main().catch(console.error);
