import { describe, expect, it } from 'vitest';
import {
  EXECUTION_PROFILES, REACTIONS, ReactionEngine, simulate,
  type ActionDef, type CharacterInput, type Element, type FinalStats, type HitDef, type HitRecord, type ReactionHost,
} from '../src/engine';
import { effect } from '../src/schema';

const LB = 1446.8535; // Lv90 reaction base (KB kb/mechanics/reactions.json)

const mkChar = (id: string, over: Partial<CharacterInput> = {}): CharacterInput => ({
  id, element: 'pyro', level: 90, base: { hp: 10000, atk: 1000, def: 500 }, weaponAtk: 0, baseMods: [],
  refinement: 1, talentLevel: 9, effects: [], actions: {}, ...over,
});

interface Harness {
  engine: ReactionEngine;
  records: HitRecord[];
  buffs: Array<{ stat: string; value: number; frame: number }>;
  hit(char: CharacterInput, element: Element, frame: number, over?: Partial<HitDef> & { gauge?: number }): ReturnType<ReactionEngine['react']>;
  /** Run scheduled follow-ups up to and including `frame`. */
  runTo(frame: number): void;
}

function harness(opts: { em?: number; res?: number; lunar?: boolean; chars?: CharacterInput[]; stats?: Partial<FinalStats>; mods?: Record<string, number> } = {}): Harness {
  const queue: Array<{ frame: number; seq: number; run: () => void }> = [];
  let seq = 0;
  const records: HitRecord[] = [];
  const buffs: Harness['buffs'] = [];
  const stats: FinalStats = { hp: 10000, atk: 1000, def: 500, em: opts.em ?? 0, er: 1, critRate: 0.05, critDmg: 0.5, ...opts.stats };
  const host: ReactionHost = {
    characters: opts.chars ?? [],
    lunarCharged: opts.lunar ?? false,
    schedule: (frame, run) => { queue.push({ frame, seq: seq++, run }); },
    statsFor: () => ({ stats, mods: opts.mods ?? {} }),
    enemyRes: () => opts.res ?? 0,
    record: (h) => records.push(h),
    applyEnemyBuff: (_id, _src, stat, value, _dur, frame) => buffs.push({ stat, value, frame }),
    assume: () => undefined,
  };
  const engine = new ReactionEngine(host);
  return {
    engine, records, buffs,
    hit(char, element, frame, over = {}) {
      const hit: HitDef = { frame, mv: 1, scaling: 'atk', element, talent: 'skill', ...over };
      return engine.react({ frame, char, hit, gauge: over.gauge ?? 1, cycle: 1 });
    },
    runTo(frame) {
      for (;;) {
        queue.sort((a, b) => a.frame - b.frame || a.seq - b.seq);
        const next = queue[0];
        if (!next || next.frame > frame) return;
        queue.shift();
        next.run();
      }
    },
  };
}
const a = mkChar('a');

describe('aura application and decay', () => {
  it('applies 0.8 × gauge and decays over 60 × (7 + 2.5U) frames', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    expect(h.engine.auras.get('hydro', 0)).toBeCloseTo(0.8);
    expect(h.engine.auras.get('hydro', 285)).toBeCloseTo(0.4); // half of 570 frames
    expect(h.engine.auras.get('hydro', 570)).toBe(0);
  });
  it('2U aura lasts 60 × 12 frames', () => {
    const h = harness();
    h.hit(a, 'cryo', 0, { gauge: 2 });
    expect(h.engine.auras.get('cryo', 0)).toBeCloseTo(1.6);
    expect(h.engine.auras.get('cryo', 719)).toBeGreaterThan(0);
    expect(h.engine.auras.get('cryo', 720)).toBe(0);
  });
});

