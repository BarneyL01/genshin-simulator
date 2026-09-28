import { describe, expect, it } from 'vitest';
import { loadKb } from '../scripts/kb-node';
import { EXECUTION_PROFILES, simulate, type RotationStep, type SimResult } from '../src/engine';
import { buildMember, customRunInput, DEFAULT_ENEMY, runTeam } from '../src/kb';
import type { Roster } from '../src/schema';

const kb = loadKb();

/** Build a character at a given constellation (0 by default); weapon defaults to the KB's highest-base-ATK pick. */
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

describe('Chevreuse (Overloaded support)', () => {
  it("A1 shreds Pyro/Electro RES on Overloaded only when the team is all Pyro/Electro", () => {
    const chev = build('chevreuse');
    const varesa = build('varesa');
    const r = run([{ char: 'varesa', action: 'skill' }, { char: 'chevreuse', action: 'skill' }], [chev, varesa]);
    expect(r.buffs.some((b) => b.effectId === 'chevreuse.a1.pyro' && b.target === 'enemy')).toBe(true);
  });

  it("A4 gives Pyro/Electro party members ATK% scaled by Chevreuse's Max HP on every Skill cast", () => {
    const chev = build('chevreuse');
    const r = run([{ char: 'chevreuse', action: 'skill' }], [chev]);
    const buff = r.buffs.find((b) => b.effectId === 'chevreuse.a4');
    expect(buff?.value).toBeGreaterThan(0);
    expect(buff?.value).toBeLessThanOrEqual(0.4 + 1e-9);
  });

  it('C1 grants the on-field ally 6 energy once per 10s of Overloaded triggers', () => {
    const chev = build('chevreuse', 1);
    const varesa = build('varesa');
    const r = run([{ char: 'varesa', action: 'skill' }, { char: 'chevreuse', action: 'skill' }, { char: 'varesa', action: 'burst' }], [chev, varesa]);
    expect(r.energy.varesa?.flatEnergy).toBeGreaterThanOrEqual(6);
  });
});

describe('Durin (Dragon of White Flame)', () => {
  it('fires 20 periodic ticks after the burst, with the first 10 boosted by Primordial Fusion (A2)', () => {
    const durin = build('durin');
    const r = run([{ char: 'durin', action: 'skill' }, { char: 'durin', action: 'skillWhite' }, { char: 'durin', action: 'burst' }], [durin]);
    const ticks = r.hits.filter((h) => h.action === 'white-tick');
    expect(ticks).toHaveLength(20);
    expect(ticks[0]!.damage).toBeGreaterThan(ticks[19]!.damage); // early ticks get the A2 bonus, later ones do not
  });

  it('A1 shreds Pyro/Electro RES on Overloaded while a Dragon is up', () => {
    const durin = build('durin');
    const varesa = build('varesa');
    const r = run(
      [{ char: 'durin', action: 'skill' }, { char: 'durin', action: 'skillWhite' }, { char: 'durin', action: 'burst' }, { char: 'varesa', action: 'skill' }],
      [durin, varesa],
    );
    expect(r.buffs.some((b) => b.effectId === 'durin.a1.pyro')).toBe(true);
  });

  it('C4 adds +40% burst DMG', () => {
    const base = build('durin');
    const c4 = build('durin', 4);
    const rot = [{ char: 'durin', action: 'skill' }, { char: 'durin', action: 'skillWhite' }, { char: 'durin', action: 'burst' }];
    const first = (r: SimResult) => r.hits.filter((h) => h.action === 'burst').sort((x, y) => x.frame - y.frame)[0]!.damage;
    const a = first(run(rot, [base]));
    const b = first(run(rot, [c4]));
    expect(b).toBeCloseTo(a * 1.4, 0);
  });
});

