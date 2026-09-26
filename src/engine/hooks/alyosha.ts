import { registerHook } from './api';

/**
 * Alyosha's burst (in-game text; no frame source exists, so timings are estimates): Fulgurite Hunting Field and
 * Tugarin strike the enemy every 2 s while the field lasts (14 s). The cast frame itself carries the first strike
 * (the burst's own hits); this hook adds the remaining ones as hook hits `field` and `tugarin`.
 */
const FIRST_HIT = 73; // matches the burst's own hitmark
const INTERVAL = 120;

registerHook('alyosha', (api) => {
  const e = api.effect;
  if (e.id !== 'alyosha.burst-field') {
    api.assume(`${e.id}: unknown Alyosha effect id, skipped`);
    return;
  }
  const start = (api.action?.start ?? api.frame) + FIRST_HIT;
  const end = start + (e.duration ?? 840);
  for (let t = start + INTERVAL; t < end; t += INTERVAL) {
    api.hit('field', t);
    api.hit('tugarin', t + 3);
  }
});
