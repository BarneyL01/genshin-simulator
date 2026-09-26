import { describe, expect, it } from 'vitest';
import {
  BuffManager, EXECUTION_PROFILES, type ExecutionProfile, calcHitDamage, critFactor, defMultiplier, resMultiplier,
  resolveStats, simulate, simulateBoth, sumMods,
  type ActionDef, type CharacterInput, type EnemyInput, type HitDef,
} from '../src/engine';
import { effect } from '../src/schema';

describe('stat resolver', () => {
  it('(base + weapon) × (1 + %) + flat', () => {
    const s = resolveStats(
      { hp: 10000, atk: 1000, def: 500 },
      500,
      sumMods([
        { stat: 'atk%', value: 0.3 }, { stat: 'atk%', value: 0.2 }, { stat: 'atk', value: 300 },
        { stat: 'hp%', value: 0.466 }, { stat: 'er', value: 0.32 }, { stat: 'critRate', value: 0.3 }, { stat: 'em', value: 80 },
      ]),
    );
    expect(s.atk).toBeCloseTo(1500 * 1.5 + 300); // 2550
    expect(s.hp).toBeCloseTo(14660);
    expect(s.def).toBe(500);
    expect(s.er).toBeCloseTo(1.32);
    expect(s.critRate).toBeCloseTo(0.35);
    expect(s.critDmg).toBe(0.5);
    expect(s.em).toBe(80);
  });
});

describe('damage formula', () => {
  it('DEF multiplier for Lv90 vs Lv100 is 190/390', () => {
    expect(defMultiplier(90, 100)).toBeCloseTo(190 / 390);
    expect(defMultiplier(90, 100, 0.2)).toBeCloseTo(190 / (190 + 200 * 0.8));
  });
  it('RES is piecewise', () => {
    expect(resMultiplier(-0.2)).toBeCloseTo(1.1);
    expect(resMultiplier(0.1)).toBeCloseTo(0.9);
    expect(resMultiplier(0.9)).toBeCloseTo(1 / 4.6);
  });
  it('crit rate is capped at 100%', () => {
    expect(critFactor(1.4, 2)).toBe(3);
  });
  it('full hit matches a hand calculation', () => {
    const hit: HitDef = { frame: 0, mv: 2, scaling: 'atk', element: 'pyro', talent: 'skill' };
    const mods = sumMods([{ stat: 'dmgBonus.pyro', value: 0.466 }, { stat: 'dmgBonus.skill', value: 0.2 }, { stat: 'critRate', value: 0.45 }, { stat: 'critDmg', value: 0.5 }]);
    const stats = resolveStats({ hp: 1, atk: 1000, def: 1 }, 500, { ...mods, 'atk%': 0.5, atk: 300 });
    const dmg = calcHitDamage({ hit, stats, mods: { ...mods, 'res.enemy.pyro': -0.2 }, charLevel: 90, enemyLevel: 100, enemyRes: { pyro: 0.1 } });
    // atk 2550; (2×2550) × (1+0.666) × (1 + 0.5×1.0) × 190/390 × (1 − (0.1 − 0.2)/2), i.e. 1.05 for negative RES
    expect(dmg).toBeCloseTo(5100 * 1.666 * 1.5 * (190 / 390) * 1.05, 6);
  });
});

