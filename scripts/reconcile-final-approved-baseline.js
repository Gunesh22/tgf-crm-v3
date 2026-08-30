// scripts/reconcile-final-approved-baseline.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export const getCallPurpose = (h = {}, contact = {}) => {
  const explicit = (h.callPurpose || h.purpose || "").toLowerCase().trim();
  if (explicit === "sales") return "sales";
  if (explicit === "query") return "query";
  if (explicit === "reminder") return "reminder";

  const remark = (h.remark || h.comment || contact.remark || "").toLowerCase().trim();
  const status = (h.status || contact.status || "").toLowerCase().trim();
  const calledFor = (h.calledFor || contact.calledFor || contact.programName || "").toLowerCase().trim();

  // 1. Query Evidence
  const isQueryRemark = remark.includes("query") || remark.includes("doubt") || remark.includes("question") || 
                        remark.includes("asking about") || remark.includes("asked about") || remark.includes("shivir query") || 
                        remark.includes("fee detail asked") || remark.includes("inquiry") || remark.includes("location") ||
                        remark.includes("timing") || remark.includes("batch timing") || remark.includes("when is next") ||
                        remark.includes("offline possible") || remark.includes("bus ki suvidha") || remark.includes("suvidha");
  const isQueryStatus = status.includes("query") || status === "query desk";
  if (isQueryRemark || isQueryStatus) return "query";

  // 2. Reminder Evidence
  const isReminderRemark = remark.includes("reminder") || remark.includes("remind") || remark.includes("payment link") || 
                           remark.includes("session link") || remark.includes("zoom link") || remark.includes("whatsapp link") ||
                           remark.includes("webinar link") || remark.includes("event reminder") || remark.includes("workshop reminder") ||
                           remark.includes("passcode");
  const isReminderStatus = status.includes("reminder");
  if (isReminderRemark || isReminderStatus) return "reminder";

  // 3. High-Confidence Sales Evidence
  const isSalesStatus = status.includes("info given") || status.includes("information given") || 
                        status.includes("interested") || status.includes("reg.done") || status.includes("registered") ||
                        status.includes("not interested") || status.includes("future pool") || status.includes("next time") ||
                        status.includes("attempting") || status.includes("new lead");
  const isSalesRemark = remark.includes("info given") || remark.includes("explained") || remark.includes("details sent") ||
                        remark.includes("shivir info") || remark.includes("will join") || remark.includes("interested") ||
                        remark.includes("fees given") || remark.includes("program info") || remark.includes("call back for sales") ||
                        remark.includes("registration done") || remark.includes("reg.done");
  if (isSalesStatus || isSalesRemark) return "sales";

  // 4. Check for Generic Call Attempt / Unconnected Attempt with Program Context
  if (status.includes("busy") || status.includes("call cut") || status.includes("na") || status.includes("switched off") || status.includes("no answer") || status.includes("invalid no") || status.includes("no network") || status.includes("call log added")) {
    if (calledFor || contact.pipelineStage) {
      return "sales";
    }
  }

  // 5. Secondary Review Pass for Ambiguous/Blank items
  if (remark.includes("called by mistake") || remark.includes("by mistake") || status.includes("called by mistake") || remark.includes("tetette")) {
    return "unknown_legacy";
  }

  const salesKeywords = [
    "next batch", "added in", "batch", "group", "program", "not attended", "link send", 
    "link sent", "not possible to attend", "next program", "basic program", "shivir",
    "future", "postpone", "august", "july", "september", "october", "reg.d", "already reg"
  ];
  const hasSalesKeyword = salesKeywords.some(k => remark.includes(k) || status.includes(k));
  if (hasSalesKeyword) return "sales";

  const isCallAttemptStatus = status.includes("not attended") || status.includes("not possible");
  const isCallAttemptRemark = remark.includes("not connected") || remark.includes("call not received") || 
                              remark.includes("incoming call") || remark.includes("number not available");

  if ((isCallAttemptStatus || isCallAttemptRemark) && (calledFor || contact.pipelineStage)) {
    return "sales";
  }

  if (remark.includes("fee") || remark.includes("amount") || remark.includes("price") || remark.includes("cost") || remark.includes("bus ki suvidha") || remark.includes("suvidha")) {
    return "query";
  }

  if (remark.includes("registration done") || remark.includes("reg.done") || remark.includes("registered")) {
    return "sales";
  }

  if (remark.includes("link") || remark.includes("zoom") || remark.includes("passcode")) {
    return "reminder";
  }

  return "unknown_legacy";
};

