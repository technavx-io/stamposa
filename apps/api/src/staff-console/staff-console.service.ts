import { Injectable } from '@nestjs/common';
import { RedemptionStatus, Staff, StaffRole } from '@prisma/client';
import { startOfLocalDay } from '../common/utils/timezone.util';
import { PrismaService } from '../prisma/prisma.service';

export interface TodaySummary {
  /** The calling staff member's own day. Stamps are net (undos subtract). */
  mine: { stamps: number; redemptions: number };
  /** Whole-counter numbers — managers only. */
  totals: { stamps: number; newCustomers: number; rewardsRedeemed: number } | null;
  /** Per-person breakdown — managers only. */
  team: { id: string; name: string; stamps: number; redemptions: number }[] | null;
}

@Injectable()
export class StaffConsoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The console's "how is today going" strip. Everyone sees their own
   * numbers; managers also see the counter's total and the team breakdown.
   */
  async today(staff: Staff & { business: { timezone: string } }): Promise<TodaySummary> {
    const start = startOfLocalDay(new Date(), staff.business.timezone);
    const businessId = staff.businessId;

    const [stampsByStaff, redemptionsByStaff] = await Promise.all([
      this.prisma.stamp.groupBy({
        by: ['staffId'],
        where: { businessId, createdAt: { gte: start }, staffId: { not: null } },
        _sum: { delta: true },
      }),
      this.prisma.redemption.groupBy({
        by: ['redeemedStaffId'],
        where: {
          businessId,
          status: RedemptionStatus.REDEEMED,
          redeemedAt: { gte: start },
          redeemedStaffId: { not: null },
        },
        _count: true,
      }),
    ]);

    const stampsFor = new Map(stampsByStaff.map((g) => [g.staffId, g._sum.delta ?? 0]));
    const redemptionsFor = new Map(redemptionsByStaff.map((g) => [g.redeemedStaffId, g._count]));

    const mine = {
      stamps: stampsFor.get(staff.id) ?? 0,
      redemptions: redemptionsFor.get(staff.id) ?? 0,
    };

    if (staff.role !== StaffRole.MANAGER) {
      return { mine, totals: null, team: null };
    }

    const [netStamps, newCustomers, rewardsRedeemed, teamMembers] = await Promise.all([
      this.prisma.stamp
        .aggregate({ where: { businessId, createdAt: { gte: start } }, _sum: { delta: true } })
        .then((a) => a._sum.delta ?? 0),
      this.prisma.customerMembership.count({ where: { businessId, createdAt: { gte: start } } }),
      this.prisma.redemption.count({
        where: { businessId, status: RedemptionStatus.REDEEMED, redeemedAt: { gte: start } },
      }),
      this.prisma.staff.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      mine,
      totals: { stamps: netStamps, newCustomers, rewardsRedeemed },
      team: teamMembers.map((m) => ({
        id: m.id,
        name: m.name,
        stamps: stampsFor.get(m.id) ?? 0,
        redemptions: redemptionsFor.get(m.id) ?? 0,
      })),
    };
  }
}
