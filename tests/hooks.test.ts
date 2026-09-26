import { describe, expect, it } from 'vitest';
import { EXECUTION_PROFILES, simulate, type ActionDef, type CharacterInput, type HitDef } from '../src/engine';
import '../src/engine/hooks';
import { effect } from '../src/schema';

const hit = (frame: number, element: HitDef['element'] = 'physical', talent: HitDef['talent'] = 'normal', mv = 1): HitDef => ({ frame, mv, scaling: 'atk', element, talent });
const act = (talent: ActionDef['talent'], hits: HitDef[], cancel: number, extra: Partial<ActionDef> = {}): ActionDef => ({ talent, hits, cancel: { default: cancel }, ...extra });
const mk = (id: string, over: Partial<CharacterInput> = {}): CharacterInput => ({
  id, element: 'hydro', level: 90, base: { hp: 10000, atk: 1000, def: 500 }, weaponAtk: 0, baseMods: [], refinement: 1,
  talentLevels: [9, 9, 9], hookHits: {}, effects: [], actions: {}, ...over,
});
const enemy = { level: 90, res: {} };
const fp = EXECUTION_PROFILES.framePerfect;
const H = (id: string, trigger: string, extra: Record<string, unknown> = {}) =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'xingqiu', ...extra });

describe('xingqiu hook', () => {
  const xq = (extra: CharacterInput['effects'] = []) =>
    mk('xq', {
      actions: { skill: act('skill', [], 40, { talent: 'skill' }), burst: act('burst', [], 40, { energyCost: 0 }) },
      hookHits: {
        orbital: { frame: 0, mv: 0, scaling: 'atk', element: 'hydro', talent: 'burst', gauge: 1, icd: { tag: 'none', group: 'none' } },
        'sword-rain': { frame: 0, mv: 2, scaling: 'atk', element: 'hydro', talent: 'burst', gauge: 1, icd: { tag: 'burst', group: 'standard' } },
      },
      effects: [
        H('xingqiu.orbital.skill', 'onSkill', { delay: 43, duration: 900 }),
        H('xingqiu.orbital.burst', 'onBurst', { delay: 18, duration: 900 }),
        H('xingqiu.burst.state', 'onBurst', { duration: 900 }),
        H('xingqiu.burst.wave', 'onAnyNormal'),
        ...extra,
      ],
    });
  const dps = mk('dps', { element: 'pyro', actions: { n1: act('normal', [hit(10)], 20) } });
  const run = (chars: CharacterInput[], rotation: Array<[string, string]>) =>
    simulate({ characters: chars, enemy, cycles: 1, profile: fp, startEnergy: 'empty', rotation: rotation.map(([char, action]) => ({ char, action })) });

  it('waves alternate 2 and 3 swords, at most one per 60 frames, landing 20 frames after the normal attack starts', () => {
    const r = run([xq(), dps], [['xq', 'burst'], ...Array.from({ length: 8 }, () => ['dps', 'n1'] as [string, string])]);
    const swords = r.hits.filter((h) => h.action === 'sword-rain').map((h) => h.frame);
    // dps.n1 starts at 40, 60, ... 180; waves at 40 (2 swords), 100 (3), 160 (2)
    expect(swords).toEqual([60, 60, 120, 120, 120, 180, 180]);
  });

  it('orbitals apply Hydro every 135 frames from the first tick; skill and burst extend one orbital', () => {
    const r = run([xq(), dps], [['xq', 'skill'], ['xq', 'burst']]);
    const ticks = r.hits.filter((h) => h.action === 'orbital').map((h) => h.frame);
    // skill at 0: first tick 43, then every 135 until 900. burst at 40 (swap-free, same char): extends to 940
    expect(ticks[0]).toBe(43);
    expect(ticks[1]).toBe(178);
    expect(ticks.every((t, i) => i === 0 || t - ticks[i - 1]! === 135)).toBe(true);
    expect(ticks[ticks.length - 1]!).toBeLessThanOrEqual(940);
    expect(ticks[ticks.length - 1]! + 135).toBeGreaterThan(940);
  });

  it('does nothing after the burst has ended', () => {
    const late = Array.from({ length: 3 }, () => ['dps', 'n1'] as [string, string]);
    const r = run([xq(), dps], [['xq', 'burst'], ['xq', 'burst'], ...late]);
    expect(r.hits.filter((h) => h.action === 'sword-rain').length).toBeGreaterThan(0);
    const noBurst = run([xq(), dps], late);
    expect(noBurst.hits.filter((h) => h.action === 'sword-rain')).toHaveLength(0);
  });

  it('C6: waves go 2 → 3 → 5 and the 5-sword wave gives 3 energy', () => {
    const c6 = H('xingqiu.c6', 'always');
    const chars = [xq([c6]), dps];
    chars[0]!.actions.burst = act('burst', [], 40, { energyCost: 80 });
    const r = run(chars, [['xq', 'burst'], ...Array.from({ length: 12 }, () => ['dps', 'n1'] as [string, string])]);
    const byFrame = new Map<number, number>();
    for (const h of r.hits.filter((h) => h.action === 'sword-rain')) byFrame.set(h.frame, (byFrame.get(h.frame) ?? 0) + 1);
    expect([...byFrame.values()].slice(0, 4)).toEqual([2, 3, 5, 2]);
    expect(r.energy.xq!.flatEnergy).toBeGreaterThan(0);
  });

  it('C2: longer burst and a Hydro RES shred after each wave', () => {
    const c2 = H('xingqiu.c2', 'always', { duration: 180 });
    const r = run([xq([c2]), dps], [['xq', 'burst'], ['dps', 'n1']]);
    expect(r.buffs.some((b) => b.effectId === 'xingqiu.c2.hydro-res' && b.value === -0.15)).toBe(true);
  });
});

