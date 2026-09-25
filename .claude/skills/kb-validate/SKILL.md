---
name: kb-validate
description: Validate the Genshin KB and engine against it. Runs schema, cross-reference and provenance checks plus golden simulation tests, then fixes KB-caused failures or reports them. Use after any KB edit, before committing KB changes, or when the user asks to check data integrity.
---

# kb-validate

## Steps

1. If `package.json` does not exist yet (milestone < M1), do a manual check instead: every JSON file in `kb/` parses, has `id`, `provenance.sources[*].url`, `provenance.sources[*].retrieved`, `dataConfidence`; all referenced ids exist. Report results and stop.
2. Run:
   ```bash
   npm run kb:validate
   npm run kb:index
   npm test
   ```
3. For each failure, classify:
   - **KB data error** (bad reference, missing field, wrong unit such as 46.6 instead of 0.466, seconds instead of frames) → fix the KB file.
   - **Missing hook** (`needsHook: true` with no implementation) → do not fix silently; list it in the report and in `docs/PROGRESS_LOG.md` "Blockers".
   - **Golden test drift** after a KB change → check whether the source changed (patch buff/nerf). If yes, update the golden value with a note in `kb/CHANGELOG.md`. If no, the KB edit is wrong; fix it.
   - **Engine bug** → report; do not change engine code inside a KB sync unless the user asked.
4. Re-run until clean or only reportable items remain.
5. Output a short table: check, result, count, action taken.
6. Also print the coverage report from `kb:index`: entities by `dataConfidence`, entities with unimplemented hooks.
