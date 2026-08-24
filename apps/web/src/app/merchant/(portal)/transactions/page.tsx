'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Gift, Receipt, Search, Stamp, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { merchantApi } from '@/lib/api/endpoints';
import { downloadAuthenticated } from '@/lib/download';
import { useDebounced } from '@/lib/use-debounced';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, EmptyState, Panel, Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const typeFilters = [
  { key: '', label: 'All' },
  { key: 'STAFF', label: 'Staff' },
  { key: 'MERCHANT', label: 'Owner' },
  { key: 'ADJUSTMENT', label: 'Adjustments' },
];

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [issuerType, setIssuerType] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const debounced = useDebounced(search);

  const transactions = useQuery({
    queryKey: ['merchant', 'transactions', debounced, issuerType, page],
    queryFn: () =>
      merchantApi.transactions({
        search: debounced,
        issuerType: issuerType || undefined,
        page,
        limit: 25,
      }),
    placeholderData: keepPreviousData,
  });
  const totals = useQuery({
    queryKey: ['merchant', 'transactions', 'totals'],
    queryFn: merchantApi.transactionTotals,
  });

  const download = async () => {
    setDownloading(true);
    try {
      await downloadAuthenticated(merchantApi.exportPaths.transactions, 'transactions.csv');
      toast.success('Ledger downloaded');
    } catch {
      toast.error('Could not download the export.');
    } finally {
      setDownloading(false);
    }
  };

  const data = transactions.data;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every stamp and correction, newest first. This is the record of truth."
        action={
          <Button variant="secondary" loading={downloading} onClick={() => void download()}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      {totals.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Panel className="p-4">
            <p className="text-[13px] whitespace-nowrap text-muted">Entries</p>
            <p className="mt-1 text-2xl font-semibold text-strong tabular-nums">
              {totals.data.entries.toLocaleString('en-IN')}
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="text-[13px] whitespace-nowrap text-muted">Net stamps</p>
            <p className="mt-1 text-2xl font-semibold text-strong tabular-nums">
              {totals.data.netStamps.toLocaleString('en-IN')}
            </p>
          </Panel>
          <Panel className="col-span-2 p-4 sm:col-span-1">
            <p className="text-[13px] whitespace-nowrap text-muted">Adjustments</p>
            <p className="mt-1 text-2xl font-semibold text-strong tabular-nums">
              {totals.data.adjustments.toLocaleString('en-IN')}
            </p>
          </Panel>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setIssuerType(f.key);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                issuerType === f.key ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-body hover:bg-surface-2',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Customer name, phone or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Panel>
        {transactions.isPending ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : transactions.isError ? (
          <LoadError className="border-0" error={transactions.error} onRetry={() => void transactions.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-6" />}
            title={debounced || issuerType ? 'Nothing matches those filters' : 'No transactions yet'}
            description={
              debounced || issuerType
                ? 'Try a different search or filter.'
                : 'Stamps and corrections appear here as they happen.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line-soft">
              {data.items.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      t.issuerType === 'ADJUSTMENT'
                        ? t.delta > 0
                          ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300'
                          : 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300'
                        : t.completedCard
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
                    )}
                  >
                    {t.issuerType === 'ADJUSTMENT' ? (
                      <SlidersHorizontal className="size-3.5" />
                    ) : t.completedCard ? (
                      <Gift className="size-4" />
                    ) : (
                      <Stamp className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-strong">
                      <Link
                        href={`/merchant/customers/${t.membershipId}`}
                        className="font-medium hover:text-brand-600 hover:underline"
                      >
                        {t.customerName ?? t.customerCode}
                      </Link>
                      <span className="text-muted">
                        {t.issuerType === 'ADJUSTMENT'
                          ? ` — balance adjusted`
                          : t.completedCard
                            ? ' completed a card'
                            : ' collected a stamp'}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {t.issuerName} · {formatDateTime(t.createdAt)} ·{' '}
                      <span className="font-mono">{t.customerCode}</span>
                    </p>
                    {t.reason && (
                      <p className="mt-1 border-l-2 border-line pl-2 text-[12.5px] text-body">
                        {t.reason}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      t.delta > 0 ? 'text-emerald-700' : 'text-orange-600',
                    )}
                  >
                    {t.delta > 0 ? '+' : ''}
                    {t.delta}
                  </span>
                  {t.completedCard && <Badge tone="amber">Reward</Badge>}
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-sm text-muted">
                <span>
                  Page {data.page} of {data.totalPages} · {data.total.toLocaleString('en-IN')} entries
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
