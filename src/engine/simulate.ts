import type { Effect } from '../schema/effect';
import { BuffManager } from './buffs';
import { calcHitDamage } from './damage';
import { EXECUTION_PROFILES, FPS, type ExecutionProfile } from './profiles';
import { resolveStats, sumMods } from './stats';
import type {
  ActionDef, ActionRecord, CharacterInput, EnemyInput, HitDef, HitRecord, RotationStep, SimResult, Talent,
} from './types';

export const SWAP_COOLDOWN = 60;

export interface SimInput {
  characters: CharacterInput[];
  enemy: EnemyInput;
  rotation: RotationStep[];
  /** Rotation repetitions. Cycle 1 is warm-up; DPS is measured over cycles 2..N (cycle 1 if N = 1). */
  cycles: number;
  profile: ExecutionProfile;
}

const TALENT_TRIGGER: Record<Talent, string> = {
  normal: 'onNormal', charged: 'onCharged', plunge: 'onPlunge', skill: 'onSkill', burst: 'onBurst',
};

const actionKind = (name: string): string => (/^n\d+$/.test(name) ? 'normal' : name);

interface PendingHit {
  cycle: number;
  frame: number;
  char: CharacterInput;
  action: string;
  hit: HitDef;
}

/**
 * Discrete schedule → buff timeline → damage.
 *  1. Walk the rotation, computing each action's start (previous cancel + execution-profile delay,
 *     swap rules, cooldown waits) and applying triggered effects at that start frame.
 *  2. Evaluate every hit at its own frame against the buff timeline.
 * Simplifications (see docs/SIMULATION.md): effects trigger at action start, values are computed at
 * application time (no dynamic re-scaling), conditions are ignored (and listed in `assumptions`).
 */
export function simulate(input: SimInput): SimResult {
  const { characters, enemy, rotation, cycles, profile } = input;
  const byId = new Map(characters.map((c) => [c.id, c]));
  const bm = new BuffManager();
  const assumptions = new Set<string>();
  const actions: ActionRecord[] = [];
  const pending: PendingHit[] = [];

  const modsAt = (c: CharacterInput, frame: number) =>
    sumMods([...c.baseMods, ...Object.entries(bm.modsFor(c.id, frame)).map(([stat, value]) => ({ stat, value }))]);

  function applyEffect(owner: CharacterInput, e: Effect, frame: number): void {
    if (e.hook) {
      assumptions.add(`${e.id}: hook "${e.hook}" not implemented, effect skipped`);
      return;
    }
    if (e.condition) assumptions.add(`${e.id}: condition ignored (assumed met)${e.assumption ? ` — ${e.assumption}` : ''}`);
    let value: number;
    if (e.scaling) {
      const [who, stat] = e.scaling.from.split('.');
      const src = who === 'self' ? owner : undefined;
      const stats = src ? resolveStats(src.base, src.weaponAtk, modsAt(src, frame)) : undefined;
      const s = stats?.[stat as keyof typeof stats];
      if (s === undefined) {
        assumptions.add(`${e.id}: unsupported scaling source "${e.scaling.from}", effect skipped`);
        return;
      }
      value = (e.scaling.base ?? 0) + e.scaling.ratio * s;
      if (e.scaling.cap !== undefined) value = Math.min(value, e.scaling.cap);
    } else if (typeof e.value === 'number') value = e.value;
    else if ('perRefinement' in e.value) value = e.value.perRefinement[owner.refinement - 1] ?? 0;
    else value = e.value.perTalentLevel[Math.min(owner.talentLevel, e.value.perTalentLevel.length) - 1] ?? 0;

    const targets =
      e.target === 'self' ? [owner.id]
      : e.target === 'team' ? characters.map((c) => c.id)
      : e.target === 'teamExceptSelf' ? characters.filter((c) => c !== owner).map((c) => c.id)
      : e.target === 'active' ? ['active']
      : ['enemy'];
    for (const target of targets) {
      bm.apply(
        { effectId: e.id, source: owner.id, target, stat: e.stat, value, duration: e.duration ?? null,
          maxStacks: e.maxStacks, stackMode: e.stackMode ?? 'refresh' },
        frame,
      );
    }
  }

  const fire = (owner: CharacterInput, trigger: string, frame: number) => {
    for (const e of owner.effects) if (e.trigger.on === trigger) applyEffect(owner, e, frame);
  };

  for (const c of characters) {
    for (const e of c.effects) {
      if (e.trigger.on === 'always') applyEffect(c, e, 0);
      else if (e.trigger.on === 'onHit' || e.trigger.on === 'onReaction' || e.trigger.on === 'custom') {
        assumptions.add(`${e.id}: trigger "${e.trigger.on}" not modelled yet, effect skipped`);
      }
    }
  }

  let prev: { char: CharacterInput; def: ActionDef; start: number } | null = null;
  let lastSwap = -Infinity;
  let waitFrames = 0;
  const cycleStart: number[] = [];
  const cooldownReady = new Map<string, number>();
  let endFrame = 0;

  for (let cycle = 1; cycle <= cycles; cycle++) {
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
      if (swapped) {
        lastSwap = start;
        fire(prev!.char, 'onSwapOut', start);
        fire(char, 'onSwapIn', start);
      } else if (!prev) fire(char, 'onSwapIn', start);

      if (def.cooldown) {
        const ready = cooldownReady.get(`${char.id}:${step.action}`) ?? 0;
        if (start < ready) {
          assumptions.add(`${char.id} ${step.action} waited for cooldown (rotation is faster than the cooldown)`);
          start = ready;
        }
        cooldownReady.set(`${char.id}:${step.action}`, start + def.cooldown);
      }

      if (first) cycleStart.push(start);
      first = false;
      fire(char, TALENT_TRIGGER[def.talent], start);
      const end = start + def.cancel.default;
      actions.push({ cycle, char: char.id, action: step.action, start, end });
      for (const hit of def.hits) pending.push({ cycle, frame: start + hit.frame, char, action: step.action, hit });
      prev = { char, def, start };
      endFrame = start + (def.cancel.default) + profile.actionDelay;
    }
  }

  // Start of the would-be next action = end of the measured window.
  const windowStartCycle = cycles >= 2 ? 2 : 1;
  const windowStart = cycleStart[windowStartCycle - 1] ?? 0;
  const windowFrames = Math.max(1, endFrame - windowStart);

  const hits: HitRecord[] = pending
    .sort((a, b) => a.frame - b.frame)
    .map((p) => {
      const mods = modsAt(p.char, p.frame);
      const damage = calcHitDamage({
        hit: p.hit,
        stats: resolveStats(p.char.base, p.char.weaponAtk, mods),
        mods: { ...mods, ...bm.enemyMods(p.frame) },
        charLevel: p.char.level,
        enemyLevel: enemy.level,
        enemyRes: enemy.res,
      });
      return { cycle: p.cycle, frame: p.frame, char: p.char.id, action: p.action, element: p.hit.element, talent: p.hit.talent, damage };
    });

  const inWindow = hits.filter((h) => h.cycle >= windowStartCycle);
  const seconds = windowFrames / FPS;
  const perCharacterDps: Record<string, number> = Object.fromEntries(characters.map((c) => [c.id, 0]));
  let windowDamage = 0;
  for (const h of inWindow) {
    windowDamage += h.damage;
    perCharacterDps[h.char] = (perCharacterDps[h.char] ?? 0) + h.damage / seconds;
  }

  return {
    actions, hits, buffs: bm.records,
    totalDamage: hits.reduce((s, h) => s + h.damage, 0),
    windowFrames, windowDamage, dps: windowDamage / seconds, perCharacterDps,
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
