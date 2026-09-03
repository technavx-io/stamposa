'use client';

import Link from 'next/link';
import { PHONE_AUTH_ENABLED } from '@/lib/features';
import { use, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Gift, RotateCcw, Stamp, Star, Wallet, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '@/lib/api/endpoints';
import { downloadAuthenticated } from '@/lib/download';
import { useStoredSession } from '@/lib/auth/use-stored-session';
import { formatDateTime } from '@/lib/utils';
import { OtpLogin } from '@/components/auth/otp-login';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { Badge, EmptyState, PageLoader, Panel } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
import { cardBackground } from '@/lib/card-bg';

const POLL_MS = 4000;

export default function CardPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  const { session, ready } = useStoredSession('CUSTOMER');

  if (!ready) return <PageLoader />;

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <Panel className="w-full max-w-sm p-6 sm:p-8">
          <OtpLogin
            role="CUSTOMER"
            title="Verify to view your card"
            subtitle={PHONE_AUTH_ENABLED ? "Enter the phone number this card belongs to." : "Enter the email this card belongs to."}
            allowRegistration
            onAuthenticated={() => undefined}
          />
        </Panel>
      </div>
    );
  }

  return <LiveCard membershipId={membershipId} />;
}

/**
 * Add-to-wallet actions. Real buttons only when the deployment has the
 * platform's wallet credentials configured; otherwise the honest "soon"
 * placeholders stay.
 */
function WalletButtons({ membershipId }: { membershipId: string }) {
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const availability = useQuery({
    queryKey: ['customer', 'wallet', membershipId],
    queryFn: () => customerApi.walletAvailability(membershipId),
    staleTime: 10 * 60_000,
  });

  const apple = availability.data?.apple.available ?? false;
  const google = availability.data?.google.available ?? false;

  const addApple = async () => {
    setBusy('apple');
    try {
      await downloadAuthenticated(customerApi.appleWalletPath(membershipId), 'loyalty-card.pkpass', {
        session: 'customer',
      });
    } catch {
      toast.error('Could not fetch the pass — try again.');
    } finally {
      setBusy(null);
    }
  };

  const addGoogle = async () => {
    setBusy('google');
    try {
      const { saveUrl } = await customerApi.googleWalletLink(membershipId);
      window.open(saveUrl, '_blank', 'noopener');
    } catch {
      toast.error('Could not create the save link — try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {apple ? (
        <button
          onClick={() => void addApple()}
          disabled={busy !== null}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          <Wallet className="size-4" /> {busy === 'apple' ? 'Preparing…' : 'Add to Apple Wallet'}
        </button>
      ) : (
        <PlaceholderWalletButton icon={Wallet} label="Apple Wallet" />
      )}
      {google ? (
        <button
          onClick={() => void addGoogle()}
          disabled={busy !== null}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          <WalletCards className="size-4" /> {busy === 'google' ? 'Opening…' : 'Save to Google Wallet'}
        </button>
      ) : (
        <PlaceholderWalletButton icon={WalletCards} label="Google Wallet" />
      )}
    </div>
  );
}

/**
 * Sends happy customers to the merchant's Google review page. Only rendered
 * when the merchant has added a link in Settings; opens in a new tab so the
 * card stays put behind it.
 */
function GoogleReviewPrompt({ businessName, href }: { businessName: string; href: string }) {
  return (
    <Panel className="mt-4 flex items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
        <Star className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-strong">Enjoying {businessName}?</p>
        <p className="mt-0.5 text-[13px] text-muted">A quick Google review helps them a lot.</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-700"
      >
        Review <ExternalLink className="size-3.5" />
      </a>
    </Panel>
  );
}

function PlaceholderWalletButton({
  icon: Icon,
  label,
}: {
  icon: typeof Wallet;
  label: string;
}) {
  return (
    <button
      disabled
      title="Not enabled on this deployment yet"
      className="flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-muted"
    >
      <Icon className="size-4" /> {label}
      <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-muted">soon</span>
    </button>
  );
}

