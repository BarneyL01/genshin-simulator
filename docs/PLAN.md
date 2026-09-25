# Genshin Team Simulator — Project Plan

Status: **Planning** (no application code yet). See `docs/PROGRESS_LOG.md` for current state.

## 1. Goal

A static web app that lets the user:

- Mark which characters (and constellations) and weapons (and refinements) they own.
- Pick 4 characters to form a team, or let the app rank candidate teams from the owned roster.
- Simulate a rotation: which skills each character uses, when, and which buffs/debuffs are active over time.
- Compare weapons on a character inside a specific team, including new weapons that have little community test data.

Constraints:

| Constraint | Consequence |
|---|---|
| Runs without an LLM | All logic is deterministic TypeScript. The KB is static JSON bundled into the site. |
| KB kept current by an LLM agent | Update procedures live as Claude Code skills in `.claude/skills/`. |
| Everyone is C0 unless specified | Constellation defaults to 0 in the roster; C1–C6 effects are stored in the KB and only applied when set. |
| Sources: KeqingMains, Game8, GameWith | Each KB record stores provenance (source URL, retrieval date, game version). |

## 2. Architecture

```
┌──────────────────────── Browser (static site, no backend) ────────────────────────┐
│  UI (React)                                                                        │
│   ├─ Roster editor ─ Team builder ─ Rotation editor ─ Results / timeline views     │
│   └─ Team finder / weapon comparer                                                 │
│        │  postMessage                                                              │
│  Web Worker: sim engine (pure TS)                                                  │
│   ├─ Stat resolver   ├─ Action scheduler   ├─ Buff manager                         │
│   ├─ Element/aura + reaction model   ├─ Energy model   ├─ Damage calculator        │
│        │ reads                                                                     │
│  KB (JSON, validated by zod at build time, imported as modules)                    │
└────────────────────────────────────────────────────────────────────────────────────┘

┌──────── Offline, LLM-driven (Claude Code skills) ────────┐
│ /kb-sync-patch → /kb-add-character, /kb-add-weapon,      │
│ /kb-add-artifact-set, /kb-update-teams → /kb-validate    │
│ writes kb/**/*.json, kb/CHANGELOG.md, docs/PROGRESS_LOG.md│
└──────────────────────────────────────────────────────────┘
```

### Tech stack (proposed)

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | One language for engine, UI, schemas, and validation scripts. |
| Build | Vite | Static output; deployable to GitHub Pages with no server. |
| UI | React + Tailwind | Common, well supported by agents. |
| Charts / timeline | Custom SVG Gantt + a small chart lib (e.g. visx or uPlot) | Buff-uptime timeline is a Gantt view; DPS bars are simple. |
| Schemas | zod | Same schema validates KB at build time and types the engine. |
| Tests | Vitest | Engine unit tests and golden-number regression tests. |
| Persistence | `localStorage` + JSON export/import | Roster and saved teams stay in the browser. |

### Repository layout (target)

```
/CLAUDE.md
/docs/                     plan, schema, sources, sim model, progress log
/.claude/skills/           KB maintenance skills
/kb/
  meta.json                game version, last sync date, source status
  CHANGELOG.md             per-sync record of KB changes
  characters/<id>.json
  weapons/<id>.json
  artifacts/<id>.json
  teams/<id>.json          community team archetypes + default rotations
  enemies/<id>.json
  mechanics/reactions.json, icd.json, constants.json
/src/
  schema/                  zod schemas (source of truth for KB shape)
  engine/                  simulation (no DOM, no React)
  ui/                      React app
  worker/                  Web Worker entry
/scripts/                  kb:validate, kb:index, kb:diff
/tests/                    engine tests, golden cases
```

## 3. Knowledge base

Full field definitions: `docs/KB_SCHEMA.md`. Source handling: `docs/DATA_SOURCES.md`.

| Entity | Key contents |
|---|---|
| Character | Element, weapon type, rarity, base HP/ATK/DEF at Lv 90 (and 100 if applicable), ascension stat, talent multipliers per level (1–15), hit list (frames, element, ICD tag, scaling stat), energy/particles, passives and C1–C6 as structured effects, roles, release version. |
| Weapon | Type, rarity, base ATK, substat at Lv 90, passive R1–R5 as structured effects, release version, `dataConfidence`. |
| Artifact set | 2pc/4pc effects as structured effects. |
| Team archetype | 4 member ids (with allowed substitutions), roles, recommended weapons/sets per member, default rotation script, source links and tier notes. |
| Enemy | Level, base resistances, special properties. |
| Mechanics | Reaction formulas and level multipliers, ICD rules, gauge rules, constants. New mechanics (e.g. Lunar reactions, Stellar Swirl) are added here. |

### Effect DSL

Every buff, debuff, passive, constellation, weapon passive and set bonus is expressed as data, not code, where possible:

```jsonc
{
  "id": "weapon.mistsplitter.passive",
  "trigger": { "on": "always" },          // always | onHit | onSkill | onBurst | onReaction | onSwap | onStackEvent ...
  "condition": { "stacksFrom": "..." },   // optional
  "target": "self",                        // self | active | team | teamExceptSelf | enemy
  "stat": "elementalDmgBonus.self",       // or "dmgBonus.skill", "res.enemy.pyro", "flatDmg.normal"...
  "value": { "perRefinement": [0.12, 0.15, 0.18, 0.21, 0.24] },
  "scaling": null,                         // or { "from": "self.em", "ratio": 0.0012, "cap": 0.36 }
  "duration": null,                        // frames; null = permanent
  "maxStacks": 1,
  "icd": null
}
```

