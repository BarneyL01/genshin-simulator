import { artifactSet as artifactSchema } from '../../src/schema/artifact';
import { effect, type Effect } from '../../src/schema/effect';
import { weapon as weaponSchema } from '../../src/schema/weapon';
import { GAME_VERSION, GENSHIN_DB_URL, RETRIEVED, db, kebab, weaponPropKey, weaponTypeOf } from './lib';

/** All names genshin-db knows for a category. */
export const allNames = (kind: 'characters' | 'weapons' | 'artifacts'): string[] =>
  db[kind]('names', { matchCategories: true }) as string[];

const src = (fields: string[]) => ({ site: 'genshin-db', url: GENSHIN_DB_URL, retrieved: RETRIEVED, fields });

/** Bulk weapon record: base ATK, substat and the R1 passive text; the passive itself is not modelled. */
export function autoWeapon(name: string) {
  const w = db.weapons(name);
  const s90 = w.stats(90);
  const hasPassive = Boolean(w.effectName);
  return weaponSchema.parse({
    id: kebab(w.name),
    name: w.name,
    type: weaponTypeOf(w.weaponText),
    rarity: w.rarity,
    releaseVersion: w.version,
    baseAtk: { lv90: s90.attack },
    substat: { stat: weaponPropKey(w.mainStatType), lv90: s90.specialized },
    obtain: { method: w.rarity >= 4 ? 'gacha' : 'chest', freeRefinement: null },
    passive: { name: w.effectName ?? undefined, text: w.r1?.description, effects: [] },
    assumptions: [
      ...(hasPassive ? [`Passive "${w.effectName}" is not modelled yet: the weapon contributes only its base ATK and secondary stat. R1 text: ${w.r1?.description ?? ''}`] : []),
      'Obtain method is a guess from rarity and has not been verified in a source page.',
      'Base ATK and secondary stat are from genshin-db only (not cross-checked in a second source).',
    ],
    needsHook: false,
    provenance: { sources: [src(['baseAtk', 'substat', 'passive text', 'releaseVersion'])], conflicts: [], gameVersion: GAME_VERSION },
    dataConfidence: hasPassive ? 'low' : 'medium',
  });
}

const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];
const E = (id: string, stat: string, value: number): Effect => effect.parse({ id, trigger: { on: 'always' }, target: 'self', stat, value });

/** Parse a simple always-on 2-piece bonus text. */
export function parse2pc(setId: string, text: string): { effects: Effect[]; understood: boolean } {
  const t = text.replace(/\.$/, '').trim();
  const num = (m: RegExpExecArray | null, i = 1) => (m ? Number(m[i]) : NaN);
  const rules: Array<[RegExp, (m: RegExpExecArray) => Effect | undefined]> = [
    [/^(Pyro|Hydro|Electro|Cryo|Anemo|Geo|Dendro|Physical) DMG Bonus \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, `dmgBonus.${m[1]!.toLowerCase()}`, num(m, 2) / 100)],
    [/^ATK \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'atk%', num(m) / 100)],
    [/^HP \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'hp%', num(m) / 100)],
    [/^DEF \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'def%', num(m) / 100)],
    [/^Energy Recharge \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'er', num(m) / 100)],
    [/^Elemental Mastery \+(\d+(?:\.\d+)?)$/i, (m) => E(`${setId}.2pc`, 'em', num(m))],
    [/^CRIT Rate \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'critRate', num(m) / 100)],
    [/^Healing Bonus \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'healingBonus', num(m) / 100)],
    [/^Elemental Burst DMG \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'dmgBonus.burst', num(m) / 100)],
    [/^Elemental Skill DMG \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'dmgBonus.skill', num(m) / 100)],
    [/^Charged Attack DMG \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'dmgBonus.charged', num(m) / 100)],
    [/^Normal Attack DMG \+(\d+(?:\.\d+)?)%$/i, (m) => E(`${setId}.2pc`, 'dmgBonus.normal', num(m) / 100)],
  ];
  for (const [re, make] of rules) {
    const m = re.exec(t);
    if (m) return { effects: [make(m)!], understood: true };
  }
  return { effects: [], understood: false };
}

export function autoArtifact(name: string) {
  const a = db.artifacts(name);
  const id = kebab(a.name);
  const two = parse2pc(id, a.effect2Pc);
  const fourText = a.effect4Pc as string | undefined;
  return artifactSchema.parse({
    id,
    name: a.name,
    pieces: { '2': { effects: two.effects }, '4': { effects: [] } },
    assumptions: [
      ...(two.understood ? [] : [`2-piece bonus "${a.effect2Pc}" is not modelled yet.`]),
      ...(fourText ? [`4-piece bonus "${fourText}" is not modelled yet.`] : []),
      'Bonuses are read from the genshin-db set text; not cross-checked in a second source.',
    ],
    needsHook: false,
    provenance: { sources: [src(['2pc text', '4pc text'])], conflicts: [], gameVersion: GAME_VERSION },
    dataConfidence: 'low',
  });
}

export const ELEMENT_IDS = ELEMENTS;
