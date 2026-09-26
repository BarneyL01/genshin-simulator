import { describe, expect, it } from 'vitest';
import { effect, weapon, roster } from '../src/schema';
import { validateRecords } from '../scripts/validate-core';
import { listRecords, readMechanics } from '../scripts/kb-lib';

const provenance = {
  sources: [{ site: 'genshin-db', url: 'https://github.com/theBowja/genshin-db', retrieved: '2026-09-25' }],
  gameVersion: '7.1',
};

const silverLight = {
  id: 'silver-light', name: 'Silver Light', type: 'sword', rarity: 4, releaseVersion: '7.1',
  baseAtk: { lv90: 509.61 }, substat: { stat: 'atk%', lv90: 0.4135 },
  obtain: { method: 'event', freeRefinement: 5, event: 'Silverwing in Pursuit of the Moon' },
  passive: {
    effects: [{
      id: 'silver-light.em', trigger: { on: 'onSkill' }, target: 'self', stat: 'em',
      value: { perRefinement: [52, 65, 78, 91, 104] }, duration: 720, maxStacks: 2, stackMode: 'independent',
    }],
  },
  provenance, dataConfidence: 'medium',
};

describe('schemas', () => {
  it('accepts the documented event weapon example', () => {
    expect(weapon.safeParse(silverLight).success).toBe(true);
  });
  it('rejects percentages stored as whole numbers', () => {
    expect(weapon.safeParse({ ...silverLight, substat: { stat: 'atk%', lv90: 41.35 } }).success).toBe(false);
  });
  it('rejects unknown stat keys and non-kebab ids', () => {
    const e = silverLight.passive.effects[0]!;
    expect(effect.safeParse({ ...e, stat: 'bogus' }).success).toBe(false);
    expect(weapon.safeParse({ ...silverLight, id: 'Silver_Light' }).success).toBe(false);
  });
  it('requires provenance', () => {
    const rest: Partial<typeof silverLight> = { ...silverLight };
    delete rest.provenance;
    expect(weapon.safeParse(rest).success).toBe(false);
  });
  it('applies roster defaults', () => {
    const r = roster.parse({ version: 1, characters: { a: { owned: true } }, weapons: { b: { owned: true } }, settings: {} });
    expect(r.characters.a).toMatchObject({ constellation: 0, talents: [1, 1, 1], level: 90 });
    expect(r.weapons.b!.refinement).toBe(1);
    expect(r.settings.actionDelay).toBe(18);
  });
});

describe('kb validation', () => {
  it('the checked-in KB is valid', () => {
    expect(validateRecords(listRecords()).issues).toEqual([]);
  });
  it('mechanics files parse', () => {
    for (const m of readMechanics()) expect(m.result.success, m.name).toBe(true);
  });
  it('flags dangling references', () => {
    const team = {
      id: 't', name: 'T', provenance, dataConfidence: 'low',
      members: [1, 2, 3, 4].map((slot) => ({ slot, character: `c${slot}`, role: 'x' })),
      rotation: { lengthSeconds: 20, script: [{ char: 'c1', action: 'skill' }], source: 'test' },
    };
    const { issues } = validateRecords([{ kind: 'teams', file: 'teams/t.json', raw: team }]);
    expect(issues.some((i) => i.message.includes('unknown character "c1"'))).toBe(true);
  });
});
