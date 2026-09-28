import { registerHook } from './api';

/**
 * Jean (gcsim internal/characters/jean: burst.go, asc.go, cons.go). One hook, by effect id:
 *
 *  jean.a4          onBurst  Let the Wind Lead: +16 flat Energy (20% of the 80 cost) on cast.
 *  jean.field-ticks onBurst  Dandelion Breeze's field: 10 periodic 0-damage Anemo pulses (first at 100 frames,
 *                   every 60 after), each only able to deal damage via a real Swirl the reaction engine computes
 *                   if another party member has applied a different element nearby.
 *  jean.c4          onBurst  (C4) −40% Anemo RES on the enemy for the whole field duration.
 *
 * Not modelled: healing (Wind Companion A1, Dandelion Breeze's own heals — out of scope for this sim), the
 * hold-and-pull Gale Blade and its C1 bonus, C2 (particle-catch party buff), C6 (incoming DMG reduction).
 */
const A4_ENERGY = 16;
const FIELD_DURATION = 640; // 600 + burstStart(40): matches gcsim's field lifetime
const FIRST_TICK = 100;
const TICK_INTERVAL = 60;
const C4_RES_VALUE = -0.4;

registerHook('jean', (api) => {
  const owner = api.owner;
  const e = api.effect;
  const c4 = owner.effects.some((x) => x.id === 'jean.c4');

  switch (e.id) {
    case 'jean.a4': {
      const start = api.action?.start ?? api.frame;
      api.energy(owner.id, A4_ENERGY, start + 1);
      return;
    }

    case 'jean.field-ticks': {
      const start = api.action?.start ?? api.frame;
      for (let t = start + FIRST_TICK; t <= start + FIELD_DURATION; t += TICK_INTERVAL) {
        api.hit('field-tick', t);
      }
      if (c4) {
        api.buff({ effectId: 'jean.c4', target: 'enemy', stat: 'res.enemy.anemo', value: C4_RES_VALUE, duration: FIELD_DURATION }, start - 1);
      }
      return;
    }

    case 'jean.c4':
      return; // marker only, read via owner.effects above

    default:
      api.assume(`${e.id}: unknown Jean effect id, skipped`);
  }
});
