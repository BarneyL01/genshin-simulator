import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Varesa. Frames, ICD and mechanics: gcsim internal/characters/varesa (attack.go, charge.go, skill.go, burst.go,
// plunge.go, asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/varesa.ts.
//
// Her real kit is a Nightsoul-point economy (Skill/Plunge generate points; at 40/40 the next Plunge enters
// 15s "Fiery Passion", which upgrades Skill/Charged/Plunge/Burst and unlocks her main damage: a flat,
// ATK-scaled "ground impact" bonus on High Plunge attacks). The point economy itself is not tracked as a
// resource — the rotation script is written assuming the standard opening (Skill generates 20 points, the
// next Plunge's own 25 points then caps the meter and enters Fiery Passion for everything after it), matching
// how every other reaction/state-gated kit in this KB is modelled (e.g. Chevreuse's Overcharged Ball).
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'electro', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const V = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'varesa', ...extra });

export const spec: CharacterSpec = {
  id: 'varesa',
  dbName: 'Varesa',
  gcsimDir: 'varesa',
  roles: ['off-field-dps'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 23, normalCancel(23, 49, { normal: 33, charged: 23 })),
      N('N2', 'param2', 7, normalCancel(7, 30, { charged: 17 })),
      N('N3', 'param3', 33, normalCancel(33, 59, { normal: 45, charged: 32 })),
    ],
  },
  charged: {
    // Modelled as the fast "Follow-Up Strike" (cast right after Skill, per the intended Skill → Charged →
    // Plunge chain); the slow standalone Charged Attack (69-frame hitmark, used with no preceding Skill) is
    // not modelled separately.
    frameFile: 'charge.go',
    hits: [{ name: 'Charged Attack (Follow-Up)', param: 'param4', element: 'electro', hitmark: 11,
      cancel: abilCancel(57, { attack: 57, charged: 57, skill: 57, burst: 57, dash: 57, jump: 57, swap: 46, plunge: 20 }),
      icd: { tag: 'normal', group: 'standard' }, gauge: 1 }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { param: 'param5' },
    hits: [{ name: 'Rush', param: 'param1', element: 'electro', hitmark: 5,
      cancel: abilCancel(43, { attack: 22, charged: 22, burst: 22, dash: 37, jump: 37, swap: 21 }), icd: { tag: 'skill', group: 'standard' }, gauge: 1 }],
    particles: { count: 2.5, perHit: false, icd: 0, element: 'electro' },
  },
  extraActions: {
    skillFiery: {
      as: 'skill', damageTalent: 'skill', frameFile: 'skill.go',
      hits: [{ name: 'Fiery Passion Rush', param: 'param2', element: 'electro', hitmark: 2,
        cancel: abilCancel(52, { attack: 23, charged: 23, skill: 22, burst: 22, dash: 38, jump: 39, swap: 21 }), icd: { tag: 'skill', group: 'standard' }, gauge: 1 }],
    },
    plungeFiery: {
      as: 'plunge', damageTalent: 'normal', hitTalent: 'plunge', frameFile: 'plunge.go',
      hits: [{ name: 'Fiery Passion High Plunge', param: 'param16', element: 'electro', hitmark: 41,
        cancel: abilCancel(90, { attack: 47, charged: 46, skill: 47, burst: 47, dash: 40, jump: 79, swap: 45 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
    },
  },
  plunge: {
    frameFile: 'plunge.go',
    hits: [{ name: 'High Plunge', param: 'param8', element: 'electro', hitmark: 37,
      cancel: abilCancel(72, { attack: 40, charged: 47, skill: 40, burst: 40, dash: 40, jump: 51, swap: 37 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
  },
  burst: {
    // Modelled as always the Fiery Passion Flying Kick (assumed cast while already in Fiery Passion, per the
    // usualCombo); the plain Flying Kick and the short "Volcano Kablam" recast (Apex Drive, C0-relevant only
    // in a ~2.3s window after a Fiery Plunge) are not modelled.
    frameFile: 'burst.go',
    cooldown: { frames: 1080 },
    energyCost: { param: 'param4' },
    hits: [{ name: 'Fiery Passion Flying Kick', param: 'param2', element: 'electro', hitmark: 88,
      cancel: abilCancel(122, { attack: 93, skill: 90, dash: 93, walk: 101, swap: 90 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 }],
  },
  effects: [
    V('varesa.a1-window', 'onSkill', {
      assumption: "Tag-Team Triple Jump!: opens a 5s window after Skill/Fiery Skill. A High Plunge landing inside it gets a flat ATK-scaled 'ground impact' bonus (+50% ATK normally, +180% in Fiery Passion or at C1); outside the window, no bonus at all.",
    }),
    V('varesa.a1-transform', 'always'),
    V('varesa.a2', 'onAnyBurst', {
      assumption: "The Hero Twice-Returned!: +35% ATK for 12s (max 2 independent stacks) when a nearby party member triggers a 'Nightsoul Burst'. Only Iansan is recognised as one in this KB; other Nightsoul-Burst characters (e.g. other Natlan units) are not, so this may under-fire outside this specific team.",
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'Rainbow Crash always gives the 180%-ATK ground impact bonus (fiery or not); Volcano Kablam also grants Rainbow Crash; Sudden Onrush costs 30% fewer Nightsoul/Phlogiston points.', effects: [
      V('varesa.c1', 'always'),
    ] },
    { level: 2, text: 'Varesa gains Apex Drive after any Plunge; +11.5 Energy when a Plunge hits; further interruption resistance in Apex Drive.', effects: [
      V('varesa.c2', 'onPlunge', { assumption: 'Only the +11.5 Energy on Plunge is modelled; Apex Drive (which enables the cheap Volcano Kablam recast) is not, since Volcano Kablam itself is not modelled.' }),
    ] },
    { level: 3, text: 'Increases the Level of Guardian Vent! by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 4, text: 'Burst/Volcano Kablam DMG is doubled while in Fiery Passion or Apex Drive; a flat ATK-scaled bonus (capped 20,000) on the next Plunge-type hit after a non-Fiery Burst.', effects: [
      effect.parse({ id: 'varesa.c4', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.burst', value: 1.0,
        assumption: 'Burst is already modelled as always cast in Fiery Passion, so the "while blessed" condition is assumed always met. The Diligent Refinement flat bonus (only relevant after a non-Fiery Burst) is not modelled.' }),
    ] },
    { level: 5, text: 'Increases the Level of Riding the Night-Rainbow by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 6, text: '+30 Energy on entering Apex Drive; Plunging Attacks and Burst gain +10% CRIT Rate and +100% CRIT DMG.', effects: [
      effect.parse({ id: 'varesa.c6.burst.cr', trigger: { on: 'always' }, target: 'self', stat: 'critRate.burst', value: 0.1 }),
      effect.parse({ id: 'varesa.c6.burst.cd', trigger: { on: 'always' }, target: 'self', stat: 'critDmg.burst', value: 1.0 }),
      effect.parse({ id: 'varesa.c6.plunge.cr', trigger: { on: 'always' }, target: 'self', stat: 'critRate.plunge', value: 0.1 }),
      effect.parse({ id: 'varesa.c6.plunge.cd', trigger: { on: 'always' }, target: 'self', stat: 'critDmg.plunge', value: 1.0 }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['atk%', 'er'], goblet: ['dmgBonus.electro'], circlet: ['critRate', 'critDmg'], source: 'template' } },
  usualCombo: [
    // The A1 ground-impact window (5s) does not get refreshed by Burst, so a plunge after it would get no
    // bonus at all; the rotation ends right after Burst rather than spending a wasted extra plunge.
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'plunge' }, { action: 'skillFiery' }, { action: 'charged' }, { action: 'plungeFiery' }, { action: 'burst' }] },
  ],
  hooks: ['varesa'],
  needsHook: true,
  assumptions: [
    'The Nightsoul point economy (20/25 points per Skill/Plunge, 40 cap, 15s Fiery Passion) is not tracked as a resource; the rotation script (usualCombo) is written to match it: Skill (20 pts) then Plunge (25 pts, caps the meter and enters Fiery Passion right after this hit, so this specific Plunge does not get the ground-impact bonus) then everything after is in Fiery Passion.',
    'Volcano Kablam (a cheap Burst recast available in a short window after a Fiery Plunge, mainly relevant with C2) is not modelled.',
    'Low Plunge and the non-Follow-Up (slow) Charged Attack are not modelled; only the High Plunge and the fast post-Skill Charged Attack are, matching how she is actually played off-field.',
    'Fiery Passion Normal Attacks are not modelled (she is played off-field in every team in this KB so far).',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/varesa', fields: ['frames', 'Nightsoul/Fiery Passion mechanics', 'A1/A2 formulas', 'constellations'] },
  ],
};
