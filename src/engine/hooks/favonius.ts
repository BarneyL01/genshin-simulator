import { registerHook } from './api';

/**
 * Favonius weapons ("Windfall"): CRIT hits by the on-field wielder have a chance to make a particle
 * burst worth 6 energy (3 colourless particles), at most once per cooldown.
 *
 * Expected-value model: whenever the wielder starts an action while the cooldown is ready, the burst
 * drops `chance` × 3 particles (assuming at least one CRIT lands), then the cooldown starts.
 *
 * KB effect: `value.perRefinement` = proc chance, `icd.perRefinement` = cooldown in frames. One effect
 * per action trigger (onNormal / onCharged / onSkill / onBurst).
 */
registerHook('weapon.favonius', (api) => {
  const r = api.owner.refinement - 1;
  const v = api.effect.value;
  const chance = typeof v === 'number' ? v : 'perRefinement' in v ? (v.perRefinement[r] ?? 0) : 0;
  const icd = api.effect.icd;
  const cd = typeof icd === 'number' ? icd : icd && 'perRefinement' in icd ? (icd.perRefinement[r] ?? 720) : 720;
  const ready = (api.state.readyAt as number | undefined) ?? -Infinity;
  if (api.frame < ready) return;
  api.state.readyAt = api.frame + cd;
  api.particles({ count: 3 * chance, element: 'none' });
  api.assume(`${api.effect.id}: assumes a CRIT hit lands when the wielder acts (proc chance applied as expected value)`);
});
