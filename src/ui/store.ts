import { useCallback, useEffect, useState } from 'react';
import type { KbData, SavedTeam } from '../kb';
import type { Roster } from '../schema/roster';
import { salvageRoster, salvageTeams } from './backup';

const KEY = 'genshin-sim-roster-v1';
const TALENT_MIGRATION = 'genshin-sim-talent-default-1';
const TEAMS_KEY = 'genshin-sim-saved-teams-v1';
const UI_PREFIX = 'genshin-sim-ui-';
/** Raw copies of stored data that could not be read (fully or partly), kept so nothing is silently lost. */
const RECOVERY_KEYS = [`${KEY}-unreadable`, `${KEY}-before-repair`, `${TEAMS_KEY}-unreadable`, `${TEAMS_KEY}-before-repair`];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private window, blocked, full): the value just is not remembered */
  }
}

/** Keep a raw copy before the app replaces data it could not fully read. The first copy is never overwritten. */
function keepCopy(key: string, raw: string): void {
  if (read(key) === null) write(key, raw);
}

/** A roster where nothing is owned yet; every character C0, talents 1/1/1, every weapon R1. */
export function emptyRoster(kb: KbData): Roster {
  return {
    version: 1,
    characters: Object.fromEntries([...kb.characters.keys()].map((id) => [id, { owned: false, constellation: 0, talents: [1, 1, 1] as [number, number, number], level: 90 as const }])),
    weapons: Object.fromEntries([...kb.weapons.keys()].map((id) => [id, { owned: false, refinement: 1 }])),
    settings: { executionProfile: 'relaxed', actionDelay: 18, swapDelay: 18, assumeAllWeapons: true },
  };
}

/** Add entries for characters/weapons that were added to the KB since the roster was saved. Unknown ids are kept. */
export function withKbEntries(kb: KbData, r: Roster): Roster {
  const base = emptyRoster(kb);
  return { ...r, characters: { ...base.characters, ...r.characters }, weapons: { ...base.weapons, ...r.weapons } };
}

/** Load the saved roster. Invalid entries are skipped rather than discarding the whole roster. */
export function loadRoster(kb: KbData): Roster {
  const raw = read(KEY);
  if (!raw) return emptyRoster(kb);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const { roster: saved, dropped } = salvageRoster(parsed);
  if (!saved) {
    keepCopy(`${KEY}-unreadable`, raw);
    return emptyRoster(kb);
  }
  if (dropped.length) keepCopy(`${KEY}-before-repair`, raw);
  // One-off migration: the default talent level changed from 9 to 1; old rosters that still hold the old default follow it.
  if (!read(TALENT_MIGRATION)) {
    for (const c of Object.values(saved.characters)) if (c.talents.every((t) => t === 9)) c.talents = [1, 1, 1];
    write(TALENT_MIGRATION, '1');
  }
  return withKbEntries(kb, saved);
}

export function useRoster(kb: KbData) {
  const [roster, setRoster] = useState<Roster>(() => loadRoster(kb));
  useEffect(() => write(KEY, JSON.stringify(roster)), [roster]);
  const update = useCallback((fn: (r: Roster) => Roster) => setRoster((r) => fn(r)), []);
  return { roster, setRoster, update };
}

function loadTeams(): SavedTeam[] {
  const raw = read(TEAMS_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    keepCopy(`${TEAMS_KEY}-unreadable`, raw);
    return [];
  }
  const { teams, dropped } = salvageTeams(parsed);
  if (dropped.length || !Array.isArray(parsed)) keepCopy(`${TEAMS_KEY}-before-repair`, raw);
  return teams;
}

/** Custom teams the user saved (kept in this browser only). */
export function useSavedTeams() {
  const [teams, setTeams] = useState<SavedTeam[]>(loadTeams);
  useEffect(() => write(TEAMS_KEY, JSON.stringify(teams)), [teams]);
  const save = useCallback((t: SavedTeam) => setTeams((l) => (l.some((x) => x.id === t.id) ? l.map((x) => (x.id === t.id ? t : x)) : [...l, t])), []);
  const remove = useCallback((id: string) => setTeams((l) => l.filter((x) => x.id !== id)), []);
  /** Add imported teams; a team with the same id replaces the existing one. */
  const merge = useCallback((incoming: SavedTeam[]) => setTeams((l) => [...l.filter((x) => !incoming.some((t) => t.id === x.id)), ...incoming]), []);
  return { teams, save, remove, merge, replaceAll: setTeams };
}

/** Raw copies of stored data that could not be read, for the Backup tab to offer. */
export function recoveredCopies(): Array<{ key: string; text: string }> {
  return RECOVERY_KEYS.flatMap((key) => {
    const text = read(key);
    return text ? [{ key, text }] : [];
  });
}

export function discardRecoveredCopy(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * useState that is remembered in this browser (working selections on each tab).
 * `valid` rejects stored values that no longer fit (e.g. a removed character).
 */
export function usePersistentState<T>(name: string, initial: T, valid: (v: unknown) => v is T = (v): v is T => v !== undefined) {
  const key = UI_PREFIX + name;
  const [value, setValue] = useState<T>(() => {
    const raw = read(key);
    if (raw === null) return initial;
    try {
      const v: unknown = JSON.parse(raw);
      return valid(v) ? v : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (value === undefined) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    } else write(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

/** Ask the browser not to evict this site's storage under pressure (granted silently or ignored). */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* not supported */
  }
}
