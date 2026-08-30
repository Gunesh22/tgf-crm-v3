// scripts/generate-all-93-forensic-table.js
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

  const fullTable = [];

  currentNewLeads.forEach((c, idx) => {
    const cid = String(c._id || c.id);
    const phoneClean = (c.phone || c.Phone || c.Mobile || '').replace(/\D/g, '');
    const name = c.name || c.Name || '(blank)';
    const attender = c.attenderName || c.assignedName || 'Unassigned';
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();
    const regRecord = regMap.get(cid) || (phoneClean ? regMap.get(phoneClean) : null);

    let correctStage = PIPELINE_STAGES.NEW_LEAD;
    let reason = 'Pure uncontacted lead with 0 history';

    const historyItems = [];

    let unconnectedCount = 0;
    let queryCount = 0;
    let infoGivenCount = 0;
    let interestedCount = 0;
    let regDoneCount = 0;

    hist.forEach((h, hIdx) => {
      const purp = (h.callPurpose || h.purpose || '').toLowerCase().trim();
      const stat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      const rem = (h.remark || '').toLowerCase().trim();
      const cfor = (h.calledFor || '').toLowerCase().trim();

      historyItems.push(`[Call ${hIdx+1}] ${stat || 'blank'} (${rem || 'no remark'})`);

      const text = `${stat} ${rem} ${cfor}`;

      if (text.includes('already reg') || text.includes('reg.done') || text.includes('registered') || statusLower.includes('reg')) {
        regDoneCount++;
      } else if (text.includes('info given') || text.includes('information given') || text.includes('info')) {
        infoGivenCount++;
      } else if (text.includes('interested') && !text.includes('not interested')) {
        interestedCount++;
      } else if (text.includes('query') || text.includes('doubt') || text.includes('link') || text.includes('bus') || text.includes('group')) {
        queryCount++;
      } else if (UNCONNECTED_CALL_STATUSES.some(u => text.includes(u.toLowerCase())) || text.includes('call not received') || text.includes('not connected') || text.includes('call log added')) {
        unconnectedCount++;
      }
    });

    if (regRecord || regDoneCount > 0 || statusLower.includes('reg')) {
      correctStage = PIPELINE_STAGES.REGISTERED_WON;
      reason = 'Registration evidence found (Reg.Done status / call / registration document)';
    } else if (interestedCount > 0) {
      correctStage = PIPELINE_STAGES.NURTURE_INTERESTED;
      reason = 'Connected sales outcome Interested';
    } else if (infoGivenCount > 0) {
      correctStage = PIPELINE_STAGES.INFO_GIVEN;
      reason = 'Connected sales outcome Info Given';
    } else if (unconnectedCount >= 5) {
      correctStage = PIPELINE_STAGES.CLOSED_INVALID;
      reason = '5+ unconnected call attempts / test logs';
    } else if (unconnectedCount >= 1) {
      correctStage = PIPELINE_STAGES.ATTEMPTING;
      reason = `${unconnectedCount} unconnected sales call attempt(s)`;
    } else if (queryCount > 0) {
      correctStage = LEGACY_DISPLAY_STAGES.QUERY_DESK;
      reason = 'Query/Inquiry activity with 0 sales attempts';
    }

    fullTable.push({
      index: idx + 1,
      contactId: cid,
      name,
      attender,
      historyCount: hist.length,
      keyHistory: historyItems.join('; ') || '(no history)',
      currentEngineStage: PIPELINE_STAGES.NEW_LEAD,
      correctStage,
      reason
    });
  });

  console.log(`JSON Data generated for all ${fullTable.length} New Leads.\n`);
  console.log(JSON.stringify(fullTable, null, 2));

  await client.close();
}

main().catch(console.error);