describe('amplifying reactions', () => {
  it('forward vaporize: 1.5×, consumes 0.5 aura per trigger unit, no leftover aura', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    const r = h.hit(a, 'pyro', 0);
    expect(r.reactionFactor).toBeCloseTo(1.5);
    expect(r.reactions).toEqual(['vaporize']);
    expect(h.engine.auras.get('hydro', 0)).toBeCloseTo(0.3);
    expect(h.engine.auras.get('pyro', 0)).toBe(0);
  });
  it('reverse vaporize: 2×, hydro leftover attaches', () => {
    const h = harness();
    h.hit(a, 'pyro', 0);
    const r = h.hit(a, 'hydro', 0);
    expect(r.reactionFactor).toBeCloseTo(2);
    expect(h.engine.auras.get('pyro', 0)).toBe(0);
    // pyro 0.8 consumed at factor 2 → 0.4 of the 1U hydro used; 0.6 left × 0.8 tax
    expect(h.engine.auras.get('hydro', 0)).toBeCloseTo(0.48);
  });
  it('melt: pyro on cryo 2×, cryo on pyro 1.5×', () => {
    const h1 = harness();
    h1.hit(a, 'cryo', 0);
    expect(h1.hit(a, 'pyro', 0).reactionFactor).toBeCloseTo(2);
    const h2 = harness();
    h2.hit(a, 'pyro', 0);
    expect(h2.hit(a, 'cryo', 0).reactionFactor).toBeCloseTo(1.5);
  });
  it('EM and reaction bonus enter the factor: 2.78 EM / (EM + 1400)', () => {
    const h = harness({ em: 200, mods: { 'reactionBonus.vaporize': 0.15 } });
    h.hit(a, 'hydro', 0);
    expect(h.hit(a, 'pyro', 0).reactionFactor).toBeCloseTo(1.5 * (1 + (2.78 * 200) / 1600 + 0.15));
  });
  it('a hit blocked from applying (gauge 0) does not react', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    const r = h.hit(a, 'pyro', 0, { gauge: 0 });
    expect(r.reactions).toEqual([]);
    expect(r.reactionFactor).toBe(1);
  });
  it('vaporize is rejected while Frozen', () => {
    const h = harness();
    h.hit(a, 'hydro', 0, { gauge: 2 });
    h.hit(a, 'cryo', 0);
    expect(h.engine.auras.get('frozen', 0)).toBeGreaterThan(0);
    expect(h.hit(a, 'pyro', 1).reactions).not.toContain('vaporize');
  });
});

describe('transformative reactions', () => {
  it('overloaded: 2.75 × level base × (1 + 16 EM/(2000+EM)) × RES', () => {
    const h = harness({ em: 100, res: 0.1 });
    h.hit(a, 'pyro', 0);
    h.hit(a, 'electro', 5);
    expect(h.records).toHaveLength(1);
    expect(h.records[0]).toMatchObject({ action: 'overloaded', element: 'pyro', talent: 'reaction' });
    expect(h.records[0]!.damage).toBeCloseTo(2.75 * LB * (1 + (16 * 100) / 2100) * 0.9);
  });
  it('has a 6-frame global cooldown', () => {
    const h = harness();
    h.hit(a, 'pyro', 0, { gauge: 4 });
    h.hit(a, 'electro', 10);
    h.hit(a, 'electro', 12);
    h.hit(a, 'electro', 20);
    expect(h.records.map((r) => r.frame)).toEqual([10, 20]);
  });
  it('superconduct: 1.5 cryo damage and −40% physical RES for 12 s', () => {
    const h = harness();
    h.hit(a, 'cryo', 0);
    h.hit(a, 'electro', 3);
    expect(h.records[0]!.damage).toBeCloseTo(1.5 * LB);
    expect(h.buffs).toEqual([{ stat: 'res.enemy.physical', value: -0.4, frame: 3 }]);
  });
  it('swirl: 0.6 × base in the swirled element, consumes half a unit per unit', () => {
    const h = harness();
    h.hit(a, 'pyro', 0);
    const r = h.hit(a, 'anemo', 0);
    expect(r.reactions).toEqual(['swirl']);
    expect(h.records[0]).toMatchObject({ element: 'pyro', action: 'swirl' });
    expect(h.records[0]!.damage).toBeCloseTo(0.6 * LB);
    expect(h.engine.auras.get('pyro', 0)).toBeCloseTo(0.3);
  });
  it('freeze then shatter: Frozen = 2 × consumed gauge; a blunt hit deals 3 × base physical', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    h.hit(a, 'cryo', 0);
    expect(h.engine.auras.get('frozen', 0)).toBeCloseTo(1.6); // 0.8 consumed from both, ×2
    const r = h.hit(a, 'physical', 30, { strike: 'blunt', gauge: 0 });
    expect(r.reactions).toEqual(['shatter']);
    expect(h.records[0]).toMatchObject({ action: 'shatter', element: 'physical' });
    expect(h.records[0]!.damage).toBeCloseTo(3 * LB);
    expect(h.engine.auras.get('frozen', 31)).toBe(0);
  });
  it('a non-blunt hit does not shatter', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    h.hit(a, 'cryo', 0);
    expect(h.hit(a, 'physical', 30, { gauge: 0 }).reactions).toEqual([]);
  });
});

describe('electro-charged', () => {
  it('hits at +10, then every 60 frames, wanes 0.4U per hit and ends when an aura runs out', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    h.hit(a, 'electro', 5);
    h.runTo(1000);
    expect(h.records.map((r) => r.frame)).toEqual([15, 75]);
    for (const r of h.records) expect(r.damage).toBeCloseTo(2 * LB);
  });
});

