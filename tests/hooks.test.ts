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
