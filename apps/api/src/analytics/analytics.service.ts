import { Injectable } from '@nestjs/common';
import { Business, RedemptionStatus } from '@prisma/client';
import { dayKey, startOfLocalDay } from '../common/utils/timezone.util';
import { PrismaService } from '../prisma/prisma.service';

export type RangeKey = '7d' | '30d' | '90d';

const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '90d': 90 };

/**
 * All merchant reporting. Dates are bucketed in the business's own timezone,
 * so "today" means today at the counter — not UTC midnight.
 *
 * Stamp metrics are net sums of the signed ledger (delta), so owner
 * adjustments count at their true size and an undone stamp cancels out
 * against its reversal instead of inflating the chart.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(business: Business, range: RangeKey) {
    const days = RANGE_DAYS[range];
    const { start, previousStart } = this.window(business.timezone, days);
    const businessId = business.id;

    const [
      stampsNow,
      stampsPrev,
      joinedNow,
      joinedPrev,
      rewardsNow,
      rewardsPrev,
      activeNow,
      totalCustomers,
      pendingRewards,
    ] = await Promise.all([
      this.netStamps(businessId, start),
      this.netStamps(businessId, previousStart, start),
      this.prisma.customerMembership.count({ where: { businessId, createdAt: { gte: start } } }),
      this.prisma.customerMembership.count({
        where: { businessId, createdAt: { gte: previousStart, lt: start } },
      }),
      this.prisma.redemption.count({
        where: { businessId, status: RedemptionStatus.REDEEMED, redeemedAt: { gte: start } },
      }),
      this.prisma.redemption.count({
        where: {
          businessId,
          status: RedemptionStatus.REDEEMED,
          redeemedAt: { gte: previousStart, lt: start },
        },
      }),
      this.prisma.stamp
        .findMany({
          where: {
            businessId,
            createdAt: { gte: start },
            delta: { gt: 0 },
            undoneAt: null,
          },
          distinct: ['membershipId'],
          select: { membershipId: true },
        })
        .then((r) => r.length),
      this.prisma.customerMembership.count({ where: { businessId } }),
      this.prisma.redemption.count({ where: { businessId, status: RedemptionStatus.PENDING } }),
    ]);

    // Repeat rate: of the members active in this window, how many have ever
    // come back more than once. This is the number a merchant actually cares
    // about — is loyalty producing return visits?
    const repeatMembers = await this.prisma.customerMembership.count({
      where: { businessId, totalStamps: { gt: 1 } },
    });

    return {
      range,
      from: start,
      stats: {
        stamps: { value: stampsNow, change: pctChange(stampsNow, stampsPrev) },
        newCustomers: { value: joinedNow, change: pctChange(joinedNow, joinedPrev) },
        rewardsRedeemed: { value: rewardsNow, change: pctChange(rewardsNow, rewardsPrev) },
        activeCustomers: { value: activeNow, change: null },
      },
      totals: {
        customers: totalCustomers,
        repeatCustomers: repeatMembers,
        repeatRatePct:
          totalCustomers > 0 ? Math.round((repeatMembers / totalCustomers) * 100) : 0,
        pendingRewards,
      },
    };
  }

  /** Daily net stamps and join counts for the chart, zero-filled. */
  async series(business: Business, range: RangeKey) {
    const days = RANGE_DAYS[range];
    const { start } = this.window(business.timezone, days);
    const businessId = business.id;

    const [stamps, joins] = await Promise.all([
      this.prisma.stamp.findMany({
        where: { businessId, createdAt: { gte: start } },
        select: { createdAt: true, delta: true },
      }),
      this.prisma.customerMembership.findMany({
        where: { businessId, createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]);

    const buckets = new Map<string, { day: string; stamps: number; joins: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      const key = dayKey(d, business.timezone);
      buckets.set(key, { day: key, stamps: 0, joins: 0 });
    }
    for (const s of stamps) {
      const b = buckets.get(dayKey(s.createdAt, business.timezone));
      if (b) b.stamps += s.delta;
    }
    for (const j of joins) {
      const b = buckets.get(dayKey(j.createdAt, business.timezone));
      if (b) b.joins += 1;
    }
    return [...buckets.values()];
  }

  /** Who comes back most — the list a merchant uses to recognise regulars. */
  async topCustomers(businessId: string, limit = 8) {
    const rows = await this.prisma.customerMembership.findMany({
      where: { businessId, totalStamps: { gt: 0 } },
      include: { customer: { select: { name: true, phone: true, email: true } } },
      orderBy: [{ totalStamps: 'desc' }, { lastStampAt: 'desc' }],
      take: limit,
    });
    return rows.map((m) => ({
      membershipId: m.id,
      name: m.customer.name,
      phone: m.customer.phone,
      email: m.customer.email,
      contact: m.customer.phone ?? m.customer.email ?? '—',
      totalStamps: m.totalStamps,
      completedCount: m.completedCount,
      lastStampAt: m.lastStampAt,
    }));
  }

  /** Per-staff net issuance for the range — drives the leaderboard. */
  async staffPerformance(business: Business, range: RangeKey) {
    const { start } = this.window(business.timezone, RANGE_DAYS[range]);
    const [staff, grouped] = await Promise.all([
      this.prisma.staff.findMany({
        where: { businessId: business.id },
        select: { id: true, name: true, isActive: true, role: true },
      }),
      this.prisma.stamp.groupBy({
        by: ['staffId'],
        where: { businessId: business.id, createdAt: { gte: start }, staffId: { not: null } },
        _sum: { delta: true },
      }),
    ]);
    const counts = new Map(grouped.map((g) => [g.staffId, g._sum.delta ?? 0]));
    return staff
      .map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        role: s.role,
        stamps: counts.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.stamps - a.stamps);
  }

  /** Net stamp movement (sum of signed deltas) in [from, to). */
  private async netStamps(businessId: string, from: Date, to?: Date): Promise<number> {
    const agg = await this.prisma.stamp.aggregate({
      where: { businessId, createdAt: to ? { gte: from, lt: to } : { gte: from } },
      _sum: { delta: true },
    });
    return agg._sum.delta ?? 0;
  }

  /** Start of the window and of the preceding one, aligned to local midnight. */
  private window(timezone: string, days: number) {
    const todayStart = startOfLocalDay(new Date(), timezone);
    const start = new Date(todayStart.getTime() - (days - 1) * 86_400_000);
    const previousStart = new Date(start.getTime() - days * 86_400_000);
    return { start, previousStart };
  }
}

function pctChange(now: number, previous: number): number | null {
  if (previous === 0) return now > 0 ? 100 : null;
  return Math.round(((now - previous) / previous) * 100);
}
