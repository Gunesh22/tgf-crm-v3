// scripts/test-dashboard-2094.js
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

  const list = [];
  const seenCallKeys = new Set();

  contacts.forEach(log => {
    const contactName = log.Name || log.name || 'Unknown';
    const contactPhone = log.Phone || log.phone || log.Mobile || log.mobile || '';
    const hasTopHistory = Array.isArray(log.history) && log.history.length > 0;
    const hasAttenderStates = log.attenderStates && typeof log.attenderStates === 'object' && Object.keys(log.attenderStates).length > 0;

    // 1. Extract ALL physical call events from contact.history
    if (hasTopHistory) {
      log.history.forEach((h, index) => {
        const attId = h.attenderId || log.attenderId || 'legacy';
        const attName = h.attenderName || log.attenderName || 'Legacy Attender';
        const canonicalStatus = getCanonicalStatus(h.status || 'Pending');
        const callKey = `${log._id}_h_${index}`;

        if (!seenCallKeys.has(callKey)) {
          seenCallKeys.add(callKey);
          list.push({
            id: `${log._id}_h_${index}`,
            contactId: String(log._id),
            name: contactName,
            phone: contactPhone,
            attenderId: attId,
            attenderName: attName,
            status: canonicalStatus,
            remark: h.remark || '',
            callType: h.callType || 'outgoing',
            calledFor: h.calledFor || log.calledFor || '',
            source: h.source || log.source || '',
            timestamp: h.timestamp || h.date || h.createdAt || log.createdAt,
            isHistory: true
          });
        }
      });
    }

    // 2. Extract fallback/latest state attempts per attender if status/remark present without history entry
    if (hasAttenderStates) {
      Object.entries(log.attenderStates).forEach(([attId, state]) => {
        if (!state) return;
        const stateAttName = state.attenderName || 'Unknown';
        const stateHasHistory = Array.isArray(state.history) && state.history.length > 0;
        if (!stateHasHistory && (state.lastCalledAt || (state.status && state.status !== 'Pending') || state.remark)) {
          const canonicalStatus = getCanonicalStatus(state.status || 'Pending');
          list.push({
            id: `${log._id}_${attId}_latest`,
            contactId: String(log._id),
            name: contactName,
            phone: contactPhone,
            attenderId: attId,
            attenderName: stateAttName,
            status: canonicalStatus,
            remark: state.remark || '',
            callType: state.callType || 'outgoing',
            calledFor: state.calledFor || log.calledFor || '',
            source: state.source || log.source || '',
            timestamp: state.lastCalledAt || log.createdAt,
            isHistory: false
          });
        }
      });
    } else if (!hasTopHistory) {
      if (log.lastCalledAt || (log.status && log.status !== 'Pending') || log.remark) {
        const canonicalStatus = getCanonicalStatus(log.status || 'Pending');
        list.push({
          id: `${log._id}_legacy_latest`,
          contactId: String(log._id),
          name: contactName,
          phone: contactPhone,
          attenderId: log.attenderId || 'legacy',
          attenderName: log.attenderName || 'Legacy Attender',
          status: canonicalStatus,
          remark: log.remark || '',
          callType: log.callType || 'outgoing',
          calledFor: log.calledFor || '',
          source: log.source || '',
          timestamp: log.lastCalledAt || log.createdAt,
          isHistory: false
        });
      }
    }
  });

  const physicalCallsCount = list.filter(l => l.isHistory).length;
  const fallbackActivityCount = list.filter(l => !l.isHistory).length;

  console.log(`- Physical Call Events (isHistory === true): ${physicalCallsCount} (Expected: 2,094) ${physicalCallsCount === 2094 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`- Fallback Attender State Events (isHistory === false): ${fallbackActivityCount}`);
  console.log(`- Total Flattened Activity Items: ${list.length}`);

  // Calculate Registered People (unique contacts in 6. Registered / Won)
  const registeredPeopleCount = contacts.filter(c => c.pipelineStage === '6. Registered / Won').length;
  console.log(`- Registered People (pipelineStage === '6. Registered / Won'): ${registeredPeopleCount} (Expected: 183) ${registeredPeopleCount === 183 ? 'PASS ✅' : 'FAIL ❌'}`);

  await client.close();
}

main().catch(console.error);
