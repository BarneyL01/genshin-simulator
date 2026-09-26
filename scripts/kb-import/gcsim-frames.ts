import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { characterDir } from './gcsim';

/**
 * Best-effort extraction of frame numbers from a gcsim character directory (numbers only; no code is copied).
 * Anything it cannot read comes back undefined and the caller estimates it and lowers the confidence.
 */

const read = (dir: string, file: string) => {
  const p = join(characterDir(dir), file);
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/\/\/[^\n]*/g, '') : '';
};

/** Integer constants declared in the directory's files (`name = 12`, `name = 42 + 3`). */
export function constants(dir: string): Map<string, number> {
  const map = new Map<string, number>();
  const files = readdirSync(characterDir(dir)).filter((f) => f.endsWith('.go') && !f.startsWith('zz_'));
  const src = files.map((f) => read(dir, f)).join('\n');
  const re = /^\s*(?:const\s+|var\s+)?([a-zA-Z_]\w*)\s*(?::?=)\s*([0-9][0-9\s+\-*()a-zA-Z_.]*?)\s*(?:\/\/.*)?$/gm;
  for (let pass = 0; pass < 3; pass++) {
    for (const m of src.matchAll(re)) {
      const v = evalInt(m[2]!, map);
      if (v !== undefined && !map.has(m[1]!)) map.set(m[1]!, v);
    }
  }
  return map;
}

export function evalInt(expr: string, consts: Map<string, number>): number | undefined {
  const e = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (n) => (consts.has(n) ? String(consts.get(n)) : 'NaN'));
  if (!/^[0-9+\-*()\s.NaN]+$/.test(e) || e.includes('NaN')) return undefined;
  try {
    const v = Function(`"use strict";return (${e})`)() as number;
    return Number.isFinite(v) ? Math.round(v) : undefined;
  } catch {
    return undefined;
  }
}

/** Text of a balanced `{...}` starting at `open` (index of the `{`). */
function braced(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return '';
}

/** `name = [][]int{{12},{8},{11,18}}` → number[][]; `[]int{12,33}` → [[12,33]]. */
export function intTable(src: string, name: string, consts: Map<string, number>): number[][] | undefined {
  const m = new RegExp(`\\b${name}\\s*(?:=|:=)\\s*\\[\\](\\[\\])?int\\s*\\{`).exec(src);
  if (!m) return undefined;
  const inner = braced(src, m.index + m[0].length - 1);
  const to = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => evalInt(x, consts));
  if (m[1]) {
    const rows: number[][] = [];
    for (const r of inner.matchAll(/\{([^{}]*)\}/g)) {
      const v = to(r[1]!);
      if (v.some((x) => x === undefined)) return undefined;
      rows.push(v as number[]);
    }
    return rows.length ? rows : undefined;
  }
  const v = to(inner);
  return v.length && v.every((x) => x !== undefined) ? [v as number[]] : undefined;
}

const KEY: Record<string, string> = {
  ActionAttack: 'normal', ActionCharge: 'charged', ActionSkill: 'skill', ActionBurst: 'burst',
  ActionDash: 'dash', ActionJump: 'jump', ActionSwap: 'swap', ActionAim: 'aim', ActionLowPlunge: 'plunge', ActionHighPlunge: 'plunge',
};

export interface CancelInfo {
  cancel: Record<string, number>;
  /** Animation length used as `default`. */
  animation: number;
}

/** Overrides `<var>[...][action.ActionX] = N` for one slice variable (optionally a specific row). */
function overrides(src: string, variable: string, row: number | undefined, consts: Map<string, number>, tables: Map<string, number[][]>): Record<string, number> {
  const out: Record<string, number> = {};
  const re = row === undefined
    ? new RegExp(`\\b${variable}\\[action\\.(\\w+)\\]\\s*=\\s*([^\\n;]+)`, 'g')
    : new RegExp(`\\b${variable}\\[${row}\\]\\[action\\.(\\w+)\\]\\s*=\\s*([^\\n;]+)`, 'g');
  for (const m of src.matchAll(re)) {
    const k = KEY[m[1]!];
    const v = evalWithTables(m[2]!.trim(), consts, tables);
    if (k && v !== undefined) out[k] = v;
  }
  return out;
}

