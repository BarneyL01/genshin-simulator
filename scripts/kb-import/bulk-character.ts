import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { character as characterSchema, type Character } from '../../src/schema/character';
import { characterDir, dmFile, gcsimCommit, gcsimUrl, goNumberArrays, hasMatchingArray, GCSIM_DIR } from './gcsim';
import { extractFrames, type CharFrames } from './gcsim-frames';
import { pageText } from './http';
import { GAME_VERSION, GENSHIN_DB_URL, RETRIEVED, db, kebab, param, substatKey, weaponTypeOf } from './lib';

type Cancel = Record<string, number> & { default: number };
const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];

/** gcsim directory for a genshin-db character name, via each directory's config.yml `name:`. */
export function gcsimDirs(): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of readdirSync(join(GCSIM_DIR, 'internal', 'characters'))) {
    const cfg = join(characterDir(d), 'config.yml');
    if (!existsSync(cfg)) continue;
    const m = /^name:\s*(\w+)/m.exec(readFileSync(cfg, 'utf8'));
    if (m) map.set(m[1]!, d);
  }
  return map;
}

interface ParsedLabel {
  name: string;
  params: string[];
}

function parseLabel(label: string): ParsedLabel {
  const [name = '', pattern = ''] = label.split('|');
  const params: string[] = [];
  const times = /\}\s*[*×x]\s*(\d+)/.exec(pattern);
  for (const m of pattern.matchAll(/\{(param\d+)[:}]/g)) params.push(m[1]!);
  if (times && params.length === 1) return { name, params: Array(Number(times[1])).fill(params[0]!) };
  return { name, params };
}

const NOT_DAMAGE = /(bonus|shield|absorb|heal|regen|cd|cooldown|duration|cost|stamina|reduction|decrease|increase|ratio|interval|range|count|number|max|stacks|energy|res\b|restor|radius|limit|threshold|delay|points|extra)/i;

const detectScaling = (label: string): 'atk' | 'hp' | 'def' | 'em' => (/max hp/i.test(label) ? 'hp' : /\bdef\b/i.test(label) && !/def(ense)? (shred|reduc)/i.test(label) ? 'def' : /elemental mastery/i.test(label) ? 'em' : 'atk');

const seconds = (frames: number) => Math.round(frames);

/** Skill/burst DMG labels (the first parameter of each). */
function damageLabels(labels: string[]): ParsedLabel[] {
  const all = labels.map(parseLabel).filter((l) => l.params.length > 0 && /dmg|damage/i.test(l.name) && !NOT_DAMAGE.test(l.name.replace(/dmg|damage/gi, '')));
  // Alternative variants (hold, charge levels) are not part of the default press/normal use
  const VARIANT = /hold|charge level|charged|alternat|level [2-9]|lv\.? ?[2-9]/i;
  const base = all.filter((l) => !VARIANT.test(l.name));
  return base.length ? base : all;
}

export interface Donor {
  frames: CharFrames;
  /** gcsim directory each component was borrowed from. */
  ids: { normal?: string; charged?: string; skill?: string; burst?: string };
  id: string;
}

export interface AutoResult {
  record: Character;
  notes: string[];
}

function gaugeOf(dir: string, file: string): { gauge: number; none: boolean } {
  const p = join(characterDir(dir), file);
  const s = existsSync(p) ? readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  const d = /Durability:\s*(\d+)/.exec(s);
  return { gauge: d ? Number(d[1]) / 25 : 1, none: /ICDTag:\s*attacks\.ICDTagNone/.test(s) };
}

