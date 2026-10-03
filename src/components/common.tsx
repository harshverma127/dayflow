import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui';

export function PageHeader({ title, description, actions, meta }: { title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-content-muted">{description}</p>}
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function MetricBar({ label, value, color, right, sub }: { label: ReactNode; value: number; color?: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-content">{label}</span>
        <span className="shrink-0 tabular-nums text-content-muted">{right ?? `${Math.round(value)}%`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color ?? 'rgb(var(--brand))' }} />
      </div>
      {sub && <div className="text-[11px] text-content-faint">{sub}</div>}
    </div>
  );
}

const BLOCKS = 10;

export function BlockBar({ value, className }: { value: number; className?: string }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * BLOCKS);
  return (
    <span className={cn('font-mono text-sm leading-none tracking-tight', className)} aria-label={`${Math.round(value)}%`}>
      <span className="text-brand">{'█'.repeat(filled)}</span>
      <span className="text-content-faint/40">{'░'.repeat(BLOCKS - filled)}</span>
    </span>
  );
}

export function ReadinessRow({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs font-medium text-content-muted sm:w-36">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <BlockBar value={value} />
      <span className="ml-auto shrink-0 text-xs tabular-nums text-content-faint">{Math.round(value)}%</span>
    </div>
  );
}

export function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-content">{label}</div>
        {description && <div className="text-xs text-content-muted">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-surface-muted ring-1 ring-inset ring-border')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function CheckRow({ label, checked, onChange, right, sub }: { label: ReactNode; checked: boolean; onChange: () => void; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Checkbox checked={checked} onChange={onChange} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm', checked && 'text-content-muted line-through')}>{label}</div>
        {sub && <div className="text-[11px] text-content-faint">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
