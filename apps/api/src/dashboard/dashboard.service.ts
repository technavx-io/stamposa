import { Injectable } from '@nestjs/common';
import { Business, RedemptionStatus } from '@prisma/client';
import { formatCode } from '../common/utils/codes.util';
import { CampaignsService } from '../campaigns/campaigns.service';
import { toCampaignDto } from '../campaigns/dto/campaign.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardActivityItemDto, DashboardDto } from './dashboard.dto';

const ACTIVITY_ITEMS = 10;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
  ) {}

  async overview(business: Business): Promise<DashboardDto> {
    const businessId = business.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      customers,
      stampsTotal,
      stampsToday,
      rewardsAgg,
      rewardsPending,
      campaign,
      staffCount,
      recentStamps,
      recentRedemptions,
    ] = await Promise.all([
      this.prisma.customerMembership.count({ where: { businessId } }),
      this.prisma.stamp.count({ where: { businessId } }),
      this.prisma.stamp.count({ where: { businessId, createdAt: { gte: startOfToday } } }),
      this.prisma.customerMembership.aggregate({
        where: { businessId },
        _sum: { completedCount: true },
      }),
      this.prisma.redemption.count({
        where: { businessId, status: RedemptionStatus.PENDING },
      }),
      this.campaigns.currentCampaign(businessId),
      this.prisma.staff.count({ where: { businessId, isActive: true } }),
      this.prisma.stamp.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_ITEMS,
        include: { staff: true, membership: { include: { customer: true } } },
      }),
      this.prisma.redemption.findMany({
        where: { businessId, status: RedemptionStatus.REDEEMED },
        orderBy: { redeemedAt: 'desc' },
        take: ACTIVITY_ITEMS,
        include: { redeemedStaff: true, membership: { include: { customer: true } } },
      }),
    ]);

    const rewardsEarned = rewardsAgg._sum.completedCount ?? 0;

    const stampItems: DashboardActivityItemDto[] = recentStamps.map((stamp) => ({
      id: stamp.id,
      type: 'STAMP',
      rewardText: null,
      customerName: stamp.membership.customer.name,
      customerCode: formatCode(stamp.membership.code),
      membershipId: stamp.membershipId,
      issuerName: stamp.issuerType === 'MERCHANT' ? 'Owner' : stamp.staff?.name ?? 'Staff',
      issuerType: stamp.issuerType,
      completedCard: stamp.completedCard,
      createdAt: stamp.createdAt,
    }));
    const redemptionItems: DashboardActivityItemDto[] = recentRedemptions.map((r) => ({
      id: r.id,
      type: 'REDEMPTION',
      rewardText: r.rewardText,
      customerName: r.membership.customer.name,
      customerCode: formatCode(r.membership.code),
      membershipId: r.membershipId,
      issuerName: r.redeemedByType === 'MERCHANT' ? 'Owner' : r.redeemedStaff?.name ?? 'Staff',
      issuerType: r.redeemedByType ?? 'STAFF',
      completedCard: false,
      createdAt: r.redeemedAt ?? r.createdAt,
    }));
    const activity = [...stampItems, ...redemptionItems]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, ACTIVITY_ITEMS);

    return {
      stats: {
        customers,
        stampsToday,
        stampsTotal,
        rewardsEarned,
        rewardsPending,
        rewardsRedeemed: Math.max(0, rewardsEarned - rewardsPending),
      },
      campaign: campaign ? toCampaignDto(campaign) : null,
      activity,
      checklist: {
        hasLogo: business.logoPath !== null,
        hasCampaign: campaign !== null,
        hasStaff: staffCount > 0,
        hasCustomers: customers > 0,
      },
    };
  }
}
