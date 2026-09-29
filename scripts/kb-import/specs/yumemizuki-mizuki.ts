import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

const NAME = 'Mizuki';

// Yumemizuki Mizuki. Frames and mechanics: gcsim internal/characters/mizuki (attack.go, charge.go, skill.go,
// burst.go, snack.go, asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/mizuki.ts.
//
// Her real value is entirely support: while in her "Dreamdrifter" state (her Skill), she buffs every party
// member's Swirl AND Stellar Swirl DMG based on her own EM (a genshin-db-sourced per-100-EM rate, mapped here to
// the engine's `reactionBonus.swirl` / `reactionBonus.stellarSwirl` stats — see src/engine/reactions.ts). Her own
// damage (activation hit, periodic "cloud" pulses, burst, periodic snack explosions) is comparatively small.
const N = (name: string, p: string, rawHitmark: number, travel: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'anemo', hitmark: rawHitmark + travel, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const M = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'mizuki', ...extra });

export const spec: CharacterSpec = {
  id: 'yumemizuki-mizuki',
  dbName: 'Mizuki',
  gcsimDir: 'mizuki',
  roles: ['support'],
  normal: {
    // Normal Attacks are projectiles: the raw gcsim hitmark is when the throw animation can be cancelled, the
    // actual hit lands `travel` (10f default) frames later — both are folded into this HitSpec's `hitmark`.
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 7, 10, normalCancel(7, 34, { normal: 18, charged: 20, skill: 10, burst: 9, dash: 10, swap: 13 })),
      N('N2', 'param2', 19, 10, normalCancel(19, 38, { normal: 37, charged: 36, skill: 21, burst: 20, dash: 21, jump: 21, swap: 21 })),
      N('N3', 'param3', 37, 10, normalCancel(37, 98, { normal: 73, skill: 41, burst: 40, dash: 41, jump: 41, walk: 72, swap: 41 })),
    ],
  },
  charged: {
    // No travel time. Idle (no windup) case.
    frameFile: 'charge.go',
    hits: [{ name: 'Charged', param: 'param4', element: 'anemo', hitmark: 39,
      cancel: abilCancel(81, { attack: 62, charge: 62, skill: 62, burst: 60, dash: 37, jump: 37, swap: 64 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
  },
  skill: {
    // The activation hit only; the Dreamdrifter recast (pressing Skill again to cancel early) is not modelled —
    // the rotation script always lets the state run its natural course. Cloud pulses are scheduled by the hook.
    frameFile: 'skill.go',
    cooldown: { param: 'param3' },
    hits: [{ name: 'Aisa Utamakura Pilgrimage', param: 'param4', element: 'anemo', hitmark: 2,
      cancel: abilCancel(50, { burst: 34, swap: 30 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
    particles: { count: 4, perHit: false, icd: 30, element: 'anemo' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param4' },
    energyCost: { param: 'param5' },
    hits: [{ name: 'Anraku Secret Spring Therapy', param: 'param1', element: 'anemo', hitmark: 93,
      cancel: abilCancel(94, { attack: 93, charge: 92, skill: 93, dash: 91, jump: 93, walk: 92 }), icd: { tag: 'none', group: 'none' }, gauge: 1 }],
  },
  hookHits: {
    cloud: { name: 'Dreamdrifter Continuous Attack', talent: 'skill', param: 'param1', element: 'anemo', gauge: 1, icd: { tag: 'skill', group: 'mizukiSkill' }, frameFile: 'skill.go' },
    snack: { name: 'Munen Shockwave', talent: 'burst', param: 'param2', element: 'anemo', gauge: 1, icd: { tag: 'none', group: 'none' }, frameFile: 'burst.go' },
  },
  effects: [
    M('mizuki.skill', 'onSkill', {
      assumption: "Dreamdrifter: 7 periodic 0-travel-time-adjusted 'cloud' pulses (first resolving 48f after cast, then every 45f) over the ~5s base state duration (the two Ascension-1 Swirl/Stellar-Swirl duration extensions are not modelled — this sim's fixed rotation doesn't need them). Also snapshots Mizuki's own EM once at cast to set every party member's Swirl and Stellar Swirl reaction DMG bonus (genshin-db's per-100-EM Skill parameters) for the state's duration.",
    }),
    M('mizuki.burst', 'onBurst', {
      assumption: "Anraku Secret Spring Therapy: 8 Yumemi Style Special Snacks spawn over the burst's 12s duration; each is modelled as exploding (dealing one Munen Shockwave hit) 4s after spawning, since this sim has no player positioning to simulate an early pickup. The Snack Pick-Up healing is not modelled (out of scope for this sim).",
    }),
    M('mizuki.swirl-bonus-table', 'custom', { value: { perTalentLevel: param(NAME, 'combat2', 'param2'), talent: 'skill' } }),
    M('mizuki.stellar-swirl-bonus-table', 'custom', { value: { perTalentLevel: param(NAME, 'combat2', 'param6'), talent: 'skill' } }),
    M('mizuki.a4', 'onHit', {
      assumption: 'Thoughts by Day Bring Dreams by Night (A4): +100 EM for 4s to Mizuki herself when another nearby party member lands a Pyro/Hydro/Cryo/Electro hit while Dreamdrifter is active (0.3s ICD). Since the Swirl/Stellar-Swirl DMG bonus (mizuki.skill) is snapshotted once at Skill cast rather than recomputed continuously, this EM gain does not retroactively raise it mid-Dreamdrifter — a simplification shared with how this KB snapshots other mid-action buffs.',
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: "When Yumemizuki Mizuki triggers a Swirl or Stellar Swirl reaction while in Dreamdrifter, its duration increases by 2.5s (max twice per Dreamdrifter). While Dreamdrifter is active, she applies a debuff every 3.5s that, when a Swirl or Stellar Swirl next lands on the debuffed enemy, is consumed to add a large EM-scaled flat bonus to that reaction instance.", effects: [
      M('mizuki.c1', 'always', { assumption: 'Not modelled: the duration extension has no effect on this fixed-length rotation script, and the periodic flat-bonus-on-next-swirl debuff needs an enemy-status timer this sim does not track.' }),
    ] },
    { level: 2, text: "When Yumemizuki Mizuki enters Dreamdrifter, every point of her Elemental Mastery increases nearby party members' Pyro/Hydro/Cryo/Electro DMG Bonus by 0.04% until Dreamdrifter ends.", effects: [
      M('mizuki.c2', 'onSkill', { assumption: "Snapshotted once at Skill cast (like mizuki.skill's Swirl DMG bonus), applied to the rest of the party for Dreamdrifter's base duration." }),
    ] },
    { level: 3, text: 'Increases the Level of Aisa Utamakura Pilgrimage by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: 'Picking up a Snack from Anraku Secret Spring Therapy restores 5 Energy to Mizuki (up to 4 times per Burst).', effects: [
      M('mizuki.c4', 'always', { assumption: "Not modelled: this sim's snacks always 'expire unpicked' (see mizuki.burst), so the pickup condition this needs never occurs here." }),
    ] },
    { level: 5, text: 'Increases the Level of Anraku Secret Spring Therapy by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: "While in Dreamdrifter, nearby party members' Swirl DMG can CRIT (fixed 30% CR / 100% CD), and their Stellar Swirl CR/CD is further increased by 10%/20%. Mizuki's own CRIT Rate/DMG also rise with EM above 500 (up to +20% CR / +80% CD).", effects: [
      M('mizuki.c6-self', 'onSkill', { assumption: 'Only the self EM-scaled CRIT Rate/DMG (above 500 EM, capped +20%/+80%) is modelled. Granting plain Swirl a fixed crit chance, and boosting Stellar Swirl crit specifically for OTHER characters, would need a per-reaction crit override this engine does not have (its Swirl formula has no crit term at all, and Stellar Swirl uses the caster\'s own normal CRIT stats) — not modelled.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['em', 'er'], goblet: ['em'], circlet: ['em'], source: 'template' } },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'normal', hits: 3, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['mizuki'],
  needsHook: true,
  assumptions: [
    "Dreamdrifter's cloud pulses are modelled at a fixed 7-tick schedule matching the base (non-extended) state duration; the Ascension-1 duration extensions on Swirl/Stellar Swirl are not modelled.",
    "Snacks from the Burst are always modelled as exploding after their full 4s unpicked-expiry timer (Munen Shockwave), never picked up early — this sim has no player positioning. C4's pickup-triggered Energy restore is therefore not modelled either.",
    'C1 (EM-scaled flat bonus on the next Swirl/Stellar Swirl against a periodically-debuffed enemy) is not modelled: it needs an enemy-status timer this sim does not track.',
    "C6's fixed-CRIT-on-plain-Swirl and Stellar-Swirl CRIT bonus for other party members are not modelled (the engine's reaction-damage functions have no per-reaction crit override); only her own EM-scaled self CRIT Rate/DMG is.",
    'The Swirl and Stellar Swirl DMG bonuses (Skill kit text and C2) are snapshotted once at Skill cast from her EM at that moment, not recomputed continuously through Dreamdrifter.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/mizuki', fields: ['frames', 'Dreamdrifter/cloud/snack timing', 'A1/A4 formulas', 'constellations'] },
  ],
};
