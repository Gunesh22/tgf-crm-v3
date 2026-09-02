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

  function getCanonicalStage(stageOrContact) {
    if (!stageOrContact) return PIPELINE_STAGES.NEW_LEAD;

    if (typeof stageOrContact === "object") {
      const contact = stageOrContact;

      // 1. Previous Program Pending
      const hasPrevProgPendingStatus =
        String(contact.status || "").trim().toLowerCase() === "previous program pending" ||
        String(contact.pipelineStage || "").trim().toLowerCase() === "previous program pending" ||
        String(contact.callStatus || "").trim().toLowerCase() === "previous program pending" ||
        (Array.isArray(contact.history) && contact.history.length > 0 && String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase() === "previous program pending") ||
        (contact.attenderStates && typeof contact.attenderStates === "object" && Object.values(contact.attenderStates).some(st => String(st?.status || "").trim().toLowerCase() === "previous program pending"));

      if (hasPrevProgPendingStatus) {
        return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
      }

      // 1b. Existing Alumni Check (Already Reg.d / Already Registered / Shivir done)
      const statusLower = String(contact.status || "").trim().toLowerCase();
      const callStatusLower = String(contact.callStatus || "").trim().toLowerCase();
      const isAlreadyRegistered =
        statusLower === "already reg.d" || statusLower === "already registered" || statusLower.includes("shivir done") ||
        callStatusLower === "already reg.d" || callStatusLower === "already registered" ||
        (Array.isArray(contact.history) && contact.history.length > 0 && (
          String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase() === "already reg.d" ||
          String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase() === "already registered"
        ));

      if (isAlreadyRegistered) {
        return "Existing Alumni";
      }

      // 2. Resolve Effective Sales Stage from Engine
      const effectiveStage = getEffectiveStage(contact);

      // 3. Query / Reminder Desk Check
      const isHigherSalesStage = effectiveStage && effectiveStage !== PIPELINE_STAGES.NEW_LEAD && effectiveStage !== PIPELINE_STAGES.ATTEMPTING;

      if (!isHigherSalesStage) {
        const statusStr = String(contact.status || "").trim().toLowerCase();
        const isQueryOrReminderStatus =
          statusStr.includes("query") ||
          statusStr.includes("reminder") ||
          (Array.isArray(contact.history) && contact.history.length > 0 && (
            String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase().includes("query") ||
            String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase().includes("reminder")
          ));

        if (isQueryOrReminderStatus) {
          return "Query Desk";
        }
      }

      if (effectiveStage) return effectiveStage;

      return PIPELINE_STAGES.NEW_LEAD;
    }

    const s = String(stageOrContact).trim();
    if (s === PIPELINE_STAGES.NEW_LEAD || s === "New Lead" || s === "1. New Lead") return PIPELINE_STAGES.NEW_LEAD;
    if (s === PIPELINE_STAGES.ATTEMPTING || s === "Attempting Contact" || s === "Attempting" || s === "2. Attempting Contact") return PIPELINE_STAGES.ATTEMPTING;
    if (s === PIPELINE_STAGES.INFO_GIVEN || s === "Information Given" || s === "Info Given" || s === "3. Information Given") return PIPELINE_STAGES.INFO_GIVEN;
    if (s === PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING || s === "Previous Program Pending") return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
    if (s === PIPELINE_STAGES.NURTURE_INTERESTED || s === "Nurture / Interested" || s === "Interested" || s === "4. Nurture / Interested") return PIPELINE_STAGES.NURTURE_INTERESTED;
    if (s === PIPELINE_STAGES.FUTURE_POOL || s === "Future Pool" || s === "Next Time" || s === "5. Future Pool") return PIPELINE_STAGES.FUTURE_POOL;
    if (s === PIPELINE_STAGES.REGISTERED_WON || s === "Registered / Won" || s === "Reg.Done" || s === "6. Registered / Won" || s === "Registered") return PIPELINE_STAGES.REGISTERED_WON;
    if (s === PIPELINE_STAGES.CLOSED_LOST || s === "Closed / Lost" || s === "Closed Lost" || s === "7. Closed / Lost" || s === "Not Interested") return PIPELINE_STAGES.CLOSED_LOST;
    if (s === PIPELINE_STAGES.CLOSED_INVALID || s === "Closed / Invalid" || s === "Invalid") return PIPELINE_STAGES.CLOSED_INVALID;
    if (s === "Query Desk" || s === "Query") return "Query Desk";
    if (s === "Existing Alumni" || s === "Alumni" || s === "Already Reg.d") return "Existing Alumni";

    return PIPELINE_STAGES.NEW_LEAD;
  }

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

  const stageBuckets = {};
  callActivityContacts.forEach(c => {
    const stage = getCanonicalStage(c);
    if (!stageBuckets[stage]) stageBuckets[stage] = [];
    stageBuckets[stage].push({
      name: c.name || c.Name || "Unnamed",
      phone: c.phone || c.Phone || c.mobile || c.Mobile || "No Phone",
      status: c.status || "",
      pipelineStage: c.pipelineStage || "",
      previousProgram: c.previousProgram || ""
    });
  });

  console.log(`\n======================================================`);
  console.log(` AUDIT WITH EXISTING ALUMNI FIX (${callActivityContacts.length} Contacts)`);
  console.log(`======================================================\n`);

  for (const [stage, list] of Object.entries(stageBuckets)) {
    console.log(`\n--- STAGE: ${stage} (${list.length} leads) ---`);
    console.table(list);
  }

  await client.close();
}

main().catch(console.error);
