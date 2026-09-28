import { useEffect, useMemo, useState } from 'react';
import type { KbData, SavedTeam, TeamRun } from '../kb';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Badge, Bar, Button, Section, confidenceTone } from './Common';
import { charColor, fmt, nameOf, pct } from './format';
import { ResultView } from './ResultView';
import { usePersistentState } from './store';

interface Props {
  kb: KbData;
  roster: Roster;
  saved: SavedTeam[];
}

interface Entry {
  teamId: string;
  name: string;
  run?: TeamRun;
  missing: string[];
  error?: string;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function TeamsView({ kb, roster, saved }: Props) {
  const [selected, setSelected] = usePersistentState<string[]>('teams-selected', [], isStringArray);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string>('');
  const [open, setOpen] = useState<string>('');

  const teams = useMemo(() => [...kb.teams.values()].filter((t) => t.status === 'active'), [kb]);
  const missingOf = (t: (typeof teams)[number]) => t.members.filter((m) => !roster.characters[m.character]?.owned).map((m) => m.character);

  // Drop stale ids (a saved team was deleted, or a known team left the KB) so an old selection never gets silently dropped from the count either.
  const valid = useMemo(() => new Set([...teams.map((t) => t.id), ...saved.map((s) => `saved:${s.id}`)]), [teams, saved]);
  useEffect(() => {
    const next = selected.filter((id) => valid.has(id));
    if (next.length !== selected.length) setSelected(next);
  }, [selected, valid, setSelected]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function compareSelected() {
    const picked = selected.filter((id) => valid.has(id));
    const results: Entry[] = [];
    setEntries([]);
    for (const id of picked) {
      const st = saved.find((s) => `saved:${s.id}` === id);
      if (st) {
        setBusy(`Simulating ${st.name}…`);
        try {
          const r = (await sim().request({
            type: 'team', teamId: '', custom: { team: st.team, rotationJson: st.rotationJson, name: st.name },
            settings: { roster, actionDelay: roster.settings.actionDelay, swapDelay: roster.settings.swapDelay },
          })) as Response & { ok: true; type: 'team' };
          results.push({ teamId: id, name: `${st.name} (saved)`, run: r.result, missing: [] });
        } catch (e) {
          results.push({ teamId: id, name: st.name, missing: [], error: e instanceof Error ? e.message : String(e) });
        }
        setEntries([...results].sort((a, b) => (b.run?.relaxed.dps ?? -1) - (a.run?.relaxed.dps ?? -1)));
        continue;
      }
      const t = kb.teams.get(id);
      if (!t) continue;
      const missing = missingOf(t);
      if (missing.length > 0) {
        results.push({ teamId: id, name: t.name, missing });
        setEntries([...results]);
        continue;
      }
      setBusy(`Simulating ${t.name}…`);
      try {
        const r = (await sim().request({
          type: 'team', teamId: t.id,
          settings: { roster, actionDelay: roster.settings.actionDelay, swapDelay: roster.settings.swapDelay },
        })) as Response & { ok: true; type: 'team' };
        results.push({ teamId: id, name: t.name, run: r.result, missing: [] });
      } catch (e) {
        results.push({ teamId: id, name: t.name, missing: [], error: e instanceof Error ? e.message : String(e) });
      }
      setEntries([...results].sort((a, b) => (b.run?.relaxed.dps ?? -1) - (a.run?.relaxed.dps ?? -1)));
    }
    setBusy('');
  }

  const maxDps = Math.max(1, ...entries.map((e) => e.run?.relaxed.dps ?? 0));
  const opened = entries.find((e) => e.teamId === open)?.run;

  return (
    <div>
      <p className="text-sm text-slate-600">
        Pick the teams you want to compare — known team archetypes from the knowledge base (published rotation) and your saved
        custom teams — then compare them by team DPS. The app never searches for teams by itself.
      </p>

      <Section title={`Pick teams (${selected.length} selected)`}>
        {saved.length > 0 && (
          <>
            <p className="mb-1 text-sm font-medium text-slate-700">Saved custom teams</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {saved.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(`saved:${s.id}`)} onChange={() => toggle(`saved:${s.id}`)} />
                  {s.name}
                </label>
              ))}
            </div>
            <p className="mb-1 mt-3 text-sm font-medium text-slate-700">Known team archetypes</p>
          </>
        )}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {teams.map((t) => {
            const missing = missingOf(t);
            return (
              <label key={t.id} className={`flex items-center gap-2 text-sm ${missing.length > 0 ? 'text-slate-400' : ''}`}>
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                {t.name} <Badge tone={confidenceTone(t.dataConfidence)}>{t.dataConfidence}</Badge>
                {missing.length > 0 && <span className="text-xs">(missing {missing.map(nameOf).join(', ')})</span>}
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button primary onClick={compareSelected} disabled={!!busy || selected.length === 0}>Compare selected ({selected.length})</Button>
          {selected.length > 0 && <Button onClick={() => setSelected([])} disabled={!!busy}>Clear selection</Button>}
          {busy && <span className="text-sm text-slate-600">{busy}</span>}
        </div>
      </Section>

      <Section title="Results">
        {entries.length === 0 && <p className="text-sm text-slate-500">No results yet. Pick teams above and press Compare.</p>}
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <li key={e.teamId} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">
                  {e.run ? `${i + 1}. ` : ''}{e.name}{' '}
                  {kb.teams.get(e.teamId) && <Badge tone={confidenceTone(kb.teams.get(e.teamId)!.dataConfidence)}>{kb.teams.get(e.teamId)!.dataConfidence}</Badge>}
                </div>
                {e.run && (
                  <div className="text-sm">
                    <b>{fmt(e.run.relaxed.dps)}</b> DPS relaxed · {fmt(e.run.framePerfect.dps)} frame-perfect · delay costs {pct(1 - e.run.relaxed.dps / e.run.framePerfect.dps, 0)}
                  </div>
                )}
              </div>
              {e.run && (
                <>
                  <div className="mt-1"><Bar value={e.run.relaxed.dps} max={maxDps} /></div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                    {e.run.members.map((m, k) => (
                      <span key={m.character} style={{ color: charColor(k) }}>{nameOf(m.character)} {fmt(e.run!.relaxed.perCharacterDps[m.character] ?? 0)}</span>
                    ))}
                  </div>
                  {e.run.notices.length > 0 && <p className="mt-1 text-xs text-amber-700">{e.run.notices[0]}{e.run.notices.length > 1 ? ` (+${e.run.notices.length - 1} more in Assumptions)` : ''}</p>}
                  <button className="mt-1 text-sm text-blue-700 underline" onClick={() => setOpen(open === e.teamId ? '' : e.teamId)}>{open === e.teamId ? 'Hide details' : 'Show details'}</button>
                </>
              )}
              {e.missing.length > 0 && <p className="text-sm text-slate-600">Missing: {e.missing.map(nameOf).join(', ')}</p>}
              {e.error && <p className="text-sm text-red-700">Failed: {e.error}</p>}
            </li>
          ))}
        </ol>
      </Section>

      {opened && <div className="mt-4 rounded border border-slate-200 p-3"><ResultView run={opened} kb={kb} title={opened.label} /></div>}
    </div>
  );
}
