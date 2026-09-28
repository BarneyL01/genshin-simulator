import { registerHook } from './api';

/**
 * Durin, Dragon of White Flame form only (gcsim internal/characters/durin: asc.go, burst.go, cons.go).
 * One hook, by effect id:
 *
 *  durin.burst    onBurst  20 "Dragon of White Flame" ticks (hookHit `white-tick`), first at 155 frames after
 *                 the burst action starts, then every 58.8 frames (`ceil` per tick, matching gcsim). A2/Primordial
 *                 Fusion: the first 10 ticks each get +min(ATK/100×3%, 75%) extra base damage, consumed one stack
 *                 per tick (multi-target still consumes only one, which does not apply to this single-target sim).
 *                 C6: the ticks ignore 30% DEF and (marker only; the 6s on-hit DEF shred itself is not separately
 *                 modelled — folded into the same 30%).
 *  durin.a1       onReaction  after any Overloaded reaction while a Dragon of White Flame is active (20.5s after
 *                 the burst that summoned it), −20% Pyro and −20% Electro RES on the enemy for 360 frames (6s).
 *  durin.c1-set   onBurst  (C1) sets every other party member's Cycle of Enlightenment to 20 stacks.
 *  durin.c1-proc  onHit    (C1) an on-field party member's (not Durin's) damaging hit, while a stack remains and
 *                 the Dragon of White Flame is active, consumes 1 stack for a separate hit (hookHit `c1proc`)
 *                 dealing 60% of Durin's ATK as flat damage.
 *  durin.c2       onReaction  (C2) after Overloaded while a Dragon is active, +50% Pyro and +50% Electro DMG to
 *                 the whole team for 360 frames (6s).
 *  durin.c6       (marker only, checked by `durin.burst`)
 *
 * Not modelled: Dragon of Dark Decay (Black form, a personal Vaporize/Melt carry for a different team),
 * the "Hexerei" team-trait ×1.75 bonus on A1/C1, C4's 30% chance to not consume a C1 stack.
 */
const WHITE_DURATION = 1230; // 20.5s: how long the Dragon (and A1's Overloaded window) stays up
const TICKS = 20;
const TICK_INTERVAL = 58.8;
const FIRST_TICK = 155.2;
const A4_STACKS = 10;
const A4_PER_100_ATK = 0.03;
const A4_CAP = 0.75;
const A1_C2_RES_DURATION = 360;
const C1_STACKS = 20;
const C1_MULT = 0.6;
const C1_HIT_DELAY = 1;

interface State {
  whiteEnd?: number;
  a4Stacks?: number;
  c1Stacks?: Map<string, number>;
}

registerHook('durin', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;
  const c6 = owner.effects.some((x) => x.id === 'durin.c6');

  switch (e.id) {
    case 'durin.burst': {
      const start = api.action?.start ?? api.frame;
      st.whiteEnd = start + WHITE_DURATION;
      st.a4Stacks = A4_STACKS;
      for (let i = 0; i < TICKS; i++) {
        const t = start + Math.ceil(FIRST_TICK + TICK_INTERVAL * i);
        api.later(t, () => {
          const atk = api.stats(owner, t).atk;
          let baseMult = 0;
          if ((st.a4Stacks ?? 0) > 0) {
            st.a4Stacks = (st.a4Stacks ?? 0) - 1;
            baseMult = Math.min((atk / 100) * A4_PER_100_ATK, A4_CAP);
          }
          api.hit('white-tick', t, { override: { baseMult, defIgnore: c6 ? 0.3 : 0 } });
        });
      }
      return;
    }

    case 'durin.a1': {
      if (api.reaction?.name !== 'overloaded' || (st.whiteEnd ?? -Infinity) < api.reaction.frame) return;
      const f = api.reaction.frame;
      api.buff({ effectId: 'durin.a1.pyro', target: 'enemy', stat: 'res.enemy.pyro', value: -0.2, duration: A1_C2_RES_DURATION }, f);
      api.buff({ effectId: 'durin.a1.electro', target: 'enemy', stat: 'res.enemy.electro', value: -0.2, duration: A1_C2_RES_DURATION }, f);
      return;
    }

    case 'durin.c1-set': {
      st.c1Stacks = new Map(api.characters.filter((c) => c !== owner).map((c) => [c.id, C1_STACKS]));
      return;
    }

    case 'durin.c1-proc': {
      const hi = api.hitInfo;
      if (!hi || hi.actor === owner || (st.whiteEnd ?? -Infinity) < hi.frame) return;
      if (api.activeAt(hi.frame) !== hi.actor.id) return;
      const stacks = st.c1Stacks?.get(hi.actor.id) ?? 0;
      if (stacks <= 0) return;
      st.c1Stacks!.set(hi.actor.id, stacks - 1);
      const flat = C1_MULT * api.stats(owner, hi.frame).atk;
      api.hit('c1proc', hi.frame + C1_HIT_DELAY, { flat });
      return;
    }

    case 'durin.c2': {
      if (api.reaction?.name !== 'overloaded' || (st.whiteEnd ?? -Infinity) < api.reaction.frame) return;
      const f = api.reaction.frame;
      for (const c of api.characters) {
        api.buff({ effectId: 'durin.c2.pyro', target: c.id, stat: 'dmgBonus.pyro', value: 0.5, duration: A1_C2_RES_DURATION }, f);
        api.buff({ effectId: 'durin.c2.electro', target: c.id, stat: 'dmgBonus.electro', value: 0.5, duration: A1_C2_RES_DURATION }, f);
      }
      return;
    }

    case 'durin.c6':
      return; // marker only, read via owner.effects above

    default:
      api.assume(`${e.id}: unknown Durin effect id, skipped`);
  }
});
