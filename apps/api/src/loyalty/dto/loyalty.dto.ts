import { ApiProperty } from '@nestjs/swagger';
import { CampaignStatus, RedemptionStatus, StampIssuerType } from '@prisma/client';

export class CardBusinessDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Brew & Bean Coffee' })
  name: string;

  @ApiProperty({ example: 'brew-and-bean' })
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  logoUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  address: string | null;

  @ApiProperty({ nullable: true, type: String, example: '#4F46E5' })
  brandColor: string | null;
}

export class CardCampaignDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Coffee Lovers Card' })
  name: string;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ example: 10 })
  stampsRequired: number;

  @ApiProperty({ example: '1 free coffee of your choice' })
  reward: string;

  @ApiProperty({ enum: CampaignStatus })
  status: CampaignStatus;
}

/** Resolved card look (campaign override → business default → built-in). */
export class CardStyleDto {
  @ApiProperty({ example: '#4F46E5' })
  color: string;

  @ApiProperty({ nullable: true, type: String, example: '☕', description: 'Emoji for filled stamps; null = default check' })
  stampIcon: string | null;

  @ApiProperty({ nullable: true, type: String, example: '🎁', description: 'Emoji for the reward slot; null = default gift' })
  rewardIcon: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Card background image URL' })
  cardImageUrl: string | null;

  @ApiProperty({ description: 'When an image is set: true tints it with the colour, false = scrim only' })
  imageTinted: boolean;
}

export class StampDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ example: 1, description: 'Signed movement: −1 rows are undo reversals or removals' })
  delta: number;

  @ApiProperty({ nullable: true, type: String, description: 'Present on adjustments and undos' })
  reason: string | null;

  @ApiProperty({ description: 'True when this stamp completed a card and earned the reward' })
  completedCard: boolean;

  @ApiProperty({ enum: StampIssuerType })
  issuerType: StampIssuerType;

  @ApiProperty({ example: 'Ravi Kumar', description: 'Staff name, or "Owner" for merchant-issued stamps' })
  issuerName: string;
}

export class RedemptionSummaryDto {
  @ApiProperty({ description: 'Redemption (voucher) id' })
  id: string;

  @ApiProperty({ example: 'RX7K9QZ2' })
  code: string;

  @ApiProperty({ example: 'RX7K-9QZ2' })
  formattedCode: string;

  @ApiProperty({ example: '1 free coffee of your choice', description: 'Snapshotted at earn time' })
  rewardText: string;

  @ApiProperty({ type: String, format: 'date-time' })
  earnedAt: Date;
}

export class CardDto {
  @ApiProperty({ description: 'Membership id — the canonical card identifier' })
  id: string;

  @ApiProperty({ example: '7F3K9QZP', description: 'Unique customer code (stored form)' })
  code: string;

  @ApiProperty({ example: '7F3K-9QZP', description: 'Display form of the code' })
  formattedCode: string;

  @ApiProperty({ example: 4, description: 'Stamps on the current card' })
  stampCount: number;

  @ApiProperty({ example: 1, description: 'Rewards earned (completed cards)' })
  completedCount: number;

  @ApiProperty({ example: 14, description: 'Lifetime stamps' })
  totalStamps: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastStampAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt: Date;

  @ApiProperty({ type: RedemptionSummaryDto, isArray: true, description: 'Rewards earned but not yet handed over' })
  pendingRewards: RedemptionSummaryDto[];

  @ApiProperty({ example: 1, description: 'Rewards already honoured (completedCount − pending)' })
  redeemedCount: number;

  @ApiProperty({ type: CardBusinessDto })
  business: CardBusinessDto;

  @ApiProperty({ type: CardCampaignDto })
  campaign: CardCampaignDto;

  @ApiProperty({ type: CardStyleDto })
  style: CardStyleDto;
}

export class CardDetailDto extends CardDto {
  @ApiProperty({ type: StampDto, isArray: true, description: 'Most recent stamps, newest first' })
  recentStamps: StampDto[];
}