describe('Varesa (Nightsoul plunge)', () => {
  it('a High Plunge inside the 5s post-Skill window gets a flat ATK-scaled ground-impact bonus; outside it, none', () => {
    const varesa = build('varesa');
    const inWindow = run([{ char: 'varesa', action: 'skill' }, { char: 'varesa', action: 'plunge' }], [varesa]);
    const outsideWindow = run([{ char: 'varesa', action: 'skill' }, { char: 'varesa', action: 'wait', frames: 400 }, { char: 'varesa', action: 'plunge' }], [varesa]);
    const inDmg = inWindow.hits.find((h) => h.action === 'plunge')!.damage;
    const outDmg = outsideWindow.hits.find((h) => h.action === 'plunge')!.damage;
    expect(inDmg).toBeGreaterThan(outDmg);
  });

  it('Fiery Passion High Plunge gets the upgraded (180% ATK) bonus', () => {
    const varesa = build('varesa');
    const r = run([{ char: 'varesa', action: 'skill' }, { char: 'varesa', action: 'plunge' }, { char: 'varesa', action: 'skillFiery' }, { char: 'varesa', action: 'plungeFiery' }], [varesa]);
    const normal = r.hits.find((h) => h.action === 'plunge')!;
    const fiery = r.hits.find((h) => h.action === 'plungeFiery')!;
    // Fiery Passion High Plunge has a higher base multiplier AND a 3.6x larger flat bonus ratio (1.8 vs 0.5 ATK).
    expect(fiery.damage).toBeGreaterThan(normal.damage * 1.8);
  });

  it("A2 grants Varesa +35% ATK (up to 2 stacks) when Iansan bursts, not when she herself does", () => {
    const varesa = build('varesa');
    const iansan = build('iansan');
    const r = run([{ char: 'iansan', action: 'burst' }, { char: 'varesa', action: 'burst' }], [varesa, iansan]);
    const stacks = r.buffs.filter((b) => b.effectId === 'varesa.a2' && b.target === 'varesa');
    expect(stacks).toHaveLength(1);
  });
});

describe('Iansan (Kinetic Energy Scale)', () => {
  it('Burst gives a flat ATK buff to whoever is on-field', () => {
    const iansan = build('iansan');
    const durin = build('durin');
    const r = run([{ char: 'iansan', action: 'burst' }], [iansan, durin]);
    const buff = r.buffs.find((b) => b.effectId === 'iansan.burst');
    expect(buff?.target).toBe('active');
    expect(buff?.value).toBeGreaterThan(0);
  });

  it('A1 gives Iansan +20% ATK after Swift Stormflight hits', () => {
    const iansan = build('iansan');
    const r = run([{ char: 'iansan', action: 'skill' }, { char: 'iansan', action: 'charged' }], [iansan]);
    expect(r.buffs.some((b) => b.effectId === 'iansan.a1' && b.target === 'iansan')).toBe(true);
  });

  it('C2 extends the ATK buff to the rest of the party', () => {
    const iansan = build('iansan', 2);
    const durin = build('durin');
    const r = run([{ char: 'iansan', action: 'skill' }, { char: 'iansan', action: 'charged' }], [iansan, durin]);
    expect(r.buffs.some((b) => b.effectId === 'iansan.c2' && b.target === 'durin')).toBe(true);
  });
});

describe('Varesa / Chevreuse / Durin / Iansan team', () => {
  it('simulates end to end and beats a comparable Varka pyro-support team on this KB', () => {
    const kbTeam = { order: ['chevreuse', 'iansan', 'durin', 'varesa'] };
    const varkaTeam = { order: ['jean', 'bennett', 'durin', 'varka'] };
    const a = runTeam(kb, customRunInput(kb, kbTeam), { cycles: 5, burstPolicy: 'always' });
    const b = runTeam(kb, customRunInput(kb, varkaTeam), { cycles: 5, burstPolicy: 'always' });
    expect(a.relaxed.dps).toBeGreaterThan(0);
    expect(a.relaxed.dps).toBeGreaterThan(b.relaxed.dps);
  }, 60_000);
});
