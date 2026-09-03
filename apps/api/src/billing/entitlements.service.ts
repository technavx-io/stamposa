import { Injectable } from '@nestjs/common';
import { PlanTier, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Plan, PlanLimits, planFor, TRIAL_PLAN } from './plans';

export interface Entitlements {
  /** The plan the tenant is effectively entitled to right now. */
  tier: PlanTier;
  limits: PlanLimits;
  plan: Plan;
}

/**
 * Resolves what a business can actually do right now. The effective tier is
 * computed from the subscription's status and dates rather than a stored flag,
 * so entitlements are correct the instant a trial or paid period lapses — even
 * before any scheduled job flips the status. An absent subscription is FREE,
 * which keeps the platform safe before/without a backfill.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async forBusiness(businessId: string): Promise<Entitlements> {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    return entitlementsOf(sub);
  }
}

/** Pure resolver — unit-testable without a database. */
export function effectiveTier(sub: Subscription | null): PlanTier {
  if (!sub) return 'FREE';
  const now = Date.now();
  switch (sub.status) {
    case 'TRIALING':
      return sub.trialEndsAt && sub.trialEndsAt.getTime() > now ? TRIAL_PLAN : 'FREE';
    case 'ACTIVE':
    case 'PAST_DUE': // grace period — honour the plan while a retry is pending
      return sub.plan;
    case 'CANCELED':
      return sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now ? sub.plan : 'FREE';
    case 'EXPIRED':
    default:
      return 'FREE';
  }
}

export function entitlementsOf(sub: Subscription | null): Entitlements {
  const tier = effectiveTier(sub);
  const plan = planFor(tier);
  return { tier, limits: plan.limits, plan };
}
