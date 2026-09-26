import { ATTACHABLE, Auras, EPS, type AuraKey } from './aura';
import { resMultiplier } from './damage';
import { REACTIONS } from './mechanics';
import type { CharacterInput, Element, FinalStats, HitDef, HitRecord } from './types';

/** What the reaction engine needs from the simulator. */
export interface ReactionHost {
  characters: CharacterInput[];
  /** Lunar-Charged replaces Electro-Charged (team Moonsign condition). */
  lunarCharged: boolean;
  /** A Stellar-Conduct passive is in the team: Superconduct becomes Stellar-Conduct. */
  stellarConduct: boolean;
  schedule(frame: number, run: () => void): void;
  statsFor(char: CharacterInput, frame: number): { stats: FinalStats; mods: Record<string, number> };
  /** Enemy RES for an element at a frame: base + active debuffs. */
  enemyRes(element: Element, frame: number): number;
  record(hit: HitRecord): void;
  applyEnemyBuff(effectId: string, source: string, stat: string, value: number, duration: number, frame: number): void;
  /** Timed buff on any target (character id or "enemy"). */
  applyBuff(effectId: string, source: string, target: string, stat: string, value: number, duration: number, frame: number): void;
  assume(text: string): void;
}

export interface ReactCtx {
  frame: number;
  char: CharacterInput;
  hit: HitDef;
  /** Gauge applied by this hit after ICD (0 if none). */
  gauge: number;
  cycle: number;
}

export interface ReactResult {
  /** Amplifying factor (1 = none). */
  reactionFactor: number;
  catalyzeFlat: number;
  reactions: string[];
}

const ORDER: Record<string, string[]> = {
  electro: ['hyperbloom', 'aggravate', 'overloaded', 'electroCharged', 'superconduct', 'quicken'],
  pyro: ['burgeon', 'overloaded', 'vaporize', 'melt', 'burning'],
  cryo: ['superconduct', 'melt', 'freeze'],
  hydro: ['vaporize', 'freeze', 'bloom', 'electroCharged'],
  dendro: ['spread', 'quicken', 'bloom', 'burning'],
  anemo: ['swirl'],
};

interface Core {
  expire: number;
  alive: boolean;
  owner: CharacterInput;
  cycle: number;
}

interface State {
  ctx: ReactCtx;
  gauge: number;
  amp: number;
  catalyzeFlat: number;
  reactions: string[];
  after: Array<() => void>;
}

const LEVEL_BASE = REACTIONS.levelBase.lv90;
const em = (curve: { k: number; c: number }, value: number) => (curve.k * value) / (value + curve.c);

/** Enemy aura state plus reaction resolution for one enemy (single target). */
export class ReactionEngine {
  readonly auras = new Auras();
  private gcd = new Map<string, number>();
  private cores: Core[] = [];
  private chains = { ec: false, lc: false, burning: false };
  private ecOwner?: { char: CharacterInput; cycle: number };
  private lcOwner?: { char: CharacterInput; cycle: number };
  private lcCloudEnd = -1;
  private lcSources = { hydro: new Set<CharacterInput>(), electro: new Set<CharacterInput>() };
  private polestar = { end: -1, recorded: 0, chain: 0 };
  private lastRecord = new Map<string, number>();

  constructor(private host: ReactionHost) {}

  /** Whether a Polestar Field (from Stellar-Conduct) covers `frame`. */
  polestarActive(frame: number): boolean {
    return frame < this.polestar.end;
  }

  react(ctx: ReactCtx): ReactResult {
    this.recordPolestarStack(ctx);
    const st: State = { ctx, gauge: ctx.gauge, amp: 1, catalyzeFlat: 0, reactions: [], after: [] };
    const el = ctx.hit.element;

    if (ctx.hit.strike === 'blunt') this.tryShatter(st);

    if (st.gauge > EPS) {
      for (const name of ORDER[el] ?? []) {
        if (st.gauge <= EPS) break;
        const swapped = name === 'electroCharged' && this.host.lunarCharged ? 'lunarCharged' : name === 'superconduct' && this.host.stellarConduct ? 'stellarConduct' : name;
        this.tryReaction(swapped, st);
      }
      if (st.gauge > EPS && ATTACHABLE.has(el)) {
        this.auras.attach(el as 'pyro', st.gauge, ctx.frame);
        if (el === 'hydro' || el === 'electro') this.lcSources[el].add(ctx.char);
      }
      for (const f of st.after) f();
    }
    return { reactionFactor: st.amp, catalyzeFlat: st.catalyzeFlat, reactions: st.reactions };
  }

