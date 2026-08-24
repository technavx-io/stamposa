import { Injectable, Logger } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditWriteInput {
  actorType: AuditActorType;
  adminId?: string | null;
  actorId?: string | null;
  /** Captured at write time so the entry survives the actor being deleted. */
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  businessId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQuery {
  adminId?: string;
  businessId?: string;
  action?: string;
  search?: string;
  page: number;
  limit: number;
}

/**
 * Append-only activity trail. Writes must never break the action that
 * triggered them, so failures are logged rather than thrown — an action that
 * succeeded should not be reported as failed because its log entry didn't
 * persist. Reads are exposed; there is deliberately no update or delete.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditWriteInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: input.actorType,
          adminId: input.adminId ?? null,
          actorId: input.actorId ?? null,
          actorLabel: input.actorLabel,
          action: input.action,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          targetLabel: input.targetLabel ?? null,
          businessId: input.businessId ?? null,
          reason: input.reason ?? null,
          metadata: input.metadata ?? Prisma.DbNull,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (e) {
      this.logger.error(
        `Failed to write audit entry "${input.action}": ${(e as Error).message}`,
      );
      // A silent audit gap is a compliance problem — page someone.
      Sentry.captureException(e, { tags: { area: 'audit-write', action: input.action } });
    }
  }

  async list(query: AuditQuery): Promise<PaginatedDto<AuditEntryDto>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.adminId) where.adminId = query.adminId;
    if (query.businessId) where.businessId = query.businessId;
    if (query.action) where.action = { startsWith: query.action };

    const q = query.search?.trim();
    if (q) {
      where.OR = [
        { actorLabel: { contains: q, mode: 'insensitive' } },
        { targetLabel: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { admin: { select: { name: true, email: true } }, business: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return PaginatedDto.of(
      rows.map((r) => ({
        id: r.id,
        actorType: r.actorType,
        actorLabel: r.actorLabel,
        adminEmail: r.admin?.email ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel: r.targetLabel,
        businessId: r.businessId,
        businessName: r.business?.name ?? null,
        reason: r.reason,
        metadata: r.metadata as Record<string, unknown> | null,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  /** Distinct action verbs present in the log, for the filter dropdown. */
  async actionTypes(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
      take: 100,
    });
    return rows.map((r) => r.action);
  }
}

export interface AuditEntryDto {
  id: string;
  actorType: AuditActorType;
  actorLabel: string;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  businessId: string | null;
  businessName: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}
