import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadKb } from '../scripts/kb-node';
import { buildCustomRotation, compareWeapons, customRunInput, rankTeams, runTeam, teamInput } from '../src/kb';
import type { Roster } from '../src/schema';

const kb = loadKb();
const GOLDEN = join(import.meta.dirname, 'golden', 'teams.json');

/**
 * Regression values for the seed teams under default settings (everything owned, C0, R1, Lv 90,
 * KQMS stats, level-100 enemy with 10% RES). These are OUR engine's outputs, recorded to catch
 * unintended changes; they are not published community figures. Update with UPDATE_GOLDEN=1 after an
 * intended change and explain it in docs/PROGRESS_LOG.md.
 */
const golden: Record<string, { relaxedDps: number; framePerfectDps: number }> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
const recorded: typeof golden = {};

describe('seed teams simulate end to end from the KB', () => {
  for (const id of ['raiden-national', 'hu-tao-double-hydro-zhongli']) {
    it(id, () => {
      const run = runTeam(kb, teamInput(kb.teams.get(id)!));
      expect(run.members).toHaveLength(4);
      expect(run.relaxed.dps).toBeGreaterThan(1000);
      expect(run.framePerfect.dps).toBeGreaterThan(run.relaxed.dps); // the Relaxed delay always costs something
      expect(run.relaxed.cycleFrames).toBeGreaterThan(run.framePerfect.cycleFrames);
      for (const m of run.members) {
        expect(Object.values(m.liquid).reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(20);
        expect(run.relaxed.perCharacterDps[m.character]).toBeGreaterThanOrEqual(0);
      }
      expect(run.relaxed.hits.some((h) => h.reactions.length > 0)).toBe(true);
      recorded[id] = { relaxedDps: run.relaxed.dps, framePerfectDps: run.framePerfect.dps };
      if (golden[id]) {
        expect(run.relaxed.dps).toBeCloseTo(golden[id].relaxedDps, -Math.ceil(Math.log10(golden[id].relaxedDps * 0.01)));
        expect(Math.abs(run.framePerfect.dps / golden[id].framePerfectDps - 1)).toBeLessThan(0.01);
      }
    });
  }

  it('records golden values when asked', () => {
    if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN, JSON.stringify({ ...golden, ...recorded }, null, 2) + '\n');
  });
});

describe('Mode A ranking uses the roster', () => {
  const roster = (owned: string[]): Roster => ({
    version: 1,
    characters: Object.fromEntries([...kb.characters.keys()].map((id) => [id, { owned: owned.includes(id), constellation: 0, talents: [9, 9, 9] as [number, number, number], level: 90 as const }])),
    weapons: {},
    settings: { executionProfile: 'relaxed', actionDelay: 18, swapDelay: 18, assumeAllWeapons: true },
  });

  it('lists only teams whose members are owned, others with what is missing', () => {
    const r = rankTeams(kb, roster(['raiden-shogun', 'xiangling', 'xingqiu', 'bennett']), { cycles: 2 });
    const national = r.find((x) => x.team.id === 'raiden-national')!;
    const hutao = r.find((x) => x.team.id === 'hu-tao-double-hydro-zhongli')!;
    expect(national.run).toBeDefined();
    expect(hutao.run).toBeUndefined();
    expect(hutao.missing.sort()).toEqual(['hu-tao', 'yelan', 'zhongli']);
    expect(r[0]!.team.id).toBe('raiden-national');
  });

  it('uses the roster constellations, talents and weapon refinements', () => {
    const base = runTeam(kb, teamInput(kb.teams.get('raiden-national')!), { cycles: 2 });
    const ro = roster([...kb.characters.keys()]);
    ro.characters['xiangling']!.constellation = 6;
    ro.weapons['the-catch'] = { owned: true, refinement: 5 };
    const c6 = runTeam(kb, teamInput(kb.teams.get('raiden-national')!), { cycles: 2, roster: ro });
    expect(c6.members.find((m) => m.character === 'xiangling')!.refinement).toBe(5);
    expect(c6.relaxed.perCharacterDps['xiangling']!).toBeGreaterThan(base.relaxed.perCharacterDps['xiangling']!);
  });
});

