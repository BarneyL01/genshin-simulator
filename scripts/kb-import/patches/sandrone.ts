import type { Character } from '../../../src/schema/character';
import { effect } from '../../../src/schema/effect';

/**
 * Sandrone: only her Stellar-Conduct enabling passive and her Elemental Mastery passive are added to the
 * baseline record (no gcsim source exists for her). Her Fagio / Decoding mechanics and the Stellar-Conduct
 * damage variants of her attacks are NOT modelled, so her damage is understated.
 */
export function patch(c: Character): Character {
  const p = c.passives.map((x) => ({ ...x }));
  const p3 = p[2];
  if (p3) {
    p3.effects = [effect.parse({
      id: 'sandrone.stellar-conduct', trigger: { on: 'always' }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'stellar-conduct',
      assumption: 'Stellar Jubilee: Superconduct becomes Stellar-Conduct while Sandrone is in the team (Polestar Field: team Cryo/Electro DMG%, −40% physical RES). The team is assumed to stand inside the field.',
    })];
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
  c.assumptions.push('Patched: only the Stellar-Conduct enabling passive and the Elemental Mastery passive are modelled. No gcsim source exists for Sandrone, so all frames are estimated. Fagio\'s Decoding Power, Stellar-Conduct/Stellar Swirl damage variants of her attacks and constellations are NOT modelled.');
  return c;
}
