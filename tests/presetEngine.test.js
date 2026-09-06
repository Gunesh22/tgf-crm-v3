/**
 * Preset Rule Builder & Funnel Intelligence Engine — Unit Tests
 * Tests rule matching, custom regex evaluations, and preset summary aggregations.
 *
 * Run: node tests/presetEngine.test.js
 */

import {
  safeRegexTest,
  getContactAllPrograms,
  getContactCallCount,
  evaluatePresetRule,
  evaluatePresetSummary,
  BUILT_IN_PRESETS,
  createReportFromSimpleInputs,
} from '../src/utils/presetEngine.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: '✅ PASS', label, detail });
  } else {
    failed++;
    results.push({ status: '❌ FAIL', label, detail });
    console.error(`FAIL: ${label}${detail ? ' — ' + detail : ''}`);
  }
}

// Mock Contacts Dataset
const mockContacts = [
  // 1. CBT Basic alumni upselling to CBT Advanced (Reg.Done)
  {
    id: "c1",
    Name: "Rahul Sharma",
    "Called For": "CBT Advanced Batch 1",
    previousProgram: "CBT Basic 2025",
    status: "Reg.Done",
    original_source: "Facebook Ads",
    history: [
      { calledFor: "CBT Basic 2025", status: "Reg.Done" },
      { calledFor: "CBT Advanced Batch 1", status: "Reg.Done" }
    ]
  },
  // 2. CBT Basic alumni inquiring about CBT Advanced (Interested)
  {
    id: "c2",
    Name: "Priya Patel",
    "Called For": "CBT Advanced",
    history: [
      { calledFor: "CBT Basic", status: "Reg.Done" },
      { calledFor: "CBT Advanced", status: "Interested" }
    ],
    status: "Interested"
  },
  // 3. Direct CBT Advanced Student (No Basic)
  {
    id: "c3",
    Name: "Amit Verma",
    "Called For": "CBT Advanced",
    status: "Reg.Done",
    history: [
      { calledFor: "CBT Advanced", status: "Reg.Done" }
    ]
  },
  // 4. Facebook Lead - Uncalled
  {
    id: "c4",
    Name: "Sneha Gupta",
    "Called For": "CBT Basic",
    original_source: "Facebook",
    status: "New Lead",
    history: []
  },
  // 5. Instagram Lead - Multi-called 4 times, Unresponsive
  {
    id: "c5",
    Name: "Vikas Singh",
    "Called For": "Study Smarter",
    original_source: "Instagram Comment",
    status: "Not Picked Up",
    history: [
      { status: "Not Picked Up" },
      { status: "Not Picked Up" },
      { status: "Not Picked Up" },
      { status: "Not Picked Up" }
    ]
  },
  // 6. Not Interested with Financial Objection
  {
    id: "c6",
    Name: "Ananya Roy",
    "Called For": "Off MA",
    original_source: "Website",
    status: "Not Interested",
    history: [
      { status: "Info Given" },
      { status: "Not Interested", notes: "Fees too high" }
    ]
  }
];

// ── Test 1: safeRegexTest Helper ──────────────────────────────────────────────
{
  assert('1a. Empty regex matches everything', safeRegexTest("", "Any Text") === true);
  assert('1b. Basic case-insensitive match', safeRegexTest("facebook", "Facebook Lead") === true);
  assert('1c. Regex OR pattern match', safeRegexTest("cbt.*adv|advanced", "CBT Advanced Batch 1") === true);
  assert('1d. Regex fail match', safeRegexTest("instagram", "Facebook") === false);
  assert('1e. Handles bad regex syntax gracefully', safeRegexTest("([unclosed", "([unclosed text") === true);
}

// ── Test 2: getContactAllPrograms Helper ────────────────────────────────────
{
  const progs1 = getContactAllPrograms(mockContacts[0]);
  assert('2a. Extracts all programs from history & fields', progs1.includes("CBT Advanced Batch 1") && progs1.includes("CBT Basic 2025"));

  const progs3 = getContactAllPrograms(mockContacts[2]);
  assert('2b. Direct admissions returns only target program', progs3.length === 1 && progs3[0] === "CBT Advanced");
}

// ── Test 3: getContactCallCount Helper ──────────────────────────────────────
{
  assert('3a. Zero calls logged', getContactCallCount(mockContacts[3]) === 0);
  assert('3b. Two calls logged in history', getContactCallCount(mockContacts[0]) === 2);
  assert('3c. Four calls logged in history', getContactCallCount(mockContacts[4]) === 4);
}

// ── Test 4: Preset 1 - CBT Basic to CBT Advanced Upsell ─────────────────────
{
  const presetUpsell = BUILT_IN_PRESETS.find(p => p.id === "preset_upsell_cbt");
  const summary = evaluatePresetSummary(mockContacts, presetUpsell);
  assert('4a. Matches Rahul (c1) and Priya (c2)', summary.totalCount === 2);
  assert('4b. Direct student Amit (c3) excluded from Upsell preset', !summary.matchingContacts.some(c => c.id === "c3"));
  assert('4c. Registered count is 1 (Rahul)', summary.convertedCount === 1);
}

