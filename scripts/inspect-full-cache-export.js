// scripts/inspect-full-cache-export.js
import fs from 'fs';
import path from 'path';

const fullCachePath = path.join(process.cwd(), 'scratch', 'tgf_call_center_cache_export_2026-08-23 (2).json');

if (fs.existsSync(fullCachePath)) {
  const data = JSON.parse(fs.readFileSync(fullCachePath, 'utf8'));
  console.log('Full Cache Export File Found!');
  console.log('Top level keys:', Object.keys(data));
  if (data.contacts) {
    const keys = Object.keys(data.contacts);
    console.log('Total keys under data.contacts:', keys.length);
    const baseIds = new Set();
    keys.forEach(k => {
      baseIds.add(k.includes('_') ? k.split('_')[0] : k);
    });
    console.log('Unique base IDs:', baseIds.size);
  }
} else {
  console.log('File not found at:', fullCachePath);
}
