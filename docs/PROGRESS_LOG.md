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

## 2026-10-07 — Element colours and rarity stars on characters

- Milestone: M8 (UI).
- Done: theme-aware `--el-*` element colours and `--rarity-5` (gold) / `--rarity-4` (purple) tokens in `src/index.css` (each >= 3:1 on the surface in light and dark). Roster rows show a 4 px element accent bar, a coloured element name with dot, and five gold or four purple stars (`Stars`, `ElementTag` in `src/ui/Common.tsx`); weapons use the same stars; Custom-team chips show an element dot and a gold star for 5-star characters. `ELEMENT_COLOR` now returns CSS variables, so the hit log dots follow the theme too.
- KB changes: none.
- Tests / validation: tsc, lint, `npm test` (177) clean; checked at 390 px in light and dark. The first push of this change broke `npm run e2e` (the chip's star was text inside the label, so exact-name lookups of 5-star characters timed out); fixed in the next commit by drawing the star with CSS generated content. `npm run e2e` ok after the fix.
- Blockers: none. Next: none.

---

## 2026-10-07 — UI redesign to Material 3, mobile first

- Milestone: M8 (UI).
- Context: user asked for a review of the live UI against Material 3, especially on mobile, and a design update. The deployed site could not be opened from this cloud session's Chromium (egress-proxy CA not trusted; TLS verification was not bypassed), so the review used a local build of the same branch at 390x844, 700 and 1200 px.
- Review findings (before): 1,100 of 1,100 interactive controls on Roster below the 48 px touch target (13 px checkboxes, ~24 px selects/inputs); desktop-style folder tabs wrapping onto two rows on phones; Roster an 18,412 px scroll (121 cards each carrying editing controls, 243 weapons, no search or filter); hard-coded Tailwind slate/blue with no M3 roles, type scale, shape scale or dark theme; dev build stamp the most prominent header element; 9-column result tables and an SVG timeline whose text rendered at about 7 px on a phone.
- Done:
  - Design system: M3 colour roles generated from seed #4f5bd5 (material-color-utilities, SchemeTonalSpot) for light and dark, custom success/warning roles, M3 type scale, shape scale, elevation, state layers, focus ring, reduced-motion support, window size classes (compact <600, medium 600, expanded 840, large 1200). Tailwind's default palette is removed so only role colours exist.
  - Shell: top app bar, bottom navigation bar (compact) / navigation rail (>=600 px) with short labels Roster / Teams / Custom / Weapons / Backup; build stamp moved to the footer; `viewport-fit=cover`, safe-area insets and theme-color meta.
  - Primitives (`src/ui/Common.tsx`, `src/ui/Icon.tsx`): filled/tonal/outlined/text buttons, icon button, extended FAB (shrinks to an icon once results are shown), filter chips, segmented button, scrollable primary tabs, filled select and text fields, search bar, check/switch rows, expandable list items, cards, notices, linear progress, stacked bar. Inline Material icons; no font or network dependency.
  - Roster: search, element and Owned filter chips, one list row per character with editing controls only for owned characters, weapons in a collapsed section with type chips and search (60 rows per page).
  - Teams: M3 selection list with missing members as supporting text, result cards with a stacked per-character bar, details inline, FAB for Compare. Custom: filter chips with search, per-character order cards with 48 px move buttons, save card, FAB. Weapons: stacked fields, result cards on compact and table on >=840 px. Results: segmented profile switch, scrollable tabs, per-character cards on compact and the table on >=840 px, HTML timeline with pinned row labels (replaces the SVG), buff-timeline labels wrap to two lines.
  - Fixed during verification: search icon rendering at full width (Icon lost its default size when given a className); filter-chip touch target was clipped by its scroll container (now a 48 px label); Icon now always has a size; "C0" truncated in the narrow constellation select (dense fields).
- Measured after (390 px, hit-tested): interactive controls below 48 px: 0 on every screen, light and dark; horizontal page overflow 0 on all screens and at 700/1200 px; Roster page height 18,412 px -> 8,573 px with all 121 characters listed (shorter with any filter or search); minimum text size 11 px.
- KB changes: none.
- Tests / validation: `npm run e2e` (local Chromium via E2E_EXECUTABLE) ok including the mobile talent-input and backup flows; `npm test` 177 pass; `npm run lint`, `npx tsc --noEmit` and `npm run build` clean. e2e updated for the renamed tabs and for talent inputs now only existing for owned characters.
- Blockers: none. Not checked: real iOS Safari / Android Chrome devices (only emulated Chromium), screen-reader behaviour beyond role/label review, and the deployed site itself (see Context).
- Next: if wanted, M3 refinements that were left out: floating (non-filled) labels on text fields, a top-app-bar scroll elevation, swipe between tabs, and persisting Roster filters.

---

## 2026-09-30 — Fixed Tighnari doing almost no damage in a custom team (2 real bugs)

- Milestone: M8 (correctness).
- Context: user built a custom team (Yaoyao with Deepwood Memories, Fischl, Kuki Shinobu, Tighnari) in the app and reported Tighnari dealing significantly less damage than the two off-field electro supports, and asked me to double-check the calculation.
- Done:
  - Reproduced with `customRunInput`/`runTeam` on the exact composition: Tighnari (1,086 DPS) was indeed behind Fischl (1,503) and Kuki-Shinobu (1,051) — clearly wrong for an Aggravate-team driver.
  - Root cause #1: `tighnari.json`'s `usualCombo` (via the patch added 2026-09-29 when his missing Charged Attack was fixed) still repeated plain physical Normal Attacks — I'd added the Charged Attack data but never pointed his combo script at it. Physical Normal Attacks get zero Quicken/Spread benefit. Fixed: on-field combo is now Skill → Burst → repeated Charged Attack.
  - Root cause #2, a real engine bug affecting every custom team in the app, not just Tighnari's: `buildCustomRotation` (`src/kb/custom.ts`) only ever expanded a `repeat` instruction for the `'normal'` action; any other repeated action (Charged Attack, an extraAction, even Skill) silently fired once and stopped, regardless of what a character's `usualCombo` specified. This has presumably been latent since Mode B custom teams were built (M5/M6) — it just never showed up before because every other hand-touched character's on-field loop happens to be a Normal Attack chain. Fixed: `repeat` now applies uniformly to any action type.
  - Re-simulated the user's exact team after both fixes: Tighnari 1,086 → 5,731 relaxed DPS (now correctly the team's top damage dealer); Fischl/Kuki-Shinobu essentially unchanged.
  - New regression test in `tests/teams.test.ts` asserting a repeated non-Normal action expands to a `repeat` block, not a single step.
