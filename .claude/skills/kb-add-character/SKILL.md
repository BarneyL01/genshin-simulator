---
name: kb-add-character
description: Add or refresh one Genshin Impact character in the KB (base stats, talent multipliers, frames, particles, passives, constellations C1-C6 as structured effects, recommended weapons and artifact sets). Use when the user names a character to add/update, or when kb-sync-patch finds a new or changed character.
---

# kb-add-character <name>

Output: `kb/characters/<id>.json` matching `docs/KB_SCHEMA.md` → Character.

## Steps

1. **Resolve id** (kebab-case English name). Read the existing file if present; keep fields that are `high` confidence unless a source shows a change.

2. **Game8 character page** → name, rarity, element, weapon type, release version, Lv 90 base HP/ATK/DEF (and Lv 100 if present), ascension stat, talent scaling tables (all levels shown), passive and constellation text, recommended weapons and artifact sets (ordered), best teams (names only — teams are handled by `/kb-update-teams`).

3. **GameWith character page** → cross-check base stats and talent multipliers; recommended weapons/sets. Record any difference > 0.5% in `provenance.conflicts`.

4. **KeqingMains** (character quick guide in library.keqingmains.com, or keqingmains.com) → frame data (hitmarks, cancels), ICD tags, gauge units, particle counts and ICD, snapshot behaviour, mechanics notes, recommended weapons/sets with calc notes. If KQM has no page yet, set frames `null`, `dataConfidence: "medium"` or `"low"`, and add an `assumptions` entry.

5. **Convert text to effects.** For every passive, constellation and talent buff write Effect DSL entries (see schema). For each:
   - Pick `trigger`, `target`, `stat`, `value`/`scaling`, `duration` (frames), `maxStacks`.
   - If it cannot be expressed, reference a hook id `<char>.<name>` in `hooks`, set `needsHook: true`, and describe the required behaviour in the effect's `assumption`.
   - Constellations are stored but only applied by the engine when the roster's constellation ≥ level.

6. **Recommended builds.** Store `recommended.weapons` and `recommended.artifacts` as ordered lists with `source` per item. Every referenced weapon/set id must exist; if not, run `/kb-add-weapon` or `/kb-add-artifact-set` first.

7. **Provenance.** One `provenance.sources` item per page used (site, url, retrieved date, fields). Set `gameVersion` to the live version.

8. **Confidence.** `high` only if stats/multipliers match in two sources AND frames came from KQM. Otherwise `medium`/`low`.

9. Run `/kb-validate`. Append to `kb/CHANGELOG.md`. If called standalone (not from kb-sync-patch), add a `docs/PROGRESS_LOG.md` entry and commit with prefix `kb:`.

## Rules
- Numbers only from sources; do not estimate multipliers. Missing → `null` + assumption.
- Do not copy guide prose. Short passive/constellation text is fine as `text`.
- Travelers: one file per element (`traveler-<element>`).
