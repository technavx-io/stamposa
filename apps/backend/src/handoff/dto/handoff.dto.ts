import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for POST /merchant/handoff. The optional `goto` becomes the in-app
 * path the phone lands on after consuming the token — enforced server-side
 * to be a bare in-app path (single leading "/") so it can't smuggle an
 * off-site redirect via the QR the desktop is about to render.
 */
export class CreateHandoffDto {
  @ApiProperty({
    required: false,
    example: '/merchant/settings#menu-pdf',
    description: 'In-app path the phone will land on. Must start with a single "/".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  goto?: string;
}

export class ConsumeHandoffDto {
  @ApiProperty({ description: 'The 32-byte hex token from the QR code.' })
  @IsString()
  @MaxLength(128)
  token: string;
}

export class CreateHandoffResponseDto {
  @ApiProperty({ description: 'One-time hex token — do not log or forward.' })
  token: string;

  @ApiProperty({ description: 'Fully-formed URL the QR encodes.' })
  url: string;

  @ApiProperty({ description: 'Pre-rendered inline SVG QR code.' })
  qrSvg: string;

  @ApiProperty({ example: '2026-09-21T12:05:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: 300 })
  expiresInSec: number;
}
