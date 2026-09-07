import { Injectable } from '@nestjs/common';
import { Prisma, RedemptionStatus, StampIssuerType } from '@prisma/client';
import { badRequest, conflict, notFound } from '../common/exceptions';
import { PaginatedDto } from '../common/dto/pagination.dto';
import { generateCode, normalizeCodeInput } from '../common/utils/codes.util';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedeemResultDto, RedemptionRowDto } from './dto/loyalty.dto';
import {
  PENDING_REDEMPTIONS_INCLUDE,
  toMembershipListItemDto,
  toRedemptionRowDto,
} from './loyalty.presenters';

const CODE_ATTEMPTS = 3;

@Injectable()
export class RedemptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Mints the voucher for a completed card. Runs inside the stamp
   * transaction, so a crash can never leave an earned reward without its
   * voucher. Uniqueness is pre-checked rather than retried on insert —
   * a unique-violation would abort the surrounding Postgres transaction.
   */
  async createForCompletion(
    tx: Prisma.TransactionClient,
    params: {
      membershipId: string;
      businessId: string;
      rewardText: string;
      earnedByStampId: string;
    },
  ) {
    let code = generateCode();
    for (let i = 0; i < CODE_ATTEMPTS; i++) {
      const taken = await tx.redemption.findUnique({ where: { code }, select: { id: true } });
      if (!taken) break;
      code = generateCode();
    }
    return tx.redemption.create({
      data: {
        code,
        membershipId: params.membershipId,
        businessId: params.businessId,
        rewardText: params.rewardText,
        earnedByStampId: params.earnedByStampId,
      },
    });
  }

  /**
   * Marks a voucher as honoured. Race-safe: the status flip is a conditional
   * UPDATE, so two staff redeeming the same voucher can never both succeed.
   */
  async redeem(params: {
    businessId: string;
    redemptionId?: string;
    code?: string;
    redeemerType: StampIssuerType;
    staffId?: string;
  }): Promise<RedeemResultDto> {
    if (!params.redemptionId && !params.code) {
      throw badRequest('VALIDATION_ERROR', 'Provide a redemptionId or a voucher code.');
    }

    const redemption = await this.prisma.redemption.findFirst({
      where: {
        businessId: params.businessId,
        ...(params.redemptionId
          ? { id: params.redemptionId }
          : { code: normalizeCodeInput(params.code as string) }),
      },
      include: { redeemedStaff: true, membership: { include: { customer: true } } },
    });
    if (!redemption) {
      throw notFound('REDEMPTION_NOT_FOUND', 'No reward voucher matches that.');
    }
    if (redemption.status === RedemptionStatus.REDEEMED) {
      throw conflict(
        'ALREADY_REDEEMED',
        `This reward was already redeemed${redemption.redeemedAt ? ` on ${redemption.redeemedAt.toLocaleDateString('en-IN')}` : ''}.`,
      );
    }

    const flipped = await this.prisma.redemption.updateMany({
      where: { id: redemption.id, status: RedemptionStatus.PENDING },
      data: {
        status: RedemptionStatus.REDEEMED,
        redeemedAt: new Date(),
        redeemedByType: params.redeemerType,
        redeemedStaffId: params.staffId ?? null,
      },
    });
    if (flipped.count !== 1) {
      throw conflict('ALREADY_REDEEMED', 'This reward was just redeemed by someone else.');
    }

    const [fresh, membership] = await Promise.all([
      this.prisma.redemption.findUniqueOrThrow({
        where: { id: redemption.id },
        include: { redeemedStaff: true, membership: { include: { customer: true } } },
      }),
      this.prisma.customerMembership.findUniqueOrThrow({
        where: { id: redemption.membershipId },
        include: {
          customer: true,
          campaign: true,
          redemptions: PENDING_REDEMPTIONS_INCLUDE,
        },
      }),
    ]);

    void this.wallet.cardChanged(redemption.membershipId);
    return {
      redemption: toRedemptionRowDto(fresh),
      card: toMembershipListItemDto(membership),
    };
  }

  async listForBusiness(params: {
    businessId: string;
    status?: RedemptionStatus;
    search?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedDto<RedemptionRowDto>> {
    const where: Prisma.RedemptionWhereInput = { businessId: params.businessId };
    if (params.status) where.status = params.status;

    const q = params.search?.trim() ?? '';
    if (q.length > 0) {
      const filters: Prisma.RedemptionWhereInput[] = [
        { membership: { customer: { name: { contains: q, mode: 'insensitive' } } } },
      ];
      const digits = q.replace(/[^\d]/g, '');
      if (digits.length >= 3) {
        filters.push({ membership: { customer: { phone: { contains: digits } } } });
      }
      const code = normalizeCodeInput(q);
      if (code.length >= 3) {
        filters.push({ code: { startsWith: code } });
        filters.push({ membership: { code: { startsWith: code } } });
      }
      where.OR = filters;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.redemption.count({ where }),
      this.prisma.redemption.findMany({
        where,
        include: { redeemedStaff: true, membership: { include: { customer: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);

    return PaginatedDto.of(rows.map(toRedemptionRowDto), total, params.page, params.limit);
  }
}
