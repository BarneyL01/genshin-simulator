import type { Element } from '../types';
import { registerHook } from './api';

/**
 * Yumemizuki Mizuki (gcsim internal/characters/mizuki: skill.go, burst.go, asc.go). One hook, by effect id:
 *
 *  mizuki.skill   onSkill  Dreamdrifter: 7 periodic 'cloud' pulses (resolving 48f after cast, then every 45f —
 *                 matches gcsim's skill.go cloudTask chain) over the ~5.3s the state is up. Also snapshots her
 *                 own EM once to set every party member's `reactionBonus.swirl` / `reactionBonus.stellarSwirl`
 *                 for the same window (genshin-db's per-100-EM Skill parameters, carried by the 'custom'-trigger
 *                 value-only effects mizuki.swirl-bonus-table / mizuki.stellar-swirl-bonus-table).
 *  mizuki.burst   onBurst  8 'snack' (Munen Shockwave) ticks, one per spawned snack, each resolving 4s after its
 *                 spawn time (assumed to always expire unpicked — see spec assumptions).
 *  mizuki.a4      onHit  +100 EM for 4s to Mizuki herself when another nearby party member lands a Pyro/Hydro/
 *                 Cryo/Electro hit while Dreamdrifter is active (0.3s ICD).
 *  mizuki.c6-self onSkill  Self CRIT Rate/DMG scaling with EM above 500 (capped +20%/+80%) — modelled as applying
 *                 whenever Dreamdrifter starts, snapshotted like the rest of her Skill-triggered buffs.
 *
 * Not modelled: C1 (needs an enemy-status timer), C4 (needs snack pickup), C6's Swirl-crit grant for other
 * characters (needs a per-reaction crit override the engine doesn't have).
 */
const CLOUD_TICKS = [48, 93, 138, 183, 228, 273, 318];
const DREAMDRIFTER_DURATION = 320;
const SNACK_COUNT = 8;
const SNACK_SPAWN_INTERVAL = 90;
const SNACK_SPAWN_START = 93 + SNACK_SPAWN_INTERVAL;
const SNACK_EXPIRY_DELAY = 240;
const A4_EM = 100;
const A4_DURATION = 240;
const A4_ICD = 18;
const C6_EM_THRESHOLD = 500;
const C6_CR_PER_EM = 0.0004;
const C6_CD_PER_EM = 0.0016;
const C6_CR_CAP = 0.2;
const C6_CD_CAP = 0.8;
const A4_ELEMENTS = new Set<Element>(['pyro', 'hydro', 'cryo', 'electro']);

interface State {
  a4Ready?: number;
}

registerHook('mizuki', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;
  const c6 = owner.effects.some((x) => x.id === 'mizuki.c6-self');

  switch (e.id) {
    case 'mizuki.skill': {
      const start = api.action?.start ?? api.frame;
      for (const t of CLOUD_TICKS) api.hit('cloud', start + t);

      const em = api.stats(owner, start).em;
      const swirlBonus = (api.valueOf('mizuki.swirl-bonus-table') * em) / 100;
      const stellarBonus = (api.valueOf('mizuki.stellar-swirl-bonus-table') * em) / 100;
      for (const c of api.characters) {
        api.buff({ effectId: 'mizuki.swirl-bonus', target: c.id, stat: 'reactionBonus.swirl', value: swirlBonus, duration: DREAMDRIFTER_DURATION }, start);
        api.buff({ effectId: 'mizuki.stellar-swirl-bonus', target: c.id, stat: 'reactionBonus.stellarSwirl', value: stellarBonus, duration: DREAMDRIFTER_DURATION }, start);
      }
      return;
    }

    case 'mizuki.burst': {
      const start = api.action?.start ?? api.frame;
      for (let i = 1; i <= SNACK_COUNT; i++) api.hit('snack', start + SNACK_SPAWN_START + (i - 1) * SNACK_SPAWN_INTERVAL + SNACK_EXPIRY_DELAY);
      return;
    }

    case 'mizuki.a4': {
      const hi = api.hitInfo;
      if (!hi || hi.actor === owner || !A4_ELEMENTS.has(hi.hit.element)) return;
      if (hi.frame < (st.a4Ready ?? -Infinity)) return;
      st.a4Ready = hi.frame + A4_ICD;
      api.buff({ effectId: 'mizuki.a4', target: owner.id, stat: 'em', value: A4_EM, duration: A4_DURATION }, hi.frame);
      return;
    }

    case 'mizuki.c6-self': {
      if (!c6) return;
      const start = api.action?.start ?? api.frame;
      const em = Math.max(0, api.stats(owner, start).em - C6_EM_THRESHOLD);
      const cr = Math.min(em * C6_CR_PER_EM, C6_CR_CAP);
      const cd = Math.min(em * C6_CD_PER_EM, C6_CD_CAP);
      api.buff({ effectId: 'mizuki.c6-self.cr', target: owner.id, stat: 'critRate', value: cr, duration: DREAMDRIFTER_DURATION }, start);
      api.buff({ effectId: 'mizuki.c6-self.cd', target: owner.id, stat: 'critDmg', value: cd, duration: DREAMDRIFTER_DURATION }, start);
      return;
    }

    case 'mizuki.swirl-bonus-table':
    case 'mizuki.stellar-swirl-bonus-table':
      return; // value-only carriers, read via api.valueOf above

    default:
      api.assume(`${e.id}: unknown Mizuki effect id, skipped`);
  }
});
