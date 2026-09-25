import { z } from 'zod';
import { gameVersion, isoDate } from './common';

export const meta = z.object({
  gameVersion,
  lastSync: isoDate.nullable(),
  sources: z.record(z.string(), z.object({ status: z.enum(['ok', 'blocked', 'changed']), lastChecked: isoDate })),
  counts: z.object({ characters: z.number(), weapons: z.number(), artifacts: z.number(), teams: z.number() }),
});
export type Meta = z.infer<typeof meta>;
