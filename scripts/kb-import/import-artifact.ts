import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR } from '../kb-lib';
import { buildArtifact } from './artifact-lib';
import { specs } from './specs/artifacts';

/** Usage: tsx scripts/kb-import/import-artifact.ts <id>... | --all */
const arg = process.argv.slice(2);
const ids = arg.includes('--all') ? specs.map((s) => s.id) : arg;
if (ids.length === 0) {
  console.error('usage: import-artifact.ts <id>... | --all');
  process.exit(2);
}
mkdirSync(join(KB_DIR, 'artifacts'), { recursive: true });
for (const id of ids) {
  const spec = specs.find((s) => s.id === id);
  if (!spec) throw new Error(`no artifact spec "${id}"`);
  const { text, ...rec } = buildArtifact(spec);
  writeFileSync(join(KB_DIR, 'artifacts', `${id}.json`), JSON.stringify(rec, null, 2) + '\n');
  console.log(`${id}\n  2pc: ${text.two}\n  4pc: ${text.four}`);
}