function particlesOf(dir: string) {
  const p = join(characterDir(dir), 'skill.go');
  const s = existsSync(p) ? readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
  const m = /QueueParticle\([^,]+,\s*([\d.]+)\s*,\s*attributes\.(\w+)/.exec(s);
  if (!m) return undefined;
  const el = m[2]!.toLowerCase();
  return { count: Number(m[1]), perHit: false, icd: 0, element: (ELEMENTS.includes(el) ? el : 'none') as never };
}

/** KQM quick guide → recommended main stats (best effort). */
export function kqmMainStats(slugs: string[]): { url: string; sands: string[]; goblet: string[]; circlet: string[]; text: string } | undefined {
  for (const slug of slugs) {
    const url = `https://keqingmains.com/q/${slug}-quickguide/`;
    const t = pageText(url);
    const i = t?.indexOf('Sands Goblet Circlet') ?? -1;
    if (!t || i < 0) continue;
    const row = t.slice(i + 20, i + 400).split(/Stat Priority|Substat|Artifact Sets|Sands Goblet/)[0]!;
    const re = /(ATK%|HP%|DEF%|Energy Recharge|ER%?|Elemental Mastery|EM|(?:Pyro|Hydro|Electro|Cryo|Anemo|Geo|Dendro|Physical) DMG(?: Bonus)?|CRIT Rate|CRIT DMG|CRIT|Healing Bonus|Healing)/g;
    const toks = [...row.matchAll(re)].map((m) => m[1]!);
    const g = toks.findIndex((x) => /DMG(?: Bonus)?$/.test(x) && !/^CRIT/.test(x));
    if (g < 1) continue;
    const key = (x: string): string[] => {
      if (/^ATK/.test(x)) return ['atk%'];
      if (/^HP/.test(x)) return ['hp%'];
      if (/^DEF/.test(x)) return ['def%'];
      if (/^(Energy|ER)/.test(x)) return ['er'];
      if (/^(Elemental Mastery|EM)$/.test(x)) return ['em'];
      if (/^CRIT Rate/.test(x)) return ['critRate'];
      if (/^CRIT DMG/.test(x)) return ['critDmg'];
      if (x === 'CRIT') return ['critRate', 'critDmg'];
      if (/^Heal/.test(x)) return ['healingBonus'];
      const el = /^(\w+) DMG/.exec(x);
      return el ? [`dmgBonus.${el[1]!.toLowerCase()}`] : [];
    };
    const uniq = (a: string[]) => [...new Set(a)];
    const sands = uniq(toks.slice(0, g).flatMap(key));
    const goblet = uniq(key(toks[g]!));
    const circlet = uniq(toks.slice(g + 1).flatMap(key));
    if (sands.length && circlet.length) return { url, sands, goblet, circlet, text: row.trim() };
  }
  return undefined;
}

export function buildAuto(name: string, dir: string | undefined, donors: Record<string, Donor | undefined>): AutoResult {
  const c = db.characters(name);
  const id = kebab(c.name);
  const notes: string[] = [];
  const element = c.elementText.toLowerCase() as Character['element'];
  const weaponType = weaponTypeOf(c.weaponText);
  const t = db.talents(c.name);
  const labels = (k: 'combat1' | 'combat2' | 'combat3') => t[k].attributes.labels as string[];
  const s90 = c.stats(90);

  const parsed = dir ? extractFrames(dir) : undefined;
  const donor = donors[weaponType];
  const estimated: string[] = [];
  const fromGcsim = (what: string) => `internal/characters/${dir}/${what}`;

  const donorDir = (file: string) => donor?.ids[file.startsWith('attack') ? 'normal' : file.startsWith('charge') ? 'charged' : file.startsWith('skill') ? 'skill' : 'burst'] ?? donor?.id ?? 'xiangling';
  const src = (file: string, isDonor: boolean) => ({
    site: 'gcsim',
    url: gcsimUrl(isDonor ? `internal/characters/${donorDir(file)}/${file}` : fromGcsim(file)),
    commit: gcsimCommit(),
  });

  // --- normal attacks
  const l1 = labels('combat1').map(parseLabel);
  const stepLabels = l1.filter((l) => /^\d+-Hit/.test(l.name) && l.params.length > 0);
  const normalSteps = stepLabels.map((l, i) => {
    const step = parsed?.normal?.[i];
    const d = donor?.frames.normal?.[Math.min(i, (donor.frames.normal?.length ?? 1) - 1)];
    const use = step ?? d;
    if (!step) estimated.push(`N${i + 1}`);
    const hm = use?.hitmarks ?? [12];
    const hits = l.params.map((_, j) => hm[Math.min(j, hm.length - 1)]! + (j >= hm.length ? 6 * (j - hm.length + 1) : 0));
    const cancel = (use?.cancel ?? { default: (hits[hits.length - 1] ?? 12) + 8 }) as Cancel;
    const isElemental = weaponType === 'catalyst';
    return { l, hits, cancel, element: isElemental ? element : 'physical', isDonor: !step, i };
  });
  const normalBlock = normalSteps.map((s) => ({
    name: `N${s.i + 1}`, mv: param(c.name, 'combat1', s.l.params[0]!), scaling: 'atk' as const,
    element: s.element as never, gauge: 1, icd: { tag: 'normal', group: 'standard' },
    frames: { hitmark: s.hits[0]!, cancel: s.cancel, source: src('attack.go', s.isDonor) },
    extraHitmarks: s.hits.length > 1 ? s.hits.slice(1) : undefined,
    extraMv: s.l.params.length > 1 && new Set(s.l.params).size > 1 ? s.l.params.slice(1).map((p) => param(c.name, 'combat1', p)) : undefined,
  }));

  // --- charged attack
  const chargedLabel = l1.find((l) => /^Charged Attack DMG$/i.test(l.name) || /^Fully-Charged Aimed Shot$/i.test(l.name));
  const chargedFrames = parsed?.charged ?? donor?.frames.charged;
  if (!parsed?.charged) estimated.push('charged');
  const chargedBlock = chargedLabel && chargedFrames && {
    hits: [{
      name: 'Charged', mv: param(c.name, 'combat1', chargedLabel.params[0]!), scaling: 'atk' as const,
      element: (weaponType === 'catalyst' || /Aimed/.test(chargedLabel.name) ? element : 'physical') as never, gauge: 1,
      icd: { tag: 'extra', group: 'standard' },
      frames: { hitmark: chargedFrames.hitmarks[0]!, cancel: chargedFrames.cancel as Cancel, source: src('charge.go', !parsed?.charged) },
      extraHitmarks: chargedLabel.params.length > 1 ? chargedLabel.params.slice(1).map((_, j) => (chargedFrames.hitmarks[j + 1] ?? chargedFrames.hitmarks[0]! + 6 * (j + 1))) : undefined,
      extraMv: chargedLabel.params.length > 1 && new Set(chargedLabel.params).size > 1 ? chargedLabel.params.slice(1).map((p) => param(c.name, 'combat1', p)) : undefined,
    }],
  };

  // --- skill / burst
  const block = (kind: 'skill' | 'burst', key: 'combat2' | 'combat3') => {
    const ls = labels(key);
    const dmg = damageLabels(ls);
    const fr = parsed?.[kind] ?? donor?.frames[kind];
    const own = Boolean(parsed?.[kind]);
    if (!own) estimated.push(kind);
    const cancel = (fr?.cancel ?? { default: 60 }) as Cancel;
    const hitmark = (parsed?.[kind]?.hitmark ?? Math.max(1, Math.round(cancel.default * 0.5)));
    if (parsed?.[kind]?.hitmark === undefined) estimated.push(`${kind} hitmark`);
    const gk = gaugeOf(dir ?? '', `${kind}.go`);
    const hits = dmg.flatMap((l, i) =>
      l.params.map((p, j) => ({
        name: `${l.name.replace(/DMG|Damage/gi, '').trim() || kind}${l.params.length > 1 ? ` ${j + 1}` : ''}`.slice(0, 60),
        mv: param(c.name, key, p), scaling: detectScaling(ls.find((x) => x.startsWith(l.name)) ?? l.name), element,
        gauge: gk.gauge, icd: gk.none ? { tag: 'none', group: 'none' } : { tag: kind, group: 'standard' },
        frames: { hitmark: hitmark + 3 * (i + j), cancel, source: src(`${kind}.go`, !own) },
      })),
    );
    const cds = ls.map(parseLabel).filter((l) => /(^|\s)(CD|Cooldown)\b/i.test(l.name) && l.params.length);
    const cdLabel = cds.find((l) => !/hold|charge/i.test(l.name)) ?? cds[0];
    const costLabel = ls.map(parseLabel).find((l) => /Energy Cost/i.test(l.name) && l.params.length);
    const cooldown = cdLabel ? seconds(param(c.name, key, cdLabel.params[0]!)[0]! * 60) : undefined;
    const energyCost = costLabel ? param(c.name, key, costLabel.params[0]!)[0] : undefined;
    return { hits, frames: hits.length ? undefined : { hitmark: 0, cancel, source: src(`${kind}.go`, !own) }, cooldown, energyCost, effects: [] as string[] };
  };
  const skill = block('skill', 'combat2');
  const burst = block('burst', 'combat3');
  if (burst.energyCost === undefined && dir) {
    const m = /EnergyMax\s*=\s*(\d+)/.exec(readFileSync(join(characterDir(dir), `${readdirSync(characterDir(dir)).find((f) => /^[a-z]+\.go$/.test(f) && !['attack.go', 'burst.go', 'skill.go', 'charge.go', 'plunge.go', 'asc.go', 'cons.go'].includes(f)) ?? 'skill.go'}`), 'utf8'));
    if (m) burst.energyCost = Number(m[1]);
  }
  const particles = dir ? particlesOf(dir) : undefined;

  // --- multiplier cross-check against gcsim tables
  const dmArrays = dir && dmFile(dir) ? goNumberArrays(dmFile(dir)!) : [];
  let checked = 0;
  let matched = 0;
  const check = (arr: number[]) => { checked++; if (hasMatchingArray(dmArrays, arr)) matched++; };
  for (const b of normalBlock) check(b.mv);
  for (const h of [...skill.hits, ...burst.hits]) check(h.mv);

  // --- KQM base stat cross-check + recommended main stats
  const slugs = [id, id.split('-')[0]!, kebab(c.name.split(' ').slice(-1)[0]!)];
  const libUrl = `https://library.keqingmains.com/characters/${element}/${id}`;
  const lib = pageText(libUrl);
  const lm = lib && /A\s*6\s+90\s+(\d+)\s+(\d+)\s+(\d+)/.exec(lib);
  const close = (a: number, b: number) => Math.abs(a - b) <= 1;
  const baseConfirmed = Boolean(lm && close(Number(lm[1]), s90.hp) && close(Number(lm[2]), s90.attack) && close(Number(lm[3]), s90.defense));
  const kqm = kqmMainStats([...new Set(slugs)]);

  const scalesHp = [...skill.hits, ...burst.hits].some((h) => h.scaling === 'hp');
  const scalesDef = [...skill.hits, ...burst.hits].some((h) => h.scaling === 'def');
  const scalesEm = [...skill.hits, ...burst.hits].some((h) => h.scaling === 'em');
  const tmpl = {
    sands: [scalesHp ? 'hp%' : scalesDef ? 'def%' : scalesEm ? 'em' : 'atk%', 'er'],
    goblet: [element ? `dmgBonus.${element}` : 'atk%'],
    circlet: ['critRate', 'critDmg'],
  };
  const mains = kqm ?? { ...tmpl, url: '', text: '' };
  if (!kqm) notes.push('main stats are a generic template (KQM quick guide row not parsed)');

  const ascStat = substatKey(c.substatText);
  const complete = estimated.length === 0 && checked > 0 && checked === matched;
  const confidence: Character['dataConfidence'] = complete && baseConfirmed ? 'high' : dir && checked > 0 && checked === matched && estimated.filter((e) => !/hitmark/.test(e)).length === 0 ? 'medium' : 'low';

  const passiveTexts = [t.passive1, t.passive2, t.passive3, t.passive4].filter(Boolean) as Array<{ name: string; description: string }>;
  const combos: Character['usualCombo'] = [
    { variant: 'off-field', actions: [{ action: 'skill' }, { action: 'burst' }] },
    { variant: 'on-field', actions: [{ action: 'skill' }, { action: 'burst' }, { action: 'normal', hits: normalBlock.length || 1, repeat: 'untilRotationEnd' }] },
  ];
  if (!burst.hits.length && !burst.frames) combos.forEach((v) => (v.actions = v.actions.filter((a) => a.action !== 'burst')));

  const kqmSources = [
    ...(baseConfirmed ? [{ site: 'keqingmains', url: libUrl, retrieved: RETRIEVED, fields: ['baseStats (Lv 90 cross-check)'], commit: undefined }] : []),
    ...(kqm ? [{ site: 'keqingmains', url: kqm.url, retrieved: RETRIEVED, fields: ['recommended main stats'], commit: undefined }] : []),
  ];

  const record = characterSchema.parse({
    id, name: c.name, rarity: c.rarity, element, weaponType, releaseVersion: c.version,
    roles: [],
    baseStats: { lv90: { hp: s90.hp, atk: s90.attack, def: s90.defense }, lv100: null },
    ascensionStat: { stat: ascStat, value: s90.specialized },
    talents: {
      normal: { hits: normalBlock },
      ...(chargedBlock ? { charged: chargedBlock } : {}),
      skill: { hits: skill.hits, frames: skill.frames, cooldown: skill.cooldown, particles },
      burst: { hits: burst.hits, frames: burst.frames, cooldown: burst.cooldown, energyCost: burst.energyCost },
    },
    passives: passiveTexts.map((p, i) => ({ id: `${id}.passive${i + 1}`, unlock: `p${i + 1}`, effects: [], text: `${p.name}: ${p.description}`.slice(0, 600) })),
    constellations: [1, 2, 3, 4, 5, 6].map((n) => ({ level: n, effects: [], text: `${db.constellations(c.name)[`c${n}`].name}: ${db.constellations(c.name)[`c${n}`].description}`.slice(0, 600) })),
    effects: [],
    usualCombo: combos,
    recommended: { weapons: [], artifacts: [], mainStats: { sands: mains.sands, goblet: mains.goblet, circlet: mains.circlet, source: kqm ? 'keqingmains' : 'template' } },
    assumptions: [
      'Baseline import: base stats and multipliers come from genshin-db; passives, constellations and special mechanics are NOT modelled (their text is kept). Only normal/charged/skill/burst damage, cooldowns, energy and particles are simulated.',
      `Multiplier tables confirmed by gcsim: ${matched}/${checked}.${baseConfirmed ? ' Lv 90 base stats confirmed by KeqingMains.' : ' Lv 90 base stats not cross-checked in a second source.'}`,
      ...(dir ? [] : ['Not in gcsim: every frame value is estimated from a same-weapon-type character.']),
      ...(estimated.length ? [`Frames estimated (gcsim source not parsed for: ${[...new Set(estimated)].join(', ')}); taken from ${donor?.id ?? 'a same-weapon-type character'} or a rough guess. Skill/burst damage is placed at a single frame and all hits of a talent are lumped at (nearly) the same time.`] : []),
      'Skill and burst are assumed to deal the character\'s element, with the standard ICD unless gcsim says ICDTagNone; hits are the talent DMG labels genshin-db lists.',
      ...(kqm ? [] : ['Main stats are a generic template, not from a source.']),
      ...notes,
    ],
    hooks: [],
    needsHook: false,
    provenance: {
      sources: [
        { site: 'genshin-db', url: GENSHIN_DB_URL, retrieved: RETRIEVED, fields: ['baseStats', 'ascensionStat', 'talent multipliers', 'passive/constellation text'] },
        ...(dir ? [{ site: 'gcsim', url: gcsimUrl(`internal/characters/${dir}`), retrieved: RETRIEVED, commit: gcsimCommit(), fields: ['frames (where parsed)', 'multiplier cross-check', 'particles', 'ICD'] }] : []),
        ...kqmSources,
      ],
      conflicts: [],
      gameVersion: GAME_VERSION,
    },
    dataConfidence: confidence,
  });
  return { record, notes: [`${id}: ${confidence}, mv ${matched}/${checked}, est ${estimated.length}, base ${baseConfirmed ? 'kqm✓' : '?'}, mains ${kqm ? 'kqm' : 'tmpl'}`] };
}
