'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import type { Plan, PlanTier } from '@/lib/api/types';
import { cn, formatRupees } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type Interval = 'MONTHLY' | 'YEARLY';

/**
 * The pricing table, shared by the public pricing page and the merchant
 * billing screen. The CTA per plan comes either from `renderCta` (a function,
 * for the client-side merchant screen) or `signupHref` (a plain link, so the
 * public page can stay a server component). At most one is used.
 */
export function PlanGrid({
  plans,
  currentTier,
  renderCta,
  signupHref,
  defaultInterval = 'MONTHLY',
}: {
  plans: Plan[];
  currentTier?: PlanTier;
  renderCta?: (plan: Plan, interval: Interval) => React.ReactNode;
  signupHref?: string;
  defaultInterval?: Interval;
}) {
  const [interval, setInterval] = useState<Interval>(defaultInterval);

  const ctaFor = (plan: Plan) => {
    if (renderCta) return renderCta(plan, interval);
    if (signupHref) {
      return (
        <Link href={signupHref} className="block">
          <Button variant={plan.recommended ? 'brand' : 'secondary'} className="w-full">
            {plan.tier === 'FREE' ? 'Start free' : `Choose ${plan.name}`}
          </Button>
        </Link>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            interval={interval}
            isCurrent={currentTier === plan.tier}
            cta={ctaFor(plan)}
          />
        ))}
      </div>
    </div>
  );
}

function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
      <button
        onClick={() => onChange('MONTHLY')}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          value === 'MONTHLY' ? 'bg-brand-600 text-white' : 'text-muted hover:text-strong',
        )}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange('YEARLY')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          value === 'YEARLY' ? 'bg-brand-600 text-white' : 'text-muted hover:text-strong',
        )}
      >
        Yearly
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            value === 'YEARLY' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700',
          )}
        >
          2 months free
        </span>
      </button>
    </div>
  );
}

function PlanCard({
  plan,
  interval,
  isCurrent,
  cta,
}: {
  plan: Plan;
  interval: Interval;
  isCurrent: boolean;
  cta?: React.ReactNode;
}) {
  const price = interval === 'MONTHLY' ? plan.priceMonthly : plan.priceYearly;
  const free = price === 0;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-surface p-5',
        plan.recommended ? 'border-brand-500 ring-1 ring-brand-500' : 'border-line/80',
      )}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="size-3" /> Most popular
        </span>
      )}

      <h3 className="text-lg font-semibold text-strong">{plan.name}</h3>
      <p className="mt-1 min-h-10 text-[13px] text-muted">{plan.tagline}</p>

      <div className="mt-4 flex items-baseline gap-1">
        {free ? (
          <span className="text-3xl font-bold text-strong">Free</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-strong">{formatRupees(price)}</span>
            <span className="text-sm text-muted">/{interval === 'MONTHLY' ? 'mo' : 'yr'}</span>
          </>
        )}
      </div>
      <p className="mt-1 min-h-4 text-[12px] text-muted">
        {!free && interval === 'MONTHLY' && 'billed monthly · taxes at checkout'}
        {!free && interval === 'YEARLY' && 'billed yearly · taxes at checkout'}
      </p>

      {cta && <div className="mt-4">{isCurrent ? <CurrentBadge /> : cta}</div>}

      <ul className="mt-5 space-y-2.5 text-[13px]">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            {f}
          </li>
        ))}
        {plan.comingSoon.map((f) => (
          <li key={f} className="flex items-start gap-2 text-muted">
            <Check className="mt-0.5 size-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
            <span>
              {f}{' '}
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                soon
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CurrentBadge() {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-center text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
      Current plan
    </div>
  );
}
