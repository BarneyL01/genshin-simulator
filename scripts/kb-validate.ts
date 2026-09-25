import { relative } from 'node:path';
import { KB_DIR, listRecords, readMeta } from './kb-lib';
import { validateRecords } from './validate-core';

const records = listRecords();
const { issues } = validateRecords(records);
try {
  readMeta();
} catch (e) {
  issues.push({ file: 'kb/meta.json', message: String(e) });
}

if (issues.length > 0) {
  for (const i of issues) console.error(`✗ ${relative(KB_DIR, i.file) || i.file}: ${i.message}`);
  console.error(`\nkb:validate failed: ${issues.length} issue(s) in ${records.length} record(s)`);
  process.exit(1);
}
console.log(`kb:validate ok — ${records.length} record(s)`);
