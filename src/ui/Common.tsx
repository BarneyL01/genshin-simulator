import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { elementColor, rarityColor } from './format';
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

// ---- layout -------------------------------------------------------------------------------------------------

export function Section({ title, children, right, supporting }: { title: string; children: ReactNode; right?: ReactNode; supporting?: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-title-large">{title}</h2>
        {right}
      </div>
      {supporting && <p className="mt-1 text-body-medium text-on-surface-variant">{supporting}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const CARD = {
  filled: 'bg-surface-container-low',
  outlined: 'border border-outline-variant bg-surface',
  elevated: 'bg-surface-container-low shadow-elev-1',
} as const;

export function Card({ children, variant = 'filled', className = '' }: { children: ReactNode; variant?: keyof typeof CARD; className?: string }) {
  return <div className={`rounded-md ${CARD[variant]} ${className}`}>{children}</div>;
}

export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-outline-variant ${className}`} />;
}

/** Native <details> as an M3 expandable list item. */
export function Expandable({ title, supporting, children, defaultOpen, className = '' }: { title: ReactNode; supporting?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={`group rounded-md bg-surface-container-low ${className}`}>
      <summary className="state-layer flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-md px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-title-medium">{title}</span>
          {supporting && <span className="block text-body-medium text-on-surface-variant">{supporting}</span>}
        </span>
        <Icon name="expand" className="size-6 text-on-surface-variant transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/** Rarity as repeated stars: five gold or four purple, so the tier reads at a glance. */
export function Stars({ rarity }: { rarity: number }) {
  return <span role="img" aria-label={`${rarity} star`} className="font-medium tracking-tighter" style={{ color: rarityColor(rarity) }}>{'★'.repeat(rarity)}</span>;
}

export function ElementTag({ element }: { element: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: elementColor(element) }} />
      <span className="capitalize" style={{ color: elementColor(element) }}>{element}</span>
    </span>
  );
}

// ---- status ------------------------------------------------------------------------------------------------

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    gray: 'bg-surface-container-highest text-on-surface-variant',
    green: 'bg-success-container text-on-success-container',
    amber: 'bg-warning-container text-on-warning-container',
    red: 'bg-error-container text-on-error-container',
    blue: 'bg-primary-container text-on-primary-container',
  } as const;
  return <span className={`inline-block shrink-0 rounded-sm px-2 py-0.5 text-label-medium ${tones[tone]}`}>{children}</span>;
}

export const confidenceTone = (c: string) => (c === 'high' ? 'green' : c === 'medium' ? 'amber' : 'red') as 'green' | 'amber' | 'red';

/** Inline message. `error` is announced immediately; the others politely. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode }) {
  const t = {
    info: ['bg-secondary-container text-on-secondary-container', 'info'],
    warning: ['bg-warning-container text-on-warning-container', 'warning'],
    error: ['bg-error-container text-on-error-container', 'warning'],
    success: ['bg-success-container text-on-success-container', 'check'],
  } as const;
  const [cls, icon] = t[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-md px-4 py-3 text-body-medium ${cls}`}>
      <Icon name={icon as IconName} className="mt-0.5 size-5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function LinearProgress({ label }: { label: string }) {
  return (
    <div role="progressbar" aria-label={label} className="relative h-1 w-full overflow-hidden bg-secondary-container">
      <div className="absolute inset-y-0 w-2/5 animate-indeterminate bg-primary" />
    </div>
  );
}

// ---- actions -----------------------------------------------------------------------------------------------

type Variant = 'filled' | 'tonal' | 'outlined' | 'text';

const BTN: Record<Variant, string> = {
  filled: 'bg-primary text-on-primary disabled:bg-on-surface/12 disabled:text-on-surface/38',
  tonal: 'bg-secondary-container text-on-secondary-container disabled:bg-on-surface/12 disabled:text-on-surface/38',
  outlined: 'border border-outline text-primary disabled:border-on-surface/12 disabled:text-on-surface/38',
  text: 'text-primary disabled:text-on-surface/38',
};

export function Button({ variant = 'outlined', icon, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  const pad = variant === 'text' ? 'px-3' : icon ? 'pl-4 pr-6' : 'px-6';
  return (
    <button type="button" {...rest} className={`state-layer hit-48 inline-flex h-10 items-center justify-center gap-2 rounded-full text-label-large ${pad} ${BTN[variant]} ${className}`}>
      {icon && <Icon name={icon} className="size-[18px]" />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button" aria-label={label} title={label} {...rest}
      className={`state-layer relative inline-flex size-10 items-center justify-center rounded-full text-on-surface-variant after:absolute after:left-1/2 after:top-1/2 after:size-12 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] disabled:text-on-surface/38 ${className}`}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Extended FAB: the screen's primary action, floating above the navigation bar. Shrinks to an icon (`compact`) once results are on screen. */
export function ExtendedFab({ icon, label, compact, className = '', ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: IconName; label: string; compact?: boolean }) {
  return (
    <button
      type="button" aria-label={compact ? label : undefined} title={label} {...rest}
      className={`state-layer fixed right-4 bottom-[calc(5rem+1rem+env(safe-area-inset-bottom))] z-30 inline-flex h-14 items-center justify-center rounded-lg bg-primary-container text-label-large text-on-primary-container shadow-elev-3 transition-opacity disabled:opacity-[0.38] md:right-6 md:bottom-6 ${compact ? 'w-14' : 'gap-3 px-4'} ${className}`}
    >
      <Icon name={icon} />
      {!compact && label}
    </button>
  );
}

export function FilterChip({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="relative inline-flex shrink-0 py-2">
      <input
        type="checkbox" className="overlay peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="state-layer inline-flex h-8 items-center gap-2 rounded-sm border border-outline-variant px-3 text-label-large text-on-surface-variant peer-checked:border-transparent peer-checked:bg-secondary-container peer-checked:text-on-secondary-container peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary peer-disabled:opacity-[0.38] [&>svg]:hidden peer-checked:[&>svg]:block"
      >
        <Icon name="check" className="size-[18px]" />
        {children}
      </span>
    </label>
  );
}

/** Segmented button (single choice). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`state-layer hit-48 inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 border border-outline px-3 text-label-large ${i === 0 ? 'rounded-l-full' : '-ml-px'} ${i === options.length - 1 ? 'rounded-r-full' : ''} ${on ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'}`}
          >
            {on && <Icon name="check" className="size-[18px]" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Primary tabs; they scroll sideways instead of wrapping when there are more than fit. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<[T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="scrollbar-none flex overflow-x-auto border-b border-outline-variant">
      {tabs.map(([id, label]) => {
        const on = value === id;
        return (
          <button
            key={id} type="button" role="tab" aria-selected={on} onClick={() => onChange(id)}
            className={`state-layer relative h-12 shrink-0 px-4 text-title-small ${on ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            {label}
            {on && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

// ---- inputs ------------------------------------------------------------------------------------------------

const FIELD = 'flex min-h-14 flex-col justify-center rounded-t-xs border-b border-on-surface-variant bg-surface-container-highest py-1 focus-within:border-b-2 focus-within:border-primary';
const px = (dense?: boolean) => (dense ? 'px-3' : 'px-4');
const FIELD_LABEL = 'block text-body-small text-on-surface-variant';
const FIELD_CONTROL = 'block w-full min-w-0 bg-transparent text-body-large outline-none focus-visible:outline-none';

/** Filled select (native picker, so phones show their own list). */
export function Select({ label, className = '', dense, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; dense?: boolean }) {
  return (
    <label className={`relative ${FIELD} ${px(dense)} ${className}`}>
      <span className={FIELD_LABEL}>{label}</span>
      <select {...rest} className={`${FIELD_CONTROL} appearance-none truncate ${dense ? 'pr-5' : 'pr-7'}`}>{children}</select>
      <Icon name="expand" className={`pointer-events-none absolute bottom-3 size-5 text-on-surface-variant ${dense ? 'right-1' : 'right-3'}`} />
    </label>
  );
}

export function TextField({ label, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`${FIELD} px-4 ${className}`}>
      <span className={FIELD_LABEL}>{label}</span>
      <input {...rest} className={FIELD_CONTROL} />
    </label>
  );
}

/** Filled integer field (see IntInput for the mobile-keyboard behaviour). */
export function NumberField({ label, className = '', dense, ...rest }: { label: string; className?: string; dense?: boolean; value: number; min: number; max: number; onChange: (n: number) => void; 'aria-label'?: string }) {
  return (
    <label className={`${FIELD} ${px(dense)} ${className}`}>
      <span className={FIELD_LABEL}>{label}</span>
      <IntInput {...rest} className={`${FIELD_CONTROL} tabular-nums`} />
    </label>
  );
}

export function SearchBar({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="flex h-14 items-center gap-1 rounded-full bg-surface-container-high pl-4 pr-2 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-secondary">
      <Icon name="search" className="size-6 text-on-surface-variant" />
      <input
        type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-body-large outline-none placeholder:text-on-surface-variant focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && <IconButton icon="close" label="Clear search" onClick={() => onChange('')} />}
    </div>
  );
}

/** List item with a leading checkbox; the whole row is the 56dp touch target. */
export function CheckRow({ checked, onChange, headline, supporting, trailing, disabled, accent }: {accent?: string;  checked: boolean; onChange: (v: boolean) => void; headline: ReactNode; supporting?: ReactNode; trailing?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`state-layer flex min-h-14 cursor-pointer items-center gap-4 border-l-4 px-4 py-2 ${disabled ? 'cursor-not-allowed' : ''}`} style={{ borderLeftColor: accent ?? 'transparent' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1">
        <span className="block text-body-large">{headline}</span>
        {supporting && <span className="block text-body-medium text-on-surface-variant">{supporting}</span>}
      </span>
      {trailing}
    </label>
  );
}

export function SwitchRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="state-layer flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-md px-4 py-2">
      <span className="text-body-large">{children}</span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="overlay peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" />
        <span className="h-8 w-[52px] rounded-full border-2 border-outline bg-surface-container-highest transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary" />
        <span className="pointer-events-none absolute top-2 left-2 size-4 rounded-full bg-outline transition-all peer-checked:top-1 peer-checked:left-[24px] peer-checked:size-6 peer-checked:bg-on-primary" />
      </span>
    </label>
  );
}

// ---- data --------------------------------------------------------------------------------------------------

export function Bar({ value, max, color = 'var(--md-primary)' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-surface-container-highest">
      <div className="h-2 rounded-full" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

/** One bar whose length is `total / max` of the track, split into coloured parts. */
export function StackedBar({ parts, max }: { parts: Array<{ value: number; color: string; label: string }>; max: number }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="h-3 w-full rounded-full bg-surface-container-highest" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.value)}`).join(', ')}>
      <div className="flex h-3 gap-px overflow-hidden rounded-full" style={{ width: `${max > 0 ? Math.min(100, (total / max) * 100) : 0}%` }}>
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.label} style={{ flexGrow: p.value, background: p.color }} />)}
      </div>
    </div>
  );
}

/** Wide data table; scrolls sideways inside its card instead of stretching the page. */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-outline-variant">
      <table className="w-full min-w-max border-collapse text-body-medium">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low text-left text-label-large text-on-surface-variant">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-outline-variant [&>tr:last-child]:border-b-0 [&_td]:px-3 [&_td]:py-2">{children}</tbody>
      </table>
    </div>
  );
}
