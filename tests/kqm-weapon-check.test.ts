import { describe, expect, it } from 'vitest';
import { loadKb } from '../scripts/kb-node';
import { EXECUTION_PROFILES, buildCharacterInput, optimizeKqms, simulate } from '../src/engine';
import { DEFAULT_ENEMY, setEffects } from '../src/kb';

/**
 * Published check: the KeqingMains Hu Tao guide (https://keqingmains.com/hu-tao/, "Weapon Comparison Table
 * (With HP Sands)", retrieved 2026-09-25) lists personal damage as a percentage of a Blackcliff Pole under
 *   "KQMS; 4CW; HP/Pyro DMG/CRIT; 7N2C Burst 2BB Vaped; 100% ER requirement; unbuffed."
 * Our reproduction: E, Q, then 7 × (N1 N2 C); every hit is Vaporized (permanent Hydro aura); no ER rolls;
 * Homa's low-HP bonus on; frame-perfect timing. The comparison is only meaningful as a ratio.
 */
const kb = loadKb();

const KQM = { 'staff-of-homa:5': 1.66, 'staff-of-homa:1': 1.36, 'white-tassel:5': 1.01, 'blackcliff-pole:1': 1.0, 'black-tassel:5': 0.92 };

function huTaoDps(weaponId: string, refinement: number): number {
  const c = kb.characters.get('hu-tao')!;
  const w = kb.weapons.get(weaponId)!;
  const input = buildCharacterInput(c, { weapon: w, refinement, artifactEffects: setEffects(kb, { 'crimson-witch-of-flames': 4 }) });
  const rotation = [
    { char: 'hu-tao', action: 'skill' }, { char: 'hu-tao', action: 'burst' },
    { repeat: { times: 7 }, steps: ['n1', 'n2', 'charged'].map((action) => ({ char: 'hu-tao', action })) },
  ];
  const problem = {
    characters: [input],
    mains: { 'hu-tao': [{ sands: 'hp%', goblet: 'dmgBonus.pyro', circlet: 'critRate' }, { sands: 'hp%', goblet: 'dmgBonus.pyro', circlet: 'critDmg' }] },
    enemy: DEFAULT_ENEMY, rotation, profile: EXECUTION_PROFILES.framePerfect, cycles: 1, enemyAura: { element: 'hydro' as const }, ignoreEnergy: true,
  };
  const k = optimizeKqms(problem);
  const r = simulate({ characters: k.characters, enemy: DEFAULT_ENEMY, rotation, cycles: 1, profile: EXECUTION_PROFILES.framePerfect, enemyAura: problem.enemyAura, startEnergy: 'full' });
  return r.perCharacterDps['hu-tao']!;
}

describe('Hu Tao weapon percentages against the KeqingMains table', () => {
  const base = huTaoDps('blackcliff-pole', 1);
  const rows = Object.entries(KQM).map(([key, kqm]) => {
    const [id, r] = key.split(':') as [string, string];
    return { key, kqm, ours: huTaoDps(id, Number(r)) / base };
  });

  it('prints the comparison', () => {
    console.log('Hu Tao weapon % of Blackcliff Pole (ours vs KQM):\n' + rows.map((r) => `  ${r.key.padEnd(20)} ${(r.ours * 100).toFixed(0).padStart(4)}%  vs ${(r.kqm * 100).toFixed(0)}%`).join('\n'));
    expect(rows).toHaveLength(5);
  });

  it('is within 4 percentage points of KeqingMains for Homa R1/R5, White Tassel and the baseline', () => {
    for (const r of rows.filter((x) => x.key !== 'black-tassel:5')) expect(Math.abs(r.ours - r.kqm), r.key).toBeLessThan(0.04);
  });

  /**
   * Known deviation: KeqingMains lists Black Tassel R5 at 92%, we get about 82%. Black Tassel is the only weapon
   * here whose HP is high enough for Paramita Papilio's ATK bonus to hit the "400% of Base ATK" cap (Base ATK
   * includes the 354 weapon ATK, as in gcsim), which costs it roughly 10%. KeqingMains' number is consistent with
   * the cap not binding. Recorded in docs/OPEN_QUESTIONS.md; the engine follows the in-game/gcsim rule.
   */
  it('Black Tassel R5 is 10 points low (documented deviation)', () => {
    const r = rows.find((x) => x.key === 'black-tassel:5')!;
    expect(r.ours).toBeGreaterThan(0.72);
    expect(r.ours).toBeLessThan(0.92);
  });
});
