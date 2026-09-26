import { registerHook } from './api';

/**
 * Raiden Shogun. Timings and rules from gcsim internal/characters/raiden (skill.go, burst.go,
 * attack.go, charge.go). One hook, discriminated by effect id:
 *
 *  raiden.c1                 always       flag: more Resolve from other characters' bursts (1.8× Electro, 1.2× others)
 *  raiden.resolve.gain       onAnyBurst   other characters' bursts add Resolve: energy cost × `value` (cap 60)
 *  raiden.resolve.base       onBurst      consumes stacks; adds `value` × stacks MV to the hit named by trigger.filter.hit
 *  raiden.resolve.sword      onBurst      adds `value` × stacks MV to the sword hits listed in trigger.filter.hits (comma
 *                                          separated) and opens the Musou Isshin window (`duration` frames; buff `raiden.musou`)
 *  raiden.musou.restore.*    onNormal / onCharged   in the window, sword hits restore `value` energy (× (1 + 0.6 ER over 100%))
 *                                          to the whole team, at most once per second and 5 times per burst
 *  raiden.eye                onSkill      opens the Eye window (`duration` frames)
 *  raiden.eye.strike         onHit        during the Eye window any team hit (except Raiden's own skill hit and the strike
 *                                          itself) triggers a coordinated attack, at most once per 54 frames, landing 5 frames later
 *
 * Hook hit on the character: `eye-strike`.
 * Not modelled: A1 (+2 Resolve per particle pickup) and C6 (burst CD reduction for other characters).
 */
const RESTORE_ICD = 60;
const RESTORE_MAX = 5;
const STRIKE_ICD = 54;
const STRIKE_DELAY = 5;
const RESOLVE_CAP = 60;
const A4_ENERGY_PER_ER = 0.6;

interface State {
  c1?: boolean;
  stacks?: number;
  consumed?: number;
  musouStart?: number;
  musouEnd?: number;
  restoreReady?: number;
  restoreCount?: number;
  eyeStart?: number;
  eyeEnd?: number;
  nextStrike?: number;
}

registerHook('raiden', (api) => {
  const st = api.state as State;
  const e = api.effect;
  switch (e.id) {
    case 'raiden.c1':
      st.c1 = true;
      return;

    case 'raiden.resolve.gain': {
      const actor = api.actor;
      if (!actor || actor === api.owner) return;
      const cost = actor.actions.burst?.energyCost ?? 0;
      const c1 = st.c1 ? (actor.element === 'electro' ? 1.8 : 1.2) : 1;
      st.stacks = Math.min(RESOLVE_CAP, (st.stacks ?? 0) + cost * api.value * c1);
      return;
    }

    case 'raiden.resolve.base': {
      st.consumed = st.stacks ?? 0;
      st.stacks = 0;
      const hit = e.trigger.filter?.hit;
      if (hit) api.buff({ effectId: `${e.id}.${hit}`, target: api.owner.id, stat: `mvBonus.hit.${hit}`, value: api.value * st.consumed, duration: 1 });
      return;
    }

    case 'raiden.resolve.sword': {
      const dur = e.duration ?? 420;
      st.musouStart = api.frame;
      st.musouEnd = api.frame + dur;
      st.restoreReady = -Infinity;
      st.restoreCount = 0;
      // State marker for the buff timeline and for rotations that repeat "until Musou Isshin ends".
      api.buff({ effectId: 'raiden.musou', target: api.owner.id, stat: 'flatDmg.all', value: 0, duration: dur });
      for (const hit of (e.trigger.filter?.hits ?? '').split(',').filter(Boolean)) {
        api.buff({ effectId: `${e.id}.${hit}`, target: api.owner.id, stat: `mvBonus.hit.${hit}`, value: api.value * (st.consumed ?? 0), duration: dur });
      }
      return;
    }

    case 'raiden.musou.restore.normal':
    case 'raiden.musou.restore.charged': {
      const a = api.action;
      if (!a || !a.name.startsWith('sword-') || st.musouEnd === undefined) return;
      const er = Math.max(api.stats(api.owner).er - 1, 0);
      const amount = api.value * (1 + A4_ENERGY_PER_ER * er);
      for (const f of a.hitFrames) {
        if (f > st.musouEnd || f < (st.restoreReady ?? -Infinity) || (st.restoreCount ?? 0) >= RESTORE_MAX) continue;
        st.restoreCount = (st.restoreCount ?? 0) + 1;
        st.restoreReady = f + RESTORE_ICD;
        for (const c of api.characters) api.energy(c.id, amount, f);
      }
      return;
    }

    case 'raiden.eye':
      st.eyeStart = api.frame;
      st.eyeEnd = api.frame + (e.duration ?? 1500);
      return;

    case 'raiden.eye.strike': {
      const hi = api.hitInfo;
      if (!hi || st.eyeStart === undefined || st.eyeEnd === undefined) return;
      if (hi.frame < st.eyeStart || hi.frame > st.eyeEnd || hi.frame < (st.nextStrike ?? -Infinity)) return;
      if (hi.action === 'eye-strike') return;
      if (hi.actor === api.owner && hi.action === 'skill') return;
      st.nextStrike = hi.frame + STRIKE_ICD;
      api.hit('eye-strike', hi.frame + STRIKE_DELAY);
      return;
    }

    default:
      api.assume(`${e.id}: unknown Raiden effect id, skipped`);
  }
});
