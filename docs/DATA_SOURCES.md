# Data Sources

## Requested sources

| Source | URL | Best for | Weak for |
|---|---|---|---|
| KeqingMains (KQM) | https://keqingmains.com/ and https://library.keqingmains.com/ | Rotations, frame data, ICD, mechanics, team DPS calcs, weapon/artifact comparisons, KQM Standards | Coverage of the newest characters can lag; some pages are guides, not tables |
| Game8 | https://game8.co/games/Genshin-Impact | Complete lists (characters, weapons, sets), base stats, talent scaling tables, best teams and tier lists, current version | Rotations are simplified; team ranks are editorial |
| GameWith | https://gamewith.net/genshin-impact/ (EN), https://gamewith.jp/genshin/ (JP) | Second opinion on best teams and builds, tier ranks, fast new-character coverage (JP site) | JP site needs translation; numeric tables sometimes rounded |

## Field ownership (which source wins)

| Field | Priority order | Notes |
|---|---|---|
| Character/weapon list, release version | Game8 → GameWith → KQM | Only released content. No leaks or beta data. |
| Base stats, ascension stat, weapon base ATK/substat | Game8 → GameWith | Cross-check both; record conflict if >0.5% different. |
| Talent multipliers (per level) | Game8 → GameWith → KQM | |
| Passive / constellation / weapon passive text | Game8 → GameWith | Convert text to Effect DSL; keep original text. |
| Frame data, ICD, gauge, particles | KQM → (fallback: estimate, `dataConfidence: low`) | Guide sites rarely have these. |
| Rotations | KQM → Game8 → GameWith | Store source per rotation. |
| Best teams / archetypes | Union of all three | Store each site's rank separately in `sourceRank`. |
| Best weapons / sets per character | Union of all three | Store as ordered list with source. |

## Rules for agents

- Always record `url` and `retrieved` date in `provenance.sources` for every field group you write.
- If two sources disagree, add a `provenance.conflicts` entry. Do not silently pick one.
- If a number is not available from any source, leave it `null`, set `dataConfidence` to `low`, and list it in the entity's `assumptions` or in `docs/OPEN_QUESTIONS.md`.
- Do not copy prose paragraphs from source sites. Store numbers, structured effects, and short passive/constellation text needed to explain an effect.
- Respect robots.txt and rate limits: fetch pages one at a time, no parallel crawling of a single site.
- If a site is unreachable, set `kb/meta.json` `sources.<site>.status` to `blocked` and continue with the others. Record it in `docs/PROGRESS_LOG.md`.

## Access status

| Date | Environment | keqingmains.com | game8.co | gamewith.net |
|---|---|---|---|---|
| 2026-09-25 | Claude Code cloud session (initial planning) | Blocked by egress policy | Blocked by egress policy | Blocked by egress policy |

To allow them in a cloud session, add the three domains (plus `library.keqingmains.com` and `gamewith.jp` if used) to the environment's allowed network domains, or run the skills from a local Claude Code install.

## Candidate supplementary sources (not approved yet)

Guide sites often lack exact frame/ICD/multiplier data. These structured sources could fill numeric fields. Use only if the user approves (see `docs/OPEN_QUESTIONS.md`):

- Genshin Impact Fandom wiki (talent tables, frame notes)
- genshin-db (GitHub: theBowja/genshin-db) — structured JSON of datamined stats
- gcsim (GitHub: genshinsim/gcsim) — open-source simulator; its character implementations and frame data can be used to cross-check
