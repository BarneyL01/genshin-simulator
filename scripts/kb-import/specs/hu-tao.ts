import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/hutao (attack.go ppAttack*, charge.go pp*, skill.go, burst.go). Numbers only.
// Paramita Papilio frames are used for every normal/charged attack: Hu Tao fights inside Paramita.
const NAME = 'Hu Tao';
const N = (name: string, p: string, hitmark: number, animation: number, over: Record<string, number> = {}, extra?: { frame: number; param: string }): HitSpec => ({
  name, param: p, element: 'physical', hitmark,
  extraHitmarks: extra ? [extra.frame] : undefined, extraParams: extra ? [extra.param] : undefined,
  cancel: normalCancel(extra ? extra.frame : hitmark, animation, over),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
const H = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'hutao', ...extra });
const PARAMITA = 554; // 540 frames of Paramita + 14 frames of cast

export const spec: CharacterSpec = {
  id: 'hu-tao',
  dbName: NAME,
  gcsimDir: 'hutao',
  roles: ['driver', 'main-dps'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 12, 20, { normal: 14 }),
      N('N2', 'param2', 9, 16, { normal: 12 }),
      N('N3', 'param3', 17, 26, { charged: 23 }),
      N('N4', 'param4', 22, 31, { normal: 29 }),
      N('N5', 'param5', 15, 48, { normal: 36 }, { frame: 26, param: 'param6' }),
      N('N6', 'param7', 27, 72),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param9' },
    hits: [{
      name: 'Charged (Paramita)', param: 'param8', element: 'physical', hitmark: 3,
      cancel: abilCancel(42, { burst: 33, dash: 3, jump: 3 }), icd: { tag: 'extra', group: 'poleExtraAttack' }, gauge: 1,
    }],
    // 2 particles, 50% chance of 3 (gcsim): expected 2.5, at most once per 5 s while Paramita is up
    particles: { count: 2.5, perHit: false, icd: 300, element: 'pyro' },
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param6' },
    hits: [],
    noHitCancel: abilCancel(52, { normal: 29, burst: 28, dash: 37, jump: 37 }),
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param5' },
    energyCost: { param: 'param6' },
    hits: [{
      // Low HP version (Hu Tao at or below 50% HP); see assumptions
      name: 'Spirit Soother (Low HP)', param: 'param2', element: 'pyro', hitmark: 66,
      cancel: abilCancel(98, { normal: 97, skill: 97, swap: 95 }), icd: { tag: 'none', group: 'none' }, gauge: 2,
    }],
  },
  hookHits: {
    'blood-blossom': {
      name: 'Blood Blossom', talent: 'skill', param: 'param3', element: 'pyro', gauge: 1,
      icd: { tag: 'none', group: 'none' }, frameFile: 'skill.go',
    },
  },
  effects: [
    effect.parse({
      id: 'hutao.paramita.atk', trigger: { on: 'onSkill' }, target: 'self', stat: 'atk', value: 0, duration: PARAMITA,
      scaling: {
        from: 'self.hp', ratio: { perTalentLevel: param(NAME, 'combat2', 'param2'), talent: 'skill' },
        capFrom: { from: 'baseAtk', ratio: 4 },
      },
      assumption: 'Paramita Papilio ATK bonus = Max HP × ratio, capped at 400% of base ATK (character + weapon). HP cost of the skill is not tracked.',
    }),
    effect.parse({ id: 'hutao.paramita.infusion', trigger: { on: 'onSkill' }, target: 'self', stat: 'infusion.pyro', value: 1, duration: PARAMITA }),
    H('hutao.bb', 'onCharged', { assumption: 'Charged attacks are assumed to be Paramita charged attacks, which apply Blood Blossom (on every charged hit).' }),
    H('hutao.bb.burst', 'onBurst'),
  ],
  passives: [
    {
      id: 'hutao.a1', unlock: 'a1',
      effects: [effect.parse({
        id: 'hutao.a1.crit', trigger: { on: 'onSkill' }, target: 'teamExceptSelf', stat: 'critRate', value: 0.12, delay: PARAMITA, duration: 480,
        assumption: 'Applies when Paramita Papilio ends (assumed to run its full 9 s).',
      })],
    },
    {
      id: 'hutao.a4', unlock: 'a4',
      effects: [effect.parse({
        id: 'hutao.a4.pyro', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.pyro', value: 0.33, condition: { hpBelow: 0.5 },
        assumption: 'Hu Tao is assumed to be at or below 50% HP (the sim does not track HP).',
      })],
    },
  ],
  constellations: [
    { level: 1, text: 'In Paramita Papilio, charged attacks do not consume Stamina.', effects: [] },
    { level: 2, text: "Blood Blossom DMG +10% of Hu Tao's Max HP; the burst also applies Blood Blossom.", effects: [H('hutao.c2', 'always')] },
    { level: 3, text: 'Increases the Level of Guide to Afterlife by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "On defeating an enemy with Blood Blossom, allies gain 12% CRIT Rate for 15 s.", effects: [
      effect.parse({
        id: 'hutao.c4', trigger: { on: 'custom' }, target: 'teamExceptSelf', stat: 'critRate', value: 0.12, hook: 'hutao.c4',
        assumption: 'Needs enemy defeat events, which the sim does not have; not modelled.',
      }),
    ] },
    { level: 5, text: 'Increases the Level of Spirit Soother by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: 'Below 25% HP: +200% RES and +100% CRIT Rate for 10 s.', effects: [
      effect.parse({
        id: 'hutao.c6.crit', trigger: { on: 'custom' }, target: 'self', stat: 'critRate', value: 1, hook: 'hutao.c6',
        assumption: 'Needs low-HP state tracking; not modelled.',
      }),
    ] },
  ],
  recommended: {
    weapons: [{ id: 'staff-of-homa', source: 'keqingmains' }],
    artifacts: [{ sets: {"crimson-witch-of-flames": 4}, source: 'keqingmains' }],
    mainStats: { sands: ["em", "hp%"], goblet: ["dmgBonus.pyro"], circlet: ["critRate", "critDmg"], source: 'keqingmains' },
  },
  extraSources: [{ site: 'keqingmains', url: 'https://keqingmains.com/q/hu-tao-quickguide/', fields: ['recommended weapons', 'recommended artifact sets', 'recommended main stats'] }],
  usualCombo: [
    { variant: 'on-field', actions: [
      { action: 'skill' }, { action: 'burst' },
      { action: 'normal', hits: 1, then: 'charged', repeat: 'untilRotationEnd' },
    ] },
  ],
  hooks: ['hutao', 'hutao.c4', 'hutao.c6'],
  needsHook: true,
  assumptions: [
    'Normal and charged attack frames are the Paramita Papilio versions (gcsim ppAttack / ppCharge); the plain versions differ slightly and are not in the KB. Normal attacks become Pyro through the skill\'s infusion.',
    'The burst is the Low HP version (Hu Tao at or below 50% HP), as are A4 and the Staff of Homa bonus. The sim does not track HP.',
    'Blood Blossom runs through hook "hutao" (src/engine/hooks/hutao.ts, tested in tests/hooks.test.ts).',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
};
