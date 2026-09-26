import type { Effect } from '../../../src/schema/effect';
import { effect } from '../../../src/schema/effect';
import { refineValues } from '../lib';
import type { WeaponSpec } from '../weapon-lib';

const per = (name: string, i: number) => ({ perRefinement: refineValues(name, i) });
const neg = (name: string, i: number) => ({ perRefinement: refineValues(name, i).map((v) => -v) });
const E = (e: Partial<Effect> & Pick<Effect, 'id' | 'stat'>): Effect =>
  effect.parse({ trigger: { on: 'always' }, target: 'self', value: 0, ...e });

const FAVONIUS_ASSUMPTION =
  'Windfall is modelled as expected value: when the wielder starts an action and the cooldown is ready, 3 colourless particles × proc chance drop (assumes a CRIT hit lands). See hook weapon.favonius.';
const favonius = (id: string, name: string): Effect[] =>
  (['onNormal', 'onCharged', 'onSkill', 'onBurst'] as const).map((on) =>
    E({
      id: `${id}.windfall.${on}`, trigger: { on }, stat: 'energyGain', hook: 'weapon.favonius',
      value: per(name, 0), icd: { perRefinement: refineValues(name, 1).map((s) => Math.round(s * 60)) },
      assumption: FAVONIUS_ASSUMPTION,
    }),
  );

export const specs: WeaponSpec[] = [
  {
    id: 'the-catch', dbName: 'The Catch', gcsimDir: 'spear/catch', obtain: { method: 'shop', freeRefinement: 5 }, obtainVerified: true,
    extraSources: [{ site: 'keqingmains', url: 'https://keqingmains.com/q/raiden-quickguide/', fields: ['obtain: free from the Inazuma Fishing Association; R5 attainable by fishing'] }],
    effects: [
      E({ id: 'the-catch.burst-dmg', stat: 'dmgBonus.burst', value: per('The Catch', 0) }),
      E({ id: 'the-catch.burst-cr', stat: 'critRate.burst', value: per('The Catch', 1) }),
    ],
    assumptions: ['gcsim formulas (DMG 0.12 + 0.04 R, CRIT 0.045 + 0.015 R) match genshin-db at every refinement.'],
  },
  {
    id: 'engulfing-lightning', dbName: 'Engulfing Lightning', gcsimDir: 'spear/engulfing', obtain: { method: 'gacha', freeRefinement: null },
    effects: [
      // ATK% = ratio × (ER − 100%), capped. `er` is the multiplier (1 + bonus), so base = −ratio.
      E({
        id: 'engulfing-lightning.atk', stat: 'atk%',
        scaling: { from: 'self.er', ratio: per('Engulfing Lightning', 0), base: neg('Engulfing Lightning', 0), cap: per('Engulfing Lightning', 1) },
        assumption: 'Evaluated at hit time, so the ER buff from the burst raises the ATK bonus too.',
      }),
      E({
        id: 'engulfing-lightning.er', trigger: { on: 'onBurst' }, stat: 'er', value: per('Engulfing Lightning', 2), duration: 720,
        assumption: 'Applies when the wielder uses their burst (gcsim requires the wielder to be on the field).',
      }),
    ],
    assumptions: ['gcsim formulas (ATK 0.21 + 0.07 R, cap 0.7 + 0.1 R, ER 0.25 + 0.05 R, 720 frames) match genshin-db at every refinement.'],
  },
  {
    id: 'staff-of-homa', dbName: 'Staff of Homa', gcsimDir: 'spear/homa', obtain: { method: 'gacha', freeRefinement: null },
    effects: [
      E({ id: 'staff-of-homa.hp', stat: 'hp%', value: per('Staff of Homa', 0) }),
      E({ id: 'staff-of-homa.atk', stat: 'atk', scaling: { from: 'self.hp', ratio: per('Staff of Homa', 1) } }),
      E({
        id: 'staff-of-homa.atk-low-hp', stat: 'atk', scaling: { from: 'self.hp', ratio: per('Staff of Homa', 2) },
        condition: { hpBelow: 0.5 },
        assumption: 'Wielder HP is assumed to be below 50% (the extra ATK bonus is always on). Hu Tao rotations usually sit near or below 50% HP, but the sim does not track HP.',
      }),
    ],
    assumptions: ['gcsim formulas (HP 0.15 + 0.05 R, ATK 0.006 + 0.002 R, low-HP extra 0.008 + 0.002 R) match genshin-db at every refinement.'],
  },
  {
    id: 'aqua-simulacra', dbName: 'Aqua Simulacra', gcsimDir: 'bow/aqua', obtain: { method: 'gacha', freeRefinement: null },
    effects: [
      E({ id: 'aqua-simulacra.hp', stat: 'hp%', value: per('Aqua Simulacra', 0) }),
      E({
        id: 'aqua-simulacra.dmg', stat: 'dmgBonus.all', value: per('Aqua Simulacra', 1),
        assumption: 'Enemies are always nearby, on-field or off-field (single-target sim).',
      }),
    ],
    assumptions: ['gcsim formulas (HP 0.12 + 0.04 R, DMG 0.15 + 0.05 R) match genshin-db at every refinement.'],
  },
  {
    id: 'aquila-favonia', dbName: 'Aquila Favonia', gcsimDir: 'sword/aquila', obtain: { method: 'gacha', freeRefinement: null },
    effects: [E({ id: 'aquila-favonia.atk', stat: 'atk%', value: per('Aquila Favonia', 0) })],
    assumptions: [
      'gcsim formula (ATK 0.15 + 0.05 R) matches genshin-db.',
      "The heal and 200% ATK physical AoE proc need the wielder to take damage; the sim has no enemy attacks, so the proc is not modelled.",
    ],
  },
  {
    id: 'favonius-sword', dbName: 'Favonius Sword', gcsimDir: 'sword/favonius', obtain: { method: 'gacha', freeRefinement: null },
    effects: favonius('favonius-sword', 'Favonius Sword'), needsHook: true,
    assumptions: ['gcsim proc chance (0.5 + 0.1 R) and cooldown (810 − 90 R frames) match genshin-db.', FAVONIUS_ASSUMPTION],
  },
  {
    id: 'favonius-warbow', dbName: 'Favonius Warbow', gcsimDir: 'bow/favonius', obtain: { method: 'gacha', freeRefinement: null },
    effects: favonius('favonius-warbow', 'Favonius Warbow'), needsHook: true,
    assumptions: ['gcsim proc chance (0.5 + 0.1 R) and cooldown (810 − 90 R frames) match genshin-db.', FAVONIUS_ASSUMPTION],
  },
  {
    id: 'favonius-lance', dbName: 'Favonius Lance', gcsimDir: 'spear/favonius', obtain: { method: 'gacha', freeRefinement: null },
    effects: favonius('favonius-lance', 'Favonius Lance'), needsHook: true,
    assumptions: ['gcsim proc chance (0.5 + 0.1 R) and cooldown (810 − 90 R frames) match genshin-db.', FAVONIUS_ASSUMPTION],
  },
  {
    id: 'black-tassel', dbName: 'Black Tassel', gcsimDir: 'spear/blacktassel', obtain: { method: 'gacha', freeRefinement: null },
    effects: [],
    assumptions: ['The passive only affects DMG against slimes, so it has no effect in the default enemy setup.'],
    dataConfidence: 'medium',
  },
];
