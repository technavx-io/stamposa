import {
  Business,
  Campaign,
  Customer,
  CustomerMembership,
  Redemption,
  Staff,
  Stamp,
} from '@prisma/client';
import { formatCode } from '../common/utils/codes.util';
import { resolveCardStyle } from './card-style.util';
import {
  CardDetailDto,
  CardDto,
  MembershipDetailDto,
  MembershipListItemDto,
  RedemptionRowDto,
  RedemptionSummaryDto,
  StampDto,
} from './dto/loyalty.dto';

export interface PresenterUrls {
  apiPublicUrl: string;
}

/**
 * Fetch sites include `redemptions` filtered to PENDING (see
 * PENDING_REDEMPTIONS_INCLUDE) so every card/membership shape can surface
 * outstanding vouchers without extra queries.
 */
export const PENDING_REDEMPTIONS_INCLUDE = {
  where: { status: 'PENDING' as const },
  orderBy: { createdAt: 'asc' as const },
} as const;

type MembershipWithBusinessCampaign = CustomerMembership & {
  business: Business;
  campaign: Campaign;
  redemptions?: Redemption[];
};

type MembershipWithCustomerCampaign = CustomerMembership & {
  customer: Customer;
  campaign: Campaign;
  redemptions?: Redemption[];
};

export function toRedemptionSummaryDto(r: Redemption): RedemptionSummaryDto {
  return {
    id: r.id,
    code: r.code,
    formattedCode: formatCode(r.code),
    rewardText: r.rewardText,
    earnedAt: r.createdAt,
  };
}

export function toRedemptionRowDto(
  r: Redemption & {
    redeemedStaff: Staff | null;
    membership: CustomerMembership & { customer: Customer };
  },
): RedemptionRowDto {
  return {
    ...toRedemptionSummaryDto(r),
    status: r.status,
    redeemedAt: r.redeemedAt,
    redeemedBy:
      r.status === 'REDEEMED'
        ? r.redeemedByType === 'MERCHANT'
          ? 'Owner'
          : (r.redeemedStaff?.name ?? 'Staff')
        : null,
    voidedAt: r.voidedAt,
    membershipId: r.membershipId,
    customer: {
      id: r.membership.customer.id,
      name: r.membership.customer.name,
      phone: r.membership.customer.phone,
    },
    customerCode: formatCode(r.membership.code),
  };
}

export function toCardDto(m: MembershipWithBusinessCampaign, urls: PresenterUrls): CardDto {
  const pending = (m.redemptions ?? []).map(toRedemptionSummaryDto);
  return {
    id: m.id,
    code: m.code,
    formattedCode: formatCode(m.code),
    stampCount: m.stampCount,
    completedCount: m.completedCount,
    totalStamps: m.totalStamps,
    lastStampAt: m.lastStampAt,
    joinedAt: m.createdAt,
    pendingRewards: pending,
    // Vouchers are minted for every completion going forward; completions
    // that predate the redemption feature count as already honoured.
    redeemedCount: Math.max(0, m.completedCount - pending.length),
    business: {
      id: m.business.id,
      name: m.business.name,
      slug: m.business.slug,
      logoUrl: m.business.logoPath ? `${urls.apiPublicUrl}${m.business.logoPath}` : null,
      address: m.business.address,
      brandColor: m.business.brandColor,
    },
    campaign: toCardCampaign(m.campaign),
    style: resolveCardStyle(m.campaign, m.business, urls.apiPublicUrl),
  };
}

export function toCardDetailDto(
  m: MembershipWithBusinessCampaign & { stamps: (Stamp & { staff: Staff | null })[] },
  urls: PresenterUrls,
): CardDetailDto {
  return {
    ...toCardDto(m, urls),
    recentStamps: m.stamps.map(toStampDto),
  };
}

export function toStampDto(stamp: Stamp & { staff: Staff | null }): StampDto {
  return {
    id: stamp.id,
    createdAt: stamp.createdAt,
    delta: stamp.delta,
    reason: stamp.reason,
    completedCard: stamp.completedCard,
    issuerType: stamp.issuerType,
    issuerName: stamp.issuerType === 'MERCHANT' ? 'Owner' : stamp.staff?.name ?? 'Staff',
  };
}

export function toMembershipListItemDto(m: MembershipWithCustomerCampaign): MembershipListItemDto {
  return {
    id: m.id,
    code: m.code,
    formattedCode: formatCode(m.code),
    notes: m.notes,
    tags: m.tags,
    blockedAt: m.blockedAt,
    blockedReason: m.blockedReason,
    customer: {
      id: m.customer.id,
      name: m.customer.name,
      phone: m.customer.phone,
    },
    stampCount: m.stampCount,
    stampsRequired: m.campaign.stampsRequired,
    completedCount: m.completedCount,
    totalStamps: m.totalStamps,
    lastStampAt: m.lastStampAt,
    joinedAt: m.createdAt,
    pendingRewards: (m.redemptions ?? []).map(toRedemptionSummaryDto),
  };
}

export function toMembershipDetailDto(m: MembershipWithCustomerCampaign): MembershipDetailDto {
  return {
    ...toMembershipListItemDto(m),
    campaign: toCardCampaign(m.campaign),
  };
}

function toCardCampaign(campaign: Campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    stampsRequired: campaign.stampsRequired,
    reward: campaign.reward,
    status: campaign.status,
  };
}
