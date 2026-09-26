import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createKb, type KbData } from '../src/kb/data';
import { KB_DIR, listRecords } from './kb-lib';
import '../src/engine/hooks';

/** Load the KB from disk (Node). Also registers the engine hooks. */
export function loadKb(): KbData {
  const recs = listRecords();
  const of = (kind: string) => recs.filter((r) => r.kind === kind).map((r) => r.raw);
  return createKb({
    meta: JSON.parse(readFileSync(join(KB_DIR, 'meta.json'), 'utf8')),
    characters: of('characters'),
    weapons: of('weapons'),
    artifacts: of('artifacts'),
    teams: of('teams'),
    enemies: of('enemies'),
  });
}
