import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AttentionSeverity, HealthGrade } from '@/lib/api/admin-types';

/** Console panel — flatter and denser than the merchant portal's cards. */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Metric tile. Numbers are tabular so columns of figures line up. */
export function Metric({
  label,
  value,
  hint,
  trend,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  trend?: number;
  href?: string;
}) {
  const body = (
    <Card className={cn('p-4', href && 'transition-colors hover:border-slate-300')}>
      <p className="font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {trend !== undefined && trend !== 0 && (
          <span
            className={cn(
              'font-mono text-[11px] font-medium tabular-nums',
              trend > 0 ? 'text-emerald-700' : 'text-red-600',
            )}
          >
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-[11.5px] text-slate-500">{hint}</span>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** A–D tenant health, colour-coded so a list scans at a glance. */
export function HealthBadge({ grade, title }: { grade: HealthGrade; title?: string }) {
  const styles: Record<HealthGrade, string> = {
    A: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    B: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    C: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    D: 'bg-red-50 text-red-700 ring-red-600/20',
  };
  return (
    <span
      title={title}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded font-mono text-xs font-semibold ring-1 ring-inset',
        styles[grade],
      )}
    >
      {grade}
    </span>
  );
}

export function Pill({
  tone = 'slate',
  children,
}: {
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'indigo';
  children: React.ReactNode;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Attention queue row — severity is encoded in a left stripe, not just colour. */
export function AttentionRow({
  severity,
  title,
  detail,
  href,
  count,
}: {
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
  count?: number;
}) {
  const stripe = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-emerald-500',
  }[severity];

  return (
    <Link
      href={href}
      className="group relative flex items-start gap-4 py-3.5 pr-4 pl-5 transition-colors hover:bg-slate-50"
    >
      <span className={cn('absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-r', stripe)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{detail}</p>
      </div>
      {count !== undefined && (
        <span className="font-mono text-lg font-semibold text-slate-300 tabular-nums group-hover:text-slate-500">
          {count}
        </span>
      )}
    </Link>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-slate-500">{children}</div>;
}

/** Turns "merchant.suspended" into "Merchant suspended" for display. */
export function formatAction(action: string): string {
  const text = action.replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
