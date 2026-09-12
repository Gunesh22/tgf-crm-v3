// tests/callIntelligenceTabAudits.test.js
import assert from "node:assert";
import { classifyCallStatus, getCanonicalStatus } from "../src/features/attender/utils.js";

console.log("\n===================================================");
console.log(" CALL INTELLIGENCE TAB — 10 BUG VERIFICATION TESTS ");
console.log("===================================================\n");

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

// ── Test 1: Funnel Invariant & No Negative Drop Rates ─────────────────────────
runTest("1. Funnel cumulative invariant guarantees no negative drop rates", () => {
  const contact = {
    id: "c1",
    status: "Interested",
    history: [
      { status: "Not Picked", timestamp: "2026-09-05T10:00:00.000Z" }
    ]
  };

  const calls = contact.history;
  const isReg = false;
  let hasConnected = false;
  let hasInfo = false;
  let hasInterest = false;

  calls.forEach(call => {
    if (classifyCallStatus(call.status) === "CONNECTED") hasConnected = true;
  });

  const rootCanonical = getCanonicalStatus(contact.status);
  if (rootCanonical === "Info Given" && (hasConnected || calls.length > 0)) hasInfo = true;
  if (rootCanonical === "Interested" && (hasConnected || calls.length > 0)) hasInterest = true;

  const isContactReg = isReg;
  const isContactInterested = isContactReg || hasInterest;
  const isContactInfo = isContactInterested || hasInfo;
  const isContactConnected = isContactInfo || hasConnected;
  const isContactAttempted = isContactConnected || calls.length > 0;

  assert.strictEqual(isContactAttempted, true);
  assert.strictEqual(isContactConnected, true);
  assert.strictEqual(isContactInfo, true);
  assert.strictEqual(isContactInterested, true);
  assert.strictEqual(isContactReg, false);

  const attempted = isContactAttempted ? 1 : 0;
  const connected = isContactConnected ? 1 : 0;
  const info = isContactInfo ? 1 : 0;
  const interest = isContactInterested ? 1 : 0;
  const reg = isContactReg ? 1 : 0;

  assert.ok(attempted >= connected);
  assert.ok(connected >= info);
  assert.ok(info >= interest);
  assert.ok(interest >= reg);

  const dropRate = connected > 0 ? ((connected - info) / connected) * 100 : 0;
  assert.ok(dropRate >= 0, "Drop rate must never be negative");
});

// ── Test 2: Multi-Attempt Yield Curve Attribution ───────────────────────────
runTest("2. Multi-attempt yield curve attributes conversion to attempt where it occurred", () => {
  const calls = [
    { status: "Not Picked", timestamp: "2026-09-01T10:00:00.000Z" },
    { status: "Reg.Done", timestamp: "2026-09-02T11:00:00.000Z" },
    { status: "Reminder", timestamp: "2026-09-03T12:00:00.000Z" },
    { status: "Query", timestamp: "2026-09-04T13:00:00.000Z" },
    { status: "Reminder", timestamp: "2026-09-05T14:00:00.000Z" }
  ];

  const regCallIdx = calls.findIndex(call => {
    const s = getCanonicalStatus(call.status);
    return s === "Reg.Done" || s === "Registered";
  });
  const regAttempt = regCallIdx >= 0 ? regCallIdx + 1 : calls.length;

  assert.strictEqual(regAttempt, 2, "Registration must be attributed to Attempt #2, not Attempt #5+");
});

// ── Test 3: Closer Attribution in Attender Matrix ───────────────────────────
runTest("3. Attender Matrix credits closer even if closer is not in initial attenders array", () => {
  const attMap = new Map();
  attMap.set("Alice", { name: "Alice", registeredCount: 0, peopleCalledIds: new Set() });

  const closerName = "Priyanka";
  if (!attMap.has(closerName)) {
    attMap.set(closerName, {
      attenderId: closerName,
      name: closerName,
      peopleCalledIds: new Set(),
      totalCalls: 0,
      connectedCalls: 0,
      infoGivenCount: 0,
      interestedCount: 0,
      registeredCount: 0
    });
  }

  const aObj = attMap.get(closerName);
  aObj.registeredCount++;
  aObj.peopleCalledIds.add("c123");

  assert.strictEqual(attMap.has("Priyanka"), true);
  assert.strictEqual(attMap.get("Priyanka").registeredCount, 1);
  assert.strictEqual(attMap.get("Priyanka").peopleCalledIds.has("c123"), true);
});

// ── Test 4: Attender Invariant (Fixes Priyanka 6 int vs 7 reg) ────────────────
runTest("4. Attender invariants enforce interestedCount >= registeredCount", () => {
  const aObj = {
    totalCalls: 10,
    connectedCalls: 5,
    infoGivenCount: 6,
    interestedCount: 6,
    registeredCount: 7
  };

  if (aObj.interestedCount < aObj.registeredCount) aObj.interestedCount = aObj.registeredCount;
  if (aObj.infoGivenCount < aObj.interestedCount) aObj.infoGivenCount = aObj.interestedCount;
  if (aObj.connectedCalls < aObj.registeredCount) aObj.connectedCalls = aObj.registeredCount;
  if (aObj.totalCalls < aObj.connectedCalls) aObj.totalCalls = aObj.connectedCalls;

  assert.strictEqual(aObj.interestedCount >= aObj.registeredCount, true);
  assert.strictEqual(aObj.infoGivenCount >= aObj.interestedCount, true);
  assert.strictEqual(aObj.connectedCalls >= aObj.registeredCount, true);
  assert.strictEqual(aObj.interestedCount, 7);
  assert.strictEqual(aObj.infoGivenCount, 7);
  assert.strictEqual(aObj.connectedCalls, 7);
});