describe('buff manager', () => {
  const spec = (over = {}) => ({ effectId: 'e', source: 'a', target: 'a', stat: 'atk%', value: 0.1, duration: 100, maxStacks: 3, stackMode: 'refresh' as const, ...over });
  it('refresh mode stacks and refreshes duration', () => {
    const bm = new BuffManager();
    bm.apply(spec(), 0);
    bm.apply(spec(), 50);
    expect(bm.modsFor('a', 40)['atk%']).toBeCloseTo(0.1);
    expect(bm.modsFor('a', 60)['atk%']).toBeCloseTo(0.2);
    expect(bm.modsFor('a', 149)['atk%']).toBeCloseTo(0.2);
    expect(bm.modsFor('a', 150)['atk%']).toBeUndefined();
    expect(bm.records.map((r) => [r.start, r.end, r.stacks])).toEqual([[0, 50, 1], [50, 150, 2]]);
  });
  it('independent mode keeps separate timers and drops the oldest at max stacks', () => {
    const bm = new BuffManager();
    const s = spec({ stackMode: 'independent', maxStacks: 2 });
    bm.apply(s, 0);
    bm.apply(s, 30);
    bm.apply(s, 60);
    expect(bm.modsFor('a', 70)['atk%']).toBeCloseTo(0.2);
    expect(bm.modsFor('a', 110)['atk%']).toBeCloseTo(0.2); // first dropped at 60, second (30..130) and third (60..160)
    expect(bm.modsFor('a', 140)['atk%']).toBeCloseTo(0.1);
  });
  it('"active" targets apply to any attacker; other targets do not', () => {
    const bm = new BuffManager();
    bm.apply(spec({ target: 'active' }), 0);
    bm.apply(spec({ effectId: 'x', target: 'b', value: 0.5 }), 0);
    expect(bm.modsFor('a', 1, true)['atk%']).toBeCloseTo(0.1);
    expect(bm.modsFor('a', 1, false)['atk%']).toBeUndefined(); // off-field: "active" buffs do not apply
    expect(bm.modsFor('b', 1, true)['atk%']).toBeCloseTo(0.6);
  });
});

const hitAt = (frame: number, mv: number, talent: HitDef['talent']): HitDef => ({ frame, mv, scaling: 'atk', element: 'physical', talent });
const act = (talent: ActionDef['talent'], hits: HitDef[], cancel: number, cooldown?: number): ActionDef => ({ talent, hits, cancel: { default: cancel }, cooldown });
const mkChar = (id: string, extra: Partial<CharacterInput> = {}): CharacterInput => ({
  id, element: 'pyro', level: 90, base: { hp: 10000, atk: 1000, def: 500 }, weaponAtk: 0, baseMods: [], refinement: 1, talentLevels: [9, 9, 9], hookHits: {}, effects: [],
  actions: {
    n1: act('normal', [hitAt(10, 1, 'normal')], 20),
    n2: act('normal', [hitAt(8, 1, 'normal')], 30),
    skill: act('skill', [hitAt(15, 2, 'skill')], 40, 100),
  },
  ...extra,
});
const enemy: EnemyInput = { level: 90, res: {} };
// Lv90 vs Lv90, 5% crit rate, 50% crit dmg, 0 RES: 1000 × 190/380 × 1.025 = 512.5 per 1.0 MV
const PER_MV = 512.5;

