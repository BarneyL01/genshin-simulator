# KB Changelog

Newest first. One entry per KB change or sync.

## 2026-09-25 — Seed KB (M4, partial)
- Characters (all `high`: multiplier tables match gcsim, Lv 90 base stats match KeqingMains): raiden-shogun, xiangling, xingqiu, bennett, hu-tao, yelan, zhongli. Frames, ICD, particles from gcsim @ 3d48bd5; recommended weapons/sets/main stats and combos from KeqingMains quick guides.
- Weapons: the-catch (R5 free via fishing, per KQM), engulfing-lightning, staff-of-homa, aqua-simulacra, aquila-favonia, favonius-sword/warbow/lance, black-tassel, blackcliff-pole, white-tassel (`medium`: passives from genshin-db, formulas checked against gcsim).
- Artifact sets: emblem-of-severed-fate, noblesse-oblige, crimson-witch-of-flames, tenacity-of-the-millelith (`medium`, genshin-db text).
- Teams: raiden-national, hu-tao-double-hydro-zhongli (`medium`, KeqingMains sample rotations translated to scripts).
- Mechanics: `kqms.json` (KQM Standard as implemented by gcsim); `icd.json` regenerated (65 groups).

## 2026-09-25 — Mechanics files (M3)
- Added `kb/mechanics/reactions.json`, `icd.json`, `constants.json` (aura tax and decay, EM curves, level base Lv90, all reaction multipliers, consumption coefficients, energy rules, default ICD group).
- Sources: gcsim @ 3d48bd5 (numbers only), KeqingMains transformative/amplifying/additive/gauge-theory pages. Multipliers agree across both. Lunar-Charged is gcsim-only (KQM has no page). Unimplemented: crystallize, stellarSwirl, lunarCrystallize, lunarBloom, stellarConduct.

## 2026-09-25 — Empty KB
- Directory layout and `meta.json` created. No records yet.
