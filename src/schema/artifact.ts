import { z } from 'zod';
import { recordBase } from './common';
import { effect } from './effect';

export const artifactSet = z.object({
  ...recordBase,
  pieces: z.object({
    '2': z.object({ effects: z.array(effect) }),
    '4': z.object({ effects: z.array(effect) }),
  }),
  needsHook: z.boolean().default(false),
});
export type ArtifactSet = z.infer<typeof artifactSet>;
