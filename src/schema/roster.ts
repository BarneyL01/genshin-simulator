import { z } from 'zod';

export const roster = z.object({
  version: z.literal(1),
  characters: z.record(
    z.string(),
    z.object({
      owned: z.boolean(),
      constellation: z.number().int().min(0).max(6).default(0),
      talents: z.tuple([z.number().int().min(1).max(15), z.number().int().min(1).max(15), z.number().int().min(1).max(15)]).default([9, 9, 9]),
      level: z.literal(90).default(90),
    }),
  ),
  weapons: z.record(z.string(), z.object({ owned: z.boolean(), refinement: z.number().int().min(1).max(5).default(1) })),
  settings: z.object({
    executionProfile: z.enum(['framePerfect', 'relaxed', 'custom']).default('relaxed'),
    actionDelay: z.number().int().nonnegative().default(18),
    swapDelay: z.number().int().nonnegative().default(18),
    assumeAllWeapons: z.boolean().default(false),
  }),
});
export type Roster = z.infer<typeof roster>;
