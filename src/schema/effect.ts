import { z } from 'zod';
import { frames, fraction } from './common';

export const TRIGGERS = [
  'always', 'onHit', 'onSkill', 'onBurst', 'onNormal', 'onCharged', 'onPlunge', 'onReaction',
  'onSwapIn', 'onSwapOut', 'onHeal', 'onShield', 'onEnergy', 'custom',
] as const;

export const EFFECT_TARGETS = ['self', 'active', 'team', 'teamExceptSelf', 'enemy', 'enemiesHit'] as const;

const TALENTS = '(normal|charged|plunge|skill|burst)';
const ELEMENTS = '(pyro|hydro|electro|cryo|anemo|geo|dendro|physical)';
const STAT_KEY = new RegExp(
  '^(' +
    [
      'hp', 'hp%', 'atk', 'atk%', 'def', 'def%', 'em', 'er', 'critRate', 'critDmg', 'healingBonus',
      'dmgBonus\\.all', `dmgBonus\\.${ELEMENTS}`, `dmgBonus\\.${TALENTS}`,
      `critRate\\.${TALENTS}`, `critDmg\\.${TALENTS}`, `flatDmg\\.${TALENTS}`, 'flatDmg\\.all',
      'reactionBonus\\.[a-zA-Z]+', `res\\.enemy\\.${ELEMENTS}`, 'def\\.enemy\\.shred', 'defIgnore',
      `mvBonus\\.${TALENTS}`, `baseDmgMultiplier\\.${TALENTS}`, 'energyGain',
    ].join('|') +
    ')$',
);
export const statKey = z.string().regex(STAT_KEY, 'unknown stat key (new keys need a schema change)');

const value = z.union([
  z.number(),
  z.object({ perRefinement: z.array(z.number()).length(5) }),
  z.object({ perTalentLevel: z.array(z.number()).min(1) }),
]);

export const effect = z.object({
  id: z.string().min(1),
  trigger: z.object({
    on: z.enum(TRIGGERS),
    filter: z.record(z.string(), z.string()).optional(),
  }),
  condition: z.record(z.string(), z.unknown()).optional(),
  target: z.enum(EFFECT_TARGETS),
  stat: statKey,
  value,
  scaling: z
    .object({ from: z.string(), ratio: z.number(), cap: fraction.optional(), base: z.number().optional() })
    .nullish(),
  duration: frames.nullish(),
  maxStacks: z.number().int().positive().default(1),
  stackMode: z.enum(['refresh', 'independent']).optional(),
  stackGain: z.object({ on: z.string(), icd: frames.optional() }).optional(),
  icd: frames.nullish(),
  snapshot: z.boolean().default(false),
  stackGroup: z.string().nullish(),
  hook: z.string().optional(),
  assumption: z.string().optional(),
});
export type Effect = z.infer<typeof effect>;
