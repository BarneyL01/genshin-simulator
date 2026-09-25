import { z } from 'zod';
import { fraction, recordBase, weaponType } from './common';
import { effect } from './effect';

export const weapon = z.object({
  ...recordBase,
  type: weaponType,
  rarity: z.number().int().min(1).max(5),
  releaseVersion: z.string(),
  baseAtk: z.object({ lv90: z.number() }),
  substat: z.object({ stat: z.string(), lv90: fraction }),
  obtain: z.object({
    method: z.enum(['gacha', 'craft', 'event', 'battlepass', 'shop', 'chest']),
    freeRefinement: z.number().int().min(1).max(5).nullable().default(null),
    event: z.string().optional(),
  }),
  passive: z.object({ name: z.string().optional(), text: z.string().optional(), effects: z.array(effect) }),
  needsHook: z.boolean().default(false),
});
export type Weapon = z.infer<typeof weapon>;
