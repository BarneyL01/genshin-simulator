import type { Character } from '../schema/character';
import type { Effect } from '../schema/effect';
import type { Weapon } from '../schema/weapon';
import { CONSTANTS } from './mechanics';
import type { ActionDef, CharacterInput, HitDef, StatMod, Talent } from './types';

export interface BuildOptions {
  weapon: Weapon;
  refinement?: number;
  /** [normal/charged/plunge, skill, burst]. Default 9/9/9. */
  talentLevels?: [number, number, number];
  constellation?: number;
  /** Artifact main/sub stats and set bonuses that are plain stat mods (KQMS pool arrives with the stat optimiser). */
  artifactMods?: StatMod[];
  artifactEffects?: Effect[];
}

type KbHit = NonNullable<Character['talents'][Talent]>['hits'][number];

const TALENT_LEVEL_INDEX: Record<Talent, 0 | 1 | 2> = { normal: 0, charged: 0, plunge: 0, skill: 1, burst: 2 };

/**
 * Translate a KB character + weapon into engine input.
 * Actions: normal chain hit i → "n{i+1}" (one hit each), "charged", "plunge", "skill", "burst".
 * Cancel frames come from each hit's `frames.cancel`; the fallback for the `default` key is the
 * hitmark. A KB `attack` key doubles as the `normal` key.
 */
export function buildCharacterInput(c: Character, o: BuildOptions): CharacterInput {
  const cons = o.constellation ?? 0;
  const levels = [...(o.talentLevels ?? [9, 9, 9])] as [number, number, number];
  for (const k of c.constellations) {
    if (k.level > cons || !k.talentLevelBonus) continue;
    const b = k.talentLevelBonus;
    levels[0] += b.normal ?? 0;
    levels[1] += b.skill ?? 0;
    levels[2] += b.burst ?? 0;
  }
  for (let i = 0; i < 3; i++) levels[i] = Math.min(levels[i]!, 15);
  const actions: Record<string, ActionDef> = {};

  const toHits = (h: KbHit, talent: Talent, needsFrames = true): HitDef[] => {
    if (needsFrames && !h.frames) throw new Error(`${c.id} ${talent} hit "${h.name}" has no frame data`);
    const lvl = levels[TALENT_LEVEL_INDEX[talent]];
    const base: HitDef = {
      frame: h.frames?.hitmark ?? 0,
      mv: h.mv[Math.min(lvl, h.mv.length) - 1]!,
      scaling: h.scaling,
      element: h.element,
      talent,
      gauge: h.gauge,
      icd: h.icd,
      strike: h.strike,
    };
    return [base, ...(h.extraHitmarks ?? []).map((frame) => ({ ...base, frame }))];
  };
  const cancelOf = (h: { frames?: { hitmark: number; cancel: Record<string, number> } }): ActionDef['cancel'] => {
    const cancel: Record<string, number> = { ...h.frames?.cancel };
    if (cancel.attack !== undefined && cancel.normal === undefined) cancel.normal = cancel.attack;
    return { ...cancel, default: cancel.default ?? h.frames?.hitmark ?? 0 };
  };

  for (const talent of ['normal', 'charged', 'plunge', 'skill', 'burst'] as const) {
    const block = c.talents[talent];
    if (!block || block.hits.length === 0) continue;
    if (talent === 'normal') {
      block.hits.forEach((h, i) => {
        actions[`n${i + 1}`] = { talent, hits: toHits(h, talent), cancel: cancelOf(h) };
      });
    } else {
      const lastFrame = (h: KbHit) => Math.max(h.frames?.hitmark ?? 0, ...(h.extraHitmarks ?? []));
      const last = block.hits.reduce((a, b) => (lastFrame(b) >= lastFrame(a) ? b : a));
      actions[talent] = {
        talent,
        hits: block.hits.flatMap((h) => toHits(h, talent)),
        cancel: cancelOf(last),
        cooldown: block.cooldown,
        energyCost: talent === 'burst' ? block.energyCost : undefined,
        particles: block.particles && {
          count: block.particles.count,
          perHit: block.particles.perHit ?? false,
          icd: block.particles.icd ?? 0,
          delay: block.particles.delay ?? CONSTANTS.particleDelayFrames,
          element: block.particles.element ?? c.element,
        },
      };
    }
  }

  const hookHits: Record<string, HitDef> = {};
  for (const [id, h] of Object.entries(c.hookHits)) hookHits[id] = toHits(h, h.talent, false)[0]!;

  const refinement = o.refinement ?? 1;
  const effects: Effect[] = [
    ...c.effects,
    ...c.passives.flatMap((p) => p.effects),
    ...c.constellations.filter((k) => k.level <= cons).flatMap((k) => k.effects),
    ...o.weapon.passive.effects,
    ...(o.artifactEffects ?? []),
  ];

  return {
    id: c.id,
    element: c.element,
    level: 90,
    base: c.baseStats.lv90,
    weaponAtk: o.weapon.baseAtk.lv90,
    baseMods: [
      { stat: c.ascensionStat.stat, value: c.ascensionStat.value },
      { stat: o.weapon.substat.stat, value: o.weapon.substat.lv90 },
      ...(o.artifactMods ?? []),
    ],
    actions,
    hookHits,
    effects,
    refinement,
    talentLevels: levels,
  };
}
