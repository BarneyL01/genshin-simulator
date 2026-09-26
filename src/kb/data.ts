import { artifactSet, character, enemy, meta, team, weapon } from '../schema';
import type { ArtifactSet, Character, Enemy, Meta, Team, Weapon } from '../schema';

export interface KbData {
  meta: Meta;
  characters: Map<string, Character>;
  weapons: Map<string, Weapon>;
  artifacts: Map<string, ArtifactSet>;
  teams: Map<string, Team>;
  enemies: Map<string, Enemy>;
}

export interface RawKb {
  meta: unknown;
  characters: unknown[];
  weapons: unknown[];
  artifacts: unknown[];
  teams: unknown[];
  enemies?: unknown[];
}

const toMap = <T extends { id: string }>(items: unknown[], parse: (x: unknown) => T): Map<string, T> =>
  new Map(items.map((x) => parse(x)).map((r) => [r.id, r]));

/** Parse and index raw KB JSON (validates every record with the zod schemas). */
export function createKb(raw: RawKb): KbData {
  return {
    meta: meta.parse(raw.meta),
    characters: toMap(raw.characters, (x) => character.parse(x)),
    weapons: toMap(raw.weapons, (x) => weapon.parse(x)),
    artifacts: toMap(raw.artifacts, (x) => artifactSet.parse(x)),
    teams: toMap(raw.teams, (x) => team.parse(x)),
    enemies: toMap(raw.enemies ?? [], (x) => enemy.parse(x)),
  };
}
