import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Jean. Frames and mechanics: gcsim internal/characters/jean (attack.go, charge.go, skill.go, burst.go, asc.go,
// cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/jean.ts.
//
// This sim does not track healing, so Jean's actual purpose (Wind Companion party heal, Dandelion Breeze's
// heal-over-time) contributes nothing to its output; what IS modelled is her (small) direct damage and the
// support pieces that matter for damage: Dandelion Breeze's periodic self-Swirl ticks (real damage via the
// reaction engine if a party member has applied another element nearby) and its Anemo RES shred at C4.
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const J = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'jean', ...extra });

export const spec: CharacterSpec = {
  id: 'jean',
  dbName: 'Jean',
  gcsimDir: 'jean',
  roles: ['support'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 13, normalCancel(13, 25, { normal: 22 })),
      N('N2', 'param2', 6, normalCancel(6, 20, { normal: 14 })),
      N('N3', 'param3', 17, normalCancel(17, 31, { normal: 28 })),
      N('N4', 'param4', 37, normalCancel(37, 49, { normal: 44 })),
      N('N5', 'param5', 25, normalCancel(25, 68, {})),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    hits: [{ name: 'Charged', param: 'param6', element: 'physical', hitmark: 36,
      cancel: abilCancel(57, { dash: 36, jump: 36, burst: 56, swap: 39 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1 }],
  },
  skill: {
    // Tap only (0s hold); the hold-and-pull version and its higher damage/pull are not modelled.
    frameFile: 'skill.go',
    cooldown: { param: 'param4' },
    hits: [{ name: 'Gale Blade', param: 'param1', element: 'anemo', hitmark: 21,
      cancel: abilCancel(46, { dash: 28, jump: 28, swap: 45 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
    particles: { count: 2, perHit: false, icd: 18, element: 'anemo' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param7' },
    energyCost: { param: 'param8' },
    hits: [
      { name: 'Dandelion Breeze (In/Out)', param: 'param2', element: 'anemo', hitmark: 40,
        cancel: abilCancel(90, { attack: 88, skill: 89, swap: 88 }), icd: { tag: 'none', group: 'none' }, gauge: 1 },
      { name: 'Dandelion Breeze', param: 'param1', element: 'anemo', hitmark: 55,
        cancel: abilCancel(90, { attack: 88, skill: 89, swap: 88 }), icd: { tag: 'none', group: 'none' }, gauge: 1 },
    ],
  },
  hookHits: {
    'field-tick': { name: 'Dandelion Field (self-Swirl)', talent: 'burst', constantMv: 0, element: 'anemo', gauge: 1, icd: { tag: 'none', group: 'none' }, frameFile: 'burst.go' },
  },
  effects: [
    J('jean.a4', 'onBurst', {
      assumption: "Let the Wind Lead: Dandelion Breeze regenerates 20% of its own Energy cost (flat +16, per gcsim) on cast.",
    }),
    J('jean.field-ticks', 'onBurst', {
      assumption: "Dandelion Breeze's field pulses roughly every 1s for ~10.7s (10 ticks modelled, first at 100f, every 60f). Each pulse deals no direct damage itself but can trigger a real Swirl (via this sim's reaction engine) if another party member has applied a different element nearby — otherwise it does nothing. Wind Companion (A1, Normal Attack party heal) and the field's heal-over-time are not modelled (healing is out of scope for this sim).",
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'Increases the pulling speed of Gale Blade after holding for more than 1s, and increases the DMG dealt by 40%.', effects: [
      J('jean.c1', 'always', { assumption: 'Not modelled: only the tap (0s hold) Gale Blade is simulated, so the >1s-hold condition is never met.' }),
    ] },
    { level: 2, text: "When Jean picks up an Elemental Orb/Particle, all party members have their Movement SPD and ATK SPD increased by 15% for 15s.", effects: [
      J('jean.c2', 'always', { assumption: 'Not modelled: this sim does not track which character catches a given particle.' }),
    ] },
    { level: 3, text: 'Increases the Level of Dandelion Breeze by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: "Within the Field created by Dandelion Breeze, all opponents have their Anemo RES decreased by 40%.", effects: [
      J('jean.c4', 'onBurst', { assumption: 'Modelled as a continuous −40% Anemo RES debuff for the whole ~10.7s field duration rather than the real ~1s-refreshed 1.2s pulses, since the field is not expected to lapse mid-rotation.' }),
    ] },
    { level: 5, text: 'Increases the Level of Gale Blade by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: "Incoming DMG is decreased by 35% within the Field created by Dandelion Breeze; this persists briefly after leaving.", effects: [
      J('jean.c6', 'always', { assumption: 'Not modelled: incoming/taken damage is out of scope for this sim.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['er', 'atk%'], goblet: ['healingBonus', 'dmgBonus.anemo'], circlet: ['healingBonus', 'critRate'], source: 'template' } },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'normal', hits: 5, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['jean'],
  needsHook: true,
  assumptions: [
    'Healing (Wind Companion A1, Dandelion Breeze activation heal and heal-over-time) is not modelled — this sim only tracks damage.',
    'Only the tap (0s hold) Gale Blade is modelled; the hold-and-pull version (longer hold, bigger pull, and the C1 DMG bonus that requires it) is not.',
    "Dandelion Breeze's periodic self-Swirl field ticks (10, ~1/s) deal 0 direct damage themselves; any damage comes entirely from the reaction engine's Swirl calculation if a party member has applied another element nearby.",
    'C2 (particle-catch party Movement/ATK SPD buff) and C6 (incoming DMG reduction) are not modelled — this sim does not track which character catches a particle or incoming damage taken.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/jean', fields: ['frames', "Dandelion Breeze field/self-Swirl timing", 'A4/C4 formulas', 'constellations'] },
  ],
};
