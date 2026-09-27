// Backup format for everything the user sets up in the app (roster + saved custom teams),
// and lenient parsing so one bad entry never discards the rest.
import { z } from 'zod';
import type { SavedTeam } from '../kb';
import { roster as rosterSchema, type Roster } from '../schema/roster';

export const BACKUP_FORMAT = 'genshin-team-simulator-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  roster: Roster;
  savedTeams: SavedTeam[];
}

/** Drop entries that equal the defaults (not owned, C0, talents 1/1/1, R1); import fills them back in. */
export function compactRoster(r: Roster): Roster {
  return {
    ...r,
    characters: Object.fromEntries(Object.entries(r.characters).filter(([, c]) => c.owned || c.constellation !== 0 || c.talents.some((t) => t !== 1))),
    weapons: Object.fromEntries(Object.entries(r.weapons).filter(([, w]) => w.owned || w.refinement !== 1)),
  };
}

export function makeBackup(roster: Roster, savedTeams: SavedTeam[], now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), roster: compactRoster(roster), savedTeams };
}

const characterEntry = rosterSchema.shape.characters.valueType;
const weaponEntry = rosterSchema.shape.weapons.valueType;
const settingsSchema = rosterSchema.shape.settings;
const DEFAULT_SETTINGS = settingsSchema.parse({});

const savedTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  team: z.object({
    order: z.array(z.string()),
    variants: z.record(z.string(), z.string()).optional(),
    lengthSeconds: z.number().positive().optional(),
    builds: z.record(z.string(), z.object({ weapon: z.string().optional(), refinement: z.number().int().min(1).max(5).optional(), set: z.string().optional() })).optional(),
  }),
  rotationJson: z.string().optional(),
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Read a roster entry by entry. Invalid characters/weapons are skipped (listed in `dropped`)
 * instead of failing the whole roster; invalid settings fall back to defaults.
 * Returns `roster: null` only when the value is not a roster at all.
 */
export function salvageRoster(raw: unknown): { roster: Roster | null; dropped: string[] } {
  const dropped: string[] = [];
  if (!isObject(raw) || !isObject(raw.characters)) return { roster: null, dropped };
  const pick = <T>(src: unknown, schema: z.ZodType<T>, kind: string): Record<string, T> => {
    const out: Record<string, T> = {};
    if (!isObject(src)) return out;
    for (const [id, v] of Object.entries(src)) {
      const r = schema.safeParse(v);
      if (r.success) out[id] = r.data;
      else dropped.push(`${kind} ${id}`);
    }
    return out;
  };
  const settings = settingsSchema.safeParse(raw.settings ?? {});
  if (!settings.success) dropped.push('settings (reset to defaults)');
  return {
    roster: {
      version: 1,
      characters: pick(raw.characters, characterEntry, 'character'),
      weapons: pick(raw.weapons, weaponEntry, 'weapon'),
      settings: settings.success ? settings.data : DEFAULT_SETTINGS,
    },
    dropped,
  };
}

export function salvageTeams(raw: unknown): { teams: SavedTeam[]; dropped: string[] } {
  const teams: SavedTeam[] = [];
  const dropped: string[] = [];
  if (!Array.isArray(raw)) return { teams, dropped };
  raw.forEach((t, i) => {
    const r = savedTeamSchema.safeParse(t);
    if (r.success) teams.push(r.data);
    else dropped.push(`saved team ${isObject(t) && typeof t.name === 'string' ? `"${t.name}"` : `#${i + 1}`}`);
  });
  return { teams, dropped };
}

export interface ParsedBackup {
  /** null when the text held only saved teams. */
  roster: Roster | null;
  /** null when the text held only a roster (the older roster-only export). */
  savedTeams: SavedTeam[] | null;
  warnings: string[];
}

/**
 * Parse pasted or uploaded backup text. Accepts a full backup, the older roster-only export,
 * or a bare list of saved teams. Throws a readable error when nothing usable is found.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This is not valid JSON. Paste the whole exported text, from the first { to the last }.');
  }
  const warnings: string[] = [];
  const skipped = (d: string[]) => { if (d.length) warnings.push(`Skipped (invalid): ${d.join(', ')}`); };

  if (Array.isArray(raw)) {
    const t = salvageTeams(raw);
    skipped(t.dropped);
    return { roster: null, savedTeams: t.teams, warnings };
  }
  if (isObject(raw) && raw.format === BACKUP_FORMAT) {
    const r = salvageRoster(raw.roster);
    const t = salvageTeams(raw.savedTeams ?? []);
    if (!r.roster) warnings.push('The backup has no readable roster; only saved teams were imported.');
    skipped([...r.dropped, ...t.dropped]);
    return { roster: r.roster, savedTeams: t.teams, warnings };
  }
  const r = salvageRoster(raw);
  if (!r.roster) throw new Error('No roster or saved teams found in this text.');
  skipped(r.dropped);
  return { roster: r.roster, savedTeams: null, warnings };
}
