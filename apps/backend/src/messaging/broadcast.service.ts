import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Business, BroadcastStatus, Prisma } from '@prisma/client';
import { badRequest, forbidden, tooManyRequests } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { broadcastMonthlyLimit } from './broadcast.entitlements';
import {
  BroadcastAudienceDto,
  BroadcastDto,
  CreateBroadcastDto,
  toBroadcastDto,
} from './dto/broadcast.dto';

/** Statuses that consume quota (a FAILED send does not). */
const COUNTED: BroadcastStatus[] = ['QUEUED', 'SENDING', 'SENT'];

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  /** Always-on guard so no plan can spam a customer's lock screen into uninstalling. */
  private static readonly DAILY_CAP = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async audience(business: Business): Promise<BroadcastAudienceDto> {
    const [reach, sentThisMonth] = await Promise.all([
      this.wallet.reachableCount(business.id),
      this.countSince(business.id, startOfMonth()),
    ]);
    return {
      passHolders: reach.passHolders,
      appleDevices: reach.appleDevices,
      googleCards: reach.googleCards,
      sentThisMonth,
      monthlyLimit: broadcastMonthlyLimit(business),
    };
  }

  async list(businessId: string): Promise<BroadcastDto[]> {
    const rows = await this.prisma.broadcast.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toBroadcastDto);
  }

  /**
   * Record and dispatch a broadcast. Returns immediately with a QUEUED row;
   * the wallet fan-out runs in the background and flips the row to SENT/FAILED.
   */
  async send(business: Business, dto: CreateBroadcastDto): Promise<BroadcastDto> {
    if (business.suspendedAt) {
      throw forbidden('BUSINESS_SUSPENDED', 'Your account is paused — contact support.');
    }

    // Anti-spam and plan quota.
    const [sentToday, sentThisMonth] = await Promise.all([
      this.countSince(business.id, startOfDay()),
      this.countSince(business.id, startOfMonth()),
    ]);
    if (sentToday >= BroadcastService.DAILY_CAP) {
      throw tooManyRequests(
        'BROADCAST_DAILY_CAP',
        `You can send up to ${BroadcastService.DAILY_CAP} broadcasts a day. Try again tomorrow.`,
      );
    }
    const limit = broadcastMonthlyLimit(business);
    if (limit !== null && sentThisMonth >= limit) {
      throw forbidden(
        'BROADCAST_LIMIT_REACHED',
        `You've used all ${limit} broadcasts on your plan this month. Upgrade for more.`,
      );
    }

    // Only pass holders can receive a wallet push — block a wasted send.
    const reach = await this.wallet.reachableCount(business.id);
    if (reach.passHolders === 0) {
      throw badRequest(
        'NO_WALLET_AUDIENCE',
        'No customers have added your card to a wallet yet, so there is no one to notify.',
      );
    }

    const row = await this.prisma.broadcast.create({
      data: {
        businessId: business.id,
        title: dto.title,
        body: dto.body,
        recipientCount: reach.passHolders,
      },
    });

    // Fire-and-forget: the response returns now; delivery flips the row later.
    void this.dispatch(row.id, business.id, dto);
    return toBroadcastDto(row);
  }

  private async dispatch(id: string, businessId: string, dto: CreateBroadcastDto): Promise<void> {
    try {
      await this.prisma.broadcast.update({
        where: { id },
        data: { status: 'SENDING' },
      });
      const res = await this.wallet.broadcast(businessId, {
        id,
        title: dto.title,
        body: dto.body,
      });
      await this.prisma.broadcast.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          recipientCount: res.recipientCount,
          appleDevices: res.appleDevices,
          googleNotified: res.googleNotified,
        },
      });
    } catch (e) {
      this.logger.warn(`broadcast ${id} failed: ${(e as Error).message}`);
      Sentry.captureException(e, { tags: { area: 'broadcast' } });
      await this.prisma.broadcast
        .update({
          where: { id },
          data: { status: 'FAILED', error: (e as Error).message.slice(0, 500) },
        })
        .catch(() => undefined);
    }
  }

  private countSince(businessId: string, since: Date): Promise<number> {
    const where: Prisma.BroadcastWhereInput = {
      businessId,
      createdAt: { gte: since },
      status: { in: COUNTED },
    };
    return this.prisma.broadcast.count({ where });
  }
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
