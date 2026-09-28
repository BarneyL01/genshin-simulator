import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Varka. Frames, ICD and mechanics: gcsim internal/characters/varka (attack.go, charge.go, skill.go, burst.go,
// asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/varka.ts.
//
// Replaces the bulk-import baseline, which put every combat2 label (the plain Skill hit, all 5 upgraded
// "Sturm und Drang" Normal Attacks, Four Winds' Ascension and Azure Devour) into ONE `skill` action firing
// them all within ~24 frames of a single Skill press — a serious overcount. Here `skill` is only the plain
// initial hit; `fourWinds` is its own action.
//
// Varka converts to whichever of Pyro/Hydro/Electro/Cryo (in that priority order) is present in the team; his
// Elemental Skill recast ("Four Winds' Ascension", 2 charges) then deals one hit of that element and one
// Anemo hit. Only Four Winds is modelled as his special-state damage; the upgraded Normal/Charged Attacks and
// the "Azure Devour" charged-attack variant available in the same 12s window are not (see assumptions).
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const V = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'varka', ...extra });

export const spec: CharacterSpec = {
  id: 'varka',
  dbName: 'Varka',
  gcsimDir: 'varka',
  roles: ['driver'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 19, normalCancel(19, 46, { normal: 23, charged: 22 })),
      N('N2', 'param3', 18, normalCancel(28, 46, { normal: 29, charged: 30 }), { extraHitmarks: [28], extraParams: ['param2'] }),
      N('N3', 'param5', 27, normalCancel(43, 60, { normal: 55, charged: 48 }), { extraHitmarks: [43], extraParams: ['param4'] }),
      N('N4', 'param6', 19, normalCancel(24, 47, { normal: 40, charged: 28 }), { extraHitmarks: [24], extraParams: ['param7'] }),
      N('N5', 'param8', 44, normalCancel(45, 82, { normal: 73, charged: 48 }), { extraHitmarks: [45], extraParams: ['param9'] }),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    hits: [{ name: 'Charged', param: 'param10', element: 'physical', hitmark: 41,
      cancel: abilCancel(67, { attack: 58, burst: 58, skill: 59, dash: 41, jump: 41, swap: 49, walk: 49 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
      extraHitmarks: [41], extraParams: ['param11'] }],
  },
  skill: {
    // The plain tap only; opens Sturm und Drang for 12s + 2.3s more after a Burst (not modelled — assumed to
    // stay up for the modelled combo).
    frameFile: 'skill.go',
    cooldown: { param: 'param19' },
    hits: [{ name: 'Windbound Execution', param: 'param1', element: 'anemo', hitmark: 40,
      cancel: abilCancel(55, { attack: 49, charge: 49, burst: 44, skill: 44, dash: 46, jump: 43, swap: 49 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 }],
    particles: { count: 6, perHit: false, icd: 18, element: 'anemo' },
  },
  extraActions: {
    fourWinds: {
      as: 'skill', damageTalent: 'skill', frameFile: 'skill.go',
      hits: [
        { name: "Four Winds' Ascension (elemental)", param: 'param14', element: 'pyro', hitmark: 34,
          cancel: abilCancel(68, { attack: 55, charge: 64, skill: 56, burst: 55, dash: 56, jump: 55, walk: 65 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 },
        { name: "Four Winds' Ascension (anemo)", param: 'param15', element: 'anemo', hitmark: 43,
          cancel: abilCancel(68, { attack: 55, charge: 64, skill: 56, burst: 55, dash: 56, jump: 55, walk: 65 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 },
      ],
      cooldown: { param: 'param18' },
    },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param3' },
    energyCost: { param: 'param4' },
    hits: [
      { name: 'Northwind Avatar (elemental)', param: 'param1', element: 'pyro', hitmark: 112,
        cancel: abilCancel(152, { attack: 137, skill: 138, dash: 138, jump: 137, walk: 140, swap: 136 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 },
      { name: 'Northwind Avatar (anemo)', param: 'param2', element: 'anemo', hitmark: 131,
        cancel: abilCancel(152, { attack: 137, skill: 138, dash: 138, jump: 137, walk: 140, swap: 136 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 },
    ],
  },
  hookHits: {
    c2: { name: 'Azure Fang (C2)', talent: 'skill', constantMv: 8, element: 'anemo', gauge: 1, icd: { tag: 'none', group: 'none' }, frameFile: 'cons.go' },
  },
  effects: [
    V('varka.a1-dmg', 'always', {
      assumption: "Dawn Wind's March: +10% Anemo and matching elemental DMG per 1,000 ATK (capped 25%) — applied here to Anemo and the team's conversion element (Pyro/Hydro/Electro/Cryo, first present in the party). Also: if the party has 2+ Anemo or 2+ of one of those 4 elements, Four Winds' Ascension deals 140% damage; if both, 220%. The team's conversion element and this multiplier are fixed once per simulation from the party passed in (assumed static for the whole run).",
    }),
    V('varka.a2', 'onReaction', {
      assumption: "Wind's Vanguard: +7.5% DMG (max 4 stacks, 8s each, independent) to Normal/Charged/Four Winds' Ascension after ANY nearby party member triggers a Swirl (or Stellar Swirl).",
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: "On switching to Sturm und Drang, gain an extra Four Winds' Ascension charge; the next Four Winds'/Azure Devour deals 200% DMG.", effects: [
      V('varka.c1', 'onSkill'),
    ] },
    { level: 2, text: "Four Winds' Ascension/Azure Devour also deals an AoE Anemo hit at 800% ATK.", effects: [
      V('varka.c2', 'onSkill'),
    ] },
    { level: 3, text: 'Increases the Level of Windbound Execution by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "Varka's own Swirl gives the whole party +20% Anemo and +20% matching elemental DMG for 10s.", effects: [
      V('varka.c4', 'onReaction', { assumption: 'Only counts Varka\'s own Swirl trigger (matching the kit text), not the whole team\'s.' }),
    ] },
    { level: 5, text: "Increases the Level of Northwind Avatar by 3 (max 15).", talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: "Gains a free extra Four Winds'/Azure Devour use under certain conditions.", effects: [
      V('varka.c6', 'always', { assumption: 'Not modelled: action-economy only (a free extra use of an already-modelled action does not change this sim\'s per-cast damage).' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['atk%', 'er'], goblet: ['dmgBonus.anemo'], circlet: ['critRate', 'critDmg'], source: 'template' } },
  usualCombo: [
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'fourWinds' }, { action: 'fourWinds' }, { action: 'burst' }, { action: 'normal', hits: 5, repeat: 'untilRotationEnd' }] },
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'fourWinds' }, { action: 'fourWinds' }, { action: 'burst' }] },
  ],
  hooks: ['varka'],
  needsHook: true,
  assumptions: [
    "The upgraded Normal/Charged Attacks available during Sturm und Drang, and the \"Azure Devour\" charged-attack variant (both share Four Winds' team-comp multiplier), are not modelled — only the baseline Normal/Charged Attacks and Four Winds' Ascension itself. Understates his on-field auto-attack damage somewhat.",
    "The team's conversion element and the Four Winds team-comp multiplier are computed once from the characters passed into the simulation and do not change mid-run (matches how teams are actually built — the composition is fixed).",
    'C6 (free extra Four Winds/Azure Devour use) is not modelled: it changes action economy, not this sim\'s fixed rotation script.',
    '"Hexerei" team-trait Skill-cooldown-reduction interactions are not modelled.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/varka', fields: ['frames', "Four Winds' Ascension / team conversion element mechanics", 'A1/A2 formulas', 'constellations'] },
  ],
};
