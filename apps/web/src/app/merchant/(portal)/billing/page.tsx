'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Sparkles } from 'lucide-react';
import type { Plan, SubscriptionState, SubscriptionStatus } from '@/lib/api/types';
import { merchantApi, publicApi } from '@/lib/api/endpoints';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { PlanGrid, type Interval } from '@/components/billing/plan-grid';
import { Button } from '@/components/ui/button';
import { Badge, Panel, Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

/** Fallback sales inbox shown only when online checkout isn't configured yet. */
const BILLING_EMAIL = 'hello@stamposa.com';

type PaidTier = 'STARTER' | 'GROWTH' | 'PRO';

const statusTone: Record<SubscriptionStatus, 'brand' | 'green' | 'amber' | 'red' | 'zinc'> = {
  ACTIVE: 'green',
  TRIALING: 'brand', // reads as a positive, on-plan state
  PAST_DUE: 'red',
  CANCELED: 'amber',
  EXPIRED: 'zinc',
};

const statusLabel: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  TRIALING: 'Free trial',
  PAST_DUE: 'Payment due',
  CANCELED: 'Cancels soon',
  EXPIRED: 'Expired',
};

export default function BillingPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();

  const sub = useQuery({
    queryKey: ['merchant', 'subscription'],
    queryFn: merchantApi.subscription,
  });
  const plans = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: publicApi.plans,
    staleTime: 60 * 60 * 1000,
  });

  const checkout = useMutation({
    mutationFn: (v: { tier: PaidTier; interval: Interval }) => merchantApi.subscriptionCheckout(v),
    onSuccess: ({ checkoutUrl }) => {
      // Hand the merchant to Dodo's hosted checkout; the plan flips on webhook.
      window.location.href = checkoutUrl;
    },
    onError: () =>
      toast.error(`Couldn't start checkout. Please try again or email ${BILLING_EMAIL}.`),
  });

  const cancel = useMutation({
    mutationFn: merchantApi.cancelSubscription,
    onSuccess: async () => {
      toast.success('Your plan will end when the current period closes.');
      await qc.invalidateQueries({ queryKey: ['merchant', 'subscription'] });
    },
    onError: () => toast.error("Couldn't cancel the plan. Please try again."),
  });

  // Returning from a completed Dodo checkout — the webhook may land a moment
  // later, so confirm optimistically and refetch.
  useEffect(() => {
    if (params.get('checkout') !== 'success') return;
    toast.success('Payment received — your plan is being activated.');
    void qc.invalidateQueries({ queryKey: ['merchant', 'subscription'] });
    router.replace('/merchant/billing');
  }, [params, qc, router]);

  const onCancel = () => {
    if (window.confirm('Cancel your paid plan? You keep access until the current period ends.')) {
      cancel.mutate();
    }
  };

  return (
    <div>
      <PageHeader
        title="Plan &amp; billing"
        description="Your current plan and everything Stamposa offers as you grow."
      />

      {sub.isError ? (
        <LoadError
          title="Couldn't load your plan"
          error={sub.error}
          onRetry={() => void sub.refetch()}
        />
      ) : sub.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <CurrentPlanCard sub={sub.data} />
      )}

      {plans.isError ? (
        <div className="mt-8">
          <LoadError
            title="Couldn't load plans"
            error={plans.error}
            onRetry={() => void plans.refetch()}
          />
        </div>
      ) : plans.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <section id="all-plans" className="mt-10 scroll-mt-6">
          <h2 className="mb-6 text-lg font-semibold text-strong">All plans</h2>
          <PlanGrid
            plans={plans.data}
            currentTier={sub.data?.effectiveTier}
            defaultInterval={sub.data?.interval ?? 'MONTHLY'}
            renderCta={(plan, interval) => (
              <PlanCta
                plan={plan}
                interval={interval}
                sub={sub.data}
                onCheckout={(tier) => checkout.mutate({ tier, interval })}
                checkoutPendingTier={checkout.isPending ? checkout.variables?.tier : undefined}
                onCancel={onCancel}
                cancelPending={cancel.isPending}
              />
            )}
          />
          <p className="mt-6 text-center text-[13px] text-muted">
            {sub.data?.billingEnabled
              ? 'Prices exclude tax; the exact tax for your location is shown at checkout. Yearly billing gives you two months free.'
              : `Online payments aren't switched on yet — email ${BILLING_EMAIL} to change your plan.`}
          </p>
        </section>
      )}
    </div>
  );
}

