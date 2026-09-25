import { CONSTANTS } from './mechanics';
import type { CharacterInput, Element } from './types';

export interface ParticleDrop {
  frame: number;
  count: number;
  element: Element | 'none';
  cycle: number;
}

interface PerCycle {
  particleBase: Map<number, number>;
  particleActual: Map<number, number>;
  flat: Map<number, number>;
}

const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/**
 * Energy per character. Particles are distributed to the whole team when they are collected:
 * same element 3, colourless 2, other element 1 (× count), off-field × (1 − 0.1 × party size),
 * then × ER. Energy is capped at the burst cost. Drops are processed lazily in frame order.
 */
export class EnergyTracker {
  private energy = new Map<string, number>();
  readonly max = new Map<string, number>();
  private drops: ParticleDrop[] = [];
  private stats = new Map<string, PerCycle>();
  readonly shortfalls = new Map<string, number>();

  constructor(
    private chars: CharacterInput[],
    private activeAt: (frame: number) => string | undefined,
    private erAt: (c: CharacterInput, frame: number) => number,
    startFull: boolean,
  ) {
    for (const c of chars) {
      const cost = c.actions.burst?.energyCost ?? 0;
      if (cost <= 0) continue;
      this.max.set(c.id, cost);
      this.energy.set(c.id, startFull ? cost : 0);
      this.stats.set(c.id, { particleBase: new Map(), particleActual: new Map(), flat: new Map() });
    }
  }

  addDrop(d: ParticleDrop): void {
    if (d.count > 0) this.drops.push(d);
  }

  /** Process every particle drop up to and including `frame`. */
  advance(frame: number): void {
    const due = this.drops.filter((d) => d.frame <= frame).sort((a, b) => a.frame - b.frame);
    if (due.length === 0) return;
    this.drops = this.drops.filter((d) => d.frame > frame);
    const { particle } = CONSTANTS.energy;
    for (const d of due) {
      const active = this.activeAt(d.frame);
      for (const c of this.chars) {
        const max = this.max.get(c.id);
        if (max === undefined) continue;
        const ratio = active === c.id ? 1 : 1 - CONSTANTS.energy.offFieldPenaltyPerPartyMember * this.chars.length;
        const per = d.element === 'none' ? particle.neutral : d.element === c.element ? particle.sameElement : particle.otherElement;
        const base = per * ratio * d.count;
        const actual = base * this.erAt(c, d.frame);
        this.energy.set(c.id, Math.min(max, (this.energy.get(c.id) ?? 0) + actual));
        const st = this.stats.get(c.id)!;
        add(st.particleBase, d.cycle, base);
        add(st.particleActual, d.cycle, actual);
      }
    }
  }

  addFlat(charId: string, amount: number, frame: number, cycle: number): void {
    this.advance(frame);
    const max = this.max.get(charId);
    if (max === undefined) return;
    this.energy.set(charId, Math.min(max, (this.energy.get(charId) ?? 0) + amount));
    add(this.stats.get(charId)!.flat, cycle, amount);
  }

  /** Spend burst energy. Returns false (and records a shortfall) when there was not enough. */
  spend(charId: string, cost: number, frame: number): { ok: boolean; had: number } {
    this.advance(frame);
    const had = this.energy.get(charId) ?? 0;
    const ok = had + 1e-9 >= cost;
    if (!ok) this.shortfalls.set(charId, (this.shortfalls.get(charId) ?? 0) + 1);
    this.energy.set(charId, Math.max(0, had - cost));
    return { ok, had };
  }

  /** Average per-cycle totals over `cycles` (the measured cycle numbers). */
  perCycle(charId: string, cycles: number[]) {
    const st = this.stats.get(charId);
    const avg = (m: Map<number, number> | undefined) =>
      cycles.length === 0 || !m ? 0 : cycles.reduce((s, c) => s + (m.get(c) ?? 0), 0) / cycles.length;
    return { particleBase: avg(st?.particleBase), particleActual: avg(st?.particleActual), flat: avg(st?.flat) };
  }
}
