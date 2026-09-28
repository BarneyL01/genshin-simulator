import type { Element } from '../types';
import { registerHook } from './api';

/**
 * Varka (gcsim internal/characters/varka: asc.go, skill.go, cons.go). One hook, by effect id:
 *
 *  varka.a1-dmg  always   (Dawn Wind's March) registers a transform that, once per run, works out the team's
 *                conversion element (first of Pyro/Hydro/Electro/Cryo present) and the team-comp multiplier for
 *                Four Winds' Ascension (140% with 2+ Anemo or 2+ of one PHEC element, 220% with both); adds
 *                +min(ATK/1000×10%, 25%) base damage to Varka's own Anemo/conversion-element hits, and the
 *                team-comp bonus on top of that for Four Winds' Ascension specifically.
 *  varka.a2      onReaction  (Wind's Vanguard) +7.5% DMG (max 4 independent 8s stacks) to Normal/Charged/Four
 *                Winds' Ascension after any nearby party member's Swirl (approximated as `dmgBonus.normal` +
 *                `dmgBonus.charged` + `dmgBonus.skill`, so it also lightly affects the plain Skill tap).
 *  varka.c1      onSkill  (C1) the Skill tap (opening Sturm und Drang) arms a flag; the next Four Winds'
 *                Ascension doubles its multiplier and clears the flag.
 *  varka.c2      onSkill  (C2) an extra 800%-ATK Anemo hit (hookHit `c2`) after Four Winds' Ascension.
 *  varka.c4      onReaction  (C4) Varka's own Swirl gives the whole party +20% Anemo and +20% conversion-element
 *                DMG for 600 frames (10s).
 *
 * Not modelled: the upgraded Sturm und Drang Normal/Charged Attacks, Azure Devour, C6 (free extra use).
 */
const PRIORITY: Element[] = ['pyro', 'hydro', 'electro', 'cryo'];
const A1_PER_1000_ATK = 0.0001;
const A1_CAP = 0.25;
const A2_VALUE = 0.075;
const A2_DURATION = 480;
const A2_MAX_STACKS = 4;
const C4_VALUE = 0.2;
const C4_DURATION = 600;
const FOUR_WINDS_NAME = "Four Winds' Ascension";

interface State {
  conversionElem?: Element;
  teamMult?: number;
  registered?: boolean;
  c1Ready?: boolean;
}

registerHook('varka', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;

  const teamComp = () => {
    if (st.conversionElem === undefined) {
      st.conversionElem = PRIORITY.find((el) => api.characters.some((c) => c.element === el));
      const counts = new Map<Element, number>();
      for (const c of api.characters) counts.set(c.element, (counts.get(c.element) ?? 0) + 1);
      const twoAnemo = (counts.get('anemo') ?? 0) >= 2;
      const twoOfOne = PRIORITY.some((el) => (counts.get(el) ?? 0) >= 2);
      st.teamMult = twoAnemo && twoOfOne ? 1.2 : twoAnemo || twoOfOne ? 0.4 : 0;
    }
    return { conversionElem: st.conversionElem, teamMult: st.teamMult! };
  };

  switch (e.id) {
    case 'varka.a1-dmg': {
      if (st.registered) return;
      st.registered = true;
      api.transformHit(({ char, hit, frame }) => {
        if (char !== owner) return undefined;
        const { conversionElem, teamMult } = teamComp();
        // "(elemental)" is a placeholder slot authored as Pyro (the schema needs a concrete static element at
        // KB-authoring time); its real element is the team's conversion element, worked out once above.
        const isConversionSlot = hit.name?.endsWith('(elemental)') ?? false;
        // gcsim: falls back to Physical when no Pyro/Hydro/Electro/Cryo party member is present.
        const elementOverride = isConversionSlot ? (conversionElem ?? 'physical') : undefined;
        const effectiveElement = elementOverride ?? hit.element;
        const isElemental = effectiveElement === 'anemo' || (conversionElem && effectiveElement === conversionElem);
        if (!isElemental && !elementOverride) return undefined;
        const atk = api.stats(owner, frame).atk;
        const a1 = Math.min(atk * A1_PER_1000_ATK, A1_CAP);
        const fourWinds = hit.name?.startsWith(FOUR_WINDS_NAME) ? teamMult : 0;
        if (a1 === 0 && fourWinds === 0 && !elementOverride) return undefined;
        return { ...hit, element: effectiveElement, baseMult: (hit.baseMult ?? 0) + a1 + fourWinds };
      });
      return;
    }

    case 'varka.a2': {
      if (api.reaction?.name !== 'swirl') return;
      const f = api.reaction.frame;
      for (const stat of ['dmgBonus.normal', 'dmgBonus.charged', 'dmgBonus.skill']) {
        api.buff({ effectId: `varka.a2.${stat}`, target: owner.id, stat, value: A2_VALUE, duration: A2_DURATION, maxStacks: A2_MAX_STACKS, stackMode: 'independent' }, f);
      }
      return;
    }

    case 'varka.c1': {
      const name = api.action?.name;
      if (name === 'fourWinds') {
        if (!st.c1Ready) return;
        st.c1Ready = false;
        // Scope the doubling to this one cast's hits (they land ~34-43 frames after the action starts).
        const castStart = api.frame;
        api.transformHit(({ char, hit, frame }) =>
          char === owner && frame >= castStart && frame <= castStart + 100 && hit.name?.startsWith(FOUR_WINDS_NAME) ? { ...hit, mv: hit.mv * 2 } : undefined,
        );
        return;
      }
      st.c1Ready = true;
      return;
    }

    case 'varka.c2': {
      if (api.action?.name !== 'fourWinds') return;
      api.hit('c2', api.frame + 10);
      return;
    }

    case 'varka.c4': {
      const { conversionElem } = teamComp();
      if (api.reaction?.name !== 'swirl' || api.reaction.actor !== owner || !conversionElem) return;
      const f = api.reaction.frame;
      for (const c of api.characters) {
        api.buff({ effectId: 'varka.c4.anemo', target: c.id, stat: 'dmgBonus.anemo', value: C4_VALUE, duration: C4_DURATION }, f);
        api.buff({ effectId: 'varka.c4.elem', target: c.id, stat: `dmgBonus.${conversionElem}`, value: C4_VALUE, duration: C4_DURATION }, f);
      }
      return;
    }

    default:
      api.assume(`${e.id}: unknown Varka effect id, skipped`);
  }
});