describe('scheduler', () => {
  const rot = ['n1', 'n2', 'skill'].map((action) => ({ char: 'a', action }));
  const run = (profile: ExecutionProfile, cycles = 1) => simulate({ characters: [mkChar('a')], enemy, rotation: rot, cycles, profile });

  it('frame-perfect: each action starts at the previous cancel frame', () => {
    const r = run(EXECUTION_PROFILES.framePerfect);
    expect(r.actions.map((a) => a.start)).toEqual([0, 20, 50]);
    expect(r.hits.map((h) => h.frame)).toEqual([10, 28, 65]);
    expect(r.windowFrames).toBe(90);
    expect(r.windowDamage).toBeCloseTo(PER_MV * (1 + 1 + 2));
    expect(r.dps).toBeCloseTo((PER_MV * 4) / (90 / 60));
  });

  it('relaxed adds 18 frames after every action', () => {
    const r = run(EXECUTION_PROFILES.relaxed);
    expect(r.actions.map((a) => a.start)).toEqual([0, 38, 86]);
    expect(r.windowFrames).toBe(86 + 40 + 18);
  });

  it('simulateBoth reports the delay cost', () => {
    const { relaxed, framePerfect } = simulateBoth({ characters: [mkChar('a')], enemy, rotation: rot, cycles: 1 });
    expect(relaxed.dps).toBeLessThan(framePerfect.dps);
    expect(relaxed.windowDamage).toBeCloseTo(framePerfect.windowDamage);
  });

  it('swaps respect the 1 s swap cooldown', () => {
    const r = simulate({
      characters: [mkChar('a'), mkChar('b')], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'n1' }, { char: 'b', action: 'n1' }, { char: 'a', action: 'n1' }],
    });
    expect(r.actions.map((a) => a.start)).toEqual([0, 20, 80]);
  });

  it('waits for cooldowns and says so', () => {
    const r = simulate({
      characters: [mkChar('a')], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'skill' }, { char: 'a', action: 'skill' }],
    });
    expect(r.actions.map((a) => a.start)).toEqual([0, 100]);
    expect(r.assumptions.some((a) => a.includes('cooldown'))).toBe(true);
  });

  it('measures cycles 2..N only', () => {
    const one = run(EXECUTION_PROFILES.framePerfect, 1);
    const three = run(EXECUTION_PROFILES.framePerfect, 3);
    expect(three.actions.length).toBe(9);
    // Cycle 2 starts at 90; its skill waits for the 100-frame cooldown (ready at 150), so each steady cycle is 100 frames.
    expect(three.actions.filter((a) => a.action === 'skill').map((a) => a.start)).toEqual([50, 150, 250]);
    expect(three.windowFrames).toBe(200);
    expect(three.windowDamage).toBeCloseTo(one.windowDamage * 2);
    expect(three.dps).toBeCloseTo((PER_MV * 8) / (200 / 60));
  });
});

describe('effects in the simulation', () => {
  const buff = effect.parse({
    id: 'a.skill.bonus', trigger: { on: 'onSkill' }, target: 'self', stat: 'dmgBonus.all', value: 0.5, duration: 30,
  });

  it('applies triggered buffs at action start for their duration only', () => {
    const r = simulate({
      characters: [mkChar('a', { effects: [buff] })], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'skill' }, { char: 'a', action: 'n1' }],
    });
    expect(r.buffs).toHaveLength(1);
    expect(r.buffs[0]).toMatchObject({ start: 0, end: 30, value: 0.5 });
    const [skillHit, n1Hit] = r.hits;
    expect(skillHit!.damage).toBeCloseTo(PER_MV * 2 * 1.5); // hit at frame 15: buffed
    expect(n1Hit!.damage).toBeCloseTo(PER_MV); // hit at frame 50: expired
  });

  it('resolves refinement values and always-on effects; enemy shred stacks with base RES', () => {
    const passive = effect.parse({
      id: 'w.atk', trigger: { on: 'always' }, target: 'self', stat: 'atk%', value: { perRefinement: [0.1, 0.2, 0.3, 0.4, 0.5] },
    });
    const shred = effect.parse({
      id: 'a.shred', trigger: { on: 'always' }, target: 'enemy', stat: 'res.enemy.physical', value: -0.2,
    });
    const r = simulate({
      characters: [mkChar('a', { effects: [passive, shred], refinement: 5 })], enemy: { level: 90, res: { physical: 0.1 } },
      cycles: 1, profile: EXECUTION_PROFILES.framePerfect, rotation: [{ char: 'a', action: 'n1' }],
    });
    // atk 1000 × 1.5, RES 0.1 − 0.2 = −0.1 → ×1.05
    expect(r.hits[0]!.damage).toBeCloseTo(1500 * 0.5 * 1.025 * 1.05);
  });

  it('skips effects that need unimplemented hooks and reports them', () => {
    const hooked = effect.parse({ id: 'x.hook', trigger: { on: 'always' }, target: 'self', stat: 'atk%', value: 0.5, hook: 'x.hook' });
    const r = simulate({
      characters: [mkChar('a', { effects: [hooked] })], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'n1' }],
    });
    expect(r.buffs).toHaveLength(0);
    expect(r.assumptions[0]).toContain('hook "x.hook" not implemented');
  });

  it('errors on unknown actions', () => {
    expect(() =>
      simulate({ characters: [mkChar('a')], enemy, cycles: 1, profile: EXECUTION_PROFILES.relaxed, rotation: [{ char: 'a', action: 'burst' }] }),
    ).toThrow(/no action "burst"/);
  });
});

