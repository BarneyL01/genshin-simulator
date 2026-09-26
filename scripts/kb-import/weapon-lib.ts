import { weapon as weaponSchema, type Weapon } from '../../src/schema/weapon';
import type { Effect } from '../../src/schema/effect';
import { GAME_VERSION, GENSHIN_DB_URL, RETRIEVED, db, weaponPropKey, weaponTypeOf } from './lib';
import { GCSIM_DIR, gcsimCommit, gcsimUrl } from './gcsim';

export interface WeaponSpec {
  id: string;
  dbName: string;
  obtain: Weapon['obtain'];
  effects: Effect[];
  hook?: string[];
  needsHook?: boolean;
  /** gcsim directory under internal/weapons (e.g. "spear/catch") whose formulas were compared with genshin-db. */
  gcsimDir?: string;
  assumptions?: string[];
  /** Set when the obtain method was read from a source page listed in `extraSources`. */
  obtainVerified?: boolean;
  extraSources?: Array<{ site: string; url: string; fields: string[] }>;
  dataConfidence?: 'high' | 'medium' | 'low';
  conflicts?: Weapon['provenance']['conflicts'];
}

export function buildWeapon(spec: WeaponSpec): Weapon {
  const w = db.weapons(spec.dbName);
  if (!w) throw new Error(`genshin-db has no weapon "${spec.dbName}"`);
  const s90 = w.stats(90);
  const sources: Weapon['provenance']['sources'] = [
    { site: 'genshin-db', url: GENSHIN_DB_URL, retrieved: RETRIEVED, fields: ['baseAtk', 'substat', 'passive R1-R5 values', 'releaseVersion'] },
  ];
  if (spec.gcsimDir) {
    sources.push({
      site: 'gcsim', url: gcsimUrl(`internal/weapons/${spec.gcsimDir}`), retrieved: RETRIEVED, commit: gcsimCommit(),
      fields: ['passive formula cross-check', 'passive behaviour (triggers, cooldowns)'],
    });
  }
  for (const e of spec.extraSources ?? []) sources.push({ ...e, retrieved: RETRIEVED });
  return weaponSchema.parse({
    id: spec.id,
    name: w.name,
    type: weaponTypeOf(w.weaponText),
    rarity: w.rarity,
    releaseVersion: w.version,
    baseAtk: { lv90: s90.attack },
    substat: { stat: weaponPropKey(w.mainStatType), lv90: s90.specialized },
    obtain: spec.obtain,
    passive: { name: w.effectName, text: w.r1.description, effects: spec.effects },
    assumptions: [
      ...(spec.gcsimDir ? [] : ['Passive values are from genshin-db only (no gcsim cross-check).']),
      ...(spec.obtainVerified ? [] : ['Obtain method comes from community knowledge; it has not been verified in a source page. It only drives the "R5 obtainable" hint.']),
      ...(spec.assumptions ?? []),
    ],
    needsHook: spec.needsHook ?? false,
    provenance: { sources, conflicts: spec.conflicts ?? [], gameVersion: GAME_VERSION },
    dataConfidence: spec.dataConfidence ?? 'medium',
  });
}

export { GCSIM_DIR };
