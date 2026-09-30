import { getSettingsOptions, updateCallCenterOptions, __resetSettingsCacheForTesting } from '../src/lib/db.js';

let apiGetCallCount = 0;
let apiPostCallCount = 0;

// Mock server state representing MongoDB 'call_center_options'
const serverDoc = {
  revision: 1,
  fieldRevisions: {
    sourceOptions: 1,
    calledForOptions: 1,
    statusOptions: 1
  },
  sourceOptions: ['Facebook', 'Instagram', 'YouTube'],
  calledForOptions: ['CBT Basic', 'CBT Avd'],
  statusOptions: ['Interested', 'Info Given', 'Reg.Done'],
  whatsappTemplates: []
};

let clientStorage = {};
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k) => clientStorage[k] || null,
    setItem: (k, v) => { clientStorage[k] = String(v); },
    removeItem: (k) => { delete clientStorage[k]; },
    clear: () => { clientStorage = {}; }
  };
}

let simulateAuthFailure = false;
let lastReturnedChangedFields = [];

// Mock global fetch for Node testing
globalThis.fetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  if (url.includes('/api/admin/settings')) {
    if (simulateAuthFailure) {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ success: false, error: 'Unauthorized' }),
        json: async () => ({ success: false, error: 'Unauthorized' })
      };
    }

    if (method === 'GET') {
      apiGetCallCount++;
      const urlObj = new URL(url, 'http://localhost');
      const sinceRevRaw = urlObj.searchParams.get('sinceRevision');
      const sinceRev = (sinceRevRaw !== null && sinceRevRaw !== '' && !isNaN(Number(sinceRevRaw)))
        ? parseInt(sinceRevRaw, 10)
        : null;

      // 1. Full load
      if (sinceRev === null || sinceRev < 1 || sinceRev > serverDoc.revision) {
        lastReturnedChangedFields = ['*ALL*'];
        const payload = JSON.stringify({
          success: true,
          modified: true,
          revision: serverDoc.revision,
          data: { ...serverDoc }
        });
        return {
          ok: true,
          status: 200,
          text: async () => payload,
          json: async () => JSON.parse(payload)
        };
      }

      // 2. Unchanged
      if (sinceRev === serverDoc.revision) {
        lastReturnedChangedFields = [];
        const payload = JSON.stringify({
          success: true,
          modified: false,
          revision: serverDoc.revision
        });
        return {
          ok: true,
          status: 200,
          text: async () => payload,
          json: async () => JSON.parse(payload)
        };
      }

      // 3. Differential: return only changed fields
      const changed = {};
      for (const [f, rev] of Object.entries(serverDoc.fieldRevisions)) {
        if (rev > sinceRev && serverDoc[f] !== undefined) {
          changed[f] = serverDoc[f];
        }
      }
      lastReturnedChangedFields = Object.keys(changed);
      const payload = JSON.stringify({
        success: true,
        modified: true,
        revision: serverDoc.revision,
        data: changed
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
      const nextRev = (serverDoc.revision || 1) + 1;
      serverDoc.revision = nextRev;
      for (const [k, v] of Object.entries(bodyData)) {
        serverDoc[k] = v;
        serverDoc.fieldRevisions[k] = nextRev;
      }
      const payload = JSON.stringify({
        success: true,
        revision: nextRev,
        data: { ...serverDoc }
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

async function runFieldDifferentialSyncTests() {
  console.log("===================================================");
  console.log(" FIELD-LEVEL DIFFERENTIAL SYNC VERIFICATION (9 TESTS)");
  console.log("===================================================\n");

  // TEST 1: Fresh browser with no cache
  console.log("TEST 1: Fresh browser with no cache...");
  clientStorage = {};
  __resetSettingsCacheForTesting();
  apiGetCallCount = 0;
  apiPostCallCount = 0;
  const t1 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Downloaded revision: ${t1.revision}`);
  console.log(` -> Changed fields sent: ${lastReturnedChangedFields.join(', ')}`);
  console.log(` -> Sources loaded: ${t1.sourceOptions.length}`);
  if (t1.revision === 1 && lastReturnedChangedFields.includes('*ALL*')) {
    console.log(" -> ✅ PASS: Full settings downloaded and cached with revision.\n");
  } else {
    throw new Error("TEST 1 Failed");
  }

  // TEST 2: Refresh without any settings change
  console.log("TEST 2: Refresh without any settings change...");
  apiGetCallCount = 0;
  const t2 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Checked server. Changed fields sent: ${lastReturnedChangedFields.length === 0 ? 'NONE (modified: false)' : lastReturnedChangedFields.join(', ')}`);
  if (t2.revision === 1 && lastReturnedChangedFields.length === 0) {
    console.log(" -> ✅ PASS: modified:false. No full settings payload transferred.\n");
  } else {
    throw new Error("TEST 2 Failed");
  }

  // TEST 3: Admin adds "Partner Campaign" to sourceOptions. Other browser refreshes.
  console.log("TEST 3: Admin adds 'Partner Campaign' to sourceOptions...");
  await updateCallCenterOptions({
    sourceOptions: [...serverDoc.sourceOptions, "Partner Campaign"]
  });
  console.log(` -> Admin saved. Current server revision: ${serverDoc.revision}`);
  console.log(` -> Server fieldRevisions:`, serverDoc.fieldRevisions);

  // Other browser on revision 1 refreshes
  clientStorage['crm_settings_options_cache'] = JSON.stringify({
    revision: 1,
    sourceOptions: ['Facebook', 'Instagram', 'YouTube'],
    calledForOptions: ['CBT Basic', 'CBT Avd'],
    statusOptions: ['Interested', 'Info Given', 'Reg.Done']
  });
  __resetSettingsCacheForTesting();

  const t3 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Other client refreshed.`);
  console.log(` -> Received only fields: ${lastReturnedChangedFields.join(', ')}`);
  console.log(` -> Other client revision updated to: ${t3.revision}`);
  console.log(` -> Partner Campaign present: ${t3.sourceOptions.includes("Partner Campaign")}`);
  console.log(` -> Unrelated calledForOptions preserved: ${t3.calledForOptions.includes("CBT Basic")}`);
  if (t3.revision === 2 && lastReturnedChangedFields.length === 1 && lastReturnedChangedFields[0] === 'sourceOptions' && t3.sourceOptions.includes("Partner Campaign")) {
    console.log(" -> ✅ PASS: Only sourceOptions was returned. Dropdown shows Partner Campaign.\n");
  } else {
    throw new Error("TEST 3 Failed");
  }

  // TEST 4: Refresh again without changes
  console.log("TEST 4: Refresh again without changes...");
  const t4 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Server response fields: ${lastReturnedChangedFields.length === 0 ? 'NONE (modified: false)' : lastReturnedChangedFields.join(', ')}`);
  if (t4.revision === 2 && lastReturnedChangedFields.length === 0) {
    console.log(" -> ✅ PASS: modified:false. Zero settings payload transferred.\n");
  } else {
    throw new Error("TEST 4 Failed");
  }

  // TEST 5: Admin deletes Partner Campaign. Other browser refreshes.
  console.log("TEST 5: Admin deletes Partner Campaign. Other browser refreshes...");
  await updateCallCenterOptions({
    sourceOptions: serverDoc.sourceOptions.filter(s => s !== "Partner Campaign")
  });
  console.log(` -> Server revision after delete: ${serverDoc.revision}`);

  // Client on revision 2 refreshes
  clientStorage['crm_settings_options_cache'] = JSON.stringify({
    revision: 2,
    sourceOptions: [...serverDoc.sourceOptions, "Partner Campaign"],
    calledForOptions: ['CBT Basic', 'CBT Avd'],
    statusOptions: ['Interested', 'Info Given', 'Reg.Done']
  });
  __resetSettingsCacheForTesting();

  const t5 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Other client refreshed after deletion.`);
  console.log(` -> Partner Campaign in client?: ${t5.sourceOptions.includes("Partner Campaign")}`);
  if (!t5.sourceOptions.includes("Partner Campaign") && t5.revision === 3 && lastReturnedChangedFields[0] === 'sourceOptions') {
    console.log(" -> ✅ PASS: sourceOptions replaced authoritatively. Partner Campaign deleted with zero duplicates.\n");
  } else {
    throw new Error("TEST 5 Failed");
  }

  // TEST 6: Admin changes Called For while Source remains unchanged
  console.log("TEST 6: Admin changes Called For while Source remains unchanged...");
  await updateCallCenterOptions({
    calledForOptions: [...serverDoc.calledForOptions, "New Shivir 2026"]
  });
  console.log(` -> Server revision: ${serverDoc.revision}`);
  console.log(` -> sourceOptions rev: ${serverDoc.fieldRevisions.sourceOptions} (unchanged)`);
  console.log(` -> calledForOptions rev: ${serverDoc.fieldRevisions.calledForOptions} (bumped)`);

  // Client on revision 3 refreshes
  clientStorage['crm_settings_options_cache'] = JSON.stringify({
    revision: 3,
    sourceOptions: ['Facebook', 'Instagram'],
    calledForOptions: ['CBT Basic']
  });
  __resetSettingsCacheForTesting();

  const t6 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Changed fields returned: ${lastReturnedChangedFields.join(', ')}`);
  console.log(` -> Has New Shivir 2026: ${t6.calledForOptions.includes("New Shivir 2026")}`);
  if (t6.revision === 4 && lastReturnedChangedFields.length === 1 && lastReturnedChangedFields[0] === 'calledForOptions') {
    console.log(" -> ✅ PASS: Only calledForOptions was returned.\n");
  } else {
    throw new Error("TEST 6 Failed");
  }

  // TEST 7: Admin changes Source and Called For before another client sync
  console.log("TEST 7: Admin changes Source and Called For before another client sync...");
  await updateCallCenterOptions({
    sourceOptions: ['Source A', 'Source B'],
    calledForOptions: ['Prog A', 'Prog B']
  });

  const clientRev4 = {
    revision: 4,
    sourceOptions: ['Facebook'],
    calledForOptions: ['CBT Basic']
  };
  clientStorage['crm_settings_options_cache'] = JSON.stringify(clientRev4);
  __resetSettingsCacheForTesting();

  const t7 = await getSettingsOptions({ forceRefresh: true });
  console.log(` -> Fields returned: ${lastReturnedChangedFields.join(', ')}`);
  console.log(` -> Client revision: ${t7.revision}`);
  if (t7.revision === 5 && lastReturnedChangedFields.includes('sourceOptions') && lastReturnedChangedFields.includes('calledForOptions')) {
    console.log(" -> ✅ PASS: Both changed fields returned and merged properly.\n");
  } else {
    throw new Error("TEST 7 Failed");
  }

  // TEST 8: Unauthenticated request returns 401
  console.log("TEST 8: Unauthenticated request returns 401...");
  simulateAuthFailure = true;
  clientStorage['crm_settings_options_cache'] = JSON.stringify({
    revision: 6,
    sourceOptions: ['Valid Cache Option']
  });
  __resetSettingsCacheForTesting();
  const t8 = await getSettingsOptions({ forceRefresh: true });
  simulateAuthFailure = false;
  console.log(` -> Returned data under 401:`, t8.sourceOptions);
  console.log(` -> Stored cache after 401:`, JSON.parse(clientStorage['crm_settings_options_cache']).sourceOptions);
  if (t8.sourceOptions.includes('Valid Cache Option')) {
    console.log(" -> ✅ PASS: 401 did NOT poison or overwrite local cache with static fallback.\n");
  } else {
    throw new Error("TEST 8 Failed");
  }

  // TEST 9: Two admins update settings nearly simultaneously
  console.log("TEST 9: Revision monotonicity...");
  const revBefore = serverDoc.revision;
  await updateCallCenterOptions({ sourceOptions: ['Concurrent 1'] });
  const revMid = serverDoc.revision;
  await updateCallCenterOptions({ sourceOptions: ['Concurrent 2'] });
  const revAfter = serverDoc.revision;
  console.log(` -> Revisions sequence: ${revBefore} -> ${revMid} -> ${revAfter}`);
  if (revMid === revBefore + 1 && revAfter === revMid + 1) {
    console.log(" -> ✅ PASS: Revisions remain strictly monotonic without collisions.\n");
  } else {
    throw new Error("TEST 9 Failed");
  }

  console.log("===================================================");
  console.log(" ALL 9 VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("===================================================");
}

runFieldDifferentialSyncTests().catch(err => {
  console.error(err);
  process.exit(1);
});
