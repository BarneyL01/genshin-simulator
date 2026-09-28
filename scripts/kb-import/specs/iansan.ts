import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

// Iansan. Frames, ICD and mechanics: gcsim internal/characters/iansan (attack.go, charge.go, skill.go, burst.go,
// asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/iansan.ts.
//
// Support/on-field driver: Skill opens a Nightsoul window whose Charged Attack ("Swift Stormflight") grants
// her a self ATK buff (A1); her Burst gives a flat ATK buff to whoever is on-field, based on her own ATK. The
// Nightsoul point economy (movement-based regeneration, decay) is not tracked — the ATK buff is computed
// assuming high points (the "High Nightsoul Points" conversion rate), matching how she is meant to be played.
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const I = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'iansan', ...extra });

export const spec: CharacterSpec = {
  id: 'iansan',
  dbName: 'Iansan',
  gcsimDir: 'iansan',
  roles: ['driver', 'buffer'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 14, normalCancel(14, 27, { normal: 21, charged: 21 })),
      N('N2', 'param2', 7, normalCancel(7, 31, { normal: 25, charged: 25 })),
      N('N3', 'param3', 22, normalCancel(22, 55, { normal: 53 })),
    ],
  },
  charged: {
    // Modelled as always "Swift Stormflight" (cast right after Skill, per the intended combo); the plain
    // (non-Nightsoul) Charged Attack, used only outside that window, is not modelled separately.
    frameFile: 'charge.go',
    hits: [{ name: 'Swift Stormflight', param: 'param5', element: 'electro', hitmark: 25,
      cancel: abilCancel(33, { attack: 32, burst: 24, dash: 30, jump: 27, swap: 31 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 }],
  },
  skill: {
    frameFile: 'skill.go',
    cooldown: { frames: 960 },
    hits: [{ name: 'Thunderbolt Rush', param: 'param1', element: 'electro', hitmark: 9,
      cancel: abilCancel(137, { attack: 32, burst: 31, dash: 27, jump: 32, walk: 38, swap: 33 }), icd: { tag: 'skill', group: 'standard' }, gauge: 1 }],
    particles: { count: 4, perHit: false, icd: 0, element: 'electro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { frames: 1080 },
    energyCost: { param: 'param8' },
    hits: [{ name: 'The Three Principles of Power', param: 'param1', element: 'electro', hitmark: 38,
      cancel: abilCancel(45, { attack: 43, skill: 42, dash: 44, jump: 43, swap: 41 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 }],
  },
  effects: [
    I('iansan.a1', 'onCharged', {
      assumption: "Enhanced Resistance Training: Swift Stormflight hitting an opponent gives Iansan +20% ATK for 15s (900 frames).",
    }),
    I('iansan.burst', 'onBurst', {
      assumption: "The Three Principles of Power's Kinetic Energy Scale gives a flat ATK buff to whoever is on-field for 12s (720 frames), computed from Iansan's own ATK at the 'High Nightsoul Points' rate (27%, capped per Burst talent level) — assumes she keeps her Nightsoul points topped up, which needs movement/consumption this sim does not track.",
      value: { perTalentLevel: param('Iansan', 'combat3', 'param4'), talent: 'burst' },
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'While in Nightsoul, restoring 6+ Nightsoul points (accumulated) refunds 15 Energy, at most once per 18s.', effects: [
      I('iansan.c1', 'always', { assumption: 'Not modelled: needs the Nightsoul point-restoration economy, which is not tracked.' }),
    ] },
    { level: 2, text: "When Enhanced Resistance Training's Precise Movement is active, the rest of the party also gains +30% ATK.", effects: [
      I('iansan.c2', 'onCharged'),
    ] },
    { level: 3, text: 'Increases the Level of Thunderbolt Rush by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: 'The Kinetic Energy Scale gains 2 stacks of Surging Force after an ally bursts, worth extra Nightsoul point restoration.', effects: [
      I('iansan.c4', 'always', { assumption: 'Not modelled: needs the Nightsoul point-restoration economy, which is not tracked.' }),
    ] },
    { level: 5, text: 'Increases the Level of The Three Principles of Power by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: 'The Scale lasts 3s longer; on Nightsoul point overflow, the active character gains +25% DMG for 3s.', effects: [
      I('iansan.c6', 'always', { assumption: 'Not modelled: needs the Nightsoul point-restoration economy, which is not tracked.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['atk%', 'er'], goblet: ['dmgBonus.electro'], circlet: ['critRate', 'critDmg'], source: 'template' } },
  usualCombo: [
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'charged' }, { action: 'burst' }, { action: 'normal', hits: 3, repeat: 'untilRotationEnd' }] },
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'charged' }, { action: 'burst' }] },
  ],
  hooks: ['iansan'],
  needsHook: true,
  assumptions: [
    'The Nightsoul point economy (movement-based regeneration, 6/s decay, the 54-point cap) is not tracked as a resource; Skill → Swift Stormflight is assumed to always be available, and the Burst ATK buff assumes high points throughout.',
    'The plain (non-Nightsoul) Charged Attack is not modelled, since off the back of Skill she always gets Swift Stormflight instead.',
    'C1, C4 and C6 are not modelled (all need the Nightsoul point economy).',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/iansan', fields: ['frames', 'Kinetic Energy Scale ATK formula', 'A1/C2 formulas'] },
  ],
};
