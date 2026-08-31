// scripts/compare-dashboard-vs-report-callids.js
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI missing!");
  process.exit(1);
}

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

async function runTrace() {
  console.log("==========================================================");
  console.log(" STEP 1: TRACING CALL IDs (DASHBOARD VS MONTHLY REPORT)");
  console.log("==========================================================");

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-08-31T23:59:59.999Z");

  const reportCallIds = [];
  const dashboardCallIds = [];

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        const callId = h.callId || h.id || `legacy_${c._id}_${idx}`;
        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        
        if (ts && ts >= augStart && ts <= augEnd) {
          // Report logic: all history items in date range
          reportCallIds.push(callId);

          // Let's trace how Dashboard filters history items vs Report
          dashboardCallIds.push(callId);
        }
      });
    }
  });

  console.log(`- Total Physical Calls in August (Report method): ${reportCallIds.length}`);

  // Now let's check DashboardTab.jsx filter logic trace
  let dashboardFilteredCount = 0;
  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        if (ts && ts >= augStart && ts <= augEnd) {
          dashboardFilteredCount++;
        }
      });
    }
  });

  console.log(`- Dashboard filtered call count when date filter = August 1–31 & All Attenders: ${dashboardFilteredCount}`);

  await client.close();
}

runTrace().catch(err => {
  console.error("Trace error:", err);
  process.exit(1);
});
