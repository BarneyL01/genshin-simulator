import { describe, expect, it } from 'vitest';
import { EXECUTION_PROFILES, buildCharacterInput, simulate } from '../src/engine';
import { character, weapon } from '../src/schema';

const provenance = { sources: [{ site: 'test', url: 'https://example.com', retrieved: '2026-09-25' }], gameVersion: '7.1' };
const mv = (base: number) => Array.from({ length: 15 }, (_, i) => base + i * 0.1);

// Synthetic fixture (not game data).
const char = character.parse({
  id: 'test-pyro', name: 'Test Pyro', rarity: 5, element: 'pyro', weaponType: 'sword', releaseVersion: '1.0',
  baseStats: { lv90: { hp: 10000, atk: 300, def: 600 } }, ascensionStat: { stat: 'critRate', value: 0.192 },
  talents: {
    normal: { hits: [
      { name: 'N1', mv: mv(0.5), element: 'physical', frames: { hitmark: 10, cancel: { attack: 20, swap: 25 } } },
      { name: 'N2', mv: mv(0.6), element: 'physical', frames: { hitmark: 8, cancel: { attack: 30 } } },
    ] },
    skill: { cooldown: 300, hits: [
      { name: 'Skill', mv: mv(2), element: 'pyro', frames: { hitmark: 12, cancel: { default: 40, burst: 30 } } },
    ] },
  },
  passives: [{ id: 'test.a1', unlock: 'a1', effects: [
    { id: 'test.a1.dmg', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.pyro', value: 0.2 },
  ] }],
  constellations: [{ level: 1, effects: [
    { id: 'test.c1', trigger: { on: 'always' }, target: 'self', stat: 'critDmg', value: 0.5 },
  ] }],
  usualCombo: [{ variant: 'on-field', actions: [{ action: 'skill' }] }],
  provenance, dataConfidence: 'low',
});
const sword = weapon.parse({
  id: 'test-sword', name: 'Test Sword', type: 'sword', rarity: 4, releaseVersion: '1.0',
  baseAtk: { lv90: 500 }, substat: { stat: 'atk%', lv90: 0.2 }, obtain: { method: 'craft' },
  passive: { effects: [{ id: 'test.w', trigger: { on: 'always' }, target: 'self', stat: 'em', value: { perRefinement: [10, 20, 30, 40, 50] } }] },
  provenance, dataConfidence: 'low',
});

describe('buildCharacterInput', () => {
  it('maps normal chain, skill, talent levels and cancel keys', () => {
    const c = buildCharacterInput(char, { weapon: sword, talentLevels: [9, 10, 9] });
    expect(Object.keys(c.actions)).toEqual(['n1', 'n2', 'skill']);
    expect(c.actions.n1!.cancel).toMatchObject({ normal: 20, swap: 25, default: 10 });
    expect(c.actions.n1!.hits[0]!.mv).toBeCloseTo(0.5 + 8 * 0.1);
    expect(c.actions.skill!.hits[0]!.mv).toBeCloseTo(2 + 9 * 0.1); // skill uses level 10
    expect(c.actions.skill!.cooldown).toBe(300);
    expect(c.weaponAtk).toBe(500);
  });

  it('includes constellations only up to the set level', () => {
    const ids = (cons: number) => buildCharacterInput(char, { weapon: sword, constellation: cons }).effects.map((e) => e.id);
    expect(ids(0)).not.toContain('test.c1');
    expect(ids(1)).toContain('test.c1');
  });

  it('simulates end to end with hand-checkable numbers', () => {
    const c = buildCharacterInput(char, { weapon: sword, refinement: 3, talentLevels: [9, 9, 9] });
    const r = simulate({
      characters: [c], enemy: { level: 100, res: { pyro: 0.1 } }, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'test-pyro', action: 'skill' }],
    });
    // atk = (300 + 500) × 1.2 = 960; skill Lv9 mv 2.8; dmgBonus 0.2; CR 0.05+0.192, CD 0.5
    const expected = 2.8 * 960 * 1.2 * (1 + 0.242 * 0.5) * (190 / 390) * 0.9;
    expect(r.hits[0]!.damage).toBeCloseTo(expected, 6);
  });
});
