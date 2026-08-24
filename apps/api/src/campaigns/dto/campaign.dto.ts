import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Campaign, CampaignStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCampaignDto {
  @ApiProperty({ example: 'Coffee Lovers Card' })
  @IsString()
  @Transform(trim)
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: 'Collect a stamp with every coffee.' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(300)
  description?: string;

  @ApiProperty({ example: 10, minimum: 2, maximum: 50, description: 'Stamps needed to earn the reward' })
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(50)
  stampsRequired: number;

  @ApiProperty({ example: '1 free coffee of your choice' })
  @IsString()
  @Transform(trim)
  @Length(2, 120)
  reward: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Max stamps one customer can earn per day. Omit for unlimited.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  dailyStampCap?: number;

  @ApiPropertyOptional({ description: 'Small print shown on the card and join page' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(400)
  terms?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @ApiPropertyOptional({ enum: CampaignStatus, description: 'ACTIVE, PAUSED or ARCHIVED' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

export class CampaignDto {
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

  @ApiProperty({ nullable: true, type: Number, example: 1 })
  dailyStampCap: number | null;

  @ApiProperty({ nullable: true, type: String })
  terms: string | null;

  @ApiProperty({ example: 42, description: 'Customers enrolled in this campaign' })
  memberCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export function toCampaignDto(
  campaign: Campaign & { _count?: { memberships: number } },
  memberCount?: number,
): CampaignDto {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    stampsRequired: campaign.stampsRequired,
    reward: campaign.reward,
    status: campaign.status,
    dailyStampCap: campaign.dailyStampCap,
    terms: campaign.terms,
    memberCount: memberCount ?? campaign._count?.memberships ?? 0,
    createdAt: campaign.createdAt,
  };
}
