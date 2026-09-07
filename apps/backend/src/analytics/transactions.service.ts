import { Injectable } from '@nestjs/common';
import { Prisma, StampIssuerType } from '@prisma/client';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { formatCode, normalizeCodeInput } from '../common/utils/codes.util';
import { PrismaService } from '../prisma/prisma.service';

export interface TransactionQuery {
  businessId: string;
  search?: string;
  issuerType?: StampIssuerType;
  staffId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface TransactionRow {
  id: string;
  createdAt: Date;
  delta: number;
  reason: string | null;
  completedCard: boolean;
  issuerType: StampIssuerType;
  issuerName: string;
  membershipId: string;
  customerName: string | null;
  customerCode: string;
}

/**
 * The business-wide ledger: every stamp and adjustment, newest first, with
 * the filters a merchant actually reaches for when reconciling a dispute.
 */
@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: TransactionQuery): Promise<PaginatedDto<TransactionRow>> {
    const where: Prisma.StampWhereInput = { businessId: query.businessId };

    if (query.issuerType) where.issuerType = query.issuerType;
    if (query.staffId) where.staffId = query.staffId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const q = query.search?.trim();
    if (q) {
      const filters: Prisma.StampWhereInput[] = [
        { membership: { customer: { name: { contains: q, mode: 'insensitive' } } } },
      ];
      const digits = q.replace(/[^\d]/g, '');
      if (digits.length >= 3) {
        filters.push({ membership: { customer: { phone: { contains: digits } } } });
      }
      const code = normalizeCodeInput(q);
      if (code.length >= 3) filters.push({ membership: { code: { startsWith: code } } });
      where.OR = filters;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stamp.count({ where }),
      this.prisma.stamp.findMany({
        where,
        include: {
          staff: { select: { name: true } },
          membership: { include: { customer: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return PaginatedDto.of(
      rows.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        delta: s.delta,
        reason: s.reason,
        completedCard: s.completedCard,
        issuerType: s.issuerType,
        issuerName: issuerLabel(s.issuerType, s.staff?.name),
        membershipId: s.membershipId,
        customerName: s.membership.customer.name,
        customerCode: formatCode(s.membership.code),
      })),
      total,
      query.page,
      query.limit,
    );
  }

  /** Headline counts for the ledger page, respecting the same filters. */
  async totals(businessId: string, from?: Date, to?: Date) {
    const where: Prisma.StampWhereInput = { businessId };
    if (from || to) {
      where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }
    const [entries, agg, adjustments] = await Promise.all([
      this.prisma.stamp.count({ where }),
      this.prisma.stamp.aggregate({ where, _sum: { delta: true } }),
      this.prisma.stamp.count({ where: { ...where, issuerType: StampIssuerType.ADJUSTMENT } }),
    ]);
    return { entries, netStamps: agg._sum.delta ?? 0, adjustments };
  }
}

export function issuerLabel(type: StampIssuerType, staffName?: string | null): string {
  if (type === StampIssuerType.MERCHANT) return 'Owner';
  if (type === StampIssuerType.ADJUSTMENT) return 'Owner (adjustment)';
  return staffName ?? 'Staff';
}