function LiveCard({ membershipId }: { membershipId: string }) {
  const card = useQuery({
    queryKey: ['customer', 'card', membershipId],
    queryFn: () => customerApi.card(membershipId),
    // "Updates immediately": short polling keeps the card live while open.
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  // The code never changes, so the QR is fetched once and cached forever.
  const qr = useQuery({
    queryKey: ['customer', 'card-qr', membershipId],
    queryFn: () => customerApi.cardQr(membershipId),
    staleTime: Infinity,
  });

  // Celebrate transitions (new stamp / reward / hand-over) between polls.
  const prevTotal = useRef<number | null>(null);
  const prevPending = useRef<number | null>(null);
  const [justStamped, setJustStamped] = useState(false);
  useEffect(() => {
    const total = card.data?.totalStamps;
    if (total === undefined) return;
    if (prevTotal.current !== null && total > prevTotal.current) {
      setJustStamped(true);
      const latest = card.data?.recentStamps[0];
      if (latest?.completedCard) {
        toast.success(`Card complete — you've earned: ${card.data?.campaign.reward}!`, {
          duration: 8000,
        });
      } else {
        toast.success('New stamp added!');
      }
      const t = setTimeout(() => setJustStamped(false), 1500);
      return () => clearTimeout(t);
    }
    prevTotal.current = total;
  }, [card.data?.totalStamps, card.data?.recentStamps, card.data?.campaign.reward]);

  useEffect(() => {
    const total = card.data?.totalStamps;
    if (total !== undefined) prevTotal.current = total;
  }, [card.data?.totalStamps]);

  // A reward disappearing from the pending list means staff handed it over.
  useEffect(() => {
    const pending = card.data?.pendingRewards.length;
    if (pending === undefined) return;
    if (prevPending.current !== null && pending < prevPending.current) {
      toast.success('Reward redeemed — enjoy!', { duration: 6000 });
    }
    prevPending.current = pending;
  }, [card.data?.pendingRewards.length]);

  if (card.isPending) return <PageLoader label="Fetching your card…" />;

  if (card.isError || !card.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <Panel className="w-full max-w-sm">
          <EmptyState
            title="Card not found"
            description={PHONE_AUTH_ENABLED ? "This card doesn't belong to the phone number you verified." : "This card doesn't belong to the email you verified."}
            action={
              <Link href="/my-cards" className="text-sm font-medium text-brand-600">
                See my cards
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const c = card.data;
  const remaining = c.campaign.stampsRequired - c.stampCount;
  const pending = c.pendingRewards;

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-zinc-100 to-zinc-200 px-4 pb-12 dark:from-zinc-950 dark:to-black">
      <div className="w-full max-w-md pt-8">
        {/* The card itself */}
        <div
          className="rounded-3xl bg-cover bg-center p-6 text-white shadow-2xl shadow-zinc-900/20"
          style={{ background: cardBackground(c.style) }}
        >
          <div className="flex items-center gap-3">
            <LogoAvatar name={c.business.name} logoUrl={c.business.logoUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.business.name}</p>
              <p className="truncate text-xs text-white/60">{c.campaign.name}</p>
            </div>
            {c.completedCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                <Gift className="size-3" /> {c.completedCount}
              </span>
            )}
          </div>

          <div className="my-6 flex justify-center">
            <StampGrid
              total={c.campaign.stampsRequired}
              filled={c.stampCount}
              size="lg"
              tone="dark"
              highlightLast={justStamped}
              stampIcon={c.style.stampIcon}
              rewardIcon={c.style.rewardIcon}
            />
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-white/60">
                {remaining} stamp{remaining === 1 ? '' : 's'} to go
              </p>
              <p className="mt-0.5 truncate text-sm font-medium">{c.campaign.reward}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] tracking-wide text-white/40 uppercase">Customer ID</p>
              <p className="font-mono text-base font-semibold tracking-widest">{c.formattedCode}</p>
            </div>
          </div>
        </div>

        {/* Scannable code — staff point their camera at this to stamp */}
        {qr.data && (
          <Panel className="mt-4 flex items-center gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.data.dataUrl}
              alt={`QR code ${qr.data.code}`}
              className="size-24 shrink-0 rounded-lg border border-line-soft"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-strong">Show this at the counter</p>
              <p className="mt-0.5 text-[13px] text-muted">
                Staff scan it to pull up your card instantly — or just read out your code{' '}
                <span className="font-mono font-medium text-body">{qr.data.code}</span>.
              </p>
            </div>
          </Panel>
        )}

        {/* Rewards ready to claim — the customer shows this at the counter */}
        {pending.length > 0 && (
          <div className="mt-4 space-y-3">
            {pending.map((reward) => (
              <div
                key={reward.id}
                className="animate-rise rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center shadow-lg shadow-amber-500/10"
              >
                <p className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-900">
                  <Gift className="size-4 text-amber-500" /> Reward ready to claim
                </p>
                <p className="mt-1 text-lg font-semibold text-strong">{reward.rewardText}</p>
                <p className="mt-3 font-mono text-2xl font-bold tracking-[0.2em] text-amber-700">
                  {reward.formattedCode}
                </p>
                <p className="mt-2 text-xs text-amber-700/80">
                  Show this code at the counter to redeem
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-center text-xs text-muted">
          Updates live — show your code at the counter to collect stamps.
        </p>

        <WalletButtons membershipId={membershipId} />

        {c.business.googleReviewUrl && (
          <GoogleReviewPrompt businessName={c.business.name} href={c.business.googleReviewUrl} />
        )}

        {/* Activity */}
        <Panel className="mt-6">
          <p className="border-b border-line-soft px-5 py-3 text-sm font-semibold text-strong">
            Recent activity
          </p>
          {c.recentStamps.length === 0 ? (
            <EmptyState
              icon={<Stamp className="size-5" />}
              title="No stamps yet"
              description="Your first stamp is waiting at the counter."
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {c.recentStamps.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                      s.delta < 0
                        ? 'bg-surface-2 text-muted'
                        : s.completedCard
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
                    }`}
                  >
                    {s.delta < 0 ? (
                      <RotateCcw className="size-4" />
                    ) : s.completedCard ? (
                      <Gift className="size-4" />
                    ) : (
                      <Stamp className="size-4" />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="text-strong">
                      {s.delta < 0
                        ? s.issuerType === 'ADJUSTMENT'
                          ? `Balance adjusted (${s.delta})`
                          : 'Stamp taken back'
                        : s.delta > 1
                          ? `Balance adjusted (+${s.delta})`
                          : s.completedCard
                            ? 'Card completed — reward earned!'
                            : 'Stamp collected'}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(s.createdAt)}</p>
                  </div>
                  {s.completedCard && <Badge tone="amber">🎁</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="mt-6 flex items-center justify-between text-xs text-muted">
          <Link href="/my-cards" className="font-medium text-brand-600 hover:text-brand-700">
            All my cards
          </Link>
          <span>
            Powered by <span className="font-medium text-muted">Stamposa</span>
          </span>
        </div>
      </div>
    </div>
  );
}