export class JoinResultDto {
  @ApiProperty({ type: CardDto })
  card: CardDto;

  @ApiProperty({ description: 'True when the customer already had this card' })
  alreadyMember: boolean;
}

export class CustomerSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ example: '+919876501101' })
  phone: string;
}

export class MembershipListItemDto {
  @ApiProperty({ description: 'Membership id' })
  id: string;

  @ApiProperty({ example: '7F3K9QZP' })
  code: string;

  @ApiProperty({ example: '7F3K-9QZP' })
  formattedCode: string;

  @ApiProperty({ nullable: true, type: String, description: 'Private merchant notes' })
  notes: string | null;

  @ApiProperty({ isArray: true, type: String, example: ['regular'] })
  tags: string[];

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  blockedAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  blockedReason: string | null;

  @ApiProperty({ type: CustomerSummaryDto })
  customer: CustomerSummaryDto;

  @ApiProperty({ example: 4 })
  stampCount: number;

  @ApiProperty({ example: 10 })
  stampsRequired: number;

  @ApiProperty({ example: 1 })
  completedCount: number;

  @ApiProperty({ example: 14 })
  totalStamps: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastStampAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt: Date;

  @ApiProperty({ type: RedemptionSummaryDto, isArray: true, description: 'Rewards waiting to be handed over' })
  pendingRewards: RedemptionSummaryDto[];
}

export class MembershipDetailDto extends MembershipListItemDto {
  @ApiProperty({ type: CardCampaignDto })
  campaign: CardCampaignDto;
}

/**
 * Declared after CustomerSummaryDto on purpose: emitDecoratorMetadata
 * resolves property types eagerly at class-definition time, so a forward
 * reference here would throw at module load.
 */
export class RedemptionRowDto extends RedemptionSummaryDto {
  @ApiProperty({ enum: RedemptionStatus })
  status: RedemptionStatus;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  redeemedAt: Date | null;

  @ApiProperty({ nullable: true, type: String, example: 'Ravi Kumar', description: 'Who honoured it ("Owner" for merchant)' })
  redeemedBy: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time', description: 'Set when the voucher was voided (e.g. its stamp was undone)' })
  voidedAt: Date | null;

  @ApiProperty({ description: 'Membership id (links to the customer)' })
  membershipId: string;

  @ApiProperty({ type: CustomerSummaryDto })
  customer: CustomerSummaryDto;

  @ApiProperty({ example: '7F3K-9QZP', description: 'Customer code' })
  customerCode: string;
}

export class AddStampResultDto {
  @ApiProperty({ type: MembershipListItemDto, description: 'Card state after the stamp' })
  card: MembershipListItemDto;

  @ApiProperty({ description: 'True when this stamp completed the card' })
  rewardEarned: boolean;

  @ApiProperty({ example: '1 free coffee of your choice' })
  reward: string;

  @ApiProperty({ type: StampDto })
  stamp: StampDto;

  @ApiProperty({ type: RedemptionSummaryDto, nullable: true, description: 'Voucher minted when this stamp completed the card' })
  redemption: RedemptionSummaryDto | null;
}

export class RedeemResultDto {
  @ApiProperty({ type: RedemptionRowDto })
  redemption: RedemptionRowDto;

  @ApiProperty({ type: MembershipListItemDto, description: 'Card state after redeeming' })
  card: MembershipListItemDto;
}

export class UndoStampResultDto {
  @ApiProperty({ type: MembershipListItemDto, description: 'Card state after the undo' })
  card: MembershipListItemDto;

  @ApiProperty({ description: 'True when the undone stamp had completed the card and its voucher was voided' })
  voucherVoided: boolean;
}

export class EnrollResultDto {
  @ApiProperty({ type: MembershipListItemDto, description: 'The (new or existing) card' })
  card: MembershipListItemDto;

  @ApiProperty({ description: 'True when this phone already held a card here' })
  alreadyMember: boolean;

  @ApiProperty({ description: 'True when no customer account existed for this phone yet' })
  isNewCustomer: boolean;
}
