// scripts/audit-the-9-activities.js
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

function parseTimestamp(t) {
  if (!t) return null;
  if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
  if (typeof t.toDate === "function") return t.toDate();
  if (typeof t.toMillis === "function") return new Date(t.toMillis());
  if (typeof t === "object" && (t.seconds !== undefined || t._seconds !== undefined)) {
    const sec = t.seconds !== undefined ? t.seconds : t._seconds;
    const nsec = t.nanoseconds !== undefined ? t.nanoseconds : (t._nanoseconds || 0);
    return new Date(sec * 1000 + Math.round(nsec / 1000000));
  }
  if (typeof t === "number") return new Date(t);
  if (typeof t === "string") {
    const parsed = new Date(t);
    if (!isNaN(parsed.getTime())) return parsed;
    const cleaned = t.replace(/-/g, "/");
    const parsedCleaned = new Date(cleaned);
    if (!isNaN(parsedCleaned.getTime())) return parsedCleaned;
  }
  return null;
}

function getLocalDateStr(d) {
  if (!d) return "";
  const yr = d.getFullYear();
  const mn = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
}

async function auditActivities() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contacts = await db.collection('contacts').find({}).toArray();

  const dateFrom = "2026-08-01";
  const dateTo = "2026-08-31";

  const physicalCalls = [];
  const nonPhysicalActivities = [];

  contacts.forEach(log => {
    if (log._deleted) return;

    const hasTopHistory = Array.isArray(log.history) && log.history.length > 0;
    const hasAttenderStates = log.attenderStates && typeof log.attenderStates === "object" && Object.keys(log.attenderStates).length > 0;
    const seenCallKeys = new Set();

    // 1. Physical call events in log.history
    if (hasTopHistory) {
      log.history.forEach((h, index) => {
        const attemptDate = parseTimestamp(h.timestamp || h.date || h.createdAt) || parseTimestamp(log.createdAt);
        const callKey = `${log._id}_h_${index}`;
        if (!seenCallKeys.has(callKey)) {
          seenCallKeys.add(callKey);
          if (attemptDate) {
            const dStr = getLocalDateStr(attemptDate);
            if (dStr >= dateFrom && dStr <= dateTo) {
              physicalCalls.push({
                type: "history_call",
                contactId: log._id,
                name: log.Name,
                status: h.status,
                remark: h.remark,
                date: dStr
              });
            }
          }
        }
      });
    }

    // 2. Fallback attenderStates entries
    if (hasAttenderStates) {
      Object.entries(log.attenderStates).forEach(([attId, state]) => {
        if (!state) return;
        const stateHasHistory = Array.isArray(state.history) && state.history.length > 0;
        if (!stateHasHistory && (state.lastCalledAt || (state.status && state.status !== "Pending") || state.remark)) {
          const attemptDate = parseTimestamp(state.lastCalledAt) || parseTimestamp(log.createdAt);
          if (attemptDate) {
            const dStr = getLocalDateStr(attemptDate);
            if (dStr >= dateFrom && dStr <= dateTo) {
              nonPhysicalActivities.push({
                type: "attenderState_fallback",
                contactId: log._id,
                name: log.Name,
                attenderId: attId,
                status: state.status,
                remark: state.remark,
                lastCalledAt: state.lastCalledAt,
                date: dStr
              });
            }
          }
        }
      });
    } else if (!hasTopHistory) {
      if (log.lastCalledAt || (log.status && log.status !== "Pending") || log.remark) {
        const attemptDate = parseTimestamp(log.lastCalledAt) || parseTimestamp(log.createdAt);
        if (attemptDate) {
          const dStr = getLocalDateStr(attemptDate);
          if (dStr >= dateFrom && dStr <= dateTo) {
            nonPhysicalActivities.push({
              type: "standalone_log_fallback",
              contactId: log._id,
              name: log.Name,
              status: log.status,
              remark: log.remark,
              lastCalledAt: log.lastCalledAt,
              date: dStr
            });
          }
        }
      }
    }
  });

  console.log(`- Total Physical Calls in August (isHistory = true)  : ${physicalCalls.length}`);
  console.log(`- Non-Physical Activities in August (isHistory = false): ${nonPhysicalActivities.length}`);
  console.log(`- Combined Total Activities                          : ${physicalCalls.length + nonPhysicalActivities.length}`);

  console.log("\n--- EXACT NON-PHYSICAL ACTIVITIES TRACE ---");
  nonPhysicalActivities.forEach((act, i) => {
    console.log(`${i+1}. Contact: "${act.name}" (ID: ${act.contactId}) | Type: ${act.type} | Status: "${act.status}" | Remark: "${act.remark}" | Date: ${act.date}`);
  });

  await client.close();
}

auditActivities().catch(console.error);
