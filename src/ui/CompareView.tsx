import { useMemo, useState } from 'react';
import type { KbData, SavedTeam, WeaponComparison } from '../kb';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Badge, Card, Expandable, ExtendedFab, LinearProgress, Notice, Section, Select, Table, confidenceTone } from './Common';
import { fmt, nameOf, pct, signedPct } from './format';
import { usePersistentState } from './store';

type Pick = { weaponId: string; refinement: number };
const isString = (v: unknown): v is string => typeof v === 'string';
const isPick = (v: unknown): v is Pick => typeof v === 'object' && v !== null && isString((v as Pick).weaponId) && Number.isInteger((v as Pick).refinement);

export function CompareView({ kb, roster, saved }: { kb: KbData; roster: Roster; saved: SavedTeam[] }) {
  const teams = [...kb.teams.values()].filter((t) => t.status === 'active');
  const [storedTeamId, setTeamId] = usePersistentState('compare-team', teams[0]?.id ?? '', isString);
  const teamId = saved.some((t) => `saved:${t.id}` === storedTeamId) || kb.teams.has(storedTeamId) ? storedTeamId : teams[0]?.id ?? '';
  const savedTeam = saved.find((t) => `saved:${t.id}` === teamId);
  const knownTeam = kb.teams.get(teamId);
  const team = savedTeam
    ? { members: savedTeam.team.order.map((id) => ({ character: id, weapons: savedTeam.team.builds?.[id]?.weapon ? [savedTeam.team.builds[id]!.weapon!] : kb.characters.get(id)?.recommended.weapons.map((w) => w.id) ?? [] })) }
    : knownTeam;
  const [charId, setCharId] = usePersistentState('compare-character', '', isString);
  const activeChar = team?.members.find((m) => m.character === charId)?.character ?? team?.members[0]?.character ?? '';
  const character = kb.characters.get(activeChar);
  const candidates = useMemo(() => [...kb.weapons.values()].filter((w) => w.type === character?.weaponType).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)), [kb, character]);
  const [pickA, setPickA] = usePersistentState<Pick | undefined>('compare-weapon-a', undefined, isPick);
  const [pickB, setPickB] = usePersistentState<Pick | undefined>('compare-weapon-b', undefined, isPick);
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

  const delta = (n: number) => (n > 0.0005 ? 'text-success' : n < -0.0005 ? 'text-error' : '');
  const picker = (label: string, v: Pick, set: (p: Pick) => void) => (
    <div className="flex gap-3">
      <Select label={label} className="min-w-0 flex-1" value={v.weaponId} onChange={(e) => { set({ ...v, weaponId: e.target.value }); setRows([]); }}>
        {candidates.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.rarity}★){w.obtain.freeRefinement ? ` — R${w.obtain.freeRefinement} free` : ''}</option>)}
      </Select>
      <Select label="Refine" aria-label={`${label} refinement`} className="w-24 shrink-0" value={v.refinement} onChange={(e) => { set({ ...v, refinement: Number(e.target.value) }); setRows([]); }}>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
      </Select>
    </div>
  );

  return (
    <div>
      <p className="text-body-medium text-on-surface-variant">
        Pick two weapons for one character of a known or saved team and compare them in the same rotation. Deltas are B relative to A.
      </p>
      <Expandable className="mt-3" title="How this works">
        <p className="text-body-medium text-on-surface-variant">
          Only that character's artifact stats are re-optimised (KQM Standard). New weapons are simulated from their passive as recorded in the knowledge base,
          so a result exists even without community test data; the confidence badge and the listed assumptions tell you how far to trust it.
        </p>
      </Expandable>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Select label="Team" value={teamId} onChange={(e) => { setTeamId(e.target.value); setCharId(''); setPickA(undefined); setPickB(undefined); setRows([]); }}>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          {saved.map((t) => <option key={t.id} value={`saved:${t.id}`}>{t.name} (saved)</option>)}
        </Select>
        <Select label="Character" value={activeChar} onChange={(e) => { setCharId(e.target.value); setPickA(undefined); setPickB(undefined); setRows([]); }}>
          {team?.members.map((m) => <option key={m.character} value={m.character}>{nameOf(m.character)}</option>)}
        </Select>
      </div>

      <Section title="Weapons to compare" supporting={character ? `${character.name} uses ${character.weaponType}s` : undefined}>
        <div className="space-y-3">
          {picker('Weapon A', a, setPickA)}
          {picker('Weapon B', b, setPickB)}
        </div>
        {busy && <div className="mt-4"><LinearProgress label="Simulating" /></div>}
        {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
      </Section>
      {team && a.weaponId && <ExtendedFab icon="compare" compact={rows.length > 0 && !busy} label={busy ? 'Simulating…' : 'Compare'} onClick={go} disabled={busy} />}

      {rows.length > 0 && (
        <Section title="Results (sorted by team DPS)">
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <Card key={`${r.weaponId}-${r.refinement}`} variant={r.isBaseline ? 'filled' : 'outlined'} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-title-medium">{nameOf(r.weaponId)} R{r.refinement}{r.isBaseline ? ' (A)' : ''}</span>
                  <Badge tone={confidenceTone(r.confidence)}>{r.confidence}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-body-medium">
                  <dt className="text-on-surface-variant">Team DPS</dt>
                  <dd className="tabular-nums">{fmt(r.teamDps)} <span className={delta(r.teamDelta)}>{r.isBaseline ? '' : signedPct(r.teamDelta)}</span></dd>
                  <dt className="text-on-surface-variant">{nameOf(activeChar)} DPS</dt>
                  <dd className="tabular-nums">{fmt(r.charDps)} <span className={delta(r.charDelta)}>{r.isBaseline ? '' : signedPct(r.charDelta)}</span></dd>
                  <dt className="text-on-surface-variant">Worst case</dt>
                  <dd className="tabular-nums">{fmt(r.worst.charDps)} <span className="text-on-surface-variant">({signedPct(r.worst.charDps / Math.max(1, r.charDps) - 1)})</span></dd>
                  <dt className="text-on-surface-variant">ER needed</dt>
                  <dd className="tabular-nums">{r.requiredEr === null ? '—' : pct(r.requiredEr, 0)}{r.requiredErDelta !== null && !r.isBaseline ? <span className="text-on-surface-variant"> ({r.requiredErDelta >= 0 ? '+' : ''}{(r.requiredErDelta * 100).toFixed(0)} pts)</span> : null}</dd>
                  <dt className="text-on-surface-variant">Obtain</dt>
                  <dd className="text-right text-body-small">{r.obtain}</dd>
                </dl>
              </Card>
            ))}
          </div>
          <div className="hidden lg:block">
            <Table head={['Weapon', 'Team DPS', 'Δ team', `${nameOf(activeChar)} DPS`, 'Δ character', 'Worst case (char)', 'ER needed', 'Confidence', 'Obtain']}>
              {rows.map((r) => (
                <tr key={`${r.weaponId}-${r.refinement}`} className={r.isBaseline ? 'bg-surface-container-low font-medium' : ''}>
                  <td>{nameOf(r.weaponId)} R{r.refinement}{r.isBaseline ? ' (A)' : ''}</td>
                  <td className="tabular-nums">{fmt(r.teamDps)}</td>
                  <td className={delta(r.teamDelta)}>{r.isBaseline ? '—' : signedPct(r.teamDelta)}</td>
                  <td className="tabular-nums">{fmt(r.charDps)}</td>
                  <td className={delta(r.charDelta)}>{r.isBaseline ? '—' : signedPct(r.charDelta)}</td>
                  <td>{fmt(r.worst.charDps)} <span className="text-body-small text-on-surface-variant">({signedPct(r.worst.charDps / Math.max(1, r.charDps) - 1)})</span></td>
                  <td>{r.requiredEr === null ? '—' : pct(r.requiredEr, 0)} {r.requiredErDelta !== null && !r.isBaseline && <span className="text-body-small text-on-surface-variant">({r.requiredErDelta >= 0 ? '+' : ''}{(r.requiredErDelta * 100).toFixed(0)} pts)</span>}</td>
                  <td><Badge tone={confidenceTone(r.confidence)}>{r.confidence}</Badge></td>
                  <td className="text-body-small">{r.obtain}</td>
                </tr>
              ))}
            </Table>
          </div>
          <p className="mt-3 text-body-small text-on-surface-variant">"Worst case" assumes uncertain passive conditions are not met.</p>
          <div className="mt-3 space-y-2">
            {rows.map((r) => (
              <Expandable key={`a-${r.weaponId}-${r.refinement}`} title={`Assumptions: ${nameOf(r.weaponId)}`}>
                <ul className="ml-5 list-disc space-y-1 text-body-small text-on-surface-variant">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </Expandable>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
