import { registerHook, type HookApi } from './api';

/**
 * Zhongli: Stone Stele and Jade Shield (gcsim internal/characters/zhongli skill.go, stele.go, shield.go, burst.go).
 *
 *  zhongli.c1       always   flag: up to 2 steles at once
 *  zhongli.stele    onSkill  `duration` = stele lifetime. Press (action `skill-press`): the stele appears at
 *                            `PRESS_CREATE` (its initial hit is the action's own hit) and replaces the oldest one when at the
 *                            limit. Hold (action `skill`): appears at `HOLD_CREATE` only if below the limit (initial hit `stele-initial`).
 *                            A stele resonates every 120 frames (`stele-tick`, with a 50% chance of a Geo particle, ICD 90).
 *  zhongli.shield   onSkill  Hold only: Jade Shield lowers enemy Pyro/Hydro/Electro/Cryo/Anemo/Geo/Dendro/Physical RES by
 *                            `value` (−20%) for `duration` frames (shield lifetime, assumed never broken)
 *  zhongli.c2       onBurst  the burst also gives a Jade Shield: same RES reduction at the burst hit
 *
 * A4 flat damage is a plain dynamic effect in the KB (flatDmg.skill / burst / normal), not part of this hook.
 */
const PRESS_CREATE = 24;
const HOLD_CREATE = 48;
const BURST_HIT = 101;
const TICK = 120;
const PARTICLE_ICD = 90;
const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro', 'physical'] as const;

interface Stele {
  created: number;
  expiry: number;
  cancels: Array<{ cancel(): void }>;
}

interface State {
  c1?: boolean;
  steles?: Stele[];
  lastParticle?: number;
}

function createStele(api: HookApi, st: State, at: number, initialHit: boolean): void {
  const life = api.effect.duration ?? 1860;
  const steles = (st.steles ??= []).filter((s) => s.expiry > at);
  const max = st.c1 ? 2 : 1;
  if (steles.length >= max) {
    const oldest = steles.shift()!;
    for (const h of oldest.cancels) h.cancel();
  }
  const stele: Stele = { created: at, expiry: at + life, cancels: [] };
  if (initialHit) api.hit('stele-initial', at);
  for (let t = at + TICK; t < stele.expiry; t += TICK) {
    stele.cancels.push(api.hit('stele-tick', t));
    // 50% chance of one Geo particle per tick, at most once per 90 frames
    if (t - (st.lastParticle ?? -Infinity) >= PARTICLE_ICD) {
      st.lastParticle = t;
      api.particles({ count: 0.5, element: 'geo', frame: t + 100 });
    }
  }
  steles.push(stele);
  st.steles = steles;
}

function shield(api: HookApi, at: number): void {
  const dur = api.effect.duration ?? 1200;
  for (const el of ELEMENTS) {
    api.buff({ effectId: `zhongli.jade-shield.${el}`, target: 'enemy', stat: `res.enemy.${el}`, value: api.value, duration: dur }, at);
  }
}

registerHook('zhongli', (api) => {
  const st = api.state as State;
  const name = api.action?.name;
  switch (api.effect.id) {
    case 'zhongli.c1':
      st.c1 = true;
      return;
    case 'zhongli.stele': {
      if (!name) return;
      const start = api.action!.start;
      if (name === 'skill-press') createStele(api, st, start + PRESS_CREATE, false);
      else if (name === 'skill') {
        const live = (st.steles ?? []).filter((s) => s.expiry > start + HOLD_CREATE).length;
        if (live < (st.c1 ? 2 : 1)) createStele(api, st, start + HOLD_CREATE, true);
      }
      return;
    }
    case 'zhongli.shield':
      if (name === 'skill') shield(api, api.action!.start + HOLD_CREATE);
      return;
    case 'zhongli.c2':
      if (api.action) shield(api, api.action.start + BURST_HIT);
      return;
    default:
      api.assume(`${api.effect.id}: unknown Zhongli effect id, skipped`);
  }
});
