import { Injectable } from '@nestjs/common';
import {
  AuditActorType,
  CampaignStatus,
  RedemptionStatus,
  StaffRole,
  StampIssuerType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound, tooManyRequests } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { AddStampResultDto, UndoStampResultDto } from './dto/loyalty.dto';
import {
  PENDING_REDEMPTIONS_INCLUDE,
  toMembershipListItemDto,
  toRedemptionSummaryDto,
  toStampDto,
} from './loyalty.presenters';
import { RedemptionsService } from './redemptions.service';

const DOUBLE_TAP_GUARD_SEC = 3;

/** How long after issuing a stamp it can still be taken back. */
export const STAFF_UNDO_WINDOW_SEC = 60;
export const MANAGER_UNDO_WINDOW_SEC = 15 * 60;

@Injectable()
export class StampsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly redemptions: RedemptionsService,
    private readonly audit: AuditService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Adds exactly one stamp. Concurrency-safe:
   *  - a short Redis NX guard absorbs double-taps at the counter;
   *  - the increment is a single atomic UPDATE;
   *  - card completion uses a conditional UPDATE (stampCount >= required),
   *    so two racing stamps can never both claim the same reward.
   */
  async addStamp(params: {
    businessId: string;
    membershipId: string;
    issuerType: StampIssuerType;
    staffId?: string;
  }): Promise<AddStampResultDto> {
    // Tenant-scoped so a foreign business can never observe (or trip) the
    // cooldown of another tenant's membership — they fall through to the
    // ownership check and get a 404.
    const guardKey = `stampguard:${params.businessId}:${params.membershipId}`;
    const acquired = await this.redis.setIfAbsent(guardKey, '1', DOUBLE_TAP_GUARD_SEC);
    if (!acquired) {
      throw tooManyRequests(
        'STAMP_COOLDOWN',
        'Stamp just added — wait a moment before adding another.',
        DOUBLE_TAP_GUARD_SEC,
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const membership = await tx.customerMembership.findFirst({
          where: { id: params.membershipId, businessId: params.businessId },
          include: { campaign: true },
        });
        if (!membership) {
          throw notFound('MEMBERSHIP_NOT_FOUND', 'Customer not found for this business.');
        }
        if (membership.campaign.status !== CampaignStatus.ACTIVE) {
          throw conflict(
            'CAMPAIGN_NOT_ACTIVE',
            'This campaign is paused — stamps cannot be added right now.',
          );
        }
        if (membership.blockedAt) {
          throw conflict(
            'CUSTOMER_BLOCKED',
            'This customer is blocked and cannot earn stamps. Ask the owner.',
          );
        }

        // Fraud rail: cap how many stamps one customer can earn per day.
        // Only standing stamps count — undone ones gave the stamp back.
        const cap = membership.campaign.dailyStampCap;
        if (cap !== null && cap > 0) {
          const since = new Date(Date.now() - 24 * 3_600_000);
          const todayCount = await tx.stamp.count({
            where: {
              membershipId: membership.id,
              issuerType: { not: StampIssuerType.ADJUSTMENT },
              delta: { gt: 0 },
              undoneAt: null,
              createdAt: { gte: since },
            },
          });
          if (todayCount >= cap) {
            throw conflict(
              'DAILY_CAP_REACHED',
              `This customer has already earned the daily maximum of ${cap} stamp${cap === 1 ? '' : 's'}.`,
            );
          }
        }

        const required = membership.campaign.stampsRequired;

        const incremented = await tx.customerMembership.update({
          where: { id: membership.id },
          data: {
            stampCount: { increment: 1 },
            totalStamps: { increment: 1 },
            lastStampAt: new Date(),
          },
        });

        let rewardEarned = false;
        if (incremented.stampCount >= required) {
          const completed = await tx.customerMembership.updateMany({
            where: { id: membership.id, stampCount: { gte: required } },
            data: {
              stampCount: { decrement: required },
              completedCount: { increment: 1 },
            },
          });
          rewardEarned = completed.count === 1;
        }

        const stamp = await tx.stamp.create({
          data: {
            membershipId: membership.id,
            businessId: params.businessId,
            issuerType: params.issuerType,
            staffId: params.staffId ?? null,
            completedCard: rewardEarned,
          },
          include: { staff: true },
        });

        // Completing a card mints the reward voucher in the same
        // transaction — an earned reward can never exist without one.
        const redemption = rewardEarned
          ? await this.redemptions.createForCompletion(tx, {
              membershipId: membership.id,
              businessId: params.businessId,
              rewardText: membership.campaign.reward,
              earnedByStampId: stamp.id,
            })
          : null;

        const fresh = await tx.customerMembership.findUniqueOrThrow({
          where: { id: membership.id },
          include: {
            customer: true,
            campaign: true,
            redemptions: PENDING_REDEMPTIONS_INCLUDE,
          },
        });

        return {
          card: toMembershipListItemDto(fresh),
          rewardEarned,
          reward: membership.campaign.reward,
          stamp: toStampDto(stamp),
          redemption: redemption ? toRedemptionSummaryDto(redemption) : null,
        };
      });
      // Wallet passes refresh outside the transaction, best-effort.
      void this.wallet.cardChanged(params.membershipId);
      return result;
    } catch (e) {
      // Release the guard so a failed attempt can be retried immediately.
      await this.redis.delete(guardKey).catch(() => undefined);
      throw e;
    }
  }

  /**
   * Takes back the most recent stamp on a card — the counter's "oops" button.
   *
   * Ledger semantics: the original row is never deleted. It is marked
   * `undoneAt` and a delta −1 reversal row is appended, so sums stay truthful
   * and the customer's history shows exactly what happened. If the undone
   * stamp had completed the card, the completion is rolled back and its
   * voucher voided — unless the reward was already handed over, in which
   * case the undo is refused.
   *
   * Staff may undo their own stamp within 60 seconds; managers may undo
   * anyone's within 15 minutes.
   */
  async undoLastStamp(params: {
    businessId: string;
    membershipId: string;
    staffId: string;
    staffName: string;
    staffRole: StaffRole;
  }): Promise<UndoStampResultDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.customerMembership.findFirst({
        where: { id: params.membershipId, businessId: params.businessId },
        include: { campaign: true },
      });
      if (!membership) {
        throw notFound('MEMBERSHIP_NOT_FOUND', 'Customer not found for this business.');
      }

      // The newest entry still standing on the card: not undone, and not an
      // undo reversal itself (negative staff rows record past undos).
      const target = await tx.stamp.findFirst({
        where: {
          membershipId: membership.id,
          undoneAt: null,
          NOT: { issuerType: StampIssuerType.STAFF, delta: { lt: 0 } },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!target || target.delta <= 0) {
        throw conflict('NOTHING_TO_UNDO', 'There is no recent stamp to undo on this card.');
      }
      if (target.issuerType === StampIssuerType.ADJUSTMENT) {
        throw conflict(
          'UNDO_NOT_A_STAMP',
          'The latest change was an owner adjustment — only the owner can correct it.',
        );
      }

      const isManager = params.staffRole === StaffRole.MANAGER;
      if (!isManager && target.staffId !== params.staffId) {
        throw conflict(
          'UNDO_NOT_YOURS',
          'Only the person who added this stamp — or a manager — can undo it.',
        );
      }
      const windowSec = isManager ? MANAGER_UNDO_WINDOW_SEC : STAFF_UNDO_WINDOW_SEC;
      const ageSec = (Date.now() - target.createdAt.getTime()) / 1000;
      if (ageSec > windowSec) {
        throw conflict(
          'UNDO_WINDOW_EXPIRED',
          isManager
            ? 'This stamp is older than 15 minutes — ask the owner to adjust the balance.'
            : 'More than a minute has passed — ask a manager to undo it.',
        );
      }

      // Mutex: exactly one undo can claim the row. A racing undo sees 0.
      const claimed = await tx.stamp.updateMany({
        where: { id: target.id, undoneAt: null },
        data: { undoneAt: new Date(), undoneByStaffId: params.staffId },
      });
      if (claimed.count !== 1) {
        throw conflict('ALREADY_UNDONE', 'This stamp was already undone.');
      }

      let voucherVoided = false;
      if (target.completedCard) {
        const voucher = await tx.redemption.findUnique({
          where: { earnedByStampId: target.id },
        });
        if (voucher?.status === RedemptionStatus.REDEEMED) {
          // Throwing rolls back the claim above — nothing is left half-done.
          throw conflict(
            'UNDO_REWARD_REDEEMED',
            'The reward from this stamp was already handed over — the stamp cannot be undone.',
          );
        }
        if (voucher && voucher.status === RedemptionStatus.PENDING) {
          const voided = await tx.redemption.updateMany({
            where: { id: voucher.id, status: RedemptionStatus.PENDING },
            data: {
              status: RedemptionStatus.VOID,
              voidedAt: new Date(),
              voidReason: 'The stamp that completed the card was undone at the counter.',
            },
          });
          if (voided.count !== 1) {
            throw conflict(
              'UNDO_REWARD_REDEEMED',
              'The reward was just redeemed — the stamp cannot be undone.',
            );
          }
          voucherVoided = true;
        }

        const rolledBack = await tx.customerMembership.updateMany({
          where: { id: membership.id, completedCount: { gte: 1 } },
          data: {
            completedCount: { decrement: 1 },
            stampCount: { increment: membership.campaign.stampsRequired - 1 },
            totalStamps: { decrement: 1 },
          },
        });
        if (rolledBack.count !== 1) {
          throw conflict('UNDO_STATE_CHANGED', 'The card changed while undoing — try again.');
        }
      } else {
        const decremented = await tx.customerMembership.updateMany({
          where: { id: membership.id, stampCount: { gte: 1 } },
          data: { stampCount: { decrement: 1 }, totalStamps: { decrement: 1 } },
        });
        if (decremented.count !== 1) {
          throw conflict('UNDO_STATE_CHANGED', 'The card changed while undoing — try again.');
        }
      }

      await tx.stamp.create({
        data: {
          membershipId: membership.id,
          businessId: params.businessId,
          issuerType: StampIssuerType.STAFF,
          staffId: params.staffId,
          delta: -1,
          reason: 'Undo — stamp added by mistake',
        },
      });

      // lastStampAt should point at the newest stamp that still stands.
      const newestStanding = await tx.stamp.findFirst({
        where: { membershipId: membership.id, delta: { gt: 0 }, undoneAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      await tx.customerMembership.update({
        where: { id: membership.id },
        data: { lastStampAt: newestStanding?.createdAt ?? null },
      });

      const fresh = await tx.customerMembership.findUniqueOrThrow({
        where: { id: membership.id },
        include: {
          customer: true,
          campaign: true,
          redemptions: PENDING_REDEMPTIONS_INCLUDE,
        },
      });
      return { card: toMembershipListItemDto(fresh), voucherVoided, targetId: target.id };
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: params.staffId,
      actorLabel: params.staffName,
      action: 'stamp.undone',
      targetType: 'membership',
      targetId: params.membershipId,
      businessId: params.businessId,
      metadata: { stampId: result.targetId, voucherVoided: result.voucherVoided },
    });

    void this.wallet.cardChanged(params.membershipId);
    return { card: result.card, voucherVoided: result.voucherVoided };
  }
}
