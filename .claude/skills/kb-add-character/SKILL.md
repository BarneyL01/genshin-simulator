---
name: kb-add-character
description: Add or refresh one Genshin Impact character in the KB (base stats, talent multipliers, frames, particles, passives, constellations C1-C6 as structured effects, recommended weapons and artifact sets). Use when the user names a character to add/update, or when kb-sync-patch finds a new or changed character.
---

# kb-add-character <name>

Output: `kb/characters/<id>.json` matching `docs/KB_SCHEMA.md` → Character.

## Steps

1. **Resolve id** (kebab-case English name). Read the existing file if present; keep fields that are `high` confidence unless a source shows a change.

2. **genshin-db (exact numbers)**. The package is a devDependency from M1; before that, install it in a scratch folder (`npm i genshin-db`). Use `characters(name)` for rarity, element, weapon type, version, `stats(90)` (Lv 90 only; leave `lv100` null); `talents(name)` for multipliers at every level (parse `attributes.labels` + `parameters`); `constellations(name)` for C1–C6 text/values. This is the primary source for numbers.

3. **Game8 character page** → name, rarity, element, weapon type, release version, Lv 90 base HP/ATK/DEF, ascension stat, talent scaling tables (all levels shown), passive and constellation text, recommended weapons and artifact sets (ordered), best teams (names only — teams are handled by `/kb-update-teams`).

4. **GameWith character page** → cross-check base stats and talent multipliers against genshin-db; recommended weapons/sets. Record any difference > 0.5% in `provenance.conflicts`.

5. **Frames from gcsim** (see `docs/DATA_SOURCES.md` for clone command and file locations). For each talent record hitmark(s), cancel frames to each next action (attack, charge, skill, burst, dash, jump, swap, walk), ICD tag/group, gauge durability (gcsim uses 25 = 1U), particle count/ICD/delay. Record the file URL with commit hash in `frames.source`. Read only; do not copy code.

6. **KeqingMains** (character quick guide) → cross-check frames, snapshot behaviour, mechanics notes, recommended weapons/sets with calc notes. If neither gcsim nor KQM covers the character, estimate frames from a same-weapon-type character with a similar kit, set `dataConfidence: "low"`, and add an `assumptions` entry naming the donor character.

7. **Convert text to effects.** For every passive, constellation and talent buff write Effect DSL entries (see schema). For each:
   - Pick `trigger`, `target`, `stat`, `value`/`scaling`, `duration` (frames), `maxStacks`.
   - If it cannot be expressed, reference a hook id `<char>.<name>` in `hooks`, set `needsHook: true`, and describe the required behaviour in the effect's `assumption`.
   - Constellations are stored but only applied by the engine when the roster's constellation ≥ level.

7b. **Usual combo.** Write `usualCombo` variants (off-field and/or on-field) from the KQM character guide's standard combo; fall back to Game8/GameWith "how to play" sections. Each variant is a short action list. Mark the default variant first. If no source gives one, write the minimal kit usage (skill, burst) and add an `assumptions` entry.

8. **Recommended builds.** Store `recommended.weapons` and `recommended.artifacts` as ordered lists with `source` per item. Every referenced weapon/set id must exist; if not, run `/kb-add-weapon` or `/kb-add-artifact-set` first.

9. **Provenance.** One `provenance.sources` item per page used (site, url, retrieved date, fields). Set `gameVersion` to the live version.

10. **Confidence.** `high` only if stats/multipliers match in two sources AND frames came from gcsim or KQM. Otherwise `medium`/`low`.

11. Run `/kb-validate`. Append to `kb/CHANGELOG.md`. If called standalone (not from kb-sync-patch), add a `docs/PROGRESS_LOG.md` entry and commit with prefix `kb:`.

## Rules
- Numbers only from sources; do not estimate multipliers. Missing → `null` + assumption.
- Do not copy guide prose. Short passive/constellation text is fine as `text`.
- Travelers: one file per element (`traveler-<element>`).

## Tooling in this repo

The steps above can be run with the importers: write `scripts/kb-import/specs/<id>.ts` (frames and effects transcribed from gcsim/KQM, numbers pulled from genshin-db by parameter key) and run `npm run kb:import:<kind> -- <id>`. The importer cross-checks multiplier tables against gcsim and Lv 90 base stats against KeqingMains, and sets `dataConfidence: high` only when both agree. Use `npm run kb:inspect -- "<name>"` to see genshin-db's labels and text. After importing, run `npm run kb:validate && npm test`.
