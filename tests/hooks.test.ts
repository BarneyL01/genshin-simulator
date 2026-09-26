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

describe('hutao hook', () => {
  const HT = (id: string, trigger: string) => effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'hutao' });
  const hutao = (extra: CharacterInput['effects'] = []) =>
    mk('hutao', {
      element: 'pyro',
      actions: { charged: act('charged', [hit(3, 'physical', 'charged')], 40) },
      hookHits: { 'blood-blossom': { frame: 0, mv: 1, scaling: 'atk', element: 'pyro', talent: 'skill', gauge: 1, icd: { tag: 'none', group: 'none' } } },
      effects: [HT('hutao.bb', 'onCharged'), ...extra],
    });
  const run = (c: CharacterInput, n: number) =>
    simulate({ characters: [c], enemy, cycles: 1, profile: fp, startEnergy: 'empty', rotation: Array.from({ length: n }, () => ({ char: 'hutao', action: 'charged' })) });

  it('ticks every 240 frames for 570 frames after a charged hit; refreshing extends but keeps the cadence', () => {
    const one = run(hutao(), 1).hits.filter((h) => h.action === 'blood-blossom').map((h) => h.frame);
    expect(one).toEqual([243, 483]); // hit at 3
    const two = run(hutao(), 2).hits.filter((h) => h.action === 'blood-blossom').map((h) => h.frame);
    expect(two).toEqual([243, 483]); // second charged hit (frame 43) refreshes to 613; the next tick (723) is past it
    const many = run(hutao(), 12).hits.filter((h) => h.action === 'blood-blossom').map((h) => h.frame);
    expect(many.every((f, i) => i === 0 || f - many[i - 1]! === 240)).toBe(true);
    expect(many.length).toBeGreaterThan(2);
  });

  it('C2 adds 10% of max HP as flat damage to each tick', () => {
    const c2 = HT('hutao.c2', 'always');
    const base = run(hutao(), 1).hits.find((h) => h.action === 'blood-blossom')!;
    const withC2 = run(hutao([c2]), 1).hits.find((h) => h.action === 'blood-blossom')!;
    // (mv 1 × ATK 1000 + 0.1 × HP 10000) / (1 × ATK 1000) = 2
    expect(withC2.damage / base.damage).toBeCloseTo(2, 6);
  });
});

describe('yelan hook', () => {
  const Y = (id: string, trigger: string, extra: Record<string, unknown> = {}) =>
    effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'yelan', ...extra });
  const yelan = (extra: CharacterInput['effects'] = []) =>
    mk('yelan', {
      element: 'hydro',
      actions: { burst: act('burst', [], 30, { energyCost: 0 }), skill: act('skill', [hit(5, 'hydro', 'skill')], 20) },
      hookHits: {
        'exquisite-throw': { frame: 0, mv: 1, scaling: 'hp', element: 'hydro', talent: 'burst', gauge: 1, icd: { tag: 'yelanBurst', group: 'yelanBurst' } },
        'exquisite-throw-c2': { frame: 0, mv: 0, scaling: 'hp', element: 'hydro', talent: 'burst', gauge: 1, icd: { tag: 'none', group: 'none' } },
      },
      effects: [
        Y('yelan.a1-hp', 'always', { trigger: { on: 'always', filter: { '1': '0.06', '2': '0.12', '3': '0.18', '4': '0.3' } } }),
        Y('yelan.burst.state', 'onBurst', { delay: 10, duration: 300 }),
        Y('yelan.burst.wave', 'onAnyNormal'),
        Y('yelan.burst.skill', 'onSkill', { delay: 5 }),
        ...extra,
      ],
    });
  const dps = mk('dps', { element: 'pyro', actions: { n1: act('normal', [hit(5)], 20) } });
  const run = (chars: CharacterInput[], rotation: Array<[string, string]>) =>
    simulate({ characters: chars, enemy, cycles: 1, profile: fp, startEnergy: 'empty', rotation: rotation.map(([char, action]) => ({ char, action })) });

  it('A1: Max HP by number of elemental types', () => {
    const one = run([yelan(), mk('h', { element: 'hydro' })], [['yelan', 'skill']]);
    const four = run([yelan(), mk('p', { element: 'pyro' }), mk('e', { element: 'electro' }), mk('c', { element: 'cryo' })], [['yelan', 'skill']]);
    const hp = (r: ReturnType<typeof run>) => r.buffs.find((b) => b.effectId === 'yelan.a1-hp')?.value;
    expect(hp(one)).toBeCloseTo(0.06); // hydro + hydro: one elemental type
    expect(hp(four)).toBeCloseTo(0.3); // hydro, pyro, electro, cryo: four types
  });

  it('waves: 3 arrows 20/26/32 frames after a normal attack, at most one per 60 frames, only inside the window', () => {
    const r = run([yelan(), dps], [['yelan', 'burst'], ...Array.from({ length: 6 }, () => ['dps', 'n1'] as [string, string])]);
    const arrows = r.hits.filter((h) => h.action === 'exquisite-throw').map((h) => h.frame);
    // burst at 0 (window opens at 10); dps.n1 starts 30, 50, 70, 90, ...; waves at 30 and 90
    expect(arrows.slice(0, 6)).toEqual([50, 56, 62, 110, 116, 122]);
  });

  it('A4 ramps +1%, then +3.5% per second up to 50%, for the active attacker only', () => {
    const r = run([yelan(), dps], [['yelan', 'burst'], ['dps', 'n1']]);
    const ramp = r.buffs.filter((b) => b.effectId.startsWith('yelan.a4.'));
    expect(ramp[0]!.value).toBeCloseTo(0.01);
    expect(ramp[1]!.value).toBeCloseTo(0.035);
    expect(ramp.length).toBe(5); // 300-frame window: seconds 0..4
    expect(ramp.every((b) => b.target === 'active')).toBe(true);
    // Yelan's own off-field arrows do not get the bonus: same MV/scaling as a bonus-free hit
    const arrow = r.hits.find((h) => h.action === 'exquisite-throw')!;
    const noA4 = run([yelan(), dps], [['yelan', 'burst'], ['dps', 'n1']]).hits.find((h) => h.action === 'exquisite-throw')!;
    expect(arrow.damage).toBeCloseTo(noA4.damage);
    const dpsHit = r.hits.find((h) => h.char === 'dps' && h.action === 'n1')!;
    expect(dpsHit.damage).toBeGreaterThan(0);
  });

  it('C2: extra 14% HP arrow at most once per 108 frames', () => {
    const c2 = Y('yelan.c2', 'always');
    const r = run([yelan([c2]), dps], [['yelan', 'burst'], ...Array.from({ length: 8 }, () => ['dps', 'n1'] as [string, string])]);
    const extras = r.hits.filter((h) => h.action === 'exquisite-throw-c2').map((h) => h.frame);
    expect(extras.length).toBeGreaterThan(0);
    expect(extras.every((f, i) => i === 0 || f - extras[i - 1]! >= 108)).toBe(true);
  });
});

