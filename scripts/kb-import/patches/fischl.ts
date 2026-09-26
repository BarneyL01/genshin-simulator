import type { Character } from '../../../src/schema/character';
import { effect, type Effect } from '../../../src/schema/effect';
import { abilCancel, param } from '../lib';

/** Fischl: Oz as a ticking summon (hook "fischl"). Normal/charged frames stay as parsed from gcsim. Frames: gcsim internal/characters/fischl. */
const F = (id: string, trigger: string, extra: Partial<Effect> = {}): Effect =>
  effect.parse({ id, trigger: { on: trigger }, target: 'self', stat: 'flatDmg.all', value: 0, hook: 'fischl', ...extra });
const src = (file: string) => ({ site: 'gcsim', url: `https://github.com/genshinsim/gcsim/blob/3d48bd5044b2841d840d59888b48f4483252ff8d/internal/characters/fischl/${file}`, commit: '3d48bd5044b2841d840d59888b48f4483252ff8d' });

export function patch(c: Character): Character {
  const skillMv = param('Fischl', 'combat2', 'param2');
  const burstMv = param('Fischl', 'combat3', 'param1');
  c.talents.skill = {
    ...c.talents.skill,
    cooldown: 25 * 60 + 18,
    hits: [{
      name: 'Oz summon', mv: skillMv, scaling: 'atk', element: 'electro', gauge: 1, icd: { tag: 'none', group: 'fischl' },
      frames: { hitmark: 38, cancel: abilCancel(43, { dash: 14, jump: 16, swap: 42 }), source: src('skill.go') },
    }],
    particles: { count: 0.67, perHit: false, icd: 6, element: 'electro' },
    effects: [],
    frames: undefined,
  };
  c.talents.burst = {
    ...c.talents.burst,
    cooldown: 900,
    energyCost: 60,
    effects: [],
    hits: [{
      name: 'Falling Thunder', mv: burstMv, scaling: 'atk', element: 'electro', gauge: 1, icd: { tag: 'burst', group: 'fischl' },
      frames: { hitmark: 18, cancel: abilCancel(148, { dash: 115, jump: 115, swap: 24 }), source: src('burst.go') },
    }],
    frames: undefined,
  };
  c.hookHits = {
    oz: {
      name: "Oz's attack", mv: param('Fischl', 'combat2', 'param1'), scaling: 'atk', element: 'electro', talent: 'skill', gauge: 1,
      icd: { tag: 'skill', group: 'fischl' }, frames: { hitmark: 0, cancel: {}, source: src('skill.go') },
    },
    thundering: {
      name: 'Thundering Retribution (A4)', mv: [0.8], scaling: 'atk', element: 'electro', talent: 'skill', gauge: 1,
      icd: { tag: 'none', group: 'fischl' }, frames: { hitmark: 0, cancel: {}, source: src('asc.go') },
    },
  };
  c.effects = [F('fischl.oz.skill', 'onSkill', { duration: 600 }), F('fischl.oz.burst', 'onBurst', { duration: 600 }), F('fischl.a4', 'onReaction')];
  c.hooks = ['fischl'];
  c.needsHook = true;
  c.assumptions = [
    ...c.assumptions.filter((a) => !a.startsWith('Baseline import')),
    'Hand-upgraded on top of the baseline: skill, burst, Oz (ticks every 59 frames for 10 s; burst re-spawns Oz after the swap) and the A4 Thundering Retribution follow gcsim, through hook "fischl" (src/engine/hooks/fischl.ts). Normal/charged frames come from the baseline import. Not modelled: A1, C1, C2 extra hit, C4, C6, aimed shots.',
  ];
  c.usualCombo = [{ variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] }, ...c.usualCombo.filter((v) => v.variant !== 'off-field')];
  return c;
}
