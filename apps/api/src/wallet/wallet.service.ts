import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { RedemptionStatus } from '@prisma/client';
import { notFound } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { ApplePassService, PassMembership } from './apple-pass.service';
import { renderStampCard } from './stamp-card-image';
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
    return renderStampCard({
      stampCount: m.stampCount,
      stampsRequired: m.campaign.stampsRequired,
      brandColorHex: style.color,
      stampIcon: style.stampIcon,
      rewardIcon: style.rewardIcon,
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
