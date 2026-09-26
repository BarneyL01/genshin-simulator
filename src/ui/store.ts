import { useCallback, useEffect, useState } from 'react';
import type { KbData } from '../kb';
import { roster as rosterSchema, type Roster } from '../schema/roster';

const KEY = 'genshin-sim-roster-v1';

/** A roster where nothing is owned yet; every character C0, talents 9/9/9, every weapon R1. */
export function emptyRoster(kb: KbData): Roster {
  return {
    version: 1,
    characters: Object.fromEntries([...kb.characters.keys()].map((id) => [id, { owned: false, constellation: 0, talents: [9, 9, 9] as [number, number, number], level: 90 as const }])),
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
