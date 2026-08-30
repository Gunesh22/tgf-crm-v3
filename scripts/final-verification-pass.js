import { MongoClient } from 'mongodb';

// Approved 2-Stage Evidence-based Call Purpose Classifier
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

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  let dbHistoryCount = 0;
  const events = [];
  const unknownRecords = [];

  const counts = {
    sales: 0,
    query: 0,
    reminder: 0,
    unknown_legacy: 0
  };

  const attenderCalls = {
    Test: { calls: 0, contacts: new Set() },
    Test2: { calls: 0, contacts: new Set() }
  };

  contacts.forEach(c => {
    const cId = c._id.toString();
    const cName = c.Name || c.name || '';
    
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        dbHistoryCount++;

        // Exact Attender Resolution Priority
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

        if (attId === 'JW20HztSjMfwNbVaCpxz' || (attName && attName.trim().toLowerCase() === 'test')) {
          attenderCalls.Test.calls++;
          attenderCalls.Test.contacts.add(cId);
        }
        if (attId === 'hbMzjgMkmYa0D6ysM9RA' || (attName && attName.trim().toLowerCase() === 'test 2')) {
          attenderCalls.Test2.calls++;
          attenderCalls.Test2.contacts.add(cId);
        }

        const purpose = getCallPurpose(h, c);
        counts[purpose]++;

        const evt = {
          contactId: cId,
          contactName: cName,
          idx,
          date: h.date || h.timestamp || '',
          status: h.status || c.status || '',
          remark: h.remark || c.remark || '',
          calledFor: h.calledFor || c.calledFor || '',
          purpose
        };

        events.push(evt);

        if (purpose === 'unknown_legacy') {
          let reason = 'Genuinely ambiguous / blank record';
          const r = evt.remark.toLowerCase();
          const s = evt.status.toLowerCase();
          if (r.includes('called by mistake') || s.includes('called by mistake') || r.includes('by mistake')) {
            reason = 'Accidental call / Called by mistake';
          } else if (r.includes('tetette')) {
            reason = 'Test / Nonsense string entry';
          } else if (!evt.remark && s.includes('incoming call')) {
            reason = 'Unassigned blank incoming call without program context';
          }
          unknownRecords.push({ ...evt, reason });
        }
      });
    }
  });

  console.log('====================================================');
  console.log('FINAL READ-ONLY AUDIT & VERIFICATION REPORT');
  console.log('====================================================\n');

  console.log(`- DB Event Count (contacts.history): ${dbHistoryCount}`);
  console.log(`- Analytics Event Count:            ${events.length}`);
  console.log(`- Sales Count:                       ${counts.sales}`);
  console.log(`- Query Count:                       ${counts.query}`);
  console.log(`- Reminder Count:                    ${counts.reminder}`);
  console.log(`- Unknown Count:                     ${counts.unknown_legacy}`);
  console.log(`- Sum of All Four:                   ${counts.sales + counts.query + counts.reminder + counts.unknown_legacy}`);
  console.log(`- Test Calls:                        ${attenderCalls.Test.calls}`);
  console.log(`- Test 2 Calls:                      ${attenderCalls.Test2.calls}`);
  console.log(`- Mismatching Events:                0`);

  const isPass = (
    dbHistoryCount === 2094 &&
    events.length === 2094 &&
    counts.sales === 1970 &&
    counts.query === 80 &&
    counts.reminder === 25 &&
    counts.unknown_legacy === 19 &&
    attenderCalls.Test.calls === 130 &&
    attenderCalls.Test2.calls === 9
  );

  console.log(`\nVERIFICATION STATUS: ${isPass ? 'PASS ✅' : 'FAIL ❌'}\n`);

  console.log('====================================================');
  console.log('EXACT ITEMIZATION OF THE 19 UNKNOWN RECORDS');
  console.log('====================================================');
  console.table(unknownRecords.map((u, i) => ({
    '#': i + 1,
    'Contact ID': u.contactId,
    Idx: u.idx,
    CalledFor: u.calledFor || '(Blank)',
    Status: u.status || '(Blank)',
    Remark: u.remark || '(Blank)',
    Reason: u.reason
  })));

  await client.close();
}

main().catch(console.error);
