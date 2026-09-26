import { z } from 'zod';
import { kebabId, recordBase } from './common';

const mainStatChoices = z.object({
  sands: z.array(z.string()).min(1),
  goblet: z.array(z.string()).min(1),
  circlet: z.array(z.string()).min(1),
});

export const rotationStep = z.object({
  char: kebabId,
  /** Action name (n1.., charged, skill, burst, an extra action) or "wait". */
  action: z.string().min(1),
  frames: z.number().int().positive().optional(),
  firstCycleOnly: z.boolean().optional(),
});

export const repeatStep = z.object({
  repeat: z.union([
    z.object({ times: z.number().int().positive() }),
    z.object({ untilBuffEnds: z.object({ effect: z.string(), source: kebabId }) }),
  ]),
  steps: z.array(rotationStep).min(1),
});

export const rotationItem = z.union([rotationStep, repeatStep]);

export const team = z.object({
  ...recordBase,
  members: z
    .array(
      z.object({
        slot: z.number().int().min(1).max(4),
        character: kebabId,
        role: z.string(),
        substitutes: z.array(kebabId).default([]),
        /** Weapons in order of preference; the first is used by default. */
        weapons: z.array(kebabId).default([]),
        artifacts: z.array(z.object({ sets: z.record(z.string(), z.number()) })).default([]),
        mainStats: mainStatChoices.optional(),
      }),
    )
    .length(4),
  rotation: z.object({
    lengthSeconds: z.number().positive().optional(),
    script: z.array(rotationItem).min(1),
    source: z.string(),
    sourceUrl: z.string().url().optional(),
    /** The rotation as written by the source, for reference. */
    original: z.string().optional(),
  }),
  sourceRank: z.record(z.string(), z.string().nullable()).default({}),
  notes: z.string().default(''),
  status: z.enum(['active', 'legacy']).default('active'),
});
export type Team = z.infer<typeof team>;
export type RotationItemData = z.infer<typeof rotationItem>;
