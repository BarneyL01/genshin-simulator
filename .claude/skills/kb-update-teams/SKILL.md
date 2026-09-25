---
name: kb-update-teams
description: Refresh Genshin Impact team archetypes and default rotations in the KB from KeqingMains, Game8 and GameWith. Use with a character name to update teams involving that character, or with no argument for a full pass over tier lists and best-team pages. Also used after a new character is added.
---

# kb-update-teams [character]

Output: `kb/teams/<id>.json` matching `docs/KB_SCHEMA.md` → Team archetype.

## Steps

1. **Collect teams.**
   - Scoped (`character` given): that character's "best teams" section on Game8 and GameWith, and KQM's team section / team guide for them.
   - Full pass: Game8 "best teams" list and tier list, GameWith "strongest teams"/party ranking, KQM team archetype guides.
2. **Merge duplicates.** Teams with the same core members and role layout are one archetype. Flex slots become `substitutes`. Id = short archetype name (`raiden-national`, `neuvillette-hyperbloom`); if none, join member ids of the core.
3. **Per member**: role, recommended weapons (ordered, with source), artifact sets and main stats, ER target. All ids must exist in the KB; add missing ones with the entity skills first.
4. **Rotation.** Prefer KQM rotation (with length in seconds). Convert to the rotation `script` format (`char`, `action`, optional `variant`, `repeat`). If only Game8/GameWith give a text rotation, convert it and set `dataConfidence: "medium"`. If none, leave `rotation.script` empty; the engine will use a role template.
5. **Ranks.** Store each site's rank label in `sourceRank` as written (do not normalise between sites).
6. Provenance per page, `gameVersion`, confidence.
7. Mark archetypes no longer listed by any source as `"status": "legacy"` rather than deleting.
8. Run `/kb-validate`. Append to `kb/CHANGELOG.md`. If standalone, add a progress-log entry and commit with prefix `kb:`.
