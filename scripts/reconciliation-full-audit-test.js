// scripts/reconciliation-full-audit-test.js
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

const PIPELINE_STAGES = {
  NEW_LEAD: "1. New Lead",
  ATTEMPTING: "2. Attempting Contact",
  INFO_GIVEN: "3. Information Given",
  NURTURE_INTERESTED: "4. Nurture / Interested",
  FUTURE_POOL: "5. Future Pool",
  REGISTERED_WON: "6. Registered / Won",
  CLOSED_LOST: "7. Closed / Lost",
  CLOSED_INVALID: "Closed / Invalid"
};

function getCanonicalStage(stageOrContact) {
  let contact = {};
  let rawStage = "";
  if (typeof stageOrContact === "string") rawStage = stageOrContact;
  else if (stageOrContact && typeof stageOrContact === "object") {
    contact = stageOrContact;
    rawStage = contact.pipelineStage || "";
  }
  if (rawStage && String(rawStage).trim() !== "" && rawStage !== "null" && rawStage !== "undefined") {
    const s = String(rawStage).trim();
    if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    if (s === "Query Desk" || s === "Query") return "Query Desk";
    if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";
  }
  return PIPELINE_STAGES.ATTEMPTING;
}

function getCanonicalStatus(status) {
  if (!status) return "";
  const sLower = status.trim().toLowerCase();
  if (sLower === "interested") return "Interested";
  if (sLower === "reg.done" || sLower === "registered") return "Reg.Done";
  if (sLower === "not interested" || sLower === "not intrested") return "Not interested";
  if (sLower === "na") return "NA";
  if (sLower === "busy") return "Busy";
  if (sLower === "call cut") return "Call Cut";
  if (sLower === "switched off") return "switched off";
  if (sLower === "invalid no") return "Invalid No";
  if (sLower === "already reg.d" || sLower === "already registered") return "Already Reg.d";
  if (sLower === "info given") return "Info given";
  if (sLower === "next time") return "Next time";
  if (sLower === "reminder") return "reminder";
  if (sLower === "query") return "Query";
  if (sLower === "called by mistake") return "Called by mistake";
  if (sLower === "not possible") return "Not possible";
  if (sLower === "shivir done") return "Shivir done";
  if (sLower === "no answer") return "no answer";
  if (sLower === "not attended") return "Not Attended";
  if (sLower === "call log added") return "Call Log Added";
  if (sLower === "no network") return "No Network";
  if (sLower === "wrong no" || sLower === "wrong no.") return "wrong no.";
  return status;
}

function classifyCallStatus(rawStatus) {
  if (!rawStatus) return "NOT_CONNECTED";
  const canonical = getCanonicalStatus(rawStatus);
  const sLower = String(rawStatus).trim().toLowerCase();

  const NOT_CONNECTED_STATUSES = ["NA", "Busy", "Call Cut", "switched off", "Invalid No", "Called by mistake", "No Network", "wrong no.", "no answer"];
  const CONNECTED_STATUSES = ["Info given", "Interested", "Reg.Done", "reminder", "Query", "Already Reg.d", "Next time", "Shivir done", "Not possible", "Pending", "Not interested", "Not Attended", "Call Log Added"];

  if (
    NOT_CONNECTED_STATUSES.includes(canonical) ||
    NOT_CONNECTED_STATUSES.some(ns => ns.toLowerCase() === sLower) ||
    sLower.includes("busy") ||
    sLower.includes("call cut") ||
    sLower.includes("switched off") ||
    sLower.includes("invalid") ||
    sLower.includes("no answer") ||
    sLower.includes("no network") ||
    sLower.includes("wrong no") ||
    sLower.includes("not picked") ||
    sLower.includes("no response") ||
    sLower.includes("not reachable") ||
    sLower.includes("unreachable")
  ) {
    return "NOT_CONNECTED";
  }

  if (
    CONNECTED_STATUSES.includes(canonical) ||
    CONNECTED_STATUSES.some(cs => cs.toLowerCase() === sLower) ||
    sLower.includes("info given") ||
    sLower.includes("interested") ||
    sLower.includes("reg.done") ||
    sLower.includes("registered") ||
    sLower.includes("reminder") ||
    sLower.includes("query") ||
    sLower.includes("shivir") ||
    sLower.includes("alumni") ||
    sLower.includes("attended")
  ) {
    return "CONNECTED";
  }

  return "NOT_CONNECTED";
}

