import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { Business } from '@prisma/client';
import { badRequest } from '../../common/exceptions';

/**
 * Normalise a merchant-supplied URL:
 *  - Trim whitespace, treat empty as "clear this field".
 *  - Reject `javascript:` / `data:` (they'd render as bogus clickable links).
 *  - Prepend https:// when no scheme is present so mobile taps open a page.
 *  - Only http/https are allowed. `http://` is kept as-is (some merchants
 *    still paste Zomato/Instagram links without https); it works locally but
 *    real customer traffic redirects through https anyway.
 *  - Anything that does not parse as a URL is rejected.
 */
export function normaliseInfoUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  const lowered = value.toLowerCase();
  if (lowered.startsWith('javascript:') || lowered.startsWith('data:') || lowered.startsWith('vbscript:')) {
    throw badRequest('INVALID_URL', 'That link is not allowed.');
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw badRequest('INVALID_URL', 'That does not look like a link. Paste the full URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest('INVALID_URL', 'Links must start with https://');
  }
  return url.toString();
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Merchant PATCH body for the /b/<slug> page. Every field is optional; an
 * empty string is treated the same as clearing the field (persisted as null).
 * URL fields accept https:// (http:// tolerated for local dev / legacy links);
 * `javascript:` and `data:` URIs are rejected outright.
 */
export class UpdateBusinessInfoDto {
  @ApiPropertyOptional({
    example: 'https://www.zomato.com/bengaluru/waffle-cafe/menu',
    description: 'Where "View menu" sends customers. Any public URL works.',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  menuUrl?: string | null;

  @ApiPropertyOptional({ description: 'Short about description shown on the page.' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  aboutText?: string | null;

  @ApiPropertyOptional({ example: '12 MG Road, Indiranagar, Bengaluru 560038' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  address?: string | null;

  @ApiPropertyOptional({ example: '+91 80 4123 4567' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'https://www.wafflecafe.in' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  websiteUrl?: string | null;

  @ApiPropertyOptional({ example: 'Mon–Sat · 10am–10pm' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  hoursText?: string | null;

  @ApiPropertyOptional({ example: 'hello@wafflecafe.in' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  @IsEmail({}, { message: 'That does not look like an email address.' })
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: 'https://maps.app.goo.gl/AbC123' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  googleMapsUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://instagram.com/wafflecafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  instagramUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://facebook.com/wafflecafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  facebookUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://youtube.com/@wafflecafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  youtubeUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://x.com/wafflecafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  xUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/wafflecafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  linkedinUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://tiktok.com/@wafflecafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  tiktokUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://wa.me/919876543210' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(500)
  whatsappUrl?: string | null;
}

/** Merchant-facing DTO for GET /v1/merchant/business/info. */
export class BusinessInfoDto {
  @ApiProperty({ nullable: true, type: String })
  menuUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  aboutText: string | null;

  @ApiProperty({ nullable: true, type: String })
  address: string | null;

  @ApiProperty({ nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ nullable: true, type: String })
  websiteUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  hoursText: string | null;

  @ApiProperty({ nullable: true, type: String })
  contactEmail: string | null;

  @ApiProperty({ nullable: true, type: String })
  googleMapsUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  instagramUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  facebookUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  youtubeUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  xUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  linkedinUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  tiktokUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  whatsappUrl: string | null;
}

export function toBusinessInfoDto(business: Business): BusinessInfoDto {
  return {
    menuUrl: business.menuUrl,
    aboutText: business.aboutText,
    address: business.address,
    phone: business.phone,
    websiteUrl: business.websiteUrl,
    hoursText: business.hoursText,
    contactEmail: business.contactEmail,
    googleMapsUrl: business.googleMapsUrl,
    instagramUrl: business.instagramUrl,
    facebookUrl: business.facebookUrl,
    youtubeUrl: business.youtubeUrl,
    xUrl: business.xUrl,
    linkedinUrl: business.linkedinUrl,
    tiktokUrl: business.tiktokUrl,
    whatsappUrl: business.whatsappUrl,
  };
}

/** Public DTO for GET /v1/public/businesses/:slug/info. */
export class PublicBusinessInfoDto extends BusinessInfoDto {
  @ApiProperty({ example: 'Brew & Bean Coffee' })
  businessName: string;

  @ApiProperty({ example: 'brew-and-bean' })
  slug: string;

  @ApiProperty({ nullable: true, type: String, example: '#4F46E5' })
  brandColor: string | null;

  @ApiProperty({ nullable: true, type: String })
  logoUrl: string | null;
}
