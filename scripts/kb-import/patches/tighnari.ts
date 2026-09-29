import type { Character } from '../../../src/schema/character';
import { abilCancel, param } from '../lib';

/**
 * Tighnari: the bulk importer's Charged Attack detector only matches labels literally named "Charged Attack DMG"
 * or "Fully-Charged Aimed Shot" — his real Charged Attack, "Wreath Arrow" (his whole Quicken/Spread/Aggravate
 * archetype's main hit), is genshin-db's own separate "Wreath Arrow DMG" label, so it was silently dropped and
 * his charged slot was empty. Added here from gcsim (aimed.go), using the common "fired right after Skill"
 * fast-draw case (skip = 142f from the Vijnana Suffusion status Skill grants), plus its 4 simultaneous
 * Clusterbloom Arrow sub-hits. Frames: gcsim internal/characters/tighnari/aimed.go.
 */
const src = { site: 'gcsim', url: 'https://github.com/genshinsim/gcsim/blob/488e22309e4ef43481923bfafe21b62d2a17b661/internal/characters/tighnari/aimed.go', commit: '488e22309e4ef43481923bfafe21b62d2a17b661' };

export function patch(c: Character): Character {
  const wreathMv = param('Tighnari', 'combat1', 'param7');
  const clusterMv = param('Tighnari', 'combat1', 'param8');
  c.talents.charged = {
    effects: [],
    hits: [{
      name: 'Wreath Arrow', mv: wreathMv, scaling: 'atk', element: 'dendro', gauge: 1, icd: { tag: 'extra', group: 'standard' },
      frames: { hitmark: 33, cancel: abilCancel(41, { dash: 33, jump: 33 }), source: src },
      extraHitmarks: [68, 68, 68, 68],
      extraMv: [clusterMv, clusterMv, clusterMv, clusterMv],
    }],
  };
  c.assumptions.push('Charged Attack ("Wreath Arrow") added by patch: the bulk importer only recognises literally-named "Charged Attack DMG"/"Fully-Charged Aimed Shot" labels and missed this one entirely. Modelled as fired right after Skill (Vijnana Suffusion active, the fast-draw case), with its 4 simultaneous Clusterbloom Arrow sub-hits; the plain (non-Suffusion, slower) Aimed Shot and Fully-Charged Aimed Shot are not modelled, since the rotation always casts Skill first. Passives (A1/A4 EM-DMG% scaling) and constellations remain unmodelled baseline.');
  return c;
}
