import type { Effect } from '../../schema/effect';
import type { CharacterInput, Element, FinalStats, HitDef, Talent } from '../types';

/** What a hook can see and do. Hooks run in the schedule pass, at the frame their trigger fires. */
export interface HookApi {
  frame: number;
  cycle: number;
  owner: CharacterInput;
  effect: Effect;
  characters: CharacterInput[];
  /** The action that fired the trigger (undefined for `always`, swap and other non-action triggers). */
  action?: { name: string; talent: Talent; start: number; end: number; hitFrames: number[] };
  /** The character that acted, for `onAnyNormal` / `onAnyBurst` triggers. */
  actor?: CharacterInput;
  /** The hit that fired an `onHit` trigger (resolve pass). `action` is the action name, or the hook-hit id. */
  hitInfo?: { actor: CharacterInput; action: string; hit: HitDef; damage: number; frame: number };
  /** The effect's `value` resolved for the owner (refinement / talent level tables applied). */
  value: number;
  stats(c: CharacterInput, frame?: number): FinalStats;
  /** Queue one of the owner's `hookHits` at an absolute frame, optionally with extra flat base damage. */
  hit(id: string, frame: number, opts?: { flat?: number }): void;
  /** Apply a timed stat buff/debuff (target: character id, "enemy" or "active"). */
  buff(spec: { effectId: string; target: string; stat: string; value: number; duration: number | null; maxStacks?: number; stackMode?: 'refresh' | 'independent' }, frame?: number): void;
  /** Drop particles that the whole team can collect (same rules as skill particles). */
  particles(drop: { count: number; element: Element | 'none'; frame?: number }): void;
  /** Add flat energy (no ER) to a character. */
  energy(charId: string, amount: number, frame?: number): void;
  /** Persistent per-owner, per-hook scratch state for the whole run. */
  state: Record<string, unknown>;
  assume(text: string): void;
}

export type Hook = (api: HookApi) => void;

/** Named hooks referenced by `effect.hook` in the KB. Add one file per hook group and import it in ./index.ts. */
export const HOOKS: Record<string, Hook> = {};

export function registerHook(id: string, fn: Hook): void {
  if (HOOKS[id]) throw new Error(`hook "${id}" registered twice`);
  HOOKS[id] = fn;
}
