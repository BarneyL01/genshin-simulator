import type { Element } from '../types';
import { registerHook } from './api';

/**
 * Sucrose (gcsim internal/characters/sucrose: asc.go, burst.go, cons.go). One hook, by effect id:
 *
 *  sucrose.a1     onReaction  Catalyst Conversion: on Sucrose's own Swirl OR Stellar Swirl, +50 EM for 8s to
 *                 party members (excluding Sucrose) whose element matches the swirled element. Stellar Swirl
 *                 always swirls Cryo, so that case is exact; the engine doesn't expose which element a plain
 *                 Swirl used, so that case still falls back to the team's fixed "conversion element" (first of
 *                 Pyro/Hydro/Electro/Cryo present), like Varka's conversion-element mechanic.
 *  sucrose.a4     onHit  Mollis Favonius: Skill or Burst hits landing give the rest of the party +20% of
 *                 Sucrose's own EM for 8s.
 *  sucrose.burst  onBurst  Forbidden Creation-Isomer 75/Type II: periodic Anemo DoT ticks (hookHit `burst-dot`),
 *                 every 113 frames from 137 for 360 frames (480 with C2), plus one absorbed-element tick per DoT
 *                 tick (hookHit `burst-absorb`) once the party is assumed to have an absorbable element present.
 *  sucrose.c6     (marker only, checked by `sucrose.burst`)
 *
 * Not modelled: C1's extra charge, C4's CD-reduction proc counter (both action-economy only).
 */
const PRIORITY: Element[] = ['pyro', 'hydro', 'electro', 'cryo'];
const A1_EM = 50;
const A1_DURATION = 480;
const A4_EM_FRACTION = 0.2;
const A4_DURATION = 480;
const DOT_START = 137;
const DOT_INTERVAL = 113;
const DOT_DURATION_BASE = 360;
const DOT_DURATION_C2 = 480;
const DOT_END_SLACK = 5;
const C6_DMG_VALUE = 0.2;

interface State {
  conversionElem?: Element;
}

registerHook('sucrose', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;
  const c2 = owner.effects.some((x) => x.id === 'sucrose.c2');
  const c6 = owner.effects.some((x) => x.id === 'sucrose.c6');

  const conversionElem = () => {
    if (st.conversionElem === undefined) {
      st.conversionElem = PRIORITY.find((el) => api.characters.some((c) => c.element === el));
    }
    return st.conversionElem;
  };

  switch (e.id) {
    case 'sucrose.a1': {
      const name = api.reaction?.name;
      if ((name !== 'swirl' && name !== 'stellarSwirl') || api.reaction!.actor !== owner) return;
      // Stellar Swirl always swirls Cryo; plain Swirl's element isn't exposed here, so it still falls back
      // to the team's fixed conversion element (see the module doc comment).
      const elem = name === 'stellarSwirl' ? 'cryo' : conversionElem();
      if (!elem) return;
      const f = api.reaction!.frame;
      for (const c of api.characters) {
        if (c === owner || c.element !== elem) continue;
        api.buff({ effectId: 'sucrose.a1', target: c.id, stat: 'em', value: A1_EM, duration: A1_DURATION }, f);
      }
      return;
    }

    case 'sucrose.a4': {
      const hi = api.hitInfo;
      if (!hi || hi.actor !== owner || !hi.applied) return;
      if (hi.action !== 'skill' && hi.action !== 'burst-dot' && hi.action !== 'burst-absorb') return;
      const em = api.stats(owner, hi.frame).em;
      const value = em * A4_EM_FRACTION;
      for (const c of api.characters) {
        if (c === owner) continue;
        api.buff({ effectId: 'sucrose.a4', target: c.id, stat: 'em', value, duration: A4_DURATION }, hi.frame);
      }
      return;
    }

    case 'sucrose.burst': {
      const start = api.action?.start ?? api.frame;
      const duration = c2 ? DOT_DURATION_C2 : DOT_DURATION_BASE;
      const elem = conversionElem();
      for (let t = start + DOT_START; t <= start + duration + DOT_END_SLACK; t += DOT_INTERVAL) {
        api.hit('burst-dot', t);
        if (elem) {
          api.hit('burst-absorb', t, { override: { element: elem } });
          if (c6) {
            for (const c of api.characters) {
              api.buff({ effectId: 'sucrose.c6', target: c.id, stat: `dmgBonus.${elem}`, value: C6_DMG_VALUE, duration: DOT_INTERVAL + 1 }, t);
            }
          }
        }
      }
      return;
    }

    case 'sucrose.c1':
    case 'sucrose.c2':
    case 'sucrose.c4':
    case 'sucrose.c6':
      return; // markers only, or not modelled (see spec assumptions)

    default:
      api.assume(`${e.id}: unknown Sucrose effect id, skipped`);
  }
});
