export interface Segment {
  start: number;
  end: number;
  label?: string;
  title?: string;
  color?: string;
  /** Drawn with reduced opacity (e.g. zero-value state markers). */
  faint?: boolean;
}

export interface Row {
  label: string;
  color?: string;
  segments: Segment[];
  suffix?: string;
}

interface Props {
  rows: Row[];
  /** Visible window in frames. */
  from: number;
  to: number;
  /** Wider label column for long row names (applies from 600dp up; phones always use a narrow one). */
  wideLabels?: boolean;
  rowHeight?: number;
}

/**
 * Gantt chart in HTML so text stays at a readable size. Row labels stay pinned while the track scrolls sideways
 * on narrow screens. Time axis in seconds, 60 frames per second.
 */
export function Timeline({ rows, from, to, wideLabels = false, rowHeight = 36 }: Props) {
  const span = Math.max(1, to - from);
  const at = (f: number) => (Math.min(Math.max(f, from), to) - from) / span;
  const totalS = span / 60;
  const tickStep = totalS > 60 ? 10 : totalS > 24 ? 5 : totalS > 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= totalS; t += tickStep) ticks.push(t);
  const hasSuffix = rows.some((r) => r.suffix);
  const labelCol = `sticky left-0 z-10 shrink-0 bg-surface ${wideLabels ? 'w-36 md:w-56' : 'w-28 md:w-40'}`;

  return (
    <div className="overflow-x-auto rounded-md border border-outline-variant" role="group" aria-label="timeline">
      <div className="min-w-[680px]">
        <div className="flex">
          <div className={`${labelCol} h-8`} />
          <div className="relative mx-4 h-8 flex-1">
            {ticks.map((t) => (
              <span key={t} className="absolute top-2 -translate-x-1/2 text-label-small text-on-surface-variant" style={{ left: `${(t * 60 / span) * 100}%` }}>{t}s</span>
            ))}
          </div>
          {hasSuffix && <div className="w-12 shrink-0" />}
        </div>
        {rows.map((row, i) => (
          <div key={`${row.label}-${i}`} className="flex items-stretch border-t border-outline-variant" style={{ height: rowHeight }}>
            <div
              className={`${labelCol} flex items-center px-3 text-label-medium`}
              style={{ color: row.color }} title={row.label}
            >
              <span className="line-clamp-2 break-all">{row.label}</span>
            </div>
            <div className="relative mx-4 flex-1">
              {ticks.map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-outline-variant/50" style={{ left: `${(t * 60 / span) * 100}%` }} />
              ))}
              {row.segments.filter((s) => s.end > from && s.start < to).map((s, j) => {
                const left = at(s.start);
                const width = Math.max(at(s.end) - left, 0.004);
                return (
                  <div
                    key={j} title={s.title ?? s.label ?? row.label}
                    className="absolute inset-y-1 flex items-center overflow-hidden whitespace-nowrap rounded-xs px-1 text-label-small"
                    style={{ left: `${left * 100}%`, width: `${width * 100}%`, background: s.color ?? row.color ?? 'var(--md-primary)', opacity: s.faint ? 0.35 : 0.92, color: 'var(--md-surface)' }}
                  >
                    {width >= 0.07 ? s.label : null}
                  </div>
                );
              })}
            </div>
            {hasSuffix && <div className="flex w-12 shrink-0 items-center justify-end pr-2 text-label-small text-on-surface-variant">{row.suffix}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
