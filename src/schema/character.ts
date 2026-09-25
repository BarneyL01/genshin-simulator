import { z } from 'zod';
import { element, fraction, frameData, frames, recordBase, talentKind, weaponType } from './common';
import { effect } from './effect';

const stats = z.object({ hp: z.number(), atk: z.number(), def: z.number() });

const hit = z.object({
  name: z.string(),
  mv: z.array(z.number()).min(1),
  scaling: z.enum(['atk', 'hp', 'def', 'em']).default('atk'),
  element,
  frames: frameData.optional(),
  icd: z.object({ tag: z.string(), group: z.string() }).optional(),
  gauge: z.number().nonnegative().optional(),
});

const talentBlock = z.object({
  hits: z.array(hit).default([]),
  variants: z.array(z.string()).optional(),
  cooldown: frames.optional(),
  energyCost: z.number().optional(),
  stamina: z.number().optional(),
  particles: z.object({ count: z.number(), perHit: z.boolean().optional(), icd: frames.optional() }).optional(),
  effects: z.array(z.string()).default([]),
  hook: z.string().optional(),
});

const comboAction = z.object({
  action: z.enum(['normal', 'charged', 'plunge', 'skill', 'burst', 'dash', 'wait', 'swap']),
  variant: z.string().optional(),
  hits: z.number().int().positive().optional(),
  then: z.string().optional(),
  repeat: z.union([z.number().int().positive(), z.literal('untilRotationEnd'), z.literal('untilBurstEnd')]).optional(),
});

export const character = z.object({
  ...recordBase,
  rarity: z.union([z.literal(4), z.literal(5)]),
  element: element.exclude(['physical']),
  weaponType,
  releaseVersion: z.string(),
  roles: z.array(z.string()).default([]),
  baseStats: z.object({ lv90: stats, lv100: stats.nullable().default(null) }),
  ascensionStat: z.object({ stat: z.string(), value: fraction }),
  talents: z.record(talentKind, talentBlock),
  passives: z.array(z.object({ id: z.string(), unlock: z.string(), effects: z.array(effect) })).default([]),
  constellations: z
    .array(z.object({ level: z.number().int().min(1).max(6), effects: z.array(effect).default([]), text: z.string().optional() }))
    .max(6)
    .default([]),
  effects: z.array(effect).default([]),
  usualCombo: z.array(z.object({ variant: z.string(), actions: z.array(comboAction).min(1) })).min(1),
  recommended: z
    .object({
      weapons: z.array(z.object({ id: z.string(), source: z.string() })).default([]),
      artifacts: z.array(z.object({ sets: z.record(z.string(), z.number()), source: z.string() })).default([]),
    })
    .default({ weapons: [], artifacts: [] }),
  hooks: z.array(z.string()).default([]),
  needsHook: z.boolean().default(false),
});
export type Character = z.infer<typeof character>;
