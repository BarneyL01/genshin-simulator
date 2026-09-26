import gdb from 'genshin-db';
import { character as characterSchema, type Character } from '../../src/schema/character';
import type { Effect } from '../../src/schema/effect';
import { GCSIM_DIR, dmFile, gcsimCommit, gcsimUrl, goNumberArrays, hasMatchingArray } from './gcsim';

export const RETRIEVED = '2026-09-25';
export const GAME_VERSION = '7.1';
export const GENSHIN_DB_URL = 'https://github.com/theBowja/genshin-db';

// ---- genshin-db access -------------------------------------------------------------------

// genshin-db is loosely typed; keep the boundary here.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const db: any = gdb;

export const kebab = (s: string) =>
  s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'] as const;
export type Ele = (typeof ELEMENTS)[number] | 'physical';

const SUBSTAT: Record<string, string> = {
  'Elemental Mastery': 'em', 'Energy Recharge': 'er', ATK: 'atk%', HP: 'hp%', DEF: 'def%',
  'CRIT Rate': 'critRate', 'CRIT DMG': 'critDmg', 'Healing Bonus': 'healingBonus',
  'Physical DMG Bonus': 'dmgBonus.physical',
  ...Object.fromEntries(ELEMENTS.map((e) => [`${e[0]!.toUpperCase()}${e.slice(1)} DMG Bonus`, `dmgBonus.${e}`])),
};
const WEAPON_PROP: Record<string, string> = {
  FIGHT_PROP_ATTACK_PERCENT: 'atk%', FIGHT_PROP_HP_PERCENT: 'hp%', FIGHT_PROP_DEFENSE_PERCENT: 'def%',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'er', FIGHT_PROP_ELEMENT_MASTERY: 'em', FIGHT_PROP_CRITICAL: 'critRate',
  FIGHT_PROP_CRITICAL_HURT: 'critDmg', FIGHT_PROP_PHYSICAL_ADD_HURT: 'dmgBonus.physical',
  FIGHT_PROP_HEAL_ADD: 'healingBonus',
};
const WEAPON_TYPE: Record<string, Character['weaponType']> = {
  Sword: 'sword', Claymore: 'claymore', Polearm: 'polearm', Bow: 'bow', Catalyst: 'catalyst',
};

export const substatKey = (text: string): string => {
  const k = SUBSTAT[text];
  if (!k) throw new Error(`unmapped substat "${text}"`);
  return k;
};
export const weaponPropKey = (code: string): string => {
  const k = WEAPON_PROP[code];
  if (!k) throw new Error(`unmapped weapon stat "${code}"`);
  return k;
};
export const weaponTypeOf = (text: string) => {
  const t = WEAPON_TYPE[text];
  if (!t) throw new Error(`unmapped weapon type "${text}"`);
  return t;
};

/** "28%" → 0.28, "80" → 80, "1.5s" → 1.5 */
export const parseValue = (s: string): number => {
  const m = /^-?[\d.]+/.exec(s.trim());
  if (!m) throw new Error(`cannot parse "${s}"`);
  const n = Number(m[0]);
  return s.trim().includes('%') ? n / 100 : n;
};

/** genshin-db talent parameter table: 15 values per param (level 1..15). */
export function param(dbName: string, talent: 'combat1' | 'combat2' | 'combat3', key: string): number[] {
  const arr = db.talents(dbName)?.[talent]?.attributes?.parameters?.[key];
  if (!Array.isArray(arr)) throw new Error(`${dbName}: no parameter ${talent}.${key}`);
  return arr.map(Number);
}

/** Refinement table for weapon effect value #i, as numbers (percentages become fractions). */
export function refineValues(weaponName: string, valueIndex: number): number[] {
  const w = db.weapons(weaponName);
  return [1, 2, 3, 4, 5].map((r) => parseValue(w[`r${r}`].values[valueIndex]));
}

// ---- frame helpers (mirror gcsim's InitNormalCancelSlice / InitAbilSlice) ------------------

export type Cancel = Record<string, number> & { default: number };

/**
 * Normal-attack cancels: next attack/charge after `animation`; skill, burst, dash, jump, swap
 * are possible at `hitmark` (the last hit). `over` overrides individual keys.
 */
