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

/** EM bonus of direct/lunar reaction damage: 6·EM / (2000 + EM) (kb/mechanics/reactions.json em.lunar). */
export function directEmBonus(em: number, curve: { k: number; c: number }): number {
  return (curve.k * em) / (em + curve.c);
}

export interface DirectDamageContext {
  hit: HitDef;
  stats: FinalStats;
  mods: Record<string, number>;
  charLevel: number;
  enemyLevel: number;
  enemyRes: Partial<Record<Element, number>>;
  /** Stellar-Conduct field multiplier (directMultTable[stacks]); 1 otherwise. */
  fieldMult: number;
  emCurve: { k: number; c: number };
}

/**
 * Direct reaction damage (gcsim calcDirectReaction; Stellar Glimmer):
 * (MV × stat × (1 + base bonus) × field mult × (1 + EM bonus + reaction bonus) + flat) × crit × def × res.
 * DMG% bonuses do not apply. Reaction bonus = `reactionBonus.<direct>` + `reactionBonus.stellarGlimmer`.
 */
export function calcDirectDamage(c: DirectDamageContext): number {
  const m = (k: string) => c.mods[k] ?? 0;
  const { hit, stats } = c;
  const t = hit.talent;
  const kind = hit.direct!;
  const scalingValue = stats[hit.scaling];
  const base = hit.mv * scalingValue * (1 + (hit.baseMult ?? 0)) * c.fieldMult;
  const react = 1 + directEmBonus(stats.em, c.emCurve) + m(`reactionBonus.${kind}`) + m('reactionBonus.stellarGlimmer');
  const flat = hit.flat ?? 0;
  const cr = stats.critRate + m(`critRate.${t}`);
  const cd = stats.critDmg + m(`critDmg.${t}`);
  const res = (c.enemyRes[hit.element] ?? 0) + m(`res.enemy.${hit.element}`);
  return (
    (base * react + flat) *
    critFactor(cr, cd) *
    defMultiplier(c.charLevel, c.enemyLevel, -m('def.enemy.shred'), Math.min(1, m('defIgnore') + (hit.defIgnore ?? 0))) *
    resMultiplier(res)
  );
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
  const baseMult = 1 + m(`baseDmgMultiplier.${t}`) + (hit.baseMult ?? 0);
  const dmgBonus = 1 + m('dmgBonus.all') + m(`dmgBonus.${hit.element}`) + m(`dmgBonus.${t}`);
  const cr = stats.critRate + m(`critRate.${t}`);
  const cd = stats.critDmg + m(`critDmg.${t}`);
  const res = (c.enemyRes[hit.element] ?? 0) + m(`res.enemy.${hit.element}`);
  return (
    (mv * scalingValue + flat) *
    baseMult *
    dmgBonus *
    critFactor(cr, cd) *
    defMultiplier(c.charLevel, c.enemyLevel, -m('def.enemy.shred'), Math.min(1, m('defIgnore') + (hit.defIgnore ?? 0))) *
    resMultiplier(res) *
    (c.reactionFactor ?? 1)
  );
}
