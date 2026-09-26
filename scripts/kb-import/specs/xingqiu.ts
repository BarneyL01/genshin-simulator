import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/xingqiu (attack.go, charge.go, skill.go, burst.go, orbital.go). Numbers only.
const N = (name: string, p: string, hitmark: number, animation: number, nextNormal?: number, extra?: { frame: number; param: string }): HitSpec => ({
  name, param: p, element: 'physical', hitmark,
  extraHitmarks: extra ? [extra.frame] : undefined, extraParams: extra ? [extra.param] : undefined,
  cancel: normalCancel(extra ? extra.frame : hitmark, animation, nextNormal === undefined ? {} : { normal: nextNormal }),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
const H = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'xingqiu', ...extra });

export const spec: CharacterSpec = {
  id: 'xingqiu',
  dbName: 'Xingqiu',
  gcsimDir: 'xingqiu',
  roles: ['sub-dps', 'hydro-applicator', 'off-field-dps'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 10, 35, 18),
      N('N2', 'param2', 13, 29, 24),
      N('N3', 'param3', 9, 35, 26, { frame: 19, param: 'param4' }),
      N('N4', 'param5', 17, 33, 28),
      N('N5', 'param6', 18, 66, undefined, { frame: 39, param: 'param7' }),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param10' },
    hits: [{
      name: 'Charged', param: 'param8', element: 'physical', hitmark: 8, extraHitmarks: [20], extraParams: ['param9'],
      cancel: abilCancel(58, { skill: 32, burst: 32, dash: 20, jump: 20, swap: 31 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
    }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param5' },
    hits: [{
      name: 'Fatal Rainscreen', param: 'param1', element: 'hydro', hitmark: 12, extraHitmarks: [31], extraParams: ['param2'],
      cancel: abilCancel(67, { skill: 65, dash: 31, jump: 34 }), icd: { tag: 'none', group: 'none' }, gauge: 1,
    }],
    // gcsim: 5 Hydro particles, particle ICD 1 s (the second hit does not drop more)
    particles: { count: 5, perHit: false, icd: 60, element: 'hydro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param3' },
    energyCost: { param: 'param4' },
    hits: [],
    noHitCancel: abilCancel(40, { normal: 33, skill: 33, dash: 33, jump: 33 }),
  },
  hookHits: {
    orbital: {
      name: 'Orbital (Hydro application)', talent: 'burst', constantMv: 0, element: 'hydro', gauge: 1,
      icd: { tag: 'none', group: 'none' }, frameFile: 'orbital.go',
    },
    'sword-rain': {
      name: 'Sword Rain', talent: 'burst', param: 'param1', element: 'hydro', gauge: 1,
      icd: { tag: 'burst', group: 'standard' }, frameFile: 'burst.go',
    },
  },
  effects: [
    H('xingqiu.orbital.skill', 'onSkill', { delay: 43, duration: 900 }),
    H('xingqiu.orbital.burst', 'onBurst', { delay: 18, duration: 900 }),
    H('xingqiu.burst.state', 'onBurst', { duration: 900 }),
    H('xingqiu.burst.wave', 'onAnyNormal', {
      assumption: 'Any team member starting a normal attack while Raincutter is up summons a wave (max one per 60 frames); swords land 20 frames later.',
    }),
  ],
  passives: [
    {
      id: 'xingqiu.a4', unlock: 'a4',
      effects: [effect.parse({ id: 'xingqiu.a4.hydro', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.hydro', value: 0.2 })],
    },
  ],
  constellations: [
    { level: 1, text: 'Increases the maximum number of Rain Swords by 1.', effects: [] },
    { level: 2, text: 'Extends the duration of Raincutter by 3s. Decreases the Hydro RES of opponents hit by sword rain attacks by 15% for 4s.', effects: [
      H('xingqiu.c2', 'always', { duration: 180 }),
    ] },
    { level: 3, text: 'Increases the Level of Guhua Sword: Raincutter by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: "Throughout Raincutter, the DMG of Fatal Rainscreen is increased by 50%.", effects: [
      effect.parse({
        id: 'xingqiu.c4.skill', trigger: { on: 'onBurst' }, target: 'self', stat: 'baseDmgMultiplier.skill', value: 0.5, duration: 933,
        assumption: 'Lasts the base 15 s of Raincutter plus animation; the C2 extension is not added here.',
      }),
    ] },
    { level: 5, text: 'Increases the Level of Guhua Sword: Fatal Rainscreen by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: "Activating 2 of Raincutter's sword rain attacks greatly enhances the third sword rain attack: it also regenerates 3 Energy.", effects: [
      H('xingqiu.c6', 'always'),
    ] },
  ],
  recommended: {
    weapons: [{ id: 'favonius-sword', source: 'keqingmains' }],
    artifacts: [{ sets: {"emblem-of-severed-fate": 4}, source: 'keqingmains' }, { sets: {"noblesse-oblige": 4}, source: 'keqingmains' }],
    mainStats: { sands: ["er", "atk%"], goblet: ["dmgBonus.hydro"], circlet: ["critRate", "critDmg"], source: 'keqingmains' },
  },
  extraSources: [{ site: 'keqingmains', url: 'https://keqingmains.com/q/xingqiu-quickguide/', fields: ['recommended weapons', 'recommended artifact sets', 'recommended main stats'] }],
  usualCombo: [{ variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] }],
  hooks: ['xingqiu'],
  needsHook: true,
  assumptions: [
    'Orbitals, Rain Sword waves and the C2/C6 effects run through hook "xingqiu" (src/engine/hooks/xingqiu.ts, tested in tests/hooks.test.ts).',
    'Plunge attacks and the Rain Sword shield (damage reduction, A1 healing) are not in the KB.',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
};
