'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';
import { adminApi } from '@/lib/api/admin-client';
import type { FeedbackAuthorType, FeedbackCategory, FeedbackStatus } from '@/lib/api/admin-types';
import { useDebounced } from '@/lib/use-debounced';
import { formatDateTime } from '@/lib/utils';
import { Card, EmptyRow, Pill } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';
import { cn } from '@/lib/utils';

const authorTones: Record<FeedbackAuthorType, 'slate' | 'indigo' | 'green'> = {
  MERCHANT: 'indigo',
  STAFF: 'slate',
  CUSTOMER: 'green',
};

const categoryLabels: Record<FeedbackCategory, string> = {
  BUG: 'Bug',
  SUGGESTION: 'Suggestion',
  PRAISE: 'Praise',
  OTHER: 'Other',
};

const categoryTones: Record<FeedbackCategory, 'slate' | 'green' | 'amber' | 'red' | 'indigo'> = {
  BUG: 'red',
  SUGGESTION: 'amber',
  PRAISE: 'green',
  OTHER: 'slate',
};

const statusTabs: { value: FeedbackStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const statusTones: Record<FeedbackStatus, 'slate' | 'amber' | 'green'> = {
  NEW: 'amber',
  REVIEWED: 'slate',
  RESOLVED: 'green',
};

export default function AdminFeedbackPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FeedbackStatus | ''>('');
  const [authorType, setAuthorType] = useState<FeedbackAuthorType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);

  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: adminApi.me });
  const canManage = me.data?.capabilities.includes('feedback.manage') ?? false;

  const counts = useQuery({ queryKey: ['admin', 'feedback', 'counts'], queryFn: adminApi.feedbackCounts });
  const feedback = useQuery({
    queryKey: ['admin', 'feedback', status, authorType, debounced, page],
    queryFn: () =>
      adminApi.feedback({
        status: status || undefined,
        authorType: authorType || undefined,
        search: debounced,
        page,
        limit: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const mutate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: FeedbackStatus }) =>
      adminApi.setFeedbackStatus(id, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] });
    },
  });

  const data = feedback.data;
  const countFor = (s: FeedbackStatus | '') =>
    s === '' ? undefined : counts.data?.[s];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Feedback</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          What merchants, staff and customers are telling us — across every business.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {statusTabs.map((t) => {
            const active = status === t.value;
            const c = countFor(t.value);
            return (
              <button
                key={t.value || 'all'}
                onClick={() => {
                  setStatus(t.value);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {t.label}
                {c !== undefined && c > 0 && (
                  <span className={cn('ml-1.5 tabular-nums', active ? 'text-slate-300' : 'text-slate-400')}>
                    {c}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <select
          value={authorType}
          onChange={(e) => {
            setAuthorType(e.target.value as FeedbackAuthorType | '');
            setPage(1);
          }}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
        >
          <option value="">Everyone</option>
          <option value="MERCHANT">Merchants</option>
          <option value="STAFF">Staff</option>
          <option value="CUSTOMER">Customers</option>
        </select>

        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm placeholder:text-slate-500 focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
            placeholder="Who, which business, or words…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {data && (
          <span className="font-mono text-[12px] text-slate-500 tabular-nums">
            {data.total.toLocaleString('en-IN')} total
          </span>
        )}
      </div>

      <Card>
        {feedback.isPending ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : feedback.isError ? (
          <LoadError className="border-0" error={feedback.error} onRetry={() => void feedback.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyRow>No feedback matches those filters.</EmptyRow>
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {data.items.map((f) => (
                <li key={f.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{f.authorLabel}</span>
                    <Pill tone={authorTones[f.authorType]}>{f.authorType.toLowerCase()}</Pill>
                    <Pill tone={categoryTones[f.category]}>{categoryLabels[f.category]}</Pill>
                    {f.rating != null && (
                      <span className="flex items-center gap-0.5" title={`${f.rating} of 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'size-3.5',
                              i < f.rating! ? 'fill-amber-400 text-amber-400' : 'text-slate-200',
                            )}
                          />
                        ))}
                      </span>
                    )}
                    <Pill tone={statusTones[f.status]}>{f.status.toLowerCase()}</Pill>
                    {f.businessName && (
                      <Link
                        href={f.businessId ? `/admin/merchants/${f.businessId}` : '#'}
                        className="text-[12.5px] text-indigo-600 hover:underline"
                      >
                        {f.businessName}
                      </Link>
                    )}
                  </div>

                  <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{f.message}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                    <span>{formatDateTime(f.createdAt)}</span>
                    {f.handledByName && f.handledAt && (
                      <span className="text-slate-400">
                        · {f.status.toLowerCase()} by {f.handledByName}
                      </span>
                    )}
                    {canManage && (
                      <span className="ml-auto flex gap-1.5">
                        {f.status !== 'REVIEWED' && f.status !== 'RESOLVED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={mutate.isPending}
                            onClick={() => mutate.mutate({ id: f.id, next: 'REVIEWED' })}
                          >
                            Mark reviewed
                          </Button>
                        )}
                        {f.status !== 'RESOLVED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={mutate.isPending}
                            onClick={() => mutate.mutate({ id: f.id, next: 'RESOLVED' })}
                          >
                            Resolve
                          </Button>
                        )}
                        {f.status === 'RESOLVED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={mutate.isPending}
                            onClick={() => mutate.mutate({ id: f.id, next: 'NEW' })}
                          >
                            Reopen
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
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
