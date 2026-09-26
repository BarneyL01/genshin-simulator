import { registerHook, type HookApi } from './api';

/**
 * Yelan (gcsim internal/characters/yelan: burst.go, skill.go, asc.go, yelan.go). One hook, by effect id:
 *
 *  yelan.a1-hp       always    Max HP by number of elemental types in the party; `trigger.filter` maps type count → bonus
 *  yelan.c2          always    flag: each wave also fires an extra arrow worth 14% Max HP (once per 1.8 s)
 *  yelan.burst.state onBurst   opens the Exquisite Throw window (`duration` frames from `delay`) and starts the A4 damage ramp
 *  yelan.burst.wave  onAnyNormal   any character starting a normal attack in the window fires a wave (max one per 60 frames)
 *  yelan.burst.skill onSkill   Yelan's skill hit in the window also fires a wave
 *
 * A wave is three arrows landing 20, 26 and 32 frames later (hook hit `exquisite-throw`); the C2 arrow is `exquisite-throw-c2`.
 * A4: the active character deals +1% damage, +3.5% more every second, up to 50%, until the window ends.
 * Recasting the burst does not remove the previous ramp (the game dispels it); this can slightly overstate A4.
 */
const ARROW_DELAY = 20;
const ARROW_SPACING = 6;
const WAVE_ICD = 60;
const C2_ICD = 108;
const C2_DELAY = 17;
const C2_HP_RATIO = 0.14;
const A4_START = 0.01;
const A4_STEP = 0.035;
const A4_MAX = 0.5;

interface State {
  c2?: boolean;
  windowStart?: number;
  windowEnd?: number;
  nextWave?: number;
  nextC2?: number;
}

function wave(api: HookApi, st: State, frame: number): void {
  for (let i = 0; i < 3; i++) api.hit('exquisite-throw', frame + ARROW_DELAY + i * ARROW_SPACING);
  if (st.c2 && frame >= (st.nextC2 ?? -Infinity)) {
    api.hit('exquisite-throw-c2', frame + C2_DELAY, { flat: C2_HP_RATIO * api.stats(api.owner, frame).hp });
    st.nextC2 = frame + C2_ICD;
  }
}

const inWindow = (st: State, frame: number) => st.windowStart !== undefined && st.windowEnd !== undefined && frame >= st.windowStart && frame <= st.windowEnd;

registerHook('yelan', (api) => {
  const st = api.state as State;
  const e = api.effect;
  switch (e.id) {
    case 'yelan.a1-hp': {
      const types = new Set(api.characters.map((c) => c.element)).size;
      const bonus = Number(e.trigger.filter?.[String(types)] ?? 0);
      if (bonus > 0) api.buff({ effectId: e.id, target: api.owner.id, stat: 'hp%', value: bonus, duration: null });
      return;
    }
    case 'yelan.c2':
      st.c2 = true;
      return;
    case 'yelan.burst.state': {
      const dur = e.duration ?? 900;
      st.windowStart = api.frame;
      st.windowEnd = api.frame + dur;
      st.nextWave = -Infinity;
      // A4 ramp: +1% at the start, +3.5% each further second (capped at 50% in total)
      let total = 0;
      for (let k = 0; total < A4_MAX - 1e-9 && k * 60 < dur; k++) {
        const step = Math.min(k === 0 ? A4_START : A4_STEP, A4_MAX - total);
        total += step;
        api.buff({ effectId: `yelan.a4.${k}`, target: 'active', stat: 'dmgBonus.all', value: step, duration: dur - k * 60 }, api.frame + k * 60);
      }
      return;
    }
    case 'yelan.burst.wave':
      if (!inWindow(st, api.frame) || api.frame < (st.nextWave ?? -Infinity)) return;
      st.nextWave = api.frame + WAVE_ICD;
      wave(api, st, api.frame);
      return;
    case 'yelan.burst.skill':
      if (inWindow(st, api.frame)) wave(api, st, api.frame);
      return;
    default:
      api.assume(`${e.id}: unknown Yelan effect id, skipped`);
  }
});
