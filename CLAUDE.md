# CLAUDE.md

Genshin Impact 4-person team simulator. A static web app (no backend, no LLM at runtime) that simulates team rotations, buff uptimes and damage from a JSON knowledge base (KB). An LLM agent keeps the KB current using the skills in `.claude/skills/`.

## Read first

| File | Purpose |
|---|---|
| `docs/PLAN.md` | Architecture, milestones, risks |
| `docs/PROGRESS_LOG.md` | Current state and history — read the top entry before starting work |
| `docs/OPEN_QUESTIONS.md` | Decisions pending from the user |
| `docs/KB_SCHEMA.md` | Shape of every KB file and the Effect DSL |
| `docs/DATA_SOURCES.md` | Which source owns which field; access status |
| `docs/SIMULATION.md` | Engine model and known simplifications |

## Current status

Milestone **M0 (planning)**. No application code or KB data exists yet. Build commands below are the target once M1 is done.

## Commands (target, from M1)

```bash
npm install
npm run dev            # Vite dev server
npm run build          # static build to dist/
npm test               # Vitest: engine unit + golden tests
npm run kb:validate    # zod schema + cross-reference + provenance checks on kb/
npm run kb:index       # regenerate kb/index.json and kb/meta.json counts
npm run lint && npm run typecheck
```

## Rules

### Runtime
- The web app must work with no network access to any LLM or API. KB is bundled JSON.
- `src/engine/` has no DOM or React imports; it runs in a Web Worker and in Vitest.
- Default assumptions: all characters C0, weapon refinement per `docs/OPEN_QUESTIONS.md` #1, Lv 90, talents 9/9/9 (configurable).

### Knowledge base
- Edit KB only through the skills (or following their steps). Do not hand-invent numbers.
- Every KB record needs `provenance` (source URL + retrieved date + game version) and `dataConfidence`.
- Conflicts between sources are recorded in `provenance.conflicts`, never silently resolved.
- Only released content. No leaks, beta or datamined unreleased kits.
- Effects are data (Effect DSL). If a mechanic needs code, add a named hook in `src/engine/hooks/`, set `needsHook: true`, and add a test.
- After any KB change: run `/kb-validate`, append to `kb/CHANGELOG.md`.

### Logging (required)
- Every session that changes code, docs or KB appends an entry to the **top** of `docs/PROGRESS_LOG.md` using the format in that file: milestone, done, KB changes, tests run with results, blockers, next.
- When an open question is answered, move it from `docs/OPEN_QUESTIONS.md` into the log entry and apply the decision to the docs.
- When a milestone completes, update "Current status" in this file.

### Code style
- TypeScript strict. zod schemas in `src/schema/` are the source of truth for KB types; update `docs/KB_SCHEMA.md` when they change.
- Frames (60 fps) for all time values inside the engine.
- Percentages as fractions (0.466, not 46.6).

## KB maintenance skills

| Skill | Use when |
|---|---|
| `/kb-sync-patch` | A new game version released, or a periodic refresh. Finds what is missing/changed and calls the others. |
| `/kb-add-character <name>` | Add or refresh one character (stats, talents, passives, constellations, best weapons/sets). |
| `/kb-add-weapon <name>` | Add or refresh one weapon (stats, passive as effects). |
| `/kb-add-artifact-set <name>` | Add or refresh one artifact set. |
| `/kb-update-teams [character]` | Refresh best teams and rotations from KQM, Game8, GameWith. |
| `/kb-validate` | Run schema/reference checks and golden tests; fix or report failures. |

Sources: KeqingMains, Game8, GameWith (see `docs/DATA_SOURCES.md`). In the Claude Code cloud environment these domains were blocked on 2026-09-25; they must be added to the environment's allowed domains, or the skills run locally.

## Git
- Commit KB syncs separately from code changes. Commit message prefix: `kb:`, `engine:`, `ui:`, `docs:`, `build:`.
