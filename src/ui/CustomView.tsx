import { useMemo, useState } from 'react';
import type { KbData, SavedTeam, TeamRun } from '../kb';
import { buildCustomRotation } from '../kb/custom';
import type { Roster } from '../schema/roster';
import type { Response } from '../worker/protocol';
import { sim } from './client';
import { Button, Card, Expandable, ExtendedFab, FilterChip, IconButton, LinearProgress, Notice, SearchBar, Section, Select, TextField } from './Common';
import { elementColor, nameOf, rarityColor } from './format';
import { ResultView } from './ResultView';
import { usePersistentState } from './store';

type Builds = Record<string, { weapon?: string; refinement?: number; set?: string }>;
const isString = (v: unknown): v is string => typeof v === 'string';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const isRecord = <T,>(v: unknown): v is Record<string, T> => typeof v === 'object' && v !== null && !Array.isArray(v);

interface SavedApi {
  teams: SavedTeam[];
  save: (t: SavedTeam) => void;
  remove: (id: string) => void;
}

export function CustomView({ kb, roster, saved }: { kb: KbData; roster: Roster; saved: SavedApi }) {
  const [name, setName] = usePersistentState('custom-name', '', isString);
  const [currentId, setCurrentId] = usePersistentState('custom-saved-id', '', isString);
  const owned = useMemo(() => [...kb.characters.values()].filter((c) => roster.characters[c.id]?.owned).sort((a, b) => a.name.localeCompare(b.name)), [kb, roster]);
  const [storedOrder, setOrder] = usePersistentState<string[]>('custom-order', [], isStringArray);
  const order = useMemo(() => storedOrder.filter((id) => kb.characters.has(id)), [kb, storedOrder]);
  const [variants, setVariants] = usePersistentState<Record<string, string>>('custom-variants', {}, isRecord);
  const [builds, setBuilds] = usePersistentState<Builds>('custom-builds', {}, isRecord);
  const setBuild = (id: string, patch: { weapon?: string; refinement?: number; set?: string }) => setBuilds((b) => ({ ...b, [id]: { ...b[id], ...patch } }));
  const [query, setQuery] = useState('');
  const sets = useMemo(() => [...kb.artifacts.values()].sort((a, b) => a.name.localeCompare(b.name)), [kb]);
  const [length, setLength] = usePersistentState('custom-length', '', isString);
  const [json, setJson] = usePersistentState('custom-rotation-json', '', isString);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState<TeamRun>();
  const [notes, setNotes] = useState<string[]>([]);

  const team = { order, variants, lengthSeconds: length ? Number(length) : undefined, builds };
  const ready = order.length === 4;
  const preview = useMemo(() => {
    if (!ready) return undefined;
    try {
      return buildCustomRotation(kb, team);
    } catch {
      return undefined;
    }
  }, [kb, ready, order, variants, length, builds]);

  const saveTeam = () => {
    const id = currentId || `t${Date.now().toString(36)}`;
    saved.save({ id, name: name.trim() || order.map(nameOf).join(' / '), team, rotationJson: json || undefined });
    setCurrentId(id);
  };
  const load = (t: SavedTeam) => {
    setOrder(t.team.order.filter((id) => kb.characters.has(id)));
    setVariants(t.team.variants ?? {});
    setBuilds(t.team.builds ?? {});
    setLength(t.team.lengthSeconds ? String(t.team.lengthSeconds) : '');
    setJson(t.rotationJson ?? '');
    setName(t.name);
    setCurrentId(t.id);
    setRun(undefined);
  };

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

  const q = query.trim().toLowerCase();
  const chipChars = owned.filter((c) => order.includes(c.id) || !q || `${c.name} ${c.element} ${c.weaponType}`.toLowerCase().includes(q));

  return (
    <div>
      <p className="text-body-medium text-on-surface-variant">
        Pick any four owned characters and the order they act in. Each performs its usual combo; the app chains them into one rotation.
        Results are approximate and labelled "custom rotation". Choose each character's weapon and artifact set, or leave them on the recommended build.
      </p>

      {saved.teams.length > 0 && (
        <Section title="Saved teams" supporting="Kept in this browser; you can choose them in the Teams and Weapons tabs.">
          <Card className="divide-y divide-outline-variant overflow-hidden">
            {saved.teams.map((t) => (
              <div key={t.id} className={`flex items-center gap-1 py-1 pl-4 pr-2 ${t.id === currentId ? 'bg-secondary-container text-on-secondary-container' : ''}`}>
                <div className="min-w-0 flex-1 py-1">
                  <p className="truncate text-body-large">{t.name}</p>
                  <p className="text-body-medium opacity-80">{t.team.order.map(nameOf).join(' → ')}{t.rotationJson ? ' · edited rotation' : ''}</p>
                </div>
                <Button variant="text" onClick={() => load(t)}>Load</Button>
                <IconButton icon="delete" label={`Delete ${t.name}`} onClick={() => { saved.remove(t.id); if (t.id === currentId) setCurrentId(''); }} />
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section title={`Choose four owned characters (${order.length}/4)`}>
        {owned.length === 0 && <Notice tone="warning">Tick some characters on the Roster tab first.</Notice>}
        {owned.length > 12 && <div className="mb-3"><SearchBar label="Search owned characters" placeholder="Search owned characters" value={query} onChange={setQuery} /></div>}
        <div className="flex flex-wrap gap-x-2">
          {chipChars.map((c) => (
            <FilterChip key={c.id} checked={order.includes(c.id)} onChange={() => toggle(c.id)} disabled={!order.includes(c.id) && order.length >= 4}>
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: elementColor(c.element) }} />
              {c.name}
              <span aria-hidden="true" style={{ color: rarityColor(c.rarity) }}>{c.rarity === 5 ? '★' : ''}</span>
            </FilterChip>
          ))}
        </div>
      </Section>

      {order.length > 0 && (
        <Section title="Order and combo variant">
          <ol className="space-y-3">
            {order.map((id, i) => {
              const c = kb.characters.get(id)!;
              const variant = variants[id] ?? c.usualCombo[0]!.variant;
              return (
                <li key={id}>
                  <Card variant="outlined" className="p-4">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-label-large text-on-primary-container">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-title-medium">{c.name}</span>
                      <IconButton icon="up" label={`Move ${c.name} up`} onClick={() => move(i, -1)} disabled={i === 0} />
                      <IconButton icon="down" label={`Move ${c.name} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1} />
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Select label="Combo" value={variant} onChange={(e) => setVariants((v) => ({ ...v, [id]: e.target.value }))}>
                        {c.usualCombo.map((v) => <option key={v.variant} value={v.variant}>{v.variant}</option>)}
                      </Select>
                      <Select label="Artifact set (4pc)" value={builds[id]?.set ?? ''} onChange={(e) => setBuild(id, { set: e.target.value || undefined })}>
                        <option value="">recommended</option>
                        {sets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                      <div className="flex gap-3 md:col-span-2">
                        <Select label="Weapon" className="min-w-0 flex-1" value={builds[id]?.weapon ?? ''} onChange={(e) => setBuild(id, { weapon: e.target.value || undefined })}>
                          <option value="">recommended</option>
                          {[...kb.weapons.values()].filter((w) => w.type === c.weaponType).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.rarity}★)</option>)}
                        </Select>
                        {builds[id]?.weapon && (
                          <Select label="Refine" aria-label={`Refinement for ${c.name}`} className="w-24 shrink-0" value={builds[id]?.refinement ?? roster.weapons[builds[id]!.weapon!]?.refinement ?? 1} onChange={(e) => setBuild(id, { refinement: Number(e.target.value) })}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
                          </Select>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-body-small text-on-surface-variant">
                      Actions: {c.usualCombo.find((v) => v.variant === variant)?.actions.map((a) => a.action + (a.then ? `→${a.then}` : '')).join(', ')}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 md:max-w-xs">
            <TextField label="Rotation length (seconds, optional)" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="auto: the longest cooldown used" />
          </div>
        </Section>
      )}

      {order.length > 0 && <Section title="Save" supporting={preview ? `Rotation length ${(preview.lengthFrames / 60).toFixed(1)} s` : `Choose ${4 - order.length} more character${order.length === 3 ? '' : 's'} to build a rotation.`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <TextField label="Team name" aria-label="team name" className="md:w-80" value={name} onChange={(e) => setName(e.target.value)} placeholder={order.map(nameOf).join(' / ')} />
          <div className="flex flex-wrap gap-2">
            <Button variant="tonal" icon="save" onClick={saveTeam} disabled={!ready}>{currentId ? 'Update saved team' : 'Save team'}</Button>
            {currentId && <Button onClick={() => setCurrentId('')}>Save as new</Button>}
          </div>
        </div>
      </Section>}

      {preview && (
        <Section title="Rotation script" supporting="Advanced: edit the generated steps and run your version.">
          <Expandable title="Edit rotation script">
            <div className="flex flex-wrap gap-2">
              <Button variant="tonal" onClick={() => setJson(JSON.stringify(preview.script, null, 1))}>Load into editor</Button>
              <Button onClick={() => go(true)} disabled={!json || busy}>Simulate edited rotation</Button>
            </div>
            <textarea
              aria-label="rotation script"
              className="mt-3 h-48 w-full rounded-md border border-outline bg-transparent p-3 font-mono text-body-small focus:border-primary focus:outline-2 focus:outline-primary"
              value={json} onChange={(e) => setJson(e.target.value)}
              placeholder='Click "Load into editor", change the steps, then run the edited rotation.'
            />
          </Expandable>
        </Section>
      )}

      {ready && <ExtendedFab icon="play" compact={!!run && !busy} label={busy ? 'Simulating…' : 'Simulate custom rotation'} onClick={() => go(false)} disabled={busy} />}
      {busy && <div className="mt-4"><LinearProgress label="Simulating" /></div>}
      {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}

      {run && (
        <Card variant="outlined" className="mt-6 p-4">
          {notes.length > 0 && <div className="mb-3"><Notice tone="warning">{notes.join(' · ')}</Notice></div>}
          <ResultView run={run} kb={kb} title={`${run.label}: ${order.map(nameOf).join(' → ')}`} />
        </Card>
      )}
    </div>
  );
}
