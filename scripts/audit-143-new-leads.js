// scripts/audit-143-new-leads.js
import { MongoClient } from 'mongodb';
import { PIPELINE_STAGES, getEffectiveStage, UNCONNECTED_CALL_STATUSES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();

  const newLeads = contacts.filter(c => getEffectiveStage(c) === PIPELINE_STAGES.NEW_LEAD);

  console.log('====================================================');
  console.log(`FORENSIC AUDIT OF THE ${newLeads.length} NEW LEAD CONTACTS`);
  console.log('====================================================\n');

  const categories = {
    GENUINE_NEW_LEAD: [],     // 0 history, blank/uncalled, no query, no attender activity
    QUERY_ONLY: [],           // Has history with Query call purpose, status, or remark
    ATTEMPTING_CONTACT: [],   // Has unconnected dial attempts in history/status
    OTHER_EVIDENCE: []        // Has other sales/registration/nurture evidence
  };

  newLeads.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();
    const calledForLower = (c['Called For'] || c.calledFor || '').toLowerCase().trim();

    let hasQuery = calledForLower.includes('query') || statusLower.includes('query');
    let hasSalesAttempt = false;
    let hasConnectedSales = false;

    hist.forEach(h => {
      const hPurp = (h.callPurpose || h.purpose || '').toLowerCase().trim();
      const hStat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      const hRem = (h.remark || '').toLowerCase().trim();
      const hCalledFor = (h.calledFor || '').toLowerCase().trim();

      if (hPurp === 'query' || hStat.includes('query') || hRem.includes('query') || hCalledFor.includes('query') || hRem.includes('doubt') || hRem.includes('fees') || hRem.includes('timing')) {
        hasQuery = true;
      }

      if (hPurp === 'sales') {
        hasSalesAttempt = true;
        if (["info given", "interested", "next time", "reg.done", "not interested"].some(s => hStat.includes(s))) {
          hasConnectedSales = true;
        }
      }
    });

    if (hasConnectedSales) {
      categories.OTHER_EVIDENCE.push(c);
    } else if (hasQuery && !hasSalesAttempt) {
      categories.QUERY_ONLY.push(c);
    } else if (hasSalesAttempt) {
      categories.ATTEMPTING_CONTACT.push(c);
    } else {
      // Check if contact has attender assigned or any history entry at all
      if (hist.length > 0 || c.attenderId || c.attenderName || c.assignedName) {
        // Has history or assignment
        if (hasQuery) {
          categories.QUERY_ONLY.push(c);
        } else {
          categories.GENUINE_NEW_LEAD.push(c);
        }
      } else {
        categories.GENUINE_NEW_LEAD.push(c);
      }
    }
  });

  console.log(`Summary of 143 New Lead Contacts Breakdown:\n`);
  console.log(`1. Genuine New Leads (0 calls, uncalled): ${categories.GENUINE_NEW_LEAD.length}`);
  console.log(`2. Query-Only Contacts (Query history / calledFor): ${categories.QUERY_ONLY.length}`);
  console.log(`3. Unconnected Sales Dial Attempts: ${categories.ATTEMPTING_CONTACT.length}`);
  console.log(`4. Other Evidence Contacts: ${categories.OTHER_EVIDENCE.length}\n`);

  console.log('====================================================');
  console.log('QUERY-ONLY CONTACTS LIST (EVIDENCE INSPECTION)');
  console.log('====================================================\n');

  categories.QUERY_ONLY.forEach((c, idx) => {
    const hist = Array.isArray(c.history) ? c.history : [];
    console.log(`[${idx + 1}] ID: ${c._id || c.id} | Name: ${c.name || c.Name || 'Unnamed'} | Phone: ${c.phone || c.Phone}`);
    console.log(`    Attender: ${c.attenderName || c.assignedName || 'Unassigned'} (ID: ${c.attenderId || 'none'})`);
    console.log(`    Called For: "${c['Called For'] || c.calledFor || ''}" | Status: "${c.status || ''}"`);
    console.log(`    Total History Entries: ${hist.length}`);
    hist.forEach((h, hIdx) => {
      console.log(`      - History [${hIdx+1}]: purpose=${h.callPurpose || 'SALES'}, status="${h.status || ''}", calledFor="${h.calledFor || ''}", attender="${h.attenderName || ''}", remark="${h.remark || ''}"`);
    });
    console.log('---');
  });

  await client.close();
}

main().catch(console.error);
