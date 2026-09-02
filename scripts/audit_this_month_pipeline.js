import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { getCanonicalStage } from '../src/features/admin/utils.jsx';
import { PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://shivam:Shivam123@cluster0.n4n5w.mongodb.net/tgf_crm?retryWrites=true&w=majority";

function parseTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function getLocalDateStr(d) {
  if (!d || isNaN(d.getTime())) return "";
  const yr = d.getFullYear();
  const mn = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mn}-${dy}`;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const callLogsCollection = await db.collection('call_logs').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  console.log(`\n======================================================`);
  console.log(` DATABASE FORENSIC AUDIT: SEPTEMBER 2026 (THIS MONTH)`);
  console.log(` Total Contacts in DB: ${contacts.length}`);
  console.log(` Total Call Logs: ${callLogsCollection.length}`);
  console.log(` Total Registrations: ${registrations.length}`);
  console.log(`======================================================\n`);

  const dateFrom = "2026-09-01";
  const dateTo = "2026-09-30";

  // MODE A: Call Activity (dateMode === "call")
  const callActivityContacts = contacts.filter(c => {
    const activityDates = [];
    const lastCall = parseTimestamp(c.lastCalledAt);
    if (lastCall) activityDates.push(lastCall);

    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const hTs = parseTimestamp(h.timestamp || h.date || h.createdAt);
        if (hTs) activityDates.push(hTs);
      });
    }

    if (activityDates.length === 0) return false;

    return activityDates.some(d => {
      const dStr = getLocalDateStr(d);
      return dStr >= dateFrom && dStr <= dateTo;
    });
  });

  // MODE B: Lead Created (dateMode === "contact")
  const leadCreatedContacts = contacts.filter(c => {
    const cDate = parseTimestamp(c.createdAt || c.date_added);
    if (!cDate) return false;
    const dStr = getLocalDateStr(cDate);
    return dStr >= dateFrom && dStr <= dateTo;
  });

  function getStageCounts(contactList) {
    const counts = {
      [PIPELINE_STAGES.NEW_LEAD]: 0,
      [PIPELINE_STAGES.ATTEMPTING]: 0,
      [PIPELINE_STAGES.INFO_GIVEN]: 0,
      [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: 0,
      [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
      [PIPELINE_STAGES.FUTURE_POOL]: 0,
      [PIPELINE_STAGES.REGISTERED_WON]: 0,
      [PIPELINE_STAGES.CLOSED_LOST]: 0,
      [PIPELINE_STAGES.CLOSED_INVALID]: 0,
      "Query Desk": 0,
      "Existing Alumni": 0,
      "Unknown / Legacy": 0
    };

    contactList.forEach(c => {
      const stage = getCanonicalStage(c);
      if (counts[stage] !== undefined) {
        counts[stage]++;
      } else {
        counts["Unknown / Legacy"]++;
      }
    });

    return counts;
  }

  const callActivityCounts = getStageCounts(callActivityContacts);
  const leadCreatedCounts = getStageCounts(leadCreatedContacts);

  // Breakdown for Previous Program Pending
  const pppBreakdown = {};
  callActivityContacts.forEach(c => {
    const stage = getCanonicalStage(c);
    if (stage === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING) {
      const prog = c.previousProgram || c.Source || c.source || c["Called For"] || c.calledFor || "Unspecified";
      pppBreakdown[prog] = (pppBreakdown[prog] || 0) + 1;
    }
  });

  console.log(`MODE A: Call Activity Filter (September 1 - September 30, 2026)`);
  console.log(`Total Active Contacts matching Call Activity: ${callActivityContacts.length}`);
  console.table(callActivityCounts);

  console.log(`\nPrevious Program Pending Breakdown by Program (Call Activity):`);
  console.table(pppBreakdown);

  console.log(`\nMODE B: Lead Created Filter (September 1 - September 30, 2026)`);
  console.log(`Total Contacts Created in Sept 2026: ${leadCreatedContacts.length}`);
  console.table(leadCreatedCounts);

  await client.close();
}

main().catch(console.error);