  /**
   * Reduce each aura by gauge × factor; returns the trigger gauge consumed (the largest single
   * consumption, as in the game when several auras of one family are present).
   */
  private consume(auras: AuraKey | AuraKey[], factor: number, s: State): number {
    if (factor <= 0) return 0;
    let removed = 0;
    for (const a of Array.isArray(auras) ? auras : [auras]) {
      removed = Math.max(removed, this.auras.reduce(a, s.gauge * factor, s.ctx.frame));
    }
    const consumed = removed / factor;
    s.gauge = Math.max(0, s.gauge - consumed);
    return consumed;
  }

  private present(aura: string, frame: number): boolean {
    if (aura === 'core') return this.liveCores(frame).length > 0;
    return this.auras.get(aura as AuraKey, frame) > EPS;
  }

  private tryReaction(name: string, s: State): void {
    const def = REACTIONS.reactions[name];
    if (!def || !def.implemented) return;
    const { frame } = s.ctx;
    const trigger = s.ctx.hit.element;
    const frozen = this.auras.get('frozen', frame) > EPS;

    const pair = def.pairs.find((p) => p.trigger === trigger && this.present(p.aura, frame));
    if (!pair) return;
    const stats = () => this.host.statsFor(s.ctx.char, frame);
    const bonus = () => stats().mods[`reactionBonus.${name}`] ?? 0;

    switch (name) {
      case 'vaporize':
      case 'melt': {
        if (s.amp !== 1) return;
        if (name === 'vaporize' && frozen) return;
        this.consume(name === 'melt' && trigger === 'pyro' ? ['cryo', 'frozen'] : (pair.aura as AuraKey), pair.consume, s);
        s.amp = pair.multiplier! * (1 + em(REACTIONS.em.amplifying, stats().stats.em) + bonus());
        s.reactions.push(name);
        return;
      }
      case 'aggravate':
      case 'spread': {
        const { stats: fs } = stats();
        s.catalyzeFlat += def.multiplier! * LEVEL_BASE * (1 + em(REACTIONS.em.additive, fs.em) + bonus());
        s.reactions.push(name);
        return;
      }
      case 'quicken': {
        const consumed = this.consume(pair.aura as AuraKey, pair.consume, s);
        this.auras.attachQuicken(consumed, frame);
        s.reactions.push(name);
        if (this.auras.get('hydro', frame) > EPS) this.quickenBloom(s);
        return;
      }
      case 'stellarConduct': {
        if (frozen) return;
        this.consume(pair.aura as AuraKey, pair.consume, s);
        s.reactions.push(name);
        this.startField(def, s.ctx.char, frame);
        return;
      }
      case 'overloaded':
      case 'superconduct': {
        this.consume(pair.aura as AuraKey, pair.consume, s);
        s.reactions.push(name);
        if (this.gcdReady(name, frame, def.gcd)) {
          this.transformative(name, s.ctx.char, frame, s.ctx.cycle);
          if (def.effect) this.host.applyEnemyBuff(`reaction.${name}`, s.ctx.char.id, def.effect.stat, def.effect.value, def.effect.duration, frame);
        }
        return;
      }
      case 'swirl': {
        this.consume(pair.aura as AuraKey, pair.consume, s);
        s.reactions.push(name);
        if (this.gcdReady(`swirl-${pair.aura}`, frame, def.gcd)) {
          this.transformative(name, s.ctx.char, frame, s.ctx.cycle, pair.aura as Element);
        }
        return;
      }
      case 'bloom': {
        this.consume(trigger === 'hydro' ? ['dendro', 'quicken'] : 'hydro', pair.consume, s);
        s.reactions.push(name);
        this.spawnCore(s.ctx.char, frame, s.ctx.cycle);
        return;
      }
      case 'hyperbloom':
      case 'burgeon': {
        s.reactions.push(name);
        for (const core of this.liveCores(frame)) {
          core.alive = false;
          this.transformative(name, s.ctx.char, frame, s.ctx.cycle);
        }
        return;
      }
      case 'electroCharged': {
        if (frozen) return;
        s.reactions.push(name);
        s.after.push(() => this.startEC(s.ctx.char, s.ctx.frame, s.ctx.cycle));
        return;
      }
      case 'lunarCharged': {
        if (frozen) return;
        s.reactions.push(name);
        s.after.push(() => this.startLC(s.ctx.char, s.ctx.frame, s.ctx.cycle));
        return;
      }
      case 'burning': {
        s.reactions.push(name);
        s.after.push(() => this.startBurning(s.ctx.char, s.ctx.frame, s.ctx.cycle));
        return;
      }
      case 'freeze': {
        const aura = this.auras.get(pair.aura as AuraKey, frame);
        const m = Math.min(aura, s.gauge);
        this.auras.reduce(pair.aura as AuraKey, m, frame);
        s.gauge -= m;
        this.auras.addFrozen(2 * m, frame);
        s.reactions.push(name);
        return;
      }
    }
  }

