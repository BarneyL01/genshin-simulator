import { loadKb } from './kb-node';
import { customRunInput, runTeam } from '../src/kb';

/**
 * BURSTS=always lets unaffordable bursts fire (default: energy-limited, they are skipped).
 * Compare custom teams that share everything except one slot.
 *   npm run compare -- "a,b,c,X" "a,b,c,Y"     (comma-separated character ids in acting order; the last one plays on-field)
 */
const kb = loadKb();
const fmt = (n: number) => Math.round(n).toLocaleString();
for (const arg of process.argv.slice(2)) {
  const order = arg.split(',');
  const variants = { [order[order.length - 1]!]: 'on-field' };
  const input = customRunInput(kb, { order, variants });
  const run = runTeam(kb, input, { cycles: 5, burstPolicy: process.env.BURSTS === 'always' ? 'always' : 'requireEnergy' });
  const r = run.relaxed;
  const count = (name: string) => r.hits.filter((h) => h.cycle >= 2 && h.reactions.includes(name)).length;
  console.log(`\n=== ${order.join(' → ')}`);
  console.log(`Relaxed ${fmt(r.dps)} DPS · Frame-perfect ${fmt(run.framePerfect.dps)} · rotation ${(r.cycleFrames / 60).toFixed(1)} s`);
  for (const m of run.members) {
    const e = r.energy[m.character];
    console.log(`  ${m.character.padEnd(14)} ${fmt(r.perCharacterDps[m.character] ?? 0).padStart(7)} DPS  ${m.weaponId}  mains ${m.mains.sands}/${m.mains.goblet}/${m.mains.circlet}${e ? `  ER needs ${(e.requiredEr ?? 0).toFixed(2)}` : ''}`);
  }
  const polestar = r.buffs.filter((b) => b.effectId === 'polestar.cryo' && b.target === order[order.length - 1]);
  console.log(`  reactions (cycles 2+): stellarConduct ${count('stellarConduct')}, superconduct ${count('superconduct')}, melt ${count('melt')}, frozen ${count('freeze')}; polestar buff windows ${polestar.length}, values ${[...new Set(polestar.map((b) => b.value))].join('/')}`);
  console.log('  notes: ' + [...new Set([...run.notices, ...input.notes])].slice(0, 6).join(' | '));
}