- KB changes: see kb/CHANGELOG.md (2026-09-30 entry).
- Tests / validation: `npm test` 177 pass (1 new); `npm run lint` clean; `npx tsc --noEmit` clean; `npm run kb:validate` ok (431 records); `npm run build` ok.
- Blockers: none.
- Next: given `buildCustomRotation`'s repeat handling was broken for any non-Normal on-field loop until now, worth spot-checking other custom-team combos (especially any future hand-written character whose on-field playstyle isn't Normal Attacks) for the same silent-single-fire symptom.

---

## 2026-09-29 — Build stamp in the page header

- Milestone: M8 (UI).
- Done: the header shows `v<package version> · <commit sha>[+ if uncommitted] · <build time UTC>`, injected at build time by `vite.config.ts` (`__BUILD__`; in CI the sha is `GITHUB_SHA`). Version bumped to 0.2.0; bump `package.json` for each release. Pushing to `claude/keen-ride-2dw4aa` deploys via `.github/workflows/deploy.yml`.
- KB changes: none.
- Tests / validation: lint, tsc, `npm run build` clean.
- Blockers: none.
- Next: none.

---

## 2026-09-29 — Stellar Swirl reaction; Mizuki hand-written; Sandrone/Tighnari fixes; two new teams

- Milestone: M8 (KB upgrades / new mechanic).
- Context: user added Yumemizuki Mizuki to their roster and asked for (1) a Stellar Swirl team built around her and Sandrone, and (2) a Tighnari + Yaoyao Aggravate team with two electro supports of my choosing.
- Done:
  - Implemented the Stellar Swirl reaction end-to-end (previously listed as unimplemented, "needs a source other than gcsim"): `kb/mechanics/reactions.json` (new `stellarSwirl` entry, `lunar` type) and `src/engine/reactions.ts` (new `stellarSwirl()` method, crit-capable via the same expected-value pattern as Lunar-Charged). Gated on a Stellar-Jubilee-passive character being in the team (not on an already-active Polestar Field, unlike Stellar-Conduct — confirmed via web search since gcsim and every reachable KQM/wiki/theorycrafting site are blocked from this cloud session). Retrofitted Varka's A2/C4 and Sucrose's A1 hooks to also recognise it (their kit text already says "Swirl or Stellar Swirl").
  - yumemizuki-mizuki: hand-written spec + hook (`mizuki`) from gcsim (8/8 multiplier tables) — Dreamdrifter, its cloud pulses, burst snack ticks, and her real value: a team-wide EM-scaled Swirl/Stellar-Swirl reaction DMG bonus using the engine's new `reactionBonus.stellarSwirl` stat.
  - sandrone (patch): added the other half of her Stellar Jubilee passive — a team-wide ATK-scaled Stellar Swirl reaction DMG bonus — to the already-existing Stellar-Conduct marker.
  - tighnari (patch): **fixed a real bug** — his Charged Attack ("Wreath Arrow"), the entire point of a Quicken/Aggravate team, was completely absent from the KB. The bulk importer's charged-attack detector only matches literally-named "Charged Attack DMG"/"Fully-Charged Aimed Shot" labels; his own "Wreath Arrow DMG" label didn't match, so the slot silently built empty. Patched in from gcsim. Flagged as likely affecting other bow characters too, not audited further this session.
  - New teams: `sandrone-stellar-swirl-mizuki` (Sandrone/Mizuki/Fischl/Kaeya) and `tighnari-yaoyao-aggravate` (Tighnari/Yaoyao/Fischl/Beidou). Verified end-to-end with `npm run sim:team`: both produce sensible, non-degenerate per-character DPS splits.
  - New tests: `tests/reactions.test.ts` (+3, Stellar Swirl), `tests/sandrone-stellar-swirl.test.ts` (2), `tests/mizuki-team.test.ts` (4), `tests/tighnari-aggravate.test.ts` (2) — 11 new, all passing.
