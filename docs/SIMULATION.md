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

## Stats

Final stat = (base + weapon base ATK) × (1 + %) + flat, per the standard formula. Artifact default:

- Main stats by role (from team archetype, else role template).
- KQMS-style substats: fixed pool of liquid rolls, distributed by a greedy optimiser that first meets the ER target, then maximises damage.
- User override: manual final stats per character.

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
