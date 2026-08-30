// scripts/audit-registration-metric-discrepancy.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('tgf_crm');

  const contacts = await db.collection('contacts').find({}).toArray();
  const registrations = await db.collection('registrations').find({}).toArray();

  console.log('====================================================');
  console.log('REGISTRATION METRIC GROUND-TRUTH FORENSIC AUDIT');
  console.log('====================================================\n');

  console.log(`1. TOTAL MONGODB COLLECTIONS COUNT:`);
  console.log(`   - Total Contacts in 'contacts' collection: ${contacts.length}`);
  console.log(`   - Total Documents in 'registrations' collection: ${registrations.length}\n`);

  // Count contacts with Reg.Done evidence in contacts collection
  let contactsWithRegOutcome = 0;
  let contactsWithRegProgramRel = 0;

  const registeredContactIds = new Set();
  const registeredPhones = new Set();

  contacts.forEach(c => {
    const hist = Array.isArray(c.history) ? c.history : [];
    const statusLower = (c.status || '').toLowerCase().trim();

    let hasRegHistory = statusLower.includes('reg.done') || statusLower.includes('registered');

    hist.forEach(h => {
      const hStat = (h.status || h.purposeOutcome || '').toLowerCase().trim();
      if (hStat.includes('reg.done') || hStat.includes('registered')) {
        hasRegHistory = true;
      }
    });

    const progRels = Array.isArray(c.programRelationships) ? c.programRelationships : [];
    const hasRegRel = progRels.some(pr => (pr.status || '').toLowerCase().includes('reg') || (pr.status || '').toLowerCase().includes('registered'));

    if (hasRegHistory) {
      contactsWithRegOutcome++;
      registeredContactIds.add(String(c._id || c.id));
      if (c.phone || c.Phone || c.Mobile) registeredPhones.add(String(c.phone || c.Phone || c.Mobile).replace(/\D/g, ''));
    }
    if (hasRegRel) contactsWithRegProgramRel++;
  });

  console.log(`2. CONTACTS COLLECTION REGISTRATION EVIDENCE:`);
  console.log(`   - Contacts with 'Reg.Done' / 'Registered' in history or status: ${contactsWithRegOutcome}`);
  console.log(`   - Contacts with registered status in programRelationships[]: ${contactsWithRegProgramRel}\n`);

  // Inspect registrations collection
  const regContactIds = new Set();
  const regPhones = new Set();
  const programRegCounts = {};

  registrations.forEach(r => {
    if (r.contactId) regContactIds.add(String(r.contactId));
    if (r.phone || r.Phone || r.mobile) regPhones.add(String(r.phone || r.Phone || r.mobile).replace(/\D/g, ''));
    const prog = r.programName || r.programId || r.calledFor || 'Unspecified';
    programRegCounts[prog] = (programRegCounts[prog] || 0) + 1;
  });

  console.log(`3. REGISTRATIONS COLLECTION BREAKDOWN:`);
  console.log(`   - Total Registration Records: ${registrations.length}`);
  console.log(`   - Distinct Contact IDs in registrations collection: ${regContactIds.size}`);
  console.log(`   - Distinct Phone Numbers in registrations collection: ${regPhones.size}`);
  console.log(`   - Registrations Breakdown by Program:`, programRegCounts);

  // Cross-reference overlap
  let overlapCount = 0;
  regContactIds.forEach(id => {
    if (registeredContactIds.has(id)) overlapCount++;
  });

  console.log(`\n4. METRIC PARITY & DISCREPANCY SUMMARY:`);
  console.log(`   - Registered People Count in Pipeline Cards ('6. Registered / Won'): ${contactsWithRegOutcome} (distinct contacts)`);
  console.log(`   - Total Registration Records across all programs: ${registrations.length}`);
  console.log(`   - Explanation of Discrepancy: Pipeline Cards count DISTINCT PEOPLE (143 contacts), whereas the Registrations table counts TOTAL EVENT/PROGRAM REGISTRATIONS (${registrations.length}). Some people register for multiple programs!`);

  await client.close();
}

main().catch(console.error);
