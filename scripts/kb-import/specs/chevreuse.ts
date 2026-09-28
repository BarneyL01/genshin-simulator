import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Chevreuse. Frames, ICD and mechanics: gcsim internal/characters/chevreuse (attack.go, charge.go, skill.go,
// burst.go, asc.go, cons.go). Numbers only; behaviour re-implemented in src/engine/hooks/chevreuse.ts.
const N = (name: string, p: string, hitmark: number, cancel: ReturnType<typeof normalCancel>, extra: Partial<HitSpec> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel, icd: { tag: 'normal', group: 'standard' }, gauge: 1, ...extra,
});
const C = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'chevreuse', ...extra });

export const spec: CharacterSpec = {
  id: 'chevreuse',
  dbName: 'Chevreuse',
  gcsimDir: 'chevreuse',
  roles: ['buffer', 'off-field-pyro'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', 11, normalCancel(11, 33, { normal: 23, charged: 27 })),
      N('N2', 'param2', 12, normalCancel(12, 33, { normal: 26, charged: 28 })),
      N('N3', 'param3', 15, normalCancel(25, 46, { normal: 33, charged: 36 }), { extraHitmarks: [25], extraParams: ['param4'] }),
      N('N4', 'param5', 33, normalCancel(33, 67, { normal: 64 })),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    hits: [{
      name: 'Charged', param: 'param6', element: 'physical', hitmark: 27,
      cancel: abilCancel(65, { normal: 58, skill: 58, burst: 58, dash: 27, jump: 27, swap: 57 }), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
    }],
  },
  skill: {
    // Modelled as always dealing the Overcharged Ball (Hold) hit: this team's whole point is to keep Overloaded
    // rolling, so the plain Press/Hold multipliers are not modelled as a separate, weaker option. Minimal hold
    // (fastest cast): hitmark 19, cooldown starts at frame 13.
    frameFile: 'skill.go',
    cooldown: { param: 'param9' },
    hits: [
      { name: 'Overcharged Ball', param: 'param3', element: 'pyro', hitmark: 19,
        cancel: abilCancel(26, { attack: 25, dash: 21, jump: 23, walk: 24, swap: 23 }), icd: { tag: 'none', group: 'none' }, gauge: 1 },
      { name: 'Surging Blade', param: 'param7', element: 'pyro', hitmark: 55,
        cancel: abilCancel(26, { attack: 25, dash: 21, jump: 23, walk: 24, swap: 23 }), icd: { tag: 'none', group: 'none' }, gauge: 1 },
    ],
    particles: { count: 4, perHit: false, icd: 600, element: 'pyro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { frames: 900 },
    energyCost: { param: 'param4' },
    hits: [
      { name: 'Explosive Grenade', param: 'param1', element: 'pyro', hitmark: 59,
        cancel: abilCancel(61, { attack: 57, skill: 59, dash: 57, jump: 57, swap: 56 }), icd: { tag: 'none', group: 'none' }, strike: 'blunt', gauge: 1 },
      { name: 'Secondary Explosive Shell', param: 'param2', element: 'pyro', hitmark: 83,
        extraHitmarks: [92, 92, 101, 101, 110, 110, 119],
        cancel: abilCancel(61, { attack: 57, skill: 59, dash: 57, jump: 57, swap: 56 }), icd: { tag: 'burst', group: 'chevreuseBurstMines' }, strike: 'blunt', gauge: 1 },
    ],
  },
  hookHits: {
    c2bomb: { name: 'Sniper Induced Explosion (C2)', talent: 'skill', constantMv: 1.2, element: 'pyro', gauge: 1, icd: { tag: 'skill', group: 'standard' }, frameFile: 'cons.go' },
  },
  effects: [
    C('chevreuse.a1', 'onReaction', {
      assumption: 'Vanguard\'s Coordinated Tactics: only active when every party member is Pyro or Electro with at least one of each (checked against the team passed to the simulator). After any Overloaded reaction, −40% Pyro and Electro RES on the enemy for 6s.',
    }),
    C('chevreuse.a4', 'onSkill', {
      assumption: "Vertical Force Coordination: modelled on every Skill cast (Overcharged Ball is assumed). Team ATK +1% per 1,000 of Chevreuse's Max HP (snapshot at cast), capped at +40%, for 30s, to Pyro/Electro party members.",
    }),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'When the active character with Coordinated Tactics (not Chevreuse) triggers Overloaded, they recover 6 Energy (once per 10s).', effects: [
      C('chevreuse.c1', 'onReaction'),
    ] },
    { level: 2, text: "After Holding Short-Range Rapid Interdiction Fire and hitting a target, 2 chain explosions each deal Pyro DMG equal to 120% of Chevreuse's ATK (once per 10s), counted as Skill DMG.", effects: [
      C('chevreuse.c2', 'onSkill'),
    ] },
    { level: 3, text: 'Increases the Level of Short-Range Rapid Interdiction Fire by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "After using Ring of Bursting Grenades, the Hold mode of Short-Range Rapid Interdiction Fire won't go on cooldown (twice, or 6s).", effects: [
      effect.parse({ id: 'chevreuse.c4', trigger: { on: 'onBurst' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'chevreuse',
        assumption: 'Not modelled: the engine has no way for a hook to bypass a scheduled action\'s cooldown check. To use it, add an extra "skill" step right after "burst" in the rotation script; it will otherwise wait for the 15s cooldown like normal.' }),
    ] },
    { level: 5, text: 'Increases the Level of Ring of Bursting Grenades by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: "After 12s of the Skill's healing, all nearby party members heal for 10% of Chevreuse's Max HP once; a party member healed by it gains 20% Pyro and Electro DMG Bonus for 8s (max 3 stacks).", effects: [
      effect.parse({ id: 'chevreuse.c6', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'chevreuse',
        assumption: 'Not modelled: healing amounts and heal events are not tracked by the engine, so this heal-triggered DMG% cannot fire.' }),
    ] },
  ],
  recommended: { weapons: [], artifacts: [], mainStats: { sands: ['hp%', 'er'], goblet: ['hp%'], circlet: ['healingBonus', 'hp%'], source: 'template' } },
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'normal', hits: 4, repeat: 'untilRotationEnd' }] },
  ],
  hooks: ['chevreuse'],
  needsHook: true,
  assumptions: [
    'Skill is modelled as always the Overcharged Ball (Hold) hit at minimal hold time; the plain Press/Hold multipliers (used when Overloaded is not up) are not modelled as a separate option.',
    'Arkhe (Surging Blade) is included as a fixed extra hit on every Skill cast (its 10s ICD is shorter than the 15s Skill cooldown, so it is always up); Ousia/Pneuma-specific enemy interactions are not modelled.',
    'C4 (no cooldown on the Hold skill after Burst) is not modelled as an automatic cooldown bypass; add an extra "skill" rotation step after "burst" to represent it.',
    'C6 (heal-triggered DMG% and team heal) is not modelled: healing is not tracked.',
    'Passive "Double Time March" (party sprint stamina) is movement-only; not applicable to damage.',
    'Recommended main stats are reasoned from her healer/support kit (HP scales her A4 team buff and healing), not from a guide.',
  ],
  extraSources: [
    { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/tree/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/chevreuse', fields: ['frames', 'Overcharged Ball trigger', 'A1/A4 formulas', 'burst mine delays', 'constellations'] },
  ],
};
