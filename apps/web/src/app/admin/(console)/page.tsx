'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2 } from 'lucide-react';
import { adminApi } from '@/lib/api/admin-client';
import { timeAgo } from '@/lib/utils';
import {
  AttentionRow,
  Card,
  CardHeader,
  EmptyRow,
  Metric,
  Pill,
  formatAction,
} from '@/components/admin/admin-ui';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

export default function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
    refetchInterval: 30_000,
  });

  if (dashboard.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (dashboard.isError || !dashboard.data) {
    return (
      <LoadError
        title="Couldn't load the dashboard"
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const { stats, attention, recentSignups, recentActivity } = dashboard.data;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Platform overview</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          What needs a decision today, then the numbers.
        </p>
      </div>

      {/* The attention queue leads — this is the operator's working surface. */}
      <Card className="mb-6">
        <CardHeader
          title="Needs attention"
          description="Ranked by what costs money or trust if ignored"
        />
        <div className="divide-y divide-slate-100">
          {attention.map((item) => (
            <AttentionRow key={item.id} {...item} />
          ))}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Merchants"
          value={stats.merchants}
          hint={`${stats.activeMerchants} active this week`}
          href="/admin/merchants"
        />
        <Metric
          label="Stamps · 7 days"
          value={stats.stamps7d}
          trend={stats.stampsTrendPct}
          hint="vs prior week"
        />
        <Metric label="Customers" value={stats.customers} hint="across all tenants" />
        <Metric
          label="Rewards waiting"
          value={stats.pendingRewards}
          hint={`${stats.stampsToday} stamps today`}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Newest merchants"
            action={
              <Link
                href="/admin/merchants"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                All merchants <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {recentSignups.length === 0 ? (
            <EmptyRow>No merchants yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentSignups.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/merchants/${m.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{m.name}</p>
                      <p className="truncate font-mono text-[11.5px] text-slate-500">/{m.slug}</p>
                    </div>
                    {m.suspended && <Pill tone="red">Suspended</Pill>}
                    <span className="text-[12px] whitespace-nowrap text-slate-500">
                      {timeAgo(m.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent platform activity"
            action={
              <Link
                href="/admin/audit"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                Audit log <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {recentActivity.length === 0 ? (
            <EmptyRow>Nothing logged yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentActivity.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{formatAction(a.action)}</span>
                    {a.targetLabel && <span className="text-slate-500"> · {a.targetLabel}</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {a.actorLabel} · {timeAgo(a.createdAt)}
                    {a.reason && <span className="text-slate-500"> — {a.reason}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="New this month" value={stats.newMerchants30d} hint="merchant signups" />
        <Metric label="Suspended" value={stats.suspendedMerchants} hint="blocked tenants" />
        <Metric label="Stamps all-time" value={stats.stampsTotal} />
        <Metric label="Stamps today" value={stats.stampsToday} />
      </div>
    </>
  );
}
