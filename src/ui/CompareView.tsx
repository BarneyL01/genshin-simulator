import { useMemo, useState } from 'react';
import type { KbData, WeaponComparison } from '../kb';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Badge, Button, Section, Table, confidenceTone } from './Common';
import { fmt, nameOf, pct, signedPct } from './format';

export function CompareView({ kb, roster }: { kb: KbData; roster: Roster }) {
  const teams = [...kb.teams.values()].filter((t) => t.status === 'active');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const team = kb.teams.get(teamId);
  const [charId, setCharId] = useState('');
  const activeChar = team?.members.find((m) => m.character === charId)?.character ?? team?.members[0]?.character ?? '';
  const character = kb.characters.get(activeChar);
  const candidates = useMemo(() => [...kb.weapons.values()].filter((w) => w.type === character?.weaponType).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)), [kb, character]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<WeaponComparison[]>([]);

  const baselineId = team?.members.find((m) => m.character === activeChar)?.weapons[0] ?? candidates[0]?.id ?? '';

  async function go() {
    if (!team) return;
    setBusy(true);
    setError('');
    try {
      const list = Object.entries(picked).map(([weaponId, refinement]) => ({ weaponId, refinement }));
      if (!list.some((c) => c.weaponId === baselineId && c.refinement === 1)) list.unshift({ weaponId: baselineId, refinement: 1 });
      const r = (await sim().request({
        type: 'compare', teamId, characterId: activeChar, candidates: list, baseline: { weaponId: baselineId, refinement: 1 },
        settings: { roster: { ...roster, settings: { ...roster.settings, assumeAllWeapons: true } }, cycles: 3, actionDelay: roster.settings.actionDelay, swapDelay: roster.settings.swapDelay },
      })) as Response & { ok: true; type: 'compare' };
      setRows(r.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        Swap one character's weapon inside a known team and rotation. Only that character's artifact stats are re-optimised (KQM Standard).
        New weapons are simulated from their passive as recorded in the knowledge base, so a result exists even without community test data; the
        confidence badge and the listed assumptions tell you how far to trust it. "Worst case" assumes uncertain passive conditions are not met.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <label>Team <select className="rounded border px-1" value={teamId} onChange={(e) => { setTeamId(e.target.value); setCharId(''); setPicked({}); setRows([]); }}>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        <label>Character <select className="rounded border px-1" value={activeChar} onChange={(e) => { setCharId(e.target.value); setPicked({}); setRows([]); }}>
          {team?.members.map((m) => <option key={m.character} value={m.character}>{nameOf(m.character)}</option>)}
        </select></label>
      </div>

      <Section title={`Weapons to compare (${character?.weaponType ?? ''}) — baseline: ${nameOf(baselineId)} R1`}>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((w) => (
            <div key={w.id} className={`flex items-center gap-2 rounded border px-2 py-1 text-sm ${w.id in picked ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={w.id in picked} onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[w.id] = roster.weapons[w.id]?.refinement ?? 1; else delete n[w.id]; return n; })} />
                {w.name} <span className="text-xs text-slate-500">{w.rarity}★</span>
              </label>
              {w.id in picked && (
                <select className="rounded border px-1" value={picked[w.id]} onChange={(e) => setPicked((p) => ({ ...p, [w.id]: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
                </select>
              )}
              {w.obtain.freeRefinement ? <Badge tone="green">R{w.obtain.freeRefinement} free</Badge> : null}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Button primary onClick={go} disabled={busy || Object.keys(picked).length === 0}>{busy ? 'Simulating…' : 'Compare'}</Button>
          <Button onClick={() => setPicked(Object.fromEntries(candidates.map((w) => [w.id, roster.weapons[w.id]?.refinement ?? 1])))}>Pick all</Button>
        </div>
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </Section>

      {rows.length > 0 && (
        <Section title="Results (sorted by team DPS)">
          <Table head={['Weapon', 'Team DPS', 'Δ team', `${nameOf(activeChar)} DPS`, 'Δ character', 'Worst case (char)', 'ER needed', 'Confidence', 'Obtain']}>
            {rows.map((r) => (
              <tr key={`${r.weaponId}-${r.refinement}`} className={r.isBaseline ? 'bg-slate-50 font-medium' : ''}>
                <td>{nameOf(r.weaponId)} R{r.refinement}{r.isBaseline ? ' (baseline)' : ''}</td>
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
