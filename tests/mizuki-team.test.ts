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

describe('Mizuki (Dreamdrifter EM support)', () => {
  it('fires 7 cloud ticks and 8 snack ticks on skill/burst', () => {
    const mizuki = build('yumemizuki-mizuki');
    const r = run([{ char: 'yumemizuki-mizuki', action: 'skill' }, { char: 'yumemizuki-mizuki', action: 'burst' }], [mizuki]);
    expect(r.hits.filter((h) => h.action === 'cloud')).toHaveLength(7);
    expect(r.hits.filter((h) => h.action === 'snack')).toHaveLength(8);
  });

  it('applies a reactionBonus.stellarSwirl buff to the whole party on skill cast', () => {
    const mizuki = build('yumemizuki-mizuki');
    const fischl = build('fischl');
    const r = run([{ char: 'yumemizuki-mizuki', action: 'skill' }], [mizuki, fischl]);
    const buffs = r.buffs.filter((b) => b.effectId === 'mizuki.stellar-swirl-bonus');
    expect(buffs.map((b) => b.target).sort()).toEqual(['fischl', 'yumemizuki-mizuki']);
  });

  it('C6 gives Mizuki self CRIT scaling with EM above 500', () => {
    const mizuki = build('yumemizuki-mizuki', 6);
    const r = run([{ char: 'yumemizuki-mizuki', action: 'skill' }], [mizuki]);
    const cr = r.buffs.find((b) => b.effectId === 'mizuki.c6-self.cr');
    expect(cr).toBeDefined();
    expect(cr!.value).toBeGreaterThanOrEqual(0);
  });

  it('below C6, no self-CRIT buff fires', () => {
    const mizuki = build('yumemizuki-mizuki', 5);
    const r = run([{ char: 'yumemizuki-mizuki', action: 'skill' }], [mizuki]);
    expect(r.buffs.some((b) => b.effectId === 'mizuki.c6-self.cr')).toBe(false);
  });
});
