# Simulation Model

This describes what the engine in `src/engine/` computes. Simplifications are listed explicitly so results can be interpreted.

## Time

- Unit: frame (1/60 s). All KB durations are frames.
- Event queue ordered by frame, then by insertion order.
- A run = the rotation script repeated `cycles` times (default 4). Reported DPS = total damage of cycles 2..N ÷ their duration. Cycle 1 is warm-up (initial energy, stacks).
- Start state: all characters at full energy on cycle 1 (configurable), all cooldowns ready.

## Actions

| Action | Effect on timeline |
|---|---|
| `normal` / `charged` / `plunge` | Schedules hits at `hitmark` frames; next action starts at the cancel frame for that transition. |
| `skill` (press / hold / variant) | Hits, particles, effects; sets cooldown. |
| `burst` | Requires energy ≥ cost (warning if not met; option to force); hits and effects; sets cooldown. |
| `swap` | Swap cooldown 1 s; triggers `onSwapIn` / `onSwapOut`. |
| `wait` | Idle frames. |

Off-field damage (e.g. Xiangling Pyronado, Oz) is modelled as scheduled hits owned by the summon/state, tied to its duration and tick interval.

## Execution profile (latency)

The user plays with ~300 ms ping and cannot hit frame-perfect cancels. The engine adds a fixed delay so results are consistent between teams:

- After each action becomes cancellable (the KB cancel frame for the next action), the next action starts `actionDelay` frames later.
- Swaps add `swapDelay` frames on top of the 1 s swap cooldown rule.
- Hitmarks, buff durations, and cooldowns are not changed; only when the next input starts.
- Profiles: Frame-perfect (0/0), Relaxed (default, 18/18 frames = 300 ms), Custom.
- The delay is deterministic (no randomness), so repeated runs give identical numbers.
- This is a modelling choice, not a model of network behaviour: the game's actual response to ping is not simulated. It penalises rotations in proportion to their number of inputs, which is the practical effect the user described.
- Every result also shows the Frame-perfect DPS so the delay cost is visible.

Rotations defined by duration (e.g. "N1 spam for the remaining burst duration") fit fewer attacks when delay is added; the script's `repeat: "untilBuffEnds:<effectId>"` form handles this automatically.

## Stats

Final stat = (base + weapon base ATK) × (1 + %) + flat, per the standard formula. Artifact default:

- Main stats by role (from team archetype, else role template).
- KQMS-style substats: fixed pool of liquid rolls, distributed by a greedy optimiser that first meets the ER target, then maximises damage.
- Manual stat entry: roadmap item (see `docs/PLAN.md` §11), not in v1.
- Level: Lv 90 only in v1.

## Damage

```
dmg = (MV × scalingStat + flatDmg) × baseDmgMultiplier
      × (1 + dmgBonus) × critFactor × enemyDefMult × enemyResMult × reactionMult
```

- `critFactor`: expected value `1 + CR × CD` (CR capped at 100%). Option: crit-sim with RNG seed later.
- Enemy DEF: `(charLvl + 100) / ((charLvl + 100) + (enemyLvl + 100) × (1 − defShred) × (1 − defIgnore))`.
- RES: piecewise formula (below 0, 0–75%, above 75%).
- Amplifying reactions: multiplier × (1 + EM bonus + reactionBonus).
- Additive (Aggravate/Spread): flat bonus from level base × multiplier × (1 + EM bonus + bonus).
- Transformative and newer reaction families: formula defined in `kb/mechanics/reactions.json`; engine has one implementation per formula id.

## Elements

- Gauge model with aura decay, per-hit gauge units, and ICD groups (standard: every 3rd hit or 2.5 s resets).
- Single target by default. Multi-target is out of scope for v1 (listed in Assumptions).
- Freeze, Quicken, Burning, and Lunar-type states tracked as enemy states.

## Energy