export function normalCancel(hitmark: number, animation: number, over: Record<string, number> = {}): Cancel {
  return { default: animation, skill: hitmark, burst: hitmark, dash: hitmark, jump: hitmark, swap: hitmark, ...over };
}

/** Ability cancels: every next action at `animation` unless overridden. */
export function abilCancel(animation: number, over: Record<string, number> = {}): Cancel {
  return { default: animation, ...over };
}

// ---- spec types ----------------------------------------------------------------------------

export interface HitSpec {
  name: string;
  /** Talent parameter key in the talent's genshin-db `parameters`, e.g. "param1". */
  param: string;
  element: Ele;
  scaling?: 'atk' | 'hp' | 'def' | 'em';
  hitmark: number;
  extraHitmarks?: number[];
  cancel: Cancel;
  icd?: { tag: string; group: string };
  gauge?: number;
  strike?: 'blunt';
}

/** A hit fired only by a hook (see src/engine/hooks). Frames are decided by the hook. */
export interface HookHitSpec {
  name: string;
  talent: 'normal' | 'skill' | 'burst';
  param: string;
  element: Ele;
  scaling?: 'atk' | 'hp' | 'def' | 'em';
  icd?: { tag: string; group: string };
  gauge?: number;
  /** gcsim file the timing/ICD was read from (for provenance). */
  frameFile: string;
}

export interface TalentSpec {
  /** Talent parameter key of a cooldown value in seconds, or a frame count. */
  cooldown?: { param: string } | { frames: number };
  energyCost?: { param: string } | number;
  stamina?: { param: string };
  hits: HitSpec[];
  particles?: { count: number; perHit?: boolean; icd?: number; delay?: number; element?: Exclude<Ele, 'physical'> | 'none' };
  variants?: string[];
  effects?: string[];
  /** gcsim file (in the character's directory) the frames were read from. */
  frameFile: string;
}

export interface CharacterSpec {
  id: string;
  dbName: string;
  /** Directory under gcsim `internal/characters/`. */
  gcsimDir: string;
  roles: string[];
  normal: TalentSpec;
  charged?: TalentSpec;
  plunge?: TalentSpec;
  skill: TalentSpec;
  burst: TalentSpec;
  passives: Character['passives'];
  constellations: Character['constellations'];
  effects?: Effect[];
  hookHits?: Record<string, HookHitSpec>;
  usualCombo: Character['usualCombo'];
  recommended?: Character['recommended'];
  assumptions?: string[];
  hooks?: string[];
  needsHook?: boolean;
  /** Extra sources consulted (e.g. KQM pages) for provenance. */
  extraSources?: Array<{ site: string; url: string; fields: string[] }>;
  dataConfidence?: 'high' | 'medium' | 'low';
  /** Cross-source disagreements found while authoring the spec. */
  conflicts?: Character['provenance']['conflicts'];
}

const TALENT_KEY = { normal: 'combat1', charged: 'combat1', plunge: 'combat1', skill: 'combat2', burst: 'combat3' } as const;

