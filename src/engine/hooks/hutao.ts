import { registerHook, type HookApi } from './api';

/**
 * Hu Tao: Blood Blossom (gcsim internal/characters/hutao skill.go / charge.go / burst.go).
 * A Paramita charged attack applies Blood Blossom to the enemy: it lasts 570 frames, ticks every
 * 240 frames while active, and re-applying refreshes the duration and keeps the tick cadence.
 *
 *  hutao.c2        always    flag: Blood Blossom deals +10% of Hu Tao's max HP as flat damage, and the burst applies it too
 *  hutao.bb        onCharged apply Blood Blossom on each charged hit of the action
 *  hutao.bb.burst  onBurst   (C2 only) apply Blood Blossom when the burst lands
 *
 * Hook hit on the character: `blood-blossom`.
 */
const BB_DURATION = 570;
const BB_TICK = 240;
const C2_HP_RATIO = 0.1;

interface State {
  c2?: boolean;
  bbEnd?: number;
  bbNext?: number;
}

function applyBloodBlossom(api: HookApi, st: State, frame: number): void {
  const active = st.bbEnd !== undefined && st.bbNext !== undefined && frame < st.bbEnd;
  let next = active ? st.bbNext! : frame + BB_TICK;
  st.bbEnd = frame + BB_DURATION;
  const flat = st.c2 ? C2_HP_RATIO * api.stats(api.owner, frame).hp : 0;
  while (next < st.bbEnd) {
    api.hit('blood-blossom', next, { flat });
    next += BB_TICK;
  }
  st.bbNext = next;
}

registerHook('hutao', (api) => {
  const st = api.state as State;
  switch (api.effect.id) {
    case 'hutao.c2':
      st.c2 = true;
      return;
    case 'hutao.bb':
      for (const f of api.action?.hitFrames ?? []) applyBloodBlossom(api, st, f);
      return;
    case 'hutao.bb.burst':
      if (st.c2) for (const f of api.action?.hitFrames ?? []) applyBloodBlossom(api, st, f);
      return;
    default:
      api.assume(`${api.effect.id}: unknown Hu Tao effect id, skipped`);
  }
});
