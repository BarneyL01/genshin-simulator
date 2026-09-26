import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/yelan (attack.go, skill.go, burst.go, asc.go, yelan.go). Numbers only.
// Arrows land 10 frames after the release frame (gcsim default "travel").
const TRAVEL = 10;
const N = (name: string, p: string, hitmark: number, animation: number, extra?: number): HitSpec => ({
  name, param: p, element: 'physical', hitmark: hitmark + TRAVEL,
  extraHitmarks: extra !== undefined ? [extra + TRAVEL] : undefined, extraParams: extra !== undefined ? [p] : undefined,
  cancel: normalCancel(extra ?? hitmark, animation),
  icd: { tag: 'none', group: 'none' }, gauge: 1,
});
const Y = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'yelan', ...extra });

export const spec: CharacterSpec = {
  id: 'yelan',
  dbName: 'Yelan',
  gcsimDir: 'yelan',
  roles: ['sub-dps', 'off-field-dps', 'buffer'],
  normal: {
    frameFile: 'attack.go',
    hits: [N('N1', 'param1', 13, 15), N('N2', 'param2', 13, 21), N('N3', 'param3', 18, 38), N('N4', 'param4', 15, 67, 29)],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param4' },
    // Lifeline explodes 36 frames after the cast; damage scales with Max HP
    hits: [{
      name: 'Lingering Lifeline', param: 'param1', scaling: 'hp', element: 'hydro', hitmark: 36,
      cancel: abilCancel(42, { burst: 41, dash: 41, jump: 41, swap: 40 }), icd: { tag: 'none', group: 'none' }, gauge: 1,
    }],
    particles: { count: 4, perHit: false, icd: 18, element: 'hydro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param4' },
    energyCost: { param: 'param5' },
    hits: [{
      name: 'Depth-Clarion Dice', param: 'param1', scaling: 'hp', element: 'hydro', hitmark: 76,
      cancel: abilCancel(93, { skill: 92, jump: 91, swap: 90 }), icd: { tag: 'none', group: 'none' }, gauge: 2,
    }],
  },
  hookHits: {
    'exquisite-throw': {
      name: 'Exquisite Throw', talent: 'burst', param: 'param2', scaling: 'hp', element: 'hydro', gauge: 1,
      icd: { tag: 'yelanBurst', group: 'yelanBurst' }, frameFile: 'burst.go',
    },
    'exquisite-throw-c2': {
      name: 'Exquisite Throw (C2)', talent: 'burst', constantMv: 0, scaling: 'hp', element: 'hydro', gauge: 1,
      icd: { tag: 'none', group: 'none' }, frameFile: 'burst.go',
    },
  },
  effects: [
    Y('yelan.a1-hp', 'always', {
      trigger: { on: 'always', filter: { '1': '0.06', '2': '0.12', '3': '0.18', '4': '0.3' } },
      assumption: 'Max HP bonus by number of elemental types among the four party members (6/12/18/30%).',
    }),
    Y('yelan.burst.state', 'onBurst', { delay: 76, duration: 900 }),
    Y('yelan.burst.wave', 'onAnyNormal', {
      assumption: 'While Depth-Clarion Dice is up, any team member starting a normal attack fires an Exquisite Throw (max one per 60 frames, 3 arrows landing 20/26/32 frames later).',
    }),
    Y('yelan.burst.skill', 'onSkill', { delay: 36 }),
  ],
  passives: [
    {
      id: 'yelan.a1', unlock: 'a1',
      effects: [],
    },
    {
      id: 'yelan.a4', unlock: 'a4',
      effects: [],
    },
  ],
  constellations: [
    { level: 1, text: 'Lingering Lifeline gains 1 additional charge.', effects: [] },
    { level: 2, text: 'Exquisite Throw fires an additional arrow worth 14% of Yelan\'s Max HP as Hydro DMG (once per 1.8 s).', effects: [Y('yelan.c2', 'always')] },
    { level: 3, text: 'Increases the Level of Depth-Clarion Dice by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: "All party members' Max HP +10% for 25 s per enemy marked by Lifeline (max 40%).", effects: [
      effect.parse({
        id: 'yelan.c4.hp', trigger: { on: 'onSkill' }, target: 'team', stat: 'hp%', value: 0.1, delay: 36, duration: 1500,
        assumption: 'Single-target sim: one enemy marked, +10% Max HP for 25 s.',
      }),
    ] },
    { level: 5, text: 'Increases the Level of Lingering Lifeline by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: 'After the burst, Yelan enters Mastermind: her normal attacks are Breakthrough Barbs (156% damage, Charged Attack DMG) for 5 arrows / 20 s.', effects: [
      effect.parse({
        id: 'yelan.c6', trigger: { on: 'custom' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'yelan.c6',
        assumption: 'Needs a hook and the Breakthrough Barb action; not modelled.',
      }),
    ] },
  ],
  recommended: {
    weapons: [{ id: 'aqua-simulacra', source: 'keqingmains' }, { id: 'favonius-warbow', source: 'keqingmains' }],
    artifacts: [{ sets: {"emblem-of-severed-fate": 4}, source: 'keqingmains' }, { sets: {"noblesse-oblige": 4}, source: 'keqingmains' }],
    mainStats: { sands: ["hp%", "er"], goblet: ["dmgBonus.hydro", "hp%"], circlet: ["critRate", "critDmg", "hp%"], source: 'keqingmains' },
  },
  extraSources: [{ site: 'keqingmains', url: 'https://keqingmains.com/q/yelan-quickguide/', fields: ['recommended weapons', 'recommended artifact sets', 'recommended main stats'] }],
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'burst' }, { action: 'skill' }] },
  ],
  hooks: ['yelan', 'yelan.c6'],
  needsHook: true,
  assumptions: [
    'Skill and burst damage scale with Max HP (hits use scaling "hp").',
    'Exquisite Throw, the A4 damage ramp and the A1 Max HP bonus run through hook "yelan" (src/engine/hooks/yelan.ts, tested in tests/hooks.test.ts). A4 applies only while the attacker is on the field.',
    'Only the skill press is modelled (no hold, no Breakthrough Barb / aimed shots, no plunge). C1 extra charge is not modelled.',
    'Yelan\'s normal attacks are physical arrows; they land 10 frames after release.',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
};
