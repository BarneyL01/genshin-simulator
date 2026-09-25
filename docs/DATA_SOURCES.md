# Data Sources

## Requested sources

| Source | URL | Best for | Weak for |
|---|---|---|---|
| KeqingMains (KQM) | https://keqingmains.com/ and https://library.keqingmains.com/ | Rotations, frame data, ICD, mechanics, team DPS calcs, weapon/artifact comparisons, KQM Standards | Coverage of the newest characters can lag; some pages are guides, not tables |
| Game8 | https://game8.co/games/Genshin-Impact | Complete lists (characters, weapons, sets), base stats, talent scaling tables, best teams and tier lists, current version | Rotations are simplified; team ranks are editorial |
| GameWith | https://gamewith.net/genshin-impact/ (EN only) | Second opinion on best teams and builds, tier ranks | Numeric tables sometimes rounded. New characters can take a couple of days to appear; re-run `/kb-update-teams` then |

## Approved supplementary sources (numbers and timing)

Approved by the user on 2026-09-25. Both are reachable from the cloud environment.

| Source | Access | Best for | License | Coverage checked 2026-09-25 |
|---|---|---|---|---|
| genshin-db | npm package `genshin-db` (v5.2.14, published 2026-09-21); repo `theBowja/genshin-db` | Exact base stats per level, talent multipliers per level, passive/constellation text with values, weapon stats and R1–R5 values, release version | MIT | Includes 7.1: Vesna, Vodyanitsa, Alyosha, Odette, Silver Light |
| gcsim | `git clone --depth 1 --filter=blob:none --sparse https://github.com/genshinsim/gcsim` then `git sparse-checkout set internal/characters internal/weapons internal/frames`; single files via `raw.githubusercontent.com/genshinsim/gcsim/main/...` | Frame data (hitmarks, cancel frames per next action), ICD tags/groups, gauge units, particle counts and delays, hitlag | AGPL-3.0 since 2026-09-19 (MIT through v2.47.2) | 111 characters up to Odette. Missing Vesna, Vodyanitsa, Alyosha, Silver Light |

gcsim usage rule: read its Go files as a reference and record the numbers (with the file URL and commit hash in provenance). Do not copy its code into this repo.

Where gcsim frames live: `internal/characters/<name>/attack.go`, `charge.go`, `skill.go`, `burst.go`, `plunge.go` — look for `...Hitmarks`, `...Frames[...][action.ActionX] = N`, `frames.InitNormalCancelSlice(hitmark, animation)`, `ICDTag`, `ICDGroup`, `Durability`, and `ParticleCB` / `c.Core.QueueParticle(...)`. Frames are at 60 fps (same unit as our KB).

## Field ownership (which source wins)

| Field | Priority order | Notes |
|---|---|---|
| Character/weapon list, release version | genshin-db → Game8 → GameWith | Only released content. No leaks or beta data. |
| Base stats, ascension stat, weapon base ATK/substat | genshin-db → Game8 → GameWith | Cross-check; record conflict if >0.5% different. |
| Talent multipliers (per level) | genshin-db → Game8 → GameWith | |
| Passive / constellation / weapon passive values | genshin-db → Game8 → GameWith | Convert to Effect DSL; keep short original text. |
| Weapon obtain method (gacha / craft / event / BP) | Game8 → GameWith | Drives the "R5 obtainable" hint. |
| Frame data, ICD, gauge, particles | gcsim → KQM → estimate (`dataConfidence: low`) | Estimate = copy a same-weapon-type character with a similar kit and say so in `assumptions`. |
| Rotations | KQM → Game8 → GameWith | Store source per rotation. |
| Best teams / archetypes | Union of KQM, Game8, GameWith | Store each site's rank separately in `sourceRank`. |
| Best weapons / sets per character | Union of KQM, Game8, GameWith | Store as ordered list with source. |

## Rules for agents

- Always record `url` and `retrieved` date in `provenance.sources` for every field group you write.
- If two sources disagree, add a `provenance.conflicts` entry. Do not silently pick one.
- If a number is not available from any source, leave it `null`, set `dataConfidence` to `low`, and list it in the entity's `assumptions` or in `docs/OPEN_QUESTIONS.md`.
- Do not copy prose paragraphs from source sites. Store numbers, structured effects, and short passive/constellation text needed to explain an effect.
- Respect robots.txt and rate limits: fetch pages one at a time, no parallel crawling of a single site.
- If a site is unreachable, set `kb/meta.json` `sources.<site>.status` to `blocked` and continue with the others. Record it in `docs/PROGRESS_LOG.md`.

## Access status

| Date | Environment | keqingmains.com | game8.co | gamewith.net | genshin-db (npm) | gcsim (git / raw.githubusercontent) | Fandom wiki |
|---|---|---|---|---|---|---|---|
| 2026-09-25 | Claude Code cloud session | Blocked | Blocked | Blocked | OK | OK (github.com web/API 403; git clone and raw files work) | Blocked |
| 2026-09-25 | Local Claude Code (user machine) | OK (+ library.keqingmains.com) | OK (`game8.co` only; `www.game8.co` does not resolve) | OK | OK | OK | not checked |

To allow them in a cloud session, add the three domains (plus `library.keqingmains.com`) to the environment's allowed network domains, or run the skills from a local Claude Code install.
