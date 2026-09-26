import { useMemo, useState } from 'react';
import { resolveStats, sumMods, type BuffRecord, type SimResult } from '../engine';
import type { KbData, TeamRun } from '../kb';
import { Badge, Bar, Section, Table, confidenceTone } from './Common';
import { ELEMENT_COLOR, charColor, fmt, nameOf, pct, secs } from './format';
import { Timeline, type Row } from './Timeline';

type Tab = 'summary' | 'actions' | 'buffs' | 'hits' | 'assumptions';

const TABS: Array<[Tab, string]> = [
  ['summary', 'Summary'], ['actions', 'Action timeline'], ['buffs', 'Buff timeline'], ['hits', 'Hit log'], ['assumptions', 'Assumptions'],
];

/** Fraction of [from, to) covered by the union of the segments. */
function uptime(segs: Array<{ start: number; end: number }>, from: number, to: number): number {
  const clipped = segs.map((s) => [Math.max(s.start, from), Math.min(s.end, to)] as const).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let cursor = from;
  for (const [a, b] of clipped) {
    const start = Math.max(a, cursor);
    if (b > start) {
      covered += b - start;
      cursor = b;
    }
  }
  return to > from ? covered / (to - from) : 0;
}

export function ResultView({ run, kb, title }: { run: TeamRun; kb: KbData; title?: string }) {
  const [tab, setTab] = useState<Tab>('summary');
  const [profile, setProfile] = useState<'relaxed' | 'framePerfect'>('relaxed');
  const res: SimResult = profile === 'relaxed' ? run.relaxed : run.framePerfect;
  const other = profile === 'relaxed' ? run.framePerfect : run.relaxed;
  const ids = run.members.map((m) => m.character);
  const colorOf = (id: string) => charColor(Math.max(0, ids.indexOf(id)));

  // Steady-state cycle for the timelines: cycle 2 if it exists, else cycle 1
  const cycleNo = res.cycleStarts.length >= 2 ? 2 : 1;
  const from = res.cycleStarts[cycleNo - 1] ?? 0;
  const to = res.cycleStarts[cycleNo] ?? from + res.cycleFrames;
  const delayCost = run.framePerfect.dps > 0 ? 1 - run.relaxed.dps / run.framePerfect.dps : 0;
  const maxDps = Math.max(...Object.values(res.perCharacterDps), 1);

  return (
    <div>
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded border border-slate-300 text-sm">
          {(['relaxed', 'framePerfect'] as const).map((p) => (
            <button key={p} onClick={() => setProfile(p)} className={`px-3 py-1 ${profile === p ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>
              {p === 'relaxed' ? 'Relaxed' : 'Frame-perfect'} {fmt((p === 'relaxed' ? run.relaxed : run.framePerfect).dps)} DPS
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-600">The delay costs {pct(delayCost)} · rotation {secs(run.relaxed.cycleFrames)} relaxed / {secs(run.framePerfect.cycleFrames)} frame-perfect</span>
      </div>

      <div role="tablist" className="mt-3 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px rounded-t border px-3 py-1.5 text-sm ${tab === id ? 'border-slate-300 border-b-white bg-white font-medium' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <Section title="Team damage">
          <Table head={['Character', 'DPS', 'Share', '', 'Weapon', 'Main stats (sands / goblet / circlet)', 'Liquid substat rolls', 'ER: have / needs', 'Δ vs other profile']}>
            {run.members.map((m, i) => {
              const dps = res.perCharacterDps[m.character] ?? 0;
              const e = res.energy[m.character];
              const char = run.kqms.characters.find((c) => c.id === m.character)!;
              const er = resolveStats(char.base, char.weaponAtk, sumMods(char.baseMods)).er;
              const short = e && e.requiredEr !== null && e.requiredEr > er + 1e-6;
              return (
                <tr key={m.character}>
                  <td className="font-medium" style={{ color: charColor(i) }}>{nameOf(m.character)}</td>
                  <td>{fmt(dps)}</td>
                  <td>{pct(dps / Math.max(1, res.dps), 0)}</td>
                  <td className="w-32"><Bar value={dps} max={maxDps} color={charColor(i)} /></td>
                  <td>{nameOf(m.weaponId)} R{m.refinement}</td>
                  <td className="text-xs">{m.mains.sands} / {m.mains.goblet} / {m.mains.circlet}</td>
                  <td className="text-xs">{Object.entries(m.liquid).filter(([, n]) => n).map(([s, n]) => `${s} ${n}`).join(', ') || '—'}</td>
                  <td className={short ? 'text-red-700' : ''}>
                    {e && e.requiredEr !== null ? `${pct(er, 0)} / ${pct(e.requiredEr, 0)}` : 'no burst'} {short && <Badge tone="red">short</Badge>}
                  </td>
                  <td className="text-xs text-slate-600">{fmt(other.perCharacterDps[m.character] ?? 0)}</td>
                </tr>
              );
            })}
          </Table>
          <p className="mt-2 text-xs text-slate-500">
            Damage is the average of cycles 2–{res.cycleStarts.length}; cycle 1 is warm-up. Enemy: level 100, 10% RES. Artifact stats follow the KQM Standard
            (20 liquid substat rolls placed by the simulator).
          </p>
        </Section>
      )}

      {tab === 'actions' && (
        <Section title={`Actions in cycle ${cycleNo}`}>
          <Timeline
            from={from} to={to}
            rows={ids.map((id) => ({
              label: nameOf(id), color: colorOf(id),
              segments: res.actions.filter((a) => a.cycle === cycleNo && a.char === id).map((a) => ({
                start: a.start, end: Math.max(a.start + 6, a.end), label: a.action,
                title: `${nameOf(id)} ${a.action} at ${((a.start - from) / 60).toFixed(2)} s`,
              })),
            }))}
          />
          <p className="mt-1 text-xs text-slate-500">Bars run from the action's start to its cancel frame; the gap before the next action is the execution delay.</p>
        </Section>
      )}

      {tab === 'buffs' && <BuffTimeline res={res} from={from} to={to} cycleNo={cycleNo} colorOf={colorOf} />}
      {tab === 'hits' && <HitLog res={res} from={from} to={to} cycleNo={cycleNo} colorOf={colorOf} />}
      {tab === 'assumptions' && <Assumptions run={run} res={res} kb={kb} />}
    </div>
  );
}

function BuffTimeline({ res, from, to, cycleNo, colorOf }: { res: SimResult; from: number; to: number; cycleNo: number; colorOf: (id: string) => string }) {
  const [hideMarkers, setHideMarkers] = useState(true);
  const rows: Row[] = useMemo(() => {
    const groups = new Map<string, BuffRecord[]>();
    for (const b of res.buffs) {
      if (b.start >= to || (b.end ?? Infinity) <= from) continue;
      if (hideMarkers && b.value === 0 && !b.dynamic) continue;
      const key = `${b.effectId} → ${b.target}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(b);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, recs]) => {
      const segs = recs.map((b) => ({ start: b.start, end: b.end ?? to, label: b.stacks > 1 ? `×${b.stacks}` : undefined, title: `${label}: ${b.stat} ${b.dynamic ? '(scales with a stat)' : b.value.toFixed(3)} ×${b.stacks} · ${((b.start - from) / 60).toFixed(1)}–${b.end === null ? '∞' : ((b.end - from) / 60).toFixed(1)} s` }));
      return { label, color: colorOf(recs[0]!.source), segments: segs, suffix: `${(uptime(segs, from, to) * 100).toFixed(0)}%` };
    });
  }, [res, from, to, hideMarkers, colorOf]);

  return (
    <Section title={`Buffs and debuffs in cycle ${cycleNo}`} right={<label className="text-sm"><input type="checkbox" checked={hideMarkers} onChange={(e) => setHideMarkers(e.target.checked)} /> hide zero-value state markers</label>}>
      {rows.length ? <Timeline rows={rows} from={from} to={to} labelWidth={280} /> : <p className="text-sm text-slate-600">No timed buffs in this window.</p>}
      <p className="mt-1 text-xs text-slate-500">Label: source effect → who it affects ("active" = whoever is on the field). The percentage on the right is uptime in this cycle. Colours are the source character.</p>
    </Section>
  );
}

