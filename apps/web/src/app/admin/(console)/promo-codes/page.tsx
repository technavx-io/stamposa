'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin-client';
import type { PromoCode } from '@/lib/api/admin-types';
import { formatDate } from '@/lib/utils';
import { Card, EmptyRow, Pill } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const inputCls =
  'h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20';

type Tier = 'STARTER' | 'GROWTH' | 'PRO';

export default function PromoCodesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    tier: Tier;
    freeMonths: number;
    maxRedemptions: number;
    expiresAt: string;
  }>({ code: '', tier: 'GROWTH', freeMonths: 6, maxRedemptions: 30, expiresAt: '' });

  const codes = useQuery({ queryKey: ['admin', 'promo-codes'], queryFn: adminApi.promoCodes });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'promo-codes'] });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createPromoCode({
        code: form.code.trim(),
        tier: form.tier,
        freeMonths: form.freeMonths,
        maxRedemptions: form.maxRedemptions,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      }),
    onSuccess: async () => {
      toast.success('Promo code created');
      setAddOpen(false);
      setForm({ code: '', tier: 'GROWTH', freeMonths: 6, maxRedemptions: 30, expiresAt: '' });
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create the code.'),
  });

  const toggle = useMutation({
    mutationFn: (c: PromoCode) => adminApi.setPromoActive(c.id, !c.active),
    onSuccess: async () => await invalidate(),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update the code.'),
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Promo codes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Codes that grant a business a free run of a plan — capped by a total redemption limit.
          </p>
        </div>
        <Button variant="brand" onClick={() => setAddOpen(true)}>
          <Ticket className="size-4" /> New code
        </Button>
      </div>

      <Card>
        {codes.isPending ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : codes.isError ? (
          <LoadError className="border-0" error={codes.error} onRetry={() => void codes.refetch()} />
        ) : !codes.data || codes.data.length === 0 ? (
          <EmptyRow>No promo codes yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-50">
            {codes.data.map((c) => {
              const full = c.redeemedCount >= c.maxRedemptions;
              const expired = c.expiresAt ? new Date(c.expiresAt).getTime() <= Date.now() : false;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wide text-slate-900">
                        {c.code}
                      </span>
                      <Pill tone="indigo">{c.tier}</Pill>
                      <Pill tone="slate">{c.freeMonths} mo free</Pill>
                      {!c.active && <Pill tone="red">Disabled</Pill>}
                      {expired && <Pill tone="amber">Expired</Pill>}
                      {full && <Pill tone="amber">Full</Pill>}
                    </div>
                    <p className="mt-1 text-[12.5px] text-slate-500">
                      Created {formatDate(c.createdAt)}
                      {c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900 tabular-nums">
                      {c.redeemedCount} / {c.maxRedemptions}
                    </p>
                    <p className="text-[12px] text-slate-500">redeemed</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggle.mutate(c)}
                    disabled={toggle.isPending}
                  >
                    {c.active ? 'Disable' : 'Enable'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New promo code"
        description="Businesses enter this on their billing screen to unlock the free period."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="FOUNDERS"
              className={`${inputCls} font-mono uppercase tracking-wide`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Plan</label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value as Tier })}
                className={`${inputCls} bg-white`}
              >
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Free months</label>
              <input
                type="number"
                min={1}
                max={36}
                required
                value={form.freeMonths}
                onChange={(e) => setForm({ ...form, freeMonths: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Max redemptions</label>
              <input
                type="number"
                min={1}
                required
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Expires (optional)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={create.isPending || !form.code.trim()}>
              {create.isPending ? 'Creating…' : 'Create code'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
