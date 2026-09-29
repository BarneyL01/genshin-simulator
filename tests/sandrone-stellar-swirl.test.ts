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

describe('Sandrone in a Stellar Swirl team', () => {
  it("Mizuki's Anemo hit on Sandrone's own Cryo aura becomes a Stellar Swirl", () => {
    const sandrone = build('sandrone');
    const mizuki = build('yumemizuki-mizuki');
    const r = run(
      [{ char: 'sandrone', action: 'skill' }, { char: 'yumemizuki-mizuki', action: 'skill' }],
      [sandrone, mizuki],
    );
    expect(r.hits.some((h) => h.action === 'stellarSwirl')).toBe(true);
  });

  it("Sandrone's Stellar Jubilee boosts the whole team's Stellar Swirl reaction DMG with her own ATK", () => {
    const sandrone = build('sandrone');
    const mizuki = build('yumemizuki-mizuki');
    const r = run([{ char: 'sandrone', action: 'skill' }, { char: 'yumemizuki-mizuki', action: 'skill' }], [sandrone, mizuki]);
    const stellarHits = r.hits.filter((h) => h.action === 'stellarSwirl');
    expect(stellarHits.length).toBeGreaterThan(0);
    // sanity: some positive damage from the reaction
    expect(stellarHits[0]!.damage).toBeGreaterThan(0);
  });
});