- Particles per skill hit (with particle ICD), flat energy from effects, off-field vs on-field multiplier, ER applied.
- Report per character: energy gained per rotation, required ER to burst every rotation.

## Buff manager

- Each active effect instance: `{effectId, source, target, startFrame, endFrame, stacks, snapshotValues?}`.
- On each hit, the damage calculator queries active effects for the attacker and enemy.
- Snapshot effects capture stats at application time.
- All instances are written to the buff timeline output.

## Known simplifications (v1)

- Expected-value crits (no crit variance).
- Single target, stationary enemy, no enemy attacks, no shields broken, no HP loss unless an effect requires it (then assumed per KB `assumption`).
- Human-reaction delays not modelled beyond cancel frames.
- Movement and particle travel time approximated by fixed delay from KB constants.

## Implemented in M2

- Hits are evaluated after the whole schedule is built, each at its own frame against the buff timeline.
- Action start = previous action start + its cancel frame for the next action's kind (`normal`, `skill`, `burst`, `swap`, else `default`) + `actionDelay`; on a character change, plus `swapDelay` and never earlier than 60 frames after the previous swap.
- Skill/burst cooldowns start at the action's start frame; a too-early repeat waits and is reported in the result's `assumptions`.
- Negative RES is halved (`res < 0 → 1 − res/2`); RES shred effects use stat `res.enemy.<element>` with negative values.
- `scaling` on an effect replaces `value`: `value = base + ratio × stat`, capped at `cap`; only `self.<stat>` sources are supported so far.

## Implemented in M3

Mechanics constants live in `kb/mechanics/*.json` and are parsed with zod when the engine loads.

**Resolve pass.** After scheduling, every hit and every reaction follow-up (EC ticks, bloom cores, burning ticks, Lunar-Charged ticks) is processed from one frame-ordered queue.

**ICD.** Per (character, ICD tag): the first hit starts a counter; the group `pattern` (generated from gcsim into `kb/mechanics/icd.json`, 65 groups) says which hits apply by hit index, and the last value repeats past the end (standard: hits 1, 4, 7...); the counter resets `resetFrames` (150 for standard) after its first hit. Hits without ICD data use tag `default`, group `standard`. A hit that does not apply neither attaches an element nor reacts, but still deals its damage.

**Auras.** Gauge units (U) with lazy decay. Applying `g` units attaches `0.8 g` and lasts `60 × (7 + 2.5 g)` frames. Pyro refreshes when the new aura is at least the old one; other elements only refill. A trigger consumes `trigger gauge × consume` of the aura (see `pairs` in `reactions.json`); leftover trigger gauge attaches. Shatter is checked first on `strike: blunt` hits.

**Reaction order per trigger element** (from gcsim): electro: hyperbloom, aggravate, overloaded, EC/LC, superconduct, quicken. pyro: burgeon, overloaded, vaporize, melt, burning. cryo: superconduct, melt, freeze. hydro: vaporize, freeze, bloom, EC/LC. dendro: spread, quicken, bloom, burning. anemo: swirl.

**Damage.**
- Amplifying: `mult × (1 + 2.78 EM/(EM+1400) + reactionBonus.<id>)` on the final hit damage.
- Additive: `mult × 1446.8535 × (1 + 5 EM/(EM+1200) + bonus)` added to the hit's base damage (before DMG bonus, crit, DEF, RES).
- Transformative: `mult × 1446.8535 × (1 + 16 EM/(EM+2000) + bonus) × RES`; no crit, no DEF. Owner = the character whose hit triggered it (EM and `reactionBonus.<id>` from their stats). Overloaded, superconduct, swirl and shatter have a 6-frame global cooldown.
- Reaction ids used in `reactionBonus.<id>`: vaporize, melt, overloaded, superconduct, electroCharged, swirl, shatter, bloom, hyperbloom, burgeon, burning, aggravate, spread, lunarCharged.

