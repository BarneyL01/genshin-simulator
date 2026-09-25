# Knowledge Base Schema

The zod schemas in `src/schema/` (created in M1) are the source of truth. This document describes them for humans and agents. If the two disagree, update this file to match the code.

## Conventions

- One JSON file per entity: `kb/<kind>/<id>.json`.
- `id` is lowercase kebab-case of the English name: `raiden-shogun`, `mistsplitter-reforged`, `emblem-of-severed-fate`. Travelers: `traveler-anemo`, `traveler-geo`, etc.
- Percentages stored as fractions: 46.6% → `0.466`.
- Durations and frame data stored in frames at 60 fps. Seconds in sources are converted: `seconds * 60`.
- Stats at Lv 90 / talent level stored as full arrays so the engine can pick any level.
- Every entity has a `provenance` block and a `dataConfidence` value.

## Common blocks

```jsonc
"provenance": {
  "sources": [
    { "site": "keqingmains", "url": "https://...", "retrieved": "2026-09-25", "fields": ["rotation", "frames"] },
    { "site": "game8", "url": "https://...", "retrieved": "2026-09-25", "fields": ["baseStats", "talents"] }
  ],
  "conflicts": [
    { "field": "talents.skill.hits[0].mv[9]", "values": { "game8": 2.304, "gamewith": 2.31 }, "chosen": "game8", "note": "rounding" }
  ],
  "gameVersion": "7.1"
},
"dataConfidence": "high"   // high = numbers cross-checked in 2+ sources and community calcs exist
                           // medium = numbers from 1 source, or no community calcs yet
                           // low = partial / estimated / pre-release frames
```

## Character

```jsonc
{
  "id": "raiden-shogun",
  "name": "Raiden Shogun",
  "rarity": 5,
  "element": "electro",
  "weaponType": "polearm",
  "releaseVersion": "2.1",
  "roles": ["driver", "battery", "sub-dps"],
  "baseStats": {
    "lv90": { "hp": 12907, "atk": 337, "def": 789 },
    "lv100": null          // reserved; not filled in v1 (beyond-90 excluded, see PLAN roadmap)
  },
  "ascensionStat": { "stat": "er", "value": 0.32 },
  "talents": {
    "normal": {
      "hits": [
        { "name": "N1", "mv": [/* Lv1..Lv15 */], "scaling": "atk", "element": "physical",
          "frames": { "hitmark": 12, "cancel": { "swap": 18, "skill": 14 } },
          "icd": { "tag": "normal", "group": "standard" }, "gauge": 1 }
      ]
    },
    "charged": { "hits": [], "stamina": 25 },
    "plunge": { "hits": [] },
    "skill": {
      "variants": ["press"],
      "cooldown": 600,
      "hits": [],
      "particles": { "count": 0.5, "perHit": true, "icd": 150 },
      "effects": ["raiden.eye.burstDmgBonus"]
    },
    "burst": {
      "energyCost": 90,
      "cooldown": 1080,
      "hits": [],
      "effects": [],
      "hook": "raiden.resolve"
    }
  },
  "passives": [ { "id": "raiden.a4", "unlock": "a4", "effects": [ /* Effect */ ] } ],
  "constellations": [ { "level": 1, "effects": [], "text": "..." } /* ... up to 6 */ ],
  "effects": [ /* Effect definitions referenced by id above */ ],
  "usualCombo": [                // used by custom teams (PLAN §6 Mode B); first variant is the default
    { "variant": "off-field", "actions": [ { "action": "skill" }, { "action": "burst" } ] },
    { "variant": "on-field",  "actions": [ { "action": "burst" }, { "action": "skill" },
                                           { "action": "normal", "hits": 3, "then": "charged",
                                             "repeat": "untilRotationEnd" } ] }
  ],
  "recommended": {
    "weapons": [ { "id": "engulfing-lightning", "source": "game8" } ],
    "artifacts": [ { "sets": { "emblem-of-severed-fate": 4 }, "source": "keqingmains" } ]
  },
  "assumptions": [],
  "hooks": ["raiden.resolve"],
  "needsHook": true,
  "provenance": {},
  "dataConfidence": "high"
}
```

