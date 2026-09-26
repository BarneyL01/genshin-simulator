import { SCALING_SOURCES, TARGET_SCALING_SOURCES, type Effect, type EffectValue } from '../schema/effect';
import { BuffManager } from './buffs';
import { calcHitDamage } from './damage';
import { EnergyTracker } from './energy';
import { HOOKS, type HookApi } from './hooks';
import { CONSTANTS, ICD } from './mechanics';
import { EXECUTION_PROFILES, FPS, type ExecutionProfile } from './profiles';
import { ReactionEngine } from './reactions';
import { resolveStats, sumMods } from './stats';
import type {
  DynamicScaling, ActionDef, ActionRecord, CharacterInput, EnemyInput, EnergyReport, HitDef, HitRecord, RotationStep, SimResult, Talent,
} from './types';

export const SWAP_COOLDOWN = CONSTANTS.swapCooldownFrames;

export interface SimInput {
  characters: CharacterInput[];
  enemy: EnemyInput;
  rotation: RotationStep[];
  /** Rotation repetitions. Cycle 1 is warm-up; DPS is measured over cycles 2..N (cycle 1 if N = 1). */
  cycles: number;
  profile: ExecutionProfile;
  /** Team has the Lunar-Charged (Moonsign) condition: Hydro + Electro produce Lunar-Charged instead of Electro-Charged. */
  lunarCharged?: boolean;
  /** Burst energy at the start of cycle 1. Default 'full'. */
  startEnergy?: 'full' | 'empty';
}

const TALENT_TRIGGER: Record<Talent, string> = {
  normal: 'onNormal', charged: 'onCharged', plunge: 'onPlunge', skill: 'onSkill', burst: 'onBurst',
};

const INFUSIONS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'] as const;
const actionKind = (name: string): string => (/^n\d+$/.test(name) ? 'normal' : name);

const addMods = (a: Record<string, number>, b: Record<string, number>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
};

interface PendingHit {
  cycle: number;
  frame: number;
  char: CharacterInput;
  action: string;
  hit: HitDef;
}

/**
 * 1. Schedule: walk the rotation computing each action's start (previous cancel + execution-profile
 *    delay, swap rules, cooldown waits), spend burst energy, apply triggered effects, queue hits and
 *    particle drops.
 * 2. Resolve: process hits and reaction follow-ups in frame order. Each hit passes through ICD, the
 *    enemy aura/reaction engine, then the damage formula against the buff timeline.
 * Simplifications (docs/SIMULATION.md): effects trigger at action start, values are computed at
 * application time, conditions are ignored (and listed in `assumptions`).
 */
