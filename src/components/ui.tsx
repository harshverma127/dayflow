import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BADGE } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:opacity-90 shadow-sm',
  secondary: 'bg-surface-raised text-content border hover:bg-surface-muted',
  ghost: 'text-content-muted hover:bg-surface-raised hover:text-content',
  outline: 'border text-content hover:bg-surface-raised',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  subtle: 'bg-surface-raised text-content-muted hover:text-content',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
  'icon-sm': 'h-7 w-7 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card / sections
// ---------------------------------------------------------------------------

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b px-4 py-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-content-faint">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-content">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-content-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">{title}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export function Badge({ tone = 'slate', children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        TONE_BADGE[tone] ?? TONE_BADGE.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function ProgressBar({ value, color, className, size = 'md' }: { value: number; color?: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-2.5' : 'h-2';
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-inset ring-border', h, className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color ?? 'rgb(var(--accent-sage))' }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  color,
  label,
  sublabel,
  emptyLabel = 'No content yet',
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
  sublabel?: ReactNode;
  /** Shown when value is 0 instead of a meaningless 0% ring */
  emptyLabel?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={color ?? 'rgb(var(--accent-sage))'}
            strokeDasharray={`${dash} ${c - dash}`}
            className="transition-all duration-700"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label !== undefined ? (
          <span className="text-base font-semibold tabular-nums">{label}</span>
        ) : clamped > 0 ? (
          <span className="text-base font-semibold tabular-nums">{Math.round(clamped)}%</span>
        ) : (
          <span className="text-base font-semibold tabular-nums text-content-faint">{emptyLabel}</span>
        )}
        {sublabel && <span className="text-[10px] text-content-faint">{sublabel}</span>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
  onClick,
  progress,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: string;
  onClick?: () => void;
  progress?: number;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp        onClick={onClick}
        className={cn(
          'card group flex flex-col gap-2 p-3.5 text-left transition-colors sm:p-4',
          onClick && 'hover:border-content/25',
        )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-content-muted">{label}</span>
        {icon &&        <span className={cn('text-content-faint', onClick && 'transition-colors group-hover:text-content-muted')}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums sm:text-2xl" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
      </div>
      {progress !== undefined && <ProgressBar value={progress} size="sm" />}
      {hint && <span className="text-[11px] leading-tight text-content-faint">{hint}</span>}
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export function Field({ label, hint, error, children, className }: { label?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="label-base">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-content-faint">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input-base', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input-base min-h-[80px] resize-y', className)} {...rest} />;
}

export function Select({ className, children, ariaLabel, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { ariaLabel?: string }) {
  return (
    <select className={cn('input-base cursor-pointer appearance-none bg-[length:0] pr-8', className)} aria-label={ariaLabel} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={cn(
          'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-brand bg-brand text-brand-fg' : 'border-border bg-surface hover:border-brand/60',
        )}
        style={{ height: 18, width: 18 }}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-lg border bg-surface-muted p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[]; className?: string }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b no-scrollbar', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.value ? 'border-brand text-content' : 'border-transparent text-content-muted hover:text-content',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-content-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal / Drawer / Confirm
// ---------------------------------------------------------------------------

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, active]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(onClose, open);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => {
        const el = ref.current?.querySelector<HTMLElement>('input,textarea,select,button');
        el?.focus();
      }, 30);
      return () => {
        document.body.style.overflow = '';
        clearTimeout(t);
      };
    }
  }, [open]);
  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border bg-surface shadow-xl animate-slide-up sm:rounded-2xl',
          width,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, side = 'right' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; side?: 'left' | 'right' }) {
  useEscape(onClose, open);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute top-0 flex h-full w-[86%] max-w-sm flex-col border bg-surface shadow-xl',
          side === 'right' ? 'right-0 animate-slide-in-right' : 'left-0',
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  destructive = true,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-content-muted">{message}</p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Dropdown menu
// ---------------------------------------------------------------------------

export function Dropdown({ trigger, items, align = 'right' }: { trigger: ReactNode; items: { label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean }[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={cn('absolute z-30 mt-1 min-w-[170px] overflow-hidden rounded-lg border bg-surface py-1 shadow-lg animate-fade-in', align === 'right' ? 'right-0' : 'left-0')}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-muted', it.danger ? 'text-red-500' : 'text-content')}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SelectMenu<T extends string>({ value, onChange, options, className, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; ariaLabel?: string }) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as T)} className="input-base cursor-pointer appearance-none py-1.5 pr-8 text-xs">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip / misc
// ---------------------------------------------------------------------------

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-content px-2 py-1 text-[11px] font-medium text-surface shadow-lg group-hover/tt:block">
        {label}
      </span>
    </span>
  );
}

export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      {icon ? <div className="text-content-faint">{icon}</div> : <Info size={22} className="text-content-faint" />}
      <p className="text-sm font-medium text-content">{title}</p>
      {message && <p className="max-w-sm text-xs text-content-muted">{message}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand', className)} role="status" aria-label="Loading" />
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface ToastItem {
  id: string;
  message: string;
  tone?: 'default' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  push: (message: string, opts?: { tone?: ToastItem['tone']; action?: ToastItem['action'] }) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, opts?: { tone?: ToastItem['tone']; action?: ToastItem['action'] }) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, ...opts }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), opts?.action ? 7000 : 3200);
  }, []);
  const api = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-3 z-[60] flex w-[calc(100%-1.5rem)] max-w-xs flex-col gap-2 sm:bottom-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-center justify-between gap-3 rounded-lg border bg-surface px-3 py-2.5 text-sm shadow-lg animate-slide-up',
              t.tone === 'success' && 'border-green-500/40',
              t.tone === 'error' && 'border-red-500/40',
            )}
          >
            <span className="text-content">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  setItems((prev) => prev.filter((x) => x.id !== t.id));
                }}
                className="shrink-0 text-xs font-semibold text-brand hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function Stars({ value, onChange, size = 14 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label="Confidence">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          role={onChange ? 'radio' : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} of 5`}
          onClick={() => onChange?.(n)}
          className={cn('leading-none transition-colors', onChange && 'cursor-pointer hover:scale-110', n <= value ? 'text-amber-400' : 'text-content-faint/40')}
          style={{ fontSize: size }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-content-muted">{children}</kbd>;
}

export function StackedList({ children }: { children: ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-xl border bg-surface">{children}</div>;
}

export function ListRow({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm', onClick && 'hover:bg-surface-muted', className)}>
      {children}
    </Comp>
  );
}
