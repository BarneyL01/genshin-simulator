import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/raiden (attack.go, charge.go, skill.go, burst.go). Numbers only.
const NAME = 'Raiden Shogun';
const N = (name: string, p: string, hitmark: number, animation: number, nextNormal?: number, extra?: { frame: number; param: string }): HitSpec => ({
  name, param: p, element: 'physical', hitmark,
  extraHitmarks: extra ? [extra.frame] : undefined, extraParams: extra ? [extra.param] : undefined,
  cancel: normalCancel(extra ? extra.frame : hitmark, animation, nextNormal === undefined ? {} : { normal: nextNormal }),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
// Musou Isshin (burst state) sword attacks: Electro, burst DMG, share the normal-attack ICD tag
const S = (name: string, p: string, hitmark: number, animation: number, nextNormal?: number, extra?: { frame: number; param: string }): HitSpec => ({
  name, param: p, element: 'electro', hitmark,
  extraHitmarks: extra ? [extra.frame] : undefined, extraParams: extra ? [extra.param] : undefined,
  cancel: normalCancel(extra ? extra.frame : hitmark, animation, nextNormal === undefined ? {} : { normal: nextNormal }),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
const R = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'raiden', ...extra });

const SWORD_HITS = ['Musou Isshin 1', 'Musou Isshin 2', 'Musou Isshin 3', 'Musou Isshin 4', 'Musou Isshin 5', 'Musou Isshin Charged'];

export const spec: CharacterSpec = {
  id: 'raiden-shogun',
  dbName: NAME,
  gcsimDir: 'raiden',
  roles: ['driver', 'battery', 'sub-dps'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 14, 24, 18),
      N('N2', 'param2', 9, 26, 13),
      N('N3', 'param3', 14, 36, 26),
      N('N4', 'param4', 14, 57, 41, { frame: 27, param: 'param5' }),
      N('N5', 'param6', 34, 50),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param8' },
    hits: [{
      name: 'Charged', param: 'param7', element: 'physical', hitmark: 22,
      cancel: abilCancel(37, { dash: 22, jump: 22, swap: 36 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
    }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param5' },
    hits: [{
      name: 'Eye of Stormy Judgement', param: 'param1', element: 'electro', hitmark: 51,
      cancel: abilCancel(37, { dash: 17, jump: 17, swap: 36 }), icd: { tag: 'none', group: 'none' }, gauge: 1,
    }],
    // 50% chance of 1 Electro particle on the hit (gcsim; particle ICD 0.8 s)
    particles: { count: 0.5, perHit: false, icd: 48, element: 'electro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param19' },
    energyCost: { param: 'param20' },
    hits: [{
      name: 'Musou Shinsetsu', param: 'param1', element: 'electro', hitmark: 98,
      cancel: abilCancel(112, { normal: 111, skill: 111, dash: 111, swap: 110 }), icd: { tag: 'burst', group: 'standard' }, gauge: 2,
    }],
  },
  extraActions: {
    'sword-n1': { as: 'normal', damageTalent: 'burst', frameFile: 'attack.go', hits: [S('Musou Isshin 1', 'param5', 12, 21, 19)] },
    'sword-n2': { as: 'normal', damageTalent: 'burst', frameFile: 'attack.go', hits: [S('Musou Isshin 2', 'param6', 13, 26, 16)] },
    'sword-n3': { as: 'normal', damageTalent: 'burst', frameFile: 'attack.go', hits: [S('Musou Isshin 3', 'param7', 11, 34, 16)] },
    'sword-n4': { as: 'normal', damageTalent: 'burst', frameFile: 'attack.go', hits: [S('Musou Isshin 4', 'param8', 22, 67, 44, { frame: 33, param: 'param9' })] },
    'sword-n5': { as: 'normal', damageTalent: 'burst', frameFile: 'attack.go', hits: [S('Musou Isshin 5', 'param10', 33, 59)] },
    'sword-charged': {
      as: 'charged', damageTalent: 'burst', frameFile: 'charge.go',
      hits: [{
        name: 'Musou Isshin Charged', param: 'param11', element: 'electro', hitmark: 24, extraHitmarks: [32], extraParams: ['param12'],
        cancel: abilCancel(56, { dash: 32, jump: 32 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
      }],
    },
  },
  hookHits: {
    'eye-strike': {
      name: 'Eye of Stormy Judgement (coordinated attack)', talent: 'skill', param: 'param2', element: 'electro', gauge: 1,
      icd: { tag: 'skill', group: 'standard' }, frameFile: 'skill.go',
    },
  },
  effects: [
    // Eye: team burst DMG bonus = 0.22% (at Lv9) per point of the character's burst energy cost, for 25 s starting 66 frames after the cast
    effect.parse({
      id: 'raiden.eye.burst-bonus', trigger: { on: 'onSkill' }, target: 'team', stat: 'dmgBonus.burst', value: 0,
      scaling: { from: 'target.energyMax', ratio: { perTalentLevel: param(NAME, 'combat2', 'param4'), talent: 'skill' } },
      delay: 66, duration: 1500,
    }),
    R('raiden.eye', 'onSkill', { delay: 66, duration: 1500 }),
    R('raiden.eye.strike', 'onHit', {
      assumption: 'Coordinated attacks fire on every team hit that deals damage during the Eye (max one per 0.9 s); they are treated as Electro skill damage with the standard ICD.',
    }),
    R('raiden.resolve.gain', 'onAnyBurst', {
      value: { perTalentLevel: param(NAME, 'combat3', 'param4'), talent: 'burst' },
      assumption: "Resolve stacks come only from other characters' bursts (energy cost × stacks per energy, cap 60). Particle pickups (A1) are not counted, so stacks are slightly low.",
    }),
    R('raiden.resolve.base', 'onBurst', {
      trigger: { on: 'onBurst', filter: { hit: 'Musou Shinsetsu' } }, delay: 98, duration: 1,
      value: { perTalentLevel: param(NAME, 'combat3', 'param2'), talent: 'burst' },
    }),
    R('raiden.resolve.sword', 'onBurst', {
      trigger: { on: 'onBurst', filter: { hits: SWORD_HITS.join(',') } }, delay: 98, duration: 420,
      value: { perTalentLevel: param(NAME, 'combat3', 'param3'), talent: 'burst' },
    }),
    R('raiden.musou.restore.normal', 'onNormal', {
      value: { perTalentLevel: param(NAME, 'combat3', 'param17'), talent: 'burst' },
      assumption: 'Sword attack hits restore energy to the whole team, once per second, max 5 per Musou Isshin; sword hits are assumed to land on the enemy.',
    }),
    R('raiden.musou.restore.charged', 'onCharged', { value: { perTalentLevel: param(NAME, 'combat3', 'param17'), talent: 'burst' } }),
  ],
  passives: [
    {
      id: 'raiden.a4', unlock: 'a4',
      effects: [effect.parse({
        id: 'raiden.a4.electro', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.electro', value: 0,
        scaling: { from: 'self.er', ratio: 0.4, base: -0.4 },
        assumption: '0.4% Electro DMG per 1% ER over 100%, evaluated at hit time. The energy restoration part of A4 is in the Musou restore hook.',
      })],
    },
  ],
  constellations: [
    { level: 1, text: 'Chakra Desiderata gathers Resolve faster: +80% from Electro characters bursts, +20% from others.', effects: [R('raiden.c1', 'always')] },
    { level: 2, text: "While using Musou no Hitotachi and in Musou Isshin, attacks ignore 60% of opponents' DEF.", effects: [
      effect.parse({ id: 'raiden.c2.def-ignore', trigger: { on: 'onBurst' }, target: 'self', stat: 'defIgnore', value: 0.6, delay: 98, duration: 420 }),
    ] },
    { level: 3, text: 'Increases the Level of Secret Art: Musou Shinsetsu by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: 'When Musou Isshin expires, all nearby party members (excluding Raiden) gain 30% ATK for 10 s.', effects: [
      effect.parse({
        id: 'raiden.c4.atk', trigger: { on: 'onBurst' }, target: 'teamExceptSelf', stat: 'atk%', value: 0.3, delay: 518, duration: 600,
        assumption: 'Musou Isshin is assumed to last its full 7 s (Raiden does not swap out early).',
      }),
    ] },
    { level: 5, text: 'Increases the Level of Transcendence: Baleful Omen by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: "Musou Isshin burst attacks reduce other party members' burst CD by 1 s (max once per second, 5 times).", effects: [
      effect.parse({
        id: 'raiden.c6.cd', trigger: { on: 'custom' }, target: 'teamExceptSelf', stat: 'flatDmg.all', value: 0, hook: 'raiden.c6',
        assumption: 'Needs a hook that shortens other characters burst cooldowns; not implemented.',
      }),
    ] },
  ],
  recommended: {
    weapons: [{ id: 'engulfing-lightning', source: 'keqingmains' }, { id: 'the-catch', source: 'keqingmains' }],
    artifacts: [{ sets: {"emblem-of-severed-fate": 4}, source: 'keqingmains' }],
    mainStats: { sands: ["atk%", "er", "em"], goblet: ["dmgBonus.electro", "atk%"], circlet: ["critRate", "critDmg"], source: 'keqingmains' },
  },
  extraSources: [{ site: 'keqingmains', url: 'https://keqingmains.com/q/raiden-quickguide/', fields: ['recommended weapons', 'recommended artifact sets', 'recommended main stats'] }],
  usualCombo: [
    { variant: 'on-field', actions: [
      { action: 'skill' }, { action: 'burst' },
      { action: 'sword-n1' }, { action: 'sword-n2' }, { action: 'sword-n3' }, { action: 'sword-n4' }, { action: 'sword-n5' },
    ] },
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
  ],
  hooks: ['raiden', 'raiden.c6'],
  needsHook: true,
  assumptions: [
    'Musou Isshin sword attacks are the extra actions sword-n1..sword-n5 and sword-charged; rotations must use them after the burst (they count as normal/charged attacks for triggers but deal burst DMG).',
    'Resolve, energy restoration and the Eye run through hook "raiden" (src/engine/hooks/raiden.ts, tested in tests/hooks.test.ts). A1 (Resolve per particle) and C6 are not modelled.',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
};