export function simulate(input: SimInput): SimResult {
  const { characters, enemy, rotation, cycles, profile } = input;
  const byId = new Map(characters.map((c) => [c.id, c]));
  const bm = new BuffManager();
  const assumptions = new Set<string>();
  const actions: ActionRecord[] = [];
  const pending: PendingHit[] = [];
  let cycle = 1;
  /** True during the resolve pass: hooks then queue hits directly on the event queue. */
  let resolving = false;
  let queueHit: (p: PendingHit) => void = () => undefined;

  const activeAt = (frame: number): string | undefined => {
    for (let i = actions.length - 1; i >= 0; i--) if (actions[i]!.start <= frame) return actions[i]!.char;
    return undefined;
  };
  /**
   * Stat modifiers for `c` at `frame`: base mods + static buffs, then dynamic-scaling buffs in
   * application order. A dynamic buff reads its owner's stats; for the owner itself that is the
   * accumulated mods so far (so effects can chain, but not depend on themselves).
   */
  const modsAt = (c: CharacterInput, frame: number, depth = 0): Record<string, number> => {
    const isActive = activeAt(frame) === c.id;
    const mods = sumMods([...c.baseMods, ...Object.entries(bm.modsFor(c.id, frame, isActive)).map(([stat, value]) => ({ stat, value }))]);
    for (const r of bm.dynamicFor(c.id, frame, isActive)) {
      const d = r.dynamic!;
      const owner = byId.get(r.source);
      if (!owner) continue;
      let src: Record<string, number> | undefined = owner === c ? mods : depth < 2 ? modsAt(owner, frame, depth + 1) : undefined;
      src ??= sumMods(owner.baseMods);
      const stats = resolveStats(owner.base, owner.weaponAtk, src);
      const s = d.from === 'energyMax' ? (c.actions.burst?.energyCost ?? 0) : stats[d.from as keyof typeof stats];
      let v = d.base + d.ratio * s;
      if (d.cap !== undefined) v = Math.min(v, d.cap);
      if (d.capFrom) v = Math.min(v, d.capFrom.ratio * stats[d.capFrom.from as keyof typeof stats]);
      mods[r.stat] = (mods[r.stat] ?? 0) + v * r.stacks;
    }
    return mods;
  };
  const statsFor = (c: CharacterInput, frame: number) => {
    const mods = modsAt(c, frame);
    return { stats: resolveStats(c.base, c.weaponAtk, mods), mods };
  };

  const energy = new EnergyTracker(characters, activeAt, (c, f) => statsFor(c, f).stats.er, (input.startEnergy ?? 'full') === 'full');

  const hookState = new Map<string, Record<string, unknown>>();
  function runHook(owner: CharacterInput, e: Effect, frame: number, action?: HookApi['action'], ctx: { actor?: CharacterInput; hitInfo?: HookApi['hitInfo']; cycle?: number } = {}): void {
    const hook = HOOKS[e.hook!];
    if (!hook) {
      assumptions.add(`${e.id}: hook "${e.hook}" not implemented, effect skipped`);
      return;
    }
    if (e.condition) assumptions.add(`${e.id}: condition ignored (assumed met)${e.assumption ? ` — ${e.assumption}` : ''}`);
    const key = `${owner.id}|${e.hook}`;
    if (!hookState.has(key)) hookState.set(key, {});
    const hookCycle = ctx.cycle ?? cycle;
    hook({
      frame, cycle: hookCycle, owner, effect: e, characters, action, actor: ctx.actor, hitInfo: ctx.hitInfo,
      value: e.value === undefined ? 0 : resolveScalar(owner, e.value),
      stats: (c, f = frame) => statsFor(c, f).stats,
      hit: (id, f, opts) => {
        const h = owner.hookHits[id];
        if (!h) throw new Error(`${owner.id}: no hookHit "${id}"`);
        const p: PendingHit = { cycle: hookCycle, frame: f, char: owner, action: id, hit: { ...h, frame: f, flat: (h.flat ?? 0) + (opts?.flat ?? 0) } };
        if (resolving) queueHit(p);
        else pending.push(p);
      },
      buff: (b, f = frame) =>
        bm.apply({ effectId: b.effectId, source: owner.id, target: b.target, stat: b.stat, value: b.value, duration: b.duration, maxStacks: b.maxStacks ?? 1, stackMode: b.stackMode ?? 'refresh' }, f),
      particles: (d) => energy.addDrop({ frame: d.frame ?? frame + CONSTANTS.particleDelayFrames, count: d.count, element: d.element, cycle: hookCycle }),
      energy: (id, amount, f = frame) => energy.addFlat(id, amount, f, hookCycle),
      state: hookState.get(key)!,
      assume: (t) => assumptions.add(t),
    });
  }

  const resolveScalar = (owner: CharacterInput, v: EffectValue): number => {
    if (typeof v === 'number') return v;
    if ('perRefinement' in v) return v.perRefinement[owner.refinement - 1] ?? 0;
    const lvl = owner.talentLevels[{ normal: 0, skill: 1, burst: 2 }[v.talent ?? 'burst']];
    return v.perTalentLevel[Math.min(lvl ?? 9, v.perTalentLevel.length) - 1] ?? 0;
  };

  function applyEffect(owner: CharacterInput, e: Effect, triggerFrame: number, action?: HookApi['action'], actor?: CharacterInput): void {
    const frame = triggerFrame + (e.delay ?? 0);
    if (e.hook) {
      runHook(owner, e, frame, action, { actor });
      return;
    }
    if (e.condition) assumptions.add(`${e.id}: condition ignored (assumed met)${e.assumption ? ` — ${e.assumption}` : ''}`);
    const scalar = (v: EffectValue) => resolveScalar(owner, v);
    let value = 0;
    let dynamic: DynamicScaling | undefined;
    if (e.scaling) {
      const [who, stat] = e.scaling.from.split('.');
      const okSource = who === 'self' ? (SCALING_SOURCES as readonly string[]).includes(stat ?? '') : who === 'target' && (TARGET_SCALING_SOURCES as readonly string[]).includes(stat ?? '');
      if (!okSource) {
        assumptions.add(`${e.id}: unsupported scaling source "${e.scaling.from}", effect skipped`);
        return;
      }
      dynamic = {
        from: stat!, ratio: scalar(e.scaling.ratio), base: e.scaling.base === undefined ? 0 : scalar(e.scaling.base),
        cap: e.scaling.cap === undefined ? undefined : scalar(e.scaling.cap),
        capFrom: e.scaling.capFrom && (SCALING_SOURCES as readonly string[]).includes(e.scaling.capFrom.from) ? e.scaling.capFrom : undefined,
      };
      if (who === 'target' && e.snapshot) {
        assumptions.add(`${e.id}: snapshot is not supported for target-scaled effects; evaluated at hit time`);
      } else if (e.snapshot) {
        const st = statsFor(owner, frame).stats;
        value = Math.min(dynamic.base + dynamic.ratio * st[dynamic.from as keyof typeof st], dynamic.cap ?? Infinity, dynamic.capFrom ? dynamic.capFrom.ratio * st[dynamic.capFrom.from as keyof typeof st] : Infinity);
        dynamic = undefined;
      }
    } else value = scalar(e.value);

    const recipients =
      e.target === 'self' ? [owner]
      : e.target === 'team' || e.target === 'active' ? characters
      : e.target === 'teamExceptSelf' ? characters.filter((c) => c !== owner)
      : [];

    if (e.stat === 'energyGain') {
      // Instant flat energy (not a timed buff).
      for (const c of recipients) energy.addFlat(c.id, value, frame, cycle);
      return;
    }
    const targets =
      e.target === 'self' ? [owner.id]
      : e.target === 'team' ? characters.map((c) => c.id)
      : e.target === 'teamExceptSelf' ? characters.filter((c) => c !== owner).map((c) => c.id)
      : e.target === 'active' ? ['active']
      : ['enemy'];
    for (const target of targets) {
      bm.apply(
        { effectId: e.id, source: owner.id, target, stat: e.stat, value, duration: e.duration ?? null,
          maxStacks: e.maxStacks, stackMode: e.stackMode ?? 'refresh', dynamic },
        frame,
      );
    }
  }

  const fire = (owner: CharacterInput, trigger: string, frame: number, action?: HookApi['action'], actor?: CharacterInput) => {
    for (const e of owner.effects) if (e.trigger.on === trigger) applyEffect(owner, e, frame, action, actor);
  };

  for (const c of characters) {
    for (const e of c.effects) {
      if (e.trigger.on === 'always') applyEffect(c, e, 0);
      else if ((e.trigger.on === 'onHit' || e.trigger.on === 'onReaction' || e.trigger.on === 'custom') && !(e.hook && e.trigger.on !== 'custom')) {
        assumptions.add(`${e.id}: trigger "${e.trigger.on}" not modelled yet, effect skipped`);
      }
    }
  }

  // ---------- 1. schedule ----------
  let prev: { char: CharacterInput; def: ActionDef; start: number } | null = null;
  let lastSwap = -Infinity;
  let waitFrames = 0;
  const cycleStart: number[] = [];
  const cooldownReady = new Map<string, number>();
  const lastParticle = new Map<string, number>();
  let endFrame = 0;

  for (cycle = 1; cycle <= cycles; cycle++) {
    let first = true;
    for (const step of rotation) {
      if (step.action === 'wait') {
        waitFrames += step.frames ?? 0;
        continue;
      }
      const char = byId.get(step.char);
      if (!char) throw new Error(`rotation references unknown character "${step.char}"`);
      const def = char.actions[step.action];
      if (!def) throw new Error(`${char.id} has no action "${step.action}"`);
      const kind = actionKind(step.action);
      const swapped = prev !== null && prev.char !== char;

      let start = 0;
      if (prev) {
        const key = swapped ? 'swap' : kind;
        start = prev.start + (prev.def.cancel[key] ?? prev.def.cancel.default) + profile.actionDelay;
        if (swapped) start = Math.max(start + profile.swapDelay, lastSwap + SWAP_COOLDOWN);
      }
      start += waitFrames;
      waitFrames = 0;

      if (def.cooldown) {
        // `cooldown.skill` / `cooldown.burst` mods are fractional changes (−0.5 halves the cooldown).
        const cdMod = statsFor(char, start).mods[`cooldown.${def.talent}`] ?? 0;
        const cooldown = Math.max(0, Math.round(def.cooldown * (1 + cdMod)));
        const ready = cooldownReady.get(`${char.id}:${step.action}`) ?? 0;
        if (start < ready) {
          assumptions.add(`${char.id} ${step.action} waited for cooldown (rotation is faster than the cooldown)`);
          start = ready;
        }
        cooldownReady.set(`${char.id}:${step.action}`, start + cooldown);
      }

      if (swapped) {
        lastSwap = start;
        fire(prev!.char, 'onSwapOut', start);
        fire(char, 'onSwapIn', start);
      } else if (!prev) fire(char, 'onSwapIn', start);

      if (def.energyCost) {
        const { ok, had } = energy.spend(char.id, def.energyCost, start);
        if (!ok) assumptions.add(`${char.id} burst used with insufficient energy (${had.toFixed(1)}/${def.energyCost}); it fires anyway. Raise ER or add a battery.`);
      }

      if (first) cycleStart.push(start);
      first = false;
      const actionInfo = { name: step.action, talent: def.talent, start, end: start + def.cancel.default, hitFrames: def.hits.map((h) => start + h.frame) };
      fire(char, TALENT_TRIGGER[def.talent], start, actionInfo);
      if (def.talent === 'normal') for (const c of characters) fire(c, 'onAnyNormal', start, actionInfo, char);
      if (def.talent === 'burst') for (const c of characters) fire(c, 'onAnyBurst', start, actionInfo, char);
      actions.push({ cycle, char: char.id, action: step.action, start, end: start + def.cancel.default });

      for (const hit of def.hits) pending.push({ cycle, frame: start + hit.frame, char, action: step.action, hit });
      if (def.particles) {
        const p = def.particles;
        const dropHits = p.perHit ? def.hits : def.hits.slice(0, 1);
        for (const h of dropHits) {
          const frame = start + h.frame + p.delay;
          const key = `${char.id}:${step.action}`;
          if (frame - (lastParticle.get(key) ?? -Infinity) < p.icd) continue;
          lastParticle.set(key, frame);
          energy.addDrop({ frame, count: p.count, element: p.element, cycle });
        }
      }
      prev = { char, def, start };
      endFrame = start + def.cancel.default + profile.actionDelay;
    }
  }

  const windowStartCycle = cycles >= 2 ? 2 : 1;
  const windowStart = cycleStart[windowStartCycle - 1] ?? 0;
  const windowFrames = Math.max(1, endFrame - windowStart);

  // ---------- 2. resolve ----------
  const hits: HitRecord[] = [];
  const queue: Array<{ frame: number; seq: number; run: () => void }> = [];
  let head = 0;
  let seq = 0;
  const schedule = (frame: number, run: () => void) => {
    const ev = { frame, seq: seq++, run };
    let lo = head;
    let hi = queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (queue[mid]!.frame <= frame) lo = mid + 1;
      else hi = mid;
    }
    queue.splice(lo, 0, ev);
  };

  const engine = new ReactionEngine({
    characters,
    lunarCharged: input.lunarCharged ?? false,
    schedule,
    statsFor,
    enemyRes: (el, frame) => (enemy.res[el] ?? 0) + (bm.enemyMods(frame)[`res.enemy.${el}`] ?? 0),
    record: (h) => hits.push(h),
    applyEnemyBuff: (effectId, source, stat, value, duration, frame) =>
      bm.apply({ effectId, source, target: 'enemy', stat, value, duration, maxStacks: 1, stackMode: 'refresh' }, frame),
    assume: (t) => assumptions.add(t),
  });

  const icdState = new Map<string, { count: number; start: number }>();
  const icdAllows = (char: CharacterInput, hit: HitDef, frame: number): boolean => {
    const group = ICD.groups[hit.icd?.group ?? 'standard'];
    if (!group) throw new Error(`unknown ICD group "${hit.icd?.group}"`);
    const key = `${char.id}|${hit.icd?.tag ?? 'default'}`;
    let st = icdState.get(key);
    if (!st || (group.resetFrames > 0 && frame - st.start >= group.resetFrames)) {
      st = { count: 0, start: frame };
      icdState.set(key, st);
    }
    const ok = group.pattern[Math.min(st.count, group.pattern.length - 1)] === 1;
    st.count++;
    return ok;
  };

  const processHit = (p: PendingHit): void => {
    {
      const { stats, mods: own } = statsFor(p.char, p.frame);
      const mods = addMods(own, bm.enemyMods(p.frame));
      // Elemental infusion: physical normal/charged/plunge hits take the element of an active infusion.
      let hit = p.hit;
      if (hit.element === 'physical' && (hit.talent === 'normal' || hit.talent === 'charged' || hit.talent === 'plunge')) {
        const inf = INFUSIONS.find((e) => (mods[`infusion.${e}`] ?? 0) > 0);
        if (inf) hit = { ...hit, element: inf };
      }
      let gauge = 0;
      if (hit.element !== 'physical') {
        const g = hit.gauge ?? 1;
        if (g > 0 && icdAllows(p.char, hit, p.frame)) gauge = g;
      }
      const r = engine.react({ frame: p.frame, char: p.char, hit, gauge, cycle: p.cycle });
      const damage = calcHitDamage({
        hit, stats, mods, charLevel: p.char.level, enemyLevel: enemy.level, enemyRes: enemy.res,
        reactionFactor: r.reactionFactor, catalyzeFlat: r.catalyzeFlat,
      });
      hits.push({
        cycle: p.cycle, frame: p.frame, char: p.char.id, action: p.action, element: hit.element,
        talent: hit.talent, damage, reactions: r.reactions,
      });
      // onHit hooks (e.g. Raiden's coordinated attacks) see every hit that dealt damage.
      if (damage > 0) {
        for (const owner of characters) {
          for (const e of owner.effects) {
            if (e.trigger.on === 'onHit' && e.hook) {
              runHook(owner, e, p.frame, undefined, { cycle: p.cycle, hitInfo: { actor: p.char, action: p.action, hit, damage, frame: p.frame } });
            }
          }
        }
      }
    }
  };
  queueHit = (p) => schedule(p.frame, () => processHit(p));
  resolving = true;
  for (const p of pending.sort((a, b) => a.frame - b.frame)) queueHit(p);
  while (head < queue.length) queue[head++]!.run();
  hits.sort((a, b) => a.frame - b.frame);

  const inWindow = hits.filter((h) => h.cycle >= windowStartCycle);
  const seconds = windowFrames / FPS;
  const perCharacterDps: Record<string, number> = Object.fromEntries(characters.map((c) => [c.id, 0]));
  let windowDamage = 0;
  for (const h of inWindow) {
    windowDamage += h.damage;
    perCharacterDps[h.char] = (perCharacterDps[h.char] ?? 0) + h.damage / seconds;
  }

  const windowCycles = Array.from({ length: cycles - windowStartCycle + 1 }, (_, i) => windowStartCycle + i);
  const energyReport: Record<string, EnergyReport> = {};
  for (const c of characters) {
    const cost = energy.max.get(c.id);
    if (cost === undefined) continue;
    const pc = energy.perCycle(c.id, windowCycles);
    const bursts = actions.filter((a) => a.char === c.id && a.action === 'burst' && a.cycle >= windowStartCycle).length / windowCycles.length;
    energyReport[c.id] = {
      burstCost: cost,
      burstsPerCycle: bursts,
      particleEnergyBase: pc.particleBase,
      flatEnergy: pc.flat,
      gainedPerCycle: pc.particleActual + pc.flat,
      requiredEr: bursts > 0 && pc.particleBase > 0 ? Math.max(1, (cost * bursts - pc.flat) / pc.particleBase) : null,
      shortfalls: energy.shortfalls.get(c.id) ?? 0,
    };
  }

  return {
    actions, hits, buffs: bm.records,
    totalDamage: hits.reduce((s, h) => s + h.damage, 0),
    windowFrames, windowDamage, dps: windowDamage / seconds, perCharacterDps,
    energy: energyReport,
    assumptions: [...assumptions].sort(),
  };
}

/** Run the same rotation under Relaxed (default) and Frame-perfect profiles. */
export function simulateBoth(input: Omit<SimInput, 'profile'>): { relaxed: SimResult; framePerfect: SimResult } {
  return {
    relaxed: simulate({ ...input, profile: EXECUTION_PROFILES.relaxed }),
    framePerfect: simulate({ ...input, profile: EXECUTION_PROFILES.framePerfect }),
  };
}