  private tryShatter(s: State): void {
    const { frame } = s.ctx;
    if (this.auras.get('frozen', frame) <= EPS) return;
    this.auras.clear('frozen');
    s.reactions.push('shatter');
    if (this.gcdReady('shatter', frame, 6)) this.transformative('shatter', s.ctx.char, frame, s.ctx.cycle);
  }

  private gcdReady(key: string, frame: number, gcd = 0): boolean {
    if (frame < (this.gcd.get(key) ?? -1)) return false;
    this.gcd.set(key, frame + gcd);
    return true;
  }

  /** Emit transformative reaction damage: mult × levelBase × (1 + 16EM/(2000+EM) + bonus) × RES. */
  private transformative(name: string, owner: CharacterInput, frame: number, cycle: number, element?: Element, multiplier?: number): void {
    const def = REACTIONS.reactions[name]!;
    const el = (element ?? def.element) as Element;
    const { stats, mods } = this.host.statsFor(owner, frame);
    const dmg =
      (multiplier ?? def.multiplier!) * LEVEL_BASE *
      (1 + em(REACTIONS.em.transformative, stats.em) + (mods[`reactionBonus.${name}`] ?? 0)) *
      resMultiplier(this.host.enemyRes(el, frame));
    this.host.record({ cycle, frame, char: owner.id, action: name, element: el, talent: 'reaction', damage: dmg, reactions: [name] });
  }

  // --- Stellar-Conduct: Polestar Field ---
  /** Electro/Cryo applications inside the field are recorded (max `maxStacks`, one per character per `recordIcd` frames). */
  private recordPolestarStack(ctx: ReactCtx): void {
    const def = REACTIONS.reactions.stellarConduct;
    if (!def || !this.host.stellarConduct || !this.polestarActive(ctx.frame)) return;
    if (ctx.gauge <= EPS || (ctx.hit.element !== 'electro' && ctx.hit.element !== 'cryo')) return;
    if (ctx.frame - (this.lastRecord.get(ctx.char.id) ?? -Infinity) < def.recordIcd!) return;
    this.lastRecord.set(ctx.char.id, ctx.frame);
    this.polestar.recorded = Math.min(def.maxStacks!, this.polestar.recorded + 1);
  }

  private startField(def: NonNullable<(typeof REACTIONS.reactions)[string]>, owner: CharacterInput, frame: number): void {
    const wasActive = this.polestarActive(frame);
    this.polestar.end = frame + def.fieldFrames!;
    if (wasActive) return;
    this.polestar.recorded = 0;
    const chain = ++this.polestar.chain;
    const think = (t: number) => {
      if (this.polestar.chain !== chain || !this.polestarActive(t)) return;
      const stacks = this.polestar.recorded;
      this.polestar.recorded = 0;
      const value = def.buffTable![Math.min(stacks, def.buffTable!.length - 1)]!;
      for (const c of this.host.characters) {
        this.host.applyBuff('polestar.cryo', owner.id, c.id, 'dmgBonus.cryo', value, def.thinkFrames! + 1, t);
        this.host.applyBuff('polestar.electro', owner.id, c.id, 'dmgBonus.electro', value, def.thinkFrames! + 1, t);
      }
      this.host.applyEnemyBuff('polestar.shred', owner.id, def.effect!.stat, def.effect!.value, def.effect!.duration, t);
      const next = t + def.thinkFrames!;
      this.host.schedule(next, () => think(next));
    };
    think(frame);
  }

  // --- Bloom family ---
  private liveCores(frame: number): Core[] {
    return this.cores.filter((c) => c.alive && c.expire > frame);
  }

  private spawnCore(owner: CharacterInput, frame: number, cycle: number): void {
    const def = REACTIONS.reactions.bloom!;
    const core: Core = { expire: frame + def.coreDelay! + def.coreDuration!, alive: true, owner, cycle };
    this.cores = this.cores.filter((c) => c.alive && c.expire > frame);
    this.cores.push(core);
    this.host.schedule(core.expire, () => {
      if (!core.alive) return;
      core.alive = false;
      this.transformative('bloom', owner, core.expire, cycle);
    });
  }

