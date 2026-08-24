import { cn } from '@/lib/utils';

/** The standard white panel used across every portal. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line/80 bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-strong">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  tone = 'zinc',
  children,
  className,
}: {
  tone?: 'zinc' | 'green' | 'amber' | 'red' | 'brand';
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    zinc: 'bg-surface-2 text-body',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-5 animate-spin rounded-full border-2 border-line border-t-zinc-700',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Full-viewport loading state used while a portal session boots. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas">
      <Spinner className="size-7" />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && (
        <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-strong">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