describe('quicken family', () => {
  it('quicken takes the consumed gauge; aggravate adds 1.15 × base × (1 + 5EM/(1200+EM))', () => {
    const h = harness({ em: 100 });
    h.hit(a, 'electro', 0);
    const q = h.hit(a, 'dendro', 0);
    expect(q.reactions).toEqual(['quicken']);
    expect(h.engine.auras.get('quicken', 0)).toBeCloseTo(0.8);
    const g = h.hit(a, 'electro', 10);
    expect(g.reactions).toContain('aggravate'); // leftover 0.2U dendro from the quicken trigger may quicken again
    expect(g.catalyzeFlat).toBeCloseTo(1.15 * LB * (1 + (5 * 100) / 1300));
    const s = h.hit(a, 'dendro', 20);
    expect(s.reactions).toContain('spread');
    expect(s.catalyzeFlat).toBeCloseTo(1.25 * LB * (1 + (5 * 100) / 1300));
  });
});

describe('bloom family', () => {
  it('bloom core explodes as 2 × base dendro after 330 frames', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    expect(h.hit(a, 'dendro', 0).reactions).toEqual(['bloom']);
    h.runTo(329);
    expect(h.records).toHaveLength(0);
    h.runTo(330);
    expect(h.records[0]).toMatchObject({ action: 'bloom', element: 'dendro', frame: 330 });
    expect(h.records[0]!.damage).toBeCloseTo(2 * LB);
  });
  it('hyperbloom consumes the core (3×) so it no longer explodes', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    h.hit(a, 'dendro', 0);
    const r = h.hit(a, 'electro', 100);
    expect(r.reactions).toContain('hyperbloom');
    expect(h.records).toHaveLength(1);
    expect(h.records[0]!.damage).toBeCloseTo(3 * LB);
    h.runTo(1000);
    expect(h.records).toHaveLength(1);
  });
  it('burgeon: pyro on a core deals 3 × base dendro', () => {
    const h = harness();
    h.hit(a, 'hydro', 0);
    h.hit(a, 'dendro', 0);
    expect(h.hit(a, 'pyro', 100).reactions).toContain('burgeon');
    expect(h.records[0]).toMatchObject({ action: 'burgeon', element: 'dendro' });
    expect(h.records[0]!.damage).toBeCloseTo(3 * LB);
  });
});

describe('burning', () => {
  it('ticks 0.25 × base every 15 frames while Pyro and Dendro coexist', () => {
    const h = harness();
    h.hit(a, 'pyro', 0, { gauge: 2 });
    h.hit(a, 'dendro', 0, { gauge: 2 });
    h.runTo(60);
    expect(h.records.map((r) => r.frame)).toEqual([15, 30, 45, 60]);
    expect(h.records[0]!.damage).toBeCloseTo(0.25 * LB);
  });
});

describe('lunar-charged', () => {
  it('replaces electro-charged; cloud ticks every 120 frames for 330 frames with contributor weights', () => {
    const b = mkChar('b');
    const h = harness({ lunar: true, chars: [a, b], em: 0 });
    h.hit(a, 'hydro', 0, { gauge: 2 });
    h.hit(b, 'electro', 5, { gauge: 2 });
    h.runTo(2000);
    expect(h.records.every((r) => r.action === 'lunarCharged')).toBe(true);
    expect(h.records.map((r) => r.frame)).toEqual([14, 134, 254]);
    // two identical contributors: (0.6 + 0.3) × 3 × base × crit EV
    expect(h.records[0]!.damage).toBeCloseTo(0.9 * 3 * LB * 1.025);
  });
  it('does not exist without the flag (falls back to electro-charged)', () => {
    const h = harness({ lunar: false });
    h.hit(a, 'hydro', 0);
    h.hit(a, 'electro', 5);
    h.runTo(100);
    expect(h.records.every((r) => r.action === 'electroCharged')).toBe(true);
  });
});

describe('KB mechanics', () => {
  it('lists unimplemented reactions explicitly', () => {
    const missing = Object.entries(REACTIONS.reactions).filter(([, r]) => !r.implemented).map(([k]) => k).sort();
    expect(missing).toEqual(['crystallize', 'lunarBloom', 'lunarCrystallize', 'stellarConduct', 'stellarSwirl']);
  });
});

// ---- full simulation: ICD, energy ----