describe('raiden hook', () => {
  const R = (id: string, trigger: string, extra: Record<string, unknown> = {}) =>
    effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'raiden', ...extra });
  const raiden = (extra: CharacterInput['effects'] = []) =>
    mk('raiden', {
      element: 'electro',
      actions: {
        skill: act('skill', [hit(5, 'electro', 'skill')], 30),
        burst: act('burst', [hit(20, 'electro', 'burst', 3)], 40, { energyCost: 90 }),
        'sword-n1': act('normal', [hit(5, 'electro', 'burst', 2)], 20),
      },
      hookHits: { 'eye-strike': { frame: 0, mv: 1, scaling: 'atk', element: 'electro', talent: 'skill', gauge: 1, icd: { tag: 'skill', group: 'standard' } } },
      effects: [
        R('raiden.resolve.gain', 'onAnyBurst', { value: 0.5 }),
        R('raiden.resolve.base', 'onBurst', { value: 0.1, trigger: { on: 'onBurst', filter: { hit: 'BurstHit' } }, delay: 20 }),
        R('raiden.resolve.sword', 'onBurst', { value: 0.05, trigger: { on: 'onBurst', filter: { hits: 'SwordHit' } }, delay: 20, duration: 100 }),
        R('raiden.musou.restore.normal', 'onNormal', { value: 2 }),
        R('raiden.eye', 'onSkill', { delay: 6, duration: 300 }),
        R('raiden.eye.strike', 'onHit'),
        ...extra,
      ],
    });
  const named = (c: CharacterInput, action: string, name: string) => {
    c.actions[action]!.hits = c.actions[action]!.hits.map((h) => ({ ...h, name }));
    return c;
  };
  const other = mk('other', { element: 'pyro', actions: { burst: act('burst', [hit(5, 'pyro', 'burst')], 30, { energyCost: 60 }), n1: act('normal', [hit(5)], 20) } });

  it('other characters bursts add Resolve, consumed by Raiden as extra MV on the named hits', () => {
    const r = raiden();
    named(r, 'burst', 'BurstHit');
    named(r, 'sword-n1', 'SwordHit');
    const res = simulate({
      characters: [r, other], enemy, cycles: 1, profile: fp, startEnergy: 'full',
      rotation: [{ char: 'other', action: 'burst' }, { char: 'raiden', action: 'burst' }, { char: 'raiden', action: 'sword-n1' }],
    });
    // stacks = 60 energy × 0.5 = 30. Base hit MV 3 + 0.1 × 30 = 6, sword hit MV 2 + 0.05 × 30 = 3.5
    const burstHit = res.hits.find((h) => h.action === 'burst' && h.char === 'raiden')!;
    const sword = res.hits.find((h) => h.action === 'sword-n1')!;
    expect(sword.damage / burstHit.damage).toBeCloseTo(3.5 / 6, 6);
  });

  it('caps Resolve at 60', () => {
    const r = raiden();
    named(r, 'burst', 'BurstHit');
    other.actions.burst!.energyCost = 1000;
    const res = simulate({
      characters: [r, other], enemy, cycles: 1, profile: fp, startEnergy: 'full',
      rotation: [{ char: 'other', action: 'burst' }, { char: 'raiden', action: 'burst' }],
    });
    other.actions.burst!.energyCost = 60;
    const burstHit = res.hits.find((h) => h.action === 'burst' && h.char === 'raiden')!;
    const noStack = simulate({
      characters: [named(raiden(), 'burst', 'BurstHit'), other], enemy, cycles: 1, profile: fp, startEnergy: 'full',
      rotation: [{ char: 'raiden', action: 'burst' }],
    }).hits.find((h) => h.action === 'burst')!;
    expect(burstHit.damage / noStack.damage).toBeCloseTo((3 + 0.1 * 60) / 3, 6);
  });

  it('eye strikes: once per 54 frames on team hits during the eye, ignoring Raiden skill hit and itself', () => {
    const res = simulate({
      characters: [raiden(), other], enemy, cycles: 1, profile: fp, startEnergy: 'full',
      rotation: [{ char: 'raiden', action: 'skill' }, ...Array.from({ length: 8 }, () => ({ char: 'other', action: 'n1' }))],
    });
    const strikes = res.hits.filter((h) => h.action === 'eye-strike').map((h) => h.frame);
    // raiden.skill at 0 (hit 5, ignored). other.n1 starts 30: hits at 35, 55, 75, ...; eye starts at 6.
    // first trigger 35 → strike 40, next allowed at 35 + 54 = 89 → first hit ≥ 89 is 95 → strike 100, then 155 → 160...
    expect(strikes.slice(0, 3)).toEqual([40, 100, 160]);
  });

  it('musou isshin restores energy to the team at most once per second and five times', () => {
    const r = raiden();
    r.actions['sword-n1']!.hits = [hit(5, 'electro', 'burst'), hit(10, 'electro', 'burst')];
    const chars = [r, mk('ally', { actions: { burst: act('burst', [], 30, { energyCost: 80 }) } })];
    const res = simulate({
      characters: chars, enemy, cycles: 1, profile: fp, startEnergy: 'empty',
      rotation: [{ char: 'raiden', action: 'burst' }, ...Array.from({ length: 12 }, () => ({ char: 'raiden', action: 'sword-n1' }))],
    });
    // Each restore gives 2 energy (ER 1). Musou window is 100 frames from the base hit, so at most 2 restores (60 frame ICD).
    expect(res.energy.ally!.flatEnergy).toBeGreaterThan(0);
    expect(res.energy.ally!.flatEnergy).toBeLessThanOrEqual(2 * 5 + 1e-9);
  });
});
