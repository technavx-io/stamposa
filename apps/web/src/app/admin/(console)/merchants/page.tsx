'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { adminApi } from '@/lib/api/admin-client';
import type { MerchantFilter } from '@/lib/api/admin-types';
import { useDebounced } from '@/lib/use-debounced';
import { cn, formatPhone, timeAgo } from '@/lib/utils';
import { Card, EmptyRow, HealthBadge, Pill } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const filters: { key: MerchantFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'silent', label: 'Gone quiet' },
  { key: 'no-campaign', label: 'Setup stalled' },
  { key: 'suspended', label: 'Suspended' },
];

function MerchantsView() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<MerchantFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);

  // The dashboard's attention queue links here with a filter pre-applied.
  useEffect(() => {
    const f = params.get('filter');
    if (f && filters.some((x) => x.key === f)) setFilter(f as MerchantFilter);
  }, [params]);

  const merchants = useQuery({
    queryKey: ['admin', 'merchants', filter, debounced, page],
    queryFn: () => adminApi.merchants({ filter, search: debounced, page, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const data = merchants.data;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Merchants</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {data ? `${data.total} tenant${data.total === 1 ? '' : 's'}` : 'Every business on the platform'}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="scrollbar-none -mx-1 flex max-w-full overflow-x-auto px-1 sm:mx-0 sm:px-0">
          <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                  filter === f.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
            placeholder="Business, owner or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Card>
        {merchants.isPending ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : merchants.isError ? (
          <LoadError className="border-0" error={merchants.error} onRetry={() => void merchants.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRow>
            {debounced ? 'No merchants match that search.' : 'No merchants in this view.'}
          </EmptyRow>
        ) : (
          <>
            {/* Phones get card rows — the table's key columns would hide
                behind a horizontal scroll at this width. */}
            <ul className="divide-y divide-slate-50 md:hidden">
              {data.items.map((m) => (
                <li key={m.id} className="relative px-4 py-3 transition-colors active:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/admin/merchants/${m.id}`}
                          className="truncate font-medium text-slate-900 after:absolute after:inset-0"
                        >
                          {m.name}
                        </Link>
                        <HealthBadge grade={m.health} title={m.healthReason} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-slate-500">
                        {m.ownerName}{m.ownerPhone ? ` · ${formatPhone(m.ownerPhone)}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                        {m.suspended ? (
                          <Pill tone="red">Suspended</Pill>
                        ) : m.campaignName ? (
                          <span className="max-w-40 truncate">{m.campaignName}</span>
                        ) : (
                          <Pill tone="slate">No programme</Pill>
                        )}
                        {m.campaignStatus === 'PAUSED' && !m.suspended && (
                          <Pill tone="amber">Paused</Pill>
                        )}
                        <span className="tabular-nums">{m.customers} customers</span>
                        <span className="tabular-nums">{m.stamps7d} stamps 7d</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">
                    <th className="px-5 py-2.5 font-medium">Business</th>
                    <th className="px-3 py-2.5 font-medium">Programme</th>
                    <th className="px-3 py-2.5 font-medium">Customers</th>
                    <th className="px-3 py-2.5 font-medium">Stamps 7d</th>
                    <th className="px-3 py-2.5 font-medium">Health</th>
                    <th className="px-5 py-2.5 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items.map((m) => (
                    <tr key={m.id} className="group relative transition-colors hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                            <Building2 className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/merchants/${m.id}`}
                              className="font-medium text-slate-900 after:absolute after:inset-0"
                            >
                              {m.name}
                            </Link>
                            <p className="truncate text-[11.5px] text-slate-500">
                              {m.ownerName}{m.ownerPhone ? ` · ${formatPhone(m.ownerPhone)}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {m.suspended ? (
                          <Pill tone="red">Suspended</Pill>
                        ) : m.campaignName ? (
                          <div className="flex items-center gap-2">
                            <span className="max-w-40 truncate text-slate-700">{m.campaignName}</span>
                            {m.campaignStatus === 'PAUSED' && <Pill tone="amber">Paused</Pill>}
                          </div>
                        ) : (
                          <Pill tone="slate">No programme</Pill>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 tabular-nums">{m.customers}</td>
                      <td className="px-3 py-3 text-slate-600 tabular-nums">{m.stamps7d}</td>
                      <td className="px-3 py-3">
                        <HealthBadge grade={m.health} title={m.healthReason} />
                      </td>
                      <td className="px-5 py-3 text-[12.5px] whitespace-nowrap text-slate-500">
                        {timeAgo(m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

export default function AdminMerchantsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Spinner className="size-6" /></div>}>
      <MerchantsView />
    </Suspense>
  );
}
