import { z } from 'zod';

export const kebabId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be lowercase kebab-case');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const gameVersion = z.string().regex(/^\d+\.\d+$/);
/** Fraction, e.g. 0.466. Values >= 20 are almost certainly percentages entered by mistake. */
export const fraction = z.number().max(20, 'percentages must be stored as fractions (0.466, not 46.6)');
export const frames = z.number().int().nonnegative();

export const element = z.enum(['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro', 'physical']);
export const weaponType = z.enum(['sword', 'claymore', 'polearm', 'bow', 'catalyst']);
export const talentKind = z.enum(['normal', 'charged', 'plunge', 'skill', 'burst']);
export const dataConfidence = z.enum(['high', 'medium', 'low']);

export const provenance = z.object({
  sources: z
    .array(
      z.object({
        site: z.string().min(1),
        url: z.string().url(),
        retrieved: isoDate,
        fields: z.array(z.string()).default([]),
        commit: z.string().optional(),
      }),
    )
    .min(1),
  conflicts: z
    .array(
      z.object({
        field: z.string(),
        values: z.record(z.string(), z.unknown()),
        chosen: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  gameVersion,
});

export const frameData = z.object({
  hitmark: frames,
  cancel: z.record(z.string(), frames).default({}),
  source: z.object({ site: z.string(), url: z.string().url(), commit: z.string().optional() }).optional(),
});

/** Fields every KB record carries. */
export const recordBase = {
  id: kebabId,
  name: z.string().min(1),
  provenance,
  dataConfidence,
  assumptions: z.array(z.string()).default([]),
};

const PERCENT_MSG = 'percentages must be stored as fractions (0.466, not 46.6)';
const flatOk = (stat: string, n: number) => stat === 'em' || n <= 20;

/** Ascension stat: a fraction, except flat Elemental Mastery. */
export const ascensionStat = z
  .object({ stat: z.string(), value: z.number() })
  .refine((v) => flatOk(v.stat, v.value), { message: PERCENT_MSG, path: ['value'] });

/** Weapon substat at Lv 90: a fraction, except flat Elemental Mastery. */
export const weaponSubstat = z
  .object({ stat: z.string(), lv90: z.number() })
  .refine((v) => flatOk(v.stat, v.lv90), { message: PERCENT_MSG, path: ['lv90'] });
