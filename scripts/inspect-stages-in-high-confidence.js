// scripts/inspect-stages-in-high-confidence.js
import fs from 'fs';
import path from 'path';

const mappingPath = path.join(process.cwd(), 'high_confidence_pipeline_mapping.json');
const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

let multipleProgs = 0;
const simpleArray = [];

data.contacts.forEach(c => {
  if (c.programRelationships && c.programRelationships.length > 1) {
    multipleProgs++;
  }
  const primaryStage = c.programRelationships && c.programRelationships[0] ? c.programRelationships[0].stage : null;
  simpleArray.push({
    contactId: c.contactId,
    pipelineStage: primaryStage
  });
});

console.log('Total contacts:', data.contacts.length);
console.log('Contacts with >1 programRelationships:', multipleProgs);
console.log('Sample output (first 3):', JSON.stringify(simpleArray.slice(0, 3), null, 2));
