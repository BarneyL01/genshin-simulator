import { registerHook } from './api';

/**
 * Varesa (gcsim internal/characters/varesa: asc.go, skill.go, plunge.go, cons.go). One hook, by effect id:
 *
 *  varesa.a1-window     onSkill    (Tag-Team Triple Jump!) opens a 300-frame (5s) "Rainbow Crash" window
 *                       after Skill/Fiery Skill.
 *  varesa.a1-transform  always     registers a transform that adds a flat, ATK-scaled bonus to a High
 *                       Plunge / Fiery Passion High Plunge hit landing inside the window: +50% ATK normally,
 *                       +180% ATK in Fiery Passion or at C1 (owner.effects has "varesa.c1"). Outside the
 *                       window: no bonus at all (matches the kit exactly — not "worst case", genuinely zero).
 *  varesa.a2            onAnyBurst (The Hero Twice-Returned!) +35% ATK for 720 frames (12s, max 2 independent
 *                       stacks) when a party member other than Varesa uses a burst tagged as a Nightsoul Burst
 *                       (see NIGHTSOUL_BURST_CHARACTERS).
 *  varesa.c2            onPlunge   (C2) +11.5 energy when a Plunge (normal or Fiery) is used.
 *
 * Not modelled: the Nightsoul point economy itself (see the character spec's assumptions), Volcano Kablam,
 * Apex Drive, C4's Diligent Refinement flat bonus.
 */
const A1_WINDOW = 300;
const A1_NORMAL_RATIO = 0.5;
const A1_UPGRADED_RATIO = 1.8;
const A2_STACK_VALUE = 0.35;
const A2_STACK_DURATION = 720;
const A2_MAX_STACKS = 2;
const NIGHTSOUL_BURST_CHARACTERS = new Set(['iansan']);
const PLUNGE_HIT_NAMES = new Set(['High Plunge', 'Fiery Passion High Plunge']);

interface State {
  a1WindowEnd?: number;
  registered?: boolean;
}

registerHook('varesa', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;

  switch (e.id) {
    case 'varesa.a1-window':
      st.a1WindowEnd = (api.action?.start ?? api.frame) + A1_WINDOW;
      return;

    case 'varesa.a1-transform': {
      if (st.registered) return;
      st.registered = true;
      const c1 = owner.effects.some((x) => x.id === 'varesa.c1');
      api.transformHit(({ char, hit, frame }) => {
        if (char !== owner || hit.talent !== 'plunge' || !hit.name || !PLUNGE_HIT_NAMES.has(hit.name)) return undefined;
        if (frame > (st.a1WindowEnd ?? -Infinity)) return undefined;
        const ratio = c1 || hit.name === 'Fiery Passion High Plunge' ? A1_UPGRADED_RATIO : A1_NORMAL_RATIO;
        const atk = api.stats(owner, frame).atk;
        return { ...hit, flat: (hit.flat ?? 0) + ratio * atk };
      });
      return;
    }

    case 'varesa.a2': {
      const actor = api.actor;
      if (!actor || actor === owner || !NIGHTSOUL_BURST_CHARACTERS.has(actor.id)) return;
      api.buff({ effectId: 'varesa.a2', target: owner.id, stat: 'atk%', value: A2_STACK_VALUE, duration: A2_STACK_DURATION, maxStacks: A2_MAX_STACKS, stackMode: 'independent' }, api.frame);
      return;
    }

    case 'varesa.c2': {
      const frame = api.action?.start ?? api.frame;
      api.energy(owner.id, 11.5, frame);
      return;
    }

    default:
      api.assume(`${e.id}: unknown Varesa effect id, skipped`);
  }
});
