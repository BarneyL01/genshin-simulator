---
name: kb-add-weapon
description: Add or refresh one Genshin Impact weapon in the KB (base ATK, substat, passive R1-R5 as structured effects, assumptions for conditional uptime). Use when the user names a weapon, when a character's recommended weapon is missing, or when kb-sync-patch finds a new or changed weapon. Especially important for new weapons with little test data.
---

# kb-add-weapon <name>

Output: `kb/weapons/<id>.json` matching `docs/KB_SCHEMA.md` → Weapon.

## Steps

1. Resolve id (kebab-case). Read existing file if present.
2. **genshin-db** → `weapons(name)`: type, rarity, version, `stats(90)` (base ATK + substat), passive text and `r1`..`r5` values. Primary source for numbers.
3. **Game8 weapon page** → cross-check numbers; obtain method (gacha / craft / event / battlepass / shop / chest). For event and free weapons set `obtain.freeRefinement` to the highest refinement obtainable without payment (e.g. 5 if the event gives refinement materials).
4. **GameWith weapon page** → cross-check numbers; record conflicts > 0.5%.
5. **gcsim** (`internal/weapons/<type>/<name>/`) if present → how the passive is implemented: stack timing, ICD, whether it works off-field. Numbers only; do not copy code.
6. **KeqingMains** (weapon comparisons / character guides that discuss it) → how the passive behaves in practice: stack gain rate, uptime, whether it triggers off-field, snapshotting. Record as effect fields or `assumptions`.
7. **Convert passive to Effect DSL** with `value: { "perRefinement": [r1..r5] }`. For conditional parts (stacks, HP thresholds, "after X"), encode the condition and add an `assumptions` string describing what the engine assumes. The weapon comparer shows best/worst case using these conditions, so model conditions explicitly instead of assuming max uptime.
8. **Confidence**:
   - `high`: numbers match in 2 sources and KQM or gcsim covers passive behaviour.
   - `medium`: numbers match, no community uptime analysis yet (typical for new weapons).
   - `low`: numbers from one source or partially missing.
9. Provenance per page. `gameVersion` = live version.
10. Run `/kb-validate`. Append to `kb/CHANGELOG.md`. If standalone, add a progress-log entry and commit with prefix `kb:`.

## Tooling in this repo

The steps above can be run with the importers: write `scripts/kb-import/specs/<id>.ts` (frames and effects transcribed from gcsim/KQM, numbers pulled from genshin-db by parameter key) and run `npm run kb:import:<kind> -- <id>`. The importer cross-checks multiplier tables against gcsim and Lv 90 base stats against KeqingMains, and sets `dataConfidence: high` only when both agree. Use `npm run kb:inspect -- "<name>"` to see genshin-db's labels and text. After importing, run `npm run kb:validate && npm test`.
