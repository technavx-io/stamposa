'use client';

import type { Plan } from '@stamposa/ui/types/plans';
import { PlanGrid } from '@stamposa/ui/components/plan-grid';

/**
 * Client wrapper around <PlanGrid> for the marketing pricing page. Server
 * components can't pass functions to client components, so the per-plan href
 * builder lives here.
 *
 * `loginHref` is the FULL cross-origin URL to the app's login page (built
 * server-side via `appHref`, so this component doesn't have to know the app
 * origin). `nextPath` MUST be a bare in-app path (leading `/`, no origin, no
 * protocol) — the merchant login page's safeNext guard rejects absolute URLs
 * to prevent open redirects, so passing a full URL here would silently break
 * the redirect.
 */
export function PricingCtas({
  plans,
  loginHref,
}: {
  plans: Plan[];
  loginHref: string;
}) {
  return (
    <PlanGrid
      plans={plans}
      signupHrefFor={(plan, interval) => {
        if (plan.tier === 'FREE') return loginHref;
        const nextPath = `/merchant/billing?tier=${plan.tier}&interval=${interval}`;
        return `${loginHref}?next=${encodeURIComponent(nextPath)}`;
      }}
    />
  );
}