describe('Mode B custom teams', () => {
  it('chains the usual combos in the chosen order and fills the rotation for on-field combos', () => {
    const rot = buildCustomRotation(kb, { order: ['xingqiu', 'bennett', 'zhongli', 'hu-tao'], lengthSeconds: 20 });
    const flat = rot.script.flatMap((s) => ('steps' in s ? [`repeat(${JSON.stringify(s.repeat)}):${s.steps.map((x) => x.action).join('+')}`] : [`${s.char}.${s.action}`]));
    expect(flat.slice(0, 2)).toEqual(['xingqiu.skill', 'xingqiu.burst']);
    expect(flat[flat.length - 1]).toBe('repeat({"untilCycleTime":1200}):n1+charged');
    expect(rot.lengthFrames).toBe(1200);
  });

  it('simulates a custom team from recommended builds', () => {
    const input = customRunInput(kb, { order: ['xingqiu', 'bennett', 'xiangling', 'raiden-shogun'], variants: { 'raiden-shogun': 'on-field' } });
    const run = runTeam(kb, input, { cycles: 2 });
    expect(run.relaxed.dps).toBeGreaterThan(1000);
    expect(run.label).toContain('custom rotation');
  });
});

describe('Weapon comparer', () => {
  it('ranks weapons by team DPS, reports deltas, ER change and a worst case', () => {
    const input = teamInput(kb.teams.get('hu-tao-double-hydro-zhongli')!);
    const res = compareWeapons(
      kb, input, 'hu-tao',
      [{ weaponId: 'staff-of-homa', refinement: 1 }, { weaponId: 'staff-of-homa', refinement: 5 }, { weaponId: 'black-tassel', refinement: 5 }, { weaponId: 'white-tassel', refinement: 5 }],
      { weaponId: 'staff-of-homa', refinement: 1 }, { cycles: 3 },
    );
    expect(res.map((r) => `${r.weaponId}:${r.refinement}`)).toEqual(['staff-of-homa:5', 'staff-of-homa:1', 'white-tassel:5', 'black-tassel:5']);
    const base = res.find((r) => r.isBaseline)!;
    expect(base.teamDelta).toBeCloseTo(0);
    expect(res[0]!.teamDelta).toBeGreaterThan(0);
    expect(res[3]!.charDelta).toBeLessThan(-0.2);
    // Homa's low-HP bonus rests on an assumed condition: the worst case must be lower
    expect(base.worst.charDps).toBeLessThan(base.charDps);
    expect(base.assumptions.some((a) => a.includes('HP'))).toBe(true);
  });
});

describe('Stellar-Conduct team: Cryo Traveler vs Kaeya', () => {
  const run = (id: string) => runTeam(kb, teamInput(kb.teams.get(id)!), { cycles: 4, burstPolicy: 'requireEnergy' });
  const traveler = run('sandrone-stellar-conduct-traveler');
  const kaeya = run('sandrone-stellar-conduct-kaeya');

  it('both teams turn Superconduct into Stellar-Conduct (Sandrone enables it) and create Polestar Fields', () => {
    for (const r of [traveler, kaeya]) {
      expect(r.relaxed.hits.some((h) => h.reactions.includes('stellarConduct'))).toBe(true);
      expect(r.relaxed.hits.some((h) => h.reactions.includes('superconduct'))).toBe(false);
      expect(r.relaxed.buffs.some((b) => b.effectId === 'polestar.shred')).toBe(true);
    }
  });

  it('the Traveler team does more damage and keeps the field up more often', () => {
    const fields = (r: typeof traveler) => r.relaxed.buffs.filter((b) => b.effectId === 'polestar.shred').length;
    expect(traveler.relaxed.dps).toBeGreaterThan(kaeya.relaxed.dps);
    expect(fields(traveler)).toBeGreaterThan(fields(kaeya));
    expect(traveler.relaxed.perCharacterDps['traveler-cryo']!).toBeGreaterThan(kaeya.relaxed.perCharacterDps['kaeya']!);
  });
});

describe('custom team builds', () => {
  it('uses the chosen weapon, refinement and 4pc set instead of the recommended build', () => {
    const team = { order: ['xiangling', 'bennett', 'xingqiu', 'zhongli'], builds: { xiangling: { weapon: 'the-catch', refinement: 5, set: 'emblem-of-severed-fate' } } };
    const input = customRunInput(kb, team);
    const run = runTeam(kb, input);
    const m = run.members.find((x) => x.character === 'xiangling')!;
    expect(m.weaponId).toBe('the-catch');
    expect(m.refinement).toBe(5);
    expect(input.members[0]!.sets).toEqual({ 'emblem-of-severed-fate': 4 });
  });
});