function CurrentPlanCard({ sub }: { sub: SubscriptionState }) {
  const trialing = sub.status === 'TRIALING';
  const showRenewal = sub.currentPeriodEnd && (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE');

  const scrollToPlans = () =>
    document.getElementById('all-plans')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Current plan</p>
          <div className="mt-1 flex items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-strong">
              {sub.effectivePlanName}
            </h2>
            <Badge tone={statusTone[sub.status]}>{statusLabel[sub.status]}</Badge>
          </div>
        </div>
        {sub.effectiveTier !== 'PRO' && (
          <Button variant="brand" size="sm" onClick={scrollToPlans} className="shrink-0">
            <Sparkles className="size-4" />
            Upgrade
          </Button>
        )}
      </div>

      {(trialing || showRenewal || sub.cancelAtPeriodEnd) && (
        <div className="mt-5 space-y-2 border-t border-line-soft pt-4 text-[13.5px]">
          {trialing && sub.trialEndsAt && (
            <p className="flex items-center gap-2 text-body">
              <CalendarClock className="size-4 shrink-0 text-brand-600" />
              {sub.trialDaysLeft != null && sub.trialDaysLeft > 0 ? (
                <>
                  <strong className="font-medium text-strong">
                    {sub.trialDaysLeft} {sub.trialDaysLeft === 1 ? 'day' : 'days'} left
                  </strong>{' '}
                  in your free trial — ends {formatDate(sub.trialEndsAt)}.
                </>
              ) : (
                <>Your free trial ends {formatDate(sub.trialEndsAt)}.</>
              )}
            </p>
          )}
          {showRenewal && sub.currentPeriodEnd && !sub.cancelAtPeriodEnd && (
            <p className="flex items-center gap-2 text-body">
              <CalendarClock className="size-4 shrink-0 text-muted" />
              Renews {formatDate(sub.currentPeriodEnd)} · billed{' '}
              {sub.interval === 'YEARLY' ? 'yearly' : 'monthly'}.
            </p>
          )}
          {sub.cancelAtPeriodEnd && sub.currentPeriodEnd && (
            <p className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              Your plan ends {formatDate(sub.currentPeriodEnd)} and won&apos;t renew.
            </p>
          )}
          {sub.status === 'PAST_DUE' && (
            <p className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="size-4 shrink-0" />
              We couldn&apos;t take your last payment. Update it to keep your plan features.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function PlanCta({
  plan,
  interval,
  sub,
  onCheckout,
  checkoutPendingTier,
  onCancel,
  cancelPending,
}: {
  plan: Plan;
  interval: Interval;
  sub?: SubscriptionState;
  onCheckout: (tier: PaidTier) => void;
  checkoutPendingTier?: PaidTier;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  // The current plan renders its own "Current plan" badge inside PlanGrid.
  if (sub && plan.tier === sub.effectiveTier) return null;

  // Billing not configured yet → keep a working "contact us" path.
  if (sub && !sub.billingEnabled) {
    const subject = `Switch my Stamposa plan to ${plan.name} (${interval.toLowerCase()})`;
    return (
      <a href={`mailto:${BILLING_EMAIL}?subject=${encodeURIComponent(subject)}`} className="block">
        <Button variant={plan.recommended ? 'brand' : 'secondary'} className="w-full">
          {plan.tier === 'FREE' ? 'Contact us to downgrade' : `Contact us for ${plan.name}`}
        </Button>
      </a>
    );
  }

  // Downgrade to Free = cancel the paid subscription at period end.
  if (plan.tier === 'FREE') {
    return (
      <Button variant="secondary" className="w-full" onClick={onCancel} disabled={cancelPending}>
        {cancelPending ? 'Cancelling…' : 'Cancel paid plan'}
      </Button>
    );
  }

  const pending = checkoutPendingTier === plan.tier;
  const rank = tierRank(plan.tier) - tierRank(sub?.effectiveTier ?? 'FREE');
  const verb = rank >= 0 ? 'Switch to' : 'Change to';

  return (
    <Button
      variant={plan.recommended ? 'brand' : 'secondary'}
      className="w-full"
      onClick={() => onCheckout(plan.tier as PaidTier)}
      disabled={pending}
    >
      {pending ? 'Redirecting…' : `${verb} ${plan.name}`}
    </Button>
  );
}

function tierRank(tier: Plan['tier']): number {
  return { FREE: 0, STARTER: 1, GROWTH: 2, PRO: 3 }[tier];
}
