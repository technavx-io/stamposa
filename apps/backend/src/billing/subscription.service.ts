import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BillingInterval, PlanTier, Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { effectiveTier } from './entitlements.service';
import { planFor, TRIAL_DAYS, TRIAL_PLAN } from './plans';
import { SubscriptionStateDto } from './dto/subscription.dto';
import { DodoService } from './dodo.service';

/** Prisma client or a transaction client — createTrial can run inside a tx. */
type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dodo: DodoService,
    private readonly appConfig: AppConfigService,
  ) {}

  /**
   * Start a business on the 30-day Growth trial. Idempotent: a business that
   * already has a subscription is left untouched. Safe to call inside the
   * business-creation transaction.
   */
  async createTrial(businessId: string, db: Db = this.prisma): Promise<void> {
    const existing = await db.subscription.findUnique({ where: { businessId } });
    if (existing) return;
    await db.subscription.create({
      data: {
        businessId,
        plan: TRIAL_PLAN,
        status: 'TRIALING',
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  /** The merchant's current subscription state for the billing screen. */
  async stateFor(businessId: string): Promise<SubscriptionStateDto> {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    return toStateDto(sub, this.dodo.enabled);
  }

  /** Whether online checkout is available (Dodo configured). */
  get billingEnabled(): boolean {
    return this.dodo.enabled;
  }

  /**
   * Start a hosted checkout for a paid plan and return the URL to redirect to.
   * The actual plan switch happens later, when Dodo's webhook confirms the
   * subscription is active — we never trust the browser redirect for that.
   */
  async beginCheckout(
    businessId: string,
    tier: PlanTier,
    interval: BillingInterval,
    customer: { email: string; name: string },
  ): Promise<{ checkoutUrl: string }> {
    if (tier === 'FREE') {
      throw new BadRequestException('The Free plan has no checkout — cancel your plan instead.');
    }
    const productId = this.dodo.productId(`${tier}_${interval}`);
    const result = await this.dodo.createSubscriptionCheckout({
      productId,
      customer,
      returnUrl: `${this.appConfig.webAppUrl}/merchant/billing?checkout=success`,
      // Echoed back on every webhook so we can resolve tenant + target plan
      // without reverse-mapping product ids.
      metadata: { businessId, tier, interval },
    });
    return { checkoutUrl: result.checkoutUrl };
  }

  /**
   * Cancel at period end: the merchant keeps their plan until the current
   * period closes, then the webhook drops them to Free. Optimistically flags
   * the row so the UI reflects the pending cancel immediately.
   */
  async cancel(businessId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) throw new NotFoundException('No subscription found.');
    if (!sub.gatewaySubscriptionId) {
      throw new BadRequestException('This plan has no active paid subscription to cancel.');
    }
    await this.dodo.cancelAtPeriodEnd(sub.gatewaySubscriptionId);
    await this.prisma.subscription.update({
      where: { businessId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  /**
   * Apply a verified Dodo webhook event to the tenant's subscription row.
   * Unknown event types are ignored (returns quietly) so new Dodo events
   * never 500 the endpoint and trigger retries.
   */
  async applyWebhookEvent(event: DodoWebhookEvent): Promise<void> {
    const type = event.type;
    if (!type?.startsWith('subscription.')) return;

    const data = event.data ?? {};
    const meta = (data.metadata ?? {}) as Record<string, string>;
    const businessId = meta.businessId;
    const gatewaySubscriptionId = data.subscription_id;

    // Resolve the tenant by our own metadata first, then by the gateway id.
    const sub = businessId
      ? await this.prisma.subscription.findUnique({ where: { businessId } })
      : gatewaySubscriptionId
        ? await this.prisma.subscription.findFirst({ where: { gatewaySubscriptionId } })
        : null;

    if (!sub) {
      this.logger.warn(`Webhook ${type} for unknown tenant (biz=${businessId ?? '?'})`);
      return;
    }

    const tier = isTier(meta.tier) ? meta.tier : sub.plan;
    const interval = isInterval(meta.interval) ? meta.interval : sub.interval;
    const periodEnd = parseDate(data.next_billing_date);

    const patch: Prisma.SubscriptionUpdateInput = {
      gatewaySubscriptionId: gatewaySubscriptionId ?? sub.gatewaySubscriptionId,
      gatewayCustomerId: data.customer?.customer_id ?? sub.gatewayCustomerId,
    };

    switch (type) {
      case 'subscription.active':
      case 'subscription.renewed':
        patch.plan = tier;
        patch.interval = interval;
        patch.status = 'ACTIVE';
        patch.trialEndsAt = null;
        patch.cancelAtPeriodEnd = false;
        if (periodEnd) patch.currentPeriodEnd = periodEnd;
        break;
      case 'subscription.on_hold':
        patch.status = 'PAST_DUE';
        break;
      case 'subscription.cancelled':
        // Access continues until the period end; a later expiry event (or the
        // scheduled downgrade job) drops the plan to Free.
        patch.cancelAtPeriodEnd = true;
        if (periodEnd) patch.currentPeriodEnd = periodEnd;
        break;
      case 'subscription.expired':
        patch.status = 'EXPIRED';
        patch.plan = 'FREE';
        patch.cancelAtPeriodEnd = false;
        break;
      case 'subscription.failed':
        this.logger.warn(`Subscription creation failed for business ${sub.businessId}`);
        return;
      default:
        // subscription.updated and anything new: refresh period/cancel hints only.
        if (typeof data.cancel_at_next_billing_date === 'boolean') {
          patch.cancelAtPeriodEnd = data.cancel_at_next_billing_date;
        }
        if (periodEnd) patch.currentPeriodEnd = periodEnd;
    }

    await this.prisma.subscription.update({ where: { businessId: sub.businessId }, data: patch });
    this.logger.log(`Applied ${type} to business ${sub.businessId}`);
  }
}

/** Loosely-typed Dodo webhook envelope — we read only the fields we need. */
export interface DodoWebhookEvent {
  type?: string;
  data?: {
    subscription_id?: string;
    next_billing_date?: string;
    cancel_at_next_billing_date?: boolean;
    customer?: { customer_id?: string };
    metadata?: Record<string, string>;
  };
}

function isTier(v: unknown): v is PlanTier {
  return v === 'FREE' || v === 'STARTER' || v === 'GROWTH' || v === 'PRO';
}

function isInterval(v: unknown): v is BillingInterval {
  return v === 'MONTHLY' || v === 'YEARLY';
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function toStateDto(sub: Subscription | null, billingEnabled = false): SubscriptionStateDto {
  const tier = effectiveTier(sub);
  return {
    billingEnabled,
    // The plan the tenant pays for (or would renew to); effectiveTier is what
    // they actually get right now — the two differ once a trial/period lapses.
    plan: sub?.plan ?? 'FREE',
    effectiveTier: tier,
    effectivePlanName: planFor(tier).name,
    status: (sub?.status ?? 'EXPIRED') as SubscriptionStatus,
    interval: sub?.interval ?? 'MONTHLY',
    trialEndsAt: sub?.trialEndsAt ?? null,
    trialDaysLeft: sub?.status === 'TRIALING' ? daysUntil(sub.trialEndsAt) : null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
  };
}
