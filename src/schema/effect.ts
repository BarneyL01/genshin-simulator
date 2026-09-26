import { z } from 'zod';
import { frames } from './common';

export const TRIGGERS = [
  'always', 'onHit', 'onSkill', 'onBurst', 'onNormal', 'onCharged', 'onPlunge', 'onReaction',
  'onSwapIn', 'onSwapOut', 'onHeal', 'onShield', 'onEnergy', 'custom',
] as const;

export const EFFECT_TARGETS = ['self', 'active', 'team', 'teamExceptSelf', 'enemy', 'enemiesHit'] as const;

const TALENTS = '(normal|charged|plunge|skill|burst)';
const ELEMENTS = '(pyro|hydro|electro|cryo|anemo|geo|dendro|physical)';
const STAT_KEY = new RegExp(
  '^(' +
    [
      'hp', 'hp%', 'atk', 'atk%', 'def', 'def%', 'em', 'er', 'critRate', 'critDmg', 'healingBonus',
      'dmgBonus\\.all', `dmgBonus\\.${ELEMENTS}`, `dmgBonus\\.${TALENTS}`,
      `critRate\\.${TALENTS}`, `critDmg\\.${TALENTS}`, `flatDmg\\.${TALENTS}`, 'flatDmg\\.all',
      'reactionBonus\\.[a-zA-Z]+', `res\\.enemy\\.${ELEMENTS}`, 'def\\.enemy\\.shred', 'defIgnore',
      `mvBonus\\.${TALENTS}`, `baseDmgMultiplier\\.${TALENTS}`, 'energyGain', `infusion\\.${ELEMENTS}`,
    ].join('|') +
    ')$',
);
export const statKey = z.string().regex(STAT_KEY, 'unknown stat key (new keys need a schema change)');

const value = z.union([
  z.number(),
  z.object({ perRefinement: z.array(z.number()).length(5) }),
  z.object({ perTalentLevel: z.array(z.number()).min(1), talent: z.enum(['normal', 'skill', 'burst']).optional() }),
]);

export type EffectValue = z.infer<typeof value>;

/** Stats an effect may scale from: `self.<key>` (the effect owner's stat at hit time). */
export const SCALING_SOURCES = ['atk', 'hp', 'def', 'em', 'er', 'critRate', 'critDmg', 'baseAtk', 'baseHp', 'baseDef'] as const;

export const effect = z.object({
  id: z.string().min(1),
  trigger: z.object({
    on: z.enum(TRIGGERS),
    filter: z.record(z.string(), z.string()).optional(),
  }),
  condition: z.record(z.string(), z.unknown()).optional(),
  target: z.enum(EFFECT_TARGETS),
  stat: statKey,
  value,
  /**
   * value = base + ratio × stat, capped at `cap`. Replaces `value`. Evaluated at hit time (dynamic)
   * unless `snapshot` is true. Numbers or per-refinement / per-talent-level tables.
   * `er` is the multiplier (1 + bonus), so "28% of ER over 100%" is ratio 0.28, base −0.28.
   */
  scaling: z.object({ from: z.string(), ratio: value, cap: value.optional(), base: value.optional() }).nullish(),
  /** Frames between the trigger and the effect starting. */
  delay: frames.optional(),
  duration: frames.nullish(),
  maxStacks: z.number().int().positive().default(1),
  stackMode: z.enum(['refresh', 'independent']).optional(),
  stackGain: z.object({ on: z.string(), icd: frames.optional() }).optional(),
  /** Internal cooldown in frames (a number or per refinement). */
  icd: z.union([frames, z.object({ perRefinement: z.array(frames).length(5) })]).nullish(),
  snapshot: z.boolean().default(false),
  stackGroup: z.string().nullish(),
  hook: z.string().optional(),
  assumption: z.string().optional(),
});
export type Effect = z.infer<typeof effect>;