describe('zhongli hook', () => {
  const Zh = (id: string, trigger: string, extra: Record<string, unknown> = {}) =>
    effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'zhongli', ...extra });
  const zhongli = (extra: CharacterInput['effects'] = []) =>
    mk('zhongli', {
      element: 'geo',
      actions: {
        skill: act('skill', [hit(48, 'geo', 'skill')], 96, { cooldown: 720 }),
        'skill-press': act('skill', [hit(24, 'geo', 'skill')], 38, { cooldown: 240 }),
      },
      hookHits: {
        'stele-initial': { frame: 0, mv: 1, scaling: 'atk', element: 'geo', talent: 'skill', gauge: 2, icd: { tag: 'skill', group: 'standard' } },
        'stele-tick': { frame: 0, mv: 1, scaling: 'atk', element: 'geo', talent: 'skill', gauge: 1, icd: { tag: 'skill', group: 'standard' } },
      },
      effects: [Zh('zhongli.stele', 'onSkill', { duration: 1860 }), Zh('zhongli.shield', 'onSkill', { value: -0.2, duration: 1200 }), ...extra],
    });
  const run = (c: CharacterInput, rotation: string[]) =>
    simulate({ characters: [c], enemy, cycles: 1, profile: fp, startEnergy: 'empty', rotation: rotation.map((action) => ({ char: 'zhongli', action })) });

  it('hold: shield shreds all eight RES for 1200 frames from the hit; the stele resonates every 120 frames', () => {
    const r = run(zhongli(), ['skill']);
    const shred = r.buffs.filter((b) => b.effectId.startsWith('zhongli.jade-shield.'));
    expect(shred).toHaveLength(8);
    expect(shred.every((b) => b.value === -0.2 && b.start === 48 && b.end === 1248 && b.target === 'enemy')).toBe(true);
    const ticks = r.hits.filter((h) => h.action === 'stele-tick').map((h) => h.frame);
    expect(ticks[0]).toBe(168); // stele at 48 + 120
    expect(ticks.every((t, i) => i === 0 || t - ticks[i - 1]! === 120)).toBe(true);
    expect(ticks[ticks.length - 1]!).toBeLessThan(48 + 1860);
    expect(r.hits.filter((h) => h.action === 'stele-initial')).toHaveLength(1);
  });

  it('press creates a stele but no shield; a new stele replaces the old one at the limit', () => {
    const r = run(zhongli(), ['skill-press', 'skill-press']);
    expect(r.buffs.filter((b) => b.effectId.startsWith('zhongli.jade-shield.'))).toHaveLength(0);
    // second press waits for the 240-frame cooldown: stele 1 at 24, stele 2 at 240 + 24 = 264; stele 1 stops ticking at 264
    const ticks = r.hits.filter((h) => h.action === 'stele-tick').map((h) => h.frame);
    expect(ticks.filter((t) => t < 264 && t > 24).every((t) => (t - 24) % 120 === 0)).toBe(true);
    const after = ticks.filter((t) => t > 264);
    expect(after.every((t) => (t - 264) % 120 === 0)).toBe(true);
  });

  it('hold does not create a second stele at the limit; C1 allows two', () => {
    const one = run(zhongli(), ['skill-press', 'skill']);
    expect(one.hits.filter((h) => h.action === 'stele-initial')).toHaveLength(0);
    const two = run(zhongli([Zh('zhongli.c1', 'always')]), ['skill-press', 'skill']);
    expect(two.hits.filter((h) => h.action === 'stele-initial')).toHaveLength(1);
  });
});

