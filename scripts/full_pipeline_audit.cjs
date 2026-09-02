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

      // 1. Previous Program Pending Check
      const hasPrevProgPendingStatus =
        String(contact.status || "").trim().toLowerCase() === "previous program pending" ||
        String(contact.pipelineStage || "").trim().toLowerCase() === "previous program pending" ||
        String(contact.callStatus || "").trim().toLowerCase() === "previous program pending" ||
        (Array.isArray(contact.history) && contact.history.length > 0 && String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase() === "previous program pending") ||
        (contact.attenderStates && typeof contact.attenderStates === "object" && Object.values(contact.attenderStates).some(st => String(st?.status || "").trim().toLowerCase() === "previous program pending"));

      if (hasPrevProgPendingStatus) {
        return PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING;
      }

      // 1b. Existing Alumni Check
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

      // 1c. Closed / Lost Check
      const lastHistStatus = Array.isArray(contact.history) && contact.history.length > 0
        ? String(contact.history[contact.history.length - 1]?.status || "").trim().toLowerCase()
        : "";

      if (statusLower === "not interested" || statusLower === "closed / lost" || lastHistStatus === "not interested" || lastHistStatus === "closed / lost") {
        return PIPELINE_STAGES.CLOSED_LOST;
      }

      // 1d. Closed / Invalid Check
      if (statusLower.includes("invalid") || statusLower.includes("wrong number") || lastHistStatus.includes("invalid") || lastHistStatus.includes("wrong number")) {
        return PIPELINE_STAGES.CLOSED_INVALID;
      }

      // 2. Resolve Effective Sales Stage from Engine
      const effectiveStage = getEffectiveStage(contact);

      // 3. Query / Reminder Desk Check
      const isHigherSalesStage = effectiveStage && effectiveStage !== PIPELINE_STAGES.NEW_LEAD && effectiveStage !== PIPELINE_STAGES.ATTEMPTING;

      if (!isHigherSalesStage) {
        const isQueryOrReminderStatus =
          statusLower.includes("query") ||
          statusLower.includes("reminder") ||
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

  console.log(`\n======================================================`);
  console.log(` RE-AUDITED DATABASE PIPELINE COUNTS (SEPT 2026)`);
  console.log(`======================================================\n`);

  const stageBuckets = {
    [PIPELINE_STAGES.NEW_LEAD]: [],
    [PIPELINE_STAGES.ATTEMPTING]: [],
    [PIPELINE_STAGES.INFO_GIVEN]: [],
    [PIPELINE_STAGES.PREVIOUS_PROGRAM_PENDING]: [],
    [PIPELINE_STAGES.NURTURE_INTERESTED]: [],
    [PIPELINE_STAGES.FUTURE_POOL]: [],
    [PIPELINE_STAGES.REGISTERED_WON]: [],
    [PIPELINE_STAGES.CLOSED_LOST]: [],
    [PIPELINE_STAGES.CLOSED_INVALID]: [],
    "Query Desk": [],
    "Existing Alumni": []
  };

  callActivityContacts.forEach(c => {
    const stage = getCanonicalStage(c);
    const item = {
      name: c.name || c.Name || "Unnamed",
      phone: c.phone || c.Phone || c.mobile || c.Mobile || "No Phone",
      status: c.status || "",
      pipelineStage: c.pipelineStage || "",
      attender: c.attenderName || c.assignedName || "Unassigned"
    };

    if (stageBuckets[stage]) {
      stageBuckets[stage].push(item);
    } else {
      stageBuckets[stage] = [item];
    }
  });

  for (const [stageName, list] of Object.entries(stageBuckets)) {
    console.log(`Stage: "${stageName}" => ${list.length} contacts`);
  }

  await client.close();
}

main().catch(console.error);