- KB changes: see kb/CHANGELOG.md (2026-09-29 entry, "Stellar Swirl reaction; Yumemizuki Mizuki hand-written; Sandrone/Tighnari fixes; two new teams").
- Tests / validation: `npm test` 176 pass; `npm run lint` clean; `npx tsc --noEmit` clean; `npm run kb:validate` ok (431 records); `npm run build` ok.
- Blockers: Stellar Swirl's own base damage coefficient is an assumption (carried over from normal Swirl's 0.6), not independently sourced — gcsim doesn't implement it and every community site that might (keqingmains.com, genshin-impact.fandom.com, mobalytics.gg, icy-veins.com) is blocked from this cloud session's network egress. The delayed "Stellar Vortex" explosion is also unmodelled for the same reason.
- Next: if a verified Stellar Swirl coefficient becomes available (e.g. run `/kb-sync-patch` locally where KQM is reachable), correct `kb/mechanics/reactions.json`'s `stellarSwirl.multiplier`. The bulk importer's charged-attack label detector likely misses other bow characters the same way it missed Tighnari — worth a full audit. Sandrone's separate "Radiance: Stellar Swirl" personal-hit upgrade and Mizuki's C1/C4/C6-for-others remain unmodelled (engine limitations, documented in each record's assumptions).

---

## 2026-09-29 — Tier-ranking sanity check finds a bulk-import bug (Noelle "Absorption")

- Milestone: M8 (KB upgrades / correctness).
- Context: user asked to check whether the calculator's team DPS ranking is "somewhat accurate" from a tier-list point of view — do teams the community considers strong actually come out ahead of weaker ones — across at least 5 team comps built from their roster.
- Done:
  - Simulated 7 team comps spanning known tiers: Varesa Overloaded (known top-tier), Noelle Mono-Geo (known solid F2P A-tier), Keqing Hypercarry, Varka Pyro, Varka Electro, Xiangling with weak (Mona) hydro support, and a "comfort"/low-synergy team (Barbara/Amber/Kirara/Lisa) as a sanity-check floor.
  - Found a real data bug via the outlier: Noelle Mono-Geo scored 42,332 relaxed DPS, more than double the Varesa Overloaded team — implausible. Root cause: the bulk importer's `NOT_DAMAGE` label filter (`scripts/kb-import/bulk-character.ts`) excluded `absorb` but not `absorption`; Noelle's Breastplate shield-capacity label ("DMG Absorption", genuinely 770–2431% DEF as a *shield HP amount*) slipped through and was imported as a real 3rd damage hit on her Skill, dealing hundreds of times her DEF as fake damage every cast.
  - Fixed the regex (`absorb` → `absor`), re-ran the bulk importer for the 5 characters in the whole 429-record KB whose baseline records had any hit with mv > 15 (a quick audit, not just Noelle): noelle (the bug), illuga, ineffa, nefer, kinich (the latter 4 not owned by the user; their high values were confirmed genuine large burst/skill multipliers after the fix, not further bugs).
  - Re-ran the same 7-team comparison after the fix: Noelle Mono-Geo dropped from 42,332 to 1,405 relaxed DPS — now the *lowest* of the 7, which is itself inaccurate the other way (real mono-Geo Noelle+Gorou is a solid F2P team), because Noelle's own passives/constellations and Gorou's DEF/RES-shred buff are still unmodelled baseline. Final order: Varesa Overloaded (18,011) > Varka Pyro (6,138) > Varka Electro (5,658) > Xiangling weak-hydro (5,320) > Keqing Hypercarry (4,987) > Comfort team (3,009) > Noelle Mono-Geo (1,405).
- Result / open finding: the tool's *top-team* pick (Varesa Overloaded) and *bottom-team* pick (comfort team near the bottom) are directionally correct, matching community consensus. But rankings **only track real tier-list strength when all 4 team members are hand-written**; any team leaning on an unmodelled baseline character's key passive/constellation (here, Noelle's own kit and especially Gorou's DEF buff) will be significantly under-counted, sometimes enough to flip the ranking outright (as the initial bug also showed it can be over-counted). This is a modelling-completeness gap, not a new bug, and matches the known 16/121-hand-written state.
- KB changes: see kb/CHANGELOG.md (2026-09-29 entry). Side effect: noelle/illuga/ineffa/nefer/kinich lost their KeqingMains-sourced main stats on re-import (blocked from the cloud session) and fell back to the generic template — re-run `/kb-add-character` for these locally to restore sourced main stats.
- Tests / validation: `npm test` 165 pass (unchanged — no new characters/hooks added this session); `npm run lint` clean; `npx tsc --noEmit` clean; `npm run kb:validate` ok (429 records); `npm run build` ok.
- Blockers: KeqingMains still blocked in the cloud environment (per `docs/DATA_SOURCES.md`), so the 5 re-imported characters' main stats need a local re-run to be sourced again.
- Next: if the user wants team rankings to be trustworthy beyond hand-written-only teams, Gorou (his DEF%/RES-shred buff is Noelle's whole point) and Noelle's own passives/C6 are the natural next upgrade given this session's finding; otherwise continue prioritizing characters in the user's actual saved teams per the 2026-09-28 entry below.

## 2026-09-28 — Varka/Jean/Sucrose hand-written kits (user's real roster + saved teams)

- Milestone: M8 (KB upgrades).
- Context: user pasted their actual browser backup (39 owned characters, 4 saved custom teams: "Sandrone main", "Varka pyro", "Varka electro", "Varesa overload") and asked to confirm all of them are properly implemented. Audit found only 9/39 owned characters hand-written; Varka, Jean and Sucrose — the on-field driver and two supports across the "Varka pyro"/"Varka electro" teams — were the highest-value baseline gaps with gcsim source available, so this session upgraded those three.
- Done:
  - varka, jean, sucrose: hand-written specs + hooks, from gcsim (frames/mechanics) and genshin-db (numbers). Multiplier tables confirmed against gcsim: Varka 16/16, Jean 9/9, Sucrose 8/8.
  - Fixed a serious pre-existing bug in the Varka baseline: all 14 of combat2's conditional-state hit labels (the plain Skill, upgraded Sturm-und-Drang Normals, both Four Winds hits, both Azure Devour hits) were bundled into one `skill` action firing together within ~24 frames of any Skill press. Now `skill` is only the plain tap; `fourWinds` is its own action.
  - Modelled Varka's team-composition mechanics (conversion element priority Pyro>Hydro>Electro>Cryo, falling back to Physical; the 140%/220% Four Winds team-comp multiplier) and reused the same priority-list approach for Sucrose's A1 (the engine doesn't expose which element a Swirl actually used, so this assumes it is the team's fixed conversion element — same simplification Varka's own kit already relies on).
  - New tests: `tests/varka-team.test.ts` (6 cases), `tests/jean-team.test.ts` (4 cases), `tests/sucrose-team.test.ts` (4 cases) — 14 new, all passing.
  - Re-simulated the user's 4 actual saved teams end-to-end (default C0/R1/Lv90/KQM Standard, since exact constellations/weapons weren't re-entered from the pasted backup into a KB team): Sandrone main 12,774 relaxed DPS, Varka pyro 6,138, Varka electro 5,658, Varesa overload 18,011 (already upgraded in the prior session). All 4 now run without the Varka overcount bug or missing-mechanic gaps.
- KB changes: see kb/CHANGELOG.md (2026-09-28 entry, "Varka, Jean, Sucrose hand-written kits").
- Tests / validation: `npm test` 165 pass (14 new); `npm run lint` clean; `npx tsc --noEmit` clean; `npm run kb:validate` ok (429 records); `npm run build` ok.
- Blockers: none.
- Next: the remaining ~27 owned characters not in any of the user's 4 saved teams are still on the bulk-import baseline (deprioritized — see docs/OPEN_QUESTIONS.md); Sandrone and Alyosha (both in "Sandrone main") remain `low`/patched-from-text since neither has gcsim source.

---

## 2026-09-28 — Chevreuse/Durin/Varesa/Iansan hand-written kits; Varesa Overloaded team fixed

- Milestone: M8 (KB upgrades).
- Context: user reported the Varesa/Chevreuse/Durin/Iansan team scored far below where a "top tier" team should, even below a plainer Varka-pyro comparison team. Diagnosis: all four characters were still on the bulk-import baseline (plain talent hits only) — none of their passives, constellations or off-field mechanics were modelled, and this exact team's value is ALMOST ENTIRELY in those mechanics (Chevreuse's team ATK buff and RES shred, Durin's periodic Dragon-of-White-Flame ticks and RES shred, Varesa's ATK-scaled plunge "ground impact" bonus, Iansan's on-field ATK buff). User asked for full kits (incl. constellations) for all four.
- Done:
  - Chevreuse, Durin (Dragon of White Flame form only), Varesa, Iansan: hand-written specs + hooks, from gcsim (frames/mechanics) and genshin-db (numbers). Multiplier tables confirmed against gcsim: Chevreuse 10/10, Durin 11/11, Varesa 9/9, Iansan 6/6.
  - Engine addition: `extraActions[name].hitTalent` — needed so Varesa's Fiery Passion Plunge (an extraAction whose multiplier scales with the Normal Attack talent level, like all Plunge attacks) still tags its hits `talent: 'plunge'` for `dmgBonus.plunge`/`critRate.plunge`-style effects, instead of inheriting the level-lookup talent. Existing extraActions (e.g. Raiden's Musou Isshin) are unaffected (field is optional, defaults to the old behaviour).
  - New team `varesa-overloaded`. New tests `tests/varesa-team.test.ts` (13 cases: each character's headline mechanic, plus an end-to-end check that this team now outparses the Varka-pyro comparison team).
  - Full kits per the user's choice: constellations C1–C6 are modelled where the engine reasonably supports them; a few pieces remain unmodelled per character where they need a resource this simulator doesn't track (Nightsoul point economy for Varesa/Iansan) or an engine capability it doesn't have (bypassing a scheduled cooldown for Chevreuse's C4) — each is called out in that character's own `assumptions`.
- Result: Relaxed team DPS 11,426 (was 7,582 on the baseline data), now clearly ahead of the Varka-pyro comparison team (7,744), matching the user's expectation that this is a top-tier team.
- KB changes: see kb/CHANGELOG.md (2026-09-28 entry, "Chevreuse, Durin, Varesa, Iansan hand-written").
- Tests / validation: `npx vitest run` 151 pass (13 new); lint, typecheck, build clean; `npm run kb:validate` ok (429 records); e2e ok.
- Blockers: KQM/Game8/GameWith still blocked in the cloud session — no guide rotation exists for this team; the rotation and its `low` confidence are ours.
- Next: Durin's Dragon of Dark Decay form (a separate Vaporize/Melt-team kit); Nightsoul point-economy tracking (would unlock Iansan/Varesa's remaining constellations and a more accurate Fiery Passion uptime); the other Sandrone-team characters' remaining gaps.

