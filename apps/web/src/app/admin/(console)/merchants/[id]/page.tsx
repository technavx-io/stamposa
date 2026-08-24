'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  ExternalLink,
  LogIn,
  RotateCcw,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin-client';
import { useCan } from '@/lib/admin/admin-session';
import { merchantSession } from '@/lib/auth/session';
import { formatDate, formatDateTime, formatPhone, timeAgo } from '@/lib/utils';
import {
  Card,
  CardHeader,
  EmptyRow,
  HealthBadge,
  Metric,
  Pill,
  formatAction,
} from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

export default function AdminMerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const canSuspend = useCan('merchants.suspend');
  const canImpersonate = useCan('merchants.impersonate');
  const canWrite = useCan('merchants.write');

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [notes, setNotes] = useState<string | null>(null);

  const merchant = useQuery({
    queryKey: ['admin', 'merchant', id],
    queryFn: () => adminApi.merchant(id),
  });
  const customers = useQuery({
    queryKey: ['admin', 'merchant', id, 'customers'],
    queryFn: () => adminApi.merchantCustomers(id, 1, 8),
    enabled: !!merchant.data,
  });
  const activity = useQuery({
    queryKey: ['admin', 'merchant', id, 'audit'],
    queryFn: () => adminApi.merchantAudit(id, 1, 10),
    enabled: !!merchant.data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const suspend = useMutation({
    mutationFn: () => adminApi.suspend(id, reason, confirmName),
    onSuccess: async () => {
      toast.success('Merchant suspended — logins and stamping are blocked');
      setSuspendOpen(false);
      setReason('');
      setConfirmName('');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not suspend.'),
  });

  const reactivate = useMutation({
    mutationFn: () => adminApi.reactivate(id),
    onSuccess: async () => {
      toast.success('Suspension lifted');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not reactivate.'),
  });

  const saveNotes = useMutation({
    mutationFn: (value: string) => adminApi.saveNotes(id, value),
    onSuccess: async () => {
      toast.success('Notes saved');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save notes.'),
  });

  const impersonate = useMutation({
    mutationFn: () => adminApi.impersonate(id, reason),
    onSuccess: (result) => {
      // Write a real merchant session, then open their portal in a new tab.
      merchantSession.set({
        tokens: result.tokens,
        actor: {
          id: result.sessionId,
          role: 'MERCHANT',
          name: result.ownerName,
          phone: '',
        },
      });
      setImpersonateOpen(false);
      setReason('');
      toast.success(`Signed in as ${result.businessName} — session ends in 30 minutes`);
      window.open('/merchant/dashboard', '_blank', 'noopener');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not start the session.'),
  });

  if (merchant.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (merchant.isError || !merchant.data) {
    return (
      <Card>
        <EmptyRow>
          Merchant not found.{' '}
          <Link href="/admin/merchants" className="text-indigo-600 hover:underline">
            Back to list
          </Link>
        </EmptyRow>
      </Card>
    );
  }

  const m = merchant.data;
  const notesValue = notes ?? m.adminNotes ?? '';

  return (
    <>
      <Link
        href="/admin/merchants"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> All merchants
      </Link>

      {m.suspended && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="flex-1 text-[13px]">
            <p className="font-medium text-red-900">
              Suspended {m.suspendedAt ? timeAgo(m.suspendedAt) : ''}
              {m.suspendedBy ? ` by ${m.suspendedBy}` : ''}
            </p>
            {m.suspendedReason && <p className="mt-0.5 text-red-700">{m.suspendedReason}</p>}
            <p className="mt-1 text-red-600/80">
              Owner and staff cannot sign in; the join page is closed to new customers.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <HealthBadge grade={m.health} title={m.healthReason} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{m.name}</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {m.owner.name} · {formatPhone(m.owner.phone)} · joined {formatDate(m.createdAt)}
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-500">{m.healthReason}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={m.joinUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <ExternalLink className="size-4" /> Join page
            </Button>
          </a>
          {canImpersonate && !m.suspended && (
            <Button variant="secondary" size="sm" onClick={() => setImpersonateOpen(true)}>
              <LogIn className="size-4" /> Sign in as merchant
            </Button>
          )}
          {canSuspend &&
            (m.suspended ? (
              <Button size="sm" loading={reactivate.isPending} onClick={() => reactivate.mutate()}>
                <RotateCcw className="size-4" /> Reactivate
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setSuspendOpen(true)}>
                <Ban className="size-4" /> Suspend
              </Button>
            ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Customers" value={m.stats.customers} />
        <Metric
          label="Stamps · 7 days"
          value={m.stats.stamps7d}
          hint={m.stats.lastStampAt ? `last ${timeAgo(m.stats.lastStampAt)}` : 'never stamped'}
        />
        <Metric label="Rewards given" value={m.stats.redeemedRewards} hint={`${m.stats.pendingRewards} waiting`} />
        <Metric label="Staff" value={m.stats.staff} hint={`${m.stats.stampsTotal} stamps all-time`} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Programme" />
            {m.campaigns.length === 0 ? (
              <EmptyRow>No loyalty programme created yet — setup is incomplete.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-50">
                {m.campaigns.map((c) => (
                  <li key={c.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <Pill tone={c.status === 'ACTIVE' ? 'green' : c.status === 'PAUSED' ? 'amber' : 'slate'}>
                        {c.status === 'ACTIVE' ? 'Live' : c.status === 'PAUSED' ? 'Paused' : 'Archived'}
                      </Pill>
                    </div>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {c.stampsRequired} stamps → {c.reward}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {c.members} member{c.members === 1 ? '' : 's'} · created {formatDate(c.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Staff" description={`${m.staff.length} account${m.staff.length === 1 ? '' : 's'}`} />
            {m.staff.length === 0 ? (
              <EmptyRow>No staff added.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-50">
                {m.staff.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-slate-800">{s.name}</p>
                      <p className="truncate text-[11.5px] text-slate-500">{formatPhone(s.phone)}</p>
                    </div>
                    {!s.isActive && <Pill tone="red">Inactive</Pill>}
                    <span className="font-mono text-[12px] text-slate-500 tabular-nums">
                      {s.stampsIssued}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canWrite && (
            <Card>
              <CardHeader title="Operator notes" description="Only visible in this console" />
              <div className="space-y-3 p-5">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Context for whoever picks up this account next…"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
                />
                <Button
                  size="sm"
                  loading={saveNotes.isPending}
                  disabled={notesValue === (m.adminNotes ?? '')}
                  onClick={() => saveNotes.mutate(notesValue)}
                >
                  <Save className="size-4" /> Save notes
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customers" description="Codes and progress only — no contact details" />
            {customers.isPending ? (
              <div className="flex h-32 items-center justify-center"><Spinner className="size-5" /></div>
            ) : customers.isError ? (
          <LoadError className="border-0" error={customers.error} onRetry={() => void customers.refetch()} />
        ) : !customers.data || customers.data.items.length === 0 ? (
              <EmptyRow>No customers enrolled yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-50">
                {customers.data.items.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="font-mono text-[12px] text-slate-500">{c.code}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate-700">
                      {c.name ?? 'Unnamed'}
                    </span>
                    <span className="text-[12px] text-slate-500 tabular-nums">
                      {c.totalStamps} stamps · {c.completedCount} rewards
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {customers.data && customers.data.total > customers.data.items.length && (
              <p className="border-t border-slate-100 px-5 py-2.5 text-[12.5px] text-slate-500">
                Showing {customers.data.items.length} of {customers.data.total}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Account activity" description="Everything done to this tenant" />
            {activity.isPending ? (
              <div className="flex h-32 items-center justify-center"><Spinner className="size-5" /></div>
            ) : !activity.data || activity.data.items.length === 0 ? (
              <EmptyRow>No admin actions recorded for this merchant.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-50">
                {activity.data.items.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="text-[13.5px] font-medium text-slate-800">{formatAction(a.action)}</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {a.actorLabel} · {formatDateTime(a.createdAt)}
                    </p>
                    {a.reason && <p className="mt-1 text-[12.5px] text-slate-600">{a.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Suspension requires a reason and the typed business name. */}
      <Modal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="Suspend this merchant?"
        description="The owner and their staff will be signed out immediately and cannot sign back in. Their join page stops accepting new customers."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Reason (recorded permanently)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Chargeback dispute pending resolution"
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">
              Type <span className="font-semibold">{m.name}</span> to confirm
            </label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={m.name}
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={suspend.isPending}
              disabled={reason.trim().length < 8 || confirmName.trim() !== m.name.trim()}
              onClick={() => suspend.mutate()}
            >
              <Ban className="size-4" /> Suspend merchant
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={impersonateOpen}
        onClose={() => setImpersonateOpen(false)}
        title="Sign in as this merchant?"
        description="You'll see their dashboard exactly as they do, for 30 minutes. This is recorded against your name and theirs."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Why do you need access?</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Investigating reported stamping issue, ticket #412"
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImpersonateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              loading={impersonate.isPending}
              disabled={reason.trim().length < 8}
              onClick={() => impersonate.mutate()}
            >
              <LogIn className="size-4" /> Open their dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
