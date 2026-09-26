import { effect, type Effect } from '../../../src/schema/effect';
import type { ArtifactSpec } from '../artifact-lib';

const E = (e: Partial<Effect> & Pick<Effect, 'id' | 'stat'>): Effect => effect.parse({ trigger: { on: 'always' }, target: 'self', value: 0, ...e });

// Values are read from the genshin-db set text (effect2Pc / effect4Pc). Wearer-only effects use target "self".
export const specs: ArtifactSpec[] = [
  {
    id: 'emblem-of-severed-fate', dbName: 'Emblem of Severed Fate',
    two: [E({ id: 'emblem.2pc.er', stat: 'er', value: 0.2 })],
    four: [E({
      id: 'emblem.4pc.burst-dmg', stat: 'dmgBonus.burst',
      // 25% of ER as burst DMG bonus, max 75%. `er` is the multiplier (1 + bonus): 0.25 × (ER − 1) = 0.25 ER − 0.25.
      scaling: { from: 'self.er', ratio: 0.25, base: -0.25, cap: 0.75 },
      assumption: 'ER is read at hit time, including the 2-piece bonus.',
    })],
  },
  {
    id: 'noblesse-oblige', dbName: 'Noblesse Oblige',
    two: [E({ id: 'noblesse.2pc.burst-dmg', stat: 'dmgBonus.burst', value: 0.2 })],
    four: [E({
      id: 'noblesse.4pc.atk', trigger: { on: 'onBurst' }, target: 'team', stat: 'atk%', value: 0.2, duration: 720, stackGroup: 'noblesse-oblige',
      assumption: 'Applies when the wearer bursts; a second wearer does not stack (same stackGroup, not enforced yet).',
    })],
  },
  {
    id: 'crimson-witch-of-flames', dbName: 'Crimson Witch of Flames',
    two: [E({ id: 'crimson.2pc.pyro', stat: 'dmgBonus.pyro', value: 0.15 })],
    four: [
      E({ id: 'crimson.4pc.overloaded', stat: 'reactionBonus.overloaded', value: 0.4 }),
      E({ id: 'crimson.4pc.burning', stat: 'reactionBonus.burning', value: 0.4 }),
      E({ id: 'crimson.4pc.burgeon', stat: 'reactionBonus.burgeon', value: 0.4 }),
      E({ id: 'crimson.4pc.vaporize', stat: 'reactionBonus.vaporize', value: 0.15 }),
      E({ id: 'crimson.4pc.melt', stat: 'reactionBonus.melt', value: 0.15 }),
      // +50% of the 2-piece (15%) = 7.5% per stack, up to 3 stacks, 10 s
      E({ id: 'crimson.4pc.skill', trigger: { on: 'onSkill' }, stat: 'dmgBonus.pyro', value: 0.075, duration: 600, maxStacks: 3 }),
    ],
  },
  {
    id: 'tenacity-of-the-millelith', dbName: 'Tenacity of the Millelith',
    two: [E({ id: 'millelith.2pc.hp', stat: 'hp%', value: 0.2 })],
    four: [E({
      id: 'millelith.4pc.atk', trigger: { on: 'onSkill' }, target: 'team', stat: 'atk%', value: 0.2, duration: 180,
      assumption: 'Triggered when the wearer casts the skill (the game triggers on skill hit); Shield Strength +30% is not modelled.',
    })],
  },
];
