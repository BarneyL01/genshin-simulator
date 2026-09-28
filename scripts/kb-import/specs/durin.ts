import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Durin. Frames, ICD and mechanics: gcsim internal/characters/durin (attack.go, charge.go, skill.go, burst.go,
// asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/durin.ts.
//
// Durin can burst into "Dragon of White Flame" (team RES shred + support, pairs with reaction teams) or
// "Dragon of Dark Decay" (personal Vaporize/Melt carry). Only White Flame is modelled: it is the form this
// KB's Overloaded teams use. The skill's "Confirmation of Purity" (White) recast is modelled the same way;
// "Denial of Darkness" (Black) is not, since it pairs with the unmodelled Black burst form.
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const D = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'durin', ...extra });

export const spec: CharacterSpec = {
  id: 'durin',
  dbName: 'Durin',
  gcsimDir: 'durin',
  roles: ['buffer', 'off-field-pyro'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 11, normalCancel(11, 29, { normal: 19, charged: 21 })),
      N('N2', 'param2', 9, normalCancel(9, 30, { normal: 14, charged: 21 })),
      N('N3', 'param3', 14, normalCancel(37, 55, { normal: 48, charged: 43 }), { extraHitmarks: [37], extraParams: ['param4'] }),
      N('N4', 'param5', 38, normalCancel(38, 66, {})),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    hits: [{ name: 'Charged', param: 'param6', element: 'physical', hitmark: 17,
      cancel: abilCancel(58, { attack: 53, skill: 52, burst: 52, dash: 17, jump: 17, swap: 51 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1 }],
  },
  skill: {
    // Tap: no damage, opens a 6s window (not modelled as a timed gate — see usualCombo). Recast (White):
    // "Confirmation of Purity", one hit, 35 frames in.
    frameFile: 'skill.go',
    cooldown: { frames: 720 },
    hits: [],
    noHitCancel: abilCancel(49, { attack: 16, skill: 15, burst: 4, dash: 14, jump: 14, swap: 13 }),
  },
  extraActions: {
    skillWhite: {
      as: 'skill', damageTalent: 'skill', frameFile: 'skill.go',
      hits: [{ name: 'Confirmation of Purity', param: 'param1', element: 'pyro', hitmark: 35,
        cancel: abilCancel(83, { attack: 62, skill: 53, burst: 50, dash: 46, jump: 47, swap: 48 }), icd: { tag: 'skill', group: 'standard' }, gauge: 1 }],
      particles: { count: 4, perHit: false, icd: 18, element: 'pyro' },
    },
  },
  burst: {
    // 3 initial "Principle of Purity" hits; the 20 "Dragon of White Flame" periodic ticks (A4 stacks, C6 DEF
    // ignore) are scheduled by the hook.
    frameFile: 'burst.go',
    cooldown: { param: 'param11' },
    energyCost: { param: 'param12' },
    hits: [
      { name: 'Principle of Purity 1', param: 'param1', element: 'pyro', hitmark: 97,
        cancel: abilCancel(104, { attack: 103, skill: 103, dash: 102, jump: 104, walk: 102, swap: 102 }), icd: { tag: 'burst', group: 'standard' }, gauge: 1 },
      { name: 'Principle of Purity 2', param: 'param2', element: 'pyro', hitmark: 121,
        cancel: abilCancel(104, { attack: 103, skill: 103, dash: 102, jump: 104, walk: 102, swap: 102 }), icd: { tag: 'burst', group: 'standard' }, gauge: 1 },
      { name: 'Principle of Purity 3', param: 'param3', element: 'pyro', hitmark: 154,
        cancel: abilCancel(104, { attack: 103, skill: 103, dash: 102, jump: 104, walk: 102, swap: 102 }), icd: { tag: 'burst', group: 'standard' }, gauge: 1 },
    ],
  },
  hookHits: {
    'white-tick': { name: 'Dragon of White Flame', talent: 'burst', param: 'param7', element: 'pyro', gauge: 1, icd: { tag: 'burstWhite', group: 'durinBurstWhite' }, frameFile: 'burst.go' },
    c1proc: { name: 'Cycle of Enlightenment (C1)', talent: 'burst', constantMv: 0, element: 'pyro', gauge: 0, icd: { tag: 'none', group: 'none' }, frameFile: 'cons.go' },
  },
  effects: [
    D('durin.a1', 'onReaction', {
      assumption: 'Light Manifest of the Divine Calculus (White Flame form): after any Overloaded reaction while the Dragon of White Flame is active, −20% Pyro and −20% Electro RES on the enemy for 6s. The "Hexerei" team-trait bonus (×1.75, needs 2+ Hexerei characters) is not modelled — assumed absent.',
    }),
    D('durin.burst', 'onBurst', {
      assumption: 'Dragon of White Flame: 20 periodic Pyro ticks (Primordial Fusion/A2: up to 10 of them get +min(ATK/100×3%, 75%) bonus damage, consumed one stack per tick) over about 20s after the burst.',
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'After the White Flame burst, other party members gain 20 stacks of Cycle of Enlightenment (20s): their damaging hits (while on-field) consume 1 stack for +60% of Durin\'s ATK flat damage.', effects: [
      D('durin.c1-set', 'onBurst'), D('durin.c1-proc', 'onHit'),
    ] },
    { level: 2, text: 'For 20s after a White or Black burst, party members gain +50% DMG in the two elements of any Vaporize/Melt/Overloaded/Swirl/Crystallize/Burning reaction triggered nearby, for 6s.', effects: [
      D('durin.c2', 'onReaction', { assumption: 'Modelled for Overloaded only (the reaction this team uses): +50% Pyro and +50% Electro DMG to the whole team for 6s.' }),
    ] },
    { level: 3, text: 'Increases the Level of Binary Form: Convergence and Division by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "Durin's Elemental Burst DMG +40%; a 30% chance for Cycle of Enlightenment/C1 not to consume a stack.", effects: [
      effect.parse({ id: 'durin.c4', trigger: { on: 'always' }, target: 'self', stat: 'baseDmgMultiplier.burst', value: 0.4 }),
    ] },
    { level: 5, text: 'Increases the Level of Principle of Purity/Darkness by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: "Elemental Burst DMG ignores 30% (White)/70% (Black) of the opponent's DEF; White Flame also shreds 30% DEF for 6s after a hit; the burst forms are further enhanced.", effects: [
      D('durin.c6', 'always', { assumption: 'DEF ignore (+30% on the periodic ticks) and the on-hit DEF shred are modelled; the enhancement to the initial 3 burst hits and the Black-form values are not.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['atk%', 'er'], goblet: ['dmgBonus.pyro'], circlet: ['critRate', 'critDmg'], source: 'template' } },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'skillWhite' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'skillWhite' }, { action: 'burst' }, { action: 'normal', hits: 4, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['durin'],
  needsHook: true,
  assumptions: [
    'Only the Dragon of White Flame burst form (and the matching Confirmation of Purity skill recast) is modelled; Dragon of Dark Decay (a personal Vaporize/Melt carry form, for a different team) is not.',
    'The Skill tap → recast window (6s) is not enforced by the engine; the rotation script is assumed to always recast within that window (usualCombo does this).',
    "C6's DEF ignore and DEF shred are applied to the periodic ticks only, not the 3 initial burst hits, for implementation simplicity.",
    'The "Hexerei" team-trait bonus on A1/C1 (×1.75 with 2+ Hexerei party members) is not modelled — assumed absent since none of this KB\'s teams are confirmed Hexerei comps.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/durin', fields: ['frames', 'burst tick timing', 'A1/A2/A4 formulas', 'constellations'] },
  ],
};
