import { ApiProperty } from '@nestjs/swagger';
import { StampIssuerType } from '@prisma/client';
import { CampaignDto } from '../campaigns/dto/campaign.dto';

export class DashboardStatsDto {
  @ApiProperty({ example: 42, description: 'Enrolled customers' })
  customers: number;

  @ApiProperty({ example: 12, description: 'Stamps issued today' })
  stampsToday: number;

  @ApiProperty({ example: 431, description: 'Stamps issued all-time' })
  stampsTotal: number;

  @ApiProperty({ example: 18, description: 'Rewards earned (completed cards)' })
  rewardsEarned: number;

  @ApiProperty({ example: 3, description: 'Reward vouchers waiting to be handed over' })
  rewardsPending: number;

  @ApiProperty({ example: 15, description: 'Reward vouchers honoured' })
  rewardsRedeemed: number;
}

export class DashboardActivityItemDto {
  @ApiProperty({ description: 'Stamp or redemption id' })
  id: string;

  @ApiProperty({ enum: ['STAMP', 'REDEMPTION'], description: 'What happened' })
  type: 'STAMP' | 'REDEMPTION';

  @ApiProperty({ nullable: true, type: String, description: 'Reward text for redemption events' })
  rewardText: string | null;

  @ApiProperty({ nullable: true, type: String })
  customerName: string | null;

  @ApiProperty({ example: '7F3K-9QZP' })
  customerCode: string;

  @ApiProperty({ description: 'Membership id (links to customer detail)' })
  membershipId: string;

  @ApiProperty({ example: 'Ravi Kumar' })
  issuerName: string;

  @ApiProperty({ enum: StampIssuerType })
  issuerType: StampIssuerType;

  @ApiProperty()
  completedCard: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class DashboardChecklistDto {
  @ApiProperty()
  hasLogo: boolean;

  @ApiProperty()
  hasCampaign: boolean;

  @ApiProperty()
  hasStaff: boolean;

  @ApiProperty()
  hasCustomers: boolean;
}

export class DashboardDto {
  @ApiProperty({ type: DashboardStatsDto })
  stats: DashboardStatsDto;

  @ApiProperty({ type: CampaignDto, nullable: true })
  campaign: CampaignDto | null;

  @ApiProperty({ type: DashboardActivityItemDto, isArray: true })
  activity: DashboardActivityItemDto[];

  @ApiProperty({ type: DashboardChecklistDto })
  checklist: DashboardChecklistDto;
}