  /** Quicken on a Hydro enemy blooms: the quicken aura is spent against Hydro at 2:1. */
  private quickenBloom(s: State): void {
    const { frame } = s.ctx;
    const avail = this.auras.get('quicken', frame);
    const removed = this.auras.reduce('hydro', avail * 2, frame);
    this.auras.reduce('quicken', removed / 2, frame);
    s.reactions.push('bloom');
    this.spawnCore(s.ctx.char, frame, s.ctx.cycle);
  }

  // --- Electro-Charged ---
  private startEC(owner: CharacterInput, frame: number, cycle: number): void {
    const def = REACTIONS.reactions.electroCharged!;
    this.ecOwner = { char: owner, cycle };
    if (this.chains.ec) return;
    this.chains.ec = true;
    this.host.schedule(frame + def.firstHitDelay!, () => this.ecHit(frame + def.firstHitDelay!));
    const tick = (f: number) => {
      if (!this.bothPresent('hydro', 'electro', f)) { this.chains.ec = false; return; }
      this.ecHit(f);
      this.host.schedule(f + def.tickFrames!, () => tick(f + def.tickFrames!));
    };
    this.host.schedule(frame + def.firstHitDelay! + def.tickFrames!, () => tick(frame + def.firstHitDelay! + def.tickFrames!));
  }

  private ecHit(f: number): void {
    const def = REACTIONS.reactions.electroCharged!;
    if (!this.bothPresent('hydro', 'electro', f) || !this.ecOwner) return;
    this.transformative('electroCharged', this.ecOwner.char, f, this.ecOwner.cycle);
    this.host.schedule(f + 6, () => {
      this.auras.reduce('hydro', def.waneUnits!, f + 6);
      this.auras.reduce('electro', def.waneUnits!, f + 6);
    });
  }

  private bothPresent(a: AuraKey, b: AuraKey, f: number): boolean {
    return this.auras.get(a, f) > EPS && this.auras.get(b, f) > EPS;
  }

  // --- Lunar-Charged ---
  private startLC(owner: CharacterInput, frame: number, cycle: number): void {
    const def = REACTIONS.reactions.lunarCharged!;
    this.lcOwner = { char: owner, cycle };
    this.lcCloudEnd = frame + def.cloudDuration!;
    if (this.chains.lc) return;
    this.chains.lc = true;
    const tick = (f: number) => {
      if (f >= this.lcCloudEnd) { this.chains.lc = false; return; }
      this.lcHit(f);
      this.host.schedule(f + def.tickFrames!, () => tick(f + def.tickFrames!));
    };
    this.host.schedule(frame + 9, () => tick(frame + 9));
  }

  private lcHit(f: number): void {
    const def = REACTIONS.reactions.lunarCharged!;
    for (const k of ['hydro', 'electro'] as const) if (this.auras.get(k, f) <= EPS) this.lcSources[k].clear();
    if (!this.bothPresent('hydro', 'electro', f) || !this.lcOwner) return;
    const contributors = new Set([...this.lcSources.hydro, ...this.lcSources.electro]);
    const parts = [...contributors].map((c) => {
      const { stats, mods } = this.host.statsFor(c, f);
      const cr = Math.min(Math.max(stats.critRate, 0), 1);
      return def.multiplier! * (1 + em(REACTIONS.em.lunar, stats.em) + (mods['reactionBonus.lunarCharged'] ?? 0)) * LEVEL_BASE * (1 + cr * stats.critDmg);
    }).sort((a, b) => b - a);
    const total = parts.reduce((sum, d, i) => sum + d * (def.contributorWeights![i] ?? 0), 0);
    const dmg = total * resMultiplier(this.host.enemyRes('electro', f));
    this.host.record({ cycle: this.lcOwner.cycle, frame: f, char: this.lcOwner.char.id, action: 'lunarCharged', element: 'electro', talent: 'reaction', damage: dmg, reactions: ['lunarCharged'] });
    this.auras.reduce('hydro', 0.4, f);
    this.auras.reduce('electro', 0.4, f);
  }

  // --- Burning ---
  private startBurning(owner: CharacterInput, frame: number, cycle: number): void {
    const def = REACTIONS.reactions.burning!;
    if (this.chains.burning) return;
    this.chains.burning = true;
    const tick = (f: number) => {
      const fuel = this.auras.get('dendro', f) > EPS || this.auras.get('quicken', f) > EPS;
      if (this.auras.get('pyro', f) <= EPS || !fuel) { this.chains.burning = false; return; }
      this.transformative('burning', owner, f, cycle);
      this.host.schedule(f + def.tickFrames!, () => tick(f + def.tickFrames!));
    };
    this.host.schedule(frame + def.tickFrames!, () => tick(frame + def.tickFrames!));
  }
}
