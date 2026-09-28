# KB Changelog

Newest first. One entry per KB change or sync.

## 2026-09-28 — Chevreuse, Durin, Varesa, Iansan hand-written; Varesa Overloaded team
- chevreuse (`medium`, hook `chevreuse`): Overcharged Ball Skill (assumed always overcharged), Arkhe/Surging Blade, burst grenade + 8 mines, A1 Overloaded RES shred (Pyro+Electro-only comp), A4 team ATK% from Max HP, C1 energy, C2 bombs. Not modelled: C4 (cooldown bypass), C6 (heal-triggered, healing untracked).
- durin (`medium`, hook `durin`): Dragon of White Flame burst form only (20 periodic ticks, A2/Primordial Fusion stacking, A1 Overloaded RES shred, C1 party flat-damage stacks, C2 team DMG%, C4 +40% burst DMG, C6 partial DEF ignore). Dragon of Dark Decay (a personal Vaporize/Melt form for a different team) not modelled.
- varesa (`medium`, hook `varesa`): Skill/Plunge/Fiery Passion forms, A1 ground-impact flat ATK bonus (the core of her kit, gated by a 5 s post-Skill window — new `hitTalent` field on `extraActions` lets a Plunge-type action keep `dmgBonus.plunge`-style tagging while scaling off the Normal Attack talent level), A2 ATK stacks from an ally's Nightsoul Burst (Iansan recognised), C1/C2/C4/C6. Nightsoul point economy not tracked as a resource (rotation script assumes the standard fill-then-plunge opener); Volcano Kablam and Apex Drive not modelled.
- iansan (`medium`, hook `iansan`): Thunderbolt Rush, Swift Stormflight (A1 self ATK%), burst's flat ATK buff to whoever is on-field (assumes high Nightsoul points), C2 team extension. C1/C4/C6 not modelled (need the Nightsoul point-restoration economy).
- Engine: `extraActions[name].hitTalent` (schema + `src/schema/character.ts`, `src/engine/kb.ts`) lets an extra action's hits carry a different `talent` tag than the one used to pick its multiplier/level table.
- Team `varesa-overloaded` (Chevreuse, Iansan, Durin, Varesa; own rotation, `low`). Simulated Relaxed DPS: 11,426 (vs. 7,744 for the "Varka pyro" comparison team on the same KB, +48%) — up from 7,582 before these four characters were hand-written (all baseline, no team synergy modelled).

## 2026-09-27 — Silver Light passive, Odette hand-written, Odette team
- silver-light (`medium`): passive modelled (Elemental Mastery +52/65/78/91/104 per Elemental Skill use, 12 s, 2 independent stacks; Coda counts as a skill use). Obtain corrected from `gacha` (guess) to `event` with R5 free (Silverwing in Pursuit of the Moon, 7.1, until 2026-10-12; 4 Tea-Scented Tassels), read from web-search summaries of Game8 / allthings.how. No gcsim implementation exists yet.
- odette (`medium`, hand-written, hook `odette`): skill, Coda at Dawn's Tolling (extra action `coda`), Solo Dance Double (Plume/Wing moves), upgraded Stellar-Conduct moves, Marvelous Splendor (A1), Pathetique (A4), Stellar Jubilee base bonus (team), Snow Swan's Dream. Frames/timings from gcsim @ 488e223; 16/16 multiplier tables match gcsim. Not modelled: Stellar Swirl radiance, C1/C2/C4/C6. Replaces the baseline record (which put every skill label into one skill action).
- reactions.json: `stellarConduct.directMultTable` (gcsim StellarconductMult).
- Team `odette-stellar-conduct` (Alyosha, Fischl, Odette, Sandrone; own rotation, `low`).

## 2026-09-27 — Ascension CRIT stats no longer include the base CRIT
- 42 characters with a CRIT Rate or CRIT DMG ascension stat were stored with genshin-db's `specialized` value, which includes the base 5% CRIT Rate / 50% CRIT DMG that the engine adds itself. Stored values corrected: CRIT Rate 0.242 → 0.192, CRIT DMG 0.884 → 0.384 (e.g. Hu Tao, Yelan, Ayaka, Neuvillette, Furina, Odette). Importers now subtract the base (`ascensionValue` in scripts/kb-import/lib.ts).
- Effect: those characters' CRIT was overstated by 5 pts CR or 50 pts CD. Golden value for hu-tao-double-hydro-zhongli re-recorded (Relaxed 31,063 → 28,086 DPS). raiden-national unchanged.

## 2026-09-26 — Sandrone and Alyosha rewritten from in-game text
- sandrone: skill = 2 Prism Shots, burst = 3 Bombardments + Ray; Radiance Stellar-Conduct forms as new hit field `stellar` (2nd Prism Shot, Ray). Not modelled: Fagio/Decoding, Stellar Swirl, constellations.
- alyosha: burst ticks (Field + Tugarin every 2 s for 14 s, hook `alyosha`), A2 ER-based skill/burst DMG%, Hunter's Precision. Not modelled: Hunter's Mark state, healing, constellations.
- Both: no gcsim/KQM frame data exists, frames remain estimates, `low`.

## 2026-09-25 — Cryo Traveler, Stellar-Conduct, Fischl/Sandrone/Alyosha upgrades
- traveler-cryo (hand-written, `high`: 11/11 multiplier tables match gcsim, Lv 90 base stats match KeqingMains; male frames; hook `travelercryo`). Not modelled: Stellar Swirl, True Moon, C1, C6.
- reactions.json: stellarConduct implemented (gcsim numbers). fischl: skill, burst, Oz and A4 rewritten from gcsim (hook `fischl`, patch). sandrone: Stellar-Conduct enabling passive and EM passive only. alyosha: Hunter's Precision ATK% only.
- Teams: sandrone-stellar-conduct-traveler and sandrone-stellar-conduct-kaeya (own rotation, `low`).

## 2026-09-25 — Baseline import of everything released (M7, baseline)
- Characters: all 113 remaining genshin-db characters (through 7.1: Vesna, Vodyanitsa, Alyosha, Odette, Zibai, Columbina, Varka, ...), except the Traveler (per-element kits; not imported yet) and test dummies. Total 120. Generated by `scripts/kb-import/import-bulk-characters.ts`: stats and multipliers from genshin-db; frames from gcsim where the Go source parses (normal attacks for most, skill/burst hitmarks for few), otherwise borrowed from a same-weapon-type donor and marked `low`. Passives, constellations and special mechanics are NOT modelled (text kept). Confidence: 28 high (7 hand-written + 21 fully parsed with KQM-confirmed base stats), 22 medium, 70 low.
- Weapons: 243 (all with a Lv 90 stat table). Base ATK and secondary stat are exact; passives are NOT modelled except the 11 hand-written weapons. `low` when a passive exists.
- Artifact sets: 59. 2-piece bonuses parsed where they are plain stats; 4-piece bonuses NOT modelled except the 4 hand-written sets.
- Recommended main stats parsed from KeqingMains quick guides where the Sands/Goblet/Circlet row could be read, otherwise a generic template (flagged).

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
