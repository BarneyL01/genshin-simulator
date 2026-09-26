import { useMemo, useState } from 'react';
import { bundledKb } from '../kb/bundle';
import { CompareView } from './CompareView';
import { CustomView } from './CustomView';
import { RosterView } from './RosterView';
import { TeamsView } from './TeamsView';
import { useRoster } from './store';

type Tab = 'roster' | 'teams' | 'custom' | 'compare';
const TABS: Array<[Tab, string]> = [['roster', 'Roster'], ['teams', 'Known teams'], ['custom', 'Custom team'], ['compare', 'Weapon comparer']];

export function App() {
  const kb = useMemo(() => bundledKb(), []);
  const { roster, setRoster, update } = useRoster(kb);
  const [tab, setTab] = useState<Tab>('roster');

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Genshin Team Simulator</h1>
        <p className="text-sm text-slate-600">
          Game version {kb.meta.gameVersion} · {kb.characters.size} characters, {kb.weapons.size} weapons, {kb.artifacts.size} artifact sets, {kb.teams.size} teams in the knowledge base.
          Runs entirely in your browser.
        </p>
      </header>
      <nav role="tablist" className="mt-4 flex flex-wrap gap-1 border-b border-slate-300">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px rounded-t border px-4 py-2 text-sm ${tab === id ? 'border-slate-300 border-b-white bg-white font-semibold' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-4">
        {tab === 'roster' && <RosterView kb={kb} roster={roster} update={update} setRoster={setRoster} />}
        {tab === 'teams' && <TeamsView kb={kb} roster={roster} />}
        {tab === 'custom' && <CustomView kb={kb} roster={roster} />}
        {tab === 'compare' && <CompareView kb={kb} roster={roster} />}
      </div>
      <footer className="mt-10 border-t border-slate-200 pt-3 text-xs text-slate-500">
        Numbers come from genshin-db, gcsim (reference only) and KeqingMains; see each result's Assumptions tab for what it rests on.
        Unofficial fan project, not affiliated with HoYoverse.
      </footer>
    </main>
  );
}
