import { useMemo, useState } from 'react';
import type { KbData, TeamRun } from '../kb';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Badge, Bar, Button, Section, confidenceTone } from './Common';
import { charColor, fmt, nameOf, pct } from './format';
import { ResultView } from './ResultView';

interface Props {
  kb: KbData;
  roster: Roster;
}

interface Entry {
  teamId: string;
  name: string;
  run?: TeamRun;
  missing: string[];
  error?: string;
}

export function TeamsView({ kb, roster }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string>('');
  const [open, setOpen] = useState<string>('');

  const teams = useMemo(() => [...kb.teams.values()].filter((t) => t.status === 'active'), [kb]);
  const missingOf = (t: (typeof teams)[number]) => t.members.filter((m) => !roster.characters[m.character]?.owned).map((m) => m.character);
  const runnable = teams.filter((t) => missingOf(t).length === 0);

  async function runAll() {
    const results: Entry[] = teams.filter((t) => missingOf(t).length > 0).map((t) => ({ teamId: t.id, name: t.name, missing: missingOf(t) }));
    setEntries(results);
    for (const t of runnable) {
      setBusy(`Simulating ${t.name}…`);
      try {
        const r = (await sim().request({
          type: 'team', teamId: t.id,
          settings: { roster, actionDelay: roster.settings.actionDelay, swapDelay: roster.settings.swapDelay },
        })) as Response & { ok: true; type: 'team' };
        results.push({ teamId: t.id, name: t.name, run: r.result, missing: [] });
      } catch (e) {
        results.push({ teamId: t.id, name: t.name, missing: [], error: e instanceof Error ? e.message : String(e) });
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
        Known team archetypes from the knowledge base, simulated with their published rotation and ranked by team DPS.
        A team needs all four of its members ticked in your roster. The app never searches for teams by itself.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button primary onClick={runAll} disabled={!!busy || runnable.length === 0}>Rank teams I can build ({runnable.length})</Button>
        {busy && <span className="text-sm text-slate-600">{busy}</span>}
      </div>
      {runnable.length === 0 && <p className="mt-2 text-sm text-amber-700">None of the {teams.length} known teams is fully covered by your roster yet. Tick characters on the Roster tab.</p>}

      <Section title="Ranking">
        {entries.length === 0 && <p className="text-sm text-slate-500">No results yet.</p>}
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
