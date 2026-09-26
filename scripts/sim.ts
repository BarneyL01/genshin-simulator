import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR, listRecords } from './kb-lib';
import { validateRecords } from './validate-core';
import { EXECUTION_PROFILES, buildCharacterInput, simulateBoth, type StatMod, type RotationStep } from '../src/engine';
import '../src/engine/hooks';

/**
 * Dev tool: simulate a rotation from KB records.
 *   npm run sim -- --char xiangling:the-catch:1:emblem-of-severed-fate+2 --step xiangling.burst --step xiangling.skill ...
 * --char id:weapon:refinement[:set=count,...] [--mods "atk%=0.5,critRate=0.6"]  (artifact stats until KQMS lands)
 * --step char.action | --wait frames  --cycles N  --enemy-level 100 --enemy-res 0.1
 */
const argv = process.argv.slice(2);
const get = (k: string) => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]!] : []));
const { issues, parsed } = validateRecords(listRecords());
if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'));

const modsArg = get('mods');
const characters = get('char').map((spec, idx) => {
  const [id, weaponId, refine = '1', setSpec = ''] = spec.split(':');
  const c = parsed.characters.get(id!);
  const w = parsed.weapons.get(weaponId!);
  if (!c || !w) throw new Error(`unknown character/weapon in "${spec}"`);
  const mods: StatMod[] = (modsArg[idx] ?? '').split(',').filter(Boolean).map((m) => {
    const [stat, v] = m.split('=');
    return { stat: stat!, value: Number(v) };
  });
  const artifactEffects = setSpec.split(',').filter(Boolean).flatMap((s) => {
    const [setId, count] = s.split('=');
    const set = parsed.artifacts.get(setId!);
    if (!set) throw new Error(`unknown set ${setId}`);
    return [...(Number(count) >= 2 ? set.pieces['2'].effects : []), ...(Number(count) >= 4 ? set.pieces['4'].effects : [])];
  });
  return buildCharacterInput(c, { weapon: w, refinement: Number(refine), artifactMods: mods, artifactEffects });
});
const rotation: RotationStep[] = argv.flatMap((a, i) => {
  if (a === '--step') {
    const [char, action] = argv[i + 1]!.split('.');
    return [{ char: char!, action: action! }];
  }
  if (a === '--wait') return [{ char: '', action: 'wait', frames: Number(argv[i + 1]) }];
  return [];
});
void readFileSync; void join; void KB_DIR; void EXECUTION_PROFILES;

const enemy = { level: Number(get('enemy-level')[0] ?? 100), res: Object.fromEntries(['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro', 'physical'].map((e) => [e, Number(get('enemy-res')[0] ?? 0.1)])) };
const { relaxed, framePerfect } = simulateBoth({ characters, enemy, rotation, cycles: Number(get('cycles')[0] ?? 3) });
const fmt = (n: number) => Math.round(n).toLocaleString();
for (const [name, r] of [['relaxed', relaxed], ['frame-perfect', framePerfect]] as const) {
  console.log(`\n== ${name}: DPS ${fmt(r.dps)}  (window ${(r.windowFrames / 60).toFixed(2)} s)`);
  console.log(Object.entries(r.perCharacterDps).map(([c, d]) => `${c} ${fmt(d)}`).join('  |  '));
}
console.log('\nactions (relaxed, cycle 1):');
console.log(relaxed.actions.filter((a) => a.cycle === 1).map((a) => `${(a.start / 60).toFixed(2)}s ${a.char}.${a.action}`).join('\n'));
console.log('\nenergy:', JSON.stringify(relaxed.energy, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
console.log('\nassumptions:\n' + relaxed.assumptions.map((a) => '- ' + a).join('\n'));
