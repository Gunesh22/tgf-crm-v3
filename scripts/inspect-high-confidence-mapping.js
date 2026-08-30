// scripts/inspect-high-confidence-mapping.js
import fs from 'fs';
import path from 'path';

const mappingPath = path.join(process.cwd(), 'high_confidence_pipeline_mapping.json');
if (fs.existsSync(mappingPath)) {
  const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  console.log('Version:', data.mappingVersion);
  console.log('Total contacts:', data.contacts ? data.contacts.length : 0);
  if (data.contacts && data.contacts.length > 0) {
    console.log('Sample contact 0:', JSON.stringify(data.contacts[0], null, 2));
  }
} else {
  console.log('File high_confidence_pipeline_mapping.json does not exist.');
}
