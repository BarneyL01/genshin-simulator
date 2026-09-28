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

describe('Sucrose (EM support)', () => {
  it('fires 3 burst DoT ticks at C0 and includes absorb ticks with an Electro party member', () => {
    const sucrose = build('sucrose');
    const fischl = build('fischl');
    const r = run([{ char: 'sucrose', action: 'burst' }], [sucrose, fischl]);
    const dot = r.hits.filter((h) => h.action === 'burst-dot');
    const absorb = r.hits.filter((h) => h.action === 'burst-absorb');
    expect(dot).toHaveLength(3);
    expect(absorb).toHaveLength(3);
    expect(absorb.every((h) => h.element === 'electro')).toBe(true);
  });

  it('C2 extends the burst DoT to 4 ticks', () => {
    const sucrose = build('sucrose', 2);
    const r = run([{ char: 'sucrose', action: 'burst' }], [sucrose]);
    const dot = r.hits.filter((h) => h.action === 'burst-dot');
    expect(dot).toHaveLength(4);
  });

  it('no absorb ticks fire without a Pyro/Hydro/Electro/Cryo party member', () => {
    const sucrose = build('sucrose');
    const r = run([{ char: 'sucrose', action: 'burst' }], [sucrose]);
    expect(r.hits.some((h) => h.action === 'burst-absorb')).toBe(false);
  });

  it("A4 grants the rest of the party a buff scaled off Sucrose's EM after a Skill hit", () => {
    const sucrose = build('sucrose');
    const fischl = build('fischl');
    const r = run([{ char: 'sucrose', action: 'skill' }], [sucrose, fischl]);
    const buff = r.buffs.find((b) => b.effectId === 'sucrose.a4' && b.target === 'fischl');
    expect(buff).toBeDefined();
    expect(buff?.stat).toBe('em');
    // KQM Standards artifacts carry no EM substat, so with 0 base EM the buff is legitimately 0 here;
    // this confirms the buff fires and is wired to Sucrose's own EM, not that EM is present by default.
    expect(buff?.value).toBe(0);
  });
});