function HitLog({ res, from, to, cycleNo, colorOf }: { res: SimResult; from: number; to: number; cycleNo: number; colorOf: (id: string) => string }) {
  const [all, setAll] = useState(false);
  const [minDamage, setMinDamage] = useState(true);
  const hits = res.hits.filter((h) => h.frame >= from && h.frame < to && (!minDamage || h.damage > 0));
  const shown = all ? hits : hits.slice(0, 120);
  return (
    <Section title={`Hit log, cycle ${cycleNo} (${hits.length} hits)`} right={<label className="text-sm"><input type="checkbox" checked={minDamage} onChange={(e) => setMinDamage(e.target.checked)} /> only hits that deal damage</label>}>
      <Table head={['Time', 'Character', 'Source', 'Element', 'Reactions', 'Damage']}>
        {shown.map((h, i) => (
          <tr key={i}>
            <td>{((h.frame - from) / 60).toFixed(2)} s</td>
            <td style={{ color: colorOf(h.char) }}>{nameOf(h.char)}</td>
            <td>{h.talent === 'reaction' ? `${h.action} (reaction)` : h.action}</td>
            <td><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: ELEMENT_COLOR[h.element] ?? '#999' }} />{h.element}</td>
            <td>{h.talent === 'reaction' ? '' : h.reactions.join(', ')}</td>
            <td className="text-right tabular-nums">{fmt(h.damage)}</td>
          </tr>
        ))}
      </Table>
      {hits.length > shown.length && <button className="mt-2 text-sm text-blue-700 underline" onClick={() => setAll(true)}>Show all {hits.length}</button>}
    </Section>
  );
}

