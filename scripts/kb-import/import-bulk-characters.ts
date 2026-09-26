import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR } from '../kb-lib';
import { allNames } from './bulk-lib';
import { buildAuto, gcsimDirs, type Donor } from './bulk-character';
import { extractFrames } from './gcsim-frames';
import { db, kebab, weaponTypeOf } from './lib';

/**
 * Baseline import of every genshin-db character that has no hand-written spec.
 *   tsx scripts/kb-import/import-bulk-characters.ts [name...]   (no names: all)
 * Hand-written specs (scripts/kb-import/specs/<id>.ts) are never overwritten.
 */
const HAND = new Set(['xiangling', 'bennett', 'xingqiu', 'raiden-shogun', 'hu-tao', 'yelan', 'zhongli']);
const SKIP = /^(Aether|Lumine|Manekin|Manekina)$/;
const dirs = gcsimDirs();
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

const names = process.argv.slice(2).length ? process.argv.slice(2) : allNames('characters');
const dirOf = (name: string) => {
  const n = squash(name);
  return dirs.get(n) ?? [...dirs.entries()].find(([k]) => n.endsWith(k) || k.endsWith(n))?.[1];
};

// Donors per weapon type, component by component (the first character whose gcsim source parsed for it)
const donors: Record<string, Donor | undefined> = {};
for (const name of allNames('characters')) {
  const d = dirOf(name);
  if (!d || SKIP.test(name)) continue;
  let wt: string;
  try { wt = weaponTypeOf(db.characters(name).weaponText); } catch { continue; }
  const f = extractFrames(d);
  const cur = (donors[wt] ??= { frames: { notes: [] }, ids: {}, id: d });
  if (!cur.frames.normal && f.normal) { cur.frames.normal = f.normal; cur.ids.normal = d; }
  if (!cur.frames.charged && f.charged) { cur.frames.charged = f.charged; cur.ids.charged = d; }
  if (!cur.frames.skill && f.skill?.hitmark !== undefined) { cur.frames.skill = f.skill; cur.ids.skill = d; }
  if (!cur.frames.burst && f.burst?.hitmark !== undefined) { cur.frames.burst = f.burst; cur.ids.burst = d; }
}
console.log('donors:', JSON.stringify(Object.fromEntries(Object.entries(donors).map(([k, v]) => [k, v?.ids]))));

mkdirSync(join(KB_DIR, 'characters'), { recursive: true });
const summary: Record<string, number> = { high: 0, medium: 0, low: 0 };
const failed: string[] = [];
for (const name of names) {
  if (HAND.has(kebab(name)) || SKIP.test(name)) continue;
  try {
    const { record, notes } = buildAuto(name, dirOf(name), donors);
    writeFileSync(join(KB_DIR, 'characters', `${record.id}.json`), JSON.stringify(record, null, 2) + '\n');
    summary[record.dataConfidence]!++;
    console.log(notes[0]);
  } catch (e) {
    failed.push(`${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
  }
}
console.log('\nsummary', summary, 'failed', failed.length);
for (const f of failed) console.log('  FAILED', f);
