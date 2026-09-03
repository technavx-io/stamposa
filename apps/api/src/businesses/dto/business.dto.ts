import { ApiProperty } from '@nestjs/swagger';
import { Business } from '@prisma/client';

export class BusinessDto {
  @ApiProperty({ example: 'cm5xyzabc0000abcd1234efgh' })
  id: string;

  @ApiProperty({ example: 'Brew & Bean Coffee' })
  name: string;

  @ApiProperty({ example: 'brew-and-bean' })
  slug: string;

  @ApiProperty({ nullable: true, type: String, example: 'http://localhost:4000/uploads/logos/x.png' })
  logoUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  address: string | null;

  @ApiProperty({ nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'https://g.page/r/CaBcDeFgHiJkL/review' })
  googleReviewUrl: string | null;

  @ApiProperty({ example: 'http://localhost:3000/join/brew-and-bean', description: 'Customer registration link encoded in the QR code' })
  joinUrl: string;

  @ApiProperty({ nullable: true, type: String, example: '#4F46E5' })
  brandColor: string | null;

  @ApiProperty({ nullable: true, type: String, example: '☕', description: 'Default stamp emoji for cards' })
  stampIcon: string | null;

  @ApiProperty({ nullable: true, type: String, example: '🎁', description: 'Default reward emoji for cards' })
  rewardIcon: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Default card background image URL' })
  cardImageUrl: string | null;

  @ApiProperty({ example: true, description: 'Tint the card image with the colour, or show image + scrim only' })
  cardImageTint: boolean;

  @ApiProperty({ nullable: true, type: String })
  category: string | null;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone: string;

  @ApiProperty({ nullable: true, type: String })
  consentText: string | null;

  @ApiProperty()
  notifyDailySummary: boolean;

  @ApiProperty()
  notifyWeeklyDigest: boolean;

  @ApiProperty()
  notifyStaffInactive: boolean;

  @ApiProperty({ description: 'True while a platform admin has suspended the account' })
  suspended: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export interface BusinessDtoOptions {
  apiPublicUrl: string;
  webAppUrl: string;
}

export function toBusinessDto(business: Business, opts: BusinessDtoOptions): BusinessDto {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logoUrl: business.logoPath ? `${opts.apiPublicUrl}${business.logoPath}` : null,
    address: business.address,
    phone: business.phone,
    googleReviewUrl: business.googleReviewUrl,
    joinUrl: `${opts.webAppUrl}/join/${business.slug}`,
    brandColor: business.brandColor,
    stampIcon: business.stampIcon,
    rewardIcon: business.rewardIcon,
    cardImageUrl: business.cardImagePath ? `${opts.apiPublicUrl}${business.cardImagePath}` : null,
    cardImageTint: business.cardImageTint,
    category: business.category,
    timezone: business.timezone,
    consentText: business.consentText,
    notifyDailySummary: business.notifyDailySummary,
    notifyWeeklyDigest: business.notifyWeeklyDigest,
    notifyStaffInactive: business.notifyStaffInactive,
    suspended: business.suspendedAt !== null,
    createdAt: business.createdAt,
  };
}
