'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ChevronLeft, ChevronRight, Gift, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import type { RedemptionRow, RedemptionStatus } from '@/lib/api/types';
import { useDebounced } from '@/lib/use-debounced';
import { cn, formatDateTime, formatPhone, timeAgo } from '@stamposa/ui/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@stamposa/ui/components/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Badge, EmptyState, Panel, Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

type Filter = 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'ALL';

const filters: { key: Filter; label: string }[] = [
  { key: 'PENDING', label: 'Waiting' },
  { key: 'REDEEMED', label: 'Handed over' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'ALL', label: 'All' },
];

export default function RewardsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<RedemptionRow | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const debouncedSearch = useDebounced(search);

  // Audience count — how many reward-holders can we actually reach right now.
  const audience = useQuery({
    queryKey: ['merchant', 'broadcast-audience'],
    queryFn: merchantApi.broadcastAudience,
  });

  const rewards = useQuery({
    queryKey: ['merchant', 'redemptions', filter, debouncedSearch, page],
    queryFn: () =>
      merchantApi.listRedemptions({
        status: filter === 'ALL' ? undefined : (filter as RedemptionStatus),
        search: debouncedSearch,
        page,
        limit: 15,
      }),
    placeholderData: keepPreviousData,
  });

  const redeem = useMutation({
    mutationFn: (redemptionId: string) => merchantApi.redeemAsOwner({ redemptionId }),
    onSuccess: async (result) => {
      setConfirming(null);
      toast.success(`Marked as handed over: ${result.redemption.rewardText}`);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => {
      setConfirming(null);
      toast.error(e instanceof ApiError ? e.message : 'Could not update the reward.');
    },
  });

  const data = rewards.data;

  return (
    <>
      <PageHeader
        title="Rewards"
        description="Every reward your customers have earned, and whether it has been handed over."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.key ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-body hover:bg-surface-2',
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
            placeholder="Name, phone or voucher code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button
          variant="secondary"
          className="ml-auto"
          onClick={() => setRemindOpen(true)}
          disabled={audience.isPending || !audience.data || audience.data.rewardHolders === 0}
        >
          <Bell className="size-4" /> Remind reward-holders
          {audience.data && audience.data.rewardHolders > 0 && (
            <span className="ml-1 text-muted">({audience.data.rewardHolders})</span>
          )}
        </Button>
      </div>

      <Panel>
        {rewards.isPending ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : rewards.isError ? (
          <LoadError className="border-0" error={rewards.error} onRetry={() => void rewards.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Gift className="size-6" />}
            title={
              filter === 'PENDING'
                ? 'No rewards waiting'
                : filter === 'REDEEMED'
                  ? 'Nothing handed over yet'
                  : 'No rewards yet'
            }
            description={
              filter === 'PENDING'
                ? 'When a customer completes a card, the reward appears here until your staff hand it over.'
                : 'Rewards show up here once customers complete their cards.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line-soft">
              {data.items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      r.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        : r.status === 'VOID' || r.status === 'EXPIRED'
                          ? 'bg-surface-2 text-muted'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                    )}
                  >
                    {r.status === 'PENDING' ? <Gift className="size-4" /> : <Check className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-strong">{r.rewardText}</p>
                    <p className="truncate text-xs text-muted">
                      <Link
                        href={`/merchant/customers/${r.membershipId}`}
                        className="hover:text-body hover:underline"
                      >
                        {r.customer.name ?? 'Unnamed'}
                      </Link>{' '}
                      · {formatPhone(r.customer.phone)} ·{' '}
                      <span className="font-mono">{r.formattedCode}</span>
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted">
                    {r.status === 'PENDING' ? (
                      <>
                        earned {timeAgo(r.earnedAt)}
                        {r.expiresAt && (
                          <>
                            <br />
                            <span className="text-amber-600 dark:text-amber-400">
                              expires {formatDateTime(r.expiresAt)}
                            </span>
                          </>
                        )}
                      </>
                    ) : r.status === 'VOID' ? (
                      <>voided {r.voidedAt ? timeAgo(r.voidedAt) : ''}</>
                    ) : r.status === 'EXPIRED' ? (
                      <>
                        earned {timeAgo(r.earnedAt)}
                        {r.expiresAt && (
                          <>
                            <br />
                            expired {formatDateTime(r.expiresAt)}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        by {r.redeemedBy}
                        <br />
                        {r.redeemedAt ? formatDateTime(r.redeemedAt) : null}
                      </>
                    )}
                  </div>
                  {r.status === 'PENDING' ? (
                    <Button size="sm" variant="brand" onClick={() => setConfirming(r)}>
                      <Check className="size-4" /> Mark handed over
                    </Button>
                  ) : r.status === 'VOID' ? (
                    <Badge tone="zinc">Voided</Badge>
                  ) : r.status === 'EXPIRED' ? (
                    <Badge tone="zinc">Expired</Badge>
                  ) : (
                    <Badge tone="green">Handed over</Badge>
                  )}
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-sm text-muted">
                <span>
                  Page {data.page} of {data.totalPages} · {data.total} total
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

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Mark this reward as handed over?"
        description="Only confirm once the customer has received it — this is recorded permanently."
      >
        {confirming && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">{confirming.rewardText}</p>
              <p className="mt-1 text-sm text-amber-800">
                {confirming.customer.name ?? 'Customer'} · {formatPhone(confirming.customer.phone)}
              </p>
              <p className="mt-2 font-mono text-xs tracking-widest text-amber-700">
                Voucher {confirming.formattedCode}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button variant="brand" loading={redeem.isPending} onClick={() => redeem.mutate(confirming.id)}>
                <Check className="size-4" /> Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <RemindRewardHoldersModal
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        recipientCount={audience.data?.rewardHolders ?? 0}
        monthlyLimit={audience.data?.monthlyLimit ?? null}
        sentThisMonth={audience.data?.sentThisMonth ?? 0}
        onSent={() => {
          void queryClient.invalidateQueries({ queryKey: ['merchant', 'broadcast-audience'] });
        }}
      />
    </>
  );
}

/**
 * Push a wallet notification to just the customers with an unclaimed reward.
 * Uses the same /messaging/broadcasts endpoint as generic broadcasts but with
 * audience=REWARD_HOLDERS so only those members are pushed.
 */
function RemindRewardHoldersModal({
  open,
  onClose,
  recipientCount,
  monthlyLimit,
  sentThisMonth,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  recipientCount: number;
  monthlyLimit: number | null;
  sentThisMonth: number;
  onSent: () => void;
}) {
  const [title, setTitle] = useState('🎁 Your reward is waiting');
  const [body, setBody] = useState(
    'You have an unclaimed reward on your card — bring your Stamposa pass in on your next visit to redeem it.',
  );
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      merchantApi.sendBroadcast({
        title: title.trim(),
        body: body.trim(),
        audience: 'REWARD_HOLDERS',
      }),
    onSuccess: (res) => {
      toast.success(`Sent to ${res.recipientCount} reward-holder${res.recipientCount === 1 ? '' : 's'}.`);
      onSent();
      onClose();
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : 'Could not send the reminder.');
    },
  });

  const outOfQuota = monthlyLimit !== null && sentThisMonth >= monthlyLimit;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!send.isPending) onClose();
      }}
      title="Remind reward-holders"
      description={`Sends a wallet notification to the ${recipientCount} customer${recipientCount === 1 ? '' : 's'} with an unclaimed reward. Only counts against your monthly broadcast quota.`}
    >
      <div className="space-y-4">
        <Field label="Title" hint="Shown as the notification headline.">
          {(p) => (
            <Input
              {...p}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.slice(0, 60));
                if (error) setError(null);
              }}
              maxLength={60}
              placeholder="🎁 Your reward is waiting"
            />
          )}
        </Field>
        <Field
          label="Message"
          hint="Kept short — up to 160 characters (SMS length)."
          error={error ?? undefined}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={body}
              onChange={(e) => {
                setBody(e.target.value.slice(0, 160));
                if (error) setError(null);
              }}
              maxLength={160}
            />
          )}
        </Field>
        <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
          <span>
            {monthlyLimit === null
              ? 'Unlimited on your plan.'
              : `${Math.max(0, monthlyLimit - sentThisMonth)} broadcasts left this month.`}
          </span>
          <span>{body.length}/160</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            variant="brand"
            loading={send.isPending}
            disabled={outOfQuota || recipientCount === 0 || title.trim().length < 1 || body.trim().length < 1}
            onClick={() => send.mutate()}
          >
            <Bell className="size-4" />
            Send to {recipientCount}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