describe('dynamic scaling effects', () => {
  it('re-evaluates each hit: ER→ATK conversion follows a mid-rotation ER buff', () => {
    // ATK% = −0.28 + 0.28 × ER (ER is the multiplier, 1 + bonus), like a "% of ER over 100%" passive
    const conv = effect.parse({
      id: 'w.er-atk', trigger: { on: 'always' }, target: 'self', stat: 'atk%', value: 0,
      scaling: { from: 'self.er', ratio: { perRefinement: [0.28, 0.35, 0.42, 0.49, 0.56] }, base: { perRefinement: [-0.28, -0.35, -0.42, -0.49, -0.56] }, cap: 0.8 },
    });
    const erBuff = effect.parse({ id: 'a.er', trigger: { on: 'onSkill' }, target: 'self', stat: 'er', value: 0.3, duration: 200 });
    const r = simulate({
      characters: [mkChar('a', { effects: [conv, erBuff], baseMods: [{ stat: 'er', value: 0.5 }] })], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'n1' }, { char: 'a', action: 'skill' }, { char: 'a', action: 'n1' }],
    });
    const [before, , after] = r.hits;
    // before: ER 1.5 → ATK% 0.14; after the skill's +0.3 ER: ER 1.8 → 0.224
    expect(after!.damage / before!.damage).toBeCloseTo(1.224 / 1.14, 6);
  });

  it('scales off the owner base ATK for the whole team, and respects the cap', () => {
    const buff = effect.parse({
      id: 'b.burst', trigger: { on: 'always' }, target: 'team', stat: 'atk', value: 0,
      scaling: { from: 'self.baseAtk', ratio: 0.5, cap: 400 },
    });
    const b = mkChar('b', { weaponAtk: 500, effects: [buff] }); // base ATK 1500 → 750, capped to 400
    const r = simulate({
      characters: [mkChar('a'), b], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'n1' }],
    });
    expect(r.hits[0]!.damage).toBeCloseTo(PER_MV * 1.4); // atk 1000 + 400
  });

  it('snapshot: true freezes the value at application', () => {
    const conv = effect.parse({
      id: 'x', trigger: { on: 'always' }, target: 'self', stat: 'atk%', value: 0, snapshot: true,
      scaling: { from: 'self.er', ratio: 1, base: -1 },
    });
    const erBuff = effect.parse({ id: 'a.er', trigger: { on: 'onSkill' }, target: 'self', stat: 'er', value: 1, duration: 200 });
    const r = simulate({
      characters: [mkChar('a', { effects: [conv, erBuff], baseMods: [{ stat: 'er', value: 0.5 }] })], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect,
      rotation: [{ char: 'a', action: 'n1' }, { char: 'a', action: 'skill' }, { char: 'a', action: 'n1' }],
    });
    expect(r.hits[2]!.damage).toBeCloseTo(r.hits[0]!.damage); // still ATK% 0.5
  });
});

