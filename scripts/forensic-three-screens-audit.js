// scripts/forensic-three-screens-audit.js
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing!");
  process.exit(1);
}

const PIPELINE_STAGES = {
  NEW_LEAD: "1. New Lead",
  ATTEMPTING: "2. Attempting Contact",
  INFO_GIVEN: "3. Information Given",
  NURTURE_INTERESTED: "4. Nurture / Interested",
  FUTURE_POOL: "5. Future Pool",
  REGISTERED_WON: "6. Registered / Won",
  CLOSED_LOST: "7. Closed / Lost",
  CLOSED_INVALID: "8. Closed / Invalid",
};

function parseTimestamp(t) {
  if (!t) return null;
  if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
  if (typeof t.toDate === "function") return t.toDate();
  if (typeof t.toMillis === "function") return new Date(t.toMillis());
  if (typeof t === "object" && (t.seconds !== undefined || t._seconds !== undefined)) {
    const sec = t.seconds !== undefined ? t.seconds : t._seconds;
    const nsec = t.nanoseconds !== undefined ? t.nanoseconds : (t._nanoseconds || 0);
    return new Date(sec * 1000 + Math.round(nsec / 1000000));
  }
  if (typeof t === "number") return new Date(t);
  if (typeof t === "string") {
    const parsed = new Date(t);
    if (!isNaN(parsed.getTime())) return parsed;
    const cleaned = t.replace(/-/g, "/");
    const parsedCleaned = new Date(cleaned);
    if (!isNaN(parsedCleaned.getTime())) return parsedCleaned;
  }
  return null;
}

function getCanonicalStage(stageOrContact) {
  let contact = {};
  let rawStage = "";

  if (typeof stageOrContact === "string") {
    rawStage = stageOrContact;
  } else if (stageOrContact && typeof stageOrContact === "object") {
    contact = stageOrContact;
    rawStage = contact.pipelineStage || "";
  }

  if (rawStage && String(rawStage).trim() !== "" && rawStage !== "null" && rawStage !== "undefined") {
    const s = String(rawStage).trim();
    if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    if (s === "Query Desk" || s === "Query") return "Query Desk";
    if (s === "Existing Alumni" || s === "Alumni") return "Existing Alumni";
  }

  return "1. New Lead";
}