Anything that cannot be expressed in the DSL gets a named **hook** (`"hook": "furina.fanfare"`) implemented in `src/engine/hooks/`. The KB record marks `"needsHook": true` so the skills and validator know code is required. Target: >90% of effects data-only.

## 4. Simulation model

Details: `docs/SIMULATION.md`. Summary:

- Discrete-event timeline in frames (60 fps). Default duration: one full rotation, repeated N times (default 4) to reach steady state; report the average of cycles 2..N.
- Actions per character: normal/charged/plunge, skill (press/hold), burst, swap, dash, wait. Each action has frame data (cancel windows) from the KB.
- Rotation is a script: an ordered list of `{char, action, variant?, repeat?}`. Every team archetype ships a default rotation from its source; the user can edit it. If none exists, a role-based template generates one (e.g. "buffers burst → sub-DPS skill → driver on-field").
- Buff manager tracks start/end frames, stacks and snapshot vs. dynamic behaviour. Output feeds the timeline view.
- Elemental gauge and aura decay with standard ICD (3 hits / 2.5 s) and per-KB overrides. Reactions: amplifying, transformative, additive (quicken), and KB-defined newer reactions.
- Energy: particle generation + flat energy, ER requirement reported per character ("needs 180% ER to burst every rotation").
- Stats: KQM Standards (KQMS) style artifact assumption by default — fixed main stats by role plus a fixed pool of liquid substats, auto-distributed to maximise the character's damage subject to ER requirement. User can override with manual stats.
- Enemy: default level-100 enemy with 10% all RES; selectable presets.

### Outputs

| View | Content |
|---|---|
| Summary | Team DPS, per-character DPS and share, rotation length, ER requirements met/unmet. |
| Action timeline | Per character row: which action was used at which second. |
| Buff timeline | Gantt of every buff/debuff: source, target, start/end, stacks. Uptime % per buff. |
| Hit log | Every damage instance: time, attacker, talent, element, reaction, buffs applied, damage. |
| Assumptions | Which KB records are low confidence, which hooks are unimplemented, which effects were skipped. |

## 5. Team finding and weapon comparison

- **Team finder**: from the owned roster, generate candidate teams by (1) matching KB team archetypes whose required members are owned (substitutions allowed), then (2) optionally enumerating teams that contain a chosen "anchor" character, pruned by element/role rules (max 1 on-field driver unless the archetype allows, elemental pair requirements). Simulate each; rank by team DPS. Full brute force over all C(n,4) teams is avoided because the count is large (100 characters → ~3.9 million teams).
- **Weapon comparer**: for one character in one team, simulate with every owned (or every KB) weapon of that type at chosen refinements; report DPS delta vs. a baseline weapon and the ER-requirement change. New weapons are simulated from their structured passive, so a result is available without community test data; the result is flagged with the weapon's `dataConfidence` and the list of passive conditions that were assumed (e.g. "stacks assumed at max after 2 s").
- **Sensitivity**: show result with passive conditions at best case and worst case so the user sees the range when uptime is uncertain.

## 6. Accuracy and verification

| Check | Method |
|---|---|
| Stat resolution | Unit tests: character + weapon + set → expected panel stats (hand-computed). |
| Damage formula | Golden tests against published KQM calcs / known damage numbers per character. |
| Rotation DPS | Compare with published KQM/community team DPS figures where available; store tolerance per case. |
| KB integrity | `npm run kb:validate`: zod schema, cross-references, required provenance, version bounds. |

Every KB sync runs `kb:validate` and the golden tests before commit.

## 7. Milestones

| # | Milestone | Deliverables | Exit criteria |
|---|---|---|---|
| M0 | Planning | CLAUDE.md, docs, skills | Plan reviewed by user; open questions answered. |
| M1 | Skeleton | Vite/React/TS app, zod schemas, `kb:validate`, CI | Empty KB validates; app builds and deploys. |
| M2 | Engine core | Stat resolver, damage formula, buff manager, action scheduler, no reactions | Single-character rotation matches hand calc. |
| M3 | Elements | Aura/gauge, ICD, all reactions, energy | Reaction golden tests pass. |
| M4 | Seed KB | ~15 characters, their common weapons and sets, 5 team archetypes (via skills) | Seed teams simulate within tolerance of published figures. |
| M5 | UI v1 | Roster, team builder, results, action + buff timelines | User can build a team and read the timeline. |
| M6 | Comparison | Team finder, weapon comparer, sensitivity range | Rankings produced for owned roster. |
| M7 | Full KB | All released characters, weapons, sets (via `/kb-sync-patch`) | `kb:validate` clean; coverage report 100% or hooks listed. |
| M8 | Maintenance | Patch-day workflow tested end to end | New patch ingested by an agent with no code changes other than hooks. |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Source sites block scraping or change layout | Skills describe what to extract, not HTML selectors; agent reads pages. Record failures in `kb/meta.json`. |
| Source sites disagree | Priority order and conflict notes in `docs/DATA_SOURCES.md`; record both values with provenance. |
| Guide sites lack exact numbers (frames, ICD, multipliers) | Allow supplementary datamine/wiki sources for numeric fields (needs user approval — see open questions). |
| Unique mechanics not expressible in DSL | Named hooks with tests; validator lists missing hooks. |
| Scope of a full combat sim | Ship a simplified model first (M2–M3), mark simplifications in the Assumptions view. |

## 9. Open questions

Tracked in `docs/OPEN_QUESTIONS.md`.
