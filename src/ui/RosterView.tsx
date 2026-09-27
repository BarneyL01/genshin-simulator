import type { KbData } from '../kb';
import type { Roster } from '../schema/roster';
import { Badge, Button, IntInput, Section, confidenceTone } from './Common';

interface Props {
  kb: KbData;
  roster: Roster;
  update: (fn: (r: Roster) => Roster) => void;
}

export function RosterView({ kb, roster, update }: Props) {
  const chars = [...kb.characters.values()].sort((a, b) => a.name.localeCompare(b.name));
  const types = [...new Set([...kb.weapons.values()].map((w) => w.type))].sort();

  const setChar = (id: string, patch: Partial<Roster['characters'][string]>) =>
    update((r) => ({ ...r, characters: { ...r.characters, [id]: { ...r.characters[id]!, ...patch } } }));
  const setWeapon = (id: string, patch: Partial<Roster['weapons'][string]>) =>
    update((r) => ({ ...r, weapons: { ...r.weapons, [id]: { ...r.weapons[id]!, ...patch } } }));
  const setAll = (owned: boolean) =>
    update((r) => ({
      ...r,
      characters: Object.fromEntries(Object.entries(r.characters).map(([k, v]) => [k, { ...v, owned }])),
      weapons: Object.fromEntries(Object.entries(r.weapons).map(([k, v]) => [k, { ...v, owned }])),
    }));

  return (
    <div>
      <p className="text-sm text-slate-600">
        Tick what you own. Everyone defaults to C0, talents 1/1/1 and Lv 90; weapons to R1 (set your real refinement per weapon).
        Nothing leaves your browser.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setAll(true)}>Own everything</Button>
        <Button onClick={() => setAll(false)}>Own nothing</Button>
      </div>

      <Section title={`Characters (${chars.filter((c) => roster.characters[c.id]?.owned).length}/${chars.length} owned)`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chars.map((c) => {
            const rc = roster.characters[c.id]!;
            return (
              <div key={c.id} className={`rounded border p-2 ${rc.owned ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={rc.owned} onChange={(e) => setChar(c.id, { owned: e.target.checked })} />
                  {c.name} <span className="text-xs font-normal text-slate-500">{c.rarity}★ {c.element} {c.weaponType}</span>
                  <Badge tone={confidenceTone(c.dataConfidence)}>{c.dataConfidence}</Badge>
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <label>
                    C{' '}
                    <select className="rounded border px-1" value={rc.constellation} onChange={(e) => setChar(c.id, { constellation: Number(e.target.value) })}>
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <span className="text-slate-500">Talents</span>
                  {([0, 1, 2] as const).map((i) => (
                    <IntInput
                      key={i} aria-label={`talent ${i + 1}`} min={1} max={15} className="w-12 rounded border px-1"
                      value={rc.talents[i]}
                      onChange={(n) => {
                        const t = [...rc.talents] as [number, number, number];
                        t[i] = n;
                        setChar(c.id, { talents: t });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Weapons"
        right={
          <label className="text-sm">
            <input type="checkbox" checked={roster.settings.assumeAllWeapons} onChange={(e) => update((r) => ({ ...r, settings: { ...r.settings, assumeAllWeapons: e.target.checked } }))} />{' '}
            Assume I own every weapon (theorycrafting)
          </label>
        }
      >
        {types.map((t) => (
          <div key={t} className="mb-3">
            <h3 className="text-sm font-semibold capitalize text-slate-600">{t}</h3>
            <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {[...kb.weapons.values()].filter((w) => w.type === t).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)).map((w) => {
                const rw = roster.weapons[w.id]!;
                return (
                  <div key={w.id} className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-sm ${rw.owned ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={rw.owned} onChange={(e) => setWeapon(w.id, { owned: e.target.checked })} />
                      {w.name} <span className="text-xs text-slate-500">{w.rarity}★</span>
                    </label>
                    <select className="rounded border px-1" value={rw.refinement} onChange={(e) => setWeapon(w.id, { refinement: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
                    </select>
                    {w.obtain.freeRefinement ? <Badge tone="green">R{w.obtain.freeRefinement} obtainable free ({w.obtain.method})</Badge> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Execution profile">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            className="rounded border px-2 py-1" value={roster.settings.executionProfile}
            onChange={(e) => {
              const p = e.target.value as Roster['settings']['executionProfile'];
              update((r) => ({ ...r, settings: { ...r.settings, executionProfile: p, ...(p === 'relaxed' ? { actionDelay: 18, swapDelay: 18 } : p === 'framePerfect' ? { actionDelay: 0, swapDelay: 0 } : {}) } }));
            }}
          >
            <option value="relaxed">Relaxed (300 ms after every action and swap)</option>
            <option value="framePerfect">Frame-perfect</option>
            <option value="custom">Custom</option>
          </select>
          {roster.settings.executionProfile === 'custom' && (
            <>
              <label>Action delay (frames) <IntInput min={0} max={120} className="w-16 rounded border px-1" value={roster.settings.actionDelay} onChange={(n) => update((r) => ({ ...r, settings: { ...r.settings, actionDelay: n } }))} /></label>
              <label>Swap delay (frames) <IntInput min={0} max={120} className="w-16 rounded border px-1" value={roster.settings.swapDelay} onChange={(n) => update((r) => ({ ...r, settings: { ...r.settings, swapDelay: n } }))} /></label>
            </>
          )}
          <span className="text-slate-500">Results always show Frame-perfect alongside.</span>
        </div>
      </Section>

      <p className="mt-6 text-xs text-slate-500">
        Your roster is remembered in this browser automatically. To copy it to another browser or keep a backup, use the Backup tab.
      </p>
    </div>
  );
}
