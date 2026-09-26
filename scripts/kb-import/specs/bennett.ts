import { effect } from '../../../src/schema/effect';
import { abilCancel, normalCancel, param, type CharacterSpec, type HitSpec } from '../lib';

// Frames: gcsim internal/characters/bennett (attack.go, skill.go, burst.go). Numbers only.
const N = (name: string, p: string, hitmark: number, animation: number, nextNormal: number): HitSpec => ({
  name, param: p, element: 'physical', hitmark, cancel: normalCancel(hitmark, animation, { normal: nextNormal }),
  icd: { tag: 'normal', group: 'standard' }, gauge: 1,
});
const atkRatio = param('Bennett', 'combat3', 'param4'); // "ATK Bonus Ratio", × base ATK (character + weapon)
const FIELD = { delay: 34, duration: 846 }; // first tick at 34, 13 ticks (34..754), each lasts 126 frames → active until 880

export const spec: CharacterSpec = {
  id: 'bennett',
  dbName: 'Bennett',
  gcsimDir: 'bennett',
  roles: ['buffer', 'battery', 'off-field-pyro'],
  normal: {
    frameFile: 'attack.go',
    hits: [N('N1', 'param1', 13, 33, 20), N('N2', 'param2', 9, 27, 17), N('N3', 'param3', 13, 46, 37), N('N4', 'param4', 25, 48, 44), N('N5', 'param5', 24, 60, 60)],
  },
  skill: {
    frameFile: 'skill.go',
    variants: ['press'],
    // Press CD 5 s, −20% from Rekindle (A1, unlocked at ascension 1): 240 frames (gcsim skill.go: a1(5*60))
    cooldown: { frames: 240 },
    hits: [{
      name: 'Passion Overload (press)', param: 'param1', element: 'pyro', hitmark: 16, cancel: abilCancel(42, { dash: 22, jump: 23, swap: 41 }),
      icd: { tag: 'none', group: 'none' }, gauge: 2,
    }],
    // 2 particles, 25% chance of 3 (gcsim): expected 2.25. Particle ICD 0.3 s.
    particles: { count: 2.25, perHit: false, icd: 18, element: 'pyro' },
  },
  burst: {
    frameFile: 'burst.go',
    cooldown: { param: 'param6' },
    energyCost: { param: 'param7' },
    hits: [{
      name: 'Fantastic Voyage', param: 'param1', element: 'pyro', hitmark: 37, cancel: abilCancel(53, { dash: 49, jump: 50, swap: 51 }),
      icd: { tag: 'none', group: 'none' }, gauge: 2,
    }],
  },
  passives: [
    {
      id: 'bennett.a4', unlock: 'a4',
      effects: [effect.parse({
        id: 'bennett.a4.press-cd', trigger: { on: 'onBurst' }, target: 'self', stat: 'cooldown.skill', value: -0.5, ...FIELD,
        assumption: 'Passion Overload cooldown is halved while the Bennett field is up (Bennett must be inside it).',
      })],
    },
  ],
  effects: [
    effect.parse({
      id: 'bennett.burst.atk', trigger: { on: 'onBurst' }, target: 'active', stat: 'atk', value: 0, ...FIELD,
      scaling: { from: 'self.baseAtk', ratio: { perTalentLevel: atkRatio, talent: 'burst' } },
      assumption: 'The field buffs whoever is on the field (assumed inside the field radius and above 70% HP, so the ATK bonus applies).',
    }),
  ],
  constellations: [
    { level: 1, text: "Fantastic Voyage's ATK increase no longer has an HP restriction, and gains an additional 20% of Bennett's Base ATK.", effects: [
      effect.parse({
        id: 'bennett.c1.atk', trigger: { on: 'onBurst' }, target: 'active', stat: 'atk', value: 0, ...FIELD,
        scaling: { from: 'self.baseAtk', ratio: 0.2 },
      }),
    ] },
    { level: 2, text: "When Bennett's HP falls below 70%, his Energy Recharge is increased by 30%.", effects: [
      effect.parse({
        id: 'bennett.c2.er', trigger: { on: 'always' }, target: 'self', stat: 'er', value: 0.3, condition: { hpBelow: 0.7 },
        assumption: 'Assumed active (Bennett below 70% HP). The sim does not track HP.',
      }),
    ] },
    { level: 3, text: 'Increases the Level of Passion Overload by 3 (max 15).', talentLevelBonus: { skill: 3 }, effects: [] },
    { level: 4, text: "A Normal Attack as the second attack of Passion Overload's Charge Level 1 performs a follow-up attack (135% of the second attack's DMG).", effects: [
      effect.parse({
        id: 'bennett.c4.followup', trigger: { on: 'custom' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'bennett.c4',
        assumption: 'Needs a hook and the hold variant of the skill, which is not modelled.',
      }),
    ] },
    { level: 5, text: 'Increases the Level of Fantastic Voyage by 3 (max 15).', talentLevelBonus: { burst: 3 }, effects: [] },
    { level: 6, text: "Sword, Claymore, or Polearm characters inside the field gain 15% Pyro DMG Bonus and Pyro infusion.", effects: [
      effect.parse({
        id: 'bennett.c6.pyro', trigger: { on: 'onBurst' }, target: 'active', stat: 'dmgBonus.pyro', value: 0.15, ...FIELD,
        assumption: 'Applies to whoever is attacking; the sword/claymore/polearm restriction is not checked.',
      }),
      effect.parse({
        id: 'bennett.c6.infusion', trigger: { on: 'onBurst' }, target: 'active', stat: 'infusion.pyro', value: 1, ...FIELD,
        assumption: 'Pyro infusion for normal/charged/plunge attacks of whoever is attacking (melee restriction not checked).',
      }),
    ] },
  ],
  recommended: {
    weapons: [{ id: 'favonius-sword', source: 'keqingmains' }, { id: 'aquila-favonia', source: 'keqingmains' }],
    artifacts: [{ sets: {"noblesse-oblige": 4}, source: 'keqingmains' }],
    mainStats: { sands: ["er", "hp%"], goblet: ["hp%"], circlet: ["healingBonus", "hp%"], source: 'keqingmains' },
  },
  usualCombo: [{ variant: 'off-field', actions: [{ action: 'burst' }, { action: 'skill' }] }],
  hooks: ['bennett.c4'],
  needsHook: true,
  assumptions: [
    'Only the press variant of the skill is modelled; the hold variants (Charge Level 1/2) and the charged attack are not in the KB.',
    'Frames are gcsim. The Fantastic Voyage ATK buff is applied 34 frames after the cast and lasts 846 frames (12 s of ticks plus 126 frames of the last tick).',
    'C4 needs a hook and the hold skill; inactive at the default C0.',
    'usualCombo is provisional pending /kb-update-teams (KeqingMains rotation).',
  ],
  extraSources: [
    { site: 'keqingmains', url: 'https://keqingmains.com/q/bennett-quickguide/', fields: ['recommended weapons', 'recommended artifact sets', 'recommended main stats'] },],
};