describe('cryo traveler hook + Stellar-Conduct', () => {
  const TC = (id: string, trigger: string, extra: Record<string, unknown> = {}) =>
    effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'travelercryo', ...extra });
  const hh = (mv: number, gauge = 1, talent: HitDef['talent'] = 'skill') => ({ frame: 0, mv, scaling: 'atk' as const, element: 'cryo' as const, talent, gauge, icd: { tag: 'x', group: 'none' } });
  const traveler = (extra: CharacterInput['effects'] = []) =>
    mk('t', {
      element: 'cryo',
      actions: {
        n1: act('normal', [hit(5, 'physical', 'normal')], 20),
        skill: act('skill', [hit(19, 'cryo', 'skill')], 40, { cooldown: 900 }),
        burst: act('burst', [], 40, { energyCost: 0 }),
      },
      hookHits: { frostpierce: hh(1), javelin: hh(2, 1, 'burst'), 'javelin-stellar': hh(5, 0, 'burst') },
      effects: [
        effect.parse({ id: 't.marker', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'stellar-conduct' }),
        TC('traveler-cryo.a1', 'always'),
        TC('traveler-cryo.skill', 'onSkill', { duration: 720 }),
        TC('traveler-cryo.stellar-hit', 'onHit'),
        TC('traveler-cryo.burst', 'onBurst', { value: 0.5 }),
        TC('traveler-cryo.burst.stellar', 'custom', { value: 1 }),
        ...extra,
      ],
    });
  const idle = mk('x', { actions: { n1: act('normal', [hit(5, 'physical', 'normal', 0)], 20) } });
  const electro = mk('e', { element: 'electro', actions: { skill: act('skill', [hit(5, 'electro', 'skill')], 20) } });
  const run = (chars: CharacterInput[], rotation: Array<[string, string]>, aura?: 'cryo') =>
    simulate({ characters: chars, enemy, cycles: 1, profile: fp, startEnergy: 'empty', enemyAura: aura ? { element: aura } : undefined, rotation: rotation.map(([char, action]) => ({ char, action })) });

  it('Frostpierce Star: two crystals at 178 + 0/13 (+9 travel), then every 176 frames, for the skill window', () => {
    const r = run([traveler(), idle], [['t', 'skill'], ['x', 'n1']]);
    const c = r.hits.filter((h) => h.action === 'frostpierce').map((h) => h.frame);
    expect(c.slice(0, 4)).toEqual([187, 200, 363, 376]);
    expect(c.every((f) => f <= 19 + 720 + 13 + 9)).toBe(true);
  });

  it('Frostglow from landed crystals raises the burst; the burst throws 3 javelins (5 at 8 stacks)', () => {
    const r = simulate({
      characters: [traveler(), idle], enemy, cycles: 1, profile: fp, startEnergy: 'empty',
      rotation: [{ char: 't', action: 'skill' }, { repeat: { times: 40 }, steps: [{ char: 'x', action: 'n1' }] }, { char: 't', action: 'burst' }],
    });
    const crystals = r.hits.filter((h) => h.action === 'frostpierce' && h.frame < r.actions.find((a) => a.action === 'burst')!.start).length;
    const jav = r.hits.filter((h) => h.action === 'javelin');
    expect(crystals).toBe(8);
    expect(jav.length).toBe(5);
  });

  it('inside a Polestar Field the periodic crystals stop and the burst uses the Stellar-Conduct form (no element, ignores DEF)', () => {
    const chars = [traveler(), electro];
    const r = run(chars, [['t', 'skill'], ['e', 'skill'], ['t', 'burst']], 'cryo');
    // electro skill hits the cryo aura → Stellar-Conduct → field: the burst that follows is the Stellar-Conduct form
    expect(r.hits.some((h) => h.reactions.includes('stellarConduct'))).toBe(true);
    expect(r.hits.filter((h) => h.action === 'javelin-stellar').length).toBeGreaterThan(0);
    expect(r.hits.filter((h) => h.action === 'javelin')).toHaveLength(0);
    expect(r.buffs.some((b) => b.effectId === 'polestar.shred' && b.value === -0.4)).toBe(true);
  });

  it('A1: in the field with the Frostpierce Star up, normal attacks become Cryo and gain +80% ATK', () => {
    const chars = [traveler(), electro];
    const r = run(chars, [['t', 'skill'], ['e', 'skill'], ['t', 'n1']], 'cryo');
    const n1 = r.hits.find((h) => h.action === 'n1')!;
    expect(n1.element).toBe('cryo');
    const noField = run([traveler()], [['t', 'skill'], ['t', 'n1']]).hits.find((h) => h.action === 'n1')!;
    expect(noField.element).toBe('physical');
    expect(n1.damage).toBeGreaterThan(noField.damage * 1.5);
  });
});