## Weapon

```jsonc
{
  "id": "engulfing-lightning",
  "name": "Engulfing Lightning",
  "type": "polearm",
  "rarity": 5,
  "releaseVersion": "2.1",
  "baseAtk": { "lv90": 608 },
  "substat": { "stat": "er", "lv90": 0.551 },
  "obtain": { "method": "gacha", "freeRefinement": null },   // method: gacha | craft | event | battlepass | shop | chest
                                                            // freeRefinement: highest refinement obtainable free (e.g. 5 for an event weapon), null otherwise
  "passive": {
    "name": "Timeless Dream: Eternal Stove",
    "text": "...",
    "effects": [ /* Effect with perRefinement values */ ]
  },
  "assumptions": [ "Passive ER buff assumed to trigger on every burst" ],
  "provenance": {},
  "dataConfidence": "high"
}
```

Example of an event weapon (numbers from genshin-db 5.2.14):

```jsonc
{
  "id": "silver-light", "name": "Silver Light", "type": "sword", "rarity": 4, "releaseVersion": "7.1",
  "baseAtk": { "lv90": 509.61 }, "substat": { "stat": "atk%", "lv90": 0.4135 },
  "obtain": { "method": "event", "freeRefinement": 5, "event": "Silverwing in Pursuit of the Moon" },
  "passive": { "effects": [ { "id": "silver-light.em", "trigger": { "on": "onSkill" }, "target": "self",
      "stat": "em", "value": { "perRefinement": [52, 65, 78, 91, 104] },
      "duration": 720, "maxStacks": 2, "stackMode": "independent" } ] },
  "dataConfidence": "medium"
}
```

## Frame data provenance

Frame blocks (`frames`) carry their own source because they often come from gcsim while multipliers come from genshin-db:

```jsonc
"frames": { "hitmark": 14, "cancel": { "attack": 18, "skill": 14, "burst": 14, "dash": 14, "swap": 24 },
            "source": { "site": "gcsim", "url": "https://github.com/genshinsim/gcsim/blob/<commit>/internal/characters/raiden/attack.go", "commit": "<hash>" } }
```

## Roster (browser storage / export JSON, not part of KB)

```jsonc
{
  "version": 1,
  "characters": { "raiden-shogun": { "owned": true, "constellation": 0, "talents": [9, 9, 9], "level": 90 } },
  "weapons": { "silver-light": { "owned": true, "refinement": 5 } },
  "settings": { "executionProfile": "relaxed", "actionDelay": 18, "swapDelay": 18, "assumeAllWeapons": false }
}
```

## Artifact set

```jsonc
{
  "id": "emblem-of-severed-fate",
  "name": "Emblem of Severed Fate",
  "pieces": { "2": { "effects": [] }, "4": { "effects": [] } },
  "provenance": {}, "dataConfidence": "high"
}
```

## Team archetype

```jsonc
{
  "id": "raiden-national",
  "name": "Raiden National",
  "members": [
    { "slot": 1, "character": "raiden-shogun", "role": "driver",
      "substitutes": [],
      "weapons": ["engulfing-lightning", "the-catch"],
      "artifacts": [{ "sets": { "emblem-of-severed-fate": 4 } }],
      "mainStats": { "sands": "er", "goblet": "atk%", "circlet": "critRate|critDmg" },
      "erTarget": 2.5 }
  ],
  "rotation": {
    "lengthSeconds": 21,
    "script": [
      { "char": "bennett", "action": "burst" },
      { "char": "xiangling", "action": "burst" },
      { "char": "raiden-shogun", "action": "skill" }
    ],
    "source": "keqingmains"
  },
  "sourceRank": { "game8": "S", "gamewith": "SS", "keqingmains": null },
  "notes": "...",
  "status": "active",            // active | legacy (no longer listed by any source)
  "provenance": {}, "dataConfidence": "medium"
}
```

## Effect