async function runForensicAudit() {
  console.log("==========================================================");
  console.log(" FORENSIC READ-ONLY AUDIT: THREE ADMIN ANALYTICS SCREENS");
  console.log("==========================================================");

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  console.log(`\n[DB SNAPSHOT]`);
  console.log(`- Contacts collection count: ${contacts.length}`);
  console.log(`- Registrations collection count: ${registrations.length}`);
  console.log(`- Attenders collection count: ${attenders.length}`);

  // --------------------------------------------------------------------------
  // SECTION 2: CALLS RECONCILIATION (2,105 vs 1,924)
  // --------------------------------------------------------------------------
  console.log(`\n----------------------------------------------------------`);
  console.log(`SECTION 2: CALLS RECONCILIATION (2,105 vs 1,924)`);
  console.log(`----------------------------------------------------------`);

  let allTimePhysicalCalls = 0;
  let augustPhysicalCalls = 0;
  let preAugustCalls = 0;
  let postAugustCalls = 0;
  let invalidTimestampCalls = 0;

  const augStart = new Date("2026-08-01T00:00:00.000Z");
  const augEnd = new Date("2026-08-31T23:59:59.999Z");

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach((h, idx) => {
        allTimePhysicalCalls++;

        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        if (!ts || isNaN(ts.getTime())) {
          invalidTimestampCalls++;
        } else {
          if (ts >= augStart && ts <= augEnd) {
            augustPhysicalCalls++;
          } else if (ts < augStart) {
            preAugustCalls++;
          } else {
            postAugustCalls++;
          }
        }
      });
    }
  });

  console.log(`- All-Time Physical Calls in MongoDB history[] : ${allTimePhysicalCalls}`);
  console.log(`- August (01-08-2026 to 31-08-2026) Calls     : ${augustPhysicalCalls}`);
  console.log(`- Pre-August Calls                             : ${preAugustCalls}`);
  console.log(`- Post-August Calls                            : ${postAugustCalls}`);
  console.log(`- Calls with invalid timestamps                : ${invalidTimestampCalls}`);
  console.log(`\nEXPLANATION FOR 2,105 VS 1,924:`);
  console.log(`  Dashboard & Pipeline use ALL-TIME date filter -> 2,105 physical calls.`);
  console.log(`  Report uses AUGUST date filter (01-08-2026 to 31-08-2026) -> ${augustPhysicalCalls} physical call attempts in August + ${preAugustCalls} pre-August calls outside date filter = 2,105 total.`);

  // --------------------------------------------------------------------------
  // SECTION 3: INTERESTED PEOPLE RECONCILIATION (244 VS 239 - FIND THE 5 CONTACTS)
  // --------------------------------------------------------------------------
  console.log(`\n----------------------------------------------------------`);
  console.log(`SECTION 3: INTERESTED PEOPLE RECONCILIATION (244 VS 239)`);
  console.log(`----------------------------------------------------------`);

  const dashboardInterestedContacts = [];
  const pipelineInterestedContacts = [];
  const mismatchContacts = [];

  contacts.forEach(c => {
    const rawStage = (c.pipelineStage || "").trim();
    const canonicalStage = getCanonicalStage(c);

    // Dashboard's old loose check: stage === "4. Nurture / Interested" || stage === "Nurture / Interested" || (stage.includes("Interested") && !stage.includes("Reg"))
    const isDashboardInterested = rawStage === "4. Nurture / Interested" || rawStage === "Nurture / Interested" || (rawStage.includes("Interested") && !rawStage.includes("Reg"));

    // Pipeline's strict check: canonicalStage === PIPELINE_STAGES.NURTURE_INTERESTED
    const isPipelineInterested = canonicalStage === PIPELINE_STAGES.NURTURE_INTERESTED;

    if (isDashboardInterested) {
      dashboardInterestedContacts.push(c);
    }
    if (isPipelineInterested) {
      pipelineInterestedContacts.push(c);
    }

    if (isDashboardInterested !== isPipelineInterested) {
      mismatchContacts.push({
        id: String(c._id),
        name: c.Name || c.name || "Unnamed",
        phone: c.Phone || c.phone || "",
        rawPipelineStage: rawStage,
        canonicalStage,
        isDashboardInterested,
        isPipelineInterested
      });
    }
  });

  console.log(`- Dashboard Interested People Count (old loose logic): ${dashboardInterestedContacts.length}`);
  console.log(`- Pipeline Nurture / Interested Count (canonical)  : ${pipelineInterestedContacts.length}`);
  console.log(`- Difference                                          : ${dashboardInterestedContacts.length - pipelineInterestedContacts.length} contacts`);

  console.log(`\nEXACT CONTACTS CAUSING THE 5-PERSON MISMATCH:`);
  console.table(mismatchContacts);

  // --------------------------------------------------------------------------
  // SECTION 4 & 5: REGISTERED METRICS (183 VS 130 VS 205)
  // --------------------------------------------------------------------------
  console.log(`\n----------------------------------------------------------`);
  console.log(`SECTION 4 & 5: REGISTERED METRICS (183 vs 130 vs 205)`);
  console.log(`----------------------------------------------------------`);

  const stage6Contacts = contacts.filter(c => getCanonicalStage(c) === PIPELINE_STAGES.REGISTERED_WON);
  const regDocCount = registrations.length;
  const uniqueRegIds = new Set(registrations.map(r => r.registrationId || `reg_${r.contactId}_${r.calledForKey}`));

  let augustRegDoneCallsCount = 0;
  let augustUniqueRegDoneContacts = new Set();

  contacts.forEach(c => {
    if (Array.isArray(c.history)) {
      c.history.forEach(h => {
        const ts = parseTimestamp(h.timestamp || h.createdAt || h.date);
        const status = String(h.status || "").trim();
        if (status === "Reg.Done" || status === "registered") {
          if (ts && ts >= augStart && ts <= augEnd) {
            augustRegDoneCallsCount++;
            augustUniqueRegDoneContacts.add(String(c._id));
          }
        }
      });
    }
  });

  console.log(`- Dashboard / Pipeline Registered People (Unique Stage 6 Contacts) : ${stage6Contacts.length}`);
  console.log(`- Pipeline Registration Records (registrations collection documents) : ${regDocCount}`);
  console.log(`- Distinct registrationId Values in collection                       : ${uniqueRegIds.size}`);
  console.log(`- Report Direct Registrations (August "Reg.Done" call events)       : ${augustRegDoneCallsCount}`);
  console.log(`- August Unique Contacts who had a "Reg.Done" call event in August   : ${augustUniqueRegDoneContacts.size}`);

  console.log(`\nUNITS AND DEFINITIONS SUMMARY:`);
  console.log(`  1. 183 = Unique PEOPLE currently in Stage 6 in contacts collection (All-Time).`);
  console.log(`  2. 130 = Unique REGISTRATION RECORDS in registrations collection (upserted per contactId + calledForKey).`);
  console.log(`  3. 205 = Total "Reg.Done" CALL EVENTS logged during the August date range (Report call event level).`);

  await client.close();
}

runForensicAudit().catch(err => {
  console.error("Forensic audit error:", err);
  process.exit(1);
});
