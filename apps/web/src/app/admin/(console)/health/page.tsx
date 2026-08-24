'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { adminApi } from '@/lib/api/admin-client';
import { cn } from '@/lib/utils';
import { Card, CardHeader, Metric } from '@/components/admin/admin-ui';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

export default function AdminHealthPage() {
  const health = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: adminApi.health,
    refetchInterval: 15_000,
  });

  if (health.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (health.isError || !health.data) {
    return (
      <LoadError
        title="Couldn't reach the API"
        error={health.error}
        onRetry={() => void health.refetch()}
      />
    );
  }

  const { services, counters, nodeVersion, environment } = health.data;
  const allUp = services.every((s) => s.status === 'up');

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">System health</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Live dependency status, refreshed every 15 seconds.
        </p>
      </div>

      <div
        className={cn(
          'mb-6 flex items-center gap-3 rounded-lg border px-4 py-3',
          allUp ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50',
        )}
      >
        {allUp ? (
          <CheckCircle2 className="size-5 text-emerald-700" />
        ) : (
          <XCircle className="size-5 text-red-600" />
        )}
        <p className={cn('text-sm font-medium', allUp ? 'text-emerald-900' : 'text-red-900')}>
          {allUp ? 'All systems operational' : 'One or more dependencies are down'}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader title="Services" />
        <ul className="divide-y divide-slate-50">
          {services.map((s) => (
            <li key={s.name} className="flex items-center gap-3 px-5 py-3.5">
              <span
                className={cn(
                  'size-2 rounded-full',
                  s.status === 'up' ? 'bg-emerald-500' : 'bg-red-500',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{s.name}</p>
                <p className="text-[12.5px] text-slate-500">{s.detail}</p>
              </div>
              <span
                className={cn(
                  'font-mono text-[11px] tracking-wider uppercase',
                  s.status === 'up' ? 'text-emerald-700' : 'text-red-600',
                )}
              >
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">
        Platform counters
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Businesses" value={counters.businesses} />
        <Metric label="Customers" value={counters.customers} />
        <Metric label="Stamps" value={counters.stamps} />
        <Metric label="Redemptions" value={counters.redemptions} />
        <Metric label="Audit entries" value={counters.auditEntries} />
      </div>

      <Card>
        <CardHeader title="Runtime" />
        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">
              Environment
            </dt>
            <dd className="mt-0.5 text-sm text-slate-900">{environment}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">
              Node version
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-slate-900">{nodeVersion}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
