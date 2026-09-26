---
name: kb-add-artifact-set
description: Add or refresh one Genshin Impact artifact set in the KB (2-piece and 4-piece bonuses as structured effects). Use when a set is missing, referenced by a character or team, or new in a patch.
---

# kb-add-artifact-set <name>

Output: `kb/artifacts/<id>.json` matching `docs/KB_SCHEMA.md` → Artifact set.

## Steps

1. Resolve id (kebab-case). Read existing file if present.
2. **genshin-db** `artifacts(name)` → 2pc and 4pc text and values, version. **Game8 artifact page** → cross-check, domain.
3. **GameWith** → cross-check wording/values.
4. **KeqingMains** → practical behaviour (stack rate, whether off-field triggers count, snapshot, team-wide buffs not stacking with same set).
5. Convert both bonuses to Effect DSL. Team-wide buffs that do not stack with another copy of the same set: set `"stackGroup": "<set-id>"`.
6. Provenance, confidence, `/kb-validate`, `kb/CHANGELOG.md`, and (if standalone) progress log + `kb:` commit.

## Tooling in this repo

The steps above can be run with the importers: write `scripts/kb-import/specs/<id>.ts` (frames and effects transcribed from gcsim/KQM, numbers pulled from genshin-db by parameter key) and run `npm run kb:import:<kind> -- <id>`. The importer cross-checks multiplier tables against gcsim and Lv 90 base stats against KeqingMains, and sets `dataConfidence: high` only when both agree. Use `npm run kb:inspect -- "<name>"` to see genshin-db's labels and text. After importing, run `npm run kb:validate && npm test`.
