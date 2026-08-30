// scripts/test-settings-caching.js
import { getSettingsOptions, updateCallCenterOptions } from '../src/lib/db.js';

let apiGetCallCount = 0;
let apiPostCallCount = 0;

// Mock global fetch for Node testing
globalThis.fetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  if (url.includes('/api/admin/settings')) {
    if (method === 'GET') {
      apiGetCallCount++;
      const payload = JSON.stringify({
        success: true,
        data: {
          statusOptions: ['Info given', 'Interested', 'Reg.Done'],
          sourceOptions: ['Instagram', 'Facebook'],
          calledForOptions: ['CBT Basic'],
          whatsappTemplates: []
        }
      });
      return {
        ok: true,
        status: 200,
        text: async () => payload,
        json: async () => JSON.parse(payload)
      };
    }
    if (method === 'POST' || method === 'PUT') {
      apiPostCallCount++;
      const bodyData = JSON.parse(options.body || '{}');
      const payload = JSON.stringify({
        success: true,
        data: {
          ...bodyData,
          updatedAt: new Date().toISOString()
        }
      });
      return {
        ok: true,
        status: 200,
        text: async () => payload,
        json: async () => JSON.parse(payload)
      };
    }
  }
  return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
};

async function runSettingsCacheTest() {
  console.log("===================================================");
  console.log(" SETTINGS CACHING & DEDUPLICATION VERIFICATION");
  console.log("===================================================\n");

  apiGetCallCount = 0;
  apiPostCallCount = 0;

  // 1. Initial Application Load: Call getSettingsOptions 50 times concurrently (simulating 50 WhatsAppButtons rendering at once)
  console.log("TEST 1: 50 concurrent calls on initial load (Simulating 50 WhatsAppButtons rendering)...");
  const concurrentCalls = Array.from({ length: 50 }, () => getSettingsOptions());
  const results = await Promise.all(concurrentCalls);
  
  console.log(` -> 50 concurrent callers resolved successfully.`);
  console.log(` -> Total GET /api/admin/settings network requests made: ${apiGetCallCount}`);
  if (apiGetCallCount === 1) {
    console.log(" -> ✅ PASS: 50 simultaneous callers shared exactly 1 GET request.\n");
  } else {
    console.error(` -> ❌ FAIL: Expected 1 GET request, got ${apiGetCallCount}\n`);
    process.exit(1);
  }

  // 2. Subsequent Tab Switch / Interactions during same session
  console.log("TEST 2: Switching tabs / re-rendering components during same session...");
  for (let i = 0; i < 10; i++) {
    await getSettingsOptions();
  }
  console.log(` -> 10 subsequent tab switch calls completed.`);
  console.log(` -> Total GET /api/admin/settings network requests made so far: ${apiGetCallCount}`);
  if (apiGetCallCount === 1) {
    console.log(" -> ✅ PASS: 0 additional GET requests made during session.\n");
  } else {
    console.error(` -> ❌ FAIL: Expected 1 total GET request, got ${apiGetCallCount}\n`);
    process.exit(1);
  }

  // 3. Admin Saves a Setting
  console.log("TEST 3: Admin saves a setting (updateCallCenterOptions)...");
  await updateCallCenterOptions({
    statusOptions: ['Info given', 'Interested', 'Reg.Done', 'New Status'],
    sourceOptions: ['Instagram', 'Facebook', 'YouTube']
  });
  console.log(` -> POST /api/admin/settings completed.`);
  console.log(` -> Total POST requests: ${apiPostCallCount}`);
  console.log(` -> Total GET requests: ${apiGetCallCount}`);

  // Fetch settings again post-save
  const postSaveData = await getSettingsOptions();
  console.log(` -> Post-save fetch got updated sources:`, postSaveData.sourceOptions);
  console.log(` -> Total GET requests after post-save read: ${apiGetCallCount}`);

  if (apiPostCallCount === 1 && apiGetCallCount === 1 && postSaveData.sourceOptions.includes('YouTube')) {
    console.log(" -> ✅ PASS: POST succeeded, in-memory cache updated instantly, 0 extra GET requests.\n");
  } else {
    console.error(" -> ❌ FAIL: Post-save cache behavior incorrect\n");
    process.exit(1);
  }

  console.log("===================================================");
  console.log(" SUMMARY OF REQUEST COUNTS:");
  console.log(" - Initial App Load (50 components): 1 GET request");
  console.log(" - 10 Tab Switches: 0 additional GET requests");
  console.log(" - 50 WhatsAppButtons: 0 additional GET requests");
  console.log(" - Save Setting: 1 POST request, 0 GET requests");
  console.log(" ALL VERIFICATIONS PASSED PERFECTLY!");
  console.log("===================================================");
}

runSettingsCacheTest().catch(err => {
  console.error(err);
  process.exit(1);
});
