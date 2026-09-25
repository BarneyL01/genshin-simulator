---
name: kb-add-weapon
description: Add or refresh one Genshin Impact weapon in the KB (base ATK, substat, passive R1-R5 as structured effects, assumptions for conditional uptime). Use when the user names a weapon, when a character's recommended weapon is missing, or when kb-sync-patch finds a new or changed weapon. Especially important for new weapons with little test data.
---

# kb-add-weapon <name>

Output: `kb/weapons/<id>.json` matching `docs/KB_SCHEMA.md` → Weapon.

## Steps

1. Resolve id (kebab-case). Read existing file if present.
2. **Game8 weapon page** → type, rarity, release version, Lv 90 base ATK, substat type and Lv 90 value, passive name and R1–R5 values, obtain method (gacha / craft / event / BP).
3. **GameWith weapon page** → cross-check numbers; record conflicts > 0.5%.
4. **KeqingMains** (weapon comparisons / character guides that discuss it) → how the passive behaves in practice: stack gain rate, uptime, whether it triggers off-field, snapshotting. Record as effect fields or `assumptions`.
5. **Convert passive to Effect DSL** with `value: { "perRefinement": [r1..r5] }`. For conditional parts (stacks, HP thresholds, "after X"), encode the condition and add an `assumptions` string describing what the engine assumes. The weapon comparer shows best/worst case using these conditions, so model conditions explicitly instead of assuming max uptime.
6. **Confidence**:
   - `high`: numbers match in 2 sources and KQM (or equivalent) has discussed uptime.
   - `medium`: numbers match, no community uptime analysis yet (typical for new weapons).
   - `low`: numbers from one source or partially missing.
7. Provenance per page. `gameVersion` = live version.
8. Run `/kb-validate`. Append to `kb/CHANGELOG.md`. If standalone, add a progress-log entry and commit with prefix `kb:`.
