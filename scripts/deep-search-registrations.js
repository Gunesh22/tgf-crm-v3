import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://socialmedia_db_user:oCx2eAeDNIIoPX2o@call-center.iigzryp.mongodb.net/?appName=Call-Center";

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  console.log("=== COMPREHENSIVE REGISTRATION AUDIT IN MONGODB ===");

  // 1. ALL Attenders
  const attenders = await db.collection('attenders').find({}).toArray();
  console.log("\n--- ATTENDERS LIST ---");
  attenders.forEach(a => {
    console.log(`ID: ${a.id || a._id} | Name: ${a.name} | Role: ${a.role}`);
  });

  // 2. All items in `registrations` collection
  const allRegsColl = await db.collection('registrations').find({}).toArray();
  console.log(`\n--- 'registrations' COLLECTION (Total records: ${allRegsColl.length}) ---`);
  allRegsColl.forEach((r, idx) => {
    console.log(`${idx + 1}. Attender: ${r.attenderName || r.attenderId} | Lead: ${r.leadName || r.name || r.contactId} | Program: ${r.calledFor || r.program || r.calledForKey} | Date: ${r.createdAt || r.timestamp || r.date}`);
  });

  // 3. Search contacts collection for ANY status/history/relationship matching Reg / Registered
  const contacts = await db.collection('contacts').find({}).toArray();
  console.log(`\n--- SEARCHING ${contacts.length} CONTACTS FOR ANY REGISTRATION EVIDENCE ---`);

  let regRecordsFound = [];

  contacts.forEach(c => {
    const leadName = c.Name || c.name || "Unknown";
    const phone = c.Phone || c.phone || "";
    const cId = String(c._id || c.id);

    // Root pipeline / status
    if (["Reg.Done", "Registered / Won", "Registered", "6. Registered / Won"].includes(c.pipelineStage) ||
        ["Reg.Done", "Registered / Won", "Registered"].includes(c.status)) {
      regRecordsFound.push({
        source: "Root Contact Status/Pipeline",
        contactId: cId,
        leadName,
        phone,
        status: c.status,
        pipelineStage: c.pipelineStage,
        calledFor: c.calledFor || c.programName,
        attenderId: c.attenderId || c.leadOwner,
        attenderName: c.attenderName || "Root Owner",
        updatedAt: c.updatedAt || c.createdAt
      });
    }

    // programRelationships
    if (Array.isArray(c.programRelationships)) {
      c.programRelationships.forEach(pr => {
        if (["Reg.Done", "Registered / Won", "Registered", "Already Reg.d", "Won"].includes(pr.status)) {
          regRecordsFound.push({
            source: "programRelationships",
            contactId: cId,
            leadName,
            phone,
            status: pr.status,
            calledFor: pr.calledFor || pr.program || pr.calledForKey,
            attenderId: pr.attenderId || c.attenderId,
            attenderName: pr.attenderName || "Unknown",
            updatedAt: pr.updatedAt || pr.registeredAt || c.updatedAt
          });
        }
      });
    }

    // attenderStates
    if (c.attenderStates) {
      Object.entries(c.attenderStates).forEach(([aId, st]) => {
        if (!st) return;
        const attName = st.attenderName || aId;

        if (["Reg.Done", "Registered / Won", "Registered"].includes(st.status)) {
          regRecordsFound.push({
            source: "attenderStates.status",
            contactId: cId,
            leadName,
            phone,
            status: st.status,
            calledFor: st["Called For"] || st.calledFor,
            attenderId: aId,
            attenderName: attName,
            updatedAt: st.lastCalledAt || st.updatedAt
          });
        }

        if (Array.isArray(st.history)) {
          st.history.forEach((h, hIdx) => {
            if (["Reg.Done", "Registered / Won", "Registered"].includes(h.status)) {
              regRecordsFound.push({
                source: `attenderStates.history[${hIdx}]`,
                contactId: cId,
                leadName,
                phone,
                status: h.status,
                calledFor: h.calledFor || h["Called For"] || st["Called For"],
                attenderId: aId,
                attenderName: attName,
                updatedAt: h.timestamp || h.date || h.createdAt
              });
            }
          });
        }
      });
    }

    // Root history
    if (Array.isArray(c.history)) {
      c.history.forEach((h, hIdx) => {
        if (["Reg.Done", "Registered / Won", "Registered"].includes(h.status)) {
          regRecordsFound.push({
            source: `history[${hIdx}]`,
            contactId: cId,
            leadName,
            phone,
            status: h.status,
            calledFor: h.calledFor || h["Called For"],
            attenderId: h.attenderId,
            attenderName: h.attenderName || "Unknown",
            updatedAt: h.timestamp || h.date || h.createdAt
          });
        }
      });
    }
  });

  console.log(`\nTotal registration items extracted from contacts: ${regRecordsFound.length}`);

  // Deduplicate by attender, lead, program, timestamp/date
  console.log("\n--- GROUPED BY ATTENDER ---");
  const byAttender = {};
  regRecordsFound.forEach(r => {
    const key = r.attenderName || r.attenderId || "Unknown";
    if (!byAttender[key]) byAttender[key] = [];
    byAttender[key].push(r);
  });

  Object.entries(byAttender).forEach(([att, items]) => {
    console.log(`\nAttender: "${att}" (${items.length} registration records)`);
    items.forEach((item, idx) => {
      const dateStr = item.updatedAt ? new Date(item.updatedAt).toISOString() : 'No date';
      console.log(`  ${idx + 1}. [${item.source}] Lead: ${item.leadName} (${item.phone}) | Program: ${item.calledFor} | Status: ${item.status} | Date: ${dateStr}`);
    });
  });

  await client.close();
}

main().catch(console.error);
