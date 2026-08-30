// scripts/deep-audit-93-new-leads.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, LEGACY_DISPLAY_STAGES, UNCONNECTED_CALL_STATUSES, INVALID_NUMBER_STATUSES, getEffectiveStage } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  const regMap = new Map();
  registrations.forEach(r => {
    if (r.contactId) regMap.set(String(r.contactId), r);
    if (r.phone || r.Phone || r.mobile) {
      const p = String(r.phone || r.Phone || r.mobile).replace(/\D/g, '');
      if (p) regMap.set(p, r);
    }
  });

  const currentNewLeads = contacts.filter(c => getEffectiveStage(c) === PIPELINE_STAGES.NEW_LEAD);

  console.log('====================================================');
  console.log(`DEEP FORENSIC AUDIT OF ALL ${currentNewLeads.length} CURRENT NEW LEAD CONTACTS`);
  console.log('====================================================\n');

  const auditResults = [];

  currentNewLeads.forEach((c, idx) => {
    const cid = String(c._id || c.id);
    const phoneClean = (c.phone || c.Phone || c.Mobile || '').replace(/\D/g, '');
    const name = c.name || c.Name || 'Unnamed';
    const attender = c.attenderName || c.assignedName || 'Unassigned';
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();
    const progRels = Array.isArray(c.programRelationships) ? c.programRelationships : [];
    const regRecord = regMap.get(cid) || (phoneClean ? regMap.get(phoneClean) : null);

    let salesAttempts = 0;
    let queryCalls = 0;
    let reminderCalls = 0;
    let connectedSalesOutcome = null;
    let invalidEvidence = false;
    let regDoneEvidence = false;

    if (statusLower.includes('reg.done') || statusLower.includes('registered') || regRecord) {
      regDoneEvidence = true;
    }
    if (statusLower.includes('invalid') || statusLower.includes('wrong no')) {
      invalidEvidence = true;
    }
    if (statusLower.includes('info given') || statusLower.includes('information given')) {
      connectedSalesOutcome = PIPELINE_STAGES.INFO_GIVEN;
    } else if (statusLower.includes('interested') && !statusLower.includes('not interested')) {
      connectedSalesOutcome = PIPELINE_STAGES.NURTURE_INTERESTED;
    } else if (statusLower.includes('next time')) {
      connectedSalesOutcome = PIPELINE_STAGES.FUTURE_POOL;
    } else if (statusLower.includes('not interested') || statusLower.includes('not possible')) {
      connectedSalesOutcome = PIPELINE_STAGES.CLOSED_LOST;
    }

    const historySummary = [];

    hist.forEach((h, hIdx) => {
      const purp = (h.callPurpose || h.purpose || '').toLowerCase().trim();
      const stat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      const rem = (h.remark || '').toLowerCase().trim();
      const cfor = (h.calledFor || '').toLowerCase().trim();

      historySummary.push(`[${hIdx+1}] ${purp || 'sales'}:${stat || 'blank'} ("${rem}")`);

      if (INVALID_NUMBER_STATUSES.some(inv => inv.toLowerCase() === stat)) {
        invalidEvidence = true;
      }
      if (UNCONNECTED_CALL_STATUSES.some(unc => unc.toLowerCase() === stat)) {
        salesAttempts++;
      }
      if (["info given", "info"].includes(stat)) connectedSalesOutcome = PIPELINE_STAGES.INFO_GIVEN;
      else if (["interested"].includes(stat)) connectedSalesOutcome = PIPELINE_STAGES.NURTURE_INTERESTED;
      else if (["next time"].includes(stat)) connectedSalesOutcome = PIPELINE_STAGES.FUTURE_POOL;
      else if (["reg.done", "registered"].includes(stat)) regDoneEvidence = true;
      else if (["not interested", "not possible"].includes(stat)) connectedSalesOutcome = PIPELINE_STAGES.CLOSED_LOST;

      if (purp === 'query' || stat.includes('query') || rem.includes('query') || cfor.includes('query') || rem.includes('doubt') || rem.includes('fees') || rem.includes('timing')) {
        queryCalls++;
      }
      if (purp === 'reminder' || stat.includes('reminder') || rem.includes('reminder')) {
        reminderCalls++;
      }
    });

    let correctStage = PIPELINE_STAGES.NEW_LEAD;
    let reason = 'Pure uncontacted lead with 0 history';

    if (regDoneEvidence) {
      correctStage = PIPELINE_STAGES.REGISTERED_WON;
      reason = 'Confirmed registration evidence found';
    } else if (connectedSalesOutcome) {
      correctStage = connectedSalesOutcome;
      reason = `Connected sales outcome '${connectedSalesOutcome}' found`;
    } else if (invalidEvidence || salesAttempts >= 5) {
      correctStage = PIPELINE_STAGES.CLOSED_INVALID;
      reason = invalidEvidence ? 'Invalid/wrong number outcome' : '5+ unsuccessful sales attempts';
    } else if (salesAttempts >= 1) {
      correctStage = PIPELINE_STAGES.ATTEMPTING;
      reason = `${salesAttempts} unsuccessful sales attempt(s)`;
    } else if (queryCalls > 0) {
      correctStage = LEGACY_DISPLAY_STAGES.QUERY_DESK;
      reason = 'Query/Inquiry interaction found with 0 sales attempts';
    } else if (hist.length > 0) {
      // History exists but was not caught by above rules - inspect deep
      reason = `History exists (${hist.length} call events)`;
    }

    auditResults.push({
      index: idx + 1,
      contactId: cid,
      name,
      phone: c.phone || c.Phone || c.Mobile || '(blank)',
      attender,
      rawPipelineStage: c.pipelineStage || '(none)',
      currentStatus: c.status || '(blank)',
      historyCount: hist.length,
      salesAttempts,
      queryCalls,
      reminderCalls,
      keyHistory: historySummary.join(' | ') || '(no history)',
      currentEngineStage: PIPELINE_STAGES.NEW_LEAD,
      correctStage,
      reason
    });
  });

  console.log(`Audited all ${auditResults.length} contacts.\n`);

  const stageBreakdown = {};
  auditResults.forEach(r => {
    stageBreakdown[r.correctStage] = (stageBreakdown[r.correctStage] || 0) + 1;
  });

  console.log('Breakdown of Correct Stages for the 93 Current New Leads:');
  console.table(stageBreakdown);

  console.log('\nDetailed List of Non-New Lead Contacts among the 93:');
  const nonNewLeads = auditResults.filter(r => r.correctStage !== PIPELINE_STAGES.NEW_LEAD);
  console.table(nonNewLeads.map(r => ({
    '#': r.index,
    'ID': r.contactId,
    'Name': r.name,
    'Attender': r.attender,
    'Hist Count': r.historyCount,
    'Key History': r.keyHistory,
    'Correct Stage': r.correctStage,
    'Reason': r.reason
  })));

  await client.close();
}

main().catch(console.error);
