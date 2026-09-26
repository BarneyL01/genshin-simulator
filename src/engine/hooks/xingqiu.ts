import { registerHook, type HookApi } from './api';

/**
 * Xingqiu: orbitals and Rain Sword waves. Timings from gcsim internal/characters/xingqiu
 * (skill.go, burst.go, orbital.go, the minazuki watcher). One hook, discriminated by effect id:
 *
 *  xingqiu.orbital.skill   onSkill  delay = first tick (43), duration = orbital lifetime (900)
 *  xingqiu.orbital.burst   onBurst  delay = first tick (18), duration = orbital lifetime (900)
 *  xingqiu.burst.state     onBurst  duration = burst lifetime (900; +33 animation frames)
 *  xingqiu.burst.wave      onAnyNormal: any character starting a normal attack while the burst is up
 *                          summons a wave (at most one per 60 frames), swords land 20 frames later
 *  xingqiu.c2 / xingqiu.c6 always   flags (C2: `duration` = extra burst/orbital frames; C6: 2→3→5 swords + 3 energy)
 *
 * Hook hits on the character: `orbital` (Hydro application, no damage) and `sword-rain`.
 */
const ORBITAL_TICK = 135;
const WAVE_ICD = 60;
const SWORD_DELAY = 20;
const BURST_ANIM = 33;
const C2_SHRED = { stat: 'res.enemy.hydro', value: -0.15, duration: 240 };

interface State {
  c2?: number;
  c6?: boolean;
  orbitalExpiry?: number;
  orbitalNext?: number;
  burstEnd?: number;
  nextWave?: number;
  waveIdx?: number;
}

function extendOrbital(api: HookApi, st: State, duration: number): void {
  const cast = api.frame - (api.effect.delay ?? 0);
  const expiry = cast + duration;
  const active = st.orbitalExpiry !== undefined && st.orbitalNext !== undefined && cast <= st.orbitalExpiry;
  let next = active ? st.orbitalNext! : api.frame;
  while (next <= expiry) {
    api.hit('orbital', next);
    next += ORBITAL_TICK;
  }
  st.orbitalNext = next;
  st.orbitalExpiry = expiry;
}

registerHook('xingqiu', (api) => {
  const st = api.state as State;
  const dur = api.effect.duration ?? 900;
  switch (api.effect.id) {
    case 'xingqiu.c2':
      st.c2 = api.effect.duration ?? 180;
      return;
    case 'xingqiu.c6':
      st.c6 = true;
      return;
    case 'xingqiu.orbital.skill':
      extendOrbital(api, st, dur);
      return;
    case 'xingqiu.orbital.burst':
      extendOrbital(api, st, dur + (st.c2 ?? 0));
      return;
    case 'xingqiu.burst.state':
      st.burstEnd = api.frame + dur + (st.c2 ?? 0) + BURST_ANIM;
      st.waveIdx = 0;
      st.nextWave = -Infinity;
      return;
    case 'xingqiu.burst.wave': {
      if (st.burstEnd === undefined || api.frame > st.burstEnd || api.frame < (st.nextWave ?? -Infinity)) return;
      const seq = st.c6 ? [2, 3, 5] : [2, 3];
      const n = seq[(st.waveIdx ?? 0) % seq.length]!;
      const land = api.frame + SWORD_DELAY;
      for (let i = 0; i < n; i++) api.hit('sword-rain', land);
      if (st.c6 && n === 5) api.energy(api.owner.id, 3, land);
      if (st.c2) api.buff({ effectId: 'xingqiu.c2.hydro-res', target: 'enemy', ...C2_SHRED }, land + 1);
      st.waveIdx = (st.waveIdx ?? 0) + 1;
      st.nextWave = api.frame + WAVE_ICD;
      return;
    }
    default:
      api.assume(`${api.effect.id}: unknown Xingqiu effect id, skipped`);
  }
});
