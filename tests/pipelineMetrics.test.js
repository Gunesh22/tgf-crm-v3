// tests/pipelineMetrics.test.js
import assert from 'assert';

/**
 * Pipeline & Call Analytics Full Acceptance Engine
 */

export function calculateFullAnalytics(contacts, registrationsList = []) {
  let totalCallsCount = 0;
  let interestedCallsCount = 0;

  const pipelinePeopleCounts = {
    "1. New Lead": 0,
    "2. Attempting Contact": 0,
    "3. Information Given": 0,
    "4. Nurture / Interested": 0,
    "5. Future Pool": 0,
    "6. Registered / Won": 0,
    "Existing Alumni": 0,
    "Query Desk": 0,
    "Closed / Lost": 0,
    "Closed / Invalid": 0
  };

  const seenContactIds = new Set();

  contacts.forEach(contact => {
    // 1. Calculate Historical Call Events (Source: contacts.history -> callId)
    if (Array.isArray(contact.history)) {
      contact.history.forEach(call => {
        totalCallsCount++;
        const s = (call.status || "").trim().toLowerCase();
        if (s === "interested") {
          interestedCallsCount++;
        }
      });
    }

    // 2. Calculate Current Pipeline People (Source: contacts -> pipelineStage)
    if (!seenContactIds.has(contact.id)) {
      seenContactIds.add(contact.id);
      const stage = contact.pipelineStage || "1. New Lead";
      if (pipelinePeopleCounts[stage] !== undefined) {
        pipelinePeopleCounts[stage]++;
      } else {
        pipelinePeopleCounts[stage] = 1;
      }
    }
  });

  // 3. Registrations (Source: registrations collection -> registrationId)
  const totalRegistrations = registrationsList.length;

  return {
    totalCalls: totalCallsCount,
    interestedCalls: interestedCallsCount,
    nurturePeople: pipelinePeopleCounts["4. Nurture / Interested"] || 0,
    registeredPeople: pipelinePeopleCounts["6. Registered / Won"] || 0,
    registrations: totalRegistrations,
    pipelinePeopleCounts
  };
}

// ── FINAL ACCEPTANCE TESTS ───────────────────────────────────────────────────

console.log("=== RUNNING FINAL ACCEPTANCE TESTS FOR PIPELINE & CALL ANALYTICS ===");

// Phase 1: Contact A (5 Int), Contact B (2 Int), Contact C (1 Int)
const phase1Contacts = [
  {
    id: "contact_A",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-1", status: "Interested" },
      { callId: "CALL-2", status: "Interested" },
      { callId: "CALL-3", status: "Interested" },
      { callId: "CALL-4", status: "Interested" },
      { callId: "CALL-5", status: "Interested" }
    ]
  },
  {
    id: "contact_B",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-6", status: "Interested" },
      { callId: "CALL-7", status: "Interested" }
    ]
  },
  {
    id: "contact_C",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-8", status: "Interested" }
    ]
  }
];

const resP1 = calculateFullAnalytics(phase1Contacts, []);
console.log("Phase 1 Result:", resP1);
assert.strictEqual(resP1.interestedCalls, 8, "Phase 1 Interested Calls should be 8");
assert.strictEqual(resP1.nurturePeople, 3, "Phase 1 Nurture People should be 3");
console.log("✓ PHASE 1 PASSED: Interested Calls = 8, Nurture People = 3");

// Phase 2: Register Contact A
const phase2Contacts = [
  {
    id: "contact_A",
    pipelineStage: "6. Registered / Won",
    history: [
      { callId: "CALL-1", status: "Interested" },
      { callId: "CALL-2", status: "Interested" },
      { callId: "CALL-3", status: "Interested" },
      { callId: "CALL-4", status: "Interested" },
      { callId: "CALL-5", status: "Interested" },
      { callId: "CALL-9", status: "Reg.Done" }
    ]
  },
  {
    id: "contact_B",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-6", status: "Interested" },
      { callId: "CALL-7", status: "Interested" }
    ]
  },
  {
    id: "contact_C",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-8", status: "Interested" }
    ]
  }
];
const phase2Registrations = [
  { registrationId: "REG-001", contactId: "contact_A", calledForKey: "MahaAsmani" }
];

const resP2 = calculateFullAnalytics(phase2Contacts, phase2Registrations);
console.log("Phase 2 Result:", resP2);
assert.strictEqual(resP2.interestedCalls, 8, "Phase 2 Interested Calls should remain 8");
assert.strictEqual(resP2.nurturePeople, 2, "Phase 2 Nurture People should decrease to 2");
assert.strictEqual(resP2.registeredPeople, 1, "Phase 2 Registered People should be 1");
assert.strictEqual(resP2.registrations, 1, "Phase 2 Registrations should be 1");
console.log("✓ PHASE 2 PASSED: Interested Calls = 8, Nurture People = 2, Registered People = 1, Registrations = 1");

// Phase 3: Add 3 Reminder calls to Contact A
const phase3Contacts = [
  {
    id: "contact_A",
    pipelineStage: "6. Registered / Won",
    history: [
      { callId: "CALL-1", status: "Interested" },
      { callId: "CALL-2", status: "Interested" },
      { callId: "CALL-3", status: "Interested" },
      { callId: "CALL-4", status: "Interested" },
      { callId: "CALL-5", status: "Interested" },
      { callId: "CALL-9", status: "Reg.Done" },
      { callId: "CALL-10", status: "reminder", purpose: "reminder" },
      { callId: "CALL-11", status: "reminder", purpose: "reminder" },
      { callId: "CALL-12", status: "reminder", purpose: "reminder" }
    ]
  },
  {
    id: "contact_B",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-6", status: "Interested" },
      { callId: "CALL-7", status: "Interested" }
    ]
  },
  {
    id: "contact_C",
    pipelineStage: "4. Nurture / Interested",
    history: [
      { callId: "CALL-8", status: "Interested" }
    ]
  }
];

const resP3 = calculateFullAnalytics(phase3Contacts, phase2Registrations);
console.log("Phase 3 Result:", resP3);
assert.strictEqual(resP3.interestedCalls, 8, "Phase 3 Interested Calls should remain 8");
assert.strictEqual(resP3.totalCalls, 12, "Phase 3 Total Calls should increase by 3 to 12");
assert.strictEqual(resP3.registrations, 1, "Phase 3 Registrations should remain 1");
assert.strictEqual(resP3.registeredPeople, 1, "Phase 3 Registered People should remain 1");
console.log("✓ PHASE 3 PASSED: Interested Calls remains 8, Total Calls = 12, Registrations = 1, Registered People = 1");

console.log("\nALL ACCEPTANCE TESTS COMPLETED WITH 100% SUCCESS! 🎉");
