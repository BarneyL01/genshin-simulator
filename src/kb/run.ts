import {
  optimizeKqms, simulateBoth, type CharacterInput, type KqmsResult, type MainStats, type RotationItem, type SimResult, type Liquid,
} from '../engine';
import type { Team } from '../schema/team';
import type { Roster } from '../schema/roster';
import { DEFAULT_ENEMY, buildMember, relaxed, type BuildOptions, type BuiltMember, type MemberSpec } from './build';
import type { KbData } from './data';

export interface MemberReport {
  character: string;
  weaponId: string;
  refinement: number;
  mains: MainStats;
  liquid: Liquid;
}

export interface TeamRun {
  label: string;
  members: MemberReport[];
  /** Results under the Relaxed profile (default) and Frame-perfect, same stats and rotation. */
  relaxed: SimResult;
  framePerfect: SimResult;
  kqms: KqmsResult;
  rotation: RotationItem[];
  notices: string[];
}

export interface RunInput {
  label: string;
  members: MemberSpec[];
  rotation: RotationItem[];
}

const memberSpecs = (t: Team): MemberSpec[] =>
  t.members.map((m) => ({
    character: m.character,
    weapons: m.weapons,
    sets: m.artifacts[0]?.sets ?? {},
    mainStats: m.mainStats,
  }));

export const teamInput = (t: Team): RunInput => ({ label: t.name, members: memberSpecs(t), rotation: t.rotation.script });

/**
 * Build, optimise artifact stats (KQMS) and simulate a team under the Relaxed profile and the
 * Frame-perfect profile with identical stats.
 */
export function runTeam(kb: KbData, input: RunInput, opts: BuildOptions = {}): TeamRun {
  const notices: string[] = [];
  const built: BuiltMember[] = input.members.map((m) => buildMember(kb, m, opts, notices));
  const enemy = opts.enemy ?? DEFAULT_ENEMY;
  const profile = opts.profile ?? relaxed;
  // Rotations with steps that repeat every N cycles need 1 + k × N cycles so the measured window holds whole periods.
  const period = input.rotation.reduce((p, item) => Math.max(p, ...('steps' in item ? item.steps : [item]).map((x) => x.every ?? 1)), 1);
  const cycles = opts.cycles ?? 1 + Math.max(2, Math.ceil(3 / period)) * period;

  const characters: CharacterInput[] = built.map((b) => b.input);
  const mains = Object.fromEntries(built.map((b) => [b.input.id, b.mains]));
  const kqms = optimizeKqms({ characters, mains, enemy, rotation: input.rotation, profile, lunarCharged: opts.lunarCharged, cycles: Math.max(3, period + 1) });
  notices.push(...kqms.notes);

  const both = simulateBoth({ characters: kqms.characters, enemy, rotation: input.rotation, cycles, lunarCharged: opts.lunarCharged });
  return {
    label: input.label,
    members: built.map((b) => ({
      character: b.input.id, weaponId: b.weaponId, refinement: b.refinement,
      mains: kqms.mains[b.input.id]!, liquid: kqms.liquid[b.input.id]!,
    })),
    relaxed: both.relaxed,
    framePerfect: both.framePerfect,
    kqms,
    rotation: input.rotation,
    notices: [...new Set([...notices, ...both.relaxed.assumptions.filter((a) => /insufficient energy|waited for cooldown|Musou/.test(a))])],
  };
}

export interface RankedTeam {
  team: Team;
  run?: TeamRun;
  /** Members the roster does not own (team is skipped when non-empty). */
  missing: string[];
}

/**
 * Mode A: every known team whose four members are owned, simulated with its published rotation and
 * ranked by Relaxed team DPS. Teams with missing members are listed last with `missing`.
 */
export function rankTeams(kb: KbData, roster: Roster | undefined, opts: BuildOptions = {}): RankedTeam[] {
  const results: RankedTeam[] = [];
  for (const team of kb.teams.values()) {
    if (team.status !== 'active') continue;
    const missing = team.members.filter((m) => roster && !roster.characters[m.character]?.owned).map((m) => m.character);
    if (missing.length) {
      results.push({ team, missing });
      continue;
    }
    results.push({ team, missing, run: runTeam(kb, teamInput(team), { ...opts, roster }) });
  }
  return results.sort((a, b) => (b.run?.relaxed.dps ?? -1) - (a.run?.relaxed.dps ?? -1));
}
