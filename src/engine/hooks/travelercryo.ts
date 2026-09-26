import { registerHook } from './api';

/**
 * Cryo Traveler (gcsim internal/characters/traveler/common/cryo: skill.go, burst.go, asc.go, stellar.go;
 * male frames). One hook, by effect id:
 *
 *  traveler-cryo.c4          always  flag: Frostpierce Star lasts 25% longer
 *  traveler-cryo.c2          always  flag: crystals also give the active character +60 Elemental Mastery for 5 s
 *  traveler-cryo.a1          always  Radiance: Stellar-Conduct (inside a Polestar Field) while the Frostpierce Star is up:
 *                                    normal/charged/plunge hits become Cryo (no infusion override) and deal +80% ATK
 *  traveler-cryo.skill       onSkill opens the Frostpierce Star window (`duration`, 720 frames after the 19-frame cast) and
 *                                    schedules its ticks: two crystals at +0 and +13 every 176 frames from 178, skipped while in Stellar-Conduct
 *  traveler-cryo.stellar-hit onHit   in Stellar-Conduct, the Traveler's normal/charged/plunge hits fire a crystal 3 frames later
 *                                    (at most every 12 frames); every crystal that lands is +1 Frostglow (max 8)
 *  traveler-cryo.burst       onBurst `value` = Frostglow bonus per stack; 36 frames in, three javelin strikes (five at 8 stacks);
 *                                    in Stellar-Conduct they use the Stellar-Conduct multipliers, ignore DEF and apply no element
 *  traveler-cryo.burst.stellar (unused trigger) `value` = Stellar-Conduct Frostglow bonus per stack
 *
 * Hook hits: `frostpierce`, `javelin`, `javelin-stellar`. Not modelled: C1 energy, C6, True Moon effects, Stellar Swirl.
 */
const SKILL_CAST = 19;
const FIRST_TICK = 178;
const TICK = 176;
const CRYSTALS = [0, 13];
const TRAVEL = 9;
const SSC_DELAY = 3;
const SSC_ICD = 12;
const FROSTGLOW_MAX = 8;
const BURST_SPAWN = 36;
const BURST_TRAVEL = 6;
const BURST_DELAYS = [0, 33, 38, 35, 42];
const C4_EXTRA = 180;
const STELLAR_BASE_PER_100_ATK = 0.0035;
const STELLAR_BASE_MAX = 0.07;
const ATK_CONVERSION = 0.8;

interface State {
  c2?: boolean;
  c4?: boolean;
  skillEnd?: number;
  nextSsc?: number;
  frostglow?: number;
}

registerHook('travelercryo', (api) => {
  const st = api.state as State;
  const e = api.effect;
  const inWindow = (f: number) => st.skillEnd !== undefined && f <= st.skillEnd;

  switch (e.id) {
    case 'traveler-cryo.c4':
      st.c4 = true;
      return;
    case 'traveler-cryo.c2':
      st.c2 = true;
      return;

    case 'traveler-cryo.a1':
      api.transformHit(({ char, hit, frame }) => {
        if (char !== api.owner || !['normal', 'charged', 'plunge'].includes(hit.talent)) return undefined;
        if (!api.polestarActive(frame) || !inWindow(frame)) return undefined;
        return { ...hit, element: 'cryo', mv: hit.mv + ATK_CONVERSION, ignoreInfusion: true };
      });
      return;

    case 'traveler-cryo.skill': {
      const start = api.action?.start ?? api.frame;
      st.skillEnd = start + SKILL_CAST + (e.duration ?? 720) + (st.c4 ? C4_EXTRA : 0);
      for (let t = start + FIRST_TICK; t <= st.skillEnd; t += TICK) {
        for (const d of CRYSTALS) api.hit('frostpierce', t + d + TRAVEL, { skipIf: () => api.polestarActive(t) });
      }
      return;
    }

    case 'traveler-cryo.stellar-hit': {
      const hi = api.hitInfo;
      if (!hi || hi.actor !== api.owner) return;
      if (hi.action === 'frostpierce') {
        st.frostglow = Math.min(FROSTGLOW_MAX, (st.frostglow ?? 0) + 1);
        if (st.c2) api.buff({ effectId: 'traveler-cryo.c2.em', target: 'active', stat: 'em', value: 60, duration: 300 }, hi.frame);
        return;
      }
      if (!['normal', 'charged', 'plunge'].includes(hi.hit.talent) || hi.action.startsWith('javelin')) return;
      if (!api.polestarActive(hi.frame) || !inWindow(hi.frame) || hi.frame < (st.nextSsc ?? -Infinity)) return;
      st.nextSsc = hi.frame + SSC_ICD;
      api.hit('frostpierce', hi.frame + SSC_DELAY + TRAVEL);
      return;
    }

    case 'traveler-cryo.burst': {
      const start = api.action?.start ?? api.frame;
      const spawn = start + BURST_SPAWN;
      api.later(spawn, () => {
        const stacks = st.frostglow ?? 0;
        const stellar = api.polestarActive(spawn);
        const n = stacks >= FROSTGLOW_MAX ? 5 : 3;
        const atk = api.stats(api.owner, spawn).atk;
        const override = stellar
          ? { mv: api.hitMv('javelin-stellar') + api.valueOf('traveler-cryo.burst.stellar') * stacks, gauge: 0, defIgnore: 1, baseMult: Math.min((atk / 100) * STELLAR_BASE_PER_100_ATK, STELLAR_BASE_MAX) }
          : { mv: api.hitMv('javelin') + api.value * stacks };
        for (const d of BURST_DELAYS.slice(0, n)) api.hit(stellar ? 'javelin-stellar' : 'javelin', spawn + BURST_TRAVEL + d, { override });
        st.frostglow = 0;
      });
      return;
    }

    default:
      api.assume(`${e.id}: unknown Cryo Traveler effect id, skipped`);
  }
});