const hitAt = (frame: number, element: Element, talent: HitDef['talent'] = 'skill'): HitDef => ({ frame, mv: 1, scaling: 'atk', element, talent });
const act = (talent: ActionDef['talent'], hits: HitDef[], cancel: number, extra: Partial<ActionDef> = {}): ActionDef => ({ talent, hits, cancel: { default: cancel }, ...extra });
const enemy = { level: 90, res: {} };
const fp = EXECUTION_PROFILES.framePerfect;

describe('ICD in a full simulation', () => {
  it('standard ICD applies on hits 1, 4, 7...', () => {
    const hydro = mkChar('hydro', { element: 'hydro', actions: { skill: act('skill', [hitAt(0, 'hydro')], 20) } });
    const pyro = mkChar('pyro', { actions: { skill: act('skill', [hitAt(0, 'pyro'), hitAt(10, 'pyro'), hitAt(20, 'pyro'), hitAt(30, 'pyro')], 40) } });
    const r = simulate({
      characters: [hydro, pyro], enemy, cycles: 1, profile: fp, startEnergy: 'empty',
      rotation: [{ char: 'hydro', action: 'skill' }, { char: 'pyro', action: 'skill' }],
    });
    const pyroHits = r.hits.filter((h) => h.char === 'pyro');
    expect(pyroHits.map((h) => h.reactions)).toEqual([['vaporize'], [], [], ['vaporize']]);
    expect(pyroHits[0]!.damage).toBeGreaterThan(pyroHits[1]!.damage * 1.4);
  });
});

describe('energy', () => {
  const burstChar = (over: Partial<CharacterInput> = {}) =>
    mkChar('a', {
      actions: {
        skill: act('skill', [hitAt(10, 'pyro')], 30, { particles: { count: 3, perHit: false, icd: 0, delay: 20, element: 'pyro' } }),
        burst: act('burst', [hitAt(5, 'pyro', 'burst')], 30, { energyCost: 60 }),
      },
      ...over,
    });
  const rot = [{ char: 'a', action: 'skill' }, { char: 'a', action: 'burst' }];

  it('bursts without enough energy are flagged', () => {
    const r = simulate({ characters: [burstChar()], enemy, cycles: 1, profile: fp, startEnergy: 'empty', rotation: rot });
    expect(r.assumptions.some((x) => x.includes('insufficient energy (9.0/60)'))).toBe(true);
    expect(r.energy.a!.shortfalls).toBe(1);
  });

  it('starting full satisfies the first burst', () => {
    const r = simulate({ characters: [burstChar()], enemy, cycles: 1, profile: fp, startEnergy: 'full', rotation: rot });
    expect(r.assumptions.filter((x) => x.includes('insufficient'))).toEqual([]);
  });

  it('reports the ER needed: 3 same-element particles = 9 energy per cycle', () => {
    const r = simulate({ characters: [burstChar()], enemy, cycles: 3, profile: fp, startEnergy: 'full', rotation: rot });
    expect(r.energy.a!.particleEnergyBase).toBeCloseTo(9);
    expect(r.energy.a!.requiredEr).toBeCloseTo(60 / 9);
  });

  it('flat energy effects reduce the ER requirement', () => {
    const flat = effect.parse({ id: 'a.flat', trigger: { on: 'onSkill' }, target: 'self', stat: 'energyGain', value: 15 });
    const r = simulate({ characters: [burstChar({ effects: [flat] })], enemy, cycles: 3, profile: fp, startEnergy: 'full', rotation: rot });
    expect(r.energy.a!.flatEnergy).toBeCloseTo(15);
    expect(r.energy.a!.requiredEr).toBeCloseTo((60 - 15) / 9);
  });

  it('ER multiplies actual energy; off-field characters get 1 − 0.1 × party size (2 here)', () => {
    const b = mkChar('b', {
      element: 'pyro', baseMods: [{ stat: 'er', value: 0.5 }],
      actions: { burst: act('burst', [hitAt(5, 'pyro', 'burst')], 30, { energyCost: 80 }), n1: act('normal', [hitAt(5, 'physical', 'normal')], 20) },
    });
    const r = simulate({
      characters: [burstChar(), b], enemy, cycles: 2, profile: fp, startEnergy: 'full',
      rotation: [{ char: 'a', action: 'skill' }, { char: 'a', action: 'burst' }, { char: 'b', action: 'burst' }],
    });
    // 3 same-element particles land while 'a' is on the field, so b (off-field, party of 2) gets ×0.8.
    const base = r.energy.b!.particleEnergyBase;
    expect(base).toBeCloseTo(3 * 3 * 0.8);
    expect(r.energy.b!.gainedPerCycle).toBeCloseTo(base * 1.5);
  });
});
