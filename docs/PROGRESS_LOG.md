# Progress Log

Append-only. Newest entry at the top. Every agent session that changes code, docs or the KB adds an entry.

Entry format:

```
## YYYY-MM-DD — <short title>
- Milestone: M#
- Done: ...
- KB changes: ... (or "none"; details in kb/CHANGELOG.md)
- Tests / validation: ... (commands run and result)
- Blockers: ...
- Next: ...
```

---

## 2026-09-25 — Decisions applied, timing sources found

- Milestone: M0 (Planning)
- Decisions (from user, removed from open questions):
  1. Weapons default to R1; roster has an R1–R5 selector per weapon; event weapons flagged with an "R5 obtainable" hint (`obtain.freeRefinement` in KB).
  2. Supplementary sources approved. Execution must be relaxed (user ping ~300 ms) but deterministic → added "Relaxed" execution profile (18-frame delay per action and swap).
  3. Own TypeScript engine; runs without an LLM.
  4. Roster entry by tick boxes; no UID import.
- Done:
  - Found and checked timing/number sources: genshin-db 5.2.14 (npm, MIT, includes 7.1 content) and gcsim (git clone works, AGPL-3.0 since 2026-09-19, 111 characters, no 7.1 characters yet). Fandom wiki blocked.
  - Verified genshin-db data for the 7.1 event sword Silver Light: 4★ sword, Lv 90 base ATK 509.6, ATK% 41.3%, passive +52/65/78/91/104 EM per stack for 12 s after Elemental Skill, max 2 independent stacks.
  - Updated `docs/PLAN.md` (roster section, execution profile, risks), `docs/SIMULATION.md` (execution profile), `docs/KB_SCHEMA.md` (`obtain`, frame provenance, roster format), `docs/DATA_SOURCES.md` (source priority, access table), `CLAUDE.md`, and the skills (genshin-db + gcsim steps).
  - Added open questions 10 (delay value) and 11 (gcsim reference-only use).
- KB changes: none.
- Tests / validation: none (no code yet).
- Blockers: KQM, Game8, GameWith still blocked in the cloud environment; team/rotation data depends on them.
- Next: M1 skeleton (Vite + React + TS, zod schemas, `kb:validate`, genshin-db as devDependency).

---

## 2026-09-25 — Initial planning

- Milestone: M0 (Planning)
- Done:
  - Created `CLAUDE.md`, `docs/PLAN.md`, `docs/KB_SCHEMA.md`, `docs/DATA_SOURCES.md`, `docs/SIMULATION.md`, `docs/OPEN_QUESTIONS.md`, this log.
  - Created KB maintenance skills in `.claude/skills/`: `kb-sync-patch`, `kb-add-character`, `kb-add-weapon`, `kb-add-artifact-set`, `kb-update-teams`, `kb-validate`.
  - Confirmed via web search that the live game version is 7.1 (released 2026-09-23; new 5★ Vesna and Vodyanitsa). 7.0 added Odette and 4★ Alyosha.
- KB changes: none (no `kb/` data yet).
- Tests / validation: none (no code yet).
- Blockers:
  - keqingmains.com, library.keqingmains.com, game8.co and gamewith.net are blocked by the cloud environment's network egress policy. No data was pulled. Allow these domains in the environment settings, or run the skills from a local Claude Code install.
  - Open questions in `docs/OPEN_QUESTIONS.md` need answers before M1.
- Next: user reviews plan → M1 skeleton (Vite + React + TS, zod schemas, `kb:validate`).
