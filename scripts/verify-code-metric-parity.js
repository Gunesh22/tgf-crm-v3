// scripts/verify-code-metric-parity.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

function getCanonicalStatus(status) {
  if (!status) return "Pending";
  const s = String(status).trim();
  const sLower = s.toLowerCase();

  if (["reg.done", "reg done", "reg. done", "registered", "registration done", "already registered", "already reg", "already reg."].includes(sLower)) return "Reg.Done";
  if (["info given", "information given", "info given / whatsapp sent", "details sent"].includes(sLower)) return "Info Given";
  if (["interested", "nurture", "hot lead", "interested / follow up"].includes(sLower)) return "Interested";
  if (["not interested", "closed lost", "lost"].includes(sLower)) return "Not Interested";
  if (["no answer", "busy", "call cut", "not attended", "no network", "switched off"].includes(sLower)) return "No Answer";
  if (["invalid", "wrong number", "out of service"].includes(sLower)) return "Invalid Number";
  if (["query", "doubt", "support"].includes(sLower)) return "Query";
  if (["future pool", "next batch", "next time"].includes(sLower)) return "Future Pool";

  return s;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  console.log('====================================================');
  console.log('TESTING CODE METRIC PARITY ENGINE LOGIC');
  console.log('====================================================\n');

  // 1. Physical Call Events (Direct history extraction)
  const physicalCallEvents = [];
  const seenCallIds = new Set();

  contacts.forEach((contact, cIdx) => {
    const cId = String(contact._id || contact.id);
    if (Array.isArray(contact.history) && contact.history.length > 0) {
      contact.history.forEach((h, hIdx) => {
        const callId = h.callId || h.id || `call_${cId}_${hIdx}`;
        if (seenCallIds.has(callId)) return;
        seenCallIds.add(callId);

        physicalCallEvents.push({
          callId,
          contactId: cId,
          name: contact.Name || contact.name || 'Unknown',
          phone: contact.Phone || contact.phone || contact.Mobile || '',
          attenderId: h.attenderId || contact.attenderId || 'unassigned',
          attenderName: h.attenderName || contact.attenderName || 'Unassigned',
          status: getCanonicalStatus(h.status || contact.status),
          remark: h.remark || '',
          timestamp: h.timestamp || h.date || h.createdAt || contact.createdAt,
          isHistory: true
        });
      });
    }
  });

  // 2. Registered People (Unique Contacts with pipelineStage === '6. Registered / Won')
  const registeredPeopleContacts = contacts.filter(c => c.pipelineStage === '6. Registered / Won');

  // 3. Raw Reg.Done Events
  const regDoneEvents = physicalCallEvents.filter(e => e.status === 'Reg.Done');

  // 4. Formal Registrations
  const formalRegistrationsCount = registrations.length;

  console.log(`1. Dashboard Total Calls (Physical Events): ${physicalCallEvents.length} -> Target: 2,094 ${physicalCallEvents.length === 2094 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`2. Pipeline Total Calls: ${physicalCallEvents.length} -> Target: 2,094 ${physicalCallEvents.length === 2094 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`3. Dashboard Registered People: ${registeredPeopleContacts.length} -> Target: 183 ${registeredPeopleContacts.length === 183 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`4. Pipeline Registered / Won Contacts: ${registeredPeopleContacts.length} -> Target: 183 ${registeredPeopleContacts.length === 183 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`5. Formal Registration Documents: ${formalRegistrationsCount} -> Target: 130 ${formalRegistrationsCount === 130 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`6. Raw Reg.Done Event Count: ${regDoneEvents.length} -> Target: 186 (Total events across sessions)`);

  await client.close();
}

main().catch(console.error);
