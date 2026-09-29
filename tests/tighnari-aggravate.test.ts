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

describe('Tighnari Quicken/Aggravate team', () => {
  it("Tighnari's Charged Attack (Wreath Arrow) exists, deals Dendro, and Spreads on a Quickened target", () => {
    const tighnari = build('tighnari');
    const fischl = build('fischl');
    const r = run(
      [{ char: 'fischl', action: 'skill' }, { char: 'tighnari', action: 'charged' }],
      [tighnari, fischl],
    );
    const wreath = r.hits.find((h) => h.char === 'tighnari' && h.action === 'charged');
    expect(wreath).toBeDefined();
    expect(wreath!.element).toBe('dendro');
    expect(r.hits.some((h) => h.reactions.includes('spread'))).toBe(true);
  });

  it("an electro support's hit Aggravates on a Quickened target", () => {
    const tighnari = build('tighnari');
    const beidou = build('beidou');
    const r = run(
      [{ char: 'beidou', action: 'skill' }, { char: 'tighnari', action: 'charged' }, { char: 'beidou', action: 'burst' }],
      [tighnari, beidou],
    );
    expect(r.hits.some((h) => h.reactions.includes('aggravate'))).toBe(true);
  });
});
