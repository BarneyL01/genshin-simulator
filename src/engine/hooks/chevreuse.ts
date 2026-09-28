import { registerHook } from './api';

/**
 * Chevreuse (gcsim internal/characters/chevreuse: asc.go, skill.go, cons.go). One hook, by effect id:
 *
 *  chevreuse.a1  onReaction  Vanguard's Coordinated Tactics: only active when every party member is Pyro or
 *                Electro with at least one of each. After any Overloaded reaction, −40% Pyro and −40% Electro
 *                RES on the enemy for 360 frames (6s), refreshed on every trigger.
 *  chevreuse.a4  onSkill     Vertical Force Coordination: on every Skill cast (Overcharged Ball assumed),
 *                Pyro/Electro party members gain +1% ATK per 1,000 of Chevreuse's Max HP (snapshot at cast,
 *                capped at +40%) for 1800 frames (30s).
 *  chevreuse.c1  onReaction  (C1) When the on-field character (not Chevreuse) triggers Overloaded, they gain
 *                6 energy, at most once per 600 frames (10s).
 *  chevreuse.c2  onSkill     (C2) Two extra Pyro hits (hookHit `c2bomb`, 120% ATK each) ~48 frames after the
 *                Skill hit, at most once per 600 frames (10s).
 *
 * Not modelled: C4 (removing the Skill cooldown after Burst — the engine has no hook API to bypass a scheduled
 * cooldown check) and C6 (heal-triggered effects — healing is not tracked).
 */
const A1_A4_RES_DURATION = 360;
const C1_ICD = 600;
const C2_ICD = 600;
const C2_DELAY = 48;
const A4_DURATION = 1800;
const A4_HP_PER_PERCENT = 100000; // 1% per 1,000 HP → ratio = 0.01 / 1000
const A4_CAP = 0.4;

interface State {
  onlyPyroElectro?: boolean;
  nextC1?: number;
  nextC2?: number;
}

registerHook('chevreuse', (api) => {
  const st = api.state as State;
  const owner = api.owner;
  const e = api.effect;
  if (st.onlyPyroElectro === undefined) {
    const els = new Set(api.characters.map((c) => c.element));
    st.onlyPyroElectro = els.has('pyro') && els.has('electro') && [...els].every((el) => el === 'pyro' || el === 'electro');
  }

  switch (e.id) {
    case 'chevreuse.a1': {
      if (!st.onlyPyroElectro || api.reaction?.name !== 'overloaded') return;
      const f = api.reaction.frame;
      api.buff({ effectId: 'chevreuse.a1.pyro', target: 'enemy', stat: 'res.enemy.pyro', value: -0.4, duration: A1_A4_RES_DURATION }, f);
      api.buff({ effectId: 'chevreuse.a1.electro', target: 'enemy', stat: 'res.enemy.electro', value: -0.4, duration: A1_A4_RES_DURATION }, f);
      return;
    }

    case 'chevreuse.a4': {
      const frame = api.action?.start ?? api.frame;
      const hp = api.stats(owner, frame).hp;
      const value = Math.min(hp / A4_HP_PER_PERCENT, A4_CAP);
      for (const c of api.characters) {
        if (c.element === 'pyro' || c.element === 'electro') api.buff({ effectId: 'chevreuse.a4', target: c.id, stat: 'atk%', value, duration: A4_DURATION }, frame);
      }
      return;
    }

    case 'chevreuse.c1': {
      if (!st.onlyPyroElectro || api.reaction?.name !== 'overloaded') return;
      const r = api.reaction;
      if (r.actor === owner || r.actor.id !== api.activeAt(r.frame) || r.frame < (st.nextC1 ?? -Infinity)) return;
      st.nextC1 = r.frame + C1_ICD;
      api.energy(r.actor.id, 6, r.frame);
      return;
    }

    case 'chevreuse.c2': {
      const frame = api.action?.start ?? api.frame;
      if (frame < (st.nextC2 ?? -Infinity)) return;
      st.nextC2 = frame + C2_ICD;
      api.hit('c2bomb', frame + C2_DELAY);
      api.hit('c2bomb', frame + C2_DELAY);
      return;
    }

    default:
      api.assume(`${e.id}: unknown Chevreuse effect id, skipped`);
  }
});