/** evalInt that also resolves `table[i][j]` / `table[i]` references. */
function evalWithTables(expr: string, consts: Map<string, number>, tables: Map<string, number[][]>): number | undefined {
  const e = expr.replace(/\b(\w+)((?:\[\d+\])+)/g, (whole, name: string, idx: string) => {
    const t = tables.get(name);
    if (!t) return whole;
    const ix = [...idx.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
    const v = ix.length === 2 ? t[ix[0]!]?.[ix[1]!] : t[0]?.[ix[0]!] ?? t[ix[0]!]?.[0];
    return v === undefined ? 'NaN' : String(v);
  });
  return evalInt(e, consts);
}

export interface CharFrames {
  /** Normal attack steps: hitmarks per step and cancels (with `default` = animation). */
  normal?: Array<{ hitmarks: number[]; cancel: Record<string, number> & { default: number } }>;
  charged?: { hitmarks: number[]; cancel: Record<string, number> & { default: number } };
  skill?: { hitmark?: number; cancel: Record<string, number> & { default: number } };
  burst?: { hitmark?: number; cancel: Record<string, number> & { default: number } };
  notes: string[];
}

export function extractFrames(dir: string): CharFrames {
  const consts = constants(dir);
  const notes: string[] = [];
  const out: CharFrames = { notes };

  // --- normal attacks
  const atk = read(dir, 'attack.go');
  const tables = new Map<string, number[][]>();
  for (const name of ['attackHitmarks', 'attackHitmark']) {
    const t = intTable(atk, name, consts);
    if (t) tables.set(name, t);
  }
  const hitmarks = tables.get('attackHitmarks') ?? tables.get('attackHitmark');
  const steps: NonNullable<CharFrames['normal']> = [];
  for (const m of atk.matchAll(/attackFrames\[(\d+)\]\s*=\s*frames\.InitNormalCancelSlice\(\s*([^,]+),\s*([^)]+)\)/g)) {
    const i = Number(m[1]);
    const earliest = evalWithTables(m[2]!.trim(), consts, tables);
    const anim = evalWithTables(m[3]!.trim(), consts, tables);
    if (earliest === undefined || anim === undefined) continue;
    const hm = hitmarks?.[i] ?? (hitmarks?.length === 1 ? hitmarks[0]!.slice(i, i + 1) : undefined) ?? [earliest];
    const over = overrides(atk, 'attackFrames', i, consts, tables);
    const cancel: Record<string, number> = { normal: anim, charged: anim, ...Object.fromEntries(['skill', 'burst', 'dash', 'jump', 'swap'].map((k) => [k, earliest])), ...over };
    steps[i] = { hitmarks: hm, cancel: { ...cancel, default: anim } };
  }
  if (steps.length && steps.every(Boolean)) out.normal = steps;
  else notes.push('normal attack frames not parsed');

  // --- charged attack
  const ch = read(dir, 'charge.go');
  const chTables = new Map<string, number[][]>();
  for (const name of ['chargeHitmarks', 'chargeHitmark']) {
    const t = intTable(ch, name, consts);
    if (t) chTables.set(name, t);
  }
  const chHit = chTables.get('chargeHitmarks')?.[0] ?? (consts.has('chargeHitmark') ? [consts.get('chargeHitmark')!] : consts.has('chargeHitmarks') ? [consts.get('chargeHitmarks')!] : undefined);
  const chAnim = /chargeFrames\s*=\s*frames\.InitAbilSlice\(\s*([^)]+)\)/.exec(ch);
  if (chHit && chAnim) {
    const animation = evalInt(chAnim[1]!, consts);
    if (animation !== undefined) {
      const over = overrides(ch, 'chargeFrames', undefined, consts, chTables);
      out.charged = { hitmarks: chHit, cancel: { ...over, default: animation } };
    }
  }

  // --- skill / burst
  for (const [kind, file, varName] of [['skill', 'skill.go', 'skillFrames'], ['burst', 'burst.go', 'burstFrames']] as const) {
    const s = read(dir, file);
    const m = new RegExp(`${varName}\\s*=\\s*frames\\.InitAbilSlice\\(\\s*([^)]+)\\)`).exec(s);
    if (!m) {
      notes.push(`${kind} frames not parsed`);
      continue;
    }
    const animation = evalInt(m[1]!, consts);
    if (animation === undefined) {
      notes.push(`${kind} frames not parsed`);
      continue;
    }
    const over = overrides(s, varName, undefined, consts, new Map());
    const hm = ['skillHitmark', 'skillPressHitmark', 'skillPressHitmarks', 'skillHitmarks', 'burstHitmark', 'burstHitmarks', 'burstStart']
      .filter((n) => n.startsWith(kind))
      .map((n) => consts.get(n) ?? intTable(s, n, consts)?.[0]?.[0])
      .find((v) => v !== undefined);
    out[kind] = { hitmark: hm, cancel: { ...over, default: animation } };
  }
  return out;
}
