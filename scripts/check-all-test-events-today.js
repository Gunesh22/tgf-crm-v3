import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://socialmedia_db_user:oCx2eAeDNIIoPX2o@call-center.iigzryp.mongodb.net/?appName=Call-Center";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const todayStart = new Date("2026-09-02T00:00:00.000Z");
  const contacts = await db.collection('contacts').find({}).toArray();

  console.log("\n=== ALL CALL EVENTS LOGGED TODAY BY TEST ATTENDER (ANY STATUS) ===");

  const testEvents = [];

  contacts.forEach(c => {
    const leadName = c.Name || c.name || "Unknown Lead";
    const phone = c.Phone || c.phone || "";

    const check = (status, calledFor, attenderName, attenderId, dateVal) => {
      const d = dateVal ? new Date(dateVal) : null;
      if (!d || isNaN(d.getTime())) return;
      if (d < todayStart) return;

      const aId = String(attenderId || '').toLowerCase();
      const aName = String(attenderName || '').toLowerCase();

      if (aId.includes('test') || aName.includes('test') || aId === 'jw20hztsmfwnbvacpxz') {
        testEvents.push({
          leadName,
          phone,
          status,
          calledFor: calledFor || c.calledFor || "Unspecified",
          attenderName: attenderName || "Test",
          timestamp: d
        });
      }
    };

    if (c.attenderStates) {
      Object.entries(c.attenderStates).forEach(([aId, st]) => {
        if (!st) return;
        if (Array.isArray(st.history)) {
          st.history.forEach(h => check(h.status, h.calledFor || h["Called For"], st.attenderName, aId, h.timestamp || h.date || h.createdAt));
        }
      });
    }

    if (Array.isArray(c.history)) {
      c.history.forEach(h => check(h.status, h.calledFor || h["Called For"], h.attenderName, h.attenderId, h.timestamp || h.date || h.createdAt));
    }
  });

  // Deduplicate
  const map = new Map();
  testEvents.forEach(e => {
    const key = `${e.leadName}_${e.status}_${e.calledFor}_${e.timestamp.getTime()}`;
    map.set(key, e);
  });

  const unique = Array.from(map.values()).sort((a,b) => b.timestamp - a.timestamp);

  console.log(`Total Events Found for Test Attender Today: ${unique.length}\n`);

  unique.forEach((e, idx) => {
    console.log(`${idx + 1}. Lead: ${e.leadName} (${e.phone}) | Program: "${e.calledFor}" | Status: "${e.status}" | Time: ${e.timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  });

  await client.close();
}

main().catch(console.error);
