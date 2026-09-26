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
  /** Hit name (KB), targetable by `mvBonus.hit.<name>` effects. */
  name?: string;
  /** Frames after the action starts. */
  frame: number;
  mv: number;
  scaling: ScalingStat;
  element: Element;
  talent: Talent;
  flat?: number;
  /** Gauge units applied (default 1 for non-physical hits; 0 = no application). */
  gauge?: number;
  /** ICD tag/group. Default: tag "default", group "standard" (shared per character). */
  icd?: { tag: string; group: string };
  /** 'blunt' hits shatter Frozen enemies. */
  strike?: 'default' | 'blunt';
}

export interface ParticleDef {
  count: number;
  perHit: boolean;
  icd: number;
  delay: number;
  /** Particle element; 'none' = colourless. */
  element: Element | 'none';
}

export interface ActionDef {
  talent: Talent;
  hits: HitDef[];
  /** Frames from action start until the next action may start, keyed by the next action's kind
   *  ("normal", "skill", "burst", "swap", ...). `default` is the fallback. */
  cancel: Record<string, number> & { default: number };
  cooldown?: number;
  /** Burst energy cost (burst action only). */
  energyCost?: number;
  particles?: ParticleDef;
}

export interface CharacterInput {
  id: string;
  element: Element;
  level: number;
  base: { hp: number; atk: number; def: number };
  weaponAtk: number;
  /** Ascension stat, weapon substat, artifact main/sub stats (the KQMS pool). */
  baseMods: StatMod[];
  /** Action name → definition. Names: n1..nN, charged, plunge, skill, burst. */
  actions: Record<string, ActionDef>;
  /** Hits fired only by hooks, keyed by id. */
  hookHits: Record<string, HitDef>;
  /** Passives, constellations, weapon passive, set bonuses owned by this character. */
  effects: Effect[];
  refinement: number;
  /** Talent levels [normal, skill, burst] (constellation bonuses included) for `perTalentLevel` effect values. */
  talentLevels: [number, number, number];
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
  /** Only performed in the first cycle (e.g. the opening skill of a rotation that is otherwise cast at the end of the previous one). */
  firstCycleOnly?: boolean;
}

/**
 * A group of steps repeated a number of times, or for as long as a buff lasts: with `untilBuffEnds`
 * every action is checked before it starts, and the repeat stops at the first one that would start
 * after the buff has ended.
 */
export interface RepeatStep {
  repeat: { times: number } | { untilBuffEnds: { effect: string; source: string } };
  steps: RotationStep[];
}

export type RotationItem = RotationStep | RepeatStep;

export interface FinalStats {
  hp: number;
  atk: number;
  def: number;
  em: number;
  er: number;
  critRate: number;
  critDmg: number;
  /** Character + weapon base ATK, base HP, base DEF (for effects that scale off base stats). */
  baseAtk: number;
  baseHp: number;
  baseDef: number;
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
  /** 'reaction' for transformative/lunar damage; `action` then holds the reaction id. */
  talent: Talent | 'reaction';
  damage: number;
  /** Reactions triggered by this hit (for reaction damage: the reaction itself). */
  reactions: string[];
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
  /** Set for effects evaluated at hit time: value = base + ratio × source stat, capped. */
  dynamic?: DynamicScaling;
}

export interface DynamicScaling {
  from: string;
  ratio: number;
  base: number;
  cap?: number;
  capFrom?: { from: string; ratio: number };
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
  energy: Record<string, EnergyReport>;
  /** Human-readable simplifications applied (skipped triggers, ignored conditions, waits). */
  assumptions: string[];
}

export interface EnergyReport {
  burstCost: number;
  burstsPerCycle: number;
  /** Particle energy per cycle at ER 100% (after the off-field penalty). */
  particleEnergyBase: number;
  /** Flat (non-particle) energy per cycle. */
  flatEnergy: number;
  /** Total energy per cycle at the character's actual ER. */
  gainedPerCycle: number;
  /** ER needed to burst every cycle; null when the character has no burst in the rotation. */
  requiredEr: number | null;
  /** Number of bursts that fired without enough energy. */
  shortfalls: number;
}
