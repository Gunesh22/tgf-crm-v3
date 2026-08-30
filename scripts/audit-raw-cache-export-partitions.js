// scripts/audit-raw-cache-export-partitions.js
import fs from 'fs';
import path from 'path';

const fullCachePath = path.join(process.cwd(), 'scratch', 'tgf_call_center_cache_export_2026-08-23 (2).json');
const data = JSON.parse(fs.readFileSync(fullCachePath, 'utf8'));

const partitions = Object.keys(data);
console.log('Partitions:', partitions);

const allExportedRecords = [];
const rawIdCounts = new Map();
const baseIdCounts = new Map();

partitions.forEach(partKey => {
  const partObj = data[partKey];
  if (typeof partObj === 'object' && partObj !== null) {
    Object.keys(partObj).forEach(rawKey => {
      const rec = partObj[rawKey];
      const baseId = rawKey.includes('_') ? rawKey.split('_')[0] : rawKey;
      allExportedRecords.push({
        partition: partKey,
        rawKey,
        baseId,
        attender: rec.attenderName || rec.assignedName || rec.leadOwner || 'Unknown',
        historyLength: Array.isArray(rec.history) ? rec.history.length : 0
      });

      rawIdCounts.set(rawKey, (rawIdCounts.get(rawKey) || 0) + 1);
      baseIdCounts.set(baseId, (baseIdCounts.get(baseId) || 0) + 1);
    });
  }
});

console.log(`\n--- RAW CACHE EXPORT STATS ---`);
console.log(`Total Exported Records Across Partitions: ${allExportedRecords.length}`);
console.log(`Unique Raw Keys: ${rawIdCounts.size}`);
console.log(`Unique Base Contact IDs: ${baseIdCounts.size}`);

const repeatedBaseIds = [...baseIdCounts.entries()].filter(([k, v]) => v > 1);
console.log(`Base Contact IDs appearing in >1 partitions/keys: ${repeatedBaseIds.length}`);

console.log('\nTop 5 Repeated Base IDs in Cache Export:');
repeatedBaseIds.slice(0, 5).forEach(([baseId, count]) => {
  const matches = allExportedRecords.filter(r => r.baseId === baseId);
  console.log(`\nBase ID: ${baseId} (Appears ${count} times):`);
  matches.forEach(m => {
    console.log(`  - Partition: ${m.partition} | Raw Key: ${m.rawKey} | Attender: ${m.attender} | History Length: ${m.historyLength}`);
  });
});