function getCanonicalPhysicalCalls(contacts = [], filters = {}) {
  const { startDate, endDate } = filters;
  let startMs = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
  let endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

  const physicalCalls = [];
  const seenCallIds = new Set();

  (contacts || []).forEach(c => {
    if (!c || c._deleted) return;
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        const callId = h.callId || h.id || `legacy_${c._id}_${idx}`;
        if (seenCallIds.has(callId)) return;

        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        if (!ts) return;
        const timeMs = ts.getTime();
        if (startMs !== null && timeMs < startMs) return;
        if (endMs !== null && timeMs > endMs) return;

        const status = getCanonicalStatus(h.status || "Pending");
        const callType = (h.callType || h.callDirection || "outgoing").toLowerCase();

        seenCallIds.add(callId);

        physicalCalls.push({
          callId,
          contactId: String(c._id || c.id),
          attenderId: h.attenderId || c.attenderId || "legacy",
          status,
          timestamp: ts,
          timeMs,
          callType
        });
      });
    }
  });

  return physicalCalls;
}

async function runReconciliationTest() {
  console.log("==========================================================================");
  console.log(" READ-ONLY CRM ANALYTICS RECONCILIATION INTEGRITY TEST");
  console.log("==========================================================================");

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  const augFilters = {
    startDate: "2026-08-01",
    endDate: "2026-08-31"
  };

  // 1. Physical Calls in August via Canonical Utility
  const augustCalls = getCanonicalPhysicalCalls(contacts, augFilters);
  const connectedCalls = augustCalls.filter(c => classifyCallStatus(c.status) === "CONNECTED");
  const notConnectedCalls = augustCalls.filter(c => classifyCallStatus(c.status) === "NOT_CONNECTED");
  const incomingCalls = augustCalls.filter(c => c.callType.startsWith("incoming"));
  const incomingConnected = incomingCalls.filter(c => classifyCallStatus(c.status) === "CONNECTED");
  const incomingNotConnected = incomingCalls.filter(c => classifyCallStatus(c.status) === "NOT_CONNECTED");

  console.log("\n--- 1. AUGUST PHYSICAL CALL RECONCILIATION ---");
  console.log(`- Dashboard / Report Total Physical Calls : ${augustCalls.length}`);
  console.log(`- Connected Calls                         : ${connectedCalls.length}`);
  console.log(`- Not Connected Calls                     : ${notConnectedCalls.length}`);
  console.log(`- Formula Check (Connected + NotConnected): ${connectedCalls.length + notConnectedCalls.length} === ${augustCalls.length} (${connectedCalls.length + notConnectedCalls.length === augustCalls.length ? "PASS ✅" : "FAIL ❌"})`);

  console.log("\n--- 2. INCOMING CALL RECONCILIATION ---");
  console.log(`- Total Incoming Calls                    : ${incomingCalls.length}`);
  console.log(`- Incoming Connected                      : ${incomingConnected.length}`);
  console.log(`- Incoming Not Connected                  : ${incomingNotConnected.length}`);
  console.log(`- Formula Check (Incoming Conn + NotConn) : ${incomingConnected.length + incomingNotConnected.length} === ${incomingCalls.length} (${incomingConnected.length + incomingNotConnected.length === incomingCalls.length ? "PASS ✅" : "FAIL ❌"})`);

  // 3. Duplicate Call ID Verification
  const augustCallIdSet = new Set();
  let duplicateAugCallIds = 0;
  augustCalls.forEach(c => {
    if (augustCallIdSet.has(c.callId)) duplicateAugCallIds++;
    augustCallIdSet.add(c.callId);
  });
  console.log(`- August Call Unique ID Count             : ${augustCallIdSet.size} (Duplicates: ${duplicateAugCallIds} -> ${duplicateAugCallIds === 0 ? "PASS ✅" : "FAIL ❌"})`);

  // 4. All-Time Call Reconciliation
  const allTimeCalls = getCanonicalPhysicalCalls(contacts, {});
  const allTimeCallIdSet = new Set();
  let duplicateAllTimeCallIds = 0;
  allTimeCalls.forEach(c => {
    if (allTimeCallIdSet.has(c.callId)) duplicateAllTimeCallIds++;
    allTimeCallIdSet.add(c.callId);
  });
  console.log("\n--- 3. ALL-TIME CALL RECONCILIATION ---");
  console.log(`- Total All-Time Physical Calls           : ${allTimeCalls.length} (DB Baseline: 2,105 -> ${allTimeCalls.length === 2105 ? "PASS ✅" : "FAIL ❌"})`);
  console.log(`- All-Time Unique Call ID Count           : ${allTimeCallIdSet.size} (Duplicates: ${duplicateAllTimeCallIds} -> ${duplicateAllTimeCallIds === 0 ? "PASS ✅" : "FAIL ❌"})`);

  // 5. Pipeline Contacts & Stage Reconciliation
  const stageCounts = {};
  contacts.forEach(c => {
    const stage = getCanonicalStage(c);
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });

  const sumStageCounts = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const totalContacts = contacts.length;

  console.log("\n--- 4. PIPELINE STAGE RECONCILIATION ---");
  console.log(`- Total Pipeline Contacts (Contacts DB)  : ${totalContacts}`);
  console.log(`- Sum of All Stage Card Counts            : ${sumStageCounts} (${sumStageCounts === totalContacts ? "PASS ✅" : "FAIL ❌"})`);
  console.log(`  * 1. New Lead                           : ${stageCounts["1. New Lead"] || 0}`);
  console.log(`  * 2. Attempting Contact                 : ${stageCounts["2. Attempting Contact"] || 0}`);
  console.log(`  * 3. Information Given                  : ${stageCounts["3. Information Given"] || 0}`);
  console.log(`  * 4. Nurture / Interested               : ${stageCounts["4. Nurture / Interested"] || 0}`);
  console.log(`  * 5. Future Pool                        : ${stageCounts["5. Future Pool"] || 0}`);
  console.log(`  * 6. Registered / Won                   : ${stageCounts["6. Registered / Won"] || 0}`);
  console.log(`  * 7. Closed / Lost                      : ${stageCounts["7. Closed / Lost"] || 0}`);
  console.log(`  * Closed / Invalid                      : ${stageCounts["Closed / Invalid"] || 0}`);
  console.log(`  * Query Desk (Legacy)                   : ${stageCounts["Query Desk"] || 0}`);
  console.log(`  * Existing Alumni (Legacy)              : ${stageCounts["Existing Alumni"] || 0}`);

  // 6. Interested People & Registered People Verification
  const interestedPeople = contacts.filter(c => getCanonicalStage(c) === PIPELINE_STAGES.NURTURE_INTERESTED).length;
  const registeredPeople = contacts.filter(c => getCanonicalStage(c) === PIPELINE_STAGES.REGISTERED_WON).length;

  console.log("\n--- 5. PEOPLE METRICS RECONCILIATION ---");
  console.log(`- Interested People (Stage 4 Unique)      : ${interestedPeople} (DB Baseline: 239 -> ${interestedPeople === 239 ? "PASS ✅" : "FAIL ❌"})`);
  console.log(`- Registered People (Stage 6 Unique)      : ${registeredPeople} (DB Baseline: 183 -> ${registeredPeople === 183 ? "PASS ✅" : "FAIL ❌"})`);

  // 7. Registrations Collection Verification
  const regIdSet = new Set();
  let duplicateRegIds = 0;
  registrations.forEach(r => {
    const regId = r.registrationId || r._id;
    if (regIdSet.has(regId)) duplicateRegIds++;
    regIdSet.add(regId);
  });
  console.log("\n--- 6. REGISTRATIONS COLLECTION RECONCILIATION ---");
  console.log(`- Total Registration Documents           : ${registrations.length}`);
  console.log(`- Unique Registration ID Count            : ${regIdSet.size} (Duplicates: ${duplicateRegIds} -> ${duplicateRegIds === 0 ? "PASS ✅" : "FAIL ❌"})`);

  await client.close();
}

runReconciliationTest().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
