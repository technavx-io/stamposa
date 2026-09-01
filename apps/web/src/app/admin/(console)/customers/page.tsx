'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Info, Search, ShieldOff, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin-client';
import type { CustomerLookupResult } from '@/lib/api/admin-types';
import { useCan } from '@/lib/admin/admin-session';
import { formatDate, formatPhone } from '@/lib/utils';
import { Card, CardHeader, EmptyRow } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Deliberately a lookup, not a browse: exact phone only, reason mandatory,
 * every attempt logged. This exists for privacy requests and abuse reports,
 * not for exploring customer data.
 */
export default function AdminCustomerLookupPage() {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<CustomerLookupResult | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const canErase = useCan('customers.erase');

  const lookup = useMutation({
    mutationFn: () => adminApi.lookupCustomer(phone, reason),
    onSuccess: (data) => {
      setResult(data);
      if (!data.found) toast.info('No customer with that number.');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Lookup failed.'),
  });

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Customer lookup</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          For privacy requests and abuse reports. Exact phone number only.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
        <p>
          Every lookup is written to the audit log with your name and the reason you give — whether
          or not a customer is found. There is no way to browse customers here by design.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader title="Find a customer" />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            lookup.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                Phone number
              </label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 01101"
                required
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-sm font-medium text-slate-700">
                Reason for access
              </label>
              <input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Customer asked which businesses hold their data"
                required
                minLength={8}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="brand"
            loading={lookup.isPending}
            disabled={phone.trim().length < 6 || reason.trim().length < 8}
          >
            <Search className="size-4" /> Look up
          </Button>
        </form>
      </Card>

      {result && (
        <Card>
          <CardHeader
            title={result.found ? 'Customer record' : 'No match'}
            description={result.found ? 'Cards this person holds across every business' : undefined}
          />
          {!result.found || !result.customer ? (
            <EmptyRow>
              <UserSearch className="mx-auto mb-2 size-6 text-slate-300" />
              No customer is registered with that number.
            </EmptyRow>
          ) : (
            <>
              <div className="grid gap-4 border-b border-slate-100 px-5 py-4 sm:grid-cols-4">
                <div>
                  <p className="font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">Name</p>
                  <p className="mt-0.5 text-sm text-slate-900">{result.customer.name ?? 'Not provided'}</p>
                </div>
                <div>
                  <p className="font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">Phone</p>
                  <p className="mt-0.5 text-sm text-slate-900">{result.customer.contact}</p>
                </div>
                <div>
                  <p className="font-mono text-[10.5px] tracking-wider text-slate-500 uppercase">Joined</p>
                  <p className="mt-0.5 text-sm text-slate-900">{formatDate(result.customer.joinedAt)}</p>
                </div>
                {canErase && (
                  <div className="flex items-center justify-end">
                    <Button variant="danger" size="sm" onClick={() => setEraseOpen(true)}>
                      <ShieldOff className="size-4" /> Erase data
                    </Button>
                  </div>
                )}
              </div>
              <ul className="divide-y divide-slate-50">
                {result.customer.memberships.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/merchants/${m.businessId}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {m.businessName}
                      </Link>
                      <p className="text-[12px] text-slate-500">
                        {m.campaignName} · <span className="font-mono">{m.code}</span> · joined{' '}
                        {formatDate(m.joinedAt)}
                      </p>
                    </div>
                    <span className="text-[12.5px] text-slate-500 tabular-nums">
                      {m.totalStamps} stamps · {m.completedCount} rewards
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {result?.customer && (
        <EraseModal
          open={eraseOpen}
          onClose={() => setEraseOpen(false)}
          customerId={result.customer.id}
          customerLabel={result.customer.name ?? result.customer.contact}
          membershipCount={result.customer.memberships.length}
          onErased={() => {
            setEraseOpen(false);
            setResult(null);
            setPhone('');
            setReason('');
          }}
        />
      )}
    </>
  );
}

/**
 * DPDP/GDPR erasure. Deliberately heavy ceremony: impact summary, mandatory
 * reason, typed confirmation — this is the one truly irreversible action in
 * the panel.
 */
function EraseModal({
  open,
  onClose,
  customerId,
  customerLabel,
  membershipCount,
  onErased,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerLabel: string;
  membershipCount: number;
  onErased: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');

  const erase = useMutation({
    mutationFn: () => adminApi.eraseCustomer(customerId, reason, confirm),
    onSuccess: (r) => {
      toast.success(`Customer erased — ${r.memberships} card${r.memberships === 1 ? '' : 's'} anonymised.`);
      onErased();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erasure failed.'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Erase ${customerLabel}?`}
      description="This is irreversible. Do this only for a verified privacy (DPDP/GDPR) request."
    >
      <div className="space-y-4">
        <ul className="list-disc space-y-1 rounded-xl border border-red-200 bg-red-50 py-3 pr-4 pl-8 text-[13px] text-red-900">
          <li>Their phone number and name are removed everywhere, permanently.</li>
          <li>{membershipCount} loyalty card{membershipCount === 1 ? '' : 's'} stay as anonymous ledger rows; merchant notes and tags are wiped.</li>
          <li>All their live sessions are signed out; the number can register fresh later.</li>
          <li>Consent decisions are kept as the legal record (IP addresses stripped).</li>
        </ul>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Reason (goes to the audit log)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="DPDP erasure request verified by email on 18 Aug"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-2 focus:outline-indigo-500/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Type <span className="font-mono font-semibold">ERASE</span> to confirm
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="ERASE"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm focus:border-red-400 focus:outline-2 focus:outline-red-500/20"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 8 || confirm !== 'ERASE'}
            loading={erase.isPending}
            onClick={() => erase.mutate()}
          >
            <ShieldOff className="size-4" /> Erase permanently
          </Button>
        </div>
      </div>
    </Modal>
  );
}
