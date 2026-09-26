import { registerHook } from './api';

/**
 * Fischl's Oz (gcsim internal/characters/fischl: skill.go, burst.go, asc.go). One hook, by effect id:
 *
 *  fischl.oz.skill  onSkill  Oz appears 18 frames in and lives `duration` frames (600); first tick 64 frames later, then every 59
 *  fischl.oz.burst  onBurst  the burst replaces Oz after the swap: spawns 25 frames in, first tick 63 frames later
 *  fischl.a4        onReaction  when the on-field character triggers an Electro-related reaction while Oz is up, Thundering
 *                   Retribution (0.8 ATK Electro, at most once per 30 frames) is added
 *
 * A newer Oz cancels the ticks of the previous one. Hook hits: `oz` (Oz's ATK DMG) and `thundering` (A4).
 * Each tick has a 67% chance of one Electro particle. Not modelled: A1 (needs aimed shots), C1, C2's extra hit, C4, C6.
 */
const SKILL_SPAWN = 18;
const SKILL_FIRST = 64;
const BURST_SPAWN = 25;
const BURST_FIRST = 63;
const TICK = 59;
const A4_ICD = 30;
const A4_HIT_DELAY = 1;
const PARTICLE_CHANCE = 0.67;
const ELECTRO_REACTIONS = new Set(['overloaded', 'electroCharged', 'lunarCharged', 'superconduct', 'stellarConduct', 'aggravate', 'hyperbloom', 'quicken', 'swirl']);

interface State {
  ozEnd?: number;
  handles?: Array<{ cancel(): void }>;
  nextA4?: number;
}

registerHook('fischl', (api) => {
  const st = api.state as State;
  const e = api.effect;
  const spawnOz = (spawn: number, firstTick: number) => {
    for (const h of st.handles ?? []) h.cancel();
    st.handles = [];
    const dur = e.duration ?? 600;
    st.ozEnd = spawn + dur;
    for (let t = spawn + firstTick; t < st.ozEnd; t += TICK) {
      st.handles.push(api.hit('oz', t));
      api.particles({ count: PARTICLE_CHANCE, element: 'electro', frame: t + 100 });
    }
  };
  switch (e.id) {
    case 'fischl.oz.skill':
      spawnOz((api.action?.start ?? api.frame) + SKILL_SPAWN, SKILL_FIRST);
      return;
    case 'fischl.oz.burst':
      spawnOz((api.action?.start ?? api.frame) + BURST_SPAWN, BURST_FIRST);
      return;
    case 'fischl.a4': {
      const r = api.reaction;
      if (!r || !ELECTRO_REACTIONS.has(r.name) || st.ozEnd === undefined || r.frame >= st.ozEnd) return;
      if (api.activeAt(r.frame) !== r.actor.id || r.frame < (st.nextA4 ?? -Infinity)) return;
      st.nextA4 = r.frame + A4_ICD;
      api.hit('thundering', r.frame + A4_HIT_DELAY);
      return;
    }
    default:
      api.assume(`${e.id}: unknown Fischl effect id, skipped`);
  }
});
