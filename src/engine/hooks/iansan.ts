import { registerHook } from './api';

/**
 * Iansan (gcsim internal/characters/iansan: asc.go, burst.go, cons.go). One hook, by effect id:
 *
 *  iansan.a1     onCharged  (Enhanced Resistance Training) Swift Stormflight hitting gives Iansan herself
 *                +20% ATK for 900 frames (15s).
 *  iansan.burst  onBurst    (Kinetic Energy Scale) a flat ATK buff to whoever is on-field for 720 frames
 *                (12s): min(Iansan's ATK × 27%, `value` = the Max ATK Bonus for her Burst talent level).
 *  iansan.c2     onCharged  (C2) while A1's Precise Movement is up (900 frames from the same Swift Stormflight
 *                hit), the rest of the party also gets +30% ATK for the same duration.
 *
 * Not modelled: C1, C4, C6 (all need the Nightsoul point-restoration economy, which this sim does not track).
 */
const A1_DURATION = 900;
const A1_VALUE = 0.2;
const BURST_DURATION = 720;
const BURST_RATIO = 0.27;
const C2_VALUE = 0.3;

registerHook('iansan', (api) => {
  const owner = api.owner;
  const e = api.effect;
  const frame = api.action?.start ?? api.frame;

  switch (e.id) {
    case 'iansan.a1':
      api.buff({ effectId: 'iansan.a1', target: owner.id, stat: 'atk%', value: A1_VALUE, duration: A1_DURATION }, frame);
      return;

    case 'iansan.burst': {
      const atk = api.stats(owner, frame).atk;
      const value = Math.min(atk * BURST_RATIO, api.value);
      api.buff({ effectId: 'iansan.burst', target: 'active', stat: 'atk', value, duration: BURST_DURATION }, frame);
      return;
    }

    case 'iansan.c2':
      for (const c of api.characters) {
        if (c !== owner) api.buff({ effectId: 'iansan.c2', target: c.id, stat: 'atk%', value: C2_VALUE, duration: A1_DURATION }, frame);
      }
      return;

    default:
      api.assume(`${e.id}: unknown Iansan effect id, skipped`);
  }
});
