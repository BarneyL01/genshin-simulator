import { z } from 'zod';
import { frames, provenance, dataConfidence } from './common';

const base = { id: z.string(), provenance, dataConfidence, assumptions: z.array(z.string()).default([]) };
const emCurve = z.object({ k: z.number(), c: z.number() });

const pair = z.object({
  trigger: z.string(),
  aura: z.string(),
  /** Gauge of the aura consumed per unit of trigger gauge. */
  consume: z.number().nonnegative(),
  /** Amplifying reactions only: damage multiplier for this trigger/aura direction. */
  multiplier: z.number().optional(),
});

export const reactionDef = z.object({
  type: z.enum(['amplifying', 'transformative', 'additive', 'lunar', 'other']),
  implemented: z.boolean(),
  element: z.string().optional(),
  multiplier: z.number().optional(),
  pairs: z.array(pair).default([]),
  gcd: frames.optional(),
  effect: z.object({ stat: z.string(), value: z.number(), duration: frames }).optional(),
  tickFrames: frames.optional(),
  firstHitDelay: frames.optional(),
  waneUnits: z.number().optional(),
  coreDelay: frames.optional(),
  coreDuration: frames.optional(),
  cloudDuration: frames.optional(),
  contributorWeights: z.array(z.number()).optional(),
  notes: z.string().optional(),
});

export const reactionsFile = z.object({
  ...base,
  levelBase: z.object({ lv90: z.number().positive() }),
  aura: z.object({ tax: z.number(), decayBaseSeconds: z.number(), decayPerUnitSeconds: z.number() }),
  em: z.object({ amplifying: emCurve, transformative: emCurve, additive: emCurve, lunar: emCurve }),
  reactions: z.record(z.string(), reactionDef),
});
export type ReactionDef = z.infer<typeof reactionDef>;
export type ReactionsFile = z.infer<typeof reactionsFile>;

export const icdFile = z.object({
  ...base,
  groups: z.record(z.string(), z.object({ pattern: z.array(z.number()).min(1), resetFrames: frames, notes: z.string().optional() })),
});
export type IcdFile = z.infer<typeof icdFile>;

export const constantsFile = z.object({
  ...base,
  swapCooldownFrames: frames,
  particleDelayFrames: frames,
  energy: z.object({
    particle: z.object({ sameElement: z.number(), neutral: z.number(), otherElement: z.number() }),
    offFieldPenaltyPerPartyMember: z.number(),
  }),
});
export type ConstantsFile = z.infer<typeof constantsFile>;

export const kqmsFile = z.object({
  ...base,
  totalLiquidSubstats: z.number().int().positive(),
  individualLiquidCap: z.number().int().positive(),
  fixedSubstatCount: z.number().int().nonnegative(),
  /** Value of one substat roll, by stat key (fractions; flat for em/atk/def/hp). */
  substatValues: z.record(z.string(), z.number()),
  /** Main stat values at 5★ level 20, by stat key. */
  mainStatValues: z.record(z.string(), z.number()),
});
export type KqmsFile = z.infer<typeof kqmsFile>;

export const MECHANICS_FILES = { reactions: reactionsFile, icd: icdFile, constants: constantsFile, kqms: kqmsFile } as const;
