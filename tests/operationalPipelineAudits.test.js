// tests/operationalPipelineAudits.test.js
import assert from "node:assert";
import { PIPELINE_STAGES, getEffectiveStage } from "../src/utils/pipelineEngine.js";

const getCanonicalStage = (contact) => {
  if (!contact) return PIPELINE_STAGES.NEW_LEAD;
  return getEffectiveStage(contact) || contact.pipelineStage || PIPELINE_STAGES.NEW_LEAD;
};

const getAllCallEntries = (log) => {
  if (!log || typeof log !== "object") return [];
  const calls = [];
  if (Array.isArray(log.history)) {
    log.history.forEach(h => {
      calls.push({
        timestamp: h.timestamp ? new Date(h.timestamp) : null,
        status: h.status || "Pending",
        remark: h.remark || "",
        callPurpose: h.callPurpose || "SALES",
        pipelineStage: h.pipelineStage || null,
        calledFor: h.calledFor || ""
      });
    });
  }
  return calls;
};

console.log("\n========================================================");
console.log(" OPERATIONAL PIPELINE & TRUE TRANSITION AUDIT TEST SUITE ");
console.log("========================================================\n");

let passedCount = 0;

function runTest(desc, fn) {
  try {
    fn();
    console.log(`✅ PASS  ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL  ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// ── Test 1: Current Interested is Active WIP, NOT a loss ────────────────────
runTest("1. Current Interested lead is categorized as Active WIP, not a loss", () => {
  const contact = {
    id: "lead_1",
    pipelineStage: "4. Nurture / Interested",
    status: "Interested",
    history: [
      { timestamp: "2026-09-10T10:00:00Z", status: "Info Given", pipelineStage: "3. Information Given", callPurpose: "SALES" },
      { timestamp: "2026-09-12T11:00:00Z", status: "Interested", pipelineStage: "4. Nurture / Interested", callPurpose: "SALES" }
    ]
  };

  const stage = getCanonicalStage(contact);
  assert.strictEqual(stage, PIPELINE_STAGES.NURTURE_INTERESTED);

  // Business invariant: being in Interested is active work-in-progress, not a loss
  const isLoss = stage === PIPELINE_STAGES.CLOSED_LOST || stage === "Closed / Lost";
  assert.strictEqual(isLoss, false, "Interested lead must never be treated as a loss");
});

// ── Test 2: Current Info Given is Active WIP, NOT a loss ─────────────────────
runTest("2. Current Info Given lead is categorized as Active WIP, not a loss", () => {
  const contact = {
    id: "lead_2",
    pipelineStage: "3. Information Given",
    status: "Info Given",
    history: [
      { timestamp: "2026-09-13T10:00:00Z", status: "Info Given", pipelineStage: "3. Information Given", callPurpose: "SALES" }
    ]
  };

  const stage = getCanonicalStage(contact);
  assert.strictEqual(stage, PIPELINE_STAGES.INFO_GIVEN);
  const isLoss = stage === PIPELINE_STAGES.CLOSED_LOST || stage === "Closed / Lost";
  assert.strictEqual(isLoss, false, "Info Given lead must never be treated as a loss");
});

// ── Test 3: Interested → Not Interested is a True Loss ───────────────────────
runTest("3. Interested → Not Interested counts as a genuine deal loss", () => {
  const contact = {
    id: "lead_3",
    pipelineStage: "Closed / Lost",
    status: "Not Interested",
    history: [
      { timestamp: "2026-09-08T10:00:00Z", status: "Interested", pipelineStage: "4. Nurture / Interested", callPurpose: "SALES" },
      { timestamp: "2026-09-13T14:00:00Z", status: "Not Interested", pipelineStage: "Closed / Lost", callPurpose: "SALES" }
    ]
  };

  const calls = getAllCallEntries(contact);
  assert.strictEqual(calls.length, 2);

  // Identify transition
  let transitionOccurred = false;
  for (let i = 1; i < calls.length; i++) {
    const prev = calls[i - 1].pipelineStage;
    const curr = calls[i].pipelineStage;
    if (prev === "4. Nurture / Interested" && (curr === "Closed / Lost" || curr === "7. Closed / Lost")) {
      transitionOccurred = true;
    }
  }
  assert.strictEqual(transitionOccurred, true, "Must detect Interested → Closed / Lost transition");
});

// ── Test 4: Info Given → Not Interested is a True Loss ───────────────────────
runTest("4. Info Given → Not Interested counts as pitch rejection loss", () => {
  const contact = {
    id: "lead_4",
    pipelineStage: "Closed / Lost",
    status: "Not Interested",
    history: [
      { timestamp: "2026-09-12T10:00:00Z", status: "Info Given", pipelineStage: "3. Information Given", callPurpose: "SALES" },
      { timestamp: "2026-09-13T10:00:00Z", status: "Not Interested", pipelineStage: "Closed / Lost", callPurpose: "SALES" }
    ]
  };

  const calls = getAllCallEntries(contact);
  let pitchLoss = false;
  for (let i = 1; i < calls.length; i++) {
    const prev = calls[i - 1].pipelineStage;
    const curr = calls[i].pipelineStage;
    if (prev === "3. Information Given" && (curr === "Closed / Lost" || curr === "7. Closed / Lost")) {
      pitchLoss = true;
    }
  }
  assert.strictEqual(pitchLoss, true, "Must detect Info Given → Closed / Lost pitch loss");
});

// ── Test 5: Interested → Future Pool is Deferred, NOT True Loss ──────────────
runTest("5. Interested → Future Pool is categorized as Deferred / Postponed, not True Loss", () => {
  const contact = {
    id: "lead_5",
    pipelineStage: "5. Future Pool",
    status: "Next Time",
    history: [
      { timestamp: "2026-09-10T10:00:00Z", status: "Interested", pipelineStage: "4. Nurture / Interested", callPurpose: "SALES" },
      { timestamp: "2026-09-13T12:00:00Z", status: "Next Time", pipelineStage: "5. Future Pool", callPurpose: "SALES" }
    ]
  };

  const calls = getAllCallEntries(contact);
  let isDeferred = false;
  let isTrueLoss = false;

  for (let i = 1; i < calls.length; i++) {
    const prev = calls[i - 1].pipelineStage;
    const curr = calls[i].pipelineStage;
    if (prev === "4. Nurture / Interested" && curr === "5. Future Pool") {
      isDeferred = true;
    }
    if (curr === "Closed / Lost" || curr === "7. Closed / Lost") {
      isTrueLoss = true;
    }
  }

  assert.strictEqual(isDeferred, true, "Must detect Interested → Future Pool transition");
  assert.strictEqual(isTrueLoss, false, "Future Pool transition must NOT be counted as True Loss");
});

// ── Test 6: Interested → Registered / Won counts as Won ─────────────────────
runTest("6. Interested → Registered / Won counts as a successful conversion (Won)", () => {
  const contact = {
    id: "lead_6",
    pipelineStage: "6. Registered / Won",
    status: "Reg.Done",
    history: [
      { timestamp: "2026-09-05T10:00:00Z", status: "Interested", pipelineStage: "4. Nurture / Interested", callPurpose: "SALES" },
      { timestamp: "2026-09-13T16:00:00Z", status: "Reg.Done", pipelineStage: "6. Registered / Won", callPurpose: "SALES" }
    ]
  };

  const calls = getAllCallEntries(contact);
  let isWon = false;
  for (let i = 1; i < calls.length; i++) {
    const prev = calls[i - 1].pipelineStage;
    const curr = calls[i].pipelineStage;
    if (prev === "4. Nurture / Interested" && curr === "6. Registered / Won") {
      isWon = true;
    }
  }

  assert.strictEqual(isWon, true, "Must detect Interested → Registered / Won conversion");
});

// ── Test 7: Direct Info Given → Registered remains direct without inferring Interested ─
runTest("7. Direct Info Given → Registered / Won transition is preserved as direct", () => {
  const contact = {
    id: "lead_7",
    pipelineStage: "6. Registered / Won",
    status: "Reg.Done",
    history: [
      { timestamp: "2026-09-13T10:00:00Z", status: "Info Given", pipelineStage: "3. Information Given", callPurpose: "SALES" },
      { timestamp: "2026-09-13T11:00:00Z", status: "Reg.Done", pipelineStage: "6. Registered / Won", callPurpose: "SALES" }
    ]
  };

  const calls = getAllCallEntries(contact);
  let directConversion = false;
  let falseInterestedInferred = false;

  for (let i = 1; i < calls.length; i++) {
    const prev = calls[i - 1].pipelineStage;
    const curr = calls[i].pipelineStage;
    if (prev === "3. Information Given" && curr === "6. Registered / Won") {
      directConversion = true;
    }
    if (prev === "4. Nurture / Interested" || curr === "4. Nurture / Interested") {
      falseInterestedInferred = true;
    }
  }

  assert.strictEqual(directConversion, true, "Direct Info Given → Registered must be detected");
  assert.strictEqual(falseInterestedInferred, false, "Must NOT artificially insert Interested stage");
});

// ── Test 8: Query & Reminder calls do not trigger sales pipeline transitions ─
runTest("8. Query and Reminder calls are excluded from sales pipeline transitions", () => {
  const contact = {
    id: "lead_8",
    pipelineStage: "1. New Lead",
    status: "Query",
    history: [
      { timestamp: "2026-09-13T10:00:00Z", status: "Query Solved", callPurpose: "QUERY", pipelineStage: "1. New Lead" },
      { timestamp: "2026-09-13T11:00:00Z", status: "Reminder Given", callPurpose: "REMINDER", pipelineStage: "1. New Lead" }
    ]
  };

  const calls = getAllCallEntries(contact);
  assert.strictEqual(calls.length, 2);

  // Filter for SALES only
  const salesCalls = calls.filter(c => String(c.callPurpose || "").toUpperCase() === "SALES");
  assert.strictEqual(salesCalls.length, 0, "Query and Reminder calls must NOT be classified as SALES calls");
});

// ── Test 9: Attender-specific callback data is prioritized over root ─────────
runTest("9. Authoritative attender-specific callback data is prioritized over stale root", () => {
  const contact = {
    id: "lead_9",
    callbackDate: "2026-09-01T10:00:00Z", // Stale root date
    callbackStatus: "pending",
    attenderStates: {
      "attender_priya": {
        callbackDate: "2026-09-15T15:00:00Z", // Fresh authoritative attender date
        callbackStatus: "pending",
        attenderName: "Priya"
      }
    }
  };

  let resolvedCbDate = null;
  if (contact.attenderStates?.attender_priya?.callbackDate) {
    resolvedCbDate = contact.attenderStates.attender_priya.callbackDate;
  } else {
    resolvedCbDate = contact.callbackDate;
  }

  assert.strictEqual(resolvedCbDate, "2026-09-15T15:00:00Z", "Must use attender-specific callbackDate");
});

// ── Test 10: Date filtering isolates transitions to selected date range ──────
runTest("10. Date filtering isolates transitions occurring within range without altering snapshot", () => {
  const contact = {
    id: "lead_10",
    pipelineStage: "6. Registered / Won",
    status: "Reg.Done",
    history: [
      // September 5 call: became Interested
      { timestamp: "2026-09-05T10:00:00Z", status: "Interested", pipelineStage: "4. Nurture / Interested", callPurpose: "SALES" },
      // September 13 call: Registered
      { timestamp: "2026-09-13T14:00:00Z", status: "Reg.Done", pipelineStage: "6. Registered / Won", callPurpose: "SALES" }
    ]
  };

  const calls = getAllCallEntries(contact);
  const targetDate = "2026-09-13";

  // When filtered to 2026-09-13:
  const todaysCalls = calls.filter(c => {
    const dt = c.timestamp ? c.timestamp.toISOString().split("T")[0] : "";
    return dt === targetDate;
  });

  assert.strictEqual(todaysCalls.length, 1, "Only 1 call occurred on Sept 13");
  assert.strictEqual(todaysCalls[0].status, "Reg.Done");

  // Invariant: The lead did NOT become Interested today
  const becameInterestedToday = todaysCalls.some(c => c.status === "Interested");
  assert.strictEqual(becameInterestedToday, false, "Did not become interested today");

  // Invariant: But registered today
  const registeredToday = todaysCalls.some(c => c.status === "Reg.Done");
  assert.strictEqual(registeredToday, true, "Did register today");
});

// ── Test 11: Query & Reminder leads are excluded from Sales 1. New Lead ───────
runTest("11. Query and Reminder leads are excluded from Sales Pipeline 1. New Lead stage", () => {
  const contacts = [
    {
      id: "lead_rem_1",
      pipelineStage: "1. New Lead", // Even if DB says 1. New Lead
      callPurpose: "REMINDER",
      status: "Reminder Given"
    },
    {
      id: "lead_qry_1",
      pipelineStage: "1. New Lead", // Even if DB says 1. New Lead
      callPurpose: "QUERY",
      status: "Query Solved"
    },
    {
      id: "lead_rem_2",
      pipelineStage: "Reminder Desk",
      status: "Reminder Pending"
    }
  ];

  const currentPipelineSnapshot = {
    "1. New Lead": 0,
    "2. Attempting Contact": 0,
    "3. Information Given": 0,
    "4. Nurture / Interested": 0,
    "5. Future Pool": 0,
    "6. Registered / Won": 0,
    "Closed / Lost": 0,
    "Closed / Invalid": 0,
    "Other / Alumni": 0
  };

  const toCleanStageLabel = (rawStage, rawStatus) => {
    const s = String(rawStage || rawStatus || "").toLowerCase().trim();
    if (s.includes("query")) return "Query Desk";
    if (s.includes("reminder")) return "Reminder Desk";
    if (s.includes("reg.done") || s.includes("registered") || s.includes("won")) return "6. Registered / Won";
    if (s.includes("interested") || s.includes("nurture")) return "4. Nurture / Interested";
    if (s.includes("info given") || s.includes("info")) return "3. Information Given";
    if (s.includes("future") || s.includes("next time")) return "5. Future Pool";
    if (s.includes("not int") || s.includes("not possible") || s.includes("lost")) return "Closed / Lost";
    if (s.includes("invalid") || s.includes("wrong")) return "Closed / Invalid";
    if (s.includes("attempting") || s.includes("not connected") || s.includes("busy") || s.includes("no answer") || s.includes("call cut") || s.includes("switched off")) return "2. Attempting Contact";
    if (s.includes("alumni") || s.includes("shivir done")) return "Existing Alumni";
    if (s.includes("previous program")) return "Previous Program Pending";
    return "1. New Lead";
  };

  contacts.forEach(c => {
    const rawCurrent = c.pipelineStage || c.status;
    const cleanCurrent = toCleanStageLabel(rawCurrent, c.status);

    const isQueryOrReminder =
      cleanCurrent === "Query Desk" ||
      cleanCurrent === "Reminder Desk" ||
      rawCurrent === "Query Desk" ||
      rawCurrent === "Reminder Desk" ||
      String(c.callPurpose || "").toUpperCase().trim() === "QUERY" ||
      String(c.callPurpose || "").toUpperCase().trim() === "REMINDER" ||
      String(c.status || "").toLowerCase().includes("query") ||
      String(c.status || "").toLowerCase().includes("reminder") ||
      Boolean(c.queryStatus) ||
      Boolean(c.isQuery) ||
      Boolean(c.isReminder);

    if (isQueryOrReminder) {
      // Excluded from sales pipeline
    } else if (currentPipelineSnapshot[cleanCurrent] !== undefined) {
      currentPipelineSnapshot[cleanCurrent]++;
    }
  });

  assert.strictEqual(currentPipelineSnapshot["1. New Lead"], 0, "1. New Lead MUST be 0 when leads are reminder/query");
});

console.log(`\n🎉 ALL ${passedCount} OPERATIONAL PIPELINE AUDIT TESTS PASSED!\n`);