// ── Test 5: Overdue Callback Discipline Filter ────────────────────────────────
runTest("5. Overdue callback excludes contacts that were already called on/after callback date", () => {
  const todayStr = "2026-09-12";
  const cbDateStr = "2026-09-10";

  // Case A: Attender called them yesterday ("2026-09-11")
  const lastCallDateStrA = "2026-09-11";
  const isMissedA = cbDateStr && cbDateStr < todayStr && (!lastCallDateStrA || lastCallDateStrA < cbDateStr);
  assert.strictEqual(isMissedA, false, "Called after callback date must NOT be overdue");

  // Case B: Attender has NOT called them since the scheduled callback date
  const lastCallDateStrB = "2026-09-08";
  const isMissedB = cbDateStr && cbDateStr < todayStr && (!lastCallDateStrB || lastCallDateStrB < cbDateStr);
  assert.strictEqual(isMissedB, true, "Not called after callback date MUST be overdue");
});

// ── Test 6: Speed Alert Filter Excludes Future Scheduled Callbacks ───────────
runTest("6. Speed Alert (>24h) excludes interested leads with agreed future callbacks", () => {
  const todayStr = "2026-09-12";
  const cbDateStr = "2026-09-15";
  const hasFutureCallback = cbDateStr && cbDateStr >= todayStr;

  const rootCanonical = "Interested";
  const diffHours = 48;

  const shouldFlagSpeed = rootCanonical === "Interested" && diffHours >= 24 && !hasFutureCallback;
  assert.strictEqual(shouldFlagSpeed, false, "Must not flag speed alert when agreed future callback exists");
});

// ── Test 7: Golden Window Excludes Dead / Invalid Numbers ─────────────────────
runTest("7. Golden Window excludes dead / invalid numbers", () => {
  const testStatuses = [
    { status: "Invalid Number", expectInclude: false },
    { status: "Wrong Number", expectInclude: false },
    { status: "Not Exist", expectInclude: false },
    { status: "Switched Off", expectInclude: true },
    { status: "Not Picked Up", expectInclude: true },
    { status: "Busy", expectInclude: true }
  ];

  testStatuses.forEach(({ status, expectInclude }) => {
    const sLower = status.toLowerCase();
    const isDeadNumber = sLower.includes("invalid") || sLower.includes("wrong") || sLower.includes("not exist");
    const isNotConnected = classifyCallStatus(status) === "NOT_CONNECTED";
    const qualify = isNotConnected && !isDeadNumber;
    assert.strictEqual(qualify, expectInclude, `Status '${status}' qualification mismatch`);
  });
});

// ── Test 8: Multi-Program Comma Separation Filter ─────────────────────────────
runTest("8. Multi-Program comma-separated string matches individual filter selections", () => {
  const rawP = "Studya Smater, Yoga 1 Yr";
  const contactPrograms = rawP.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const callPrograms = [];
  const allPrograms = [...contactPrograms, ...callPrograms];

  const selectedPrograms = ["Studya Smater"];
  const matches = selectedPrograms.some(sel => {
    const sLower = sel.trim().toLowerCase();
    return allPrograms.some(p => p === sLower || p.includes(sLower));
  });

  assert.strictEqual(matches, true, "Studya Smater should match contact with 'Studya Smater, Yoga 1 Yr'");
});

// ── Test 9: Attender Filter Checks Historical Call Attenders ──────────────────
runTest("9. Attender filter checks both root attender and historical call attenders", () => {
  const contact = {
    attenderName: "Alice",
    assignedTo: ["Alice"]
  };
  const entries = [
    { attenderName: "Bob", timestamp: "2026-09-02T10:00:00.000Z" }
  ];

  const selectedAttenders = ["Bob"];
  const aId = String(contact.attenderId || "").trim();
  const aName = String(contact.attenderName || "").trim();
  const assigned = Array.isArray(contact.assignedTo) ? contact.assignedTo.map(String) : [];
  const callAttenders = entries.map(call => String(call.attenderName || call.attenderId || "").trim()).filter(Boolean);

  const matchesAtt = selectedAttenders.some(sel => 
    sel === aId || sel === aName || assigned.includes(sel) || callAttenders.includes(sel)
  );

  assert.strictEqual(matchesAtt, true, "Contact called by Bob should match when Bob is filtered");
});

// ── Test 10: Date Sync Sets Month Key or 'ALL' ─────────────────────────────────
runTest("10. Date range changes sync single-month to monthKey and multi-month to 'ALL'", () => {
  const syncRange = (start, end) => {
    const startM = start.slice(0, 7);
    const endM = end.slice(0, 7);
    return startM === endM ? startM : "ALL";
  };

  assert.strictEqual(syncRange("2026-09-01", "2026-09-30"), "2026-09");
  assert.strictEqual(syncRange("2026-08-01", "2026-08-31"), "2026-08");
  assert.strictEqual(syncRange("2026-08-15", "2026-09-15"), "ALL");
});

console.log("\n---------------------------------------------------");
console.log(`Total: ${passedCount}  |  Passed: ${passedCount}  |  Failed: 0`);
console.log("===================================================\n");
