'use client';

import type { Plan } from '@stamposa/ui/types/plans';
import { PlanGrid } from '@stamposa/ui/components/plan-grid';

/**
 * Client wrapper around <PlanGrid> for the marketing pricing page. Server
 * components can't pass functions to client components, so the per-plan href
 * builder lives here. Given the two base URLs (login page and billing page —
 * both computed on the server via `appHref` and passed in as plain strings),
 * this emits:
 *   FREE:  loginHref
 *   PAID:  loginHref?next=<billingHref?tier=&interval=>
 */
export function PricingCtas({
  plans,
  loginHref,
  billingHref,
}: {
  plans: Plan[];
  loginHref: string;
  billingHref: string;
}) {
  return (
    <PlanGrid
      plans={plans}
      signupHrefFor={(plan, interval) => {
        if (plan.tier === 'FREE') return loginHref;
        const target = `${billingHref}?tier=${plan.tier}&interval=${interval}`;
        return `${loginHref}?next=${encodeURIComponent(target)}`;
      }}
    />
  );
}
