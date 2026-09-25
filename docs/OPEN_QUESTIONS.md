# Open Questions

Answer inline (edit the "Answer" column) or tell the agent. Resolved items move to `docs/PROGRESS_LOG.md`.

| # | Question | Default if unanswered | Answer |
|---|---|---|---|
| 1 | Default weapon refinement: R1 for all, or R1 for 5★ and R5 for 4★/3★? | R1 for 5★, R5 for 4★/3★ | |
| 2 | May supplementary numeric sources (Fandom wiki, genshin-db, gcsim) be used for frame/ICD/multiplier data the three guide sites lack? | No; mark fields `low` confidence | |
| 3 | Build our own TypeScript engine, or embed gcsim (Go → WASM) as the engine and use our KB for team/weapon lists? | Own TS engine, gcsim used only for cross-checking | |
| 4 | Import owned characters from an in-game UID via Enka.Network showcase? (needs network at runtime; showcase only lists up to 12 characters) | No; manual roster + JSON import/export | |
| 5 | Level 100 / beyond-90 progression: include if present in the current version? | Lv 90 default, Lv 100 optional per character | |
| 6 | Artifact assumption: KQM Standards (KQMS) substat pool, or "user enters own stats" only? | KQMS default + manual override | |
| 7 | Hosting: GitHub Pages from this repo? | Yes | |
| 8 | Include GameWith JP (gamewith.jp) as well as the EN site? | EN only; JP for new characters if EN lacks them | |
| 9 | Should team finder enumerate outside known archetypes (anchor + pruning), or only rank known archetypes? | Both, anchor mode opt-in | |
