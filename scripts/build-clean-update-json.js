// scripts/build-clean-update-json.js
import fs from 'fs';
import path from 'path';

const mappingPath = path.join(process.cwd(), 'high_confidence_pipeline_mapping.json');
const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

const STAGE_MAP = {
  'Nurture / Interested': '4. Nurture / Interested',
  'Interested': '4. Nurture / Interested',
  'Information Given': '3. Information Given',
  'Info Given': '3. Information Given',
  'Registered / Won': '6. Registered / Won',
  'Reg.Done': '6. Registered / Won',
  'Registered': '6. Registered / Won',
  'Future Pool': '5. Future Pool',
  'Next Time': '5. Future Pool',
  'Not Interested': 'Closed / Lost',
  'Closed / Lost': 'Closed / Lost',
  'Invalid': 'Closed / Invalid',
  'Closed / Invalid': 'Closed / Invalid',
  'Attempting Contact': '2. Attempting Contact',
  'Attempting': '2. Attempting Contact',
  'New Lead': '1. New Lead',
  '1. New Lead': '1. New Lead',
  'Query Desk': 'Query Desk'
};

const cleanArray = [];

data.contacts.forEach(c => {
  const rawStage = c.programRelationships && c.programRelationships[0] ? c.programRelationships[0].stage : null;
  const canonicalStage = STAGE_MAP[rawStage] || rawStage || '1. New Lead';
  cleanArray.push({
    contactId: c.contactId,
    pipelineStage: canonicalStage
  });
});

const outputPath = path.join(process.cwd(), 'clean-mongodb-pipeline-update.json');
fs.writeFileSync(outputPath, JSON.stringify(cleanArray, null, 2), 'utf8');

console.log(`Generated ${cleanArray.length} clean update records in '${outputPath}'.`);
console.log('Sample (first 5):');
console.log(JSON.stringify(cleanArray.slice(0, 5), null, 2));
