// scripts/test-dashboard-is-history.js
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
  contacts.forEach(log => {
    const contactName = log.Name || log.name || 'Unknown';
    const contactPhone = log.Phone || log.phone || log.Mobile || log.mobile || '';
    const hasAttenderStates = log.attenderStates && typeof log.attenderStates === 'object' && Object.keys(log.attenderStates).length > 0;
    const hasTopHistory = Array.isArray(log.history) && log.history.length > 0;
    const seenEventKeys = new Set();

    const addAttemptIfNew = (status, dateVal, remark, callType, source, calledFor, attId, attName, isHistory, index, stateObj) => {
      const canonicalStatus = getCanonicalStatus(status || 'Pending');
      const eventKey = isHistory
        ? `${log._id}_${attId}_h${index}_${canonicalStatus}`
        : `${log._id}_${attId}_latest_${canonicalStatus}`;
      if (seenEventKeys.has(eventKey)) return;
      seenEventKeys.add(eventKey);

      list.push({
        contactId: String(log._id),
        name: contactName,
        attenderId: attId,
        attenderName: attName || 'Unknown',
        status: canonicalStatus,
        isHistory
      });
    };

    if (hasAttenderStates) {
      Object.entries(log.attenderStates).forEach(([attId, state]) => {
        if (!state) return;
        const stateAttName = state.attenderName || 'Unknown';
        const hasStateHistory = Array.isArray(state.history) && state.history.length > 0;
        if (hasStateHistory) {
          state.history.forEach((h, index) => {
            addAttemptIfNew(h.status, h.timestamp, h.remark, h.callType, h.source, h.calledFor, attId, h.attenderName || stateAttName, true, index, state);
          });
        }
        if (state.lastCalledAt || (state.status && state.status !== 'Pending') || state.remark) {
          addAttemptIfNew(state.status, state.lastCalledAt, state.remark, state.callType, state.source, state.calledFor, attId, stateAttName, false, 0, state);
        }
      });
    }

    if (hasTopHistory) {
      const coveredAttenderIds = hasAttenderStates ? new Set(Object.keys(log.attenderStates)) : new Set();
      log.history.forEach((h, index) => {
        const itemAttId = h.attenderId || log.attenderId || 'legacy';
        if (coveredAttenderIds.has(itemAttId)) return;
        const itemAttName = h.attenderName || log.attenderName || 'Legacy Attender';
        addAttemptIfNew(h.status, h.timestamp, h.remark, h.callType, h.source, h.calledFor, itemAttId, itemAttName, true, index, { attenderName: itemAttName });
      });
    }

    if (!hasAttenderStates && !hasTopHistory) {
      const mainAttId = log.attenderId || 'unassigned';
      addAttemptIfNew(log.status, log.updatedAt, log.remark, log.callType, log.source, log.calledFor, mainAttId, log.attenderName, false, 0, {});
    }
  });

  const isHistoryCount = list.filter(l => l.isHistory).length;
  const isFallbackCount = list.filter(l => !l.isHistory).length;

  console.log(`- Total Flattened Events: ${list.length}`);
  console.log(`- Physical History Events (isHistory === true): ${isHistoryCount}`);
  console.log(`- Attender Fallback Events (isHistory === false): ${isFallbackCount}`);

  // Let's check why isHistoryCount is 2,077 instead of 2,094
  // Let's check contacts where top-level history is not fully captured in attenderStates
  let missingHistoryCount = 0;
  contacts.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    if (hist.length > 0) {
      // count how many history entries in c.history
      const coveredInList = list.filter(l => l.contactId === String(c._id) && l.isHistory).length;
      if (coveredInList < hist.length) {
        missingHistoryCount += (hist.length - coveredInList);
      }
    }
  });

  console.log(`- History entries in contact.history not captured in attenderStates.history: ${missingHistoryCount}`);

  await client.close();
}

main().catch(console.error);
