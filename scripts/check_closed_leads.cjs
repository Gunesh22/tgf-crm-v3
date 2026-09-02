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
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const dateFrom = "2026-09-01";
  const dateTo = "2026-09-30";

  const septContacts = contacts.filter(c => {
    const activityDates = [];
    const lastCall = parseTimestamp(c.lastCalledAt);
    if (lastCall) activityDates.push(lastCall);

    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const hTs = parseTimestamp(h.timestamp || h.date || h.createdAt);
        if (hTs) activityDates.push(hTs);
      });
    }

    return activityDates.some(d => {
      const dStr = getLocalDateStr(d);
      return dStr >= dateFrom && dStr <= dateTo;
    });
  });

  console.log(`\n=== ALL 50 CONTACTS LATEST STATUS & STAGE ===\n`);
  septContacts.forEach((c, idx) => {
    const lastHistory = Array.isArray(c.history) && c.history.length > 0 ? c.history[c.history.length - 1] : null;
    console.log(`${idx + 1}. Name: "${c.name || c.Name}" | Phone: "${c.phone || c.Phone}" | RootStatus: "${c.status}" | RootStage: "${c.pipelineStage}" | LastHistoryStatus: "${lastHistory ? lastHistory.status : 'N/A'}"`);
  });

  await client.close();
}

main().catch(console.error);
