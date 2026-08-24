'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Gift, Repeat, Stamp, TrendingDown, TrendingUp, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { merchantApi } from '@/lib/api/endpoints';
import type { MetricValue, RangeKey } from '@/lib/api/types';
import { downloadAuthenticated } from '@/lib/download';
import { cn, formatPhone, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { StampsChart } from '@/components/bar-chart';
import { Button } from '@/components/ui/button';
import { EmptyState, Panel, PanelHeader, Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const ranges: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const vsHint = `vs prev ${range.replace('d', ' days')}`;
  const [downloading, setDownloading] = useState(false);

  const summary = useQuery({
    queryKey: ['merchant', 'analytics', 'summary', range],
    queryFn: () => merchantApi.analyticsSummary(range),
    placeholderData: keepPreviousData,
  });
  const series = useQuery({
    queryKey: ['merchant', 'analytics', 'series', range],
    queryFn: () => merchantApi.analyticsSeries(range),
    placeholderData: keepPreviousData,
  });
  const top = useQuery({
    queryKey: ['merchant', 'analytics', 'top'],
    queryFn: merchantApi.topCustomers,
  });
  const staff = useQuery({
    queryKey: ['merchant', 'analytics', 'staff', range],
    queryFn: () => merchantApi.staffPerformance(range),
    placeholderData: keepPreviousData,
  });

  const download = async () => {
    setDownloading(true);
    try {
      await downloadAuthenticated(merchantApi.exportPaths.customers, 'customers.csv');
      toast.success('Customer list downloaded');
    } catch {
      toast.error('Could not download the export.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your loyalty programme is performing."
        action={
          <Button variant="secondary" loading={downloading} onClick={() => void download()}>
            <Download className="size-4" /> Export customers
          </Button>
        }
      />

      <div className="mb-5 inline-flex rounded-lg border border-line bg-surface p-0.5">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              range === r.key ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-body hover:bg-surface-2',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {summary.isPending ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-7" />
        </div>
      ) : summary.isError ? (
          <LoadError className="border-0" error={summary.error} onRetry={() => void summary.refetch()} />
        ) : !summary.data ? (
        <Panel>
          <EmptyState title="Couldn't load analytics" description="Refresh to try again." />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric icon={Stamp} label="Stamps" metric={summary.data.stats.stamps} hint={vsHint} />
            <Metric
              icon={UserPlus}
              label="New customers"
              metric={summary.data.stats.newCustomers}
              hint={vsHint}
            />
            <Metric
              icon={Gift}
              label="Rewards given"
              metric={summary.data.stats.rewardsRedeemed}
              hint={vsHint}
            />
            <Metric
              icon={Users}
              label="Active customers"
              metric={summary.data.stats.activeCustomers}
              hint="stamped in period"
            />
          </div>

          <Panel className="mt-6 p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-strong">Daily activity</h2>
            </div>
            {series.isError ? (
              <LoadError className="border-0" error={series.error} onRetry={() => void series.refetch()} />
            ) : series.isPending || !series.data ? (
              <div className="flex h-52 items-center justify-center">
                <Spinner className="size-6" />
              </div>
            ) : (
              <StampsChart data={series.data} />
            )}
          </Panel>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
            <Panel className="lg:col-span-1">
              <PanelHeader title="Loyalty health" />
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <Repeat className="size-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-semibold text-strong tabular-nums">
                      {summary.data.totals.repeatRatePct}%
                    </p>
                    <p className="text-[13px] text-muted">of customers have returned</p>
                  </div>
                </div>
                <dl className="space-y-2 border-t border-line-soft pt-4 text-sm">
                  <Row label="Total customers" value={summary.data.totals.customers} />
                  <Row label="Repeat customers" value={summary.data.totals.repeatCustomers} />
                  <Row label="Rewards waiting" value={summary.data.totals.pendingRewards} />
                </dl>
              </div>
            </Panel>

            <Panel className="lg:col-span-1">
              <PanelHeader title="Most loyal" description="By lifetime stamps" />
              {top.isPending ? (
                <div className="flex h-40 items-center justify-center"><Spinner className="size-5" /></div>
              ) : top.isError ? (
          <LoadError className="border-0" error={top.error} onRetry={() => void top.refetch()} />
        ) : !top.data || top.data.length === 0 ? (
                <EmptyState title="No stamps yet" />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {top.data.map((c, i) => (
                    <li key={c.membershipId}>
                      <Link
                        href={`/merchant/customers/${c.membershipId}`}
                        className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-canvas"
                      >
                        <span className="w-4 font-mono text-[11px] text-muted tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-strong">
                            {c.name ?? 'Unnamed'}
                          </p>
                          <p className="truncate text-[11.5px] text-muted">
                            {formatPhone(c.phone)}
                            {c.lastStampAt && ` · ${timeAgo(c.lastStampAt)}`}
                          </p>
                        </div>
                        <span className="text-[13px] font-medium text-body tabular-nums">
                          {c.totalStamps}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="lg:col-span-1">
              <PanelHeader title="Staff activity" description="Stamps issued this period" />
              {staff.isPending ? (
                <div className="flex h-40 items-center justify-center"><Spinner className="size-5" /></div>
              ) : staff.isError ? (
          <LoadError className="border-0" error={staff.error} onRetry={() => void staff.refetch()} />
        ) : !staff.data || staff.data.length === 0 ? (
                <EmptyState
                  title="No staff yet"
                  description="Add your team to see who's stamping."
                  action={
                    <Link href="/merchant/staff" className="text-sm font-medium text-brand-600">
                      Add staff →
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-3 p-5">
                  {staff.data.map((s) => {
                    const max = Math.max(1, ...staff.data.map((x) => x.stamps));
                    return (
                      <li key={s.id}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13.5px] text-body">
                            {s.name}
                            {!s.isActive && (
                              <span className="ml-1.5 text-[11px] text-muted">inactive</span>
                            )}
                          </span>
                          <span className="text-[13px] font-medium text-strong tabular-nums">
                            {s.stamps}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${(s.stamps / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  metric,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  metric: MetricValue;
  hint?: string;
}) {
  const up = (metric.change ?? 0) > 0;
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-muted">{label}</p>
        <Icon className="size-4 shrink-0 text-zinc-300" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-strong tabular-nums sm:text-3xl">
        {metric.value.toLocaleString('en-IN')}
      </p>
      {/* One line, never wraps: delta pill + truncating hint. */}
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] whitespace-nowrap">
        {metric.change !== null && metric.change !== 0 && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
              up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
            )}
          >
            {up ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : (
              <TrendingDown className="size-3" aria-hidden />
            )}
            <span className="sr-only">{up ? 'up' : 'down'} </span>
            {Math.abs(metric.change)}%
          </span>
        )}
        <span className="truncate text-muted">{hint ?? 'vs previous period'}</span>
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-strong tabular-nums">{value.toLocaleString('en-IN')}</dd>
    </div>
  );
}
