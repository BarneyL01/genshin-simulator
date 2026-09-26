import { z } from 'zod';
import { ascensionStat, element, frameData, frames, recordBase, talentKind, weaponType } from './common';
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
  /** Extra identical hits (same MV, element, ICD tag) at these frames after the action starts; `frames.hitmark` is the first. */
  extraHitmarks: z.array(frames).optional(),
  /** Multiplier tables for the extra hits, when they differ from `mv` (parallel to `extraHitmarks`). */
  extraMv: z.array(z.array(z.number()).min(1)).optional(),
  /** 'blunt' hits can shatter Frozen enemies. */
  strike: z.enum(['default', 'blunt']).optional(),
});

/** A hit that no action lists: fired by a hook (e.g. Xingqiu's sword rain). `talent` sets the damage type and which talent level applies. */
const hookHit = hit.extend({ talent: talentKind });

const talentBlock = z.object({
  hits: z.array(hit).default([]),
  /** Frame data for blocks without hits (e.g. a burst that only starts an effect). */
  frames: frameData.optional(),
  variants: z.array(z.string()).optional(),
  cooldown: frames.optional(),
  energyCost: z.number().optional(),
  stamina: z.number().optional(),
  particles: z
    .object({
      count: z.number(),
      perHit: z.boolean().optional(),
      icd: frames.optional(),
      /** Frames from the hit until the particles can be collected. Default: kb/mechanics/constants.json. */
      delay: frames.optional(),
      /** Particle element; defaults to the character's own. 'none' = colourless. */
      element: z.enum(['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro', 'none']).optional(),
    })
    .optional(),
  effects: z.array(z.string()).default([]),
  hook: z.string().optional(),
});

const comboAction = z.object({
  /** A standard action (normal, charged, plunge, skill, burst, dash, wait, swap) or one of the character's `extraActions`. */
  action: z.string().min(1),
  variant: z.string().optional(),
  hits: z.number().int().positive().optional(),
  then: z.string().optional(),
  repeat: z.union([z.number().int().positive(), z.literal('untilRotationEnd'), z.literal('untilBurstEnd')]).optional(),
});

/** An action that is not one of the standard talents (e.g. Raiden's Musou Isshin sword attacks). */
const extraAction = z.object({
  /** What the action counts as for triggers (onNormal, onCharged, ...). */
  as: z.enum(['normal', 'charged', 'plunge', 'skill', 'burst']),
  /** Damage type and talent level source of its hits. */
  damageTalent: talentKind,
  hits: z.array(hit).min(1),
  cooldown: frames.optional(),
  particles: z
    .object({
      count: z.number(),
      perHit: z.boolean().optional(),
      icd: frames.optional(),
      delay: frames.optional(),
      element: z.enum(['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro', 'none']).optional(),
    })
    .optional(),
});

export const character = z.object({
  ...recordBase,
  rarity: z.union([z.literal(4), z.literal(5)]),
  element: element.exclude(['physical']),
  weaponType,
  releaseVersion: z.string(),
  roles: z.array(z.string()).default([]),
  baseStats: z.object({ lv90: stats, lv100: stats.nullable().default(null) }),
  ascensionStat,
  talents: z.partialRecord(talentKind, talentBlock),
  passives: z.array(z.object({ id: z.string(), unlock: z.string(), effects: z.array(effect) })).default([]),
  constellations: z
    .array(z.object({
        level: z.number().int().min(1).max(6),
        effects: z.array(effect).default([]),
        text: z.string().optional(),
        /** Talent level increases granted by this constellation (C3/C5 in the game), e.g. { skill: 3 }. */
        talentLevelBonus: z.object({ normal: z.number().int(), skill: z.number().int(), burst: z.number().int() }).partial().optional(),
      }))
    .max(6)
    .default([]),
  effects: z.array(effect).default([]),
  /** Named actions beyond n1..nN / charged / plunge / skill / burst, usable in rotations. */
  extraActions: z.record(z.string(), extraAction).default({}),
  /** Hits fired only by hooks, keyed by id (e.g. "xingqiu.rain-sword"). */
  hookHits: z.record(z.string(), hookHit).default({}),
  usualCombo: z.array(z.object({ variant: z.string(), actions: z.array(comboAction).min(1) })).min(1),
  recommended: z
    .object({
      weapons: z.array(z.object({ id: z.string(), source: z.string() })).default([]),
      artifacts: z.array(z.object({ sets: z.record(z.string(), z.number()), source: z.string() })).default([]),
      /** Preferred main stats per slot, best first (stat keys). Used by KQMS for teams without their own main stats. */
      mainStats: z
        .object({ sands: z.array(z.string()).min(1), goblet: z.array(z.string()).min(1), circlet: z.array(z.string()).min(1), source: z.string() })
        .optional(),
    })
    .default({ weapons: [], artifacts: [] }),
  hooks: z.array(z.string()).default([]),
  needsHook: z.boolean().default(false),
}).superRefine((c, ctx) => {
  const standard = new Set(['normal', 'charged', 'plunge', 'skill', 'burst', 'dash', 'wait', 'swap']);
  c.usualCombo.forEach((v, vi) =>
    v.actions.forEach((a, ai) => {
      if (!standard.has(a.action) && !(a.action in c.extraActions)) {
        ctx.addIssue({ code: 'custom', path: ['usualCombo', vi, 'actions', ai, 'action'], message: `unknown action "${a.action}" (not standard and not in extraActions)` });
      }
    }),
  );
});
export type Character = z.infer<typeof character>;
