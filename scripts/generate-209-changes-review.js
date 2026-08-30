// scripts/generate-209-changes-review.js
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');
  const contactsCollection = db.collection('contacts');

  const jsonPath = path.join(process.cwd(), 'tgf_pipeline_stage_mapping_all_contacts.json');
  const mappingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const allDbContacts = await contactsCollection.find({}).toArray();
  const dbMap = new Map();
  allDbContacts.forEach(c => {
    dbMap.set(String(c._id || c.id), c);
  });

  const changesList = [];

  mappingData.forEach(item => {
    const cid = String(item.contactId);
    const proposedStage = item.pipelineStage;
    const dbDoc = dbMap.get(cid);

    if (dbDoc) {
      const currentStage = dbDoc.pipelineStage || '(blank/null)';
      if (currentStage !== proposedStage) {
        const hist = Array.isArray(dbDoc.history) ? dbDoc.history : [];
        const lastHistory = hist.length > 0 ? hist[hist.length - 1] : null;
        const recentRemarks = hist.map(h => `${h.status || ''}: ${h.remark || ''}`).filter(Boolean).slice(-3).join(' | ');

        changesList.push({
          contactId: cid,
          name: dbDoc.name || dbDoc.Name || '(blank)',
          phone: dbDoc.phone || dbDoc.Phone || dbDoc.Mobile || '',
          attender: dbDoc.attenderName || dbDoc.assignedName || dbDoc.leadOwner || 'Unassigned',
          currentPipelineStage: currentStage,
          proposedPipelineStage: proposedStage,
          transition: `${currentStage} ➔ ${proposedStage}`,
          historyCount: hist.length,
          lastCallStatus: lastHistory ? lastHistory.status : (dbDoc.status || ''),
          lastCallRemark: lastHistory ? lastHistory.remark : (dbDoc.remark || ''),
          recentRemarksSummary: recentRemarks || dbDoc.remark || 'No history remarks'
        });
      }
    }
  });

  console.log('====================================================');
  console.log(`PROPOSED CHANGES FORENSIC AUDIT — TOTAL: ${changesList.length}`);
  console.log('====================================================\n');

  // Categorize
  const attemptingToInvalid = changesList.filter(c => c.currentPipelineStage === '2. Attempting Contact' && c.proposedPipelineStage === 'Closed / Invalid');
  const attemptingToQuery = changesList.filter(c => c.currentPipelineStage === '2. Attempting Contact' && c.proposedPipelineStage === 'Query Desk');
  const futureToAttempting = changesList.filter(c => c.currentPipelineStage === '5. Future Pool' && c.proposedPipelineStage === '2. Attempting Contact');

  console.log(`1. Attempting Contact ➔ Closed / Invalid: ${attemptingToInvalid.length} (Expected: 61)`);
  console.log(`2. Attempting Contact ➔ Query Desk: ${attemptingToQuery.length} (Expected: 24)`);
  console.log(`3. Future Pool ➔ Attempting Contact: ${futureToAttempting.length} (Expected: 13)`);
  console.log(`4. Other Stage Transitions: ${changesList.length - attemptingToInvalid.length - attemptingToQuery.length - futureToAttempting.length}\n`);

  // Write itemized JSON
  const outJsonPath = path.join(process.cwd(), 'proposed_209_stage_changes_review.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(changesList, null, 2), 'utf8');
  console.log(`Itemized review JSON generated at: '${outJsonPath}' containing ${changesList.length} records.`);

  await client.close();
}

main().catch(console.error);
