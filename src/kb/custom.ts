import type { RotationItem, RotationStep } from '../engine';
import type { Character } from '../schema/character';
import { FPS } from '../engine';
import type { KbData } from './data';
import type { MemberSpec } from './build';
import type { RunInput } from './run';

export interface CustomTeam {
  /** Four character ids in the order they act. */
  order: string[];
  /** Chosen `usualCombo` variant per character (default: the first). */
  variants?: Record<string, string>;
  /** Rotation length in seconds; default = the longest skill/burst cooldown used by the chosen combos. */
  lengthSeconds?: number;
}

export interface CustomRotation {
  script: RotationItem[];
  lengthFrames: number;
  notes: string[];
}

/** Cooldown (frames) of a skill/burst/extra action, from the KB. */
function cooldownOf(c: Character, action: string): number {
  if (action === 'skill') return c.talents.skill?.cooldown ?? 0;
  if (action === 'burst') return c.talents.burst?.cooldown ?? 0;
  return c.extraActions[action]?.cooldown ?? 0;
}

/**
 * Mode B: chain each character's usual combo, in the chosen order, into one rotation. Combos that
 * repeat "until the rotation ends" fill the time left until the rotation length. The user can edit
 * the resulting script afterwards.
 */
export function buildCustomRotation(kb: KbData, team: CustomTeam): CustomRotation {
  const notes: string[] = [];
  const chars = team.order.map((id) => {
    const c = kb.characters.get(id);
    if (!c) throw new Error(`unknown character "${id}"`);
    return c;
  });
  const variantOf = (c: Character) => {
    const want = team.variants?.[c.id];
    const v = c.usualCombo.find((x) => x.variant === want) ?? c.usualCombo[0];
    if (!v) throw new Error(`${c.id} has no usualCombo`);
    if (want && v.variant !== want) notes.push(`${c.id}: variant "${want}" not found, using "${v.variant}"`);
    return v;
  };

  let longest = 0;
  for (const c of chars) for (const a of variantOf(c).actions) longest = Math.max(longest, cooldownOf(c, a.action));
  const lengthFrames = team.lengthSeconds ? Math.round(team.lengthSeconds * FPS) : Math.max(longest, 10 * FPS);

  const script: RotationItem[] = [];
  for (const c of chars) {
    for (const a of variantOf(c).actions) {
      if (a.action !== 'normal') {
        script.push({ char: c.id, action: a.action });
        continue;
      }
      const seq: RotationStep[] = Array.from({ length: a.hits ?? 1 }, (_, i) => ({ char: c.id, action: `n${i + 1}` }));
      if (a.then) seq.push({ char: c.id, action: a.then });
      if (a.repeat === undefined) script.push(...seq);
      else if (typeof a.repeat === 'number') script.push({ repeat: { times: a.repeat }, steps: seq });
      else {
        if (a.repeat === 'untilBurstEnd') notes.push(`${c.id}: "untilBurstEnd" is treated as "untilRotationEnd"`);
        script.push({ repeat: { untilCycleTime: lengthFrames }, steps: seq });
      }
    }
  }
  return { script, lengthFrames, notes };
}

/** A custom team as a run input: recommended weapons, sets and main stats for each character. */
export function customRunInput(kb: KbData, team: CustomTeam): RunInput & { notes: string[] } {
  const rot = buildCustomRotation(kb, team);
  const members: MemberSpec[] = team.order.map((id) => {
    const c = kb.characters.get(id)!;
    return {
      character: id,
      weapons: c.recommended.weapons.map((w) => w.id),
      sets: c.recommended.artifacts[0]?.sets ?? {},
    };
  });
  return { label: 'Custom team (custom rotation)', members, rotation: rot.script, notes: rot.notes };
}
