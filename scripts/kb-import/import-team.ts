import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR, listRecords } from '../kb-lib';
import { team as teamSchema } from '../../src/schema/team';
import { character as characterSchema } from '../../src/schema/character';
import { specs } from './specs/teams';

/** Usage: tsx scripts/kb-import/import-team.ts --all — writes kb/teams/<id>.json (members get their main stats from the character's `recommended.mainStats`). */
const chars = new Map(
  listRecords().filter((r) => r.kind === 'characters').map((r) => {
    const c = characterSchema.parse(r.raw);
    return [c.id, c] as const;
  }),
);
mkdirSync(join(KB_DIR, 'teams'), { recursive: true });
for (const spec of specs) {
  const members = (spec.members as unknown as Array<{ character: string; role: string; weapons: string[]; sets: Record<string, number> }>).map((m, i) => {
    const rec = chars.get(m.character);
    if (!rec) throw new Error(`team ${spec.id}: unknown character ${m.character}`);
    const ms = rec.recommended.mainStats;
    return {
      slot: i + 1, character: m.character, role: m.role, substitutes: [], weapons: m.weapons,
      artifacts: Object.keys(m.sets).length ? [{ sets: m.sets }] : [],
      mainStats: ms && { sands: ms.sands, goblet: ms.goblet, circlet: ms.circlet },
    };
  });
  const rec = teamSchema.parse({ ...spec, members });
  writeFileSync(join(KB_DIR, 'teams', `${spec.id}.json`), JSON.stringify(rec, null, 2) + '\n');
  console.log(`${spec.id}: ${rec.members.map((m) => m.character).join(', ')}`);
}