function Assumptions({ run, res, kb }: { run: TeamRun; res: SimResult; kb: KbData }) {
  const records = useMemo(() => {
    const out: Array<{ kind: string; id: string; name: string; confidence: string; assumptions: string[] }> = [];
    for (const m of run.members) {
      const c = kb.characters.get(m.character);
      const w = kb.weapons.get(m.weaponId);
      if (c) out.push({ kind: 'character', id: c.id, name: c.name, confidence: c.dataConfidence, assumptions: c.assumptions });
      if (w) out.push({ kind: 'weapon', id: w.id, name: w.name, confidence: w.dataConfidence, assumptions: w.assumptions });
    }
    return out;
  }, [run, kb]);

  return (
    <Section title="What this result assumes">
      <h3 className="text-sm font-semibold">This run</h3>
      <ul className="ml-5 list-disc text-sm">
        {[...new Set([...run.notices, ...res.assumptions])].map((a) => <li key={a}>{a}</li>)}
        {run.notices.length + res.assumptions.length === 0 && <li>Nothing flagged.</li>}
      </ul>
      <h3 className="mt-4 text-sm font-semibold">Knowledge-base records used</h3>
      <div className="mt-1 space-y-1">
        {records.map((r) => (
          <details key={`${r.kind}-${r.id}`} className="rounded border border-slate-200 px-2 py-1 text-sm">
            <summary className="cursor-pointer">
              {r.name} <span className="text-slate-500">({r.kind})</span> <Badge tone={confidenceTone(r.confidence)}>{r.confidence}</Badge>
            </summary>
            <ul className="ml-5 mt-1 list-disc text-xs text-slate-700">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Single-target, stationary enemy; expected-value crits; no enemy attacks. Effects with conditions are assumed met. See docs/SIMULATION.md for the full model and its simplifications.
      </p>
    </Section>
  );
}
