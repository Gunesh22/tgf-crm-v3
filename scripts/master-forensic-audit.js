// scripts/master-forensic-audit.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, LEGACY_DISPLAY_STAGES, STAGE_RANKS, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES, getEffectiveStage } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function runMasterAudit() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();
  const attenders = await db.collection('attenders').find({}).toArray();

  console.log('====================================================');
  console.log('MASTER FORENSIC AUDIT — COMPREHENSIVE DIRECT DB AUDIT');
  console.log('====================================================\n');

  console.log(`- Live MongoDB Contacts: ${contacts.length}`);
  console.log(`- Live MongoDB Registrations: ${registrations.length}`);
  console.log(`- Live MongoDB Attenders: ${attenders.length}\n`);

  // PART 1 & 2 & 3: FORENSIC CONTACT AUDIT
  const newLeadForensicTable = [];
  const testGarbageTable = [];
  const registeredPeopleTable = [];

  const stageCounts = {
    [PIPELINE_STAGES.NEW_LEAD]: 0,
    [PIPELINE_STAGES.ATTEMPTING]: 0,
    [PIPELINE_STAGES.INFO_GIVEN]: 0,
    [PIPELINE_STAGES.NURTURE_INTERESTED]: 0,
    [PIPELINE_STAGES.FUTURE_POOL]: 0,
    [PIPELINE_STAGES.REGISTERED_WON]: 0,
    [PIPELINE_STAGES.CLOSED_LOST]: 0,
    [PIPELINE_STAGES.CLOSED_INVALID]: 0,
    [LEGACY_DISPLAY_STAGES.QUERY_DESK]: 0,
    "Unknown / Legacy": 0
  };

  const regDocMap = new Map();
  registrations.forEach(r => {
    const key = String(r.contactId);
    if (!regDocMap.has(key)) regDocMap.set(key, []);
    regDocMap.get(key).push(r);
  });

  const suspiciousPattern = /test|gunesh|kunesh|dunesh|hunesh|eunehs|cunesh|wunesh|tetette|unknown/i;

  contacts.forEach(c => {
    const cid = String(c._id || c.id);
    const name = c.name || c.Name || '';
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();
    const calledForLower = (c['Called For'] || c.calledFor || '').toLowerCase().trim();
    const attenderName = c.attenderName || c.assignedName || (hist[0] && hist[0].attenderName) || 'Unassigned';

    let salesAttempts = 0;
    let queryCalls = 0;
    let connectedSalesOutcome = null;

    hist.forEach(h => {
      const purp = (h.callPurpose || h.purpose || '').toLowerCase().trim();
      const stat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      const rem = (h.remark || '').toLowerCase().trim();
      const cfor = (h.calledFor || '').toLowerCase().trim();

      if (purp === 'sales' || (!purp && !stat.includes('query'))) {
        if (UNCONNECTED_CALL_STATUSES.some(u => u.toLowerCase() === stat)) {
          salesAttempts++;
        }
        if (["info given", "interested", "next time", "reg.done", "not interested"].some(s => stat.includes(s))) {
          connectedSalesOutcome = stat;
        }
      }

      if (purp === 'query' || stat.includes('query') || rem.includes('query') || cfor.includes('query') || rem.includes('doubt') || rem.includes('fees') || rem.includes('timing')) {
        queryCalls++;
      }
    });

    const engineStage = getEffectiveStage(c);
    stageCounts[engineStage] = (stageCounts[engineStage] || 0) + 1;

    // Audit suspicious / test records
    if (suspiciousPattern.test(name) || suspiciousPattern.test(c.remark || '') || (hist.length > 0 && hist.some(h => suspiciousPattern.test(h.remark || '')))) {
      testGarbageTable.push({
        contactId: cid,
        name: name || '(blank)',
        phone: c.phone || c.Phone || '(blank)',
        attender: attenderName,
        historyCount: hist.length,
        status: c.status || '(blank)',
        remark: c.remark || (hist[0] && hist[0].remark) || '',
        engineStage,
        verdict: engineStage === PIPELINE_STAGES.CLOSED_INVALID ? 'Closed / Invalid (Test/Garbage)' : engineStage === LEGACY_DISPLAY_STAGES.QUERY_DESK ? 'Query Desk' : engineStage
      });
    }

    // New Lead Forensic Table
    if (engineStage === PIPELINE_STAGES.NEW_LEAD || engineStage === LEGACY_DISPLAY_STAGES.QUERY_DESK) {
      newLeadForensicTable.push({
        contactId: cid,
        name: name || '(blank)',
        attender: attenderName,
        historyCount: hist.length,
        salesAttempts,
        queryCalls,
        connectedSales: connectedSalesOutcome || '(none)',
        engineStage,
        evidenceBasedStage: queryCalls > 0 && salesAttempts === 0 && !connectedSalesOutcome ? LEGACY_DISPLAY_STAGES.QUERY_DESK : salesAttempts > 0 ? PIPELINE_STAGES.ATTEMPTING : PIPELINE_STAGES.NEW_LEAD,
        reason: queryCalls > 0 ? 'Query evidence found' : hist.length === 0 ? 'Pure uncontacted lead' : 'No sales attempt'
      });
    }

    // Registered / Won Table
    if (engineStage === PIPELINE_STAGES.REGISTERED_WON) {
      const regDocs = regDocMap.get(cid) || [];
      const hasRegHistory = hist.some(h => (h.status || h.purposeOutcome || '').toLowerCase().includes('reg'));
      registeredPeopleTable.push({
        contactId: cid,
        name: name || '(blank)',
        regRecordExists: regDocs.length > 0 ? 'YES' : 'NO',
        regId: regDocs.map(r => String(r._id || r.id)).join(', ') || '(none)',
        program: regDocs.map(r => r.programName || r.calledFor).join(', ') || c['Called For'] || '(unspecified)',
        regDoneHistory: hasRegHistory ? 'YES' : 'NO',
        currentStatus: c.status || '(blank)',
        verdict: regDocs.length > 0 ? 'Confirmed Structured Registration' : hasRegHistory ? 'Confirmed Historical Reg.Done' : 'Questionable'
      });
    }
  });

  console.log('====================================================');
  console.log('PART 1: PIPELINE STAGE STAGE SUMMARY');
  console.log('====================================================');
  console.table(stageCounts);

  console.log('\n====================================================');
  console.log('PART 3: AUDIT OF SUSPICIOUS / TEST / GARBAGE RECORDS');
  console.log('====================================================');
  console.log(`Found ${testGarbageTable.length} suspicious/test records:`);
  console.table(testGarbageTable.slice(0, 20)); // Show sample

  console.log('\n====================================================');
  console.log('PART 4 & 5: REGISTERED PEOPLE RECONCILIATION');
  console.log('====================================================');
  const structuredRegs = registeredPeopleTable.filter(r => r.regRecordExists === 'YES');
  const historicalOnlyRegs = registeredPeopleTable.filter(r => r.regRecordExists === 'NO');

  console.log(`- Total Registered/Won Contacts: ${registeredPeopleTable.length}`);
  console.log(`- Confirmed Structured Registrations (with registration document): ${structuredRegs.length}`);
  console.log(`- Confirmed Historical Reg.Done (without registration document): ${historicalOnlyRegs.length}`);

  console.log('\nExamine the 15 Historical-Only Reg.Done Contacts:');
  console.table(historicalOnlyRegs);

  // PART 6: CALL PURPOSE AUDIT
  let totalCalls = 0;
  let salesCalls = 0;
  let queryCallsCount = 0;
  let reminderCallsCount = 0;
  let unknownCallsCount = 0;

  contacts.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    totalCalls += hist.length;
    hist.forEach(h => {
      const purp = (h.callPurpose || '').toUpperCase();
      const stat = (h.status || h.purposeOutcome || '').toLowerCase();
      const rem = (h.remark || '').toLowerCase();
      const cfor = (h.calledFor || '').toLowerCase();

      if (purp === 'SALES') salesCalls++;
      else if (purp === 'QUERY') queryCallsCount++;
      else if (purp === 'REMINDER') reminderCallsCount++;
      else if (purp === 'UNKNOWN' || (!purp && !stat)) unknownCallsCount++;
      else {
        // Classify based on evidence
        if (stat.includes('query') || rem.includes('query') || cfor.includes('query')) queryCallsCount++;
        else if (stat.includes('reminder') || rem.includes('reminder') || stat.includes('link send') || rem.includes('link')) reminderCallsCount++;
        else if (stat.includes('mistake') || rem.includes('mistake') || stat.includes('test')) unknownCallsCount++;
        else salesCalls++;
      }
    });
  });

  console.log('\n====================================================');
  console.log('PART 6: CALL PURPOSE RECONCILIATION');
  console.log('====================================================');
  console.log(`- Total History Events: ${totalCalls}`);
  console.log(`  * Sales Calls: ${salesCalls}`);
  console.log(`  * Query Calls: ${queryCallsCount}`);
  console.log(`  * Reminder Calls: ${reminderCallsCount}`);
  console.log(`  * Unknown Calls: ${unknownCallsCount}`);
  console.log(`  * Total Check: ${salesCalls + queryCallsCount + reminderCallsCount + unknownCallsCount} (Matches 2,094: ${salesCalls + queryCallsCount + reminderCallsCount + unknownCallsCount === 2094})`);

  await client.close();
}

runMasterAudit().catch(console.error);
