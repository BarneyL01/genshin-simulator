# Open Questions

Answer inline (edit the "Answer" column) or tell the agent. Resolved items move to `docs/PROGRESS_LOG.md`.

| # | Question | Default if unanswered | Answer |
|---|---|---|---|
| 5 | Level 100 / beyond-90 progression: include if present in the current version? | Lv 90 default, Lv 100 optional per character | |
| 6 | Artifact assumption: KQM Standards (KQMS) substat pool, or "user enters own stats" only? | KQMS default + manual override | |
| 7 | Hosting: GitHub Pages from this repo? | Yes | |
| 8 | Include GameWith JP (gamewith.jp) as well as the EN site? | EN only; JP for new characters if EN lacks them | |
| 9 | Should team finder enumerate outside known archetypes (anchor + pruning), or only rank known archetypes? | Both, anchor mode opt-in | |
| 10 | Execution profile default: "Relaxed" (fixed delay per action, see `docs/SIMULATION.md`) with the delay value 18 frames (300 ms)? | Yes | |
| 11 | gcsim changed license to AGPL-3.0 on 2026-09-19. Plan: read it only as a reference for numbers (frames, ICD, particles), never copy its code. OK? | Yes | |

## Resolved

| # | Question | Decision (2026-09-25) |
|---|---|---|
| 1 | Default weapon refinement | R1 for every weapon. Roster lets the user set R1–R5 per owned weapon. Event/free weapons show a hint that R5 is obtainable. |
| 2 | Supplementary numeric sources | Approved. Use for timing and exact numbers. Execution must be relaxed (user has ~300 ms ping) but deterministic. |
| 3 | Engine | Own TypeScript engine. Must run with no LLM. |
| 4 | Roster input | Manual tick boxes (no UID import). |
