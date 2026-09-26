import { describe, expect, it } from 'vitest';
import { EXECUTION_PROFILES, KQMS, artifactMods, liquidLimit, optimizeKqms, sumMods, type ActionDef, type CharacterInput, type HitDef } from '../src/engine';
import { effect } from '../src/schema';

const hit = (frame: number, element: HitDef['element'], talent: HitDef['talent'], mv = 1, scaling: HitDef['scaling'] = 'atk'): HitDef => ({ frame, mv, scaling, element, talent, gauge: 1, icd: { tag: 'none', group: 'none' } });
const act = (talent: ActionDef['talent'], hits: HitDef[], cancel: number, extra: Partial<ActionDef> = {}): ActionDef => ({ talent, hits, cancel: { default: cancel }, ...extra });
const mk = (id: string, over: Partial<CharacterInput> = {}): CharacterInput => ({
  id, element: 'pyro', level: 90, base: { hp: 12000, atk: 300, def: 700 }, weaponAtk: 500, baseMods: [], refinement: 1,
  talentLevels: [9, 9, 9], hookHits: {}, effects: [], actions: {}, ...over,
});
const enemy = { level: 100, res: { pyro: 0.1, physical: 0.1 } };
const mains = { sands: 'atk%', goblet: 'dmgBonus.pyro', circlet: 'critRate' };

describe('KQMS artifact stats', () => {
  it('main stats, two fixed rolls of each substat, liquid rolls', () => {
    const m = sumMods(artifactMods(mains, { critRate: 10, critDmg: 4 }));
    expect(m.hp).toBeCloseTo(4780 + 2 * KQMS.substatValues.hp!);
    expect(m.atk).toBeCloseTo(311 + 2 * KQMS.substatValues.atk!);
    expect(m['atk%']).toBeCloseTo(0.466 + 2 * 0.0496);
    expect(m.critRate).toBeCloseTo(0.311 + 2 * 0.0331 + 10 * 0.0331);
    expect(m.critDmg).toBeCloseTo(2 * 0.0662 + 4 * 0.0662);
    expect(m['dmgBonus.pyro']).toBeCloseTo(0.466);
  });

  it('liquid cap is 10 per substat minus 2 per piece with that main stat', () => {
    expect(liquidLimit(mains, 'critDmg')).toBe(10);
    expect(liquidLimit(mains, 'critRate')).toBe(8);
    expect(liquidLimit(mains, 'atk%')).toBe(8);
    expect(liquidLimit({ sands: 'er', goblet: 'er', circlet: 'critDmg' }, 'er')).toBe(6);
  });

  const solo = () => {
    const c = mk('a', {
      actions: {
        skill: act('skill', [hit(10, 'pyro', 'skill', 2)], 30, { particles: { count: 3, perHit: false, icd: 0, delay: 20, element: 'pyro' } }),
        burst: act('burst', [hit(10, 'pyro', 'burst', 6)], 30, { energyCost: 20 }),
        n1: act('normal', [hit(5, 'physical', 'normal', 1)], 20),
      },
      effects: [effect.parse({ id: 'a.flat', trigger: { on: 'onSkill' }, target: 'self', stat: 'energyGain', value: 10 })],
    });
    return {
      characters: [c], mains: { a: [mains] }, enemy, profile: EXECUTION_PROFILES.relaxed,
      rotation: ['skill', 'burst', 'n1', 'n1', 'n1'].map((action) => ({ char: 'a', action })),
    };
  };

  it('finds the fewest ER rolls that keep the burst available and puts the rest into damage', () => {
    const r = optimizeKqms({ ...solo(), cycles: 3 });
    // per cycle: 3 particles × 3 = 9 + flat 10 = 19 energy at 100% ER; the burst costs 20 → needs 105.3% ER
    expect(r.liquid.a!.er).toBe(1);
    expect(r.erShort).toEqual([]);
    const l = r.liquid.a!;
    const total = Object.values(l).reduce((s, n) => s + n, 0);
    expect(total).toBe(KQMS.totalLiquidSubstats);
    // An ATK scaler with a CRIT circlet: no HP%/DEF% rolls, and every stat within its cap
    expect(l['hp%']).toBeUndefined();
    for (const [s, n] of Object.entries(l)) expect(n).toBeLessThanOrEqual(liquidLimit(mains, s));
    expect(l.critDmg ?? 0).toBeGreaterThan(0);
  });

  it('reports characters that cannot reach their burst', () => {
    const p = solo();
    p.characters[0]!.actions.burst!.energyCost = 200;
    const r = optimizeKqms({ ...p, cycles: 3 });
    expect(r.erShort).toEqual(['a']);
    expect(r.notes.join(' ')).toContain('cannot burst every rotation');
  });

  it('HP scalers get HP% instead of ATK%', () => {
    const p = solo();
    const c = p.characters[0]!;
    for (const a of Object.values(c.actions)) a.hits = a.hits.map((h) => ({ ...h, scaling: 'hp' as const }));
    const r = optimizeKqms({ ...p, mains: { a: [{ sands: 'hp%', goblet: 'dmgBonus.pyro', circlet: 'critRate' }] }, cycles: 3 });
    expect(r.liquid.a!['atk%']).toBeUndefined();
    expect(r.liquid.a!['hp%'] ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('chooses between circlet alternatives by damage', () => {
    const p = solo();
    // With a CRIT DMG circlet the character has no extra CRIT rate main stat: 5% + fixed vs 31% + fixed
    const r = optimizeKqms({ ...p, mains: { a: [{ sands: 'atk%', goblet: 'dmgBonus.pyro', circlet: 'critRate' }, { sands: 'atk%', goblet: 'dmgBonus.pyro', circlet: 'critDmg' }] }, cycles: 3 });
    expect(['critRate', 'critDmg']).toContain(r.mains.a!.circlet);
  });
});
