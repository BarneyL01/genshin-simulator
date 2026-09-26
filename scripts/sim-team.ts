import { loadKb } from './kb-node';
import { rankTeams, runTeam, teamInput, type TeamRun } from '../src/kb';

/**
 *   npm run sim:team -- <team-id>     one team, details
 *   npm run sim:team -- --rank        every team, ranked (everything owned, C0, R1)
 */
const kb = loadKb();
const fmt = (n: number) => Math.round(n).toLocaleString();

function show(run: TeamRun): void {
  console.log(`\n=== ${run.label}`);
  console.log(`Relaxed DPS ${fmt(run.relaxed.dps)}   Frame-perfect DPS ${fmt(run.framePerfect.dps)}   rotation ${(run.relaxed.cycleFrames / 60).toFixed(1)} s (relaxed) / ${(run.framePerfect.cycleFrames / 60).toFixed(1)} s (frame-perfect)   [${run.kqms.simulations} sims for KQMS]`);
  for (const m of run.members) {
    const dps = run.relaxed.perCharacterDps[m.character] ?? 0;
    const liq = Object.entries(m.liquid).filter(([, n]) => n).map(([s, n]) => `${s}:${n}`).join(' ');
    const e = run.relaxed.energy[m.character];
    console.log(`  ${m.character.padEnd(14)} ${fmt(dps).padStart(8)} DPS  ${m.weaponId} R${m.refinement}  mains ${m.mains.sands}/${m.mains.goblet}/${m.mains.circlet}  liquid ${liq}${e ? `  ER needed ${(e.requiredEr ?? 0).toFixed(2)}` : ''}`);
  }
  if (run.notices.length) console.log('  notes:\n   - ' + run.notices.join('\n   - '));
}

const arg = process.argv[2];
if (arg === '--rank') {
  for (const r of rankTeams(kb, undefined)) {
    if (r.run) show(r.run);
    else console.log(`\n=== ${r.team.name}: skipped, missing ${r.missing.join(', ')}`);
  }
} else if (arg) {
  const t = kb.teams.get(arg);
  if (!t) throw new Error(`unknown team "${arg}". Known: ${[...kb.teams.keys()].join(', ')}`);
  show(runTeam(kb, teamInput(t)));
} else {
  console.log('usage: sim:team <team-id> | --rank\nteams:', [...kb.teams.keys()].join(', '));
}
