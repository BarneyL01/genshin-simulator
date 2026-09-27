import { CONSTANTS } from '../mechanics';
import { registerHook } from './api';

/**
 * Odette (gcsim internal/characters/odette: skill.go, burst.go, asc.go, stellar.go). One hook, by effect id:
 *
 *  odette.skill  onSkill  action "skill": 23 frames in, summons the Solo Dance Double (1262 frames; first move after
 *                         134 frames) and resets Marvelous Splendor; opens the Coda window (394 frames from the cast).
 *                         action "coda": the DoT hits are the action's own; 62 frames in, a Stellar Glimmer hit
 *                         (Stellar-Conduct form); the Double's moves restart 52 frames later and are upgraded for 20 s.
 *  odette.burst  onBurst  1 frame in, summons the Double (first move after 252 frames) or, if it is out, refreshes its
 *                         duration keeping the move order and stacks; opens the Coda window (361 frames); at the final
 *                         slash (144) Snow Swan's Dream: +`value` Stellar Glimmer reaction DMG for 1200 frames.
 *  odette.a1     always   Marvelous Splendor (+15% Stellar Glimmer reaction DMG per stack): 4 stacks on each summon; every
 *                         59.25 frames, while Odette is off-field, one stack moves to the other party members (max 4).
 *  odette.a4     always   Odette's Stellar Glimmer multipliers ×(1 + 1.5% per 100 ATK above 1000), at most ×1.3.
 *
 * The Double alternates "Plume" (next move 109 frames later) and "Wing" (125); both deal Cryo DMG with no ICD. While
 * upgraded and in Radiance: Stellar-Conduct (a Polestar Field is up) each move also deals a Stellar Glimmer hit.
 * Particles: 5 Cryo on the skill or Coda DoT hit, at most once per 720 frames.
 * Not modelled: Radiance: Stellar Swirl, C1/C2/C4/C6.
 */
const SKILL_HIT = 23;
const SUMMON_FROM_SKILL_FIRST_MOVE = 134;
const SUMMON_FROM_BURST = 1;
const SUMMON_FROM_BURST_FIRST_MOVE = 252;
const DOUBLE_DURATION = 1262;
const MOVE_DELAY = { plume: 109, wing: 125 } as const;
const CODA_WINDOW_FROM_SKILL = 394;
const CODA_WINDOW_FROM_BURST = 361;
const CODA_FIRST_DOT = 11;
const CODA_FINAL = 62;
const CODA_RESTART = 52;
const UPGRADE_DURATION = 1200;
const SWAN_AT = 144;
const SWAN_DURATION = 1200;
const PARTICLE_ICD = 720;
const A1_STACKS = 4;
const A1_PER_STACK = 0.15;
const A1_TICK = 59.25;

type Move = 'plume' | 'wing';

interface State {
  a1?: boolean;
  a4?: boolean;
  /** Token of the running move ticker; a new summon or a Coda cancels older tickers. */
  ticker?: number;
  doubleEnd?: number;
  nextMove?: Move;
  upgradeEnd?: number;
  codaWindowEnd?: number;
  lastParticle?: number;
  a1Token?: number;
  self?: number;
  others?: number;
}

const a4Mult = (atk: number) => 1 + Math.min((Math.max(atk - 1000, 0) / 100) * 0.015, 0.3);

