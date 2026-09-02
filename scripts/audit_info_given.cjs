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

  let totalInfoGivenCallsThisMonth = 0;
  const personCallCounts = [];

  contacts.forEach(c => {
    const contactName = c.name || c.Name || "Unnamed";
    const contactPhone = c.phone || c.Phone || c.mobile || c.Mobile || "No Phone";
    let infoGivenCallCountThisMonth = 0;

    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const hTs = parseTimestamp(h.timestamp || h.date || h.createdAt);
        if (hTs) {
          const dStr = getLocalDateStr(hTs);
          if (dStr >= dateFrom && dStr <= dateTo) {
            const st = String(h.status || "").trim().toLowerCase();
            if (st === "info given" || st === "information given" || st === "details send") {
              infoGivenCallCountThisMonth++;
              totalInfoGivenCallsThisMonth++;
            }
          }
        }
      });
    }

    if (infoGivenCallCountThisMonth > 0) {
      personCallCounts.push({
        name: contactName,
        phone: contactPhone,
        infoGivenCallsThisMonth: infoGivenCallCountThisMonth,
        totalHistoryCalls: Array.isArray(c.history) ? c.history.length : 0,
        currentStatus: c.status,
        pipelineStage: c.pipelineStage
      });
    }
  });

  // Sort descending by info given call count
  personCallCounts.sort((a, b) => b.infoGivenCallsThisMonth - a.infoGivenCallsThisMonth);

  console.log(`\n======================================================`);
  console.log(` PER-PERSON 'INFO GIVEN' CALL COUNT (SEPTEMBER 2026)`);
  console.log(`======================================================`);
  console.log(`Total 'Info Given' Calls: ${totalInfoGivenCallsThisMonth}`);
  console.log(`Total Unique People: ${personCallCounts.length}\n`);

  console.table(personCallCounts);

  await client.close();
}

main().catch(console.error);
