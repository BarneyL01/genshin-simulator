import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR } from '../kb-lib';
import { specs } from './specs/weapons';
import { buildWeapon } from './weapon-lib';

/** Usage: tsx scripts/kb-import/import-weapon.ts <id>... | --all */
const arg = process.argv.slice(2);
const ids = arg.includes('--all') ? specs.map((s) => s.id) : arg;
if (ids.length === 0) {
  console.error('usage: import-weapon.ts <id>... | --all');
  process.exit(2);
}
mkdirSync(join(KB_DIR, 'weapons'), { recursive: true });
for (const id of ids) {
  const spec = specs.find((s) => s.id === id);
  if (!spec) throw new Error(`no weapon spec "${id}"`);
  const rec = buildWeapon(spec);
  writeFileSync(join(KB_DIR, 'weapons', `${id}.json`), JSON.stringify(rec, null, 2) + '\n');
  console.log(`${id}: ${rec.rarity}★ ${rec.type} ATK ${rec.baseAtk.lv90.toFixed(1)} ${rec.substat.stat} ${rec.substat.lv90}`);
}
