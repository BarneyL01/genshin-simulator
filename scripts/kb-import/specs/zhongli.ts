import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/zhongli (attack.go, charge.go, skill.go, stele.go, shield.go, burst.go, asc.go). Numbers only.
const N = (name: string, p: string, hitmarks: number[], earliest: number, animation: number, over: Record<string, number> = {}): HitSpec => ({
  name, param: p, element: 'physical', hitmark: hitmarks[0]!, extraHitmarks: hitmarks.length > 1 ? hitmarks.slice(1) : undefined,
  cancel: normalCancel(earliest, animation, over), icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
const Z = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'zhongli', ...extra });
const A4 = (id: string, stat: string, ratio: number, assumption?: string): Effect =>
  effect.parse({ id, trigger: { on: 'always' }, target: 'self', stat, value: 0, scaling: { from: 'self.hp', ratio }, assumption });

export const spec: CharacterSpec = {
  id: 'zhongli',
  dbName: 'Zhongli',
  gcsimDir: 'zhongli',
  roles: ['shielder', 'res-shred', 'off-field-geo'],
  normal: {
    frameFile: 'attack.go',
    hits: [
      N('N1', 'param1', [11], 11, 30, { normal: 18 }),
      N('N2', 'param2', [9], 9, 30, { normal: 13 }),
      N('N3', 'param3', [8], 8, 28, { normal: 19 }),
      N('N4', 'param4', [16], 16, 34, { charged: 33 }),
      N('N5', 'param5', [11, 18, 23, 29], 4, 31, { normal: 27, skill: 5, burst: 5, dash: 5, jump: 5 }),
      N('N6', 'param6', [29], 29, 54),
    ],
  },
  charged: {
    frameFile: 'charge.go',
    stamina: { param: 'param8' },
    hits: [{
      name: 'Charged', param: 'param7', element: 'physical', hitmark: 4,
      cancel: abilCancel(47, { skill: 33, burst: 33, dash: 4, jump: 4, swap: 31 }), icd: { tag: 'extra', group: 'poleExtraAttack' }, gauge: 1,
    }],
  },
  skill: {
    // Hold variant: damage, Jade Shield (RES shred), a stele if below the limit
    frameFile: 'skill.go',
    variants: ['hold'],
    cooldown: { frames: 720 },
    hits: [{
      name: 'Dominus Lapidis (hold)', param: 'param4', element: 'geo', hitmark: 48, strike: 'blunt',
      cancel: abilCancel(96, { dash: 55, jump: 55 }), icd: { tag: 'skill', group: 'standard' }, gauge: 1,
    }],
    // 50% chance of 1 Geo particle per hit, ICD 1.5 s
    particles: { count: 0.5, perHit: false, icd: 90, element: 'geo' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param3' },
    energyCost: { param: 'param4' },
    hits: [{
      name: 'Planet Befall', param: 'param1', element: 'geo', hitmark: 101, strike: 'blunt',
      cancel: abilCancel(139, { dash: 123, jump: 123, swap: 138 }), icd: { tag: 'none', group: 'none' }, gauge: 4,
    }],
  },
  extraActions: {
    'skill-press': {
      as: 'skill', damageTalent: 'skill', frameFile: 'skill.go', cooldown: { frames: 240 },
      hits: [{
        name: 'Stone Stele (initial)', param: 'param1', element: 'geo', hitmark: 24, strike: 'blunt',
        cancel: abilCancel(38, { normal: 37, burst: 38, dash: 23, jump: 23, swap: 37 }), icd: { tag: 'skill', group: 'standard' }, gauge: 2,
      }],
      particles: { count: 0.5, perHit: false, icd: 90, element: 'geo' },
    },
  },
  hookHits: {
    'stele-initial': {
      name: 'Stone Stele (initial)', talent: 'skill', param: 'param1', element: 'geo', gauge: 2,
      icd: { tag: 'skill', group: 'standard' }, frameFile: 'stele.go',
    },
    'stele-tick': {
      name: 'Stone Stele (resonance)', talent: 'skill', param: 'param2', element: 'geo', gauge: 1,
      icd: { tag: 'skill', group: 'standard' }, frameFile: 'stele.go',
    },
  },
  effects: [
    Z('zhongli.stele', 'onSkill', { duration: 1860 }),
    Z('zhongli.shield', 'onSkill', {
      value: -0.2, duration: 1200,
      assumption: 'Jade Shield lowers all enemy RES (Pyro, Hydro, Electro, Cryo, Anemo, Geo, Dendro, Physical) by 20% for its 20 s (gcsim shield.go); the shield is assumed never to break early.',
    }),
    A4('zhongli.a4.skill', 'flatDmg.skill', 0.019, 'Stone Stele, resonance and hold DMG +1.9% of Max HP.'),
    A4('zhongli.a4.burst', 'flatDmg.burst', 0.33, "Planet Befall DMG +33% of Max HP."),
    A4('zhongli.a4.normal', 'flatDmg.normal', 0.0139),
    A4('zhongli.a4.charged', 'flatDmg.charged', 0.0139),
  ],
  passives: [],
  constellations: [
    { level: 1, text: 'Increases the maximum number of Stone Steles to 2.', effects: [Z('zhongli.c1', 'always')] },
    { level: 2, text: 'Planet Befall grants nearby characters on the field a Jade Shield when it descends.', effects: [
      Z('zhongli.c2', 'onBurst', { value: -0.2, duration: 1200 }),
    ] },
    { level: 3, text: 'Increases the Level of Dominus Lapidis by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "Planet Befall's AoE +20% and its Petrification lasts 2 s longer.", effects: [] },
    { level: 5, text: 'Increases the Level of Planet Befall by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: 'When the Jade Shield takes DMG, 40% of it is converted to HP (max 8% Max HP).', effects: [] },
  ],
  usualCombo: [
    { variant: 'off-field', actions: [{ action: 'skill' }] },
    { variant: 'off-field-burst', actions: [{ action: 'skill' }, { action: 'burst' }] },
  ],
  hooks: ['zhongli'],
  needsHook: true,
  assumptions: [
    'The default skill action is the hold variant (damage, Jade Shield, stele if below the limit); the press variant is the extra action skill-press. Steles resonate every 120 frames for 1860 frames through hook "zhongli" (src/engine/hooks/zhongli.ts, tested in tests/hooks.test.ts).',
    'Shield strength, healing, Fortify (A1) and petrification are not modelled; only the RES reduction matters here. The Jade Shield RES reduction is a value from gcsim (not in genshin-db labels).',
    'Resonance with other constructs (extra hits per nearby construct) is not modelled.',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
};