const isConnectedStatus = (status) => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  const unconn = ['na', 'busy', 'call cut', 'switched off', 'invalid no', 'no network', 'wrong no.', 'not picked up', 'no answer'];
  return !unconn.some(u => s.includes(u));
};

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  let dbHistoryCount = 0;
  const allEvents = [];
  const seenCallIds = new Set();

  contacts.forEach(c => {
    const cId = c._id.toString();
    const cName = c.Name || c.name || 'Unnamed';
    const cPhone = c.Phone || c.phone || '';

    if (Array.isArray(c.history) && c.history.length > 0) {
      c.history.forEach((h, idx) => {
        dbHistoryCount++;
        const ts = h.timestamp ? new Date(h.timestamp) : null;
        const callId = h.callId || h.id || `legacy_call_${cId}_${idx}_${ts ? ts.getTime() : idx}`;

        if (seenCallIds.has(callId)) return;
        seenCallIds.add(callId);

        // Attender resolution logic (Exact Priority)
        let attId = h.attenderId;
        let attName = h.attenderName;

        if (!attId && attName) {
          const cleanName = attName.trim().toLowerCase();
          const matchedAttender = (attenders || []).find(a => (a.name || '').trim().toLowerCase() === cleanName);
          if (matchedAttender) {
            attId = matchedAttender.id || matchedAttender._id.toString();
          }
        }

        if (!attId && !attName) {
          attId = c.attenderId;
          attName = c.attenderName;
          if (!attId && attName) {
            const cleanName = attName.trim().toLowerCase();
            const matchedAttender = (attenders || []).find(a => (a.name || '').trim().toLowerCase() === cleanName);
            if (matchedAttender) {
              attId = matchedAttender.id || matchedAttender._id.toString();
            }
          }
        }

        if (!attId) attId = 'unassigned';
        if (!attName) attName = 'Unassigned Attender';

        const purpose = getCallPurpose(h, c);

        allEvents.push({
          callId,
          contactId: cId,
          contactName: cName,
          purpose,
          status: h.status || c.status || 'Pending',
          attenderId: attId,
          attenderName: attName,
          isConnected: isConnectedStatus(h.status || c.status)
        });
      });
    }
  });

  console.log('====================================================');
  console.log('FINAL RECONCILIATION VERIFICATION REPORT');
  console.log('====================================================\n');

  console.log(`1. DATABASE VS ANALYTICS COUNT COMPARISON:`);
  console.log(`- Total MongoDB contacts.history events: ${dbHistoryCount}`);
  console.log(`- Total Admin Analytics extracted events:${allEvents.length}`);
  console.log(`- Count Match: ${dbHistoryCount === allEvents.length && dbHistoryCount === 2094 ? 'EXACT MATCH (2,094) ✅' : 'MISMATCH ❌'}`);

  const purposeStats = {
    sales: { calls: 0, connected: 0, contacts: new Set() },
    query: { calls: 0, connected: 0, contacts: new Set() },
    reminder: { calls: 0, connected: 0, contacts: new Set() },
    unknown_legacy: { calls: 0, connected: 0, contacts: new Set() }
  };

  const attenderStats = new Map();

  allEvents.forEach(e => {
    const p = purposeStats[e.purpose];
    p.calls++;
    if (e.isConnected) p.connected++;
    p.contacts.add(e.contactId);

    if (!attenderStats.has(e.attenderId)) {
      attenderStats.set(e.attenderId, {
        attenderId: e.attenderId,
        attenderName: e.attenderName,
        calls: 0,
        contacts: new Set()
      });
    }
    const att = attenderStats.get(e.attenderId);
    att.calls++;
    att.contacts.add(e.contactId);
  });

  console.log(`\n2. CALL PURPOSE BREAKDOWN:`);
  const purposeTable = [
    {
      Purpose: 'Sales',
      Calls: purposeStats.sales.calls,
      'Unique People': purposeStats.sales.contacts.size,
      'Connected Calls': purposeStats.sales.connected,
      'Connected %': ((purposeStats.sales.connected / purposeStats.sales.calls) * 100).toFixed(1) + '%'
    },
    {
      Purpose: 'Query',
      Calls: purposeStats.query.calls,
      'Unique People': purposeStats.query.contacts.size,
      'Connected Calls': purposeStats.query.connected,
      'Connected %': ((purposeStats.query.connected / purposeStats.query.calls) * 100).toFixed(1) + '%'
    },
    {
      Purpose: 'Reminder',
      Calls: purposeStats.reminder.calls,
      'Unique People': purposeStats.reminder.contacts.size,
      'Connected Calls': purposeStats.reminder.connected,
      'Connected %': ((purposeStats.reminder.connected / purposeStats.reminder.calls) * 100).toFixed(1) + '%'
    },
    {
      Purpose: 'Unknown / Legacy',
      Calls: purposeStats.unknown_legacy.calls,
      'Unique People': purposeStats.unknown_legacy.contacts.size,
      'Connected Calls': purposeStats.unknown_legacy.connected,
      'Connected %': ((purposeStats.unknown_legacy.connected / purposeStats.unknown_legacy.calls) * 100).toFixed(1) + '%'
    },
    {
      Purpose: 'TOTAL',
      Calls: allEvents.length,
      'Unique People': contacts.length,
      'Connected Calls': purposeStats.sales.connected + purposeStats.query.connected + purposeStats.reminder.connected + purposeStats.unknown_legacy.connected,
      'Connected %': '-'
    }
  ];
  console.table(purposeTable);

  const testAttender = attenderStats.get('JW20HztSjMfwNbVaCpxz') || Array.from(attenderStats.values()).find(a => a.attenderName.toLowerCase().includes('test') && !a.attenderName.toLowerCase().includes('test 2'));
  const test2Attender = attenderStats.get('hbMzjgMkmYa0D6ysM9RA') || Array.from(attenderStats.values()).find(a => a.attenderName.toLowerCase().includes('test 2'));

  console.log(`\n3. TEST ATTENDER INTEGRITY VERIFICATION:`);
  console.log(`- Test ("JW20HztSjMfwNbVaCpxz"):   Calls = ${testAttender ? testAttender.calls : 0} (Expected: 130), Contacts = ${testAttender ? testAttender.contacts.size : 0} (Expected: 75) -> ${testAttender && testAttender.calls === 130 ? 'EXACT MATCH ✅' : 'MISMATCH ❌'}`);
  console.log(`- Test 2 ("hbMzjgMkmYa0D6ysM9RA"): Calls = ${test2Attender ? test2Attender.calls : 0} (Expected: 9), Contacts = ${test2Attender ? test2Attender.contacts.size : 0} (Expected: 5) -> ${test2Attender && test2Attender.calls === 9 ? 'EXACT MATCH ✅' : 'MISMATCH ❌'}`);

  console.log(`\n4. ALL ATTENDERS PERFORMANCE BREAKDOWN:`);
  const attenderTable = Array.from(attenderStats.values()).map(a => ({
    'Attender ID': a.attenderId,
    'Attender Name': a.attenderName,
    Calls: a.calls,
    'Unique Contacts': a.contacts.size
  })).sort((a, b) => b.Calls - a.Calls);

  console.table(attenderTable);

  console.log(`\n5. BASELINE ASSERTION SUMMARY:`);
  console.log(`- Sales Calls: ${purposeStats.sales.calls} (Expected: 1,970) -> ${purposeStats.sales.calls === 1970 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Query Calls: ${purposeStats.query.calls} (Expected: 80) -> ${purposeStats.query.calls === 80 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Reminder Calls: ${purposeStats.reminder.calls} (Expected: 25) -> ${purposeStats.reminder.calls === 25 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`- Unknown Calls: ${purposeStats.unknown_legacy.calls} (Expected: 19) -> ${purposeStats.unknown_legacy.calls === 19 ? 'PASSED ✅' : 'FAILED ❌'}`);

  await client.close();
}

main().catch(console.error);
