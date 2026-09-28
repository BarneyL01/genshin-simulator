import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Sucrose. Frames and mechanics: gcsim internal/characters/sucrose (attack.go, charge.go, skill.go, burst.go,
// asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/sucrose.ts.
//
// Sucrose is an EM buffer/enabler, not a damage dealer: her real value (A1's +50 EM to matching-element party
// members on her own Swirl, A4's +20% of her EM to the whole party on Skill/Burst hit) raises OTHER characters'
// reaction damage. Her own DoT/Absorb burst ticks and the small amount of direct damage are modelled too.
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'anemo', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const S = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'sucrose', ...extra });

export const spec: CharacterSpec = {
  id: 'sucrose',
  dbName: 'Sucrose',
  gcsimDir: 'sucrose',
  roles: ['support'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 17, normalCancel(17, 28, { normal: 17, charged: 20 })),
      N('N2', 'param2', 18, normalCancel(18, 38, { normal: 26, charged: 18 })),
      N('N3', 'param3', 28, normalCancel(28, 46, { normal: 33, charged: 28 })),
      N('N4', 'param4', 28, normalCancel(28, 65, { normal: 51, charged: 54 })),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    hits: [{ name: 'Charged', param: 'param5', element: 'anemo', hitmark: 54,
      cancel: abilCancel(71, { attack: 69, charge: 66, skill: 60, burst: 61, dash: 54, jump: 54, swap: 54 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
  },
  skill: {
    // Near-instant (0f delay per gcsim, matching how fast this skill is known to be in practice); animation
    // timing itself uses the usual cancel windows below.
    frameFile: 'skill.go',
    cooldown: { param: 'param2' },
    hits: [{ name: 'Astable Anemohypostasis Creation-6308', param: 'param1', element: 'anemo', hitmark: 0,
      cancel: abilCancel(68, { attack: 57, charge: 56, skill: 56, burst: 57, dash: 11, jump: 11, swap: 56 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
    particles: { count: 4, perHit: false, icd: 24, element: 'anemo' },
  },
  burst: {
    // Damage delivered entirely by the hook (periodic DoT ticks + absorbed-element ticks): duration (and hence
    // tick count) depends on C2, and the absorbed element depends on team composition.
    frameFile: 'burst.go',
    cooldown: { param: 'param4' },
    energyCost: { param: 'param5' },
    hits: [],
    noHitCancel: abilCancel(65, { attack: 49, charge: 48, skill: 48, dash: 47, jump: 47 }),
  },
  hookHits: {
    'burst-dot': { name: 'Forbidden Creation-Isomer 75/Type II', talent: 'burst', param: 'param1', element: 'anemo', gauge: 1, icd: { tag: 'none', group: 'none' }, frameFile: 'burst.go' },
    'burst-absorb': { name: 'Forbidden Creation-Isomer 75/Type II (Absorb)', talent: 'burst', param: 'param2', element: 'pyro', gauge: 0, icd: { tag: 'none', group: 'none' }, frameFile: 'burst.go' },
  },
  effects: [
    S('sucrose.a1', 'onReaction', {
      assumption: "Catalyst Conversion: on Sucrose's own Swirl (or Stellar Swirl), +50 EM for 8s to party members (excluding Sucrose) whose element matches the swirled element.",
    }),
    S('sucrose.a4', 'onHit', {
      assumption: "Mollis Favonius: landing a Skill or Burst hit gives the rest of the party +20% of Sucrose's own (base) EM for 8s.",
    }),
    S('sucrose.burst', 'onBurst', {
      assumption: 'Forbidden Creation-Isomer 75/Type II: periodic Anemo DoT ticks (every 113 frames from 137, for 360 frames — 480 with C2) plus an absorbed-element tick of the same timing once the team is assumed to have primed an absorbable aura (see extraSources/assumptions).',
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'Astable Anemohypostasis Creation-6308 gains 1 additional charge.', effects: [
      S('sucrose.c1', 'always', { assumption: 'Extra charge is an action-economy change (2 skill casts available back-to-back); this sim does not model charge counts, so this only matters if the rotation script itself casts Skill twice in a row, which it does not.' }),
    ] },
    { level: 2, text: 'The duration of Forbidden Creation-Isomer 75/Type II is increased by 2s.', effects: [
      S('sucrose.c2', 'always'),
    ] },
    { level: 3, text: 'Increases the Level of Astable Anemohypostasis Creation-6308 by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: 'Sucrose reduces the CD of Astable Anemohypostasis Creation-6308 by 1-7s for every 7 Normal/Charged Attack hits.', effects: [
      S('sucrose.c4', 'always', { assumption: 'Not modelled: a CD-reduction proc-counter that would only matter across a multi-cycle sim with heavy auto-attacking, which this rotation script does not do.' }),
    ] },
    { level: 5, text: 'Increases the Level of Forbidden Creation-Isomer 75/Type II by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: 'If Forbidden Creation-Isomer 75/Type II triggers an Elemental Absorption, all party members gain +20% DMG Bonus for the absorbed element for its duration.', effects: [
      S('sucrose.c6', 'onBurst', { assumption: 'Applied to the whole party for the burst DoT duration whenever the absorb tick (see sucrose.burst) is assumed to have primed.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['em', 'er'], goblet: ['em', 'dmgBonus.anemo'], circlet: ['em', 'critRate'], source: 'template' } },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'normal', hits: 4, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['sucrose'],
  needsHook: true,
  assumptions: [
    "The burst's Elemental Absorption is not dynamically checked against the simulated enemy's actual applied aura; it is assumed to succeed, absorbing the team's conversion element (first of Pyro/Hydro/Electro/Cryo present in the party, same priority Varka uses), whenever such a party member exists. No absorb tick fires in an all-Anemo/Physical/Dendro/Geo party.",
    "C1's extra Skill charge and C4's CD-reduction proc counter are not modelled (action-economy/multi-cycle effects that do not change this sim's single fixed rotation script).",
    'A4 (Mollis Favonius) is approximated as firing on every Skill/Burst hit rather than gating on a per-cast `done` flag; since the EM buff value barely changes between re-triggers in one rotation, this has no material effect.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/sucrose', fields: ['frames', 'burst DoT/absorb timing', 'A1/A4 formulas', 'constellations'] },
  ],
};
