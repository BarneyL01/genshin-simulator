import type { BuildOptions, CustomTeam, TeamRun, WeaponCandidate, WeaponComparison } from '../kb';
import type { Roster } from '../schema/roster';

/** Simulation options that can cross the worker boundary (no class instances). */
export interface RunSettings {
  roster?: Roster;
  cycles?: number;
  /** Extra frames after each action / swap for the Relaxed profile (default 18 / 18). */
  actionDelay?: number;
  swapDelay?: number;
}

export type Request =
  | { id: number; type: 'team'; teamId: string; settings: RunSettings }
  | { id: number; type: 'custom'; team: CustomTeam; settings: RunSettings; rotationJson?: string }
  | { id: number; type: 'compare'; teamId: string; characterId: string; candidates: WeaponCandidate[]; baseline: WeaponCandidate; settings: RunSettings };

export type Response =
  | { id: number; ok: true; type: 'team'; result: TeamRun }
  | { id: number; ok: true; type: 'custom'; result: TeamRun; notes: string[] }
  | { id: number; ok: true; type: 'compare'; result: WeaponComparison[] }
  | { id: number; ok: false; error: string };

export type { BuildOptions };
