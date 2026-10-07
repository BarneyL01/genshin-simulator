import { useMemo, useRef, useState } from 'react';
import type { KbData, SavedTeam } from '../kb';
import type { Roster } from '../schema/roster';
import { makeBackup, parseBackup } from './backup';
import { Button, Notice, Section } from './Common';
import { Icon } from './Icon';
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

  const TEXTAREA = 'mt-3 h-40 w-full rounded-md border border-outline bg-transparent p-3 font-mono text-body-small focus:border-primary focus:outline-2 focus:outline-primary';
  return (
    <div>
      <p className="text-body-medium text-on-surface-variant">
        Your roster, settings and saved teams are remembered automatically in this browser. Use this tab to move them to another
        browser or device, or to keep a copy in case the browser's site data is cleared.
      </p>

      <Section title="Export" supporting={`Current: ${rosterSummary(roster)}, ${saved.teams.length} saved teams.`}>
        <div className="flex flex-wrap gap-2">
          <Button variant="filled" icon="copy" onClick={copy}>Copy backup text</Button>
          <Button variant="tonal" icon="download" onClick={download}>Download .json file</Button>
        </div>
        {copied && <div className="mt-3"><Notice tone="success">{copied}</Notice></div>}
        <textarea ref={exportRef} readOnly aria-label="backup text" className={`${TEXTAREA} bg-surface-container-low`} value={exportText} />
      </Section>

      <Section
        title="Import"
        supporting="Paste backup text or choose a file, then Import. The roster is replaced; saved teams are added (a team with the same id is replaced). A roster exported by an earlier version of the app also works."
      >
        <textarea aria-label="import text" className={TEXTAREA} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste backup JSON here" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="filled" disabled={!text.trim()} onClick={doImport}>Import</Button>
          <label className="state-layer hit-48 relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-outline pl-4 pr-6 text-label-large text-primary focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-secondary">
            <Icon name="upload" className="size-[18px]" />
            Choose file
            <input type="file" aria-label="Choose backup file" accept=".json,application/json,text/plain" onChange={(e) => void readFile(e.target.files?.[0])} className="sr-only" />
          </label>
          {undo && <Button icon="undo" onClick={doUndo}>Undo import</Button>}
        </div>
        <div className="mt-3 space-y-2">
          {message && <Notice tone="success">{message}</Notice>}
          {warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </Section>

      {recovered.length > 0 && (
        <Section title="Recovered data" supporting="Stored data that this version could not fully read was kept here instead of being thrown away. Load it into the import box to restore what can be read.">
          {recovered.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center gap-2 border-b border-outline-variant py-2 last:border-b-0">
              <code className="min-w-0 flex-1 break-all font-mono text-body-small">{r.key}</code>
              <Button variant="tonal" onClick={() => setText(r.text)}>Load into import box</Button>
              <Button variant="text" onClick={() => { discardRecoveredCopy(r.key); setRecovered(recoveredCopies()); }}>Discard</Button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