// ── Test 5: Preset 2 - Direct CBT Advanced Admissions ──────────────────────
{
  const presetDirectAdv = BUILT_IN_PRESETS.find(p => p.id === "preset_direct_adv");
  const summary = evaluatePresetSummary(mockContacts, presetDirectAdv);
  assert('5a. Matches Amit Verma (c3)', summary.totalCount === 1 && summary.matchingContacts[0].id === "c3");
  assert('5b. Rahul (c1) excluded because he took CBT Basic first', !summary.matchingContacts.some(c => c.id === "c1"));
}

// ── Test 6: Preset 3 - Facebook Lead Conversion & Pending Tracker ────────────
{
  const presetFB = BUILT_IN_PRESETS.find(p => p.id === "preset_fb_leads");
  const summary = evaluatePresetSummary(mockContacts, presetFB);
  assert('6a. Matches Rahul (c1) and Sneha (c4)', summary.totalCount === 2);
  assert('6b. Called count is 1 (Rahul)', summary.calledCount === 1);
  assert('6c. Uncalled count is 1 (Sneha)', summary.uncalledCount === 1);
  assert('6d. Converted count is 1 (Rahul)', summary.convertedCount === 1);
}

// ── Test 7: Preset 4 - Instagram Comment & DM Inquiry Tracker ───────────────
{
  const presetIG = BUILT_IN_PRESETS.find(p => p.id === "preset_ig_leads");
  const summary = evaluatePresetSummary(mockContacts, presetIG);
  assert('7a. Matches Vikas Singh (c5)', summary.totalCount === 1 && summary.matchingContacts[0].id === "c5");
}

// ── Test 8: Preset 5 - Unresponsive After 3+ Calls ─────────────────────────
{
  const presetUnresponsive = BUILT_IN_PRESETS.find(p => p.id === "preset_unresponsive_3calls");
  const summary = evaluatePresetSummary(mockContacts, presetUnresponsive);
  assert('8a. Matches Vikas (c5, 4 calls)', summary.totalCount === 1 && summary.matchingContacts[0].id === "c5");
  assert('8b. Rahul (c1, 2 calls) excluded from 3+ calls rule', !summary.matchingContacts.some(c => c.id === "c1"));
}

// ── Test 9: Preset 6 - Not Interested & Objection Analysis ─────────────────
{
  const presetNotInterested = BUILT_IN_PRESETS.find(p => p.id === "preset_not_interested");
  const summary = evaluatePresetSummary(mockContacts, presetNotInterested);
  assert('9a. Matches Ananya Roy (c6)', summary.totalCount === 1 && summary.matchingContacts[0].id === "c6");
}

// ── Test 10: Preset 7 - Uncalled New Leads ───────────────────────────────────
{
  const presetUncalled = BUILT_IN_PRESETS.find(p => p.id === "preset_uncalled_leads");
  const summary = evaluatePresetSummary(mockContacts, presetUncalled);
  assert('10a. Matches Sneha Gupta (c4, 0 calls)', summary.totalCount === 1 && summary.matchingContacts[0].id === "c4");
}

// ── Test 11: createReportFromSimpleInputs Adapter Test ─────────────────────
{
  const customReport = createReportFromSimpleInputs({
    title: "CBT Basic -> CBT Advanced (Facebook)",
    templateType: "conversion",
    fromProgram: "CBT Basic",
    toProgram: "CBT Advanced",
    leadOrigin: "Facebook"
  });

  const summary = evaluatePresetSummary(mockContacts, customReport);
  assert('11a. Simple report creation matches CBT Basic to Advanced Facebook lead Rahul (c1)', summary.totalCount === 1 && summary.matchingContacts[0].id === "c1");
  assert('11b. Generated category is Program Conversion', customReport.category === "Program Conversion");

  const tagReport = createReportFromSimpleInputs({
    title: "VIP Tag Leads",
    leadOrigin: "Facebook",
    currentSource: "VIP"
  });
  assert('11c. Explicit leadOrigin and currentSource mapped to report properties', tagReport.leadOrigin === "Facebook" && tagReport.currentSource === "VIP");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════');
console.log(' PRESET ENGINE — TEST RESULTS');
console.log('═══════════════════════════════════════');
results.forEach(r => console.log(`${r.status}  ${r.label}${r.detail ? ` (${r.detail})` : ''}`));
console.log('───────────────────────────────────────');
console.log(`Total: ${passed + failed}  ✅ Passed: ${passed}  ❌ Failed: ${failed}`);
console.log('═══════════════════════════════════════\n');

if (failed > 0) process.exit(1);
