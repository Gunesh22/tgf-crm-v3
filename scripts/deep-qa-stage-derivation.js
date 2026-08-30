// scripts/deep-qa-stage-derivation.js
import { MongoClient } from 'mongodb';
import { getEffectiveStage, PIPELINE_STAGES } from '../src/utils/pipelineEngine.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  console.log('====================================================');
  console.log('DEEP QA AUDIT: 883 LEGACY CONTACT PIPELINE DERIVATION');
  console.log('====================================================\n');

  const groupWithStage = [];
  const groupWithoutStage = [];

  contacts.forEach(c => {
    if (c.pipelineStage && String(c.pipelineStage).trim() !== "" && c.pipelineStage !== "null" && c.pipelineStage !== "undefined") {
      groupWithStage.push(c);
    } else {
      groupWithoutStage.push(c);
    }
  });

  console.log(`Total Contacts: ${contacts.length}`);
  console.log(`- Contacts WITH explicit pipelineStage: ${groupWithStage.length}`);
  console.log(`- Contacts WITHOUT explicit pipelineStage (Legacy): ${groupWithoutStage.length}\n`);

  // Analyze the 883 legacy contacts in detail
  const derivedStageMap = new Map();

  groupWithoutStage.forEach(c => {
    const derivedStage = getEffectiveStage(c);
    if (!derivedStageMap.has(derivedStage)) {
      derivedStageMap.set(derivedStage, []);
    }
    derivedStageMap.get(derivedStage).push(c);
  });

  console.log('====================================================');
  console.log('1. DERIVED STAGE BREAKDOWN FOR THE 883 LEGACY CONTACTS');
  console.log('====================================================');

  for (const [stage, list] of derivedStageMap.entries()) {
    console.log(`\n--- STAGE: "${stage}" (${list.length} contacts) ---`);
    
    // Aggregate evidence for this derived group
    const statusCounts = new Map();
    let hasHistoryCount = 0;
    let noHistoryCount = 0;
    const historyOutcomes = new Map();

    list.forEach(c => {
      const st = c.status || '(blank status)';
      statusCounts.set(st, (statusCounts.get(st) || 0) + 1);

      if (Array.isArray(c.history) && c.history.length > 0) {
        hasHistoryCount++;
        c.history.forEach(h => {
          const out = (h.status || h.purposeOutcome || '').trim() || '(blank history status)';
          historyOutcomes.set(out, (historyOutcomes.get(out) || 0) + 1);
        });
      } else {
        noHistoryCount++;
      }
    });

    console.log(`   Contacts with call history entries: ${hasHistoryCount}`);
    console.log(`   Contacts without call history entries: ${noHistoryCount}`);
    console.log('   Top contact.status values:');
    const topStatuses = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    topStatuses.forEach(([st, cnt]) => console.log(`     - "${st}": ${cnt}`));

    if (historyOutcomes.size > 0) {
      console.log('   Top history entry status/outcomes:');
      const topHistory = Array.from(historyOutcomes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      topHistory.forEach(([out, cnt]) => console.log(`     - "${out}": ${cnt}`));
    }
  }

  // 2. DEEP QA ON THE 633 NEW LEADS
  const newLeadsGroup = derivedStageMap.get(PIPELINE_STAGES.NEW_LEAD) || [];
  console.log('\n====================================================');
  console.log(`2. DEEP QA ON THE ${newLeadsGroup.length} DERIVED "1. New Lead" CONTACTS`);
  console.log('====================================================');

  let uncontactedNoHistory = 0;
  let uncontactedDialsOnly = 0;
  let queryOnlyLeads = 0;
  let otherLeads = 0;

  newLeadsGroup.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    if (hist.length === 0 && (!c.status || c.status.trim() === "")) {
      uncontactedNoHistory++;
    } else {
      let salesConnected = false;
      hist.forEach(h => {
        const purp = (h.callPurpose || '').toUpperCase();
        if (!purp || purp === 'SALES') {
          const st = (h.status || '').toLowerCase();
          if (['info given', 'interested', 'reg.done', 'next time', 'registered', 'not interested'].includes(st)) {
            salesConnected = true;
          }
        }
      });

      if (!salesConnected) {
        uncontactedDialsOnly++;
      } else {
        otherLeads++;
      }
    }
  });

  console.log(`- Fresh Uncontacted Leads (No history, blank status): ${uncontactedNoHistory}`);
  console.log(`- Unconnected Dial Attempts / Unanswered Dials (e.g. no answer, Busy, Call Cut, Not Attended): ${uncontactedDialsOnly}`);
  console.log(`- Total Legitimate New Leads: ${uncontactedNoHistory + uncontactedDialsOnly} / ${newLeadsGroup.length} (${(((uncontactedNoHistory + uncontactedDialsOnly)/newLeadsGroup.length)*100).toFixed(1)}%)`);

  await client.close();
}

main().catch(console.error);
