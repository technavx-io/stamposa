'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Gift,
  LogOut,
  PartyPopper,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Stamp,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { staffApi } from '@/lib/api/endpoints';
import type {
  AddStampResult,
  MembershipListItem,
  RedeemResult,
  RedemptionSummary,
  StaffRole,
} from '@/lib/api/types';
import { staffSession } from '@/lib/auth/session';
import { useStoredSession } from '@/lib/auth/use-stored-session';
import { useDebounced } from '@/lib/use-debounced';
import { cn, formatPhone, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { Modal } from '@/components/ui/modal';
import { Badge, EmptyState, PageLoader, Panel, Spinner } from '@/components/ui/surface';
import { QrScanner } from '@/components/qr-scanner';
import { ThemeToggleCompact } from '@/components/ui/theme-toggle';
import { StampGrid } from '@/components/stamp-grid';
import { LoadError } from '@/components/ui/load-error';

const STAFF_UNDO_SEC = 60;
const MANAGER_UNDO_SEC = 15 * 60;

export default function StaffConsolePage() {
  const router = useRouter();
  const { session, ready } = useStoredSession('STAFF');
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const [lastResult, setLastResult] = useState<
    (AddStampResult & { stampedAtMs: number }) | null
  >(null);
  const [redeemTarget, setRedeemTarget] = useState<
    { membership: MembershipListItem; reward: RedemptionSummary } | null
  >(null);
  const [lastRedeemed, setLastRedeemed] = useState<RedeemResult | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const context = useQuery({
    queryKey: ['staff', 'context'],
    queryFn: staffApi.context,
    enabled: !!session,
  });

  const today = useQuery({
    queryKey: ['staff', 'today'],
    queryFn: staffApi.today,
    enabled: !!session && !!context.data,
    refetchInterval: 45_000,
  });

  const search = useQuery({
    queryKey: ['staff', 'search', debouncedQuery],
    queryFn: () => staffApi.search(debouncedQuery),
    enabled: !!session && !!context.data,
  });

  useEffect(() => {
    if (ready && !session) router.replace('/staff/login');
  }, [session, ready, router]);

  const authFailed =
    context.isError &&
    context.error instanceof ApiError &&
    (context.error.status === 401 || context.error.status === 403);

  useEffect(() => {
    if (authFailed) {
      staffSession.clear();
      router.replace('/staff/login');
    }
  }, [authFailed, router]);

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff', 'search'] }),
        queryClient.invalidateQueries({ queryKey: ['staff', 'today'] }),
      ]),
    [queryClient],
  );

  const addStamp = useMutation({
    mutationFn: (membershipId: string) => staffApi.addStamp(membershipId),
    onSuccess: async (result) => {
      setLastResult({ ...result, stampedAtMs: Date.now() });
      if (result.rewardEarned) {
        toast.success(`Reward unlocked: ${result.reward}`, {
          icon: <PartyPopper className="size-4" />,
          duration: 6000,
        });
      }
      await refresh();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Could not add the stamp.');
    },
  });

  const undoStamp = useMutation({
    mutationFn: (membershipId: string) => staffApi.undoStamp(membershipId),
    onSuccess: async (result) => {
      setLastResult(null);
      toast.success(
        result.voucherVoided
          ? 'Stamp taken back — the reward it unlocked was voided.'
          : 'Stamp taken back.',
        { icon: <RotateCcw className="size-4" /> },
      );
      await refresh();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Could not undo the stamp.');
    },
  });

  const redeem = useMutation({
    mutationFn: (redemptionId: string) => staffApi.redeem({ redemptionId }),
    onSuccess: async (result) => {
      setLastRedeemed(result);
      setRedeemTarget(null);
      setLastResult(null);
      toast.success(`Reward handed over: ${result.redemption.rewardText}`, {
        icon: <Check className="size-4" />,
      });
      await refresh();
    },
    onError: (e) => {
      setRedeemTarget(null);
      toast.error(e instanceof ApiError ? e.message : 'Could not redeem the reward.');
    },
  });

  const onScanDecode = useCallback((text: string) => {
    setScanOpen(false);
    const code = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!code) {
      toast.error('That QR does not look like a loyalty card.');
      return;
    }
    setQuery(code);
  }, []);

  if (!session || context.isPending) return <PageLoader label="Opening the console…" />;
  if (context.isError && !authFailed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <LoadError
          className="w-full max-w-sm"
          title="Couldn't reach Stamposa"
          error={context.error}
          onRetry={() => void context.refetch()}
        />
      </div>
    );
  }
  if (!context.data) return null;

  const { business, campaign, staff } = context.data;
  const isManager = staff.role === 'MANAGER';

  const logout = async () => {
    const refreshToken = staffSession.get()?.tokens.refreshToken;
    staffSession.clear();
    if (refreshToken) await staffApi.auth.logout(refreshToken).catch(() => undefined);
    router.replace('/staff/login');
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoAvatar name={business.name} logoUrl={business.logoUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-strong">{business.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="truncate">Staff console · {staff.name}</span>
                {isManager && (
                  <Badge tone="brand" className="shrink-0">
                    Manager
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <ThemeToggleCompact />
            <button
              onClick={() => void logout()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-strong"
            >
              <LogOut className="size-4" /> Exit
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        {/* Today strip — everyone sees their own day; managers see the counter's */}
        {today.data && (
          <div className="mb-4 space-y-2">
            <Panel className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-[13px]">
              <span className="font-medium text-strong">
                You today: {today.data.mine.stamps} stamp{today.data.mine.stamps === 1 ? '' : 's'}
              </span>
              <span className="text-muted">{today.data.mine.redemptions} rewards handed over</span>
              {today.data.totals && (
                <span className="ml-auto text-muted">
                  Counter: {today.data.totals.stamps} stamps · {today.data.totals.newCustomers} new ·{' '}
                  {today.data.totals.rewardsRedeemed} redeemed
                </span>
              )}
            </Panel>
            {isManager && today.data.team && today.data.team.length > 1 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {today.data.team.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-body"
                  >
                    {t.name.split(' ')[0]} · {t.stamps}
                    {t.redemptions > 0 && <> 🎁{t.redemptions}</>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!campaign ? (
          <Panel>
            <EmptyState
              icon={<Stamp className="size-6" />}
              title="No active campaign"
              description="The owner needs to launch (or resume) a campaign before stamps can be added."
            />
          </Panel>
        ) : (
          <>
            {campaign.status !== 'ACTIVE' && (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                The campaign is paused — search works, but stamping is disabled.
              </p>
            )}

            {/* Reward unlocked → offer to hand it over right now */}
            {lastResult?.rewardEarned && lastResult.redemption && (
              <div className="mb-4 animate-rise rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-amber-900">
                  <Gift className="size-5 text-amber-500" /> Reward unlocked!
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {lastResult.card.customer.name ?? 'This customer'} earned:{' '}
                  <strong>{lastResult.reward}</strong>. A fresh card has already started.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="brand"
                    loading={redeem.isPending}
                    onClick={() => redeem.mutate(lastResult.redemption!.id)}
                  >
                    <Check className="size-4" /> Hand over now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>
                    Later
                  </Button>
                  <span className="font-mono text-xs text-amber-700">
                    {lastResult.redemption.formattedCode}
                  </span>
                </div>
              </div>
            )}

            {/* Confirmation after a reward is handed over */}
            {lastRedeemed && (
              <button
                className="mb-4 w-full animate-rise rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left"
                onClick={() => setLastRedeemed(null)}
              >
                <p className="flex items-center gap-2 font-semibold text-emerald-900">
                  <Check className="size-5 text-emerald-700" /> Reward handed over
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  {lastRedeemed.redemption.customer.name ?? 'Customer'} received:{' '}
                  <strong>{lastRedeemed.redemption.rewardText}</strong> · voucher{' '}
                  <span className="font-mono">{lastRedeemed.redemption.formattedCode}</span>
                </p>
              </button>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
              <Input
                className="h-14 rounded-xl pl-12 text-base shadow-sm"
                placeholder="Phone, code or name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                inputMode="search"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="h-11 rounded-xl"
                onClick={() => setScanOpen(true)}
              >
                <ScanLine className="size-4" /> Scan card QR
              </Button>
              <Button
                variant="secondary"
                className="h-11 rounded-xl"
                onClick={() => setEnrollOpen(true)}
              >
                <UserPlus className="size-4" /> New customer
              </Button>
            </div>

            <p className="mt-4 mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              {debouncedQuery ? 'Results' : 'Recently stamped'}
            </p>

            {search.isPending ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner className="size-6" />
              </div>
            ) : search.isError ? (
          <LoadError className="border-0" error={search.error} onRetry={() => void search.refetch()} />
        ) : !search.data || search.data.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={<UserRound className="size-6" />}
                  title={debouncedQuery ? 'No customer found' : 'No stamps yet today'}
                  description={
                    debouncedQuery
                      ? 'Check the phone number or ask for their customer code (like 7F3K-9QZP).'
                      : 'Search any customer, scan their card QR, or enrol someone new.'
                  }
                />
              </Panel>
            ) : (
              <ul className="space-y-3">
                {search.data.map((m) => (
                  <CustomerResult
                    key={m.id}
                    membership={m}
                    role={staff.role}
                    disabled={campaign.status !== 'ACTIVE' || addStamp.isPending}
                    stamping={addStamp.isPending && addStamp.variables === m.id}
                    justStamped={lastResult?.card.id === m.id ? lastResult : null}
                    undoing={undoStamp.isPending && undoStamp.variables === m.id}
                    onStamp={() => addStamp.mutate(m.id)}
                    onUndo={() => undoStamp.mutate(m.id)}
                    onRedeem={(reward) => setRedeemTarget({ membership: m, reward })}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan a card"
        description="Ask the customer to open their card — the QR is right on it."
      >
        {scanOpen && <QrScanner onDecode={onScanDecode} />}
      </Modal>

      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        businessName={business.name}
        onEnrolled={(card, alreadyMember, withStamp) => {
          setEnrollOpen(false);
          setQuery(card.formattedCode);
          toast.success(
            alreadyMember
              ? `Already a member — card ${card.formattedCode} pulled up.`
              : `Enrolled! Their card is ${card.formattedCode}.`,
          );
          if (withStamp) addStamp.mutate(card.id);
        }}
      />

      <Modal
        open={!!redeemTarget}
        onClose={() => setRedeemTarget(null)}
        title="Hand over this reward?"
        description="Only confirm once the customer has actually received it — this is recorded permanently."
      >
        {redeemTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-amber-900">
                <Gift className="size-4 text-amber-500" /> {redeemTarget.reward.rewardText}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {redeemTarget.membership.customer.name ?? 'Customer'} ·{' '}
                {formatPhone(redeemTarget.membership.customer.phone)}
              </p>
              <p className="mt-2 font-mono text-xs tracking-widest text-amber-700">
                Voucher {redeemTarget.reward.formattedCode}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRedeemTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="brand"
                loading={redeem.isPending}
                onClick={() => redeem.mutate(redeemTarget.reward.id)}
              >
                <Check className="size-4" /> Confirm hand-over
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EnrollModal({
  open,
  onClose,
  businessName,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  businessName: string;
  onEnrolled: (card: MembershipListItem, alreadyMember: boolean, withStamp: boolean) => void;
}) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [firstStamp, setFirstStamp] = useState(true);

  const enroll = useMutation({
    mutationFn: () =>
      staffApi.enroll({
        phone,
        name: name.trim() || undefined,
        marketingConsent: consent || undefined,
      }),
    onSuccess: (result) => {
      setPhone('');
      setName('');
      setConsent(false);
      onEnrolled(result.card, result.alreadyMember, firstStamp);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Could not enrol the customer.');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enrol a customer"
      description="Type their phone number — no OTP needed at the counter. They can open their card any time by logging in with that number."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (phone.trim().length >= 6) enroll.mutate();
        }}
      >
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-body">Phone number</label>
          <Input
            autoFocus
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-body">
            Name <span className="font-normal text-muted">optional</span>
          </label>
          <Input placeholder="Asha" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-start gap-2.5 text-[13px] text-body">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand-600"
            checked={firstStamp}
            onChange={(e) => setFirstStamp(e.target.checked)}
          />
          Add their first stamp right away
        </label>
        <label className="flex items-start gap-2.5 text-[13px] text-body">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand-600"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          The customer agreed to receive offers and updates from {businessName}
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            disabled={phone.trim().length < 6}
            loading={enroll.isPending}
          >
            <UserPlus className="size-4" /> Enrol
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Live mm:ss countdown for the undo window; renders nothing once expired. */
function UndoCountdown({
  sinceMs,
  windowSec,
  pending,
  onUndo,
}: {
  sinceMs: number;
  windowSec: number;
  pending: boolean;
  onUndo: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Clamped to the window so a skewed clock can never show a huge countdown.
  const left = Math.min(windowSec, Math.floor(windowSec - (now - sinceMs) / 1000));
  if (left <= 0) return null;
  const label = left > 99 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${left}s`;

  return (
    <Button size="sm" variant="ghost" className="text-muted" loading={pending} onClick={onUndo}>
      <RotateCcw className="size-3.5" /> Undo · {label}
    </Button>
  );
}

function CustomerResult({
  membership,
  role,
  disabled,
  stamping,
  justStamped,
  undoing,
  onStamp,
  onUndo,
  onRedeem,
}: {
  membership: MembershipListItem;
  role: StaffRole;
  disabled: boolean;
  stamping: boolean;
  justStamped: (AddStampResult & { stampedAtMs: number }) | null;
  undoing: boolean;
  onStamp: () => void;
  onUndo: () => void;
  onRedeem: (reward: RedemptionSummary) => void;
}) {
  const m = justStamped ? justStamped.card : membership;
  const pending = m.pendingRewards ?? [];

  // The undo affordance: your own fresh stamp for 60 s — or, for managers,
  // any card stamped in the last 15 min (the server enforces the rules).
  const lastStampMs = m.lastStampAt ? new Date(m.lastStampAt).getTime() : null;
  const undoWindow = justStamped
    ? { sinceMs: justStamped.stampedAtMs, windowSec: role === 'MANAGER' ? MANAGER_UNDO_SEC : STAFF_UNDO_SEC }
    : role === 'MANAGER' && lastStampMs && Date.now() - lastStampMs < MANAGER_UNDO_SEC * 1000
      ? { sinceMs: lastStampMs, windowSec: MANAGER_UNDO_SEC }
      : null;

  return (
    <li>
      <Panel
        className={cn(
          'p-4 transition-shadow',
          justStamped && 'ring-2 ring-brand-200',
          pending.length > 0 && 'border-amber-300',
        )}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold text-strong">
              {m.customer.name ?? 'Unnamed customer'}
              {m.completedCount > 0 && (
                <Badge tone="amber">
                  <Gift className="size-3" /> {m.completedCount}
                </Badge>
              )}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {formatPhone(m.customer.phone)} · <span className="font-mono">{m.formattedCode}</span>
              {m.lastStampAt && <> · last stamp {timeAgo(m.lastStampAt)}</>}
            </p>
            <div className="mt-3">
              <StampGrid
                total={m.stampsRequired}
                filled={m.stampCount}
                size="sm"
                highlightLast={!!justStamped}
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-1.5 sm:flex-none">
            <Button
              size="lg"
              variant="brand"
              className="h-14 min-w-36 rounded-xl text-base"
              disabled={disabled && !stamping}
              loading={stamping}
              onClick={onStamp}
            >
              <Plus className="size-5" /> Add stamp
            </Button>
            {undoWindow && (
              <UndoCountdown
                sinceMs={undoWindow.sinceMs}
                windowSec={undoWindow.windowSec}
                pending={undoing}
                onUndo={onUndo}
              />
            )}
          </div>
        </div>

        {pending.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-amber-100 pt-3">
            {pending.map((reward) => (
              <div
                key={reward.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-3 py-2"
              >
                <Gift className="size-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-amber-900">{reward.rewardText}</p>
                  <p className="font-mono text-[11px] tracking-widest text-amber-700">
                    {reward.formattedCode}
                  </p>
                </div>
                <Button size="sm" variant="brand" onClick={() => onRedeem(reward)}>
                  <Check className="size-4" /> Redeem
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </li>
  );
}
