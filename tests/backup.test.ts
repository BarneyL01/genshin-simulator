import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, makeBackup, parseBackup, salvageRoster, salvageTeams } from '../src/ui/backup';
import type { Roster } from '../src/schema/roster';

const roster: Roster = {
  version: 1,
  characters: {
    'hu-tao': { owned: true, constellation: 1, talents: [9, 10, 8], level: 90 },
    xingqiu: { owned: false, constellation: 0, talents: [1, 1, 1], level: 90 },
  },
  weapons: { 'staff-of-homa': { owned: true, refinement: 2 } },
  settings: { executionProfile: 'relaxed', actionDelay: 18, swapDelay: 18, assumeAllWeapons: false },
};
const team = { id: 't1', name: 'Hu Tao vape', team: { order: ['hu-tao', 'xingqiu', 'yelan', 'zhongli'], builds: { 'hu-tao': { weapon: 'staff-of-homa', refinement: 1 } } } };

describe('backup export/import', () => {
  it('round-trips roster and saved teams', () => {
    const text = JSON.stringify(makeBackup(roster, [team], new Date('2026-09-27T00:00:00Z')));
    const p = parseBackup(text);
    expect(JSON.parse(text).format).toBe(BACKUP_FORMAT);
    expect(p.roster?.characters['hu-tao']).toEqual(roster.characters['hu-tao']);
    expect(p.roster?.weapons).toEqual(roster.weapons);
    expect(p.roster?.settings).toEqual(roster.settings);
    expect(p.savedTeams).toEqual([team]);
    expect(p.warnings).toEqual([]);
  });

  it('exports only entries that differ from the defaults', () => {
    const b = makeBackup(roster, []);
    expect(Object.keys(b.roster.characters)).toEqual(['hu-tao']);
    expect(Object.keys(b.roster.weapons)).toEqual(['staff-of-homa']);
  });

  it('accepts the older roster-only export and leaves saved teams alone', () => {
    const p = parseBackup(JSON.stringify(roster));
    expect(p.roster).toEqual(roster);
    expect(p.savedTeams).toBeNull();
  });

  it('accepts a bare list of saved teams', () => {
    const p = parseBackup(JSON.stringify([team]));
    expect(p.roster).toBeNull();
    expect(p.savedTeams).toEqual([team]);
  });

  it('skips one invalid entry instead of rejecting the whole roster', () => {
    const bad = { ...roster, characters: { ...roster.characters, keqing: { owned: true, constellation: 9, talents: [1, 1, 1] } } };
    const p = parseBackup(JSON.stringify(bad));
    expect(p.roster?.characters['hu-tao']?.owned).toBe(true);
    expect(p.roster?.characters.keqing).toBeUndefined();
    expect(p.warnings.join()).toContain('character keqing');
  });

  it('fills missing fields with defaults (C0, talents 1/1/1, R1, default settings)', () => {
    const r = salvageRoster({ characters: { bennett: { owned: true } }, weapons: { 'aquila-favonia': { owned: true } } });
    expect(r.roster?.characters.bennett).toEqual({ owned: true, constellation: 0, talents: [1, 1, 1], level: 90 });
    expect(r.roster?.weapons['aquila-favonia']).toEqual({ owned: true, refinement: 1 });
    expect(r.roster?.settings.executionProfile).toBe('relaxed');
  });

  it('gives a readable error for text that is not JSON or not a backup', () => {
    expect(() => parseBackup('{"characters": ')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"hello": 1}')).toThrow(/No roster or saved teams/);
  });

  it('drops malformed saved teams and names them', () => {
    const t = salvageTeams([team, { id: 't2', name: 'Broken' }]);
    expect(t.teams).toEqual([team]);
    expect(t.dropped).toEqual(['saved team "Broken"']);
  });
});
