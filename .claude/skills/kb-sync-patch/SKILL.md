---
name: kb-sync-patch
description: Sync the Genshin KB with the current live game version. Use when a new patch is released, when the user asks to "update the KB", "pull new info", "sync data", or for a periodic refresh. Detects missing or changed characters, weapons, artifact sets and teams, then runs the per-entity skills and validation.
---

# kb-sync-patch

Orchestrates a full KB refresh. Read `CLAUDE.md`, `docs/DATA_SOURCES.md` and `docs/KB_SCHEMA.md` first.

## Steps

1. **Check source access.** Fetch the home page of each source (KQM, Game8, GameWith). Update `kb/meta.json` → `sources.<site>.status` (`ok` / `blocked` / `changed`) and `lastChecked`. If all three are blocked, stop, log the blocker in `docs/PROGRESS_LOG.md`, and tell the user which domains to allow.

2. **Determine current version.** From Game8's version/banner pages (fallback: GameWith), get the live version number and release date. Only released content counts; ignore "upcoming" and leak pages.

3. **Build the diff.** Fetch the full lists:
   - Characters list (Game8 "All Characters" list; cross-check GameWith).
   - Weapons list per type.
   - Artifact sets list.
   Compare against `kb/characters/`, `kb/weapons/`, `kb/artifacts/`. Produce three lists: `new`, `changed` (release notes mention buffs/adjustments, or `provenance.gameVersion` older than the version where the entity was changed), `unchanged`.

4. **Write the plan to the user** as a table (entity, kind, action) before bulk work if more than 20 entities are affected. Otherwise proceed.

5. **Process in this order** (dependencies first):
   1. `/kb-add-artifact-set` for each new/changed set.
   2. `/kb-add-weapon` for each new/changed weapon.
   3. `/kb-add-character` for each new/changed character.
   4. `/kb-update-teams` for every new character, then a general pass for team tier changes.
   5. Update `kb/mechanics/*` if the patch adds a reaction, status, or mechanic. If the engine cannot express it, add a task to `docs/OPEN_QUESTIONS.md` / progress log noting a hook or schema change is required.

6. **Validate.** Run `/kb-validate`. Fix failures caused by this sync.

7. **Record.**
   - `kb/meta.json`: `gameVersion`, `lastSync`, `counts`.
   - `kb/CHANGELOG.md`: new section `## <version> sync — <date>` listing added/changed ids and conflicts found.
   - `docs/PROGRESS_LOG.md`: new top entry (format in that file), including source status and anything left `low` confidence.

8. **Commit** with prefix `kb:` (e.g. `kb: sync 7.1 — add vesna, vodyanitsa, 2 weapons`). Push to the working branch.

## Rules
- Fetch one page at a time per site. Do not parallel-crawl one domain.
- Never overwrite a `high` confidence field with data from a single source that disagrees; record a conflict instead.
- If the session runs out of budget, commit what is validated and list remaining entities in the progress log under "Next".
