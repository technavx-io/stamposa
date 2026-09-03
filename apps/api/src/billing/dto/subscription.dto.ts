import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { BillingInterval, PlanTier, SubscriptionStatus } from '@prisma/client';
import { Plan, PlanLimits } from '../plans';

/** What the merchant is buying. Free is excluded — it has no checkout. */
export class CheckoutRequestDto {
  @ApiProperty({ enum: ['STARTER', 'GROWTH', 'PRO'] })
  @IsIn(['STARTER', 'GROWTH', 'PRO'])
  tier: Exclude<PlanTier, 'FREE'>;

  @ApiProperty({ enum: ['MONTHLY', 'YEARLY'] })
  @IsIn(['MONTHLY', 'YEARLY'])
  interval: BillingInterval;
}

export class CheckoutResponseDto {
  @ApiProperty({ description: 'Hosted Dodo checkout URL to redirect the merchant to' })
  checkoutUrl: string;
}

export class PlanLimitsDto implements PlanLimits {
  @ApiProperty() staffDevices: number;
  @ApiProperty({ nullable: true, type: Number }) liveCampaigns: number | null;
  @ApiProperty({ nullable: true, type: Number }) customers: number | null;
  @ApiProperty({ nullable: true, type: Number }) broadcastsPerMonth: number | null;
  @ApiProperty({ nullable: true, type: Number }) analyticsHistoryDays: number | null;
  @ApiProperty() cardCustomization: boolean;
  @ApiProperty() csvExport: boolean;
  @ApiProperty() badgeRemoved: boolean;
}

export class PlanDto {
  @ApiProperty({ enum: ['FREE', 'STARTER', 'GROWTH', 'PRO'] })
  tier: PlanTier;

  @ApiProperty({ example: 'Growth' })
  name: string;

  @ApiProperty()
  tagline: string;

  @ApiProperty({ description: 'Monthly price in paise (₹ minor units)', example: 49900 })
  priceMonthly: number;

  @ApiProperty({ description: 'Yearly price in paise', example: 499000 })
  priceYearly: number;

  @ApiProperty({ type: PlanLimitsDto })
  limits: PlanLimitsDto;

  @ApiProperty({ type: [String] })
  features: string[];

  @ApiProperty({ type: [String] })
  comingSoon: string[];

  @ApiProperty()
  recommended: boolean;
}

export function toPlanDto(p: Plan): PlanDto {
  return {
    tier: p.tier,
    name: p.name,
    tagline: p.tagline,
    priceMonthly: p.price.monthly,
    priceYearly: p.price.yearly,
    limits: p.limits,
    features: p.features,
    comingSoon: p.comingSoon,
    recommended: p.recommended,
  };
}

export class SubscriptionStateDto {
  @ApiProperty({ enum: ['FREE', 'STARTER', 'GROWTH', 'PRO'], description: 'Plan on file' })
  plan: PlanTier;

  @ApiProperty({ enum: ['FREE', 'STARTER', 'GROWTH', 'PRO'], description: 'What the tenant is entitled to right now' })
  effectiveTier: PlanTier;

  @ApiProperty({ example: 'Growth' })
  effectivePlanName: string;

  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] })
  status: SubscriptionStatus;

  @ApiProperty({ enum: ['MONTHLY', 'YEARLY'] })
  interval: BillingInterval;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  trialEndsAt: Date | null;

  @ApiProperty({ nullable: true, type: Number, description: 'Whole days left in the trial' })
  trialDaysLeft: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  currentPeriodEnd: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd: boolean;

  @ApiProperty({ description: 'Whether online checkout is available (payment provider configured)' })
  billingEnabled: boolean;
}
