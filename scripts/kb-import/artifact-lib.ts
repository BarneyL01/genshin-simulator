import { artifactSet as artifactSchema, type ArtifactSet } from '../../src/schema/artifact';
import type { Effect } from '../../src/schema/effect';
import { GAME_VERSION, GENSHIN_DB_URL, RETRIEVED, db } from './lib';

export interface ArtifactSpec {
  id: string;
  dbName: string;
  two: Effect[];
  four: Effect[];
  assumptions?: string[];
  needsHook?: boolean;
  dataConfidence?: 'high' | 'medium' | 'low';
}

export function buildArtifact(spec: ArtifactSpec): ArtifactSet & { text: { two: string; four: string } } {
  const a = db.artifacts(spec.dbName);
  if (!a) throw new Error(`genshin-db has no artifact set "${spec.dbName}"`);
  const rec = artifactSchema.parse({
    id: spec.id,
    name: a.name,
    pieces: { '2': { effects: spec.two }, '4': { effects: spec.four } },
    assumptions: [
      'Bonuses are read from the genshin-db set text; not cross-checked in a second source.',
      ...(spec.assumptions ?? []),
    ],
    needsHook: spec.needsHook ?? false,
    provenance: {
      sources: [{ site: 'genshin-db', url: GENSHIN_DB_URL, retrieved: RETRIEVED, fields: ['2pc text', '4pc text'] }],
      conflicts: [],
      gameVersion: GAME_VERSION,
    },
    dataConfidence: spec.dataConfidence ?? 'medium',
  });
  return { ...rec, text: { two: a.effect2Pc, four: a.effect4Pc } };
}
