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

describe('Varka (team-composition conversion element)', () => {
  it("converts to the team's Electro member (Varka electro team: Sucrose/Alyosha/Fischl/Varka)", () => {
    const varka = build('varka');
    const fischl = build('fischl');
    const r = run(
      [{ char: 'varka', action: 'skill' }, { char: 'varka', action: 'fourWinds' }],
      [varka, fischl],
    );
    const fourWindsHits = r.hits.filter((h) => h.char === 'varka' && h.action === 'fourWinds');
    expect(fourWindsHits.length).toBe(2);
    expect(fourWindsHits.some((h) => h.element === 'electro')).toBe(true);
    expect(fourWindsHits.some((h) => h.element === 'pyro')).toBe(false);
  });

  it("converts to Pyro when the team has a Pyro member (Varka pyro team: Jean/Bennett/Durin/Varka)", () => {
    const varka = build('varka');
    const bennett = build('bennett');
    const r = run(
      [{ char: 'varka', action: 'skill' }, { char: 'varka', action: 'fourWinds' }],
      [varka, bennett],
    );
    const fourWindsHits = r.hits.filter((h) => h.char === 'varka' && h.action === 'fourWinds');
    expect(fourWindsHits.some((h) => h.element === 'pyro')).toBe(true);
  });

  it('falls back to Physical (only Anemo hit deals elemental) when the team has no Pyro/Hydro/Electro/Cryo member', () => {
    const varka = build('varka');
    const r = run([{ char: 'varka', action: 'skill' }, { char: 'varka', action: 'fourWinds' }], [varka]);
    const fourWindsHits = r.hits.filter((h) => h.char === 'varka' && h.action === 'fourWinds');
    expect(fourWindsHits.some((h) => h.element === 'anemo')).toBe(true);
    expect(fourWindsHits.some((h) => h.element === 'physical')).toBe(true);
    expect(fourWindsHits.some((h) => h.element === 'pyro')).toBe(false);
  });

  it("applies the team-comp multiplier to Four Winds' Ascension with 2+ Anemo and 2+ of one conversion element", () => {
    const fischl = build('fischl'); // electro
    const sucrose = build('sucrose'); // anemo
    const alyosha = build('alyosha'); // electro
    const rTeam = run(
      [{ char: 'varka', action: 'skill' }, { char: 'varka', action: 'fourWinds' }],
      [build('varka'), fischl, sucrose, alyosha],
    );
    const rSolo = run([{ char: 'varka', action: 'skill' }, { char: 'varka', action: 'fourWinds' }], [build('varka')]);
    const teamHit = rTeam.hits.filter((h) => h.char === 'varka' && h.action === 'fourWinds' && h.element === 'anemo')[0];
    const soloHit = rSolo.hits.filter((h) => h.char === 'varka' && h.action === 'fourWinds' && h.element === 'anemo')[0];
    expect(teamHit).toBeDefined();
    expect(soloHit).toBeDefined();
    expect(teamHit!.damage).toBeGreaterThan(soloHit!.damage);
  });

  it('C1 doubles the multiplier on exactly the next Four Winds cast after a Skill', () => {
    const varka = build('varka', 1);
    const r = run(
      [{ char: 'varka', action: 'skill' }, { char: 'varka', action: 'fourWinds' }, { char: 'varka', action: 'fourWinds' }],
      [varka],
    );
    const hits = r.hits.filter((h) => h.char === 'varka' && h.action === 'fourWinds' && h.element === 'anemo');
    expect(hits).toHaveLength(2);
    expect(hits[0]!.damage).toBeGreaterThan(hits[1]!.damage);
  });

  it("A2 (Wind's Vanguard) hook runs without throwing in a multi-character team", () => {
    const varka = build('varka');
    const fischl = build('fischl');
    const r = run([{ char: 'varka', action: 'skill' }], [varka, fischl]);
    expect(r.hits.length).toBeGreaterThan(0);
  });
});