---

## 2026-09-28 — Team comparison: pick teams instead of ranking all

- Milestone: M8 (UI).
- Done: Team comparison tab (`src/ui/TeamsView.tsx`) replaced the "Rank teams (N)" button (which simulated and ranked every known team plus every saved team) with tick boxes per known team archetype and per saved custom team, a selection count, and a "Compare selected (N)" button that only simulates and ranks the picks. Selection is remembered in the browser (`usePersistentState`, stale ids from a deleted saved team or removed KB team are dropped). Updated `docs/PLAN.md` §6 (Mode A) and `scripts/e2e.ts` (ticks two teams before comparing, instead of the old "Rank teams" button).
- KB changes: none.
- Tests / validation: `npx vitest run` 138 pass (unchanged; no engine change); lint, typecheck, build clean; `npm run e2e` ok (ticks two teams, confirms only those two are simulated and shown).
- Blockers: none.
- Next: unchanged.

---

## 2026-09-27 — Silver Light + Odette simulation; Stellar Glimmer formula; CRIT ascension fix

- Milestone: M8 (KB upgrades).
- Done:
  - Engine: direct Stellar Glimmer damage as gcsim (`calcDirectDamage`): no DMG%, EM bonus 6·EM/(2000+EM) plus Stellar reaction bonuses, Polestar Field stack multiplier (1.0–2.0), ignores DEF. Before, these hits used the normal formula (DMG% incl. the field's Cryo/Electro bonus, no EM). Existing Sandrone teams: Relaxed DPS +5.8% (Kaeya) / +4.5% (Traveler).
  - Silver Light: passive modelled; obtain = event, R5 free (see kb/CHANGELOG.md).
  - Odette: hand-written spec (`scripts/kb-import/specs/odette.ts`) and hook (`src/engine/hooks/odette.ts`): Dance Double, Coda (action `coda`, only within 6 s of Skill/Burst), Stellar-Conduct forms, A1/A4, Stellar Jubilee, Swan's Dream.
  - New team `odette-stellar-conduct`; new CLI `npm run compare:weapons`.
  - Found and fixed a KB-wide bug: CRIT Rate/CRIT DMG ascension stats included the base 5%/50% (42 characters overrated). Hu Tao golden re-recorded.
- Result (Odette in odette-stellar-conduct, talents 1/1/1, C0, KQMS, Relaxed): Silver Light R1 4,629 Odette DPS; R5 5,043 (+8.9%); Absolution/Mistsplitter R1 4,880 (stats only, passives not modelled); Aquila Favonia R1 4,583; Favonius Sword R5 3,824.
- KB changes: see kb/CHANGELOG.md (2026-09-27 entries).
- Tests / validation: `npx vitest run` 138 pass (6 new in `tests/odette.test.ts`, 3 new direct-damage tests); lint, typecheck, build clean; `npm run kb:validate` ok (428 records); e2e ok.
- Blockers: KQM/Game8/GameWith still blocked in the cloud session: no guide rotation or recommended weapons for Odette; team and rotation are ours (`low`).
- Next: Stellar Swirl (Odette's other Radiance); Odette C1/C2/C4/C6; model passives of the other top swords (Mistsplitter, Absolution…) so the comparer is fair against them.

---

## 2026-09-27 — Backup tab (export/import) and safer browser storage

- Milestone: M8 (UI).
- Done:
  - New Backup tab (`src/ui/BackupView.tsx`, format in `src/ui/backup.ts`): export roster + settings + saved teams as JSON text (copy button, .json download; only non-default entries so it is short enough to paste on a phone); import by paste or file (roster replaced, saved teams merged by id, "Undo import"). Accepts the old roster-only export and a bare saved-team list. The roster-only text box on the Roster tab is replaced by a pointer to the Backup tab.
  - Loading is lenient: roster and saved-team entries are validated one by one; an invalid entry is skipped instead of the whole roster being replaced by an empty one and saved over (previous behaviour of `loadRoster`). A raw copy of any stored data that could not be fully read is kept (`*-unreadable`, `*-before-repair` keys) and offered under "Recovered data".
  - Working selections are remembered in the browser (`usePersistentState`): current tab, Custom team (characters, order, variants, builds, length, name, rotation JSON), Weapon comparer (team, character, weapons A/B). Previously these reset on every tab switch or reload.
  - `navigator.storage.persist()` requested on start so the browser is less likely to evict the site's storage.
  - Investigated the reported loss: storage key and roster format are unchanged since the first UI commit and no KB ids were renamed or removed, so an app update alone should not have cleared it. The one code path that could discard a saved roster (failed validation → empty roster saved over it) is fixed above. Other causes outside the app: a different browser/profile or in-app browser, a different origin (e.g. local `npm run dev` vs GitHub Pages), or site data cleared.
- KB changes: none.
- Tests / validation: `npx vitest run` 129 pass (8 new in `tests/backup.test.ts`); lint, typecheck, build clean; `E2E_EXECUTABLE=/opt/pw-browsers/chromium npm run e2e` ok, with a new step: tick characters → reload (roster, tab and custom-team selection remembered) → export → import into a fresh browser context → owned characters restored; a stored roster with one invalid entry keeps the rest and shows the recovered copy.
- Blockers: none.
- Next: unchanged.

---

## 2026-09-26 — Fix talent inputs on mobile

- Milestone: M8 (UI).
- Done: talent level inputs (and the custom action/swap delay inputs) clamped on every keystroke, so on a phone typing a digit appended to the old value and jumped to 15, and backspacing to empty snapped back to the fallback. New `IntInput` (`src/ui/Common.tsx`, logic in `src/ui/intInput.ts`) keeps the typed text as a draft, commits only in-range values, selects the text on focus (deferred for iOS/Android), and restores the previous value on blur if the draft is empty or out of range. Numeric keypad via `inputMode="numeric"`. `scripts/e2e.ts` gains a phone-viewport check (tap, type, backspace, blur) and an `E2E_EXECUTABLE` option for a specific browser binary.
- KB changes: none.
- Tests / validation: `npx vitest run` 121 pass (4 new in `tests/int-input.test.ts`); lint, typecheck, build clean; `E2E_EXECUTABLE=/opt/pw-browsers/chromium npm run e2e` ok. The new mobile check fails against the previous RosterView (typing 8 over 1 → 15; backspace → 1), confirming it reproduces the bug.
- Blockers: none.
- Next: unchanged (export/import of saved teams; weapon/set pickers for known teams).

---

## 2026-09-26 — Default talents 1/1/1; saved custom teams

- Milestone: M8 (UI).
- Done: default talent level is now 1/1/1 (schema, builder, engine, roster store, docs; a saved roster still holding the old all-9 default is migrated once). Custom teams can be saved by name in the browser (localStorage), loaded, updated and deleted; saved teams appear in the Team comparison ranking (tab renamed from "Known teams") and as teams in the Weapon comparer. Worker requests take an optional `custom` source. Golden and KQM checks now run at 9/9/9 explicitly.
- KB changes: none.
- Tests / validation: `npx vitest run` 117 pass; lint, tsc clean; `npm run e2e` ok (saves a team and compares weapons on it).
- Blockers: none.
- Next: export/import of saved teams; weapon/set pickers for known teams.

---

## 2026-09-26 — Per-character weapon/set choice; two-weapon comparer

- Milestone: M8 (UI).
- Done: Custom team lets each selected character pick a weapon (with refinement) and a 4pc artifact set (`CustomTeam.builds`, `MemberSpec.pinned`). Weapon comparer now compares Weapon A against Weapon B (each with refinement) instead of a baseline plus a list; deltas are B vs A.
- KB changes: none.
- Tests / validation: `npx vitest run` 115 pass; lint, tsc clean; `npm run e2e` ok.
- Blockers: none.
- Next: same weapon/set pickers for known-team mode; 2pc+2pc set mixes.

---

## 2026-09-26 — Sandrone and Alyosha written from in-game text

- Milestone: M7.
- Done: hit field `stellar` (schema, engine `processHit`, builder), hook `alyosha`, rewritten patches, a test for the Stellar-Conduct hit form. No frame tables exist for either character (gcsim lacks them, KQM pages are empty), so frames stay estimates.
- KB changes: sandrone, alyosha (see kb/CHANGELOG.md).
- Tests: `npx vitest run` 114 pass; `tsc --noEmit` clean.
- Result (relaxed, energy-limited): Traveler team 5,935 DPS vs Kaeya team 5,233 (+13%); frame-perfect 6,861 vs 6,499.
- Blockers: frames for both characters; ER interpretation of Alyosha's A2 (total ER multiplier assumed).
- Next: constellations, Hunter's Mark state, Fagio.

---

## 2026-09-25 — Cryo Traveler imported; Sandrone/Fischl/Alyosha team compared with Traveler vs Kaeya

- Done: Stellar-Conduct in the reaction engine; hook API extensions; Cryo Traveler kit (`scripts/kb-import/specs/traveler-cryo.ts`, hook `travelercryo`); Fischl's Oz hook; patches for Fischl, Sandrone, Alyosha; energy-limited runs (`burstPolicy`); two team archetypes; `npm run compare` (`scripts/compare-teams.ts`); tests for the reaction, the Traveler hook and the comparison (113 pass).
- Result (relaxed, energy-limited, default weapons, KQMS stats): Traveler team about 5.1k–5.4k DPS vs Kaeya team about 4.4k–4.7k, roughly +15%; also +17% when unaffordable bursts fire anyway. Sources of the gap: the Polestar Field is up about 69% of the time with the Traveler vs 36% with Kaeya (more Cryo/Electro applications and Stellar-Conduct triggers), Fischl's A4 fires more, the Traveler deals about 2.4× Kaeya's own damage.
- Limits: Sandrone and Alyosha have no gcsim source and are mostly baseline; no published rotation for the team (ours); weapons default to highest base ATK; Fischl's A4 is assumed to count Stellar-Conduct as an Electro-related reaction.

---

## 2026-09-25 — M7 baseline: every released character, weapon and set is in the KB

- Milestone: M7 (baseline). The KB now covers everything genshin-db lists through 7.1, but only the 7 hand-written characters, 11 hand-written weapons and 4 sets model their passives; the rest is a damage-only baseline (see `kb/CHANGELOG.md`).
- Done: `scripts/kb-import/gcsim-frames.ts` (reads hitmarks/cancel frames out of gcsim's Go source; reproduces the hand-written Xiangling exactly), `bulk-character.ts` / `import-bulk-characters.ts`, `bulk-lib.ts` / `import-bulk.ts` (weapons, artifacts), `http.ts` (cached page fetch). Label heuristics: N-Hit DMG → normal steps; skill/burst DMG labels → hits (hold/charge-level variants dropped), CD and Energy Cost labels, `Durability` and `ICDTagNone` from gcsim, first `QueueParticle` for particles. Frames not parsed are borrowed component by component from a same-weapon-type donor and the character is `low`.
- KB changes: 113 characters, 232 weapons, 55 artifact sets added (see changelog).
- Tests / validation: `tests/all-characters.test.ts` builds and simulates all 120 characters; `npm test` 104 pass; `kb:validate` ok (424 records).
- Limits: baseline characters ignore passives/constellations, so their damage is understated and buffers/supports show almost nothing; skill/burst hits sit at one estimated frame; Travelers are not imported; 70 characters are `low`. Upgrading a character means writing a spec in `scripts/kb-import/specs/` (it then replaces the baseline).
- Next: upgrade popular characters and weapons to hand-written specs (Nahida, Furina, Kazuha, Diluc, ... and weapons with plain passives), read Game8/GameWith for more teams, M8.

---

## 2026-09-25 — M4 (seed KB, partial), M5 (UI v1), M6 (comparison) built

- Milestones: M4 partial (7 characters, 11 weapons, 4 sets, 2 teams), M5 complete, M6 complete.
- Done:
  - **Importers** (`scripts/kb-import/`): genshin-db numbers + gcsim frames/ICD/particles via spec files; talent tables cross-checked against gcsim tables (all 78 tables match) and Lv 90 base stats against KeqingMains library pages (all 7 match) → characters are `high` confidence. `import-icd.ts` generates 65 ICD groups from gcsim. `npm run kb:inspect`, `kb:fetch-gcsim`.
  - **KB**: Raiden Shogun, Xiangling, Xingqiu, Bennett, Hu Tao, Yelan, Zhongli; weapons The Catch, Engulfing Lightning, Staff of Homa, Aqua Simulacra, Aquila Favonia, Favonius Sword/Warbow/Lance, Black Tassel, Blackcliff Pole, White Tassel; sets Emblem of Severed Fate, Noblesse Oblige, Crimson Witch of Flames, Tenacity of the Millelith; teams Raiden National and Hu Tao Double Hydro (Zhongli) with KeqingMains rotations; `kqms.json`.
  - **Engine**: hooks (xingqiu, raiden, hutao, yelan, zhongli, favonius), dynamic scaling, `onHit`/`onAnyNormal`/`onAnyBurst`, infusion, cooldown mods, extra actions, rotation repeat groups (`times`, `untilBuffEnds`, `untilCycleTime`, `every`, `firstCycleOnly`), KQMS optimizer, theorycrafting switches (`enemyAura`, `conditionsMet`, `trace`).
  - **App layer** (`src/kb/`): Mode A ranking, Mode B custom rotations from `usualCombo`, weapon comparer with worst case. **UI** (`src/ui/`): roster (tick boxes, C/R/talents, export/import, execution profile), known teams, custom team (order, variants, editable script), weapon comparer, results (summary, action and buff timelines, hit log, assumptions). Simulation runs in a Web Worker.
- KB changes: see `kb/CHANGELOG.md`.
- Tests / validation: lint, typecheck clean; `npm test` 104 tests (engine, reactions, hooks, KQMS, team runs, golden regression, KQM weapon table check); `npm run e2e` drives the built app in Chrome (roster → ranking → details → custom → comparer) with screenshots in `.cache/shots`.
- Published-figure check: Hu Tao weapon table from KeqingMains reproduced within 3 points for Homa R1/R5 and White Tassel R5 (Black Tassel: −10 points, OPEN_QUESTIONS #12). No published team-level DPS figures were found, so team numbers are regression-tested only (`tests/golden/teams.json`).
- Blockers / limits: OPEN_QUESTIONS #12–15. Raiden National shows Raiden cannot burst every rotation even with maximum ER rolls (energy model follows gcsim; rotation from KQM). Yelan's A4 ramp shows as 15 rows in the buff timeline.
- Next: M7 (full KB via `/kb-sync-patch` and the importers, needs many more specs and hooks), M8 (patch-day dry run).

---

## 2026-09-25 — M3 elements complete

- Milestone: M3 (Elements) — complete
- Done:
  - KB: `kb/mechanics/reactions.json`, `icd.json`, `constants.json` with provenance (gcsim @ 3d48bd5 for numbers only, cross-checked with KeqingMains; multipliers agree). Zod schemas in `src/schema/mechanics.ts`; `kb:validate` checks them; the engine loads them from the KB.
  - Engine: aura/gauge model (`aura.ts`), reaction engine (`reactions.ts`: vaporize, melt, overloaded, superconduct, electro-charged, swirl, freeze/shatter, quicken/aggravate/spread, bloom/hyperbloom/burgeon, burning, Lunar-Charged), ICD, energy and particles (`energy.ts`), event-ordered resolve pass in `simulate.ts`. Results now carry per-hit `reactions` and a per-character `energy` report (energy per cycle, ER needed to burst every cycle, shortfalls).
  - Character schema: `hits[].strike`, `particles.delay`, `particles.element`.
- KB changes: mechanics files only (see `kb/CHANGELOG.md`).
- Tests / validation: lint clean, typecheck clean, `npm test` 60/60 (hand-computed reaction, aura decay, ICD, energy cases with a fake host plus full-simulation ICD and energy cases), `kb:validate` ok, build ok.
- Blockers / limits: Lunar-Charged rests on gcsim only (KQM has no page); crystallize, Stellar Swirl, Lunar-Crystallize, Lunar-Bloom, Stellar Conduct not implemented (listed as `implemented: false`). Simplifications listed in `docs/SIMULATION.md` "Implemented in M3".
- Next: M4 seed KB (~15 characters, their weapons and sets, 5 team archetypes) using the `/kb-*` skills now that sources are reachable.

---

## 2026-09-25 — M2 engine core complete; sources re-checked

- Milestone: M2 (Engine core) — complete
- Source access (answered by user, verified): from a local session KeqingMains, library.keqingmains.com, GameWith, `game8.co` (not `www.`), gcsim raw files and npm all return 200. The earlier block applied to the cloud session only. `kb/meta.json`, `docs/DATA_SOURCES.md` and `CLAUDE.md` updated.
- Done (`src/engine/`, no DOM/React):
  - `stats.ts` stat resolver; `damage.ts` damage formula (DEF, piecewise RES, expected-value crit, flat/mv/base-multiplier modifiers); `buffs.ts` buff manager (refresh and independent stacking, Gantt-ready segment records, pure queries at any frame); `simulate.ts` action scheduler (cancel frames, execution profile delay, swap rules incl. 1 s swap cooldown, skill/burst cooldown waits, cycles 2..N measurement, Relaxed + Frame-perfect via `simulateBoth`); `kb.ts` builds engine input from a KB character + weapon (talent levels, constellations up to set level, weapon refinement).
  - Effect handling: `always`, `onSkill/onBurst/onNormal/onCharged/onPlunge`, `onSwapIn/onSwapOut`; values from numbers, `perRefinement`, `perTalentLevel`, `scaling` from `self.<stat>`; targets self/team/teamExceptSelf/active/enemy. Skipped and reported in `assumptions`: hooks, `onHit/onReaction/custom` triggers, unsupported scaling sources; conditions are ignored and listed.
  - Schema fix: `talents` is now a partial record (a character need not have every talent kind).
- KB changes: none.
- Tests / validation: lint clean, typecheck clean, `npm test` 30/30 (hand-computed stat, damage, scheduling, cooldown, swap, buff-window and KB-builder cases), `kb:validate` ok.
- Known simplifications added by M2 (see `docs/SIMULATION.md`): effects trigger at action start; values are computed at application time (no dynamic re-scaling or snapshot distinction yet); `stackGroup` not enforced; no energy model, so burst energy cost is not checked (M3); enemy is stationary single-target; no reactions (M3).
- Blockers: none. Note the repo has no KB data yet, so nothing exercises real characters until M4.
- Next: M3 elements (aura/gauge, ICD, reactions, energy), then M4 seed KB via the skills now that KQM/Game8/GameWith are reachable locally.

---

## 2026-09-25 — M1 skeleton complete

- Milestone: M1 (Skeleton) — complete
- Done:
  - Vite + React + Tailwind 4 + TypeScript strict app shell (`src/ui/App.tsx`), Web Worker stub (`src/worker/sim.worker.ts`), engine package with execution profiles (`src/engine/profiles.ts`; ESLint forbids React/UI imports in `src/engine/`).
  - zod schemas in `src/schema/` for character, weapon, artifact set, team, enemy, meta, roster and the Effect DSL (stat keys enforced by regex; fractions guarded against whole-number percentages).
  - `scripts/kb-validate.ts` (schema, filename = id, duplicate ids, cross-references, `needsHook` without hooks), `scripts/kb-index.ts` (index.json, meta counts, coverage report).
  - Empty `kb/` layout, `kb/meta.json`, `kb/CHANGELOG.md`; GitHub Actions CI (lint, typecheck, kb:validate, test, build; `BASE_PATH` set for Pages).
- KB changes: none (empty KB; layout only).
- Tests / validation: `npm run lint` clean; `npm run typecheck` clean; `npm run kb:validate` ok (0 records); `npm run kb:index` ok; `npm test` 9/9 pass; `npm run build` ok.
- Blockers: KQM/Game8/GameWith still blocked in the cloud environment. GitHub Pages deploy workflow not added (CI only builds); enable Pages and add a deploy job when ready.
- Next: M2 engine core (stat resolver, damage formula, buff manager, action scheduler).

---

## 2026-09-25 — Team modes decided (M0 complete)

- Milestone: M0 (Planning) — complete
- Decision (from user, #9): no automatic team search. Mode A ranks known KB teams. Mode B lets the user pick any 4 owned characters and set their order; each character runs its usual combo; the app reports approximate DPS and timelines.
- Done: updated `docs/PLAN.md` §4 and §6 and M6; added `usualCombo` to the character schema (`docs/KB_SCHEMA.md`) and a step to `/kb-add-character` to fill it.
- KB changes: none.
- Tests / validation: none (no code yet).
- Blockers: KQM/Game8/GameWith still blocked in the cloud environment (needed for teams, rotations and usual combos).
- Next: M1 skeleton (Vite + React + TS, zod schemas, `kb:validate`, genshin-db as devDependency).

---

## 2026-09-25 — More decisions applied

- Milestone: M0 (Planning)
- Decisions (from user): #5 Lv 90 only, beyond-90 moved to roadmap; #6 KQMS stat pool only, manual stat entry added to roadmap (`docs/PLAN.md` §11); #7 GitHub Pages + local `npm run dev`; #8 GameWith EN only; #10 18-frame Relaxed delay confirmed; #11 gcsim reference-only confirmed.
- Done: updated PLAN (roadmap §11, stats, hosting), SIMULATION, KB_SCHEMA, DATA_SOURCES, CLAUDE.md, kb-add-character skill.
- KB changes: none.
- Tests / validation: none (no code yet).
- Blockers: #9 (team finder scope) awaiting user answer. KQM/Game8/GameWith still blocked in cloud environment.
- Next: answer #9 → M1 skeleton.

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