**Energy.** Particles are collected `delay` frames after the hit (default 100, per-character `particles.delay` overrides). Same element 3, colourless 2, other 1; off-field × (1 − 0.1 × party size); × ER. A burst needs its cost; if short it still fires, the shortfall is listed in `assumptions`, and energy goes to 0. `energyGain` effects are instant flat energy. Cycle 1 starts with full energy (`startEnergy: 'empty'` to change). The result reports per-character energy per cycle and the ER needed to burst every cycle.

**Known simplifications (M3).**
- Single enemy; auras are not tracked per source (gcsim tracks per-source durability).
- Electro-Charged: no multi-trigger stacking. Freeze: no decay ramp or freeze resistance. Burning: no fuel aura. Dendro cores: all live cores react to one Electro/Pyro hit; no core cap.
- Lunar-Charged only when `lunarCharged: true` is passed (team Moonsign condition); contributors are characters who applied Hydro/Electro while the aura lasts. gcsim is the only source.
- Not implemented: Crystallize (shield), Stellar Swirl, Lunar-Crystallize, Lunar-Bloom, Stellar Conduct. Listed in `reactions.json` with `implemented: false`.
- Swirl does not spread and adds no RES shred (shred is a character effect).

## Implemented in M4–M6

**Hooks.** Mechanics the Effect DSL cannot express run as named hooks in `src/engine/hooks/` (`xingqiu`, `raiden`, `hutao`, `yelan`, `zhongli`, `weapon.favonius`). A KB effect with `hook: "<id>"` is passed to the hook instead of being applied as a stat. Hooks see the trigger frame, the acting character, the action (name, start, hit frames), the owner's `hookHits` (hits no action lists), team stats, and can queue hook hits (cancellable), timed buffs, particles and flat energy. Hooks that are missing are skipped and listed in the result's `assumptions`. Each hook has tests in `tests/hooks.test.ts`.

**Triggers.** `always`, `onNormal/onCharged/onPlunge/onSkill/onBurst` (the owner's own action, at its start), `onAnyNormal/onAnyBurst` (any team member's action), `onSwapIn/onSwapOut`, and `onHit` (hooks only, in the resolve pass, for every hit that deals damage). `onReaction` and `custom` are not modelled unless a hook handles them.