registerHook('odette', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;

  /** A Stellar Glimmer hit (direct Stellar-Conduct): no element, ignores DEF, A4 scales the multiplier at hit time. */
  const glimmer = (id: string, frame: number) => {
    const mult = st.a4 ? a4Mult(api.stats(owner, frame).atk) : 1;
    api.hit(id, frame, { override: { mv: api.hitMv(id) * mult, direct: 'stellarConduct', defIgnore: 1, gauge: 0 } });
  };

  const setA1 = (frame: number) => {
    api.buff({ effectId: 'odette.a1', target: owner.id, stat: 'reactionBonus.stellarGlimmer', value: A1_PER_STACK * (st.self ?? 0), duration: null }, frame);
    for (const c of api.characters) {
      if (c !== owner) api.buff({ effectId: 'odette.a1', target: c.id, stat: 'reactionBonus.stellarGlimmer', value: A1_PER_STACK * (st.others ?? 0), duration: null }, frame);
    }
  };

  const a1Tick = (token: number, t: number, frac: number) => {
    if (st.a1Token !== token || (st.self ?? 0) === 0 || (st.others ?? 0) >= A1_STACKS || t >= (st.doubleEnd ?? -1)) return;
    const acc = frac + (A1_TICK % 1);
    const extra = Math.floor(acc);
    const next = t + Math.floor(A1_TICK) + extra;
    api.later(next, () => a1Tick(token, next, acc - extra));
    if (api.activeAt(t) === owner.id) return;
    st.self = (st.self ?? 0) - 1;
    st.others = (st.others ?? 0) + 1;
    setA1(t);
  };

  const moveTick = (token: number, t: number, move: Move) => {
    if (st.ticker !== token || t >= (st.doubleEnd ?? -1)) return;
    api.hit(move, t);
    const next: Move = move === 'plume' ? 'wing' : 'plume';
    st.nextMove = next;
    api.later(t + MOVE_DELAY[move], () => moveTick(token, t + MOVE_DELAY[move], next));
    if (t < (st.upgradeEnd ?? -1) && api.polestarActive(t)) glimmer(`${move}-ssc`, t);
  };

  /** Summon (or refresh) the Double at frame f. */
  const summon = (f: number, firstMove: Move, firstDelay: number, refresh: boolean) => {
    const token = (st.ticker ?? 0) + 1;
    st.ticker = token;
    st.doubleEnd = f + DOUBLE_DURATION;
    api.later(f + firstDelay, () => moveTick(token, f + firstDelay, firstMove));
    const end = st.doubleEnd;
    api.later(end, () => {
      if (st.a1 && st.doubleEnd === end) {
        st.self = 0;
        st.others = 0;
        setA1(end);
      }
    });
    if (!refresh && st.a1) {
      st.a1Token = (st.a1Token ?? 0) + 1;
      st.self = A1_STACKS;
      st.others = 0;
      setA1(f);
      a1Tick(st.a1Token, f, 0);
    }
  };

  const dropParticles = (hitFrame: number) => {
    if (hitFrame - (st.lastParticle ?? -Infinity) < PARTICLE_ICD) return;
    st.lastParticle = hitFrame;
    api.particles({ count: 5, element: 'cryo', frame: hitFrame + CONSTANTS.particleDelayFrames });
  };

  const start = api.action?.start ?? api.frame;
  switch (e.id) {
    case 'odette.a1':
      st.a1 = true;
      return;
    case 'odette.a4':
      st.a4 = true;
      return;

    case 'odette.skill': {
      if (api.action?.name === 'coda') {
        if (start > (st.codaWindowEnd ?? -Infinity)) {
          api.assume('odette: Coda at Dawn\'s Tolling was used outside its 6 s window after the Skill or Burst (simulated anyway)');
        }
        st.codaWindowEnd = -Infinity;
        dropParticles(start + CODA_FIRST_DOT);
        // The Coda stops the Double's moves; they restart after it unless a new summon happened in between.
        let token = -1;
        api.later(start, () => { token = st.ticker = (st.ticker ?? 0) + 1; });
        api.later(start + CODA_FINAL, () => {
          glimmer('coda-ssc', start + CODA_FINAL);
          st.upgradeEnd = start + CODA_FINAL + UPGRADE_DURATION;
        });
        const restart = start + CODA_FINAL + CODA_RESTART;
        api.later(restart, () => moveTick(token, restart, 'plume'));
        return;
      }
      st.codaWindowEnd = start + CODA_WINDOW_FROM_SKILL;
      dropParticles(start + SKILL_HIT);
      api.later(start + SKILL_HIT, () => summon(start + SKILL_HIT, 'plume', SUMMON_FROM_SKILL_FIRST_MOVE, false));
      return;
    }

    case 'odette.burst': {
      st.codaWindowEnd = start + CODA_WINDOW_FROM_BURST;
      const f = start + SUMMON_FROM_BURST;
      api.later(f, () => {
        const out = f < (st.doubleEnd ?? -1);
        summon(f, out ? (st.nextMove ?? 'plume') : 'plume', SUMMON_FROM_BURST_FIRST_MOVE, out);
      });
      const swan = api.value;
      api.later(start + SWAN_AT, () =>
        api.buff({ effectId: 'odette.swans-dream', target: owner.id, stat: 'reactionBonus.stellarGlimmer', value: swan, duration: SWAN_DURATION }, start + SWAN_AT));
      return;
    }

    default:
      api.assume(`${e.id}: unknown Odette effect id, skipped`);
  }
});

