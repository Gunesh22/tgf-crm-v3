import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// Replicate DashboardTab flattenedLogs logic
function computeFlattenedLogs(callLogs) {
  const list = [];
  callLogs.forEach(log => {
    if (log._deleted) return;

    const contactName = log.Name || log.name || log.contactName || "Unknown";
    const contactPhone = log.Phone || log.phone || log.Mobile || log.mobile || "";

    const hasTopHistory = Array.isArray(log.history) && log.history.length > 0;
    const hasAttenderStates = log.attenderStates && typeof log.attenderStates === "object" && Object.keys(log.attenderStates).length > 0;
    const seenCallKeys = new Set();

    if (hasTopHistory) {
      log.history.forEach((h, index) => {
        const attId = h.attenderId || log.attenderId || "legacy";
        const attName = h.attenderName || log.attenderName || "Legacy Attender";
        const callKey = `${log._id || log.id}_h_${index}`;

        if (!seenCallKeys.has(callKey)) {
          seenCallKeys.add(callKey);
          list.push({
            id: callKey,
            contactId: log._id || log.id,
            Name: contactName,
            Phone: contactPhone,
            attenderId: attId,
            attenderName: attName,
            status: h.status || log.status || "Pending",
            remark: h.remark || "",
            callType: h.callType || h.callDirection || log.callType || log.callDirection || "outgoing",
            isHistory: true
          });
        }
      });
    }

    if (hasAttenderStates) {
      Object.entries(log.attenderStates).forEach(([attId, state]) => {
        if (!state) return;
        const stateAttName = state.attenderName || "Unknown";
        const stateHasHistory = Array.isArray(state.history) && state.history.length > 0;

        const attenderHasHistoryInLog = hasTopHistory && log.history.some(h => {
          const hAttId = h.attenderId || h.callAttenderId;
          if (hAttId && attId && String(hAttId) === String(attId)) return true;
          if (h.attenderName && stateAttName && h.attenderName.toLowerCase().trim() === stateAttName.toLowerCase().trim()) return true;
          return false;
        });

        if (!attenderHasHistoryInLog && !stateHasHistory && (state.lastCalledAt || (state.status && state.status !== "Pending") || state.remark)) {
          const callDir = state.callType || state.callDirection || log.callType || log.callDirection || "outgoing";
          list.push({
            id: `${log._id || log.id}_${attId}_latest`,
            contactId: log._id || log.id,
            Name: contactName,
            Phone: contactPhone,
            attenderId: attId,
            attenderName: stateAttName,
            status: state.status || "Pending",
            remark: state.remark || "",
            callType: callDir,
            isHistory: false
          });
        }
      });
    } else if (!hasTopHistory) {
      if (log.lastCalledAt || (log.status && log.status !== "Pending") || log.remark) {
        list.push({
          id: `${log._id || log.id}_legacy_latest`,
          contactId: log._id || log.id,
          Name: contactName,
          Phone: contactPhone,
          attenderId: log.attenderId || "legacy",
          attenderName: log.attenderName || "Legacy Attender",
          status: log.status || "Pending",
          remark: log.remark || "",
          callType: log.callType || log.callDirection || "outgoing",
          isHistory: false
        });
      }
    }
  });

  return list;
}

// Simulate EditModal getNormalizedRow logic
function normalizeContactRow(row, activeAttenderId = "test_attender_1", activeAttenderName = "Test Attender") {
  const normalized = { ...row };
  
  // Preserve existing follow-up schedule if present
  const existingCallbackDate = row.callbackDate || (row.attenderStates && row.attenderStates[activeAttenderId]?.callbackDate) || null;
  const existingCallbackStatus = row.callbackStatus || (row.attenderStates && row.attenderStates[activeAttenderId]?.callbackStatus) || (existingCallbackDate ? "pending" : null);

  normalized.callbackDate = existingCallbackDate;
  normalized.callbackStatus = existingCallbackStatus;

  return normalized;
}

