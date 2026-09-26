import { useMemo, useState } from 'react';
import type { KbData, TeamRun } from '../kb';
import { buildCustomRotation } from '../kb/custom';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Button, Section } from './Common';
import { nameOf } from './format';
import { ResultView } from './ResultView';

export function CustomView({ kb, roster }: { kb: KbData; roster: Roster }) {
  const owned = useMemo(() => [...kb.characters.values()].filter((c) => roster.characters[c.id]?.owned).sort((a, b) => a.name.localeCompare(b.name)), [kb, roster]);
  const [order, setOrder] = useState<string[]>([]);
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [length, setLength] = useState('');
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState<TeamRun>();
  const [notes, setNotes] = useState<string[]>([]);

  const team = { order, variants, lengthSeconds: length ? Number(length) : undefined };
  const ready = order.length === 4;
  const preview = useMemo(() => {
    if (!ready) return undefined;
    try {
      return buildCustomRotation(kb, team);
    } catch {
      return undefined;
    }
  }, [kb, ready, order, variants, length]);

  const toggle = (id: string) => setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : o.length < 4 ? [...o, id] : o));
  const move = (i: number, d: -1 | 1) => setOrder((o) => {
    const j = i + d;
    if (j < 0 || j >= o.length) return o;
    const c = [...o];
    [c[i], c[j]] = [c[j]!, c[i]!];
    return c;
  });

  async function go(useJson: boolean) {
    setBusy(true);
    setError('');
    try {
      const r = (await sim().request({
        type: 'custom', team, rotationJson: useJson ? json : undefined,
        settings: { roster, actionDelay: roster.settings.actionDelay, swapDelay: roster.settings.swapDelay },
      })) as Response & { ok: true; type: 'custom' };
      setRun(r.result);
      setNotes(r.notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        Pick any four owned characters and the order they act in. Each performs its usual combo; the app chains them into one rotation.
        Results are approximate and labelled "custom rotation". Weapons, sets and stats follow each character's recommended build.
      </p>

      <Section title={`1. Choose four owned characters (${order.length}/4)`}>
        {owned.length === 0 && <p className="text-sm text-amber-700">Tick some characters on the Roster tab first.</p>}
        <div className="flex flex-wrap gap-2">
          {owned.map((c) => (
            <label key={c.id} className={`cursor-pointer rounded border px-2 py-1 text-sm ${order.includes(c.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
              <input type="checkbox" className="mr-1" checked={order.includes(c.id)} onChange={() => toggle(c.id)} disabled={!order.includes(c.id) && order.length >= 4} />
              {c.name}
            </label>
          ))}
        </div>
      </Section>

      {order.length > 0 && (
        <Section title="2. Order and combo variant">
          <ol className="space-y-1">
            {order.map((id, i) => {
              const c = kb.characters.get(id)!;
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-2 py-1 text-sm">
                  <span className="w-5 text-slate-500">{i + 1}.</span>
                  <span className="w-32 font-medium">{c.name}</span>
                  <Button onClick={() => move(i, -1)} disabled={i === 0} aria-label="move up">▲</Button>
                  <Button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="move down">▼</Button>
                  <select className="rounded border px-1" value={variants[id] ?? c.usualCombo[0]!.variant} onChange={(e) => setVariants((v) => ({ ...v, [id]: e.target.value }))}>
                    {c.usualCombo.map((v) => <option key={v.variant} value={v.variant}>{v.variant}</option>)}
                  </select>
                  <span className="text-xs text-slate-500">{c.usualCombo.find((v) => v.variant === (variants[id] ?? c.usualCombo[0]!.variant))?.actions.map((a) => a.action + (a.then ? `→${a.then}` : '')).join(', ')}</span>
                </li>
              );
            })}
          </ol>
          <label className="mt-2 block text-sm">
            Rotation length (seconds, optional; default = the longest cooldown used)
            <input className="ml-2 w-20 rounded border px-1" value={length} onChange={(e) => setLength(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="auto" />
          </label>
        </Section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button primary onClick={() => go(false)} disabled={!ready || busy}>{busy ? 'Simulating…' : 'Simulate custom rotation'}</Button>
        {preview && <span className="self-center text-sm text-slate-600">rotation length {(preview.lengthFrames / 60).toFixed(1)} s</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {preview && (
        <Section title="Rotation script (editable)" right={<Button onClick={() => setJson(JSON.stringify(preview.script, null, 1))}>Load into editor</Button>}>
          <textarea className="h-40 w-full rounded border p-2 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} placeholder='Click "Load into editor", change the steps, then run the edited rotation.' />
          <Button className="mt-1" onClick={() => go(true)} disabled={!json || busy}>Simulate edited rotation</Button>
        </Section>
      )}

      {run && (
        <div className="mt-4 rounded border border-slate-200 p-3">
          {notes.length > 0 && <p className="mb-2 text-xs text-amber-700">{notes.join(' · ')}</p>}
          <ResultView run={run} kb={kb} title={`${run.label}: ${order.map(nameOf).join(' → ')}`} />
        </div>
      )}
    </div>
  );
}
