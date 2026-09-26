import type { Character } from '../../../src/schema/character';
import { effect } from '../../../src/schema/effect';
import { param } from '../lib';

/**
 * Alyosha, from in-game text (no gcsim/KQM frame data exists: frames are estimates borrowed from other characters):
 * Hunter's Precision ATK% on the on-field character, burst ticks (Fulgurite Hunting Field + Tugarin every 2 s for
 * 14 s, via hook "alyosha") and the A2 ER -> skill/burst DMG% bonus. Not modelled: healing, Stellar-Conduct DMG% buff, constellations.
 */
export function patch(c: Character): Character {
  const bu = c.talents.burst!;
  c.talents.burst = { ...bu, effects: [] };
  c.hookHits = {
    field: { ...bu.hits[0]!, name: 'Fulgurite Hunting Field (tick)', talent: 'burst', frames: { hitmark: 0, cancel: {}, source: bu.hits[0]!.frames?.source } },
    tugarin: { ...bu.hits[1]!, name: 'Tugarin (tick)', talent: 'burst', frames: { hitmark: 0, cancel: {}, source: bu.hits[1]!.frames?.source } },
  };
  c.effects = [
    effect.parse({
      id: 'alyosha.hunters-precision', trigger: { on: 'onSkill' }, target: 'active', stat: 'atk%',
      value: { perTalentLevel: param('Alyosha', 'combat2', 'param5'), talent: 'skill' }, delay: 30, duration: 15 * 60,
      assumption: "Hunter's Precision ATK% for the on-field character, starting 30 frames after the cast for 15 s; the Hunter's Mark is assumed to be activated by the on-field character's first hit.",
    }),
    effect.parse({
      id: 'alyosha.burst-field', trigger: { on: 'onBurst' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'alyosha', duration: 14 * 60,
      assumption: 'Field and Tugarin strike every 2 s for 14 s; first strike at the burst hitmark. Tick timing is estimated.',
    }),
    effect.parse({
      id: 'alyosha.a2-er', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.skill', value: 0, scaling: { from: 'self.er', ratio: 0.35, cap: 0.7 },
      assumption: 'A2: +0.35% skill DMG per 1% ER, max 70%; ER read as the total ER multiplier (200% ER = max).',
    }),
    effect.parse({
      id: 'alyosha.a2-er-burst', trigger: { on: 'always' }, target: 'self', stat: 'dmgBonus.burst', value: 0, scaling: { from: 'self.er', ratio: 0.35, cap: 0.7 },
      assumption: 'A2, burst part.',
    }),
  ];
  c.hooks = ['alyosha'];
  c.needsHook = true;
  c.assumptions.push('Patched from in-game text: Hunter\'s Precision ATK%, burst ticks every 2 s for 14 s, A2 ER-based DMG bonus. Frames are estimated. Not modelled: Hunter\'s Mark state, healing, Stellar-Conduct DMG% buff, constellations.');
  return c;
}