```jsonc
{
  "id": "string, globally unique",
  "trigger": { "on": "always|onHit|onSkill|onBurst|onNormal|onCharged|onPlunge|onReaction|onSwapIn|onSwapOut|onHeal|onShield|onEnergy|custom",
               "filter": { "reaction": "vaporize", "element": "hydro", "talent": "skill" } },
  "condition": { "hpBelow": 0.5, "partyElementCount": { "pyro": 2 }, "moonsign": "ascendant", "custom": "hookName" },
  "target": "self|active|team|teamExceptSelf|enemy|enemiesHit",
  "stat": "see stat keys below",
  "value": 0.2,                                  // or { "perRefinement": [...] } or { "perTalentLevel": [...] }
  "scaling": { "from": "self.em", "ratio": 0.001, "cap": 0.4, "base": 0 },
  "duration": 600,
  "maxStacks": 1,
  "stackGain": { "on": "onHit", "icd": 18 },
  "icd": 0,
  "snapshot": false,
  "stackGroup": null,                            // effects sharing a group do not stack (e.g. two copies of a team-wide set buff)
  "assumption": "optional human-readable note used in the Assumptions view"
}
```

### Stat keys

`hp`, `hp%`, `atk`, `atk%`, `def`, `def%`, `em`, `er`, `critRate`, `critDmg`, `healingBonus`,
`dmgBonus.all`, `dmgBonus.<element>`, `dmgBonus.<talent>` (normal|charged|plunge|skill|burst),
`critRate.<talent>`, `critDmg.<talent>`, `flatDmg.<talent>`, `flatDmg.all`,
`reactionBonus.<reaction>`, `res.enemy.<element>`, `def.enemy.shred`, `defIgnore`,
`mvBonus.<talent>`, `baseDmgMultiplier.<talent>`, `energyGain`.

New stat keys require a schema change (code) and an entry in `docs/PROGRESS_LOG.md`.

## Mechanics files

- `kb/mechanics/reactions.json`: reaction id, type (amplifying / transformative / additive / lunar / other), multiplier, level-base table, EM bonus formula id, element pairs, gauge consumption.
- `kb/mechanics/icd.json`: named ICD groups (hit sequence, reset timer).
- `kb/mechanics/constants.json`: enemy DEF formula constants, level multipliers.

### Mechanics file shapes (M3)

Each mechanics file carries `id`, `provenance`, `dataConfidence`, `assumptions` like other records.

- `reactions.json`: `levelBase.lv90`, `aura { tax, decayBaseSeconds, decayPerUnitSeconds }`, `em { amplifying|transformative|additive|lunar: { k, c } }`, and `reactions.<id>` with `type`, `implemented`, `element?`, `multiplier?`, `pairs[] { trigger, aura, consume, multiplier? }`, optional `gcd`, `effect`, `tickFrames`, `firstHitDelay`, `waneUnits`, `coreDelay`, `coreDuration`, `cloudDuration`, `contributorWeights`, `notes`. `consume` is the aura gauge removed per unit of trigger gauge; 0 means the auras coexist (EC, burning, Lunar-Charged) or nothing is consumed (additive).
- `icd.json`: `groups.<name> { pattern, resetFrames }`. `pattern` repeats: 1 = the hit applies its element.
- `constants.json`: `swapCooldownFrames`, `particleDelayFrames`, `energy.particle { sameElement, neutral, otherElement }`, `energy.offFieldPenaltyPerPartyMember`.

Character talent blocks gained optional fields: `hits[].strike` (`'blunt'` shatters Frozen), `particles.delay`, `particles.element` (defaults to the character's element, `'none'` = colourless).

## meta.json

```jsonc
{
  "gameVersion": "7.1",
  "lastSync": "2026-09-25",
  "sources": {
    "keqingmains": { "status": "ok|blocked|changed", "lastChecked": "2026-09-25" },
    "game8": { "status": "ok", "lastChecked": "2026-09-25" },
    "gamewith": { "status": "ok", "lastChecked": "2026-09-25" }
  },
  "counts": { "characters": 0, "weapons": 0, "artifacts": 0, "teams": 0 }
}
```
