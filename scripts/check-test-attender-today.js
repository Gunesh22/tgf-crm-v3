import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://socialmedia_db_user:oCx2eAeDNIIoPX2o@call-center.iigzryp.mongodb.net/?appName=Call-Center";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const activeDb = client.db('tgf_crm');

  const todayStart = new Date("2026-09-13T00:00:00.000Z");
  const todayEnd = new Date("2026-09-13T23:59:59.999Z");

  const contacts = await activeDb.collection('contacts').find({}).toArray();

  console.log("\n=== ALL CALL EVENTS LOGGED TODAY (2026-09-13) FOR GEETA ===");
  
  let geetaCalls = [];

  contacts.forEach(c => {
    const processItem = (h, attenderName, attenderId) => {
      const d = h.timestamp || h.date || h.createdAt ? new Date(h.timestamp || h.date || h.createdAt) : null;
      const att = String(attenderName || h.attenderName || h.attender || h.caller || c.attenderName || "").toLowerCase();
      
      if (att.includes("geeta")) {
        // If date matches today or if any call logged today
        const isToday = d && d >= todayStart && d <= todayEnd;
        if (isToday) {
          geetaCalls.push({
            leadName: c.Name || c.name || "Unknown",
            phone: c.Phone || c.phone || "",
            callStatus: h.status || h.callStatus || "Unknown",
            callPurpose: h.callPurpose || "SALES",
            calledFor: h.calledFor || h["Called For"] || c.calledFor || "Unspecified",
            attenderName: attenderName || h.attenderName || "Geeta",
            pipelineStage: c.pipelineStage || "Unset",
            contactStatus: c.status || "Unset",
            timestamp: d,
            remark: h.remark || h.notes || ""
          });
        }
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

  // Deduplicate by event
  const uniqueMap = new Map();
  geetaCalls.forEach(e => {
    const key = `${e.phone}_${e.timestamp.getTime()}_${e.callStatus}`;
    uniqueMap.set(key, e);
  });

  const uniqueGeetaCalls = Array.from(uniqueMap.values());
  console.log(`\nTOTAL CALLS LOGGED TODAY (2026-09-13) BY GEETA: ${uniqueGeetaCalls.length}\n`);

  uniqueGeetaCalls.forEach((r, idx) => {
    console.log(`CALL #${idx + 1}:`);
    console.log(`  Lead Name:      ${r.leadName}`);
    console.log(`  Phone:          ${r.phone}`);
    console.log(`  Program:        ${r.calledFor}`);
    console.log(`  Call Outcome:   ${r.callStatus}`);
    console.log(`  Call Time:      ${r.timestamp.toLocaleTimeString()}`);
    console.log(`  Pipeline Stage: ${r.pipelineStage}`);
    console.log(`  Remark:         ${r.remark || "None"}`);
    console.log(`-------------------------------------------------------`);
  });

  // Also search for contact 7057835586
  const targetC = contacts.find(c => String(c.phone || c.Phone || '').includes('7057835586'));
  if (targetC) {
    console.log(`\n=== CONTACT 7057835586 DETAILS ===`);
    console.log(`Name: ${targetC.name || targetC.Name}`);
    console.log(`Phone: ${targetC.phone || targetC.Phone}`);
    console.log(`Attender: ${targetC.attenderName}`);
    console.log(`Pipeline Stage in DB: ${targetC.pipelineStage}`);
    console.log(`Status in DB: ${targetC.status}`);
    console.log(`Called For: ${targetC.calledFor}`);
    console.log(`History count: ${(targetC.history || []).length}`);
    (targetC.history || []).forEach((h, i) => {
      console.log(`  [Call ${i + 1}] Date: ${h.timestamp || h.date}, Status: ${h.status}, Attender: ${h.attenderName}, Remark: ${h.remark}`);
    });
  }

  await client.close();
}

main().catch(console.error);
