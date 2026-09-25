import { REACTIONS } from './mechanics';

export const EPS = 1e-6;

export type AuraKey = 'pyro' | 'hydro' | 'cryo' | 'electro' | 'dendro' | 'quicken' | 'frozen';
export const ATTACHABLE = new Set<string>(['pyro', 'hydro', 'cryo', 'electro', 'dendro']);

interface AuraState {
  amount: number;
  /** Gauge units lost per frame. */
  rate: number;
  at: number;
}

/**
 * Elemental auras on the enemy, in gauge units (U). Decay is applied lazily, so calls must be
 * made with non-decreasing frames. Coexisting auras (Hydro+Electro, Pyro+Dendro, Quicken+Dendro...)
 * are simply independent entries; reactions consume them.
 */
export class Auras {
  private s = new Map<AuraKey, AuraState>();

  get(k: AuraKey, frame: number): number {
    const st = this.s.get(k);
    if (!st) return 0;
    const amt = st.amount - st.rate * (frame - st.at);
    if (amt <= EPS) {
      this.s.delete(k);
      return 0;
    }
    return amt;
  }

  private sync(k: AuraKey, frame: number): AuraState | undefined {
    const amt = this.get(k, frame);
    const st = this.s.get(k);
    if (!st || amt <= 0) return undefined;
    st.amount = amt;
    st.at = frame;
    return st;
  }

  /** Remove up to `by` gauge; returns the amount actually removed. */
  reduce(k: AuraKey, by: number, frame: number): number {
    const st = this.sync(k, frame);
    if (!st || by <= 0) return 0;
    const r = Math.min(st.amount, by);
    st.amount -= r;
    if (st.amount <= EPS) this.s.delete(k);
    return r;
  }

  clear(k: AuraKey): void {
    this.s.delete(k);
  }

  /** Set an aura that decays to zero over `durationFrames`. */
  set(k: AuraKey, amount: number, durationFrames: number, frame: number): void {
    this.s.set(k, { amount, rate: amount / durationFrames, at: frame });
  }

  /**
   * Apply `gauge` units (before aura tax) of an element as an aura.
   *  - Pyro: refreshes duration when the new amount is at least the current one.
   *  - Others: refill up to the new amount, keeping the existing decay rate.
   */
  attach(k: 'pyro' | 'hydro' | 'cryo' | 'electro' | 'dendro', gauge: number, frame: number): void {
    const { tax, decayBaseSeconds, decayPerUnitSeconds } = REACTIONS.aura;
    const amt = tax * gauge;
    const frames = 60 * (decayBaseSeconds + decayPerUnitSeconds * gauge);
    const cur = this.sync(k, frame);
    if (k === 'pyro') {
      if (!cur || amt >= cur.amount) this.set(k, amt, frames, frame);
    } else if (!cur) {
      this.set(k, amt, frames, frame);
    } else if (amt > cur.amount) {
      cur.amount = amt;
    }
  }

  /** Quicken (refresh rule): duration is 300 frames per unit + 360. */
  attachQuicken(amount: number, frame: number): void {
    const cur = this.sync('quicken', frame);
    if (!cur || amount >= cur.amount) this.set('quicken', amount, 300 * amount + 360, frame);
  }

  /** Frozen: simplified, 150 frames per unit, no decay ramp. */
  addFrozen(amount: number, frame: number): void {
    const cur = this.sync('frozen', frame);
    const total = (cur?.amount ?? 0) + amount;
    this.set('frozen', total, 150 * total, frame);
  }
}
