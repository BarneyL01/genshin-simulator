import type { Effect } from '../schema/effect';

export type Element = 'pyro' | 'hydro' | 'electro' | 'cryo' | 'anemo' | 'geo' | 'dendro' | 'physical';
export type Talent = 'normal' | 'charged' | 'plunge' | 'skill' | 'burst';
export type ScalingStat = 'atk' | 'hp' | 'def' | 'em';

/** A modifier to a stat key (see docs/KB_SCHEMA.md "Stat keys"). Percentages are fractions. */
export interface StatMod {
  stat: string;
  value: number;
}

export interface HitDef {
  /** Frames after the action starts. */
  frame: number;
  mv: number;
  scaling: ScalingStat;
  element: Element;
  talent: Talent;
  flat?: number;
}

export interface ActionDef {
  talent: Talent;
  hits: HitDef[];
  /** Frames from action start until the next action may start, keyed by the next action's kind
   *  ("normal", "skill", "burst", "swap", ...). `default` is the fallback. */
  cancel: Record<string, number> & { default: number };
  cooldown?: number;
}

export interface CharacterInput {
  id: string;
  level: number;
  base: { hp: number; atk: number; def: number };
  weaponAtk: number;
  /** Ascension stat, weapon substat, artifact main/sub stats (the KQMS pool). */
  baseMods: StatMod[];
  /** Action name → definition. Names: n1..nN, charged, plunge, skill, burst. */
  actions: Record<string, ActionDef>;
  /** Passives, constellations, weapon passive, set bonuses owned by this character. */
  effects: Effect[];
  refinement: number;
  /** Talent level used for `perTalentLevel` effect values. */
  talentLevel: number;
}

export interface EnemyInput {
  level: number;
  /** Base resistance per element as a fraction (0.1 = 10%). */
  res: Partial<Record<Element, number>>;
}

export interface RotationStep {
  char: string;
  /** Action name (n1, charged, skill, burst, ...) or "wait". */
  action: string;
  /** Frames to idle, for `wait`. */
  frames?: number;
}

export interface FinalStats {
  hp: number;
  atk: number;
  def: number;
  em: number;
  er: number;
  critRate: number;
  critDmg: number;
}

export interface ActionRecord {
  cycle: number;
  char: string;
  action: string;
  start: number;
  end: number;
}

export interface HitRecord {
  cycle: number;
  frame: number;
  char: string;
  action: string;
  element: Element;
  talent: Talent;
  damage: number;
}

export interface BuffRecord {
  effectId: string;
  source: string;
  target: string;
  stat: string;
  value: number;
  stacks: number;
  start: number;
  end: number | null;
}

export interface SimResult {
  actions: ActionRecord[];
  hits: HitRecord[];
  buffs: BuffRecord[];
  totalDamage: number;
  /** Frames of the measured window (cycles 2..N, or cycle 1 when cycles = 1). */
  windowFrames: number;
  windowDamage: number;
  dps: number;
  perCharacterDps: Record<string, number>;
  /** Human-readable simplifications applied (skipped triggers, ignored conditions, waits). */
  assumptions: string[];
}
