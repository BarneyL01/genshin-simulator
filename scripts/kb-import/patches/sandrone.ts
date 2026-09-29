import type { Character } from '../../../src/schema/character';
import { effect } from '../../../src/schema/effect';
import { param } from '../lib';

/**
 * Sandrone: skill (two Prism Shots) and burst (3 Bombardments + Ray) rewritten from the in-game text, with the
 * Radiance Stellar-Conduct forms (2nd Prism Shot, Ray) as `stellar` hit variants. No gcsim/KQM frame data
 * exists for her: frames stay the baseline's borrowed estimates. Fagio / Decoding Power is NOT modelled.
 */
export function patch(c: Character): Character {
  const S = { basePer100Atk: 0.007, baseMax: 0.14 };
  const sk = c.talents.skill!;
  const bu = c.talents.burst!;
  const [shot, , ] = sk.hits;
  const shot2Frames = sk.hits[1]!.frames;
  c.talents.skill = {
    ...sk,
    cooldown: 4 * 60,
    hits: [
      { ...shot!, name: 'Prism Shot 1', mv: param('Sandrone', 'combat2', 'param1') },
      { ...shot!, name: 'Prism Shot 2', mv: param('Sandrone', 'combat2', 'param1'), frames: shot2Frames, stellar: { mv: param('Sandrone', 'combat2', 'param2'), ...S } },
    ],
  };
  const b = bu.hits;
  c.talents.burst = {
    ...bu,
    hits: [
      b[0]!, b[1]!, b[2]!,
      { ...b[3]!, name: 'Convective Inhibition Ray', mv: param('Sandrone', 'combat3', 'param2'), stellar: { mv: param('Sandrone', 'combat3', 'param3'), ...S } },
    ],
  };
  const p = c.passives.map((x) => ({ ...x }));
  const p3 = p[2];
  if (p3) {
    p3.effects = [
      effect.parse({
        id: 'sandrone.stellar-conduct', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'stellar-conduct',
        assumption: 'Stellar Jubilee: Superconduct becomes Stellar-Conduct, and Cryo Swirl becomes Stellar Swirl, while Sandrone is in the team (Polestar Field: team Cryo/Electro DMG%, −40% physical RES; Stellar Swirl: see src/engine/reactions.ts). The team is assumed to stand inside the field.',
      }),
      effect.parse({
        id: 'sandrone.stellar-swirl-dmg', trigger: { on: 'always' }, target: 'team', stat: 'reactionBonus.stellarSwirl', value: 0,
        scaling: { from: 'self.atk', ratio: 0.00007, cap: 0.14 },
        assumption: "Stellar Jubilee: +0.7% Stellar Swirl reaction Base DMG per 100 of Sandrone's ATK (cap 14%), for whichever party member triggers it. (The same clause for Stellar-Conduct's Base DMG has no effect: Stellar-Conduct deals no reaction damage of its own in this engine, matching the real mechanic — its value comes entirely from the Polestar Field's team DMG% and the character-kit direct hits that reference it.)",
      }),
    ];
  }
  const p2 = p[1];
  if (p2) {
    p2.effects = [effect.parse({
      id: 'sandrone.a2-em', trigger: { on: 'always' }, target: 'self', stat: 'em', value: 0, scaling: { from: 'self.atk', ratio: 0.08, cap: 160 },
      assumption: '8 Elemental Mastery per 100 ATK, at most 160.',
    })];
  }
  c.passives = p;
  c.hooks = ['stellar-conduct'];
  c.needsHook = true;
  c.assumptions.push('Patched from in-game text: Prism Shot x2 and burst (Bombardment x3 + Ray). Inside a Polestar Field the 2nd Prism Shot and the Ray use their Stellar-Conduct multipliers, apply no element, ignore DEF and gain 0.7% base DMG per 100 ATK (max 14%, A3). Frames are estimated (borrowed from another character). Not modelled: Fagio / Decoding Power, the separate "Radiance: Stellar Swirl" upgraded hit forms of Prism Shot 2/Condensed Beam/Ray (this engine\'s `stellar` hit variant only supports one upgraded form, wired to Stellar-Conduct; a Stellar-Swirl-specific one would need a second field and dispatch logic), constellations.');
  return c;
}
