require('dotenv').config();
const { MongoClient } = require('mongodb');

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
  const { PIPELINE_STAGES, getEffectiveStage } = await import('../src/utils/pipelineEngine.js');

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const dateFrom = "2026-09-01";
  const dateTo = "2026-09-30";

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

  console.log(`\nFound ${callActivityContacts.length} contacts with activity in Sept 2026.\n`);

  console.log(`=== CONTACTS WITH STATUS 'Interested' OR STAGE '4. Nurture / Interested' ===`);
  callActivityContacts.forEach(c => {
    const name = c.name || c.Name;
    const phone = c.phone || c.Phone;
    const effectiveStage = getEffectiveStage(c);
    const rootStage = c.pipelineStage;
    const status = c.status;
    const lastHistory = Array.isArray(c.history) && c.history.length > 0 ? c.history[c.history.length - 1] : null;

    if (status === 'Interested' || rootStage === '4. Nurture / Interested' || effectiveStage === PIPELINE_STAGES.NURTURE_INTERESTED) {
      console.log({
        name,
        phone,
        status,
        rootStage,
        effectiveStage,
        lastHistoryStatus: lastHistory ? lastHistory.status : null,
        lastHistoryPurpose: lastHistory ? lastHistory.callPurpose || lastHistory.purpose : null,
        lastHistoryTimestamp: lastHistory ? lastHistory.timestamp : null
      });
    }
  });

  await client.close();
}

main().catch(console.error);
