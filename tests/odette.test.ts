import { describe, expect, it } from 'vitest';
import { loadKb } from '../scripts/kb-node';
import { EXECUTION_PROFILES, simulate, type SimResult } from '../src/engine';
import { DEFAULT_ENEMY, buildMember, compareWeapons, teamInput } from '../src/kb';

const kb = loadKb();
const build = (character: string, weapon?: string, refinement = 1) =>
  buildMember(kb, { character, weapons: weapon ? [weapon] : [], sets: {}, pinned: weapon ? { refinement } : undefined }, {}, []).input;

const run = (steps: Array<[string, string]>, chars = [build('odette', 'silver-light', 5), build('fischl')]): SimResult =>
  simulate({
    characters: chars, enemy: DEFAULT_ENEMY, cycles: 1, profile: EXECUTION_PROFILES.framePerfect, burstPolicy: 'always',
    rotation: steps.map(([char, action]) => ({ char, action })),
  });

describe('Silver Light', () => {
  it('is an event weapon with R5 obtainable free', () => {
    const w = kb.weapons.get('silver-light')!;
    expect(w.obtain).toMatchObject({ method: 'event', freeRefinement: 5 });
  });

  it('adds one EM stack per Elemental Skill use (Coda included), max 2, each lasting 720 frames independently', () => {
    const r = run([['odette', 'skill'], ['odette', 'burst'], ['odette', 'coda']]);
    const em = r.buffs.filter((b) => b.effectId === 'silver-light.em');
    expect(em).toHaveLength(2);
    expect(em.every((b) => b.value === 104 && b.end! - b.start === 720)).toBe(true);
    const skill = r.actions.find((a) => a.action === 'skill')!.start;
    const coda = r.actions.find((a) => a.action === 'coda')!.start;
    expect(em.map((b) => b.start)).toEqual([skill, coda]);
  });
});

describe('Odette', () => {
  it('Solo Dance Double alternates Plume (109 frames) and Wing (125 frames), first move 134 frames after the skill hit', () => {
    const r = run([['odette', 'skill']]);
    const skill = r.actions.find((a) => a.action === 'skill')!.start;
    const moves = r.hits.filter((h) => h.action === 'plume' || h.action === 'wing');
    expect(moves.slice(0, 4).map((h) => [h.action, h.frame - skill])).toEqual([['plume', 157], ['wing', 266], ['plume', 391], ['wing', 500]]);
    // the Double lasts 1262 frames from the skill hit
    expect(moves.every((h) => h.frame < skill + 23 + 1262)).toBe(true);
    // not upgraded (no Coda): no Stellar Glimmer hits
    expect(r.hits.some((h) => h.action.endsWith('-ssc'))).toBe(false);
  });

  it('Coda deals a Stellar Glimmer hit, and upgraded moves deal Stellar Glimmer hits only inside a Polestar Field', () => {
    // no Electro in the team: no Stellar-Conduct, no field
    const solo = run([['odette', 'skill'], ['odette', 'coda']], [build('odette')]);
    expect(solo.hits.filter((h) => h.action === 'coda-ssc')).toHaveLength(1);
    expect(solo.hits.some((h) => h.action === 'plume-ssc' || h.action === 'wing-ssc')).toBe(false);
    // Fischl's Oz applies Electro on the Cryo aura: Stellar-Conduct fields, and upgraded moves gain Stellar Glimmer hits
    const team = run([['fischl', 'skill'], ['odette', 'skill'], ['odette', 'coda']]);
    expect(team.hits.some((h) => h.reactions.includes('stellarConduct'))).toBe(true);
    const coda = team.actions.find((a) => a.action === 'coda')!.start;
    const ssc = team.hits.filter((h) => h.action === 'plume-ssc' || h.action === 'wing-ssc');
    expect(ssc.length).toBeGreaterThan(0);
    expect(ssc.every((h) => h.frame > coda)).toBe(true);
  });

  it('Marvelous Splendor moves to the party while Odette is off-field', () => {
    const r = run([['odette', 'skill'], ['fischl', 'skill'], ['fischl', 'n1'], ['fischl', 'n1'], ['fischl', 'n1'], ['fischl', 'n1'], ['fischl', 'n1']]);
    const others = r.buffs.filter((b) => b.effectId === 'odette.a1' && b.target === 'fischl').map((b) => b.value);
    expect(Math.max(...others)).toBeGreaterThan(0);
    expect(Math.max(...others)).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it('Silver Light R5 beats R1 on Odette in the Odette Stellar-Conduct team', () => {
    const team = kb.teams.get('odette-stellar-conduct')!;
    const rows = compareWeapons(kb, teamInput(team), 'odette', [{ weaponId: 'silver-light', refinement: 1 }, { weaponId: 'silver-light', refinement: 5 }], { weaponId: 'silver-light', refinement: 1 });
    const r5 = rows.find((x) => x.refinement === 5)!;
    expect(r5.charDelta).toBeGreaterThan(0.03);
  }, 60_000);
});
