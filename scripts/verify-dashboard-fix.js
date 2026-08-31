import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// Replicate the exact updated DashboardTab.jsx flattenedLogs logic
function computeFlattenedLogs(callLogs) {
  const list = [];
  callLogs.forEach(log => {
    if (log._deleted) return;

    const contactName = log.Name || log.name || log.contactName || "Unknown";
    const contactPhone = log.Phone || log.phone || log.Mobile || log.mobile || "";

    const hasTopHistory = Array.isArray(log.history) && log.history.length > 0;
    const hasAttenderStates = log.attenderStates && typeof log.attenderStates === "object" && Object.keys(log.attenderStates).length > 0;
    const seenCallKeys = new Set();

    // 1. Physical calls in log.history
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

    // 2. Fallback attenderStates ONLY when no corresponding call exists in log.history
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

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  // Test 1: Final Test 1 contact
  const finalTestContact = await db.collection('contacts').findOne({
    $or: [{ name: /Final Test 1/i }, { Name: /Final Test 1/i }, { Phone: /7927538529/ }]
  });

  console.log("=== TEST 1: Final Test 1 Contact ===");
  if (finalTestContact) {
    console.log(`MongoDB history array length: ${finalTestContact.history ? finalTestContact.history.length : 0}`);
    const flattened = computeFlattenedLogs([finalTestContact]);
    console.log(`FlattenedLogs count for Final Test 1: ${flattened.length}`);
    console.log("Flattened items:", flattened);
  }

  // Test 2: Legacy contact with attenderStates but NO history
  const legacyContactWithStatesNoHistory = {
    _id: "mock_legacy_123",
    Name: "Legacy Person",
    Phone: "9999999999",
    attenderStates: {
      "attender_legacy_1": {
        attenderId: "attender_legacy_1",
        attenderName: "Legacy Attender",
        callDirection: "incoming",
        status: "Info Given",
        remark: "legacy call notes",
        lastCalledAt: "2026-08-01T10:00:00.000Z"
      }
    }
  };

  console.log("\n=== TEST 2: Legacy Contact with attenderStates but NO history ===");
  const legacyFlattened = computeFlattenedLogs([legacyContactWithStatesNoHistory]);
  console.log(`FlattenedLogs count for Legacy Person: ${legacyFlattened.length}`);
  console.log("Flattened items:", legacyFlattened);

  await client.close();
}

main().catch(console.error);
