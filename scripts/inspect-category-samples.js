// scripts/inspect-category-samples.js
import fs from 'fs';
import path from 'path';

const reviewPath = path.join(process.cwd(), 'proposed_209_stage_changes_review.json');
const data = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));

const attemptingToInvalid = data.filter(c => c.currentPipelineStage === '2. Attempting Contact' && c.proposedPipelineStage === 'Closed / Invalid');
const attemptingToQuery = data.filter(c => c.currentPipelineStage === '2. Attempting Contact' && c.proposedPipelineStage === 'Query Desk');
const futureToAttempting = data.filter(c => c.currentPipelineStage === '5. Future Pool' && c.proposedPipelineStage === '2. Attempting Contact');

console.log('--- SAMPLE 1: Attempting Contact ➔ Closed / Invalid (First 5 of 61) ---');
console.table(attemptingToInvalid.slice(0, 5).map(c => ({
  contactId: c.contactId,
  name: c.name,
  attender: c.attender,
  historyCount: c.historyCount,
  lastCallStatus: c.lastCallStatus,
  recentRemarksSummary: c.recentRemarksSummary
})));

console.log('\n--- SAMPLE 2: Attempting Contact ➔ Query Desk (First 5 of 24) ---');
console.table(attemptingToQuery.slice(0, 5).map(c => ({
  contactId: c.contactId,
  name: c.name,
  attender: c.attender,
  historyCount: c.historyCount,
  lastCallStatus: c.lastCallStatus,
  recentRemarksSummary: c.recentRemarksSummary
})));

console.log('\n--- SAMPLE 3: Future Pool ➔ Attempting Contact (First 5 of 13) ---');
console.table(futureToAttempting.slice(0, 5).map(c => ({
  contactId: c.contactId,
  name: c.name,
  attender: c.attender,
  historyCount: c.historyCount,
  lastCallStatus: c.lastCallStatus,
  recentRemarksSummary: c.recentRemarksSummary
})));
