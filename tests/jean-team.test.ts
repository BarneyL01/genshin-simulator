import { describe, expect, it } from 'vitest';
import { loadKb } from '../scripts/kb-node';
import { EXECUTION_PROFILES, simulate, type RotationStep, type SimResult } from '../src/engine';
import { buildMember, DEFAULT_ENEMY } from '../src/kb';
import type { Roster } from '../src/schema';

const kb = loadKb();

function build(character: string, constellation = 0) {
  const roster: Roster = {
    version: 1,
    characters: { [character]: { owned: true, constellation, talents: [1, 1, 1], level: 90 } },
    weapons: {},
    settings: { executionProfile: 'framePerfect', actionDelay: 0, swapDelay: 0, assumeAllWeapons: true },
  };
  return buildMember(kb, { character, weapons: [], sets: {} }, { roster }, []).input;
}

const run = (rotation: RotationStep[], chars: ReturnType<typeof build>[]): SimResult =>
  simulate({ characters: chars, enemy: DEFAULT_ENEMY, cycles: 1, profile: EXECUTION_PROFILES.framePerfect, burstPolicy: 'always', rotation });

describe('Jean (Dandelion Breeze support)', () => {
  it('fires 10 periodic field ticks after burst', () => {
    const jean = build('jean');
    const r = run([{ char: 'jean', action: 'burst' }], [jean]);
    const ticks = r.hits.filter((h) => h.action === 'field-tick');
    expect(ticks).toHaveLength(10);
  });

  it('A4 refunds 16 flat Energy on burst', () => {
    const jean = build('jean');
    const r = run([{ char: 'jean', action: 'burst' }], [jean]);
    expect(r.energy.jean?.flatEnergy).toBeGreaterThanOrEqual(16);
  });

  it('C4 applies a -40% Anemo RES debuff on the enemy after burst', () => {
    const jean = build('jean', 4);
    const r = run([{ char: 'jean', action: 'burst' }], [jean]);
    const buff = r.buffs.find((b) => b.effectId === 'jean.c4');
    expect(buff?.value).toBe(-0.4);
  });

  it('does not apply the C4 debuff below C4', () => {
    const jean = build('jean', 3);
    const r = run([{ char: 'jean', action: 'burst' }], [jean]);
    expect(r.buffs.some((b) => b.effectId === 'jean.c4')).toBe(false);
  });
});
