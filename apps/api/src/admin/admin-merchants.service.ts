import { Injectable } from '@nestjs/common';
import {
  AuditActorType,
  CampaignStatus,
  PlatformAdmin,
  Prisma,
  RedemptionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { badRequest, conflict, notFound } from '../common/exceptions';
import { formatCode } from '../common/utils/codes.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { RequestMeta } from './admin-auth.service';

const SILENT_DAYS = 7;
const IMPERSONATION_TTL_MIN = 30;

export type MerchantFilter = 'all' | 'active' | 'silent' | 'suspended' | 'no-campaign';

/** A-D grade summarising tenant health, computed on read. */
function healthGrade(params: {
  suspended: boolean;
  hasCampaign: boolean;
  stamps7d: number;
  stampsPrev7d: number;
  customers: number;
}): { grade: 'A' | 'B' | 'C' | 'D'; reason: string } {
  if (params.suspended) return { grade: 'D', reason: 'Suspended' };
  if (!params.hasCampaign) return { grade: 'D', reason: 'No live programme' };
  if (params.stamps7d === 0) {
    return { grade: 'D', reason: `No stamps in ${SILENT_DAYS} days` };
  }
  if (params.stamps7d < params.stampsPrev7d * 0.6) {
    return { grade: 'C', reason: 'Activity falling week on week' };
  }
  if (params.customers < 10) {
    return { grade: 'B', reason: 'Active but still building a customer base' };
  }
  return { grade: 'A', reason: 'Stamping regularly with a growing base' };
}

@Injectable()
export class AdminMerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
  ) {}

  async list(params: { filter: MerchantFilter; search?: string; page: number; limit: number }) {
    const since = new Date(Date.now() - SILENT_DAYS * 86_400_000);
    const where: Prisma.BusinessWhereInput = {};

    const q = params.search?.trim();
    if (q) {
      const filters: Prisma.BusinessWhereInput[] = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { merchant: { name: { contains: q, mode: 'insensitive' } } },
      ];
      // Only match on phone when the term actually contains digits — an
      // empty digit string would make `contains ""` match every row.
      const digits = q.replace(/[^\d]/g, '');
      if (digits.length >= 3) {
        filters.push({ merchant: { phone: { contains: digits } } });
      }
      where.OR = filters;
    }

    switch (params.filter) {
      case 'suspended':
        where.suspendedAt = { not: null };
        break;
      case 'no-campaign':
        where.campaigns = { none: { status: { not: CampaignStatus.ARCHIVED } } };
        where.suspendedAt = null;
        break;
      case 'active':
        where.suspendedAt = null;
        where.stamps = { some: { createdAt: { gte: since } } };
        break;
      case 'silent':
        where.suspendedAt = null;
        where.stamps = { none: { createdAt: { gte: since } } };
        where.campaigns = { some: { status: CampaignStatus.ACTIVE } };
        break;
    }

    const [total, businesses] = await this.prisma.$transaction([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        include: {
          merchant: { select: { name: true, phone: true } },
          campaigns: {
            where: { status: { not: CampaignStatus.ARCHIVED } },
            select: { name: true, status: true, stampsRequired: true, reward: true },
            take: 1,
          },
          _count: { select: { memberships: true, staff: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);

    // Activity counts for just this page of tenants.
    const ids = businesses.map((b) => b.id);
    const [recent, previous] = ids.length
      ? await Promise.all([
          this.prisma.stamp.groupBy({
            by: ['businessId'],
            where: { businessId: { in: ids }, createdAt: { gte: since } },
            _count: true,
          }),
          this.prisma.stamp.groupBy({
            by: ['businessId'],
            where: {
              businessId: { in: ids },
              createdAt: {
                gte: new Date(Date.now() - 2 * SILENT_DAYS * 86_400_000),
                lt: since,
              },
            },
            _count: true,
          }),
        ])
      : [[], []];

    const recentMap = new Map(recent.map((r) => [r.businessId, r._count]));
    const prevMap = new Map(previous.map((r) => [r.businessId, r._count]));

    const items = businesses.map((b) => {
      const stamps7d = recentMap.get(b.id) ?? 0;
      const stampsPrev7d = prevMap.get(b.id) ?? 0;
      const campaign = b.campaigns[0] ?? null;
      const health = healthGrade({
        suspended: b.suspendedAt !== null,
        hasCampaign: campaign !== null,
        stamps7d,
        stampsPrev7d,
        customers: b._count.memberships,
      });
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoPath ? `${this.config.apiPublicUrl}${b.logoPath}` : null,
        ownerName: b.merchant.name,
        ownerPhone: b.merchant.phone,
        campaignName: campaign?.name ?? null,
        campaignStatus: campaign?.status ?? null,
        customers: b._count.memberships,
        staff: b._count.staff,
        stamps7d,
        health: health.grade,
        healthReason: health.reason,
        suspended: b.suspendedAt !== null,
        suspendedReason: b.suspendedReason,
        createdAt: b.createdAt,
      };
    });

    return PaginatedDto.of(items, total, params.page, params.limit);
  }

  async detail(businessId: string) {
    const since = new Date(Date.now() - SILENT_DAYS * 86_400_000);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        merchant: true,
        suspendedBy: { select: { name: true, email: true } },
        campaigns: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { memberships: true } } },
        },
        staff: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { stampsIssued: true } } },
        },
        _count: { select: { memberships: true, stamps: true } },
      },
    });
    if (!business) throw notFound('MERCHANT_NOT_FOUND', 'Merchant not found.');

    const [stamps7d, stampsPrev7d, pendingRewards, redeemedRewards, lastStamp] = await Promise.all([
      this.prisma.stamp.count({ where: { businessId, createdAt: { gte: since } } }),
      this.prisma.stamp.count({
        where: {
          businessId,
          createdAt: { gte: new Date(Date.now() - 2 * SILENT_DAYS * 86_400_000), lt: since },
        },
      }),
      this.prisma.redemption.count({ where: { businessId, status: RedemptionStatus.PENDING } }),
      this.prisma.redemption.count({ where: { businessId, status: RedemptionStatus.REDEEMED } }),
      this.prisma.stamp.findFirst({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const liveCampaign = business.campaigns.find((c) => c.status !== CampaignStatus.ARCHIVED) ?? null;
    const health = healthGrade({
      suspended: business.suspendedAt !== null,
      hasCampaign: liveCampaign !== null,
      stamps7d,
      stampsPrev7d,
      customers: business._count.memberships,
    });

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl: business.logoPath ? `${this.config.apiPublicUrl}${business.logoPath}` : null,
      address: business.address,
      phone: business.phone,
      joinUrl: `${this.config.webAppUrl}/join/${business.slug}`,
      adminNotes: business.adminNotes,
      owner: {
        id: business.merchant.id,
        name: business.merchant.name,
        phone: business.merchant.phone,
        joinedAt: business.merchant.createdAt,
      },
      suspended: business.suspendedAt !== null,
      suspendedAt: business.suspendedAt,
      suspendedReason: business.suspendedReason,
      suspendedBy: business.suspendedBy?.name ?? null,
      health: health.grade,
      healthReason: health.reason,
      stats: {
        customers: business._count.memberships,
        staff: business.staff.length,
        stampsTotal: business._count.stamps,
        stamps7d,
        stampsPrev7d,
        pendingRewards,
        redeemedRewards,
        lastStampAt: lastStamp?.createdAt ?? null,
      },
      campaigns: business.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        stampsRequired: c.stampsRequired,
        reward: c.reward,
        status: c.status,
        members: c._count.memberships,
        createdAt: c.createdAt,
      })),
      staff: business.staff.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        isActive: s.isActive,
        stampsIssued: s._count.stampsIssued,
        createdAt: s.createdAt,
      })),
      createdAt: business.createdAt,
    };
  }

  /** Recent tenant customers — counts and codes only, deliberately no PII browsing. */
  async customers(businessId: string, page: number, limit: number) {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customerMembership.count({ where: { businessId } }),
      this.prisma.customerMembership.findMany({
        where: { businessId },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return PaginatedDto.of(
      rows.map((m) => ({
        id: m.id,
        code: formatCode(m.code),
        name: m.customer.name,
        stampCount: m.stampCount,
        completedCount: m.completedCount,
        totalStamps: m.totalStamps,
        lastStampAt: m.lastStampAt,
        joinedAt: m.createdAt,
      })),
      total,
      page,
      limit,
    );
  }

  async suspend(admin: PlatformAdmin, businessId: string, reason: string, meta: RequestMeta) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw notFound('MERCHANT_NOT_FOUND', 'Merchant not found.');
    if (business.suspendedAt) {
      throw conflict('ALREADY_SUSPENDED', 'This merchant is already suspended.');
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { suspendedAt: new Date(), suspendedReason: reason, suspendedById: admin.id },
    });
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'merchant.suspended',
      targetType: 'business',
      targetId: businessId,
      targetLabel: business.name,
      businessId,
      reason,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { suspended: true, suspendedAt: updated.suspendedAt, reason };
  }

  async reactivate(admin: PlatformAdmin, businessId: string, meta: RequestMeta) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw notFound('MERCHANT_NOT_FOUND', 'Merchant not found.');
    if (!business.suspendedAt) {
      throw conflict('NOT_SUSPENDED', 'This merchant is not suspended.');
    }

    await this.prisma.business.update({
      where: { id: businessId },
      data: { suspendedAt: null, suspendedReason: null, suspendedById: null },
    });
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'merchant.reactivated',
      targetType: 'business',
      targetId: businessId,
      targetLabel: business.name,
      businessId,
      reason: `Previously: ${business.suspendedReason ?? 'no reason recorded'}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { suspended: false };
  }

  async updateNotes(admin: PlatformAdmin, businessId: string, notes: string, meta: RequestMeta) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw notFound('MERCHANT_NOT_FOUND', 'Merchant not found.');

    await this.prisma.business.update({
      where: { id: businessId },
      data: { adminNotes: notes || null },
    });
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'merchant.notes_updated',
      targetType: 'business',
      targetId: businessId,
      targetLabel: business.name,
      businessId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { adminNotes: notes || null };
  }

  /**
   * Mints a real merchant session for support purposes. Deliberately short,
   * reason-mandatory, and written to the audit trail before the token is
   * handed over — an unlogged impersonation must be impossible.
   */
  async impersonate(admin: PlatformAdmin, businessId: string, reason: string, meta: RequestMeta) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { merchant: true },
    });
    if (!business) throw notFound('MERCHANT_NOT_FOUND', 'Merchant not found.');
    if (reason.trim().length < 8) {
      throw badRequest('REASON_REQUIRED', 'Give a reason of at least 8 characters.');
    }

    const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MIN * 60_000);
    const session = await this.prisma.impersonationSession.create({
      data: { adminId: admin.id, businessId, reason, expiresAt },
    });
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: admin.id,
      actorLabel: admin.email,
      action: 'merchant.impersonated',
      targetType: 'business',
      targetId: businessId,
      targetLabel: business.name,
      businessId,
      reason,
      metadata: { sessionId: session.id, expiresAt: expiresAt.toISOString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const tokens = await this.tokens.issueSession('MERCHANT', business.merchantId, {
      impersonation: {
        sessionId: session.id,
        adminLabel: admin.email,
        expiresAt: expiresAt.toISOString(),
      },
    });
    return {
      sessionId: session.id,
      expiresAt,
      businessName: business.name,
      ownerName: business.merchant.name,
      tokens,
    };
  }

  async endImpersonation(admin: PlatformAdmin, sessionId: string) {
    await this.prisma.impersonationSession.updateMany({
      where: { id: sessionId, adminId: admin.id, endedAt: null },
      data: { endedAt: new Date() },
    });
    return { ended: true };
  }
}
