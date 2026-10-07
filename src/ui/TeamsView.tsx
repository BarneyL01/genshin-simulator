import { useEffect, useMemo, useState } from 'react';
import type { KbData, SavedTeam, TeamRun } from '../kb';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Badge, Button, Card, CheckRow, ExtendedFab, LinearProgress, Notice, Section, StackedBar, confidenceTone } from './Common';
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
  const picked = selected.filter((id) => valid.has(id));

  return (
    <div>
      <p className="text-body-medium text-on-surface-variant">
        Pick the teams you want to compare — known team archetypes from the knowledge base (published rotation) and your saved
        custom teams — then compare them by team DPS. The app never searches for teams by itself.
      </p>

      <Section
        title="Pick teams" supporting={`${picked.length} selected`}
        right={picked.length > 0 ? <Button variant="text" onClick={() => setSelected([])} disabled={!!busy}>Clear selection</Button> : undefined}
      >
        {saved.length > 0 && (
          <>
            <h3 className="mb-2 text-title-small text-on-surface-variant">Saved custom teams</h3>
            <Card className="mb-5 divide-y divide-outline-variant overflow-hidden">
              {saved.map((s) => (
                <CheckRow
                  key={s.id} checked={selected.includes(`saved:${s.id}`)} onChange={() => toggle(`saved:${s.id}`)}
                  headline={s.name} supporting={s.team.order.map(nameOf).join(' → ')}
                />
              ))}
            </Card>
            <h3 className="mb-2 text-title-small text-on-surface-variant">Known team archetypes</h3>
          </>
        )}
        <Card className="divide-y divide-outline-variant overflow-hidden">
          {teams.map((t) => {
            const missing = missingOf(t);
            return (
              <CheckRow
                key={t.id} checked={selected.includes(t.id)} onChange={() => toggle(t.id)}
                headline={t.name}
                supporting={missing.length > 0 ? <span className="text-error">Missing {missing.map(nameOf).join(', ')}</span> : t.members.map((m) => nameOf(m.character)).join(' · ')}
                trailing={<Badge tone={confidenceTone(t.dataConfidence)}>{t.dataConfidence}</Badge>}
              />
            );
          })}
        </Card>
      </Section>

      {picked.length > 0 && (
        <ExtendedFab icon="play" compact={entries.length > 0} label={`Compare selected (${picked.length})`} onClick={compareSelected} disabled={!!busy} />
      )}

      <Section title="Results">
        {busy && <div className="mb-3"><LinearProgress label={busy} /><p className="mt-2 text-body-medium text-on-surface-variant">{busy}</p></div>}
        {entries.length === 0 && !busy && <p className="text-body-medium text-on-surface-variant">No results yet. Pick teams above and press Compare.</p>}
        <ol className="space-y-3">
          {entries.map((e, i) => (
            <li key={e.teamId}>
              <Card variant="outlined" className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-title-medium">{e.run ? `${i + 1}. ` : ''}{e.name}</span>
                  {kb.teams.get(e.teamId) && <Badge tone={confidenceTone(kb.teams.get(e.teamId)!.dataConfidence)}>{kb.teams.get(e.teamId)!.dataConfidence}</Badge>}
                </div>
                {e.run && (
                  <>
                    <p className="mt-2 text-body-medium text-on-surface-variant">
                      <b className="text-headline-small font-normal text-on-surface tabular-nums">{fmt(e.run.relaxed.dps)}</b> DPS relaxed · {fmt(e.run.framePerfect.dps)} frame-perfect · delay costs {pct(1 - e.run.relaxed.dps / e.run.framePerfect.dps, 0)}
                    </p>
                    <div className="mt-3">
                      <StackedBar
                        max={maxDps}
                        parts={e.run.members.map((m, k) => ({ value: e.run!.relaxed.perCharacterDps[m.character] ?? 0, color: charColor(k), label: nameOf(m.character) }))}
                      />
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body-medium">
                      {e.run.members.map((m, k) => (
                        <li key={m.character} className="flex items-center gap-1.5">
                          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: charColor(k) }} />
                          {nameOf(m.character)} <span className="tabular-nums text-on-surface-variant">{fmt(e.run!.relaxed.perCharacterDps[m.character] ?? 0)}</span>
                        </li>
                      ))}
                    </ul>
                    {e.run.notices.length > 0 && (
                      <div className="mt-3"><Notice tone="warning">{e.run.notices[0]}{e.run.notices.length > 1 ? ` (+${e.run.notices.length - 1} more in Assumptions)` : ''}</Notice></div>
                    )}
                    <div className="mt-2 -ml-3">
                      <Button variant="text" onClick={() => setOpen(open === e.teamId ? '' : e.teamId)}>{open === e.teamId ? 'Hide details' : 'Show details'}</Button>
                    </div>
                    {open === e.teamId && <div className="mt-2 border-t border-outline-variant pt-4"><ResultView run={e.run} kb={kb} /></div>}
                  </>
                )}
                {e.missing.length > 0 && <p className="mt-2 text-body-medium text-error">Missing: {e.missing.map(nameOf).join(', ')}</p>}
                {e.error && <div className="mt-2"><Notice tone="error">Failed: {e.error}</Notice></div>}
              </Card>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
