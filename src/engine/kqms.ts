import { KQMS } from './mechanics';
import type { ExecutionProfile } from './profiles';
import { simulate } from './simulate';
import type { CharacterInput, EnemyInput, RotationItem, StatMod } from './types';

/**
 * KQM Standards artifact stats (kb/mechanics/kqms.json; numbers as implemented by gcsim's optimizer):
 * five 5★ level-20 pieces with the given main stats (flower HP and feather ATK are fixed), two fixed
 * rolls of every substat, and 20 "liquid" rolls (at most 10 per substat) that we place ourselves.
 *
 * Liquid rolls are placed like KQM's optimizer does, but deterministically and on our own engine:
 *  1. Energy Recharge first: the fewest ER rolls for which the character bursts every rotation
 *     (everyone else at maximum ER while a character is being tested).
 *  2. The rest greedily, one roll at a time, on the stat that raises the character's own DPS most.
 *     Characters are processed by descending DPS.
 * A Circlet with alternatives (e.g. CRIT Rate or CRIT DMG) is decided by trying each.
 */
export interface MainStats {
  sands: string;
  goblet: string;
  circlet: string;
}
export type Liquid = Record<string, number>;

const SUBSTATS = Object.keys(KQMS.substatValues);
/** Substats that can hold liquid rolls (flat stats only ever come as fixed rolls). */
const LIQUID_CANDIDATES = ['atk%', 'hp%', 'def%', 'em', 'critRate', 'critDmg'] as const;

const mainCount = (mains: MainStats, stat: string) =>
  [{ hp: 1 }, { atk: 1 }, { [mains.sands]: 1 }, { [mains.goblet]: 1 }, { [mains.circlet]: 1 }].filter((p) => stat in p).length;

/** How many liquid rolls a substat may hold given the main stats. */
export const liquidLimit = (mains: MainStats, stat: string): number =>
  Math.max(0, KQMS.individualLiquidCap - KQMS.fixedSubstatCount * mainCount(mains, stat));

/** Stat mods of a KQMS artifact set: main stats + fixed substats + liquid rolls. */
export function artifactMods(mains: MainStats, liquid: Liquid): StatMod[] {
  const mod = (stat: string, value: number): StatMod => ({ stat, value });
  const out: StatMod[] = [mod('hp', KQMS.mainStatValues.hp!), mod('atk', KQMS.mainStatValues.atk!)];
  for (const m of [mains.sands, mains.goblet, mains.circlet]) {
    const v = KQMS.mainStatValues[m];
    if (v === undefined) throw new Error(`KQMS has no main stat value for "${m}"`);
    out.push(mod(m, v));
  }
  for (const s of SUBSTATS) out.push(mod(s, KQMS.fixedSubstatCount * KQMS.substatValues[s]!));
  for (const [s, n] of Object.entries(liquid)) if (n) out.push(mod(s, n * KQMS.substatValues[s]!));
  return out;
}

export interface KqmsProblem {
  /** Engine inputs with weapon and set effects but without artifact stats. */
  characters: CharacterInput[];
  /**
   * Main stat combinations per character, most preferred first. When a character cannot reach its burst
   * with the first, alternatives with a different Sands are tried; among alternatives with the chosen
   * Sands and Goblet, the Circlet is picked by damage.
   */
  mains: Record<string, MainStats[]>;
  enemy: EnemyInput;
  rotation: RotationItem[];
  profile: ExecutionProfile;
  lunarCharged?: boolean;
  enemyAura?: { element: 'pyro' | 'hydro' | 'electro' | 'cryo' | 'dendro'; gauge?: number };
  /** Cycles simulated per evaluation (default 2). */
  cycles?: number;
  /** Theorycrafting mode ("100% ER requirement"): no Energy Recharge rolls, bursts are assumed available. */
  ignoreEnergy?: boolean;
  /**
   * Only optimise these characters; the others keep the main stats and liquid rolls given in `fixed`
   * (used to re-optimise a single character after a weapon change).
   */
  only?: string[];
  fixed?: { mains: Record<string, MainStats>; liquid: Record<string, Liquid> };
}

export interface KqmsResult {
  /** Inputs with the artifact stats added, ready to simulate. */
  characters: CharacterInput[];
  mains: Record<string, MainStats>;
  liquid: Record<string, Liquid>;
  /** Characters whose burst still comes up short at maximum ER liquid rolls. */
  erShort: string[];
  simulations: number;
  notes: string[];
}

/** Stats a character's damage can use: HP% for HP scalers, ATK% otherwise, plus CRIT and EM. */
function candidatesFor(c: CharacterInput): string[] {
  const scalesHp =
    Object.values(c.actions).some((a) => a.hits.some((h) => h.scaling === 'hp')) ||
    Object.values(c.hookHits).some((h) => h.scaling === 'hp') ||
    c.effects.some((e) => e.scaling?.from === 'self.hp');
  return LIQUID_CANDIDATES.filter((s) => s !== 'def%' && (scalesHp ? s !== 'atk%' : s !== 'hp%'));
}

