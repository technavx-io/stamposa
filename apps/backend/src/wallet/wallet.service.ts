import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { RedemptionStatus } from '@prisma/client';
import { notFound } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { ApplePassService, PassMembership } from './apple-pass.service';
import { renderCardBanner, readUploadedImage } from './stamp-card-image';
import { AppConfigService } from '../config/app-config.service';
import { ApplePushService } from './apple-push.service';
import { GoogleWalletService } from './google-wallet.service';
import { resolveCardStyle } from '../loyalty/card-style.util';

/**
 * Ties the two wallets to the loyalty domain. Loyalty services call
 * `cardChanged()` after any balance/reward change; from there Apple devices
 * get an APNs nudge (they then re-fetch the pass) and Google gets a PATCH
 * (they fan out themselves). All of it is best-effort and never blocks or
 * fails the counter flow.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apple: ApplePassService,
    private readonly google: GoogleWalletService,
    private readonly push: ApplePushService,
    private readonly config: AppConfigService,
  ) {}

  availability() {
    return {
      apple: { available: this.apple.enabled },
      google: { available: this.google.enabled },
    };
  }

  /** Membership in the exact shape pass builders need (pending vouchers only). */
  async passMembership(membershipId: string, customerId?: string): Promise<PassMembership> {
    const m = await this.prisma.customerMembership.findFirst({
      where: { id: membershipId, ...(customerId ? { customerId } : {}) },
      include: {
        business: true,
        campaign: true,
        customer: true,
        redemptions: {
          where: { status: RedemptionStatus.PENDING },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!m) throw notFound('CARD_NOT_FOUND', 'Card not found.');
    return m;
  }

  /** The stamp-progress banner PNG for a card — the Google hero image. */
  async heroImage(membershipId: string): Promise<Buffer> {
    const m = await this.passMembership(membershipId);
    const style = resolveCardStyle(m.campaign, m.business, this.config.apiPublicUrl);
    const backgroundImage = style.cardImagePath
      ? readUploadedImage(this.config.uploadDir, style.cardImagePath)
      : null;
    return renderCardBanner({
      stampCount: m.stampCount,
      stampsRequired: m.campaign.stampsRequired,
      brandColorHex: style.color,
      stampIcon: style.stampIcon,
      rewardIcon: style.rewardIcon,
      backgroundImage,
      imageTinted: style.imageTinted,
      width: 1032,
      height: 336,
    });
  }

  /** The WalletPass row for a card, created on first use. */
  async ensurePass(membershipId: string) {
    const existing = await this.prisma.walletPass.findUnique({ where: { membershipId } });
    if (existing) return existing;
    return this.prisma.walletPass
      .create({
        data: { membershipId, appleAuthToken: randomBytes(24).toString('hex') },
      })
      .catch(async (e) => {
        // Two devices racing on first download — keep the winner's row.
        const raced = await this.prisma.walletPass.findUnique({ where: { membershipId } });
        if (raced) return raced;
        throw e;
      });
  }

  async buildApplePass(membershipId: string, customerId?: string): Promise<Buffer> {
    const m = await this.passMembership(membershipId, customerId);
    const pass = await this.ensurePass(m.id);
    return this.apple.buildPkpass(m, pass.appleAuthToken);
  }

  async googleSaveLink(membershipId: string, customerId: string) {
    const m = await this.passMembership(membershipId, customerId);
    const pass = await this.ensurePass(m.id);
    const { saveUrl, objectId } = await this.google.saveLink(m);
    if (pass.googleObjectId !== objectId) {
      await this.prisma.walletPass.update({
        where: { id: pass.id },
        data: { googleObjectId: objectId },
      });
    }
    return { saveUrl };
  }

  /** Passes reachable by a wallet push right now, for the merchant's audience count. */
  async reachableCount(businessId: string): Promise<{ passHolders: number; appleDevices: number; googleCards: number }> {
    const passes = await this.prisma.walletPass.findMany({
      where: { membership: { businessId } },
      include: { registrations: true },
    });
    let appleDevices = 0;
    let googleCards = 0;
    let passHolders = 0;
    for (const p of passes) {
      const reachable = p.registrations.length > 0 || p.googleObjectId !== null;
      if (reachable) passHolders++;
      appleDevices += p.registrations.length;
      if (p.googleObjectId) googleCards++;
    }
    return { passHolders, appleDevices, googleCards };
  }

  /**
   * Membership ids that both (a) have a wallet pass reachable by a push and
   * (b) currently hold at least one PENDING+non-expired redemption voucher.
   * Used to target the "you have an unclaimed reward" broadcast.
   */
  async rewardHolderMembershipIds(businessId: string): Promise<string[]> {
    const rows = await this.prisma.customerMembership.findMany({
      where: {
        businessId,
        walletPass: { isNot: null },
        redemptions: {
          some: {
            status: 'PENDING',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
      select: {
        id: true,
        walletPass: {
          select: {
            id: true,
            googleObjectId: true,
            registrations: { select: { id: true } },
          },
        },
      },
    });
    // Only those actually reachable (Apple registration OR Google object).
    return rows
      .filter(
        (m) =>
          m.walletPass &&
          ((m.walletPass.registrations.length ?? 0) > 0 || m.walletPass.googleObjectId !== null),
      )
      .map((m) => m.id);
  }

  /**
   * Push a merchant broadcast to every wallet pass of a business. Apple has no
   * free-form push, so the message is stored on the business (rendered as the
   * pass's "Latest news" field), every pass is bumped, and each device gets an
   * APNs nudge to re-fetch — iOS then shows the changed field as a lock-screen
   * notification. Google fans out from one class addMessage. Best-effort:
   * a platform outage yields lower tallies, never a thrown error.
   */
  async broadcast(
    businessId: string,
    message: { id: string; title: string; body: string },
    opts?: {
      /**
       * When present, restrict the fan-out to these membership ids. Used by
       * segmented broadcasts (e.g. reward-holders). When omitted, every pass
       * for the business is reached — the original ALL_PASS_HOLDERS behaviour.
       */
      membershipIds?: string[];
      /**
       * When true, skip the Google class addMessage — a class message fans
       * out to every object in the class regardless of segment, so we skip
       * it when the caller wants a targeted send. Per-object bumps still
       * happen via cardChanged for each membership on the caller's side.
       */
      skipGoogleClassMessage?: boolean;
    },
  ): Promise<{ recipientCount: number; appleDevices: number; googleNotified: boolean }> {
    // Store the text first: Apple rebuilds the pass on fetch and reads this.
    await this.prisma.business.update({
      where: { id: businessId },
      data: { walletMessage: message.body, walletMessageUpdatedAt: new Date() },
    });

    const passes = await this.prisma.walletPass.findMany({
      where: {
        membership: { businessId },
        ...(opts?.membershipIds ? { membershipId: { in: opts.membershipIds } } : {}),
      },
      include: { registrations: true },
    });

    const appleTokens = passes.flatMap((p) => p.registrations.map((r) => r.pushToken));
    const hasGoogle = passes.some((p) => p.googleObjectId !== null);
    const recipientCount = passes.filter(
      (p) => p.registrations.length > 0 || p.googleObjectId !== null,
    ).length;

    // Bump every pass so Apple devices see a fresh version on re-fetch.
    if (passes.length > 0) {
      await this.prisma.walletPass.updateMany({
        where: { id: { in: passes.map((p) => p.id) } },
        data: { appleUpdatedAt: new Date() },
      });
    }

    if (this.apple.enabled && appleTokens.length > 0) {
      await this.push.notify(appleTokens);
    }

    let googleNotified = false;
    if (this.google.enabled && hasGoogle && !opts?.skipGoogleClassMessage) {
      googleNotified = await this.google.classMessage(businessId, {
        id: message.id,
        header: message.title,
        body: message.body,
      });
    }

    return { recipientCount, appleDevices: appleTokens.length, googleNotified };
  }

  /**
   * Fire-and-forget fan-out after a card changes. Call OUTSIDE the domain
   * transaction (`void wallet.cardChanged(id)`).
   */
  async cardChanged(membershipId: string): Promise<void> {
    try {
      const pass = await this.prisma.walletPass.findUnique({
        where: { membershipId },
        include: { registrations: true },
      });
      if (!pass) return; // No wallet ever requested for this card.

      await this.prisma.walletPass.update({
        where: { id: pass.id },
        data: { appleUpdatedAt: new Date() },
      });

      if (this.apple.enabled && pass.registrations.length > 0) {
        await this.push.notify(pass.registrations.map((r) => r.pushToken));
      }
      if (this.google.enabled && pass.googleObjectId) {
        const m = await this.passMembership(membershipId);
        await this.google.syncObject(m);
      }
    } catch (e) {
      this.logger.warn(`wallet sync failed for ${membershipId}: ${(e as Error).message}`);
      Sentry.captureException(e, { tags: { area: 'wallet-sync' } });
    }
  }
}
