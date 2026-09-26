import { useState, type ReactNode } from 'react';
import { blurValue, draftValue, sanitizeInt } from './intInput';

/**
 * Integer input that works with mobile keyboards: the typed text is kept as a draft,
 * in-range values are committed immediately, and an empty or out-of-range draft is restored on blur.
 * Focusing selects the text so a new number replaces the old one instead of appending to it
 * (deferred, because iOS Safari and Android Chrome drop a selection made inside the focus event).
 */
export function IntInput({ value, min, max, onChange, className = '', ...rest }: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={className}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        const el = e.currentTarget;
        setTimeout(() => el.select(), 0);
      }}
      onChange={(e) => {
        const text = sanitizeInt(e.target.value);
        setDraft(text);
        const n = draftValue(text, min, max);
        if (n !== null && n !== value) onChange(n);
      }}
      onBlur={() => {
        const n = blurValue(draft ?? '', min, max, value);
        if (n !== value) onChange(n);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  } as const;
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export const confidenceTone = (c: string) => (c === 'high' ? 'green' : c === 'medium' ? 'amber' : 'red') as 'green' | 'amber' | 'red';

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  const { primary, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-300 bg-white hover:bg-slate-50'
      } ${className}`}
    />
  );
}

export function Bar({ value, max, color = '#2563eb' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 w-full rounded bg-slate-100">
      <div className="h-2 rounded" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-600">
            {head.map((h, i) => (
              <th key={i} className="px-2 py-1 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-slate-100 [&_td]:px-2 [&_td]:py-1">{children}</tbody>
      </table>
    </div>
  );
}
