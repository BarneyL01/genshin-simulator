import { useMemo, useRef, useState } from 'react';
import type { KbData, SavedTeam } from '../kb';
import type { Roster } from '../schema/roster';
import { makeBackup, parseBackup } from './backup';
import { Button, Section } from './Common';
import { discardRecoveredCopy, recoveredCopies, withKbEntries } from './store';

interface Props {
  kb: KbData;
  roster: Roster;
  setRoster: (r: Roster) => void;
  saved: { teams: SavedTeam[]; merge: (t: SavedTeam[]) => void; replaceAll: (t: SavedTeam[]) => void };
}

const rosterSummary = (r: Roster) => {
  const chars = Object.values(r.characters).filter((c) => c.owned).length;
  const weapons = Object.values(r.weapons).filter((w) => w.owned).length;
  return `${chars} owned characters, ${weapons} owned weapons`;
};

export function BackupView({ kb, roster, setRoster, saved }: Props) {
  const exportText = useMemo(() => JSON.stringify(makeBackup(roster, saved.teams), null, 2), [roster, saved.teams]);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState('');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<{ roster: Roster; teams: SavedTeam[] }>();
  const [recovered, setRecovered] = useState(recoveredCopies);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied('Copied to clipboard.');
    } catch {
      exportRef.current?.select();
      setCopied('Could not copy automatically; the text is selected, copy it manually.');
    }
  };

  const download = () => {
    const blob = new Blob([exportText], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `genshin-sim-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const readFile = async (f: File | undefined) => {
    if (f) setText(await f.text());
  };

  const doImport = () => {
    setError('');
    setMessage('');
    setWarnings([]);
    try {
      const p = parseBackup(text);
      setUndo({ roster, teams: saved.teams });
      const parts: string[] = [];
      if (p.roster) {
        const next = withKbEntries(kb, p.roster);
        setRoster(next);
        parts.push(`roster (${rosterSummary(next)})`);
      }
      if (p.savedTeams) {
        saved.merge(p.savedTeams);
        parts.push(`${p.savedTeams.length} saved teams`);
      }
      setMessage(`Imported ${parts.join(' and ')}.`);
      setWarnings(p.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doUndo = () => {
    if (!undo) return;
    setRoster(undo.roster);
    saved.replaceAll(undo.teams);
    setUndo(undefined);
    setMessage('Import undone.');
    setWarnings([]);
  };

  return (
    <div>
      <p className="text-sm text-slate-600">
        Your roster, settings and saved teams are remembered automatically in this browser. Use this tab to move them to another
        browser or device, or to keep a copy in case the browser's site data is cleared.
      </p>

      <Section title="Export">
        <p className="text-sm">Current: {rosterSummary(roster)}, {saved.teams.length} saved teams.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button primary onClick={copy}>Copy backup text</Button>
          <Button onClick={download}>Download .json file</Button>
        </div>
        {copied && <p className="mt-1 text-sm text-slate-600" role="status">{copied}</p>}
        <textarea ref={exportRef} readOnly aria-label="backup text" className="mt-2 h-40 w-full rounded border bg-slate-50 p-2 font-mono text-xs" value={exportText} />
      </Section>

      <Section title="Import">
        <p className="text-sm text-slate-600">
          Paste backup text or choose a file, then Import. The roster is replaced; saved teams are added (a team with the same id is replaced).
          A roster exported by an earlier version of the app also works.
        </p>
        <textarea aria-label="import text" className="mt-2 h-40 w-full rounded border p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste backup JSON here" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button primary disabled={!text.trim()} onClick={doImport}>Import</Button>
          <label className="text-sm">
            <span className="sr-only">Choose backup file</span>
            <input type="file" accept=".json,application/json,text/plain" onChange={(e) => void readFile(e.target.files?.[0])} className="text-sm" />
          </label>
          {undo && <Button onClick={doUndo}>Undo import</Button>}
        </div>
        {message && <p className="mt-2 text-sm text-emerald-800" role="status">{message}</p>}
        {warnings.map((w) => <p key={w} className="text-sm text-amber-800">{w}</p>)}
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      </Section>

      {recovered.length > 0 && (
        <Section title="Recovered data">
          <p className="text-sm text-slate-600">
            Stored data that this version could not fully read was kept here instead of being thrown away. Load it into the import box to restore what can be read.
          </p>
          {recovered.map((r) => (
            <div key={r.key} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <code className="text-xs">{r.key}</code>
              <Button onClick={() => setText(r.text)}>Load into import box</Button>
              <Button onClick={() => { discardRecoveredCopy(r.key); setRecovered(recoveredCopies()); }}>Discard</Button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
