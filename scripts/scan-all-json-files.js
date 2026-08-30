// scripts/scan-all-json-files.js
import fs from 'fs';
import path from 'path';

function checkJson(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(data)) {
      console.log(`[Array] ${path.basename(filePath)}: Length = ${data.length}`);
      if (data.length > 0) {
        console.log(`   Sample keys:`, Object.keys(data[0]));
      }
    } else if (typeof data === 'object' && data !== null) {
      console.log(`[Object] ${path.basename(filePath)}: Keys = ${Object.keys(data).join(', ')}`);
      if (data.contacts) {
        const count = Array.isArray(data.contacts) ? data.contacts.length : Object.keys(data.contacts).length;
        console.log(`   data.contacts count = ${count}`);
      }
    }
  } catch (e) {
    console.log(`[Error reading] ${path.basename(filePath)}: ${e.message}`);
  }
}

console.log('--- ROOT JSON FILES ---');
['high_confidence_pipeline_mapping.json', 'legacy-pipeline-stage-mapping.json', 'clean-mongodb-pipeline-update.json', 'itemized_190_unknown_review.json'].forEach(f => {
  const p = path.join(process.cwd(), f);
  if (fs.existsSync(p)) checkJson(p);
});

console.log('\n--- SCRATCH JSON FILES ---');
const scratchDir = path.join(process.cwd(), 'scratch');
if (fs.existsSync(scratchDir)) {
  fs.readdirSync(scratchDir).filter(f => f.endsWith('.json')).forEach(f => {
    checkJson(path.join(scratchDir, f));
  });
}
