import type { BuffRecord } from './types';

export interface BuffSpec {
  effectId: string;
  source: string;
  /** Character id, "enemy", or "active" (applies to whoever is attacking). */
  target: string;
  stat: string;
  value: number;
  duration: number | null;
  maxStacks: number;
  stackMode: 'refresh' | 'independent';
}

/**
 * Tracks effect instances as timeline records. Every stack change closes the current segment and
 * opens a new one, so `records` can be drawn directly as a Gantt. Queries are pure over the
 * records, so they may be made at any frame (hits are evaluated after the schedule is built).
 * Applications must be made in non-decreasing frame order.
 *  - refresh (default): one instance per effect+source+target; a new application adds a stack and refreshes the duration.
 *  - independent: each application has its own timer; the oldest is dropped at max stacks.
 */
export class BuffManager {
  readonly records: BuffRecord[] = [];

  apply(spec: BuffSpec, frame: number): void {
    const end = spec.duration === null ? null : frame + spec.duration;
    const same = this.records.filter(
      (r) => r.effectId === spec.effectId && r.source === spec.source && r.target === spec.target && this.isLive(r, frame),
    );
    if (spec.stackMode === 'independent') {
      if (same.length >= spec.maxStacks) same[0]!.end = frame;
      this.open(spec, 1, frame, end);
      return;
    }
    const cur = same[0];
    if (cur) {
      cur.end = frame;
      this.open(spec, Math.min(spec.maxStacks, cur.stacks + 1), frame, end);
    } else {
      this.open(spec, 1, frame, end);
    }
  }

  /** Sum of active stat values (value × stacks) affecting `char` at `frame`, keyed by stat. */
  modsFor(char: string, frame: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.records) {
      if ((r.target !== char && r.target !== 'active') || !this.isLive(r, frame)) continue;
      out[r.stat] = (out[r.stat] ?? 0) + r.value * r.stacks;
    }
    return out;
  }

  /** Debuffs on the enemy (res shred etc.) at `frame`. */
  enemyMods(frame: number): Record<string, number> {
    return this.modsFor('enemy', frame);
  }

  private isLive(r: BuffRecord, frame: number): boolean {
    return r.start <= frame && (r.end === null || r.end > frame);
  }

  private open(spec: BuffSpec, stacks: number, start: number, end: number | null): void {
    this.records.push({
      effectId: spec.effectId, source: spec.source, target: spec.target, stat: spec.stat,
      value: spec.value, stacks, start, end,
    });
  }
}
