import { z } from 'zod';
import { element, recordBase } from './common';

export const enemy = z.object({
  ...recordBase,
  level: z.number().int().positive(),
  res: z.record(element, z.number()),
  notes: z.string().optional(),
});
export type Enemy = z.infer<typeof enemy>;
