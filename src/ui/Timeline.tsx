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
  labelWidth?: number;
  rowHeight?: number;
}

/** Simple Gantt chart. Time axis in seconds, 60 frames per second. */
export function Timeline({ rows, from, to, labelWidth = 190, rowHeight = 22 }: Props) {
  const width = 1000;
  const chartW = width - labelWidth - 60;
  const height = rows.length * rowHeight + 28;
  const scale = (f: number) => labelWidth + ((Math.min(Math.max(f, from), to) - from) / Math.max(1, to - from)) * chartW;
  const totalS = (to - from) / 60;
  const tickStep = totalS > 60 ? 10 : totalS > 24 ? 5 : totalS > 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= totalS; t += tickStep) ticks.push(t);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]" role="img" aria-label="timeline">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={scale(from + t * 60)} x2={scale(from + t * 60)} y1={0} y2={height - 18} stroke="#e2e8f0" />
            <text x={scale(from + t * 60)} y={height - 5} fontSize="10" textAnchor="middle" fill="#64748b">{t}s</text>
          </g>
        ))}
        {rows.map((row, i) => {
          const y = i * rowHeight;
          return (
            <g key={`${row.label}-${i}`}>
              <text x={labelWidth - 6} y={y + rowHeight / 2 + 4} fontSize="11" textAnchor="end" fill={row.color ?? '#334155'}>
                {row.label.length > 30 ? `${row.label.slice(0, 29)}…` : row.label}
              </text>
              <line x1={labelWidth} x2={labelWidth + chartW} y1={y + rowHeight} y2={y + rowHeight} stroke="#f1f5f9" />
              {row.segments.filter((s) => s.end > from && s.start < to).map((s, j) => {
                const x1 = scale(s.start);
                const x2 = Math.max(scale(s.end), x1 + 1.5);
                return (
                  <g key={j}>
                    <rect x={x1} y={y + 3} width={x2 - x1} height={rowHeight - 6} rx={2} fill={s.color ?? row.color ?? '#2563eb'} opacity={s.faint ? 0.35 : 0.9}>
                      <title>{s.title ?? s.label ?? row.label}</title>
                    </rect>
                    {s.label && x2 - x1 > 26 && (
                      <text x={x1 + 3} y={y + rowHeight / 2 + 3} fontSize="9" fill="#fff" pointerEvents="none">{s.label}</text>
                    )}
                  </g>
                );
              })}
              {row.suffix && <text x={labelWidth + chartW + 4} y={y + rowHeight / 2 + 4} fontSize="10" fill="#64748b">{row.suffix}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
