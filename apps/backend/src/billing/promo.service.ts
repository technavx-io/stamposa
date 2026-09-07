import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanTier, Prisma, PromoCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStateDto } from './dto/subscription.dto';
import { toStateDto } from './subscription.service';

/**
 * Redeemable promo codes that grant a business a free run of a plan (e.g. a
 * founding-member offer: the first N businesses get Growth free for 6 months).
 *
 * The grant reuses the trial mechanism — status TRIALING with trialEndsAt set
 * to the end of the free period — so entitlements expire on their own and drop
 * the tenant to Free with no extra scheduling. The redemption cap is enforced
 * by an atomic conditional increment, so exactly maxRedemptions can ever claim.
 */
@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admin ────────────────────────────────────────────────────────────────

  async create(input: {
    code: string;
    tier: PlanTier;
    freeMonths: number;
    maxRedemptions: number;
    expiresAt?: Date | null;
  }): Promise<PromoCode> {
    const code = normalizeCode(input.code);
    const existing = await this.prisma.promoCode.findUnique({ where: { code } });
    if (existing) throw new ConflictException('A promo code with that text already exists.');
    return this.prisma.promoCode.create({
      data: {
        code,
        tier: input.tier,
        freeMonths: input.freeMonths,
        maxRedemptions: input.maxRedemptions,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  list(): Promise<PromoCode[]> {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async setActive(id: string, active: boolean): Promise<PromoCode> {
    try {
      return await this.prisma.promoCode.update({ where: { id }, data: { active } });
    } catch {
      throw new NotFoundException('Promo code not found.');
    }
  }

  // ── Merchant ───────────────────────────────────────────────────────────────

  async redeem(
    businessId: string,
    rawCode: string,
    billingEnabled: boolean,
  ): Promise<SubscriptionStateDto> {
    const code = normalizeCode(rawCode);
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.active) throw new NotFoundException("That code isn't valid.");
    if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('That code has expired.');
    }

    // Don't clobber a live paid subscription with a free grant.
    const current = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (current?.gatewaySubscriptionId) {
      throw new ConflictException(
        'You already have a paid subscription — cancel it before redeeming a code.',
      );
    }

    const trialEndsAt = addMonths(new Date(), promo.freeMonths);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Claim a slot atomically: the update only matches while under the cap,
        // so concurrent redemptions can never exceed maxRedemptions.
        const claimed = await tx.promoCode.updateMany({
          where: { id: promo.id, redeemedCount: { lt: promo.maxRedemptions } },
          data: { redeemedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw new ConflictException('All spots for this code have been claimed.');
        }

        // One promo per business (businessId is unique) — a duplicate throws
        // P2002 and rolls back the increment above.
        await tx.promoRedemption.create({ data: { promoCodeId: promo.id, businessId } });

        await tx.subscription.upsert({
          where: { businessId },
          create: { businessId, plan: promo.tier, status: 'TRIALING', trialEndsAt },
          update: {
            plan: promo.tier,
            status: 'TRIALING',
            trialEndsAt,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' // unique violation on businessId
      ) {
        throw new ConflictException('You have already redeemed a promo code.');
      }
      throw err;
    }

    const sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    return toStateDto(sub, billingEnabled);
  }
}

/** Codes are stored and compared uppercase, trimmed. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}
