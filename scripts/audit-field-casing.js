// scripts/audit-field-casing.js
/**
 * Read-Only Audit Script for Contact Field Casing & Legacy Aliases
 * 
 * Inspects contacts collection in MongoDB in strictly READ-ONLY mode.
 * Identifies documents containing legacy alias keys (e.g., "Called For", "sourse", "city")
 * and reports statistics without performing ANY database modifications.
 * 
 * Usage:
 *   node --env-file=.env scripts/audit-field-casing.js
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

async function runAudit() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB in READ-ONLY mode...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  try {
    const db = client.db('tgf_crm');
    const contactsColl = db.collection('contacts');

    const totalContacts = await contactsColl.countDocuments({});
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(` FIELD CASING AUDIT REPORT (READ-ONLY)`);
    console.log(` Total Contacts in Database: ${totalContacts}`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    // Check occurrences of canonical vs legacy keys
    const [
      hasCityPascal,
      hasCityLower,
      hasStatePascal,
      hasStateLower,
      hasCalledForCamel,
      hasCalledForTitle,
      hasCalledForSnake,
      hasSourceLower,
      hasSourcePascal,
      hasSourceMisspelled,
      hasLeadOriginCamel,
      hasLeadOriginSnake
    ] = await Promise.all([
      contactsColl.countDocuments({ City: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ city: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ State: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ state: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ calledFor: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ 'Called For': { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ called_for: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ source: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ Source: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ sourse: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ leadOrigin: { $exists: true, $ne: '' } }),
      contactsColl.countDocuments({ original_source: { $exists: true, $ne: '' } })
    ]);

    console.log('--- CITY & STATE ---');
    console.log(`  Canonical "City" (PascalCase):       ${hasCityPascal}`);
    console.log(`  Legacy "city" (lowercase):           ${hasCityLower}`);
    console.log(`  Canonical "State" (PascalCase):      ${hasStatePascal}`);
    console.log(`  Legacy "state" (lowercase):          ${hasStateLower}`);

    console.log('\n--- PROGRAM / CALLED FOR ---');
    console.log(`  Canonical "calledFor" (camelCase):   ${hasCalledForCamel}`);
    console.log(`  Legacy "Called For" (Title Case):    ${hasCalledForTitle}`);
    console.log(`  Legacy "called_for" (snake_case):    ${hasCalledForSnake}`);

    console.log('\n--- SOURCE / LEAD ORIGIN ---');
    console.log(`  Canonical "source" (lowercase):      ${hasSourceLower}`);
    console.log(`  Legacy "Source" (PascalCase):        ${hasSourcePascal}`);
    console.log(`  Misspelled "sourse":                 ${hasSourceMisspelled}`);
    console.log(`  Canonical "leadOrigin" (camelCase):  ${hasLeadOriginCamel}`);
    console.log(`  Legacy "original_source" (snake):    ${hasLeadOriginSnake}`);

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(` ✅ Audit completed safely. ZERO database modifications performed.`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
  } finally {
    await client.close();
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
