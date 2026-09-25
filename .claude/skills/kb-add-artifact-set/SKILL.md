---
name: kb-add-artifact-set
description: Add or refresh one Genshin Impact artifact set in the KB (2-piece and 4-piece bonuses as structured effects). Use when a set is missing, referenced by a character or team, or new in a patch.
---

# kb-add-artifact-set <name>

Output: `kb/artifacts/<id>.json` matching `docs/KB_SCHEMA.md` → Artifact set.

## Steps

1. Resolve id (kebab-case). Read existing file if present.
2. **Game8 artifact page** → 2pc and 4pc text, release version, domain.
3. **GameWith** → cross-check wording/values.
4. **KeqingMains** → practical behaviour (stack rate, whether off-field triggers count, snapshot, team-wide buffs not stacking with same set).
5. Convert both bonuses to Effect DSL. Team-wide buffs that do not stack with another copy of the same set: set `"stackGroup": "<set-id>"`.
6. Provenance, confidence, `/kb-validate`, `kb/CHANGELOG.md`, and (if standalone) progress log + `kb:` commit.
