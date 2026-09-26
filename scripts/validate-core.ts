import { basename } from 'node:path';
import { z } from 'zod';
import { KINDS, type Kind, type LoadedRecord } from './kb-lib';
import type { ArtifactSet, Character, Enemy, Team, Weapon } from '../src/schema';

interface RecordByKind {
  characters: Character;
  weapons: Weapon;
  artifacts: ArtifactSet;
  teams: Team;
  enemies: Enemy;
}
type Parsed = { [K in Kind]: Map<string, RecordByKind[K]> };

export interface Issue {
  file: string;
  message: string;
}

/** Action names a rotation may use for a character: n1..nK, charged, plunge, skill, burst and extra actions. */
export function actionNames(c: Character): Set<string> {
  const names = new Set<string>(Object.keys(c.extraActions));
  const t = c.talents;
  (t.normal?.hits ?? []).forEach((_, i) => names.add(`n${i + 1}`));
  for (const k of ['charged', 'plunge', 'skill', 'burst'] as const) {
    const b = t[k];
    if (b && (b.hits.length > 0 || b.frames)) names.add(k);
  }
  return names;
}

/** Schema, filename/id, cross-reference and hook checks over loaded records. */
export function validateRecords(records: LoadedRecord[]): { issues: Issue[]; parsed: Parsed } {
  const issues: Issue[] = [];
  const parsed: Parsed = { characters: new Map(), weapons: new Map(), artifacts: new Map(), teams: new Map(), enemies: new Map() };

  for (const r of records) {
    const res = (KINDS[r.kind] as z.ZodType).safeParse(r.raw);
    if (!res.success) {
      for (const i of res.error.issues) issues.push({ file: r.file, message: `${i.path.join('.')}: ${i.message}` });
      continue;
    }
    const data = res.data as { id: string };
    if (basename(r.file, '.json') !== data.id) issues.push({ file: r.file, message: `filename must match id "${data.id}"` });
    const bucket = parsed[r.kind] as Map<string, unknown>;
    if (bucket.has(data.id)) issues.push({ file: r.file, message: `duplicate id "${data.id}"` });
    bucket.set(data.id, data);
  }

  const has = (kind: Kind, id: string) => parsed[kind].has(id);
  const ref = (file: string, kind: Kind, id: string, where: string) => {
    if (!has(kind, id)) issues.push({ file, message: `${where}: unknown ${kind.slice(0, -1)} "${id}"` });
  };

  for (const [id, c] of parsed.characters) {
    const file = `characters/${id}.json`;
    for (const w of c.recommended.weapons) ref(file, 'weapons', w.id, 'recommended.weapons');
    for (const a of c.recommended.artifacts) for (const s of Object.keys(a.sets)) ref(file, 'artifacts', s, 'recommended.artifacts');
    if (c.needsHook && c.hooks.length === 0) issues.push({ file, message: 'needsHook is true but hooks is empty' });
  }
  for (const [id, t] of parsed.teams) {
    const file = `teams/${id}.json`;
    const members = new Set<string>();
    for (const m of t.members) {
      members.add(m.character);
      ref(file, 'characters', m.character, `members[${m.slot}].character`);
      for (const s of m.substitutes) ref(file, 'characters', s, `members[${m.slot}].substitutes`);
      for (const w of m.weapons) ref(file, 'weapons', w, `members[${m.slot}].weapons`);
      for (const a of m.artifacts) for (const s of Object.keys(a.sets)) ref(file, 'artifacts', s, `members[${m.slot}].artifacts`);
    }
    const steps = t.rotation.script.flatMap((item) => ('steps' in item ? item.steps : [item]));
    for (const step of steps) {
      if (!members.has(step.char)) {
        issues.push({ file, message: `rotation.script: "${step.char}" is not a team member` });
        continue;
      }
      const c = parsed.characters.get(step.char);
      if (c && step.action !== 'wait' && !actionNames(c).has(step.action)) {
        issues.push({ file, message: `rotation.script: ${step.char} has no action "${step.action}"` });
      }
    }
    for (const item of t.rotation.script) {
      if ('steps' in item && 'untilBuffEnds' in item.repeat && !members.has(item.repeat.untilBuffEnds.source)) {
        issues.push({ file, message: `rotation.script: untilBuffEnds source "${item.repeat.untilBuffEnds.source}" is not a team member` });
      }
    }
  }
  return { issues, parsed };
}
