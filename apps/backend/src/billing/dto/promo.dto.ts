import { ApiProperty } from '@nestjs/swagger';
import { PlanTier, PromoCode } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Merchant redeems a code. */
export class RedeemRequestDto {
  @ApiProperty({ example: 'FOUNDERS' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code: string;
}

/** Admin creates a promo code. */
export class CreatePromoCodeDto {
  @ApiProperty({ example: 'FOUNDERS', description: 'Case-insensitive; stored uppercase' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code: string;

  @ApiProperty({ enum: ['STARTER', 'GROWTH', 'PRO'], default: 'GROWTH' })
  @IsIn(['STARTER', 'GROWTH', 'PRO'])
  tier: Exclude<PlanTier, 'FREE'>;

  @ApiProperty({ example: 6, description: 'Length of the free grant in months' })
  @IsInt()
  @Min(1)
  @Max(36)
  freeMonths: number;

  @ApiProperty({ example: 30, description: 'Total redemptions allowed' })
  @IsInt()
  @Min(1)
  @Max(100000)
  maxRedemptions: number;

  @ApiProperty({ required: false, description: 'Optional ISO date after which the code stops working' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class SetPromoActiveDto {
  @ApiProperty()
  @IsBoolean()
  active: boolean;
}

export class PromoCodeDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty({ enum: ['FREE', 'STARTER', 'GROWTH', 'PRO'] }) tier: PlanTier;
  @ApiProperty() freeMonths: number;
  @ApiProperty() maxRedemptions: number;
  @ApiProperty() redeemedCount: number;
  @ApiProperty() active: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) expiresAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;

  static from(p: PromoCode): PromoCodeDto {
    return {
      id: p.id,
      code: p.code,
      tier: p.tier,
      freeMonths: p.freeMonths,
      maxRedemptions: p.maxRedemptions,
      redeemedCount: p.redeemedCount,
      active: p.active,
      expiresAt: p.expiresAt,
      createdAt: p.createdAt,
    };
  }
}