describe('rotation script features', () => {
  const buff = effect.parse({ id: 'a.window', trigger: { on: 'onSkill' }, target: 'self', stat: 'flatDmg.all', value: 0, duration: 100 });
  const chars = () => [mkChar('a', { effects: [buff] })];
  const run = (rotation: import('../src/engine').RotationItem[], cycles = 1) =>
    simulate({ characters: chars(), enemy, cycles, profile: EXECUTION_PROFILES.framePerfect, rotation });

  it('repeats a group a fixed number of times', () => {
    const r = run([{ char: 'a', action: 'skill' }, { repeat: { times: 3 }, steps: [{ char: 'a', action: 'n1' }] }]);
    expect(r.actions.filter((a) => a.action === 'n1')).toHaveLength(3);
  });

  it('repeats until a buff ends: stops at the first action that would start after the buff ended', () => {
    // skill at 0 (cancel 40) opens the window [0, 100); n1 starts at 40, 60, 80 — a start at 100 is too late
    const r = run([{ char: 'a', action: 'skill' }, { repeat: { untilBuffEnds: { effect: 'a.window', source: 'a' } }, steps: [{ char: 'a', action: 'n1' }] }]);
    expect(r.actions.filter((a) => a.action === 'n1').map((a) => a.start)).toEqual([40, 60, 80]);
  });

  it('clips inside a group: a two-step group is cut after its first step', () => {
    // window [0, 100): n1 at 40 (cancel 20), n2 at 60 (cancel 30), n1 at 90, n2 would start at 110 → stop
    const r = run([
      { char: 'a', action: 'skill' },
      { repeat: { untilBuffEnds: { effect: 'a.window', source: 'a' } }, steps: [{ char: 'a', action: 'n1' }, { char: 'a', action: 'n2' }] },
    ]);
    expect(r.actions.filter((a) => a.action !== 'skill').map((a) => `${a.action}@${a.start}`)).toEqual(['n1@40', 'n2@60', 'n1@90']);
  });

  it('does not repeat when the buff was never applied', () => {
    const r = run([{ repeat: { untilBuffEnds: { effect: 'a.window', source: 'a' } }, steps: [{ char: 'a', action: 'n1' }] }]);
    expect(r.actions).toHaveLength(0);
  });

  it('firstCycleOnly steps run in cycle 1 only', () => {
    const r = run([{ char: 'a', action: 'n1', firstCycleOnly: true }, { char: 'a', action: 'n2' }], 3);
    expect(r.actions.filter((a) => a.action === 'n1')).toHaveLength(1);
    expect(r.actions.filter((a) => a.action === 'n2')).toHaveLength(3);
  });
});

describe('Radiance: Stellar-Conduct hit form', () => {
  it('uses its own multiplier, ignores DEF and adds ATK-scaled base damage only inside a Polestar Field', () => {
    const marker = effect.parse({ id: 'm', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'stellar-conduct' });
    const stellarHit: HitDef = { frame: 5, mv: 1, scaling: 'atk', element: 'cryo', talent: 'skill', gauge: 1, stellar: { mv: 4, basePer100Atk: 0.007, baseMax: 0.14 } };
    const mk2 = (id: string, extra: Partial<CharacterInput> = {}) => mkChar(id, { effects: [marker], ...extra });
    const a = mk2('a', { actions: { skill: act('skill', [stellarHit], 20) } });
    const outside = simulate({ characters: [a], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect, rotation: [{ char: 'a', action: 'skill' }] });
    expect(outside.hits[0]!.damage).toBeCloseTo(PER_MV); // ordinary form
    // create a field first: a cryo aura on the enemy and an electro hit
    const zap = mkChar('z', { element: 'electro', actions: { skill: act('skill', [{ frame: 1, mv: 0, scaling: 'atk', element: 'electro', talent: 'skill', gauge: 1 }], 10) } });
    const inside = simulate({
      characters: [a, zap], enemy, cycles: 1, profile: EXECUTION_PROFILES.framePerfect, enemyAura: { element: 'cryo' },
      rotation: [{ char: 'z', action: 'skill' }, { char: 'a', action: 'skill' }],
    });
    const h = inside.hits.find((x) => x.char === 'a')!;
    // 4× multiplier, DEF ignored (×2), +7% base damage (1000 ATK), plus the Polestar buff: strictly above that floor
    expect(h.damage).toBeGreaterThan(PER_MV * 4 * 2 * 1.07);
    expect(h.reactions).toEqual([]);
  });
});
