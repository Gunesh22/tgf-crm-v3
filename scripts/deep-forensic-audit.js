// scripts/deep-forensic-audit.js
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

async function runDeepAudit() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  const augStart = "2026-08-01";
  const augEnd = "2026-08-31";

  // 1. Raw Status Distribution in August calls
  const augCallStatusCounts = {};
  let totalAugHistoryCalls = 0;

  contacts.forEach(c => {
    if (c._deleted) return;
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        if (ts) {
          const dStr = getLocalDateStr(ts);
          if (dStr >= augStart && dStr <= augEnd) {
            totalAugHistoryCalls++;
            const s = (h.status || "Pending").trim();
            augCallStatusCounts[s] = (augCallStatusCounts[s] || 0) + 1;
          }
        }
      });
    }
  });

  console.log("==========================================================================");
  console.log(" DEEP RAW DATA AUDIT - AUGUST CALL STATUS DISTRIBUTION");
  console.log("==========================================================================");
  console.log(`Total Physical History Calls in August: ${totalAugHistoryCalls}\n`);
  console.log("Raw Status | Count | classifyCallStatus() | Pipeline Old Filter");
  console.log("------------------------------------------------------------------");

  const NOT_CONNECTED_EXPLICIT = ["NA", "Busy", "Call Cut", "switched off", "Invalid No", "Called by mistake", "No Network", "wrong no.", "no answer"];

  let reportConnected = 0;
  let reportNotConnected = 0;
  let pipelineConnected = 0;
  let pipelineNotConnected = 0;

  Object.entries(augCallStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([rawStatus, count]) => {
    const sLower = rawStatus.toLowerCase();
    
    // Monthly Report / utils classification logic
    const isReportNotConn = NOT_CONNECTED_EXPLICIT.includes(rawStatus) ||
      sLower.includes("busy") || sLower.includes("call cut") || sLower.includes("switched off") ||
      sLower.includes("invalid") || sLower.includes("no answer") || sLower.includes("no network") ||
      sLower.includes("wrong no") || sLower.includes("not picked") || sLower.includes("no response") ||
      sLower.includes("not reachable") || sLower.includes("unreachable");
    
    const reportClass = isReportNotConn ? "NOT_CONNECTED" : "CONNECTED";
    if (reportClass === "CONNECTED") reportConnected += count;
    else reportNotConnected += count;

    // Pipeline old loose negative filter logic
    const isPipelineNotConn = (rawStatus === "NA" || rawStatus === "Busy" || rawStatus === "Call Cut" || rawStatus === "switched off" || rawStatus === "Invalid No" || rawStatus === "No Network" || rawStatus === "wrong no.");
    const pipelineClass = isPipelineNotConn ? "NOT_CONNECTED" : "CONNECTED";
    if (pipelineClass === "CONNECTED") pipelineConnected += count;
    else pipelineNotConnected += count;

    console.log(`${rawStatus.padEnd(20)} | ${String(count).padStart(5)} | ${reportClass.padEnd(13)} | ${pipelineClass}`);
  });

  console.log("\n--- RECONCILIATION COMPARISON ---");
  console.log(`Report Method (classifyCallStatus) : ${reportConnected} Connected, ${reportNotConnected} Not Connected (Total: ${reportConnected + reportNotConnected})`);
  console.log(`Pipeline Method (loose exclusion) : ${pipelineConnected} Connected, ${pipelineNotConnected} Not Connected (Total: ${pipelineConnected + pipelineNotConnected})`);
  console.log(`Difference in Connected count       : ${pipelineConnected - reportConnected} calls (Loose pipeline filter incorrectly counted 'no answer', 'Called by mistake', 'Pending' as Connected)`);

  // Shared Contacts
  const sharedContacts = contacts.filter(c => Array.isArray(c.assignedTo) && c.assignedTo.length > 1);
  console.log(`\n- Shared Contacts Count (assignedTo.length > 1): ${sharedContacts.length}`);

  await client.close();
}

runDeepAudit().catch(console.error);
