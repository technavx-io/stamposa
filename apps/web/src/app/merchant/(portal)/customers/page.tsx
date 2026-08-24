'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Gift, Search, Users } from 'lucide-react';
import { merchantApi } from '@/lib/api/endpoints';
import { useDebounced } from '@/lib/use-debounced';
import { formatPhone, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState, Panel, Spinner } from '@/components/ui/surface';
import { ProgressPill } from '@/components/progress-pill';
import { LoadError } from '@/components/ui/load-error';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const customers = useQuery({
    queryKey: ['merchant', 'customers', debouncedSearch, page],
    queryFn: () => merchantApi.listCustomers({ search: debouncedSearch, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });

  const data = customers.data;

  return (
    <>
      <PageHeader
        title="Customers"
        description={data ? `${data.total} enrolled customer${data.total === 1 ? '' : 's'}` : ' '}
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or code…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Panel>
        {customers.isPending ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : customers.isError ? (
          <LoadError className="border-0" error={customers.error} onRetry={() => void customers.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={debouncedSearch ? 'No customers match' : 'No customers yet'}
            description={
              debouncedSearch
                ? 'Try a different name, phone number or customer code.'
                : 'Share your QR code — customers appear here the moment they join.'
            }
            action={
              !debouncedSearch && (
                <Link href="/merchant/qr" className="text-sm font-medium text-brand-600">
                  View QR code →
                </Link>
              )
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-xs text-muted uppercase tracking-wide">
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Code</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    <th className="px-5 py-3 font-medium">Rewards</th>
                    <th className="px-5 py-3 font-medium">Last stamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {data.items.map((m) => (
                    <tr key={m.id} className="group relative transition-colors hover:bg-canvas">
                      <td className="px-5 py-3">
                        <Link href={`/merchant/customers/${m.id}`} className="font-medium text-strong after:absolute after:inset-0">
                          {m.customer.name ?? 'Unnamed'}
                        </Link>
                        <p className="text-xs text-muted">{formatPhone(m.customer.phone)}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-[13px] text-muted">{m.formattedCode}</td>
                      <td className="px-5 py-3">
                        <ProgressPill current={m.stampCount} total={m.stampsRequired} />
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-body">
                          <Gift className="size-3.5 text-amber-500" /> {m.completedCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {m.lastStampAt ? timeAgo(m.lastStampAt) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line-soft md:hidden">
              {data.items.map((m) => (
                <li key={m.id}>
                  <Link href={`/merchant/customers/${m.id}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-strong">{m.customer.name ?? 'Unnamed'}</p>
                      <p className="text-xs text-muted">
                        {formatPhone(m.customer.phone)} · {m.formattedCode}
                      </p>
                    </div>
                    <ProgressPill current={m.stampCount} total={m.stampsRequired} />
                  </Link>
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-sm text-muted">
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
      </Panel>
    </>
  );
}
