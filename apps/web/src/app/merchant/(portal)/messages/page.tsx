'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Apple, CheckCircle2, Clock, Megaphone, Smartphone, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import type { Broadcast } from '@/lib/api/types';
import { useMerchant } from '@/lib/auth/merchant-context';
import { cn, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { EmptyState, Panel, PanelHeader, Spinner } from '@/components/ui/surface';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { LoadError } from '@/components/ui/load-error';

const TITLE_MAX = 60;
const BODY_MAX = 160;

export default function MessagesPage() {
  const { business } = useMerchant();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);

  const audience = useQuery({
    queryKey: ['merchant', 'broadcast-audience'],
    queryFn: merchantApi.broadcastAudience,
  });

  const history = useQuery({
    queryKey: ['merchant', 'broadcasts'],
    queryFn: merchantApi.listBroadcasts,
    // Delivery is async — keep polling while anything is in flight.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((b) => b.status === 'QUEUED' || b.status === 'SENDING')
        ? 2000
        : false,
  });

  const send = useMutation({
    mutationFn: () => merchantApi.sendBroadcast({ title: title.trim(), body: body.trim() }),
    onSuccess: async () => {
      setConfirming(false);
      setTitle('');
      setBody('');
      toast.success('Broadcast sent — landing on lock screens now.');
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'broadcasts'] });
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'broadcast-audience'] });
    },
    onError: (e) => {
      setConfirming(false);
      toast.error(e instanceof ApiError ? e.message : 'Could not send the broadcast.');
    },
  });

  const a = audience.data;
  const passHolders = a?.passHolders ?? 0;
  const limit = a?.monthlyLimit ?? null;
  const sentThisMonth = a?.sentThisMonth ?? 0;
  const quotaLeft = limit === null ? null : Math.max(0, limit - sentThisMonth);
  const canCompose = title.trim().length > 0 && body.trim().length > 0;
  const outOfQuota = quotaLeft !== null && quotaLeft <= 0;
  const noAudience = !audience.isPending && passHolders === 0;

  return (
    <>
      <PageHeader
        title="Messages"
        description="Push a message straight to your customers' Apple & Google Wallet passes — on their lock screen, no SMS cost."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Compose */}
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="New broadcast" description="Reaches everyone who added your card to a wallet." />

            <div className="space-y-4 p-5 sm:p-6">
              <Field label="Headline" hint="Shown as the notification title on Google Wallet.">
                {(p) => (
                  <div>
                    <Input
                      {...p}
                      value={title}
                      maxLength={TITLE_MAX}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Weekend offer"
                    />
                    <CharCount value={title.length} max={TITLE_MAX} />
                  </div>
                )}
              </Field>

              <Field label="Message" hint="Keep it short — lock screens truncate long text.">
                {(p) => (
                  <div>
                    <Textarea
                      {...p}
                      value={body}
                      maxLength={BODY_MAX}
                      rows={3}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="20% off all drinks this Saturday — just show your card at the counter."
                    />
                    <CharCount value={body.length} max={BODY_MAX} />
                  </div>
                )}
              </Field>

              {/* Audience + quota */}
              <div className="rounded-xl border border-line bg-surface-2/50 p-3.5 text-sm">
                {audience.isPending ? (
                  <span className="flex items-center gap-2 text-muted">
                    <Spinner className="size-4" /> Checking your audience…
                  </span>
                ) : audience.isError ? (
                  <span className="text-muted">Could not load your audience.</span>
                ) : (
                  <>
                    <p className="flex items-center gap-2 font-medium text-strong">
                      <Smartphone className="size-4 text-brand-600" />
                      Reaches {passHolders} customer{passHolders === 1 ? '' : 's'}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      {a!.appleDevices} Apple device{a!.appleDevices === 1 ? '' : 's'} ·{' '}
                      {a!.googleCards} Google card{a!.googleCards === 1 ? '' : 's'} with your pass in
                      their wallet.
                    </p>
                    <p className="mt-1.5 text-[13px] text-muted">
                      {limit === null
                        ? `${sentThisMonth} sent this month`
                        : `${sentThisMonth} of ${limit} monthly broadcasts used`}
                    </p>
                  </>
                )}
              </div>

              {noAudience && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  No one has added your card to a wallet yet. Share your QR code so customers can save
                  their card — then you can reach them here.
                </p>
              )}

              {outOfQuota && !noAudience && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  You've used all your broadcasts this month. Upgrade your plan for more.
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  variant="brand"
                  disabled={!canCompose || noAudience || outOfQuota}
                  onClick={() => setConfirming(true)}
                >
                  <Megaphone className="size-4" /> Send broadcast
                </Button>
              </div>
            </div>
          </Panel>

          {/* History */}
          <Panel>
            <PanelHeader title="Sent broadcasts" />
            {history.isPending ? (
              <div className="p-6">
                <Spinner className="size-5" />
              </div>
            ) : history.isError ? (
              <LoadError onRetry={() => history.refetch()} />
            ) : history.data.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="size-5" />}
                title="No broadcasts yet"
                description="Your sent messages and their delivery stats will show here."
              />
            ) : (
              <ul className="divide-y divide-line-soft">
                {history.data.map((b) => (
                  <BroadcastRow key={b.id} b={b} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Preview</p>
          <LockScreenPreview
            businessName={business.name}
            logoUrl={business.logoUrl}
            brandColor={business.brandColor}
            title={title}
            body={body}
          />
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send this broadcast?"
        description={`It will notify ${passHolders} customer${passHolders === 1 ? '' : 's'} on their lock screen. This can't be unsent.`}
      >
        <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
          <p className="text-sm font-semibold text-strong">{title.trim() || 'Headline'}</p>
          <p className="mt-0.5 text-sm text-body">{body.trim()}</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="brand" loading={send.isPending} onClick={() => send.mutate()}>
            Send now
          </Button>
        </div>
      </Modal>
    </>
  );
}

function CharCount({ value, max }: { value: number; max: number }) {
  return (
    <p className={cn('mt-1 text-right text-xs', value >= max ? 'text-amber-600' : 'text-muted')}>
      {value}/{max}
    </p>
  );
}

const STATUS: Record<
  Broadcast['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  QUEUED: { label: 'Queued', icon: Clock, className: 'text-muted' },
  SENDING: { label: 'Sending…', icon: Clock, className: 'text-brand-600' },
  SENT: { label: 'Sent', icon: CheckCircle2, className: 'text-emerald-600' },
  FAILED: { label: 'Failed', icon: XCircle, className: 'text-red-600' },
};

function BroadcastRow({ b }: { b: Broadcast }) {
  const s = STATUS[b.status];
  const Icon = s.icon;
  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-strong">{b.title}</p>
          <p className="mt-0.5 text-sm text-body">{b.body}</p>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 text-xs font-medium', s.className)}>
          <Icon className="size-3.5" /> {s.label}
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{formatDateTime(b.sentAt ?? b.createdAt)}</span>
        <span>· {b.recipientCount} recipient{b.recipientCount === 1 ? '' : 's'}</span>
        {b.status === 'SENT' && (
          <>
            <span className="flex items-center gap-1">
              · <Apple className="size-3" /> {b.appleDevices}
            </span>
            <span>· Google {b.googleNotified ? 'notified' : '—'}</span>
          </>
        )}
      </p>
    </li>
  );
}

/** A phone lock-screen mockup showing how the wallet notification will look. */
function LockScreenPreview({
  businessName,
  logoUrl,
  brandColor,
  title,
  body,
}: {
  businessName: string;
  logoUrl: string | null;
  brandColor: string | null;
  title: string;
  body: string;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[16rem] rounded-[2rem] p-3 shadow-xl"
      style={{ background: brandColor ?? '#4F46E5' }}
    >
      <div className="rounded-[1.5rem] bg-black/25 p-3 pt-6">
        <p className="text-center text-3xl font-semibold text-white">9:41</p>
        <p className="mb-4 text-center text-xs text-white/70">Saturday, 12 April</p>
        {/* Notification banner */}
        <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur dark:bg-zinc-900/95">
          <div className="flex items-center gap-2">
            <LogoAvatar name={businessName} logoUrl={logoUrl} size="sm" />
            <p className="flex-1 truncate text-[11px] font-medium text-strong">{businessName}</p>
            <span className="text-[10px] text-muted">now</span>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold text-strong">
            {title.trim() || 'Your headline'}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-body">
            {body.trim() || 'Your message shows here, right on the lock screen.'}
          </p>
        </div>
        <p className="mt-4 text-center text-[10px] text-white/60">Apple Wallet · Google Wallet</p>
      </div>
    </div>
  );
}
