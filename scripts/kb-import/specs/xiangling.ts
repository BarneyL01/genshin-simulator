import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/xiangling (attack.go, charge.go, skill.go, burst.go). Numbers only.
const N = (name: string, param: string, hitmark: number, animation: number, extra: number[] = [], over: Record<string, number> = {}): HitSpec => ({
  name, param, element: 'physical', hitmark: extra.length ? hitmark : hitmark, extraHitmarks: extra.length ? extra : undefined,
  cancel: normalCancel(extra.length ? extra[extra.length - 1]! : hitmark, animation, over),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});

// Burst: 3 initial swings, then Pyronado ticks every 73 frames from frame 56 for 10 s (delay 0..584 step 73 → 9 hits)
const burstCancel = abilCancel(80, { swap: 79 });
const spinFrames = Array.from({ length: 9 }, (_, i) => 56 + 73 * i);
const swing = (name: string, param: string, hitmark: number): HitSpec => ({
  name, param, element: 'pyro', hitmark, cancel: burstCancel, icd: { tag: 'burst', group: 'standard' }, gauge: 1,
});

export const spec: CharacterSpec = {
  id: 'xiangling',
  dbName: 'Xiangling',
  gcsimDir: 'xiangling',
  roles: ['sub-dps', 'off-field-dps'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 12, 20),
      N('N2', 'param2', 8, 17),
      N('N3', 'param3', 11, 28, [18], { charged: 24 }),
      N('N4', 'param4', 5, 37, [15, 24, 29], { charged: 34 }),
      N('N5', 'param5', 21, 70),
    ].map((h) => (h.extraHitmarks ? { ...h, extraHitmarks: h.extraHitmarks } : h)),
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param7' },
    hits: [{
      name: 'Charged', param: 'param6', element: 'physical', hitmark: 24,
      cancel: abilCancel(69, { normal: 67, burst: 67, dash: 24, jump: 24, swap: 66 }),
    }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param2' },
    // Guoba spawns at frame 13; it breathes at 126, 226, 326, 426 (7.3 s = 438 frames)
    hits: [{
      name: 'Guoba flame', param: 'param1', element: 'pyro', hitmark: 126, extraHitmarks: [226, 326, 426],
      cancel: abilCancel(39, { dash: 14, jump: 14, swap: 38 }), icd: { tag: 'none', group: 'none' }, gauge: 1,
    }],
    particles: { count: 1, perHit: true, icd: 60, element: 'pyro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param6' },
    energyCost: { param: 'param7' },
    hits: [
      swing('Pyronado 1-hit swing', 'param1', 18),
      swing('Pyronado 2-hit swing', 'param2', 33),
      swing('Pyronado 3-hit swing', 'param3', 57),
      {
        name: 'Pyronado', param: 'param4', element: 'pyro', hitmark: spinFrames[0]!, extraHitmarks: spinFrames.slice(1),
        cancel: burstCancel, icd: { tag: 'none', group: 'none' }, gauge: 1,
      },
    ],
  },
  passives: [
    {
      id: 'xiangling.a4', unlock: 'a4',
      effects: [{
        id: 'xiangling.a4.atk', trigger: { on: 'onSkill' }, target: 'active', stat: 'atk%', value: 0.1,
        delay: 451, duration: 600, maxStacks: 1, snapshot: false,
        assumption: 'Chili pepper is picked up as soon as Guoba leaves (13 + 438 frames after cast) and benefits whoever is attacking.',
      }],
    },
  ],
  constellations: [
    { level: 1, text: "Opponents hit by Guoba's attacks have their Pyro RES reduced by 15% for 6s.", effects: [{
      id: 'xiangling.c1.pyro-shred', trigger: { on: 'onSkill' }, target: 'enemy', stat: 'res.enemy.pyro', value: -0.15,
      delay: 126, duration: 660, maxStacks: 1, snapshot: false,
      assumption: 'Guoba hits every 100 frames from frame 126 to 426, each refreshing 6 s: modelled as one debuff from 126 to 786.',
    }] },
    { level: 2, text: "The last attack in a Normal Attack sequence applies Implode; it explodes after 2s for 75% ATK Pyro AoE DMG.", effects: [{
      id: 'xiangling.c2.implode', trigger: { on: 'custom' }, target: 'enemy', stat: 'flatDmg.all', value: 0, hook: 'xiangling.c2', maxStacks: 1, snapshot: false,
      assumption: 'Needs a hook: an extra 75% ATK Pyro hit 120 frames after the last hit of a normal chain (non-snapshot, no talent-type scaling).',
    }] },
    { level: 3, text: 'Increases the Level of Pyronado by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: "Pyronado's duration is increased by 40%.", effects: [{
      id: 'xiangling.c4.duration', trigger: { on: 'custom' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'xiangling.c4', maxStacks: 1, snapshot: false,
      assumption: 'Needs a hook: burst spin lasts 14 s instead of 10 s (more Pyronado ticks).',
    }] },
    { level: 5, text: 'Increases the Level of Guoba Attack by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: 'For the duration of Pyronado, all party members receive a 15% Pyro DMG Bonus.', effects: [{
      id: 'xiangling.c6.pyro', trigger: { on: 'onBurst' }, target: 'team', stat: 'dmgBonus.pyro', value: 0.15,
      delay: 56, duration: 600, maxStacks: 1, snapshot: false,
      assumption: 'Duration is the 10 s Pyronado (C4 duration extension not modelled).',
    }] },
  ],
  recommended: {
    weapons: [{ id: 'the-catch', source: 'keqingmains' }, { id: 'favonius-lance', source: 'keqingmains' }, { id: 'staff-of-homa', source: 'keqingmains' }, { id: 'engulfing-lightning', source: 'keqingmains' }],
    artifacts: [{ sets: {"emblem-of-severed-fate": 4}, source: 'keqingmains' }, { sets: {"crimson-witch-of-flames": 4}, source: 'keqingmains' }],
    mainStats: { sands: ["er", "em", "atk%"], goblet: ["dmgBonus.pyro"], circlet: ["critRate", "critDmg"], source: 'keqingmains' },
  },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'burst' }, { action: 'skill' }] },
  ],
  hooks: ['xiangling.c2', 'xiangling.c4'],
  needsHook: true,
  assumptions: [
    'Constellations C2 and C4 need hooks; both are inactive at the default C0.',
    'Frame conflict: KeqingMains lists longer animation lengths than gcsim (burst 97 vs 80 frames to any next action, 96 vs 79 to swap; N1..N5 to next NA 26/22/37/54/80 vs 20/17/28/37/70). gcsim is used per docs/DATA_SOURCES.md; hitmarks agree exactly.',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
  conflicts: [
    { field: 'talents.burst.frames.cancel.default', values: { gcsim: 80, keqingmains: 97 }, chosen: 'gcsim', note: 'animation length to any next action' },
    { field: 'talents.burst.frames.cancel.swap', values: { gcsim: 79, keqingmains: 96 }, chosen: 'gcsim' },
    { field: 'talents.normal.frames.cancel.normal', values: { gcsim: [20, 17, 28, 37, 70], keqingmains: [26, 22, 37, 54, 80] }, chosen: 'gcsim', note: 'N1..N5 to next normal attack' },
  ],
  extraSources: [
    { site: 'keqingmains', url: 'https://keqingmains.com/q/xiangling-quickguide/', fields: ['recommended weapons', 'recommended artifact sets', 'recommended main stats'] },
    { site: 'keqingmains', url: 'https://library.keqingmains.com/characters/pyro/xiangling', fields: ['frames cross-check', 'ICD', 'particles', 'passive/constellation notes'] },
  ],
};
