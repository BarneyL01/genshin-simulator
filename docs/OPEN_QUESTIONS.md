# Open Questions

Answer inline (edit the "Answer" column) or tell the agent. Resolved items move to `docs/PROGRESS_LOG.md`.

| # | Question | Default if unanswered | Answer |
|---|---|---|---|
| 9 | Should team finder enumerate outside known archetypes (anchor + pruning), or only rank known archetypes? | Both, anchor mode opt-in | |

## Resolved

| # | Question | Decision (2026-09-25) |
|---|---|---|
| 1 | Default weapon refinement | R1 for every weapon. Roster lets the user set R1–R5 per owned weapon. Event/free weapons show a hint that R5 is obtainable. |
| 2 | Supplementary numeric sources | Approved. Use for timing and exact numbers. Execution must be relaxed (user has ~300 ms ping) but deterministic. |
| 3 | Engine | Own TypeScript engine. Must run with no LLM. |
| 4 | Roster input | Manual tick boxes (no UID import). |
| 5 | Beyond Lv 90 | Excluded for now; roadmap item. |
| 6 | Artifact stats | KQM Standards pool only; manual stat entry is a roadmap item. |
| 7 | Hosting | GitHub Pages, plus local `npm run dev` for debugging. |
| 8 | GameWith JP | EN only. |
| 10 | Relaxed delay | 18 frames (300 ms) per action and swap. |
| 11 | gcsim use | Reference for numbers only; no code copied. |
