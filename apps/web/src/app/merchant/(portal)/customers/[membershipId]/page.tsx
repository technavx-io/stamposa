'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Check,
  Gift,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { formatDate, formatDateTime, formatPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Badge, EmptyState, Panel, PanelHeader, Spinner } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = use(params);
  const queryClient = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const detail = useQuery({
    queryKey: ['merchant', 'customer', membershipId],
    queryFn: () => merchantApi.customerDetail(membershipId),
  });
  const consents = useQuery({
    queryKey: ['merchant', 'customer', membershipId, 'consents'],
    queryFn: () => merchantApi.customerConsents(membershipId),
  });
  const history = useQuery({
    queryKey: ['merchant', 'customer', membershipId, 'stamps', historyPage],
    queryFn: () => merchantApi.customerStamps(membershipId, historyPage, 15),
    placeholderData: keepPreviousData,
  });

  const addStamp = useMutation({
    mutationFn: () => merchantApi.addStampAsOwner(membershipId),
    onSuccess: async (result) => {
      toast.success(
        result.rewardEarned ? `Card completed — reward unlocked: ${result.reward}!` : 'Stamp added',
      );
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not add the stamp.'),
  });

  const redeem = useMutation({
    mutationFn: (redemptionId: string) => merchantApi.redeemAsOwner({ redemptionId }),
    onSuccess: async (result) => {
      toast.success(`Handed over: ${result.redemption.rewardText}`);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not redeem the reward.'),
  });

  const saveProfile = useMutation({
    mutationFn: (data: { notes?: string; tags?: string[] }) =>
      merchantApi.updateCustomer(membershipId, data),
    onSuccess: async () => {
      toast.success('Saved');
      setNotesDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
  });

  const adjust = useMutation({
    mutationFn: () => merchantApi.adjustBalance(membershipId, Number(adjustDelta), adjustReason),
    onSuccess: async (result) => {
      toast.success(
        result.rewardEarned
          ? 'Balance adjusted — that completed a card and unlocked a reward'
          : 'Balance adjusted',
      );
      setAdjustOpen(false);
      setAdjustDelta('');
      setAdjustReason('');
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not adjust the balance.'),
  });

  const block = useMutation({
    mutationFn: (input: { blocked: boolean; reason?: string }) =>
      merchantApi.setBlocked(membershipId, input.blocked, input.reason),
    onSuccess: async (_r, input) => {
      toast.success(input.blocked ? 'Customer blocked' : 'Customer unblocked');
      setBlockOpen(false);
      setBlockReason('');
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update.'),
  });

  if (detail.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <EmptyState
        title="Customer not found"
        action={
          <Link href="/merchant/customers" className="text-sm font-medium text-brand-600">
            Back to customers
          </Link>
        }
      />
    );
  }

  const m = detail.data;

  return (
    <>
      <Link
        href="/merchant/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-strong"
      >
        <ArrowLeft className="size-4" /> All customers
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-strong">
            {m.customer.name ?? 'Unnamed customer'}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {formatPhone(m.customer.phone)} · <span className="font-mono">{m.formattedCode}</span> ·
            joined {formatDate(m.joinedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
            <SlidersHorizontal className="size-4" /> Adjust
          </Button>
          {m.blockedAt ? (
            <Button
              variant="secondary"
              loading={block.isPending}
              onClick={() => block.mutate({ blocked: false })}
            >
              Unblock
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setBlockOpen(true)}>
              <Ban className="size-4" /> Block
            </Button>
          )}
          <Button
            onClick={() => addStamp.mutate()}
            loading={addStamp.isPending}
            variant="brand"
            disabled={!!m.blockedAt}
          >
            <Plus className="size-4" /> Add stamp
          </Button>
        </div>
      </div>

      {m.blockedAt && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <Ban className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-[13px]">
            <p className="font-medium text-red-900">
              Blocked on {formatDate(m.blockedAt)} — cannot earn stamps
            </p>
            {m.blockedReason && <p className="mt-0.5 text-red-700">{m.blockedReason}</p>}
          </div>
        </div>
      )}

      {m.pendingRewards.length > 0 && (
        <Panel className="mb-6 border-amber-300 bg-amber-50/50">
          <PanelHeader
            title={`${m.pendingRewards.length} reward${m.pendingRewards.length === 1 ? '' : 's'} waiting`}
            description="Earned but not yet handed over."
          />
          <ul className="divide-y divide-amber-100">
            {m.pendingRewards.map((reward) => (
              <li key={reward.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Gift className="size-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-strong">{reward.rewardText}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{reward.formattedCode}</span> · earned{' '}
                    {formatDateTime(reward.earnedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="brand"
                  loading={redeem.isPending && redeem.variables === reward.id}
                  onClick={() => redeem.mutate(reward.id)}
                >
                  <Check className="size-4" /> Mark handed over
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelHeader title="Current card" description={m.campaign.name} />
          <div className="space-y-4 p-5">
            <StampGrid total={m.stampsRequired} filled={m.stampCount} />
            <p className="text-sm text-body">
              <span className="font-semibold text-strong">
                {m.stampsRequired - m.stampCount} more
              </span>{' '}
              to: {m.campaign.reward}
            </p>
            <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-strong tabular-nums">{m.totalStamps}</p>
                <p className="text-xs text-muted">Lifetime stamps</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-strong tabular-nums">{m.completedCount}</p>
                <p className="text-xs text-muted">Rewards earned</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Stamp history" />
          {history.isPending ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : !history.data || history.data.items.length === 0 ? (
            <EmptyState
              icon={<Stamp className="size-6" />}
              title="No stamps yet"
              description="Add the first stamp from here or the staff console."
            />
          ) : (
            <>
              <ul className="divide-y divide-line-soft">
                {history.data.items.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                        s.delta < 0 || s.issuerType === 'ADJUSTMENT'
                          ? 'bg-surface-2 text-muted'
                          : s.completedCard
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
                      }`}
                    >
                      {s.completedCard ? <Gift className="size-4" /> : <Stamp className="size-4" />}
                    </span>
                    <div className="flex-1 text-sm">
                      <p className="text-strong">
                        {s.issuerType === 'ADJUSTMENT'
                          ? `Adjustment (${s.delta > 0 ? '+' : ''}${s.delta})`
                          : s.delta < 0
                            ? 'Stamp taken back (undo)'
                            : s.completedCard
                              ? 'Stamp — completed the card 🎉'
                              : 'Stamp added'}
                      </p>
                      <p className="text-xs text-muted">
                        by {s.issuerName} · {formatDateTime(s.createdAt)}
                        {s.reason && <> · {s.reason}</>}
                      </p>
                    </div>
                    {s.completedCard && <Badge tone="amber">Reward earned</Badge>}
                  </li>
                ))}
              </ul>
              {history.data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-sm text-muted">
                  <span>
                    Page {history.data.page} of {history.data.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={historyPage >= history.data.totalPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Notes & tags" description="Private to your business" />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {m.tags.length === 0 && (
                <span className="text-[13px] text-muted">No tags yet</span>
              )}
              {m.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] text-body"
                >
                  <Tag className="size-3 text-muted" />
                  {tag}
                  <button
                    onClick={() =>
                      saveProfile.mutate({ tags: m.tags.filter((t) => t !== tag) })
                    }
                    className="ml-0.5 text-muted transition-colors hover:text-red-600"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const tag = tagInput.trim();
                if (!tag || m.tags.includes(tag)) return;
                saveProfile.mutate({ tags: [...m.tags, tag] });
                setTagInput('');
              }}
            >
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag, e.g. regular"
                maxLength={24}
                className="h-9"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={!tagInput.trim()}>
                Add
              </Button>
            </form>

            <div className="space-y-2 border-t border-line-soft pt-4">
              <Textarea
                rows={3}
                value={notesDraft ?? m.notes ?? ''}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Anything worth remembering about this customer…"
              />
              <Button
                size="sm"
                loading={saveProfile.isPending}
                disabled={notesDraft === null || notesDraft === (m.notes ?? '')}
                onClick={() => saveProfile.mutate({ notes: notesDraft ?? '' })}
              >
                Save notes
              </Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Consent" description="What they agreed to, and when" />
          {consents.isPending ? (
            <div className="flex h-32 items-center justify-center"><Spinner className="size-5" /></div>
          ) : !consents.data || consents.data.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="size-5" />}
              title="No consent recorded"
              description="This customer joined before consent capture was added."
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {consents.data.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-strong">
                    {c.granted ? (
                      <>
                        <Check className="size-3.5 text-emerald-700" /> Opted in to marketing
                      </>
                    ) : (
                      <>
                        <Ban className="size-3.5 text-muted" /> Declined marketing
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {formatDateTime(c.createdAt)} · {c.channel.replace('_', ' ')} · v{c.textVersion}
                  </p>
                  <p className="mt-1.5 border-l-2 border-line pl-2.5 text-[12.5px] text-body">
                    {c.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust the stamp balance"
        description="Recorded in the ledger with your reason — it stays visible in this customer's history."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            adjust.mutate();
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-body">
              Change (use a minus sign to remove)
            </label>
            <Input
              type="number"
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
              placeholder="-1"
              required
              autoFocus
            />
            <p className="text-[13px] text-muted">
              Currently {m.stampCount} of {m.stampsRequired} on this card.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-body">Reason</label>
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Stamped twice by mistake"
              required
              minLength={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={adjust.isPending}
              disabled={!adjustDelta || Number(adjustDelta) === 0 || adjustReason.trim().length < 4}
            >
              Apply adjustment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Block this customer?"
        description="They keep their history but cannot earn stamps. You can unblock at any time."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            block.mutate({ blocked: true, reason: blockReason });
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-body">Reason</label>
            <Input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Repeated abuse of the programme"
              required
              minLength={4}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={block.isPending}
              disabled={blockReason.trim().length < 4}
            >
              <Ban className="size-4" /> Block customer
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
