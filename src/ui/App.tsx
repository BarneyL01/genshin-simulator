import { useEffect, useMemo } from 'react';
import { bundledKb } from '../kb/bundle';
import { BackupView } from './BackupView';
import { CompareView } from './CompareView';
import { CustomView } from './CustomView';
import { Icon, type IconName } from './Icon';
import { RosterView } from './RosterView';
import { TeamsView } from './TeamsView';
import { requestPersistentStorage, usePersistentState, useRoster, useSavedTeams } from './store';

type Tab = 'roster' | 'teams' | 'custom' | 'compare' | 'backup';
/** Short labels: a navigation bar has room for about one word per destination. */
const TABS: Array<[Tab, string, IconName]> = [
  ['roster', 'Roster', 'group'],
  ['teams', 'Teams', 'leaderboard'],
  ['custom', 'Custom', 'tune'],
  ['compare', 'Weapons', 'compare'],
  ['backup', 'Backup', 'backup'],
];
const isTab = (v: unknown): v is Tab => TABS.some(([id]) => id === v);

export function App() {
  const kb = useMemo(() => bundledKb(), []);
  const { roster, setRoster, update } = useRoster(kb);
  const saved = useSavedTeams();
  const [tab, setTab] = usePersistentState<Tab>('tab', 'roster', isTab);
  useEffect(requestPersistentStorage, []);

  return (
    <div className="min-h-dvh bg-surface text-on-surface md:pl-20">
      <header>
        <div className="sticky top-0 z-20 flex h-16 items-center bg-surface px-4 pt-[env(safe-area-inset-top)] md:px-6">
          <h1 className="text-title-large">Genshin Team Simulator</h1>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-2 text-body-small text-on-surface-variant md:px-6">
          Game version {kb.meta.gameVersion} · {kb.characters.size} characters, {kb.weapons.size} weapons, {kb.artifacts.size} artifact sets, {kb.teams.size} teams in the knowledge base.
          Runs entirely in your browser.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-44 pt-2 md:px-6 md:pb-24">
        {tab === 'roster' && <RosterView kb={kb} roster={roster} update={update} />}
        {tab === 'teams' && <TeamsView kb={kb} roster={roster} saved={saved.teams} />}
        {tab === 'custom' && <CustomView kb={kb} roster={roster} saved={saved} />}
        {tab === 'compare' && <CompareView kb={kb} roster={roster} saved={saved.teams} />}
        {tab === 'backup' && <BackupView kb={kb} roster={roster} setRoster={setRoster} saved={saved} />}

        <footer className="mt-12 border-t border-outline-variant pt-4 text-body-small text-on-surface-variant">
          <p>
            Numbers come from genshin-db, gcsim (reference only) and KeqingMains; see each result's Assumptions tab for what it rests on.
            Unofficial fan project, not affiliated with HoYoverse.
          </p>
          <p className="mt-2 font-mono text-label-small" title={`Built ${__BUILD__.date}`}>
            v{__BUILD__.version} · {__BUILD__.commit}{__BUILD__.dirty ? '+' : ''} · {__BUILD__.date}
          </p>
        </footer>
      </main>

      {/* Navigation bar (compact windows) / navigation rail (600dp and up) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface-container pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:flex md:w-20 md:flex-col md:justify-start md:pb-0 md:pt-24" aria-label="Main">
        <div role="tablist" className="flex h-20 items-stretch md:h-auto md:flex-col md:gap-3">
          {TABS.map(([id, label, icon]) => {
            const on = tab === id;
            return (
              <button
                key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
                className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 md:flex-none md:py-1"
              >
                <span className={`state-layer flex h-8 w-16 items-center justify-center rounded-full transition-colors ${on ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>
                  <Icon name={icon} />
                </span>
                <span className={`text-label-medium ${on ? 'text-on-surface' : 'text-on-surface-variant'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
