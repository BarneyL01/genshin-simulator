import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Local gcsim clone (reference only; AGPL-3.0, never copy its code). Created by `npm run kb:fetch-gcsim`. */
export const GCSIM_DIR = process.env.GCSIM_DIR ?? resolve(import.meta.dirname, '..', '..', '.cache', 'gcsim');

export function gcsimCommit(): string {
  if (!existsSync(GCSIM_DIR)) throw new Error(`gcsim clone not found at ${GCSIM_DIR}. Run: npm run kb:fetch-gcsim`);
  return execSync('git rev-parse HEAD', { cwd: GCSIM_DIR }).toString().trim();
}

export const gcsimUrl = (relPath: string) => `https://github.com/genshinsim/gcsim/blob/${gcsimCommit()}/${relPath}`;

/**
 * All arrays of exactly `len` numbers found in a Go file (generated `zz_*.dm.go` talent tables).
 * Used only to cross-check numbers, never to copy code.
 */
export function goNumberArrays(file: string, len = 15): number[][] {
  const src = readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, '');
  const out: number[][] = [];
  for (const m of src.matchAll(/\{([^{}]*)\}/g)) {
    const nums = m[1]!.split(',').map((s) => s.trim()).filter(Boolean);
    if (nums.length !== len) continue;
    const vals = nums.map(Number);
    if (vals.every((v) => Number.isFinite(v))) out.push(vals);
  }
  return out;
}

export function characterDir(dir: string): string {
  return join(GCSIM_DIR, 'internal', 'characters', dir);
}

export function dmFile(dir: string): string | undefined {
  const d = characterDir(dir);
  return readdirSync(d).map((f) => join(d, f)).find((f) => /zz_.*\.dm\.go$/.test(f));
}

export const near = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * tol + 1e-9;

/** True when some gcsim array matches `values` at every level within `tol`. */
export function hasMatchingArray(arrays: number[][], values: number[], tol = 0.005): boolean {
  return arrays.some((arr) => arr.length === values.length && arr.every((v, i) => near(v, values[i]!, tol)));
}
