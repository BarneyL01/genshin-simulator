import type { FinalStats, StatMod } from './types';

export const BASE_CRIT_RATE = 0.05;
export const BASE_CRIT_DMG = 0.5;

export function sumMods(mods: readonly StatMod[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mods) out[m.stat] = (out[m.stat] ?? 0) + m.value;
  return out;
}

/**
 * final = (base [+ weapon ATK]) × (1 + %) + flat. ER is 1 + bonus. EM is flat.
 * Crit rate/dmg start from 5% / 50%.
 */
export function resolveStats(
  base: { hp: number; atk: number; def: number },
  weaponAtk: number,
  mods: Record<string, number>,
): FinalStats {
  const m = (k: string) => mods[k] ?? 0;
  return {
    hp: base.hp * (1 + m('hp%')) + m('hp'),
    atk: (base.atk + weaponAtk) * (1 + m('atk%')) + m('atk'),
    def: base.def * (1 + m('def%')) + m('def'),
    em: m('em'),
    er: 1 + m('er'),
    critRate: BASE_CRIT_RATE + m('critRate'),
    critDmg: BASE_CRIT_DMG + m('critDmg'),
    baseAtk: base.atk + weaponAtk,
    baseHp: base.hp,
    baseDef: base.def,
  };
}
