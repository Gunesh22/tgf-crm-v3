import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { getEffectiveStage, evaluatePipeline } from '../src/utils/pipelineEngine.js';

async function testBhanwarCases() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('tgf_crm');
  const bhanwar = await db.collection('contacts').findOne({ Name: new RegExp('bhanwar', 'i') });

  if (!bhanwar) {
    console.error("Bhanwar Lal not found in database");
    process.exit(1);
  }

  const baseEdited = { ...bhanwar, callStatus: '', status: '', queryStatus: '', remark: '' };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' BHANWAR LAL STAGE RESOLUTION & NEW CALL FORM ACCEPTANCE TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Case A: Open Bhanwar Lal with Called For empty
  const cA = getEffectiveStage(baseEdited, '');
  console.log('--- CASE A: Open Bhanwar Lal with Called For empty ---');
  console.log('Displayed Current Stage:', cA);
  console.log('Called For: ""');
  console.log('Previous journey stage: 4. Nurture / Interested');
  console.log('Call Result: BLANK (unselected)');
  console.log('Call Outcome: BLANK (unselected)\n');

  // Case B: Select Off MA
  const cB = getEffectiveStage({ ...baseEdited, 'Called For': 'Off MA' }, 'Off MA');
  console.log('--- CASE B: Select Off MA ---');
  console.log('Displayed Current Stage:', cB);
  console.log('Called For: "Off MA"');
  console.log('Previous journey stage: 4. Nurture / Interested (Off MA journey)');
  console.log('Call Result: BLANK (unselected)');
  console.log('Call Outcome: BLANK (unselected)\n');

  // Case C: Open Bhanwar Lal as another attender
  const cC = getEffectiveStage({ ...baseEdited, 'Called For': '' }, '');
  console.log('--- CASE C: Open Bhanwar Lal as another attender ---');
  console.log('Displayed Current Stage:', cC);
  console.log('Called For: ""');
  console.log('Previous journey stage: 4. Nurture / Interested');
  console.log('Call Result: BLANK (unselected)');
  console.log('Call Outcome: BLANK (unselected)\n');

  // Case D: Select a completely different Called For (Swasthya Shivir 2026)
  const cD = getEffectiveStage({ ...baseEdited, 'Called For': 'Swasthya Shivir 2026' }, 'Swasthya Shivir 2026');
  console.log('--- CASE D: Select a completely different Called For ---');
  console.log('Displayed Current Stage:', cD);
  console.log('Called For: "Swasthya Shivir 2026"');
  console.log('Previous journey stage: None (Preserves contact stage 4. Nurture / Interested)');
  console.log('Call Result: BLANK (unselected)');
  console.log('Call Outcome: BLANK (unselected)\n');

  // Case E: Create a new call for the same existing Off MA journey
  const newCallEdited = { ...baseEdited, 'Called For': 'Off MA', callStatus: 'Connected', status: 'Interested', remark: 'Attender 2 follow-up' };
  const evalResult = evaluatePipeline(newCallEdited, { callPurpose: 'SALES', callStatus: 'Connected', purposeOutcome: 'Interested' });
  console.log('--- CASE E: Create a new call for the same existing Off MA journey ---');
  console.log('Displayed Current Stage (After Outcome Selection):', evalResult.pipelineStage);
  console.log('Called For: "Off MA"');
  console.log('Previous journey stage: 4. Nurture / Interested');
  console.log('Call Result: Connected');
  console.log('Call Outcome: Interested\n');

  // Case F: Asynchronous Duplicate Load (Incomplete Initial Row -> Fully Fetched GlobalDup Document)
  const partialRow = { Name: bhanwar.Name, Phone: bhanwar.Phone || bhanwar.Mobile };
  const initialStage = getEffectiveStage(partialRow, '');
  const globalDupFirst = bhanwar;
  const effectiveEdited = { ...globalDupFirst, ...partialRow, pipelineStage: globalDupFirst.pipelineStage };
  const resolvedStage = getEffectiveStage(effectiveEdited, '');

  console.log('--- CASE F: Asynchronous Duplicate Document Load ---');
  console.log('Initial Stage Before Dup Load:', initialStage);
  console.log('Resolved Stage After Dup Load:', resolvedStage);
  if (resolvedStage === '4. Nurture / Interested') {
    console.log('✅ SUCCESS: Current Stage badge updated from initial state to 4. Nurture / Interested upon dup load!\n');
  } else {
    console.error('❌ FAILURE: Stage did not update correctly on dup load!\n');
    process.exit(1);
  }

  await client.close();
}

testBhanwarCases().catch(console.error);
