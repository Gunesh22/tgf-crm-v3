// scripts/investigate-report-attender-states.js
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

async function runInvestigate() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contacts = await db.collection('contacts').find({}).toArray();

  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-08-31T23:59:59.999Z");

  // 1. Strict Physical calls from history[]
  let physicalCallsInAug = 0;
  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        if (ts && ts >= augStart && ts <= augEnd) {
          physicalCallsInAug++;
        }
      });
    }
  });

  // 2. Report method (includes attenderStates + history)
  let reportAttemptsInAug = 0;
  contacts.forEach(c => {
    const rawAttempts = [];
    const seenEventKeys = new Set();

    const addAttemptIfNew = (attId, dateVal, index = 0, isHistory = false) => {
      const ts = parseTimestamp(dateVal) || parseTimestamp(c.createdAt);
      if (!ts) return;
      const eventKey = isHistory ? `${c._id}_${attId}_h${index}` : `${c._id}_${attId}_latest`;
      if (seenEventKeys.has(eventKey)) return;
      seenEventKeys.add(eventKey);

      if (ts >= augStart && ts <= augEnd) {
        rawAttempts.push({ ts, attId });
      }
    };

    if (c.attenderStates && typeof c.attenderStates === "object") {
      Object.entries(c.attenderStates).forEach(([attId, state]) => {
        if (!state) return;
        if (state.history && Array.isArray(state.history) && state.history.length > 0) {
          state.history.forEach((h, idx) => {
            addAttemptIfNew(attId, h.timestamp || h.date || state.lastCalledAt, idx, true);
          });
        }
        if (state.lastCalledAt || (state.status && state.status !== "Pending")) {
          addAttemptIfNew(attId, state.lastCalledAt || c.createdAt, 0, false);
        }
      });
    }

    if (c.history && Array.isArray(c.history) && c.history.length > 0) {
      c.history.forEach((h, idx) => {
        addAttemptIfNew(h.attenderId || "legacy", h.timestamp || h.date || c.createdAt, idx, true);
      });
    }

    reportAttemptsInAug += rawAttempts.length;
  });

  console.log(`- Strict Physical Calls in August (contacts.history[]): ${physicalCallsInAug}`);
  console.log(`- Report Method (attenderStates + history + fallbacks) : ${reportAttemptsInAug}`);

  await client.close();
}

runInvestigate().catch(console.error);