**Effect values.** A number, `perRefinement`, or `perTalentLevel` (with `talent`: which talent's level, default burst). `scaling` replaces `value`: `base + ratio × stat` with an optional `cap` and `capFrom` (multiple of another stat), evaluated at hit time unless `snapshot: true`. Sources are `self.<atk|hp|def|em|er|critRate|critDmg|baseAtk|baseHp|baseDef>` and `target.energyMax`. `delay` starts the effect that many frames after its trigger.

**Targets.** `active` applies only while the attacker is the on-field character at that frame (the on-field character is the one whose action started last). Off-field damage (Guoba, orbitals, Yelan's arrows) therefore does not receive field buffs or A4-style bonuses, as in the game.

**Stat keys added:** `infusion.<element>` (physical normal/charged/plunge hits take that element), `cooldown.skill/burst` (fractional change of the cooldown), `mvBonus.hit.<hit name>` (extra multiplier on one named hit), `energyGain` (instant flat energy).

**Rotation scripts.** Steps `{char, action}`, `wait`, `firstCycleOnly`, `every: N` (only every N-th cycle; measure over 1 + k × N cycles), and repeat groups: `times`, `untilBuffEnds { effect, source }` (each action is checked before it starts and the repeat stops at the first one that would start after the buff ended), `untilCycleTime` (frames after the cycle's first action). Actions are `n1..nK`, `charged`, `plunge`, `skill`, `burst` and a character's `extraActions`.

**KQM Standards artifact stats** (`src/engine/kqms.ts`, `kb/mechanics/kqms.json`, values as implemented by gcsim): five 5★ level-20 pieces, fixed flower HP and feather ATK, two fixed rolls of every substat, 20 liquid rolls with at most 10 per stat (minus 2 per piece whose main stat is that stat). The simulator places the liquid rolls deterministically: first the fewest Energy Recharge rolls with which the character bursts every rotation (everyone else at maximum ER; an alternative Sands is tried when the first cannot get there), then greedily one roll at a time on the stat that raises the character's own DPS most, characters in order of DPS; a Circlet with alternatives is picked by damage. It costs about 500 simulations per team.

**Team runs** (`src/kb/`): Mode A simulates a known team with its rotation; Mode B chains each character's `usualCombo` in the chosen order (rotation length defaults to the longest skill/burst cooldown used; combos that repeat "until the rotation ends" fill the rest); the weapon comparer swaps one weapon and re-optimises only that character. Results carry Relaxed and Frame-perfect numbers with identical stats.

**Theorycrafting switches** (`SimInput`): `enemyAura` (an aura that comes back before every hit, e.g. "always Vaporized"), `conditionsMet: false` (skip effects with a `condition`: worst case for uncertain passives), `trace` (attach stats and modifiers to every hit), `startEnergy`, `lunarCharged`.

**Validation against a published figure.** `tests/kqm-weapon-check.test.ts` reproduces KeqingMains' Hu Tao weapon table (KQMS, 4pc Crimson Witch, HP Sands, 7 N2C, burst, all hits Vaporized, no ER requirement): Staff of Homa R5 / R1 and White Tassel R5 come out within 3 points of the published percentages of a Blackcliff Pole; Black Tassel R5 is 10 points low (see `docs/OPEN_QUESTIONS.md`).

**Known simplifications added in M4–M6.** No enemy defeats (Blackcliff-type stacks, Hu Tao C4), no HP tracking (HP-conditional effects are assumed met and listed), no dash or jump cancel actions (cancel frames only), hold variants of skills are modelled only where a KB character defines them (Zhongli hold, Bennett press only), summons and constructs are hooks (Guoba, orbitals, steles), particle pickups by Raiden's A1 are not counted, Yelan's recast does not remove the earlier A4 ramp.

## Stellar-Conduct and the newer hook features

**Stellar-Conduct** (kb/mechanics/reactions.json, `src/engine/reactions.ts`; numbers from gcsim, no KeqingMains page exists). When a team member carries the marker hook `stellar-conduct` (Cryo Traveler, Sandrone: their "Stellar Jubilee" passive), a Superconduct trigger becomes Stellar-Conduct: the Cryo/Electro aura is consumed as for Superconduct, there is no Superconduct damage or shred, and a Polestar Field (360 frames, refreshed by every further trigger) is created. Every 240 frames the field gives the whole team Cryo and Electro DMG% taken from a table indexed by the number of Electro/Cryo applications recorded in the previous window (0–12; one per character per 6 frames; 20% at 0 stacks up to 40%) and −40% physical RES on the enemy. The team is assumed to stand inside the field. Stellar Swirl is not implemented.

**Hook API additions:** `onReaction` trigger (reaction name and actor), `hitInfo.applied`, `later(frame, fn)` (run in the resolve pass), `transformHit(fn)` (rewrite hits before they resolve, e.g. Radiance conversions), `polestarActive()`, `activeAt()`, `valueOf(effectId)`, `hitMv(id)`, and hook-hit options `override` (per-hit multiplier, gauge, `defIgnore`, `baseMult`) and `skipIf`. Hit fields `defIgnore`, `baseMult`, `ignoreInfusion` were added. New hooks: `travelercryo`, `fischl`, `stellar-conduct` (marker).

**Energy-limited runs:** `SimInput.burstPolicy: "requireEnergy"` skips a burst the character cannot afford (no damage, no cooldown, counted as a shortfall) instead of firing it anyway, which shows the steady state of an energy-starved team.

**Patches:** `scripts/kb-import/patches/<id>.ts` modify a bulk-imported baseline character (used for Fischl's Oz, Sandrone's Stellar-Conduct passive, Alyosha's Hunter's Precision).