export function optimizeKqms(p: KqmsProblem): KqmsResult {
  let sims = 0;
  const notes: string[] = [];
  const cycles = p.cycles ?? 2;
  const mains: Record<string, MainStats> = {};
  const liquid: Record<string, Liquid> = {};
  const active = (c: CharacterInput) => !p.only || p.only.includes(c.id);
  for (const c of p.characters) {
    const alts = p.mains[c.id];
    if (!alts?.length) throw new Error(`no main stats given for ${c.id}`);
    mains[c.id] = active(c) ? alts[0]! : (p.fixed?.mains[c.id] ?? alts[0]!);
    liquid[c.id] = active(c) ? {} : { ...(p.fixed?.liquid[c.id] ?? {}) };
  }

  const build = (): CharacterInput[] =>
    p.characters.map((c) => ({ ...c, baseMods: [...c.baseMods, ...artifactMods(mains[c.id]!, liquid[c.id]!)] }));
  const run = (n = cycles) => {
    sims++;
    return simulate({ characters: build(), enemy: p.enemy, rotation: p.rotation, cycles: n, profile: p.profile, lunarCharged: p.lunarCharged, enemyAura: p.enemyAura, startEnergy: 'full' });
  };

  // 1. Energy Recharge
  const erCap = (c: CharacterInput) => liquidLimit(mains[c.id]!, 'er');
  for (const c of p.characters) if (active(c)) liquid[c.id]!.er = p.ignoreEnergy ? 0 : erCap(c);
  const needsBurst = p.ignoreEnergy ? [] : p.characters.filter((c) => c.actions.burst?.energyCost);
  const erShort: string[] = [];
  for (const c of needsBurst.filter(active)) {
    liquid[c.id]!.er = erCap(c);
    let ok = (run(3).energy[c.id]?.shortfalls ?? 0) === 0;
    if (!ok) {
      // Try a Sands that carries more Energy Recharge (KeqingMains often lists ER as an alternative)
      const first = mains[c.id]!;
      for (const alt of p.mains[c.id]!.filter((m) => m.sands !== first.sands)) {
        mains[c.id] = alt;
        liquid[c.id]!.er = erCap(c);
        if ((run(3).energy[c.id]?.shortfalls ?? 0) === 0) {
          ok = true;
          notes.push(`${c.id}: ${alt.sands} Sands instead of ${first.sands} to reach the burst every rotation.`);
          break;
        }
      }
      if (!ok) mains[c.id] = first;
    }
    let lo = 0;
    let hi = erCap(c);
    liquid[c.id]!.er = hi;
    if (!ok) {
      erShort.push(c.id);
      continue;
    }
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      liquid[c.id]!.er = mid;
      if ((run(3).energy[c.id]?.shortfalls ?? 0) === 0) hi = mid;
      else lo = mid + 1;
    }
    liquid[c.id]!.er = lo;
  }
  for (const c of p.characters) if (active(c) && (p.ignoreEnergy || !c.actions.burst?.energyCost)) liquid[c.id]!.er = 0;
  if (erShort.length) notes.push(`Energy: ${erShort.join(', ')} cannot burst every rotation even at maximum ER rolls.`);

  // 2. Damage substats, character by character in order of DPS
  const base = run();
  const order = p.characters.filter(active).sort((a, b) => (base.perCharacterDps[b.id] ?? 0) - (base.perCharacterDps[a.id] ?? 0));
  for (const c of order) {
    const chosen = mains[c.id]!;
    const alts = p.mains[c.id]!.filter((m) => m.sands === chosen.sands && m.goblet === chosen.goblet);
    const circlets = [...new Set(alts.map((m) => m.circlet))];
    let best: { liquid: Liquid; mains: MainStats; dps: number } | undefined;
    for (const circlet of circlets.length > 1 ? circlets : [chosen.circlet]) {
      const m = { ...chosen, circlet };
      mains[c.id] = m;
      const l: Liquid = { er: liquid[c.id]!.er ?? 0 };
      liquid[c.id] = l;
      const budget = KQMS.totalLiquidSubstats - (l.er ?? 0);
      const cands = candidatesFor(c);
      for (let i = 0; i < budget; i++) {
        let pick: string | undefined;
        let pickDps = -Infinity;
        for (const s of cands) {
          if ((l[s] ?? 0) >= liquidLimit(m, s)) continue;
          l[s] = (l[s] ?? 0) + 1;
          const dps = run().perCharacterDps[c.id] ?? 0;
          l[s]! -= 1;
          if (dps > pickDps + 1e-9) {
            pickDps = dps;
            pick = s;
          }
        }
        if (!pick) break;
        l[pick] = (l[pick] ?? 0) + 1;
      }
      const dps = run().perCharacterDps[c.id] ?? 0;
      if (!best || dps > best.dps) best = { liquid: { ...l }, mains: m, dps };
    }
    liquid[c.id] = best!.liquid;
    mains[c.id] = best!.mains;
  }

  // Final check
  const final = run(3);
  for (const c of needsBurst) {
    if ((final.energy[c.id]?.shortfalls ?? 0) > 0 && !erShort.includes(c.id)) {
      notes.push(`${c.id}: bursts short of energy after the damage pass (${final.energy[c.id]!.shortfalls}×).`);
    }
  }
  return { characters: build(), mains, liquid, erShort, simulations: sims, notes };
}
