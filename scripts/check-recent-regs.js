import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://socialmedia_db_user:oCx2eAeDNIIoPX2o@call-center.iigzryp.mongodb.net/?appName=Call-Center";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const sept1Start = new Date("2026-09-01T00:00:00.000Z");

  const contacts = await db.collection('contacts').find({}).toArray();

  console.log("\n========================================================");
  console.log("ALL REGISTRATIONS LOGGED IN THE LAST 48 HOURS (SEPT 1 & 2)");
  console.log("========================================================\n");

  const recentRegs = [];

  contacts.forEach(c => {
    const leadName = c.Name || c.name || "Unknown Lead";
    const phone = c.Phone || c.phone || "";

    const checkItem = (source, status, calledFor, attenderName, attenderId, dateVal) => {
      if (!["Reg.Done", "Registered / Won", "Registered", "6. Registered / Won"].includes(status)) return;
      const d = dateVal ? new Date(dateVal) : null;
      if (!d || isNaN(d.getTime())) return;
      if (d < sept1Start) return;

      recentRegs.push({
        source,
        leadName,
        phone,
        status,
        calledFor: calledFor || c.calledFor || "Unspecified",
        attenderName: attenderName || "Unknown",
        attenderId: attenderId || "Unknown",
        timestamp: d
      });
    };

    if (c.attenderStates) {
      Object.entries(c.attenderStates).forEach(([aId, st]) => {
        if (!st) return;
        if (Array.isArray(st.history)) {
          st.history.forEach(h => checkItem("attenderHistory", h.status, h.calledFor || h["Called For"], st.attenderName, aId, h.timestamp || h.date || h.createdAt));
        }
      });
    }

    if (Array.isArray(c.history)) {
      c.history.forEach(h => checkItem("globalHistory", h.status, h.calledFor || h["Called For"], h.attenderName, h.attenderId, h.timestamp || h.date || h.createdAt));
    }
  });

  // Deduplicate
  const map = new Map();
  recentRegs.forEach(r => {
    const key = `${r.attenderName}_${r.leadName}_${r.calledFor}_${r.timestamp.getTime()}`;
    map.set(key, r);
  });

  const uniqueRegs = Array.from(map.values()).sort((a,b) => b.timestamp - a.timestamp);

  console.log(`Total Recent Registrations Found: ${uniqueRegs.length}\n`);

  uniqueRegs.forEach((r, idx) => {
    console.log(`${idx + 1}. Attender: "${r.attenderName}" (ID: ${r.attenderId})`);
    console.log(`   Lead: ${r.leadName} (${r.phone})`);
    console.log(`   Program: ${r.calledFor}`);
    console.log(`   Time: ${r.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (${r.timestamp.toISOString()})`);
    console.log(`   Source: ${r.source}\n`);
  });

  await client.close();
}

main().catch(console.error);
