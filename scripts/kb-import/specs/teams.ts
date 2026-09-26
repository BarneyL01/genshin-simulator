import type { Team } from '../../../src/schema/team';
import { GAME_VERSION, RETRIEVED } from '../lib';

type Step = { char: string; action: string; firstCycleOnly?: boolean; every?: number };
const s = (char: string, ...actions: string[]): Step[] => actions.map((action) => ({ char, action }));

const RAIDEN_URL = 'https://keqingmains.com/q/raiden-quickguide/';
const HUTAO_URL = 'https://keqingmains.com/hu-tao/';

/** Team definitions. Main stats and weapons come from each member's own `recommended` block in the KB. */
export const specs: Array<Omit<Team, 'members'> & { members: Array<{ character: string; role: string; weapons: string[]; sets: Record<string, number> }> }> = [
  {
    id: 'raiden-national',
    name: 'Raiden National',
    provenance: {
      sources: [
        { site: 'keqingmains', url: RAIDEN_URL, retrieved: RETRIEVED, fields: ['team composition', 'sample rotation', 'roles'] },
      ],
      conflicts: [],
      gameVersion: GAME_VERSION,
    },
    dataConfidence: 'medium',
    assumptions: [
      'Rotation translated from KeqingMains: "(Raiden E)¹ > Xingqiu EDQ N1 > Bennett Q N1 E > Xiangling N1 Q N1 ED > Bennett E N1 > Raiden Q combo E > Bennett E > (Xiangling)²" (¹ first rotation only). Dash cancels are not modelled; "combo" is the sword-attack chain N1-N4 + charged, repeated for as long as Musou Isshin lasts.',
      'Xiangling\'s optional catch of Bennett particles at the end is left out.',
      'Weapons and artifact sets are the top choices from each character\'s KeqingMains quick guide that exist in the KB; Bennett uses Favonius Sword (KQM: best when the team has very high ER requirements).',
      'Game8 / GameWith ranks are not recorded yet.',
    ],
    members: [
      { character: 'raiden-shogun', role: 'driver', weapons: ['engulfing-lightning', 'the-catch'], sets: { 'emblem-of-severed-fate': 4 } },
      { character: 'xiangling', role: 'off-field-dps', weapons: ['the-catch', 'favonius-lance'], sets: { 'emblem-of-severed-fate': 4 } },
      { character: 'xingqiu', role: 'hydro-applicator', weapons: ['favonius-sword'], sets: { 'emblem-of-severed-fate': 4 } },
      { character: 'bennett', role: 'buffer', weapons: ['favonius-sword', 'aquila-favonia'], sets: { 'noblesse-oblige': 4 } },
    ] as never,
    rotation: {
      source: 'keqingmains',
      sourceUrl: RAIDEN_URL,
      original: '(Raiden E)¹ > Xingqiu EDQ N1 > Bennett Q N1 E > Xiangling N1 Q N1 ED > Bennett E N1 > Raiden Q combo E > Bennett E > (Xiangling)²  ¹First rotation only',
      script: [
        { char: 'raiden-shogun', action: 'skill', firstCycleOnly: true },
        ...s('xingqiu', 'skill', 'burst', 'n1'),
        ...s('bennett', 'burst', 'n1', 'skill'),
        ...s('xiangling', 'n1', 'burst', 'n1', 'skill'),
        ...s('bennett', 'skill', 'n1'),
        ...s('raiden-shogun', 'burst'),
        {
          repeat: { untilBuffEnds: { effect: 'raiden.musou', source: 'raiden-shogun' } },
          steps: s('raiden-shogun', 'sword-n1', 'sword-n2', 'sword-n3', 'sword-n4', 'sword-charged'),
        },
        ...s('raiden-shogun', 'skill'),
        ...s('bennett', 'skill'),
      ],
    },
    sourceRank: { keqingmains: null },
    notes: 'Xiangling vaporizes from off-field, Xingqiu supplies Hydro, Bennett buffs, Raiden batteries and adds Electro.',
    status: 'active',
  },
  {
    id: 'hu-tao-double-hydro-zhongli',
    name: 'Hu Tao Double Hydro (Zhongli)',
    provenance: {
      sources: [
        { site: 'keqingmains', url: HUTAO_URL, retrieved: RETRIEVED, fields: ['team composition', 'sample rotation', 'roles'] },
      ],
      conflicts: [],
      gameVersion: GAME_VERSION,
    },
    dataConfidence: 'medium',
    assumptions: [
      'Rotation translated from KeqingMains (Double Hydro, Zhongli variant, "Yelan 1E"): "Xingqiu QE (catch particles) > Yelan EQ > Zhongli hE > Hu Tao combo". NA weaves after Xingqiu and Yelan are added because KQM says to weave when none are specified.',
      '"Hu Tao combo" is E, then Q (placement not specified by KQM; assumed right after E), then N1C repeated for as long as Paramita Papilio lasts. KQM says Hu Tao should burst every other rotation (low ER, stay under 50% HP), so her burst has every: 2 and the team should be measured over an even number of cycles. Dash and jump cancels are not modelled.',
      'The sim does not track HP: Hu Tao is assumed at or below 50% HP (Homa low-HP bonus, A4, low-HP burst).',
      'Zhongli holds his skill (Jade Shield: −20% RES to all elements and physical). Favonius Lance is not used on Zhongli, so no particles from his weapon.',
      'Yelan carries Favonius Warbow: KeqingMains says her ER needs are very high in this team and Warbow is her general best option there; Aqua Simulacra is the personal-damage alternative.',
      'Game8 / GameWith ranks are not recorded yet.',
    ],
    members: [
      { character: 'hu-tao', role: 'driver', weapons: ['staff-of-homa'], sets: { 'crimson-witch-of-flames': 4 } },
      { character: 'xingqiu', role: 'hydro-applicator', weapons: ['favonius-sword'], sets: { 'emblem-of-severed-fate': 4 } },
      { character: 'yelan', role: 'hydro-applicator', weapons: ['favonius-warbow', 'aqua-simulacra'], sets: { 'emblem-of-severed-fate': 4 } },
      { character: 'zhongli', role: 'shielder', weapons: ['black-tassel'], sets: {} },
    ] as never,
    rotation: {
      source: 'keqingmains',
      sourceUrl: HUTAO_URL,
      original: 'Xingqiu QE (catch particles) > Yelan EQ > Zhongli hE > Hu Tao combo',
      script: [
        ...s('xingqiu', 'burst', 'skill', 'n1'),
        ...s('yelan', 'skill', 'burst', 'n1'),
        ...s('zhongli', 'skill'),
        { char: 'hu-tao', action: 'skill' },
        { char: 'hu-tao', action: 'burst', every: 2 },
        {
          repeat: { untilBuffEnds: { effect: 'hutao.paramita.infusion', source: 'hu-tao' } },
          steps: s('hu-tao', 'n1', 'charged'),
        },
      ],
    },
    sourceRank: { keqingmains: null },
    notes: 'Double Hydro supplies Vaporize and Hydro resonance; Zhongli shreds resistance with Jade Shield.',
    status: 'active',
  },
];
