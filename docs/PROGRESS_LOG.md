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
