import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

// Cryo Traveler (male frames; the female frames differ by a few frames per attack).
// Frames: gcsim internal/characters/traveler/common/cryo (attack.go, charge.go, skill.go, burst.go). Numbers only.
const TN = 'Traveler (Cryo)';
const N = (name: string, p: string, hitmark: number, animation: number, nextNormal?: number): HitSpec => ({
  name, param: p, element: 'physical', hitmark,
  cancel: normalCancel(hitmark, animation, nextNormal === undefined ? {} : { normal: nextNormal }),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
const T = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'travelercryo', ...extra });

export const spec: CharacterSpec = {
  id: 'traveler-cryo',
  dbName: 'Aether',
  talentsName: TN,
  displayName: 'Traveler (Cryo)',
  element: 'cryo',
  gcsimDir: 'traveler/common/cryo',
  gcsimTables: ['stats.go'],
  roles: ['sub-dps', 'stellar-conduct-enabler', 'off-field-dps'],
  normal: {
    frameFile: 'attack.go',
    hits: [N('N1', 'param1', 13, 28, 17), N('N2', 'param2', 13, 28, 26), N('N3', 'param3', 16, 36, 32), N('N4', 'param4', 30, 45, 39), N('N5', 'param5', 25, 69)],
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param8' },
    hits: [{
      name: 'Charged', param: 'param6', element: 'physical', hitmark: 9, extraHitmarks: [20], extraParams: ['param7'],
      cancel: abilCancel(55, { skill: 37, burst: 36, dash: 20, jump: 20, swap: 44 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
    }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param3' },
    hits: [{
      name: 'Ice Fog Piercer', param: 'param1', element: 'cryo', hitmark: 19,
      cancel: abilCancel(66, { normal: 32, skill: 33, burst: 33, dash: 33, jump: 33, swap: 32 }), icd: { tag: 'skill', group: 'standard' }, gauge: 1,
    }],
    particles: { count: 3, perHit: false, icd: 18, element: 'cryo' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param6' },
    energyCost: { param: 'param7' },
    hits: [],
    noHitCancel: abilCancel(75, { skill: 74, jump: 74, swap: 73 }),
  },
  hookHits: {
    frostpierce: {
      name: 'Frostpierce Star crystal', talent: 'skill', param: 'param2', element: 'cryo', gauge: 1,
      icd: { tag: 'icicle', group: 'travelerCryoIcicle' }, frameFile: 'skill.go',
    },
    javelin: {
      name: 'Ice Javelin', talent: 'burst', param: 'param1', element: 'cryo', gauge: 1,
      icd: { tag: 'burst', group: 'standard' }, frameFile: 'burst.go',
    },
    'javelin-stellar': {
      name: 'Ice Javelin (Stellar-Conduct)', talent: 'burst', param: 'param8', element: 'cryo', gauge: 0,
      icd: { tag: 'burst', group: 'standard' }, frameFile: 'burst.go',
    },
  },
  effects: [
    effect.parse({
      id: 'traveler-cryo.stellar-conduct', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'stellar-conduct',
      assumption: 'Stellar Jubilee: with this character in the team, Superconduct becomes Stellar-Conduct (Polestar Field: team Cryo/Electro DMG%, −40% physical RES). The team is assumed to stand inside the field.',
    }),
    effect.parse({
      id: 'traveler-cryo.a4', trigger: { on: 'always' }, target: 'self', stat: 'em', value: 0,
      scaling: { from: 'self.atk', ratio: 0.08, cap: 160 },
      assumption: 'Elemental Mastery = 8% of ATK, at most 160, evaluated at hit time.',
    }),
    T('traveler-cryo.a1', 'always', { assumption: 'Radiance: Stellar-Conduct conversion needs a Polestar Field (from a Superconduct-type reaction) and the Frostpierce Star up.' }),
    T('traveler-cryo.skill', 'onSkill', { duration: 720 }),
    T('traveler-cryo.stellar-hit', 'onHit'),
    T('traveler-cryo.burst', 'onBurst', { value: { perTalentLevel: param(TN, 'combat3', 'param2'), talent: 'burst' } }),
    T('traveler-cryo.burst.stellar', 'custom', { value: { perTalentLevel: param(TN, 'combat3', 'param9'), talent: 'burst' } }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'Regenerates 5 Elemental Energy when dealing Stellar Glimmer DMG (once per 0.5 s).', effects: [
      effect.parse({ id: 'traveler-cryo.c1', trigger: { on: 'custom' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'traveler-cryo.c1', assumption: 'Not modelled (needs Stellar Glimmer damage events).' }),
    ] },
    { level: 2, text: "The active character's Elemental Mastery +60 for 5 s when an ice crystal hits (120 with a Stellar Glimmer reaction).", effects: [T('traveler-cryo.c2', 'always')] },
    { level: 3, text: 'Increases the Level of Frostbound Javelin by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: 'The Frostpierce Star lasts 25% longer.', effects: [T('traveler-cryo.c4', 'always')] },
    { level: 5, text: 'Increases the Level of Ice Fog Piercer by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: 'Each Frostglow stack consumed by the burst raises other party members\' Stellar Glimmer reaction DMG by 5% for 15 s (max 40%).', effects: [
      effect.parse({ id: 'traveler-cryo.c6', trigger: { on: 'custom' }, target: 'teamExceptSelf', stat: 'flatDmg.all', value: 0, hook: 'traveler-cryo.c6', assumption: 'Not modelled.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['atk%', 'em'], goblet: ['dmgBonus.cryo'], circlet: ['critRate', 'critDmg'], source: 'template' } },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'normal', hits: 5, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['travelercryo', 'stellar-conduct', 'traveler-cryo.c1', 'traveler-cryo.c6'],
  needsHook: true,
  assumptions: [
    'Male Traveler frames (gcsim); the female Traveler differs by a few frames.',
    'Stellar Swirl (the Anemo counterpart of Stellar-Conduct), the True Moon effects and C1/C6 are not modelled.',
    'Recommended main stats are a generic template (no KeqingMains row parsed for this character).',
    'usualCombo is generic; no source rotation.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/3d48bd5044b2841d840d59888b48f4483252ff8d/pkg/reactable', fields: ['Stellar-Conduct field'] },
    { site: 'keqingmains', url: 'https://keqingmains.com/q/sandrone-quickguide/', fields: ['role in Stellar-Conduct teams'] },
  ],
};
