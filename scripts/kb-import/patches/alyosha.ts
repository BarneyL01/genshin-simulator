import type { Character } from '../../../src/schema/character';
import { effect } from '../../../src/schema/effect';
import { param } from '../lib';

/**
 * Alyosha: the Hunter's Precision ATK% buff on the on-field character is added to the baseline record.
 * No gcsim source exists for him; Tugarin's periodic attacks, healing, the Stellar-Conduct DMG% buff and the
 * constellations are NOT modelled (his burst is a single lumped hit).
 */
export function patch(c: Character): Character {
  c.effects = [
    effect.parse({
      id: 'alyosha.hunters-precision', trigger: { on: 'onSkill' }, target: 'active', stat: 'atk%',
      value: { perTalentLevel: param('Alyosha', 'combat2', 'param5'), talent: 'skill' }, delay: 30, duration: 15 * 60,
      assumption: "Hunter's Precision ATK% for the on-field character, starting 30 frames after the cast, for an assumed 15 s; the Hunter's Mark is assumed to be activated by the on-field character's first hit.",
    }),
  ];
  c.assumptions.push("Patched: only the Hunter's Precision ATK% buff is added. No gcsim source exists for Alyosha (frames estimated). Tugarin's periodic attacks, healing, the Stellar-Conduct DMG% buff (he cannot enable Stellar-Conduct himself) and the constellations are NOT modelled.");
  return c;
}