export function buildCharacter(spec: CharacterSpec): { record: Character; report: string[] } {
  const c = db.characters(spec.dbName);
  if (!c) throw new Error(`genshin-db has no character "${spec.dbName}"`);
  const s90 = c.stats(90);
  const report: string[] = [];
  const conflicts: Character['provenance']['conflicts'] = [];

  const dmArrays = (() => {
    const f = dmFile(spec.gcsimDir);
    return f ? goNumberArrays(f) : [];
  })();
  let mvChecked = 0;
  let mvMatched = 0;

  const block = (kind: keyof typeof TALENT_KEY, t: TalentSpec) => {
    const talentKey = TALENT_KEY[kind];
    const gPath = `internal/characters/${spec.gcsimDir}/${t.frameFile}`;
    const source = { site: 'gcsim', url: gcsimUrl(gPath), commit: gcsimCommit() };
    const hits = t.hits.map((h) => {
      const mv = param(spec.dbName, talentKey, h.param);
      mvChecked++;
      if (hasMatchingArray(dmArrays, mv)) mvMatched++;
      else conflicts.push({ field: `talents.${kind}.${h.name}.mv`, values: { 'genshin-db': `${talentKey}.${h.param}`, gcsim: 'no matching table found' }, chosen: 'genshin-db', note: 'not confirmed by gcsim tables' });
      return {
        name: h.name, mv, scaling: h.scaling ?? 'atk', element: h.element === 'physical' ? ('physical' as const) : h.element,
        frames: { hitmark: h.hitmark, cancel: h.cancel, source },
        icd: h.icd, gauge: h.gauge, strike: h.strike, extraHitmarks: h.extraHitmarks,
      };
    });
    const cd = t.cooldown && ('param' in t.cooldown ? Math.round(param(spec.dbName, talentKey, t.cooldown.param)[0]! * 60) : t.cooldown.frames);
    const cost = t.energyCost === undefined ? undefined : typeof t.energyCost === 'number' ? t.energyCost : param(spec.dbName, talentKey, t.energyCost.param)[0];
    return {
      hits, variants: t.variants, cooldown: cd, energyCost: cost,
      stamina: t.stamina ? param(spec.dbName, talentKey, t.stamina.param)[0] : undefined,
      particles: t.particles, effects: t.effects ?? [],
    };
  };

  const talents: Character['talents'] = { normal: block('normal', spec.normal), skill: block('skill', spec.skill), burst: block('burst', spec.burst) };
  if (spec.charged) talents.charged = block('charged', spec.charged);
  if (spec.plunge) talents.plunge = block('plunge', spec.plunge);

  const hookHits = Object.fromEntries(
    Object.entries(spec.hookHits ?? {}).map(([id, h]) => {
      const mv = param(spec.dbName, TALENT_KEY[h.talent], h.param);
      mvChecked++;
      if (hasMatchingArray(dmArrays, mv)) mvMatched++;
      return [id, {
        name: h.name, mv, scaling: h.scaling ?? 'atk', element: h.element, talent: h.talent, icd: h.icd, gauge: h.gauge,
        frames: { hitmark: 0, cancel: {}, source: { site: 'gcsim', url: gcsimUrl(`internal/characters/${spec.gcsimDir}/${h.frameFile}`), commit: gcsimCommit() } },
      }];
    }),
  );

  const asc = { stat: substatKey(c.substatText), value: s90.specialized };
  const provenance: Character['provenance'] = {
    sources: [
      { site: 'genshin-db', url: GENSHIN_DB_URL, retrieved: RETRIEVED, fields: ['baseStats', 'ascensionStat', 'talent multipliers', 'talent params', 'passive/constellation text', 'releaseVersion'] },
      {
        site: 'gcsim', url: gcsimUrl(`internal/characters/${spec.gcsimDir}`), retrieved: RETRIEVED, commit: gcsimCommit(),
        fields: ['frames', 'ICD', 'gauge', 'particles', 'multiplier cross-check'],
      },
      ...(spec.extraSources ?? []).map((e) => ({ ...e, retrieved: RETRIEVED })),
    ],
    conflicts: [...conflicts, ...(spec.conflicts ?? [])],
    gameVersion: GAME_VERSION,
  };

  const record = characterSchema.parse({
    id: spec.id,
    name: c.name,
    rarity: c.rarity,
    element: c.elementText.toLowerCase(),
    weaponType: weaponTypeOf(c.weaponText),
    releaseVersion: c.version,
    roles: spec.roles,
    baseStats: { lv90: { hp: s90.hp, atk: s90.attack, def: s90.defense }, lv100: null },
    ascensionStat: asc,
    talents,
    passives: spec.passives,
    constellations: spec.constellations,
    effects: spec.effects ?? [],
    hookHits,
    usualCombo: spec.usualCombo,
    recommended: spec.recommended ?? { weapons: [], artifacts: [] },
    assumptions: [
      'Base stats and multipliers are read from genshin-db; multipliers are cross-checked against gcsim tables, base stats are not yet cross-checked in a second source.',
      ...(spec.assumptions ?? []),
    ],
    hooks: spec.hooks ?? [],
    needsHook: spec.needsHook ?? false,
    provenance,
    dataConfidence: spec.dataConfidence ?? 'medium',
  });

  report.push(`${spec.id}: multiplier tables confirmed by gcsim ${mvMatched}/${mvChecked}`);
  report.push(`${spec.id}: base Lv90 HP ${s90.hp.toFixed(1)} ATK ${s90.attack.toFixed(1)} DEF ${s90.defense.toFixed(1)}; ascension ${asc.stat} ${asc.value}`);
  return { record, report };
}

export { GCSIM_DIR };
