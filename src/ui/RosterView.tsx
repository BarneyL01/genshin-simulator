import { useMemo, useState } from 'react';
import type { KbData } from '../kb';
import type { Roster } from '../schema/roster';
import { Badge, Button, Card, CheckRow, ElementTag, Expandable, FilterChip, NumberField, SearchBar, Section, Select, Stars, SwitchRow, confidenceTone } from './Common';
import { ELEMENT_COLOR, elementColor } from './format';

interface Props {
  kb: KbData;
  roster: Roster;
  update: (fn: (r: Roster) => Roster) => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const WEAPON_PAGE = 60;

export function RosterView({ kb, roster, update }: Props) {
  const chars = useMemo(() => [...kb.characters.values()].sort((a, b) => a.name.localeCompare(b.name)), [kb]);
  const elements = useMemo(() => [...new Set(chars.map((c) => c.element))].sort(), [chars]);
  const types = useMemo(() => [...new Set([...kb.weapons.values()].map((w) => w.type))].sort(), [kb]);

  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [wQuery, setWQuery] = useState('');
  const [wType, setWType] = useState('');
  const [wLimit, setWLimit] = useState(WEAPON_PAGE);

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

  const ownedChars = chars.filter((c) => roster.characters[c.id]?.owned).length;
  const q = query.trim().toLowerCase();
  const shown = chars.filter((c) => {
    if (ownedOnly && !roster.characters[c.id]?.owned) return false;
    if (picked.length > 0 && !picked.includes(c.element)) return false;
    return !q || `${c.name} ${c.element} ${c.weaponType} ${c.rarity}★`.toLowerCase().includes(q);
  });

  const wq = wQuery.trim().toLowerCase();
  const allWeapons = useMemo(() => [...kb.weapons.values()].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name)), [kb]);
  const weaponsFiltered = allWeapons.filter((w) => (!wType || w.type === wType) && (!wq || w.name.toLowerCase().includes(wq)));
  const weaponsReady = Boolean(wType || wq);
  const ownedWeapons = allWeapons.filter((w) => roster.weapons[w.id]?.owned).length;

  return (
    <div>
      <p className="text-body-medium text-on-surface-variant">
        Tick what you own. Everyone defaults to C0, talents 1/1/1 and Lv 90; weapons to R1 (set your real refinement per weapon).
        Nothing leaves your browser.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="tonal" onClick={() => setAll(true)}>Own everything</Button>
        <Button onClick={() => setAll(false)}>Own nothing</Button>
      </div>

      <Section title="Characters" supporting={`${ownedChars} of ${chars.length} owned${shown.length !== chars.length ? ` · ${shown.length} shown` : ''}`}>
        <SearchBar label="Search characters" placeholder="Search characters" value={query} onChange={setQuery} />
        <div className="scrollbar-none -mx-4 mt-1 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <FilterChip checked={ownedOnly} onChange={setOwnedOnly}>Owned</FilterChip>
          {elements.map((el) => (
            <FilterChip key={el} checked={picked.includes(el)} onChange={(on) => setPicked((p) => (on ? [...p, el] : p.filter((x) => x !== el)))}>
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: ELEMENT_COLOR[el] }} />
              {cap(el)}
            </FilterChip>
          ))}
        </div>

        <Card className="mt-3 divide-y divide-outline-variant overflow-hidden">
          {shown.length === 0 && <p className="px-4 py-6 text-center text-body-medium text-on-surface-variant">No characters match.</p>}
          {shown.map((c) => {
            const rc = roster.characters[c.id]!;
            return (
              <div key={c.id}>
                <CheckRow
                  checked={rc.owned} onChange={(v) => setChar(c.id, { owned: v })}
                  headline={<span className="font-medium">{c.name}</span>}
                  accent={elementColor(c.element)}
                  supporting={<span className="flex flex-wrap items-center gap-x-2"><Stars rarity={c.rarity} /><ElementTag element={c.element} /><span>{cap(c.weaponType)}</span></span>}
                  trailing={<Badge tone={confidenceTone(c.dataConfidence)}>{c.dataConfidence}</Badge>}
                />
                {rc.owned && (
                  <div className="grid grid-cols-4 gap-2 bg-surface-container px-4 pb-3 pt-2">
                    <Select dense label="Const." aria-label={`Const. for ${c.name}`} value={rc.constellation} onChange={(e) => setChar(c.id, { constellation: Number(e.target.value) })}>
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>C{n}</option>)}
                    </Select>
                    {(['Normal', 'Skill', 'Burst'] as const).map((label, i) => (
                      <NumberField
                        dense key={label} label={label} aria-label={`${label} talent ${i + 1} for ${c.name}`} min={1} max={15}
                        value={rc.talents[i]!}
                        onChange={(n) => {
                          const t = [...rc.talents] as [number, number, number];
                          t[i] = n;
                          setChar(c.id, { talents: t });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </Section>

      <Section title="Weapons">
        <Expandable title="Your weapons" supporting={`${ownedWeapons} of ${allWeapons.length} owned${roster.settings.assumeAllWeapons ? ' · assuming you own every weapon' : ''}`}>
          <SwitchRow checked={roster.settings.assumeAllWeapons} onChange={(v) => update((r) => ({ ...r, settings: { ...r.settings, assumeAllWeapons: v } }))}>
            Assume I own every weapon (theorycrafting)
          </SwitchRow>
          <div className="mt-2">
            <SearchBar label="Search weapons" placeholder="Search weapons" value={wQuery} onChange={(v) => { setWQuery(v); setWLimit(WEAPON_PAGE); }} />
          </div>
          <div className="scrollbar-none -mx-4 mt-1 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {types.map((t) => (
              <FilterChip key={t} checked={wType === t} onChange={(on) => { setWType(on ? t : ''); setWLimit(WEAPON_PAGE); }}>{cap(t)}</FilterChip>
            ))}
          </div>
          {!weaponsReady && <p className="mt-4 text-body-medium text-on-surface-variant">Pick a weapon type or search by name to list weapons.</p>}
          {weaponsReady && (
            <Card className="mt-3 divide-y divide-outline-variant overflow-hidden bg-surface-container">
              {weaponsFiltered.length === 0 && <p className="px-4 py-6 text-center text-body-medium text-on-surface-variant">No weapons match.</p>}
              {weaponsFiltered.slice(0, wLimit).map((w) => {
                const rw = roster.weapons[w.id]!;
                return (
                  <div key={w.id} className="flex items-center gap-2 pr-3">
                    <div className="min-w-0 flex-1">
                      <CheckRow
                        checked={rw.owned} onChange={(v) => setWeapon(w.id, { owned: v })}
                        headline={w.name}
                        supporting={<><Stars rarity={w.rarity} /> · {cap(w.type)}{w.obtain.freeRefinement ? <> · <span className="text-success">R{w.obtain.freeRefinement} obtainable free ({w.obtain.method})</span></> : null}</>}
                      />
                    </div>
                    {rw.owned && (
                      <Select dense label="Refine" aria-label={`Refine ${w.name}`} className="w-24 shrink-0" value={rw.refinement} onChange={(e) => setWeapon(w.id, { refinement: Number(e.target.value) })}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>R{n}</option>)}
                      </Select>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
          {weaponsReady && weaponsFiltered.length > wLimit && (
            <div className="mt-3"><Button variant="tonal" onClick={() => setWLimit((n) => n + WEAPON_PAGE)}>Show more ({weaponsFiltered.length - wLimit} left)</Button></div>
          )}
        </Expandable>
      </Section>

      <Section title="Execution profile" supporting="Results always show Frame-perfect alongside.">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Select
            label="Profile" value={roster.settings.executionProfile}
            onChange={(e) => {
              const p = e.target.value as Roster['settings']['executionProfile'];
              update((r) => ({ ...r, settings: { ...r.settings, executionProfile: p, ...(p === 'relaxed' ? { actionDelay: 18, swapDelay: 18 } : p === 'framePerfect' ? { actionDelay: 0, swapDelay: 0 } : {}) } }));
            }}
          >
            <option value="relaxed">Relaxed (300 ms after every action and swap)</option>
            <option value="framePerfect">Frame-perfect</option>
            <option value="custom">Custom</option>
          </Select>
          {roster.settings.executionProfile === 'custom' && (
            <>
              <NumberField label="Action delay (frames)" min={0} max={120} value={roster.settings.actionDelay} onChange={(n) => update((r) => ({ ...r, settings: { ...r.settings, actionDelay: n } }))} />
              <NumberField label="Swap delay (frames)" min={0} max={120} value={roster.settings.swapDelay} onChange={(n) => update((r) => ({ ...r, settings: { ...r.settings, swapDelay: n } }))} />
            </>
          )}
        </div>
      </Section>

      <p className="mt-8 text-body-small text-on-surface-variant">
        Your roster is remembered in this browser automatically. To copy it to another browser or keep a backup, use the Backup tab.
      </p>
    </div>
  );
}
