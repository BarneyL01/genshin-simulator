import { useMemo, useState } from 'react';
import type { KbData, SavedTeam, WeaponComparison } from '../kb';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Badge, Button, Section, Table, confidenceTone } from './Common';
import { fmt, nameOf, pct, signedPct } from './format';

export function CompareView({ kb, roster, saved }: { kb: KbData; roster: Roster; saved: SavedTeam[] }) {
  const teams = [...kb.teams.values()].filter((t) => t.status === 'active');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const savedTeam = saved.find((t) => `saved:${t.id}` === teamId);
  const knownTeam = kb.teams.get(teamId);
  const team = savedTeam
    ? { members: savedTeam.team.order.map((id) => ({ character: id, weapons: savedTeam.team.builds?.[id]?.weapon ? [savedTeam.team.builds[id]!.weapon!] : kb.characters.get(id)?.recommended.weapons.map((w) => w.id) ?? [] })) }
    : knownTeam;
  const [charId, setCharId] = useState('');
  const activeChar = team?.members.find((m) => m.character === charId)?.character ?? team?.members[0]?.character ?? '';
  const character = kb.characters.get(activeChar);
  const candidates = useMemo(() => [...kb.weapons.values()].filter((w) => w.type === character?.weaponType).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)), [kb, character]);
  type Pick = { weaponId: string; refinement: number };
  const [pickA, setPickA] = useState<Pick>();
  const [pickB, setPickB] = useState<Pick>();
  const recommended = team?.members.find((m) => m.character === activeChar)?.weapons[0] ?? candidates[0]?.id ?? '';
  const a: Pick = pickA && candidates.some((w) => w.id === pickA.weaponId) ? pickA : { weaponId: recommended, refinement: 1 };
  const b: Pick = pickB && candidates.some((w) => w.id === pickB.weaponId) ? pickB : { weaponId: candidates.find((w) => w.id !== a.weaponId)?.id ?? a.weaponId, refinement: 1 };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<WeaponComparison[]>([]);

  async function go() {
    if (!team) return;
    setBusy(true);
    setError('');
    try {
      const list = a.weaponId === b.weaponId && a.refinement === b.refinement ? [a] : [a, b];
      const r = (await sim().request({
        type: 'compare', teamId, custom: savedTeam && { team: savedTeam.team, rotationJson: savedTeam.rotationJson, name: savedTeam.name }, characterId: activeChar, candidates: list, baseline: a,
        settings: { roster: { ...roster, settings: { ...roster.settings, assumeAllWeapons: true } }, cycles: 3, actionDelay: roster.settings.actionDelay, swapDelay: roster.settings.swapDelay },
      })) as Response & { ok: true; type: 'compare' };
      setRows(r.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const picker = (label: string, v: Pick, set: (p: Pick) => void) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 font-medium">{label}</span>
      <select className="max-w-64 rounded border px-1" value={v.weaponId} onChange={(e) => { set({ ...v, weaponId: e.target.value }); setRows([]); }}>
        {candidates.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.rarity}★){w.obtain.freeRefinement ? ` — R${w.obtain.freeRefinement} free` : ''}</option>)}
      </select>
      <select className="rounded border px-1" value={v.refinement} aria-label={`${label} refinement`} onChange={(e) => { set({ ...v, refinement: Number(e.target.value) }); setRows([]); }}>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <p className="text-sm text-slate-600">
        Pick two weapons for one character of a known or saved team and compare them against each other in the same rotation. Deltas are B relative to A. Only that character's artifact stats are re-optimised (KQM Standard).
        New weapons are simulated from their passive as recorded in the knowledge base, so a result exists even without community test data; the
        confidence badge and the listed assumptions tell you how far to trust it. "Worst case" assumes uncertain passive conditions are not met.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <label>Team <select className="rounded border px-1" value={teamId} onChange={(e) => { setTeamId(e.target.value); setCharId(''); setPickA(undefined); setPickB(undefined); setRows([]); }}>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          {saved.map((t) => <option key={t.id} value={`saved:${t.id}`}>{t.name} (saved)</option>)}
        </select></label>
        <label>Character <select className="rounded border px-1" value={activeChar} onChange={(e) => { setCharId(e.target.value); setPickA(undefined); setPickB(undefined); setRows([]); }}>
          {team?.members.map((m) => <option key={m.character} value={m.character}>{nameOf(m.character)}</option>)}
        </select></label>
      </div>

      <Section title={`Weapons to compare (${character?.weaponType ?? ''})`}>
        <div className="space-y-2">
          {picker('Weapon A', a, setPickA)}
          {picker('Weapon B', b, setPickB)}
        </div>
        <div className="mt-2"><Button primary onClick={go} disabled={busy || !a.weaponId}>{busy ? 'Simulating…' : 'Compare'}</Button></div>
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </Section>

      {rows.length > 0 && (
        <Section title="Results (sorted by team DPS)">
          <Table head={['Weapon', 'Team DPS', 'Δ team', `${nameOf(activeChar)} DPS`, 'Δ character', 'Worst case (char)', 'ER needed', 'Confidence', 'Obtain']}>
            {rows.map((r) => (
              <tr key={`${r.weaponId}-${r.refinement}`} className={r.isBaseline ? 'bg-slate-50 font-medium' : ''}>
                <td>{nameOf(r.weaponId)} R{r.refinement}{r.isBaseline ? ' (A)' : ''}</td>
                <td>{fmt(r.teamDps)}</td>
                <td className={r.teamDelta > 0.0005 ? 'text-emerald-700' : r.teamDelta < -0.0005 ? 'text-red-700' : ''}>{r.isBaseline ? '—' : signedPct(r.teamDelta)}</td>
                <td>{fmt(r.charDps)}</td>
                <td className={r.charDelta > 0.0005 ? 'text-emerald-700' : r.charDelta < -0.0005 ? 'text-red-700' : ''}>{r.isBaseline ? '—' : signedPct(r.charDelta)}</td>
                <td>{fmt(r.worst.charDps)} <span className="text-xs text-slate-500">({signedPct(r.worst.charDps / Math.max(1, r.charDps) - 1)})</span></td>
                <td>{r.requiredEr === null ? '—' : pct(r.requiredEr, 0)} {r.requiredErDelta !== null && !r.isBaseline && <span className="text-xs text-slate-500">({r.requiredErDelta >= 0 ? '+' : ''}{(r.requiredErDelta * 100).toFixed(0)} pts)</span>}</td>
                <td><Badge tone={confidenceTone(r.confidence)}>{r.confidence}</Badge></td>
                <td className="text-xs">{r.obtain}</td>
              </tr>
            ))}
          </Table>
          <div className="mt-3 space-y-1">
            {rows.map((r) => (
              <details key={`a-${r.weaponId}-${r.refinement}`} className="rounded border border-slate-200 px-2 py-1 text-sm">
                <summary className="cursor-pointer">Assumptions: {nameOf(r.weaponId)}</summary>
                <ul className="ml-5 mt-1 list-disc text-xs text-slate-700">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </details>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