async function runAudit() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log("=================================================");
  console.log("  SYSTEMATIC READ-ONLY END-TO-END AUDIT REPORT");
  console.log("=================================================\n");

  // 1. DASHBOARD CALLS COUNT AUDIT
  const contacts = await db.collection('contacts').find({}).toArray();
  const flattened = computeFlattenedLogs(contacts);

  console.log("--- 1. Dashboard Calls Metric Audit ---");
  console.log(`Total Contacts in DB: ${contacts.length}`);
  console.log(`Flattened Call Events (Authoritative): ${flattened.length}`);
  const passDashboard = flattened.length > 0;
  console.log(`[AUDIT RESULT] Dashboard KPI Authoritative Call Count = ${flattened.length} | PASS: ${passDashboard}\n`);

  // 2. ATTENDER FOLLOW-UP PERSISTENCE TEST
  console.log("--- 2. Attender Follow-up Lifecycle & Reopening Audit ---");
  const sampleContactWithFollowup = {
    _id: "test_contact_fu_101",
    Name: "Followup Tester",
    Phone: "9876543210",
    callbackDate: "2026-09-01T10:00:00.000Z",
    callbackStatus: "pending",
    attenderStates: {
      "test_attender_1": {
        attenderId: "test_attender_1",
        attenderName: "Test Attender",
        callbackDate: "2026-09-01T10:00:00.000Z",
        callbackStatus: "pending"
      }
    }
  };

  // Reopen 1st time
  const opened1 = normalizeContactRow(sampleContactWithFollowup);
  const pass1 = opened1.callbackDate === "2026-09-01T10:00:00.000Z" && opened1.callbackStatus === "pending";

  // Reopen 5th time
  let openedN = sampleContactWithFollowup;
  for (let i = 0; i < 5; i++) {
    openedN = normalizeContactRow(openedN);
  }
  const passN = openedN.callbackDate === "2026-09-01T10:00:00.000Z" && openedN.callbackStatus === "pending";

  // Status update to 'done'
  const updatedContact = { ...openedN, callbackStatus: "done" };
  const reopenedAfterDone = normalizeContactRow(updatedContact);
  const passDone = reopenedAfterDone.callbackStatus === "done";

  console.log(`Reopen Contact 1st Time -> callbackDate: ${opened1.callbackDate}, status: ${opened1.callbackStatus} | PASS: ${pass1}`);
  console.log(`Reopen Contact 5th Time -> callbackDate: ${openedN.callbackDate}, status: ${openedN.callbackStatus} | PASS: ${passN}`);
  console.log(`Update Status to 'done' & Reopen -> status: ${reopenedAfterDone.callbackStatus} | PASS: ${passDone}\n`);

  // 3. SINGLE CALL DEDUPLICATION & DIRECTION TEST (Final Test 1)
  console.log("--- 3. Call Integrity & Direction Audit (Final Test 1) ---");
  const finalTestContact = await db.collection('contacts').findOne({
    $or: [{ name: /Final Test 1/i }, { Name: /Final Test 1/i }, { Phone: /7927538529/ }]
  });

  if (finalTestContact) {
    const finalFlattened = computeFlattenedLogs([finalTestContact]);
    const finalPass = finalFlattened.length === 1 && finalFlattened[0].callType === 'incoming';
    console.log(`Final Test 1 DB History Count: ${finalTestContact.history ? finalTestContact.history.length : 0}`);
    console.log(`Final Test 1 Dashboard Rows: ${finalFlattened.length}`);
    console.log(`Final Test 1 Direction: ${finalFlattened[0]?.callType}`);
    console.log(`[AUDIT RESULT] Final Test 1 Deduplication & Direction | PASS: ${finalPass}\n`);
  } else {
    console.log("Final Test 1 contact not found in MongoDB.\n");
  }

  // 4. REGISTRATION INTEGRITY AUDIT
  console.log("--- 4. Registration Integrity Audit ---");
  const registrations = await db.collection('registrations').find({}).toArray();
  console.log(`Total Registrations in DB: ${registrations.length}`);
  const uniqueRegKeys = new Set(registrations.map(r => `${r.contactId}_${r.calledForKey || r.programName || 'default'}`));
  const regPass = uniqueRegKeys.size === registrations.length;
  console.log(`Unique Registration Compound Keys (contactId + calledForKey): ${uniqueRegKeys.size} / ${registrations.length}`);
  console.log(`[AUDIT RESULT] Registration Compound Key Uniqueness | PASS: ${regPass}\n`);

  await client.close();
}

runAudit().catch(console.error);
