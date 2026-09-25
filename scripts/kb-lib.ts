import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ZodType } from 'zod';
import { MECHANICS_FILES, artifactSet, character, enemy, meta, team, weapon } from '../src/schema';

export const KB_DIR = resolve(import.meta.dirname, '..', 'kb');

export const KINDS = {
  characters: character,
  weapons: weapon,
  artifacts: artifactSet,
  teams: team,
  enemies: enemy,
} as const satisfies Record<string, ZodType>;
export type Kind = keyof typeof KINDS;

export interface LoadedRecord {
  kind: Kind;
  file: string;
  raw: unknown;
}

export function listRecords(kbDir = KB_DIR): LoadedRecord[] {
  const out: LoadedRecord[] = [];
  for (const kind of Object.keys(KINDS) as Kind[]) {
    const dir = join(kbDir, kind);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      const file = join(dir, f);
      out.push({ kind, file, raw: JSON.parse(readFileSync(file, 'utf8')) });
    }
  }
  return out;
}

export function readMeta(kbDir = KB_DIR) {
  return meta.parse(JSON.parse(readFileSync(join(kbDir, 'meta.json'), 'utf8')));
}

export function readMechanics(kbDir = KB_DIR) {
  return Object.entries(MECHANICS_FILES).map(([name, schema]) => {
    const file = join(kbDir, 'mechanics', `${name}.json`);
    return { name, file, result: schema.safeParse(JSON.parse(readFileSync(file, 'utf8'))) };
  });
}
