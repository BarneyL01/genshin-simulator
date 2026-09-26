import { useCallback, useEffect, useState } from 'react';
import type { KbData, SavedTeam } from '../kb';
import { roster as rosterSchema, type Roster } from '../schema/roster';

const KEY = 'genshin-sim-roster-v1';
const TALENT_MIGRATION = 'genshin-sim-talent-default-1';
const TEAMS_KEY = 'genshin-sim-saved-teams-v1';

/** A roster where nothing is owned yet; every character C0, talents 1/1/1, every weapon R1. */
export function emptyRoster(kb: KbData): Roster {
  return {
    version: 1,
    characters: Object.fromEntries([...kb.characters.keys()].map((id) => [id, { owned: false, constellation: 0, talents: [1, 1, 1] as [number, number, number], level: 90 as const }])),
    weapons: Object.fromEntries([...kb.weapons.keys()].map((id) => [id, { owned: false, refinement: 1 }])),
    settings: { executionProfile: 'relaxed', actionDelay: 18, swapDelay: 18, assumeAllWeapons: true },
  };
}

/** Load the saved roster and add entries for any characters/weapons that were added to the KB since. */
export function loadRoster(kb: KbData): Roster {
  const base = emptyRoster(kb);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = rosterSchema.parse(JSON.parse(raw));
    // One-off migration: the default talent level changed from 9 to 1; old rosters that still hold the old default follow it.
    if (!localStorage.getItem(TALENT_MIGRATION)) {
      for (const c of Object.values(saved.characters)) if (c.talents.every((t) => t === 9)) c.talents = [1, 1, 1];
      localStorage.setItem(TALENT_MIGRATION, '1');
    }
    return { ...saved, characters: { ...base.characters, ...saved.characters }, weapons: { ...base.weapons, ...saved.weapons } };
  } catch {
    return base;
  }
}

export function saveRoster(r: Roster): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage unavailable (private window, blocked): the roster just is not remembered */
  }
}

export function parseRoster(json: string): Roster {
  return rosterSchema.parse(JSON.parse(json));
}

export function useRoster(kb: KbData) {
  const [roster, setRoster] = useState<Roster>(() => loadRoster(kb));
  useEffect(() => saveRoster(roster), [roster]);
  const update = useCallback((fn: (r: Roster) => Roster) => setRoster((r) => fn(r)), []);
  return { roster, setRoster, update };
}

function loadTeams(): SavedTeam[] {
  try {
    const v = JSON.parse(localStorage.getItem(TEAMS_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as SavedTeam[]).filter((t) => t && typeof t.id === 'string' && Array.isArray(t.team?.order)) : [];
  } catch {
    return [];
  }
}

/** Custom teams the user saved (kept in this browser only). */
export function useSavedTeams() {
  const [teams, setTeams] = useState<SavedTeam[]>(loadTeams);
  useEffect(() => {
    try {
      localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
    } catch {
      /* storage unavailable: teams are just not remembered */
    }
  }, [teams]);
  const save = useCallback((t: SavedTeam) => setTeams((l) => (l.some((x) => x.id === t.id) ? l.map((x) => (x.id === t.id ? t : x)) : [...l, t])), []);
  const remove = useCallback((id: string) => setTeams((l) => l.filter((x) => x.id !== id)), []);
  return { teams, save, remove };
}
