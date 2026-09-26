import { describe, expect, it } from 'vitest';
import { loadKb } from '../scripts/kb-node';
import { EXECUTION_PROFILES, buildCharacterInput, simulate } from '../src/engine';
import { DEFAULT_ENEMY, defaultWeapon } from '../src/kb';

const kb = loadKb();

describe('every character in the KB builds and simulates', () => {
  it('runs skill, burst and a normal chain for each one without errors and with sane numbers', () => {
    const problems: string[] = [];
    for (const c of kb.characters.values()) {
      try {
        const weapon = kb.weapons.get(defaultWeapon(kb, c.weaponType, () => true))!;
        const input = buildCharacterInput(c, { weapon });
        const names = Object.keys(input.actions);
        const steps = ['skill', 'burst', ...names.filter((n) => /^n\d+$/.test(n))].filter((n) => names.includes(n)).map((action) => ({ char: c.id, action }));
        const r = simulate({ characters: [input], enemy: DEFAULT_ENEMY, rotation: steps, cycles: 1, profile: EXECUTION_PROFILES.framePerfect });
        if (!Number.isFinite(r.dps) || r.dps < 0) problems.push(`${c.id}: dps ${r.dps}`);
        if (steps.length === 0) problems.push(`${c.id}: no actions`);
        if (r.totalDamage <= 0) problems.push(`${c.id}: deals no damage`);
      } catch (e) {
        problems.push(`${c.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    expect(problems).toEqual([]);
    expect(kb.characters.size).toBeGreaterThan(100);
  });
});
