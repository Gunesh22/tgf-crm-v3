import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://socialmedia_db_user:oCx2eAeDNIIoPX2o@call-center.iigzryp.mongodb.net/?appName=Call-Center";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const activeDb = client.db('tgf_crm');

  const todayStart = new Date("2026-09-02T00:00:00.000Z");
  const todayEnd = new Date("2026-09-02T23:59:59.999Z");

  const contacts = await activeDb.collection('contacts').find({}).toArray();

  console.log("\n=== ALL CALL EVENTS LOGGED TODAY (2026-09-02) ACROSS ALL ATTENDERS ===");
  
  let allEventsToday = [];

  contacts.forEach(c => {
    const processItem = (h, attenderName, attenderId) => {
      const d = h.timestamp || h.date || h.createdAt ? new Date(h.timestamp || h.date || h.createdAt) : null;
      if (d && d >= todayStart && d <= todayEnd) {
        allEventsToday.push({
          leadName: c.Name || c.name || "Unknown",
          phone: c.Phone || c.phone || "",
          status: h.status,
          calledFor: h.calledFor || h["Called For"] || c.calledFor || "Unspecified",
          attenderName: attenderName || h.attenderName || "Unknown",
          attenderId: attenderId || h.attenderId || "Unknown",
          timestamp: d
        });
      }
    };

    if (c.attenderStates) {
      Object.entries(c.attenderStates).forEach(([aId, st]) => {
        if (!st) return;
        if (Array.isArray(st.history)) {
          st.history.forEach(h => processItem(h, st.attenderName, aId));
        }
      });
    }

    if (Array.isArray(c.history)) {
      c.history.forEach(h => processItem(h, h.attenderName, h.attenderId));
    }
  });

  // Deduplicate by event unique key
  const uniqueEventsMap = new Map();
  allEventsToday.forEach(e => {
    const key = `${e.leadName}_${e.phone}_${e.status}_${e.calledFor}_${e.attenderName}_${e.timestamp.getTime()}`;
    uniqueEventsMap.set(key, e);
  });

  const uniqueEvents = Array.from(uniqueEventsMap.values());

  console.log(`Total Call Events Logged Today: ${uniqueEvents.length}`);
  
  const regs = uniqueEvents.filter(e => e.status === "Reg.Done" || e.status === "Registered / Won" || e.status === "Registered");
  console.log(`Total 'Reg.Done' Events Logged Today: ${regs.length}\n`);

  regs.forEach((r, idx) => {
    console.log(`${idx + 1}. Attender: "${r.attenderName}" (ID: ${r.attenderId}) | Lead: ${r.leadName} (${r.phone}) | Program: "${r.calledFor}" | Time: ${r.timestamp.toLocaleTimeString()}`);
  });

  await client.close();
}

main().catch(console.error);
