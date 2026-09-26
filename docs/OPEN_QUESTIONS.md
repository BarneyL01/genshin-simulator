# Open Questions

Answer inline (edit the "Answer" column) or tell the agent. Resolved items move to `docs/PROGRESS_LOG.md`.

| # | Question | Default if unanswered | Answer |
|---|---|---|---|
| 12 | Black Tassel R5 in KeqingMains' Hu Tao weapon table is 92% of Blackcliff Pole; our engine gives ~82%. Black Tassel is the only listed weapon whose Paramita ATK bonus hits the "400% of Base ATK" cap. Does KQM's calc apply the cap the way gcsim does (Base ATK = character + weapon)? | Keep the in-game/gcsim rule; deviation is asserted in `tests/kqm-weapon-check.test.ts`. | |
| 13 | KQM Standards: KeqingMains' own KQMS page was not found. Numbers are taken from gcsim's substat optimizer (20 liquid, cap 10, 2 fixed, per-roll values). Is that the definition you want? | Use gcsim's implementation. | |
| 16 | Baseline characters (113) ignore passives and constellations. Which should be upgraded first? Also: the Traveler is not imported (one kit per element). | Upgrade by popularity in KeqingMains tier lists; Traveler later. | |
| 17 | Does Fischl's A4 (Electro-related reaction) count Stellar-Conduct? We assume yes. Sandrone's and Alyosha's kits are mostly unmodelled (no gcsim source): should they be written from the in-game text and KeqingMains frame tables? | Assume yes; upgrade both from KQM frame tables when wanted. | |
| 14 | M4 planned ~15 characters; 7 are in (Raiden, Xiangling, Xingqiu, Bennett, Hu Tao, Yelan, Zhongli) with 2 teams. Which characters/teams next? (`/kb-add-character` now has importer tooling in `scripts/kb-import/`.) | Extend from the KeqingMains quick-guide example teams. | |
| 15 | Game8 / GameWith team ranks are not recorded (`sourceRank` empty). Read those pages too? | Later, via `/kb-update-teams`. | |

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
| 9 | Team modes | Mode A: rank known teams. Mode B: user picks 4 characters and their order; each uses its usual combo; approximate DPS. No automatic team search. |
