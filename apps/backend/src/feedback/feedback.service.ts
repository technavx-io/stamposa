import { Injectable } from '@nestjs/common';
import {
  FeedbackAuthorType,
  FeedbackCategory,
  FeedbackStatus,
  Prisma,
} from '@prisma/client';
import { AuthActor } from '../auth/auth.types';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface FeedbackMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
  /** App version / page captured at submit time. */
  context?: Record<string, unknown> | null;
}

export interface AdminFeedbackQuery {
  status?: FeedbackStatus;
  authorType?: FeedbackAuthorType;
  search?: string;
  page: number;
  limit: number;
}

/** Shape returned to the admin panel — flattened, business name resolved. */
export interface FeedbackEntryDto {
  id: string;
  authorType: FeedbackAuthorType;
  authorLabel: string;
  businessId: string | null;
  businessName: string | null;
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  status: FeedbackStatus;
  handledByName: string | null;
  handledAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist feedback from a tenant user. Author identity fields (type, id and
   * a display label) are derived from the authenticated actor, never trusted
   * from the request body, and the label is captured now so the entry stays
   * legible if the author is later deleted or anonymised.
   */
  async submit(
    actor: AuthActor,
    input: { category: FeedbackCategory; rating?: number; message: string },
    meta: FeedbackMeta = {},
  ): Promise<{ id: string }> {
    const { authorType, authorId, authorLabel, businessId } = this.identify(actor);

    const metadata: Prisma.InputJsonValue = {
      ...(meta.context ?? {}),
      ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    };

    const row = await this.prisma.feedback.create({
      data: {
        authorType,
        authorId,
        authorLabel,
        businessId,
        category: input.category,
        rating: input.rating ?? null,
        message: input.message.trim(),
        metadata: Object.keys(metadata).length ? metadata : Prisma.DbNull,
      },
      select: { id: true },
    });
    return { id: row.id };
  }

  /** Paginated feedback for the admin panel, newest first. */
  async list(query: AdminFeedbackQuery): Promise<PaginatedDto<FeedbackEntryDto>> {
    const where: Prisma.FeedbackWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.authorType) where.authorType = query.authorType;

    const q = query.search?.trim();
    if (q) {
      where.OR = [
        { authorLabel: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { business: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.findMany({
        where,
        include: {
          business: { select: { name: true } },
          handledBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return PaginatedDto.of(rows.map((r) => this.present(r)), total, query.page, query.limit);
  }

  /** Counts per triage status, for the summary tabs. */
  async statusCounts(): Promise<Record<FeedbackStatus, number>> {
    const grouped = await this.prisma.feedback.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts: Record<FeedbackStatus, number> = { NEW: 0, REVIEWED: 0, RESOLVED: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    return counts;
  }

  /** Move an entry through triage. Records which admin last touched it. */
  async setStatus(id: string, status: FeedbackStatus, adminId: string): Promise<FeedbackEntryDto> {
    const row = await this.prisma.feedback.update({
      where: { id },
      data: {
        status,
        handledById: adminId,
        handledAt: new Date(),
      },
      include: {
        business: { select: { name: true } },
        handledBy: { select: { name: true } },
      },
    });
    return this.present(row);
  }

  private identify(actor: AuthActor): {
    authorType: FeedbackAuthorType;
    authorId: string;
    authorLabel: string;
    businessId: string | null;
  } {
    switch (actor.role) {
      case 'MERCHANT':
        return {
          authorType: 'MERCHANT',
          authorId: actor.merchant.id,
          authorLabel:
            actor.merchant.name || actor.merchant.email || actor.merchant.phone || 'Merchant',
          businessId: actor.merchant.business?.id ?? null,
        };
      case 'STAFF':
        return {
          authorType: 'STAFF',
          authorId: actor.staff.id,
          authorLabel: actor.staff.name || actor.staff.phone || 'Staff',
          businessId: actor.staff.business.id,
        };
      case 'CUSTOMER':
        return {
          authorType: 'CUSTOMER',
          authorId: actor.customer.id,
          authorLabel:
            actor.customer.name || actor.customer.email || actor.customer.phone || 'Customer',
          businessId: null,
        };
    }
  }

  private present(
    r: Prisma.FeedbackGetPayload<{
      include: {
        business: { select: { name: true } };
        handledBy: { select: { name: true } };
      };
    }>,
  ): FeedbackEntryDto {
    return {
      id: r.id,
      authorType: r.authorType,
      authorLabel: r.authorLabel,
      businessId: r.businessId,
      businessName: r.business?.name ?? null,
      category: r.category,
      rating: r.rating,
      message: r.message,
      status: r.status,
      handledByName: r.handledBy?.name ?? null,
      handledAt: r.handledAt,
      createdAt: r.createdAt,
    };
  }
}
