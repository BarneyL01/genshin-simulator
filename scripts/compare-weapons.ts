import { loadKb } from './kb-node';
import { compareWeapons, teamInput } from '../src/kb';

/**
 * Compare weapons on one character inside a KB team (terminal version of the Weapon comparer tab).
 *   npm run compare:weapons -- <team-id> <character-id> <weapon-id>:<refinement> [...]
 * The first weapon is the baseline. Example:
 *   npm run compare:weapons -- odette-stellar-conduct odette silver-light:1 silver-light:5 favonius-sword:5 absolution:1
 */
const [teamId, charId, ...weaponArgs] = process.argv.slice(2);
if (!teamId || !charId || weaponArgs.length < 2) {
  console.error('usage: npm run compare:weapons -- <team-id> <character-id> <weapon>:<R> <weapon>:<R> [...]');
  process.exit(1);
}
const kb = loadKb();
const team = kb.teams.get(teamId);
if (!team) throw new Error(`unknown team "${teamId}"`);
const candidates = weaponArgs.map((a) => {
  const [weaponId, r] = a.split(':');
  if (!kb.weapons.has(weaponId!)) throw new Error(`unknown weapon "${weaponId}"`);
  return { weaponId: weaponId!, refinement: Number(r ?? 1) };
});
const rows = compareWeapons(kb, teamInput(team), charId, candidates, candidates[0]!, { burstPolicy: process.env.BURSTS === 'always' ? 'always' : undefined });
const fmt = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
console.log(`${team.name} — ${charId} (baseline ${candidates[0]!.weaponId} R${candidates[0]!.refinement}; Relaxed profile)`);
console.log('weapon                         team DPS   Δteam   char DPS   Δchar   worst-case char   ER need  confidence  passive');
for (const r of rows) {
  const w = kb.weapons.get(r.weaponId)!;
  const passive = w.passive.effects.length ? 'modelled' : 'NOT modelled (stats only)';
  console.log(
    `${`${w.name} R${r.refinement}${r.isBaseline ? ' (A)' : ''}`.padEnd(30)} ${fmt(r.teamDps).padStart(8)} ${pct(r.teamDelta).padStart(7)} ${fmt(r.charDps).padStart(9)} ${pct(r.charDelta).padStart(7)} ${fmt(r.worst.charDps).padStart(16)}  ${r.requiredEr === null ? '   —' : `${(r.requiredEr * 100).toFixed(0)}%`.padStart(6)}  ${r.confidence.padEnd(10)}  ${passive}`,
  );
}
