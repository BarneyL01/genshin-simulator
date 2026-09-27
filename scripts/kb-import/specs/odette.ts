import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

// Odette. Frames, ICD and mechanics: gcsim internal/characters/odette (attack.go, charge.go, skill.go, burst.go,
// asc.go, stellar.go). Numbers only; the behaviour is re-implemented in src/engine/hooks/odette.ts.
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const O = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'odette', ...extra });

export const spec: CharacterSpec = {
  id: 'odette',
  dbName: 'Odette',
  gcsimDir: 'odette',
  roles: ['off-field-dps', 'stellar-conduct-enabler'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 9, normalCancel(9, 25, { normal: 17 })),
      N('N2', 'param2', 9, normalCancel(9, 23, { normal: 19, charged: 21 })),
      N('N3', 'param3', 16, normalCancel(31, 69, { normal: 54 }), { extraHitmarks: [31], extraParams: ['param4'] }),
      N('N4', 'param5', 15, normalCancel(15, 85, { normal: 53, charged: 73 })),
      N('N5', 'param6', 15, normalCancel(15, 70, { normal: 62 })),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param8' },
    hits: [{
      name: 'Charged', param: 'param7', element: 'physical', hitmark: 30,
      cancel: abilCancel(83, { normal: 83, skill: 57, burst: 58, dash: 30, jump: 30, swap: 30 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
    }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param12' },
    hits: [{
      name: 'Adagio: Phantom Night Dancers', param: 'param1', element: 'cryo', hitmark: 23,
      cancel: abilCancel(42, { normal: 41, skill: 41, burst: 41, dash: 40, walk: 41, swap: 40 }), icd: { tag: 'none', group: 'none' }, gauge: 1,
    }],
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param6' },
    energyCost: { param: 'param7' },
    hits: [{
      name: 'Slash', param: 'param1', element: 'cryo', hitmark: 112, extraHitmarks: [128, 140],
      cancel: abilCancel(126, { normal: 108, skill: 107, dash: 108, jump: 109, swap: 106 }), icd: { tag: 'burst', group: 'standard' }, gauge: 1,
    }, {
      name: 'Final Slash', param: 'param2', element: 'cryo', hitmark: 144,
      cancel: abilCancel(126, { normal: 108, skill: 107, dash: 108, jump: 109, swap: 106 }), icd: { tag: 'burst', group: 'standard' }, gauge: 1,
    }],
  },
  extraActions: {
    // Special Elemental Skill, available for 6 s after the Skill or the Burst. Separate 15 s cooldown.
    coda: {
      as: 'skill', damageTalent: 'skill', frameFile: 'skill.go', cooldown: { param: 'param13' },
      hits: [{
        name: "Coda at Dawn's Tolling DoT", param: 'param2', element: 'cryo', hitmark: 11, extraHitmarks: [20, 28],
        cancel: abilCancel(76, { normal: 75, burst: 76, dash: 74, jump: 75, walk: 75, swap: 74 }), icd: { tag: 'odetteDanceDuo', group: 'odetteDanceDuo' }, gauge: 1,
      }],
    },
  },
  hookHits: {
    plume: { name: '"Plume" Dance Move', talent: 'skill', param: 'param5', element: 'cryo', gauge: 1, icd: { tag: 'none', group: 'none' }, frameFile: 'skill.go' },
    wing: { name: '"Wing" Dance Move', talent: 'skill', param: 'param8', element: 'cryo', gauge: 1, icd: { tag: 'none', group: 'none' }, frameFile: 'skill.go' },
    'plume-ssc': { name: '"Plume" Dance Move (Stellar-Conduct)', talent: 'skill', param: 'param6', element: 'cryo', gauge: 0, icd: { tag: 'none', group: 'none' }, frameFile: 'skill.go' },
    'wing-ssc': { name: '"Wing" Dance Move (Stellar-Conduct)', talent: 'skill', param: 'param9', element: 'cryo', gauge: 0, icd: { tag: 'none', group: 'none' }, frameFile: 'skill.go' },
    'coda-ssc': { name: "Coda at Dawn's Tolling (Stellar-Conduct)", talent: 'skill', param: 'param3', element: 'cryo', gauge: 0, icd: { tag: 'none', group: 'none' }, frameFile: 'skill.go' },
  },
  effects: [
    effect.parse({
      id: 'odette.stellar-conduct', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'stellar-conduct',
      assumption: 'Stellar Jubilee: with Odette in the team, Superconduct becomes Stellar-Conduct (Polestar Field). The team is assumed to stand inside the field. Cryo Swirl → Stellar Swirl is not modelled.',
    }),
    effect.parse({
      id: 'odette.jubilee-base', trigger: { on: 'always' }, target: 'team', stat: 'baseDmgMultiplier.stellarGlimmer', value: 0,
      scaling: { from: 'self.atk', ratio: 0.00007, cap: 0.14 },
      assumption: "Stellar Jubilee: Stellar Glimmer (direct Stellar-Conduct) Base DMG of every party member +0.7% per 100 of Odette's ATK, max 14%, evaluated at hit time.",
    }),
    O('odette.skill', 'onSkill', { assumption: 'Skill summons the Solo Dance Double (21 s); Coda at Dawn\'s Tolling (action "coda") is available for 6 s after the Skill or Burst and upgrades the Double for 20 s.' }),
    O('odette.burst', 'onBurst', {
      value: { perTalentLevel: param('Odette', 'combat3', 'param3'), talent: 'burst' },
      assumption: "Snow Swan's Dream: Odette's Stellar Glimmer reaction DMG bonus for 20 s from the final slash.",
    }),
    O('odette.a1', 'always', { assumption: 'Marvelous Splendor: 4 stacks on summoning the Double, +15% Stellar Glimmer reaction DMG each; while Odette is off-field one stack moves to the other party members every ~1 s (59.25 frames).' }),
    O('odette.a4', 'always', { assumption: 'Pathetique: Odette\'s Stellar Glimmer multipliers ×(1 + 1.5% per 100 ATK above 1,000), at most ×1.3, evaluated at hit time.' }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'Coda at Dawn\'s Tolling deals an extra Stellar Glimmer hit (300%/450% ATK); Marvelous Splendor +2 stacks and moves 2 per second.', effects: [] },
    { level: 2, text: 'Each Marvelous Splendor stack also gives +7% ATK; in Radiance, enemies near the Double lose 20% RES to the matching elements.', effects: [] },
    { level: 3, text: 'Increases the Level of Adagio: Phantom Night Dancers by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "Snow Swan's Dream also gives other party members 50% of its bonus; Odette joins other members' Stellar Glimmer hits with a coordinated attack (66%/99% ATK, every 3.5 s).", effects: [] },
    { level: 5, text: 'Increases the Level of Presto: Bluebird Finale by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: 'Odette keeps her Marvelous Splendor stacks when granting them; Stellar Glimmer DMG of affected characters elevated by 25% (Odette +20% more).', effects: [] },
  ],
  recommended: {
    weapons: [],
    artifacts: [],
    mainStats: { sands: ['atk%', 'em'], goblet: ['atk%', 'em', 'dmgBonus.cryo'], circlet: ['critRate', 'critDmg'], source: 'template' },
  },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'coda' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'coda' }, { action: 'normal', hits: 5, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['odette', 'stellar-conduct'],
  needsHook: true,
  assumptions: [
    'Constellations C1, C2, C4 and C6 are not modelled (text kept); C3/C5 talent levels are.',
    'The first burst slash is blunt in gcsim (can shatter Frozen); here no burst hit is blunt.',
    'Radiance: Stellar Swirl (Cryo Swirl → Stellar Swirl, and its Stellar Glimmer forms) is not modelled: only Stellar-Conduct.',
    'Main stats are reasoned from the damage formula (Stellar Glimmer ignores DMG%, scales with ATK and EM), not from a guide.',
    'usualCombo (Skill → Burst → Coda) follows the kit text: Coda is only available for 6 s after the Skill or Burst. No guide rotation was available.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/odette', fields: ['frames', 'Dance Double timing', 'Marvelous Splendor ticks', 'Stellar Glimmer formulas'] },
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/blob/488e22309e4ef43481923bfafe21b62d2a17b661/pkg/enemy/damage.go', fields: ['direct reaction damage formula'] },
  ],
};
