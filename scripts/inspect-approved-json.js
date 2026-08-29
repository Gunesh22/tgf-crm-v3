// scripts/inspect-approved-json.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, '..', 'high_confidence_pipeline_mapping.json');

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log('Mapping Version:', data.mappingVersion);
console.log('Rules:', data.rules);
console.log('Total contacts in mapping JSON:', data.contacts.length);

let totalRelationships = 0;
const stageCounts = {};
const attenderCounts = {};
const programCounts = {};

for (const c of data.contacts) {
  const owner = c.leadOwner || 'Unassigned';
  attenderCounts[owner] = (attenderCounts[owner] || 0) + 1;

  for (const pr of c.programRelationships || []) {
    totalRelationships++;
    stageCounts[pr.stage] = (stageCounts[pr.stage] || 0) + 1;
    programCounts[pr.program] = (programCounts[pr.program] || 0) + 1;
  }
}

console.log('\nTotal Program Relationships:', totalRelationships);
console.log('\nStage Counts:');
console.table(stageCounts);

console.log('\nAttender (Name in JSON) Counts:');
console.table(attenderCounts);

console.log('\nTop 15 Program Counts:');
const sortedPrograms = Object.entries(programCounts).sort((a,b) => b[1] - a[1]).slice(0, 15);
console.table(Object.fromEntries(sortedPrograms));
