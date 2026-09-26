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
  hitInfo?: { actor: CharacterInput; action: string; hit: HitDef; damage: number; frame: number; /** The hit applied its element (passed ICD, gauge > 0). */ applied: boolean };
  /** The reaction that fired an `onReaction` trigger (resolve pass). */
  reaction?: { name: string; actor: CharacterInput; frame: number };
  /** Whether a Polestar Field (Stellar-Conduct) is up at `frame` (resolve pass state; before it, always false). */
  polestarActive(frame?: number): boolean;
  /** Run `fn` at `frame` in the resolve pass, in frame order with hits and reactions. Available from any pass. */
  later(frame: number, fn: () => void): void;
  /** Register a function that may rewrite every hit right before it is resolved (e.g. Radiance conversions). */
  transformHit(fn: (h: { char: CharacterInput; hit: HitDef; action: string; frame: number }) => HitDef | undefined): void;
  /** The effect's `value` resolved for the owner (refinement / talent level tables applied). */
  value: number;
  /** The on-field character at `frame` (the one whose action started last). */
  activeAt(frame?: number): string | undefined;
  /** Multiplier of one of the owner's hook hits (at the owner's talent levels). */
  hitMv(hookHitId: string): number;
  /** Resolved `value` of another effect of the owner (refinement / talent level tables applied). */
  valueOf(effectId: string): number;
  stats(c: CharacterInput, frame?: number): FinalStats;
  /** Queue one of the owner's `hookHits` at an absolute frame, optionally with extra flat base damage. The returned handle cancels the hit if it has not happened yet (e.g. a construct being replaced). */
  hit(id: string, frame: number, opts?: { flat?: number; override?: Partial<HitDef>; skipIf?: () => boolean }): { cancel(): void };
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
