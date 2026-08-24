'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Lock, Search } from 'lucide-react';
import { adminApi } from '@/lib/api/admin-client';
import { useDebounced } from '@/lib/use-debounced';
import { formatDateTime } from '@/lib/utils';
import { Card, EmptyRow, Pill, formatAction } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const actorTones = {
  ADMIN: 'indigo',
  MERCHANT: 'slate',
  STAFF: 'slate',
  SYSTEM: 'amber',
} as const;

export default function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);

  const actions = useQuery({ queryKey: ['admin', 'audit', 'actions'], queryFn: adminApi.auditActions });
  const audit = useQuery({
    queryKey: ['admin', 'audit', action, debounced, page],
    queryFn: () => adminApi.audit({ action, search: debounced, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });

  const data = audit.data;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Audit log</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
          <Lock className="size-3.5" />
          Append-only. Entries cannot be edited or deleted by anyone, including super admins.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
        >
          <option value="">All actions</option>
          {(actions.data ?? []).map((a) => (
            <option key={a} value={a}>
              {formatAction(a)}
            </option>
          ))}
        </select>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm placeholder:text-slate-500 focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
            placeholder="Who, what, or why…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {data && (
          <span className="font-mono text-[12px] text-slate-500 tabular-nums">
            {data.total.toLocaleString('en-IN')} entries
          </span>
        )}
      </div>

      <Card>
        {audit.isPending ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : audit.isError ? (
          <LoadError className="border-0" error={audit.error} onRetry={() => void audit.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRow>No entries match those filters.</EmptyRow>
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {data.items.map((e) => (
                <li key={e.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{formatAction(e.action)}</span>
                    <Pill tone={actorTones[e.actorType]}>{e.actorType.toLowerCase()}</Pill>
                    {e.businessName && (
                      <Link
                        href={e.businessId ? `/admin/merchants/${e.businessId}` : '#'}
                        className="text-[12.5px] text-indigo-600 hover:underline"
                      >
                        {e.businessName}
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    <span className="text-slate-700">{e.actorLabel}</span>
                    {e.targetLabel && <> → {e.targetLabel}</>} · {formatDateTime(e.createdAt)}
                    {e.ipAddress && <span className="font-mono text-slate-500"> · {e.ipAddress}</span>}
                  </p>
                  {e.reason && (
                    <p className="mt-1.5 border-l-2 border-slate-200 pl-2.5 text-[12.5px] text-slate-600">
                      {e.reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[13px] text-slate-500">
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="size-4" /> Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
