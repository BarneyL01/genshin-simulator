import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DIR, listRecords, readMeta } from './kb-lib';
import { validateRecords } from './validate-core';

type Rec = { id: string; name: string; dataConfidence: string; needsHook?: boolean };
const { issues, parsed } = validateRecords(listRecords());
if (issues.length > 0) {
  console.error('kb:index refused: run npm run kb:validate and fix issues first');
  process.exit(1);
}

const index = Object.fromEntries(
  Object.entries(parsed).map(([kind, m]) => [kind, [...(m as Map<string, Rec>).values()].map((r) => ({ id: r.id, name: r.name, dataConfidence: r.dataConfidence })).sort((a, b) => a.id.localeCompare(b.id))]),
);
writeFileSync(join(KB_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');

const meta = readMeta();
meta.counts = {
  characters: parsed.characters.size,
  weapons: parsed.weapons.size,
  artifacts: parsed.artifacts.size,
  teams: parsed.teams.size,
};
writeFileSync(join(KB_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

// Coverage report
const byConf: Record<string, number> = { high: 0, medium: 0, low: 0 };
const needHook: string[] = [];
for (const m of Object.values(parsed)) for (const r of (m as Map<string, Rec>).values()) {
  byConf[r.dataConfidence] = (byConf[r.dataConfidence] ?? 0) + 1;
  if (r.needsHook) needHook.push(r.id);
}
console.log('counts:', meta.counts);
console.log('dataConfidence:', byConf);
console.log('needsHook:', needHook.length ? needHook.join(', ') : 'none');
