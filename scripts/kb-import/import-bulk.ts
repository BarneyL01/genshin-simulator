import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR } from '../kb-lib';
import { kebab } from './lib';
import { allNames, autoArtifact, autoWeapon } from './bulk-lib';
import { specs as weaponSpecs } from './specs/weapons';
import { specs as artifactSpecs } from './specs/artifacts';

/**
 * Bulk baseline import for weapons and artifact sets (characters: import-bulk-characters.ts).
 * Existing hand-specified records (scripts/kb-import/specs) are never overwritten.
 *   tsx scripts/kb-import/import-bulk.ts weapons|artifacts
 */
const kind = process.argv[2];
const handMade = new Set([...weaponSpecs.map((s) => s.id), ...artifactSpecs.map((s) => s.id)]);
let n = 0;
const skipped: string[] = [];

if (kind === 'weapons' || kind === 'artifacts') {
  const dir = join(KB_DIR, kind);
  mkdirSync(dir, { recursive: true });
  for (const name of allNames(kind)) {
    const id = kebab(name);
    if (handMade.has(id)) continue;
    try {
      const rec = kind === 'weapons' ? autoWeapon(name) : autoArtifact(name);
      if (rec.id !== id && existsSync(join(dir, `${rec.id}.json`))) continue;
      writeFileSync(join(dir, `${rec.id}.json`), JSON.stringify(rec, null, 2) + '\n');
      n++;
    } catch (e) {
      skipped.push(`${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    }
  }
  console.log(`${kind}: wrote ${n}, skipped ${skipped.length}`);
  for (const s of skipped.slice(0, 15)) console.log('  skipped', s);
} else {
  console.error('usage: import-bulk.ts weapons|artifacts');
  process.exit(2);
}
