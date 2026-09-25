import { z } from 'zod';
import { kebabId, recordBase } from './common';

export const team = z.object({
  ...recordBase,
  members: z
    .array(
      z.object({
        slot: z.number().int().min(1).max(4),
        character: kebabId,
        role: z.string(),
        substitutes: z.array(kebabId).default([]),
        weapons: z.array(kebabId).default([]),
        artifacts: z.array(z.object({ sets: z.record(z.string(), z.number()) })).default([]),
        mainStats: z.record(z.string(), z.string()).optional(),
        erTarget: z.number().optional(),
      }),
    )
    .length(4),
  rotation: z.object({
    lengthSeconds: z.number().positive(),
    script: z
      .array(z.object({ char: kebabId, action: z.string(), variant: z.string().optional(), repeat: z.number().optional() }))
      .min(1),
    source: z.string(),
  }),
  sourceRank: z.record(z.string(), z.string().nullable()).default({}),
  notes: z.string().default(''),
  status: z.enum(['active', 'legacy']).default('active'),
});
export type Team = z.infer<typeof team>;
