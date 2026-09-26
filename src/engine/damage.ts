import type { Element, FinalStats, HitDef } from './types';

/** Enemy DEF multiplier: (cLv+100) / ((cLv+100) + (eLv+100) × (1−shred) × (1−ignore)). */
export function defMultiplier(charLevel: number, enemyLevel: number, defShred = 0, defIgnore = 0): number {
  const c = charLevel + 100;
  return c / (c + (enemyLevel + 100) * (1 - defShred) * (1 - defIgnore));
}

/** Piecewise RES multiplier; `res` is a fraction and may be negative. */
export function resMultiplier(res: number): number {
  if (res < 0) return 1 - res / 2;
  if (res < 0.75) return 1 - res;
  return 1 / (4 * res + 1);
}

/** Expected-value crit factor; crit rate is clamped to [0, 1]. */
export function critFactor(critRate: number, critDmg: number): number {
  return 1 + Math.min(Math.max(critRate, 0), 1) * critDmg;
}

export interface DamageContext {
  hit: HitDef;
  stats: FinalStats;
  mods: Record<string, number>;
  charLevel: number;
  enemyLevel: number;
  enemyRes: Partial<Record<Element, number>>;
  /** Amplifying reaction factor: multiplier × (1 + EM bonus + reaction bonus). Default 1. */
  reactionFactor?: number;
  /** Flat base damage added by additive reactions (Aggravate/Spread). */
  catalyzeFlat?: number;
}

/**
 * dmg = (MV × scalingStat + flat) × baseMult × (1 + dmgBonus) × crit × def × res
 * Amplifying and additive reactions enter through `reactionFactor` and `catalyzeFlat`.
 */
export function calcHitDamage(c: DamageContext): number {
  const m = (k: string) => c.mods[k] ?? 0;
  const { hit, stats } = c;
  const t = hit.talent;
  const scalingValue = stats[hit.scaling];
  const mv = hit.mv + m(`mvBonus.${t}`) + (hit.name ? m(`mvBonus.hit.${hit.name}`) : 0);
  const flat = (hit.flat ?? 0) + m(`flatDmg.${t}`) + m('flatDmg.all') + (c.catalyzeFlat ?? 0);
  const baseMult = 1 + m(`baseDmgMultiplier.${t}`);
  const dmgBonus = 1 + m('dmgBonus.all') + m(`dmgBonus.${hit.element}`) + m(`dmgBonus.${t}`);
  const cr = stats.critRate + m(`critRate.${t}`);
  const cd = stats.critDmg + m(`critDmg.${t}`);
  const res = (c.enemyRes[hit.element] ?? 0) + m(`res.enemy.${hit.element}`);
  return (
    (mv * scalingValue + flat) *
    baseMult *
    dmgBonus *
    critFactor(cr, cd) *
    defMultiplier(c.charLevel, c.enemyLevel, -m('def.enemy.shred'), m('defIgnore')) *
    resMultiplier(res) *
    (c.reactionFactor ?? 1)
  );
}
