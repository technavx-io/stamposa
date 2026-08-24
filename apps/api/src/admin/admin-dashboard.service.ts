import { Injectable } from '@nestjs/common';
import { CampaignStatus, RedemptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  /** Where clicking it should take the operator. */
  href: string;
  count?: number;
}

/**
 * Powers the operator's landing screen. The design principle: the panel
 * opens on a ranked list of things that need a decision today, not a wall
 * of charts. Charts live one tab deeper.
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async overview() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      businessCount,
      suspendedCount,
      newBusinesses30d,
      customerCount,
      stampsTotal,
      stampsToday,
      stamps7d,
      stampsPrev7d,
      pendingRewards,
      activeBusinessIds,
      noCampaignBusinesses,
      suspended,
      recentSignups,
      recentAudit,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.business.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.business.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.customer.count(),
      this.prisma.stamp.count(),
      this.prisma.stamp.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.stamp.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.stamp.count({
        where: {
          createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000), lt: sevenDaysAgo },
        },
      }),
      this.prisma.redemption.count({ where: { status: RedemptionStatus.PENDING } }),
      // Tenants that stamped in the last 7 days.
      this.prisma.stamp.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        distinct: ['businessId'],
        select: { businessId: true },
      }),
      this.prisma.business.findMany({
        where: { campaigns: { none: { status: { not: CampaignStatus.ARCHIVED } } } },
        select: { id: true, name: true, slug: true, createdAt: true },
        take: 10,
      }),
      this.prisma.business.findMany({
        where: { suspendedAt: { not: null } },
        select: { id: true, name: true, suspendedAt: true, suspendedReason: true },
        orderBy: { suspendedAt: 'desc' },
        take: 5,
      }),
      this.prisma.business.findMany({
        select: { id: true, name: true, slug: true, createdAt: true, suspendedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.auditLog.findMany({
        include: { admin: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const activeIds = new Set(activeBusinessIds.map((s) => s.businessId));

    // Tenants that were set up but have gone quiet — the churn signal.
    const silent = await this.prisma.business.findMany({
      where: {
        id: { notIn: [...activeIds].length > 0 ? [...activeIds] : ['__none__'] },
        suspendedAt: null,
        createdAt: { lt: sevenDaysAgo },
        campaigns: { some: { status: CampaignStatus.ACTIVE } },
      },
      select: { id: true, name: true, createdAt: true, _count: { select: { memberships: true } } },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const attention: AttentionItem[] = [];

    if (silent.length > 0) {
      attention.push({
        id: 'silent-merchants',
        severity: 'critical',
        title: `${silent.length} merchant${silent.length === 1 ? '' : 's'} with no activity in 7 days`,
        detail:
          silent.length === 1
            ? `${silent[0].name} has a live programme but no stamps this week.`
            : `${silent.map((s) => s.name).slice(0, 3).join(', ')}${silent.length > 3 ? ` and ${silent.length - 3} more` : ''} have live programmes but no stamps this week.`,
        href: '/admin/merchants?filter=silent',
        count: silent.length,
      });
    }

    if (noCampaignBusinesses.length > 0) {
      attention.push({
        id: 'setup-stalled',
        severity: 'warning',
        title: `${noCampaignBusinesses.length} merchant${noCampaignBusinesses.length === 1 ? '' : 's'} stalled in setup`,
        detail: 'Business profile created but no loyalty programme launched yet.',
        href: '/admin/merchants?filter=no-campaign',
        count: noCampaignBusinesses.length,
      });
    }

    if (suspended.length > 0) {
      attention.push({
        id: 'suspended',
        severity: 'warning',
        title: `${suspendedCount} suspended merchant${suspendedCount === 1 ? '' : 's'}`,
        detail: suspended
          .map((s) => `${s.name}${s.suspendedReason ? ` — ${s.suspendedReason}` : ''}`)
          .slice(0, 2)
          .join(' · '),
        href: '/admin/merchants?filter=suspended',
        count: suspendedCount,
      });
    }

    const redisUp = await this.redis.ping();
    if (!redisUp) {
      attention.push({
        id: 'redis-down',
        severity: 'critical',
        title: 'Redis is unreachable',
        detail: 'Sign-in codes, rate limiting and session revocation are affected.',
        href: '/admin/health',
      });
    }

    if (attention.length === 0) {
      attention.push({
        id: 'all-clear',
        severity: 'info',
        title: 'Nothing needs attention',
        detail: 'No churn signals, no stalled setups, no system alerts. Good day for growth work.',
        href: '/admin/merchants',
      });
    }

    const trendPct =
      stampsPrev7d > 0
        ? Math.round(((stamps7d - stampsPrev7d) / stampsPrev7d) * 100)
        : stamps7d > 0
          ? 100
          : 0;

    return {
      stats: {
        merchants: businessCount,
        activeMerchants: activeIds.size,
        suspendedMerchants: suspendedCount,
        newMerchants30d: newBusinesses30d,
        customers: customerCount,
        stampsTotal,
        stampsToday,
        stamps7d,
        stampsTrendPct: trendPct,
        pendingRewards,
      },
      attention,
      recentSignups: recentSignups.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        createdAt: b.createdAt,
        suspended: b.suspendedAt !== null,
      })),
      recentActivity: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        actorLabel: a.actorLabel,
        targetLabel: a.targetLabel,
        reason: a.reason,
        createdAt: a.createdAt,
      })),
    };
  }
}
