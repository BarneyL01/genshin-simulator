import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR } from '../kb-lib';
import { buildCharacter, type CharacterSpec } from './lib';

/** Usage: tsx scripts/kb-import/import-character.ts <id> [<id>...] — writes kb/characters/<id>.json from specs/<id>.ts */
const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage: import-character.ts <id>...');
  process.exit(2);
}
mkdirSync(join(KB_DIR, 'characters'), { recursive: true });
for (const id of ids) {
  const spec = (await import(`./specs/${id}.ts`)).spec as CharacterSpec;
  const { record, report } = buildCharacter(spec);
  writeFileSync(join(KB_DIR, 'characters', `${id}.json`), JSON.stringify(record, null, 2) + '\n');
  for (const r of report) console.log(r);
  for (const c of record.provenance.conflicts) console.log(`  conflict: ${c.field} — ${c.note}`);
}
