import { Injectable } from '@nestjs/common';
import { AuditActorType, Merchant, StampIssuerType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/exceptions';
import { formatCode } from '../common/utils/codes.util';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { MembershipDetailDto } from './dto/loyalty.dto';
import { PENDING_REDEMPTIONS_INCLUDE, toMembershipDetailDto } from './loyalty.presenters';
import { RedemptionsService } from './redemptions.service';

const MAX_ADJUSTMENT = 50;

interface ActorMeta {
  merchant: Merchant;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Merchant-side customer management: the notes, tags, corrections and blocks
 * an owner needs when a real person is standing in front of them disputing
 * their balance.
 */
@Injectable()
export class CustomerCrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redemptions: RedemptionsService,
    private readonly wallet: WalletService,
  ) {}

  async updateProfile(
    businessId: string,
    membershipId: string,
    input: { notes?: string; tags?: string[] },
    actor: ActorMeta,
  ): Promise<MembershipDetailDto> {
    const existing = await this.owned(businessId, membershipId);

    const updated = await this.prisma.customerMembership.update({
      where: { id: existing.id },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.tags !== undefined
          ? { tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12) }
          : {}),
      },
      include: { customer: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
    });

    await this.audit.record({
      actorType: AuditActorType.MERCHANT,
      actorId: actor.merchant.id,
      actorLabel: actor.merchant.name,
      action: 'customer.profile_updated',
      targetType: 'membership',
      targetId: membershipId,
      targetLabel: formatCode(existing.code),
      businessId,
      metadata: { fields: Object.keys(input) },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toMembershipDetailDto(updated);
  }

  /**
   * Corrects a balance by ±N with a mandatory reason. Recorded as a ledger
   * entry, never a silent field edit, so the customer's history stays true.
   * A positive adjustment that completes the card mints a voucher exactly
   * like a normal stamp would.
   */
  async adjustBalance(
    businessId: string,
    membershipId: string,
    delta: number,
    reason: string,
    actor: ActorMeta,
  ) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw badRequest('INVALID_ADJUSTMENT', 'Enter a whole number other than zero.');
    }
    if (Math.abs(delta) > MAX_ADJUSTMENT) {
      throw badRequest(
        'ADJUSTMENT_TOO_LARGE',
        `Adjustments are capped at ${MAX_ADJUSTMENT} stamps at a time.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.customerMembership.findFirst({
        where: { id: membershipId, businessId },
        include: { campaign: true },
      });
      if (!membership) throw notFound('MEMBERSHIP_NOT_FOUND', 'Customer not found.');

      const required = membership.campaign.stampsRequired;
      // A negative adjustment can never push the visible card below zero.
      if (delta < 0 && membership.stampCount + delta < 0) {
        throw badRequest(
          'ADJUSTMENT_BELOW_ZERO',
          `This customer has ${membership.stampCount} stamp${membership.stampCount === 1 ? '' : 's'} on their current card.`,
        );
      }

      const incremented = await tx.customerMembership.update({
        where: { id: membership.id },
        data: {
          stampCount: { increment: delta },
          totalStamps: { increment: delta },
          ...(delta > 0 ? { lastStampAt: new Date() } : {}),
        },
      });

      let rewardEarned = false;
      if (incremented.stampCount >= required) {
        const completed = await tx.customerMembership.updateMany({
          where: { id: membership.id, stampCount: { gte: required } },
          data: { stampCount: { decrement: required }, completedCount: { increment: 1 } },
        });
        rewardEarned = completed.count === 1;
      }

      const entry = await tx.stamp.create({
        data: {
          membershipId: membership.id,
          businessId,
          issuerType: StampIssuerType.ADJUSTMENT,
          delta,
          reason,
          completedCard: rewardEarned,
        },
      });

      if (rewardEarned) {
        await this.redemptions.createForCompletion(tx, {
          membershipId: membership.id,
          businessId,
          rewardText: membership.campaign.reward,
          earnedByStampId: entry.id,
        });
      }

      const fresh = await tx.customerMembership.findUniqueOrThrow({
        where: { id: membership.id },
        include: { customer: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
      });
      return { card: toMembershipDetailDto(fresh), rewardEarned, code: membership.code };
    });

    void this.wallet.cardChanged(membershipId);
    await this.audit.record({
      actorType: AuditActorType.MERCHANT,
      actorId: actor.merchant.id,
      actorLabel: actor.merchant.name,
      action: 'customer.balance_adjusted',
      targetType: 'membership',
      targetId: membershipId,
      targetLabel: formatCode(result.code),
      businessId,
      reason,
      metadata: { delta, rewardEarned: result.rewardEarned },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { card: result.card, rewardEarned: result.rewardEarned };
  }

  async setBlocked(
    businessId: string,
    membershipId: string,
    blocked: boolean,
    reason: string | undefined,
    actor: ActorMeta,
  ): Promise<MembershipDetailDto> {
    const existing = await this.owned(businessId, membershipId);
    if (blocked && existing.blockedAt) {
      throw conflict('ALREADY_BLOCKED', 'This customer is already blocked.');
    }
    if (blocked && (!reason || reason.trim().length < 4)) {
      throw badRequest('REASON_REQUIRED', 'Give a short reason for blocking.');
    }

    const updated = await this.prisma.customerMembership.update({
      where: { id: existing.id },
      data: blocked
        ? { blockedAt: new Date(), blockedReason: reason!.trim() }
        : { blockedAt: null, blockedReason: null },
      include: { customer: true, campaign: true, redemptions: PENDING_REDEMPTIONS_INCLUDE },
    });

    await this.audit.record({
      actorType: AuditActorType.MERCHANT,
      actorId: actor.merchant.id,
      actorLabel: actor.merchant.name,
      action: blocked ? 'customer.blocked' : 'customer.unblocked',
      targetType: 'membership',
      targetId: membershipId,
      targetLabel: formatCode(existing.code),
      businessId,
      reason: reason ?? null,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toMembershipDetailDto(updated);
  }

  /** Consent history for one member, newest first. */
  async consentHistory(businessId: string, membershipId: string) {
    const membership = await this.owned(businessId, membershipId);
    const rows = await this.prisma.consent.findMany({
      where: { businessId, customerId: membership.customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((c) => ({
      id: c.id,
      granted: c.granted,
      text: c.text,
      textVersion: c.textVersion,
      channel: c.channel,
      createdAt: c.createdAt,
    }));
  }

  private async owned(businessId: string, membershipId: string) {
    const membership = await this.prisma.customerMembership.findFirst({
      where: { id: membershipId, businessId },
    });
    if (!membership) throw notFound('MEMBERSHIP_NOT_FOUND', 'Customer not found.');
    return membership;
  }
}
