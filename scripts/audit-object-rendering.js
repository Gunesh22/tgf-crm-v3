// scripts/audit-object-rendering.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allSrcFiles = getAllFiles(srcDir);
console.log(`Scanning ${allSrcFiles.length} source files for object rendering patterns...\n`);

const issues = [];

for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(srcDir, file);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for direct String(item[column]) or rendering objects in JSX
    if (line.includes('String(item[col') || line.includes('String(log[col') || line.includes('String(item[matchingKey])')) {
      issues.push({
        file: relPath,
        line: idx + 1,
        code: line.trim(),
        reason: 'Unsafely coerces dynamic fields/objects to string via String(...) without object guard, leading to [object Object].'
      });
    }
    if (line.includes('JSON.stringify') && line.includes('object Object')) {
      issues.push({
        file: relPath,
        line: idx + 1,
        code: line.trim(),
        reason: 'Literal [object Object] found in file.'
      });
    }
  });
}

console.log(`Found ${issues.length} potential user-facing rendering issues:\n`);
console.table(issues);
