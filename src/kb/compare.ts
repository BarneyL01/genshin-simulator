import {
  optimizeKqms, simulateBoth, type CharacterInput, type Liquid, type MainStats,
} from '../engine';
import { DEFAULT_ENEMY, buildMember, relaxed, type BuildOptions, type MemberSpec } from './build';
import type { KbData } from './data';
import type { RunInput } from './run';

export interface WeaponCandidate {
  weaponId: string;
  refinement: number;
}

export interface WeaponComparison {
  weaponId: string;
  refinement: number;
  /** Team DPS (Relaxed) and the character's own DPS. */
  teamDps: number;
  charDps: number;
  framePerfectTeamDps: number;
  /** Change against the baseline weapon (fractions: 0.05 = +5%). */
  teamDelta: number;
  charDelta: number;
  /** ER the character needs to burst every rotation (null: no burst in the rotation) and the change against the baseline. */
  requiredEr: number | null;
  requiredErDelta: number | null;
  /** Worst case: conditions of uncertain passives assumed not met. */
  worst: { teamDps: number; charDps: number };
  confidence: 'high' | 'medium' | 'low';
  /** Conditions and simplifications behind this result (from the weapon's own record and the simulation). */
  assumptions: string[];
  obtain: string;
  isBaseline: boolean;
}

/**
 * Weapon comparer: swap one character's weapon inside a fixed team and rotation, re-optimise only that
 * character's artifact stats (KQMS), and report the change in team and personal DPS and in the ER needed.
 * Works for weapons without community test data too, because it simulates the passive from the KB;
 * `confidence` and `assumptions` show how much to trust it.
 */
export function compareWeapons(
  kb: KbData,
  input: RunInput,
  characterId: string,
  candidates: WeaponCandidate[],
  baseline: WeaponCandidate,
  opts: BuildOptions = {},
): WeaponComparison[] {
  const enemy = opts.enemy ?? DEFAULT_ENEMY;
  const profile = opts.profile ?? relaxed;
  const cycles = opts.cycles ?? 4;
  const notices: string[] = [];

  const buildAll = (w: WeaponCandidate) => {
    const members: MemberSpec[] = input.members.map((m) => (m.character === characterId ? { ...m, weapons: [w.weaponId] } : m));
    const roster = opts.roster && {
      ...opts.roster,
      weapons: { ...opts.roster.weapons, [w.weaponId]: { owned: true, refinement: w.refinement } },
    };
    const built = members.map((m) => buildMember(kb, m, { ...opts, roster: roster ?? undefined }, notices));
    // Without a roster, buildMember uses R1: apply the requested refinement explicitly.
    return built.map((b) => (b.input.id === characterId && !roster ? { ...b, input: { ...b.input, refinement: w.refinement } } : b));
  };

  const run = (w: WeaponCandidate, fixed?: { characters: CharacterInput[]; mains: Record<string, MainStats>; liquid: Record<string, Liquid> }) => {
    const built = buildAll(w);
    const characters = built.map((b) => b.input);
    const mains = Object.fromEntries(built.map((b) => [b.input.id, b.mains]));
    const k = optimizeKqms({
      characters, mains, enemy, rotation: input.rotation, profile, lunarCharged: opts.lunarCharged,
      only: fixed ? [characterId] : undefined, fixed,
    });
    const common = { characters: k.characters, enemy, rotation: input.rotation, cycles, lunarCharged: opts.lunarCharged };
    const best = simulateBoth(common).relaxed;
    const worst = simulateBoth({ ...common, conditionsMet: false }).relaxed;
    return { k, best, worst, fp: simulateBoth(common).framePerfect };
  };

  // Baseline: full optimisation; every candidate re-optimises only the swapped character.
  const base = run(baseline);
  const fixed = { characters: [] as CharacterInput[], mains: base.k.mains, liquid: base.k.liquid };
  const baseChar = base.best.perCharacterDps[characterId] ?? 0;
  const baseEr = base.best.energy[characterId]?.requiredEr ?? null;

  return candidates.map((cand) => {
    const isBase = cand.weaponId === baseline.weaponId && cand.refinement === baseline.refinement;
    const r = isBase ? base : run(cand, fixed);
    const w = kb.weapons.get(cand.weaponId)!;
    const er = r.best.energy[characterId]?.requiredEr ?? null;
    const charDps = r.best.perCharacterDps[characterId] ?? 0;
    return {
      weaponId: cand.weaponId,
      refinement: cand.refinement,
      teamDps: r.best.dps,
      charDps,
      framePerfectTeamDps: r.fp.dps,
      teamDelta: r.best.dps / base.best.dps - 1,
      charDelta: baseChar ? charDps / baseChar - 1 : 0,
      requiredEr: er,
      requiredErDelta: er !== null && baseEr !== null ? er - baseEr : null,
      worst: { teamDps: r.worst.dps, charDps: r.worst.perCharacterDps[characterId] ?? 0 },
      confidence: w.dataConfidence,
      assumptions: [...w.assumptions, ...r.best.assumptions.filter((a) => a.startsWith(w.passive.effects[0]?.id.split('.')[0] ?? '\u0000'))],
      obtain: w.obtain.method + (w.obtain.freeRefinement ? ` (R${w.obtain.freeRefinement} obtainable free)` : ''),
      isBaseline: isBase,
    };
  }).sort((a, b) => b.teamDps - a.teamDps);
}

/** All KB weapons of the character's weapon type (for "compare every weapon"). */
export function weaponsForCharacter(kb: KbData, characterId: string): string[] {
  const c = kb.characters.get(characterId);
  if (!c) return [];
  return [...kb.weapons.values()].filter((w) => w.type === c.weaponType).map((w) => w.id);
}
