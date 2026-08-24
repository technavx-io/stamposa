import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsHexColor, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBusinessDto {
  @ApiProperty({ example: 'Brew & Bean Coffee' })
  @IsString()
  @Transform(trim)
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: '12 MG Road, Indiranagar, Bengaluru 560038' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: '+91 80 4123 4567', description: 'Display phone for the business' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(20)
  phone?: string;
}

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {
  @ApiPropertyOptional({ example: '#4F46E5', description: 'Applied to the card and join page' })
  @IsOptional()
  @IsHexColor({ message: 'Pick a colour in #RRGGBB form.' })
  brandColor?: string;

  @ApiPropertyOptional({ example: 'cafe' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(40)
  category?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'Drives what "today" means in reports' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Wording customers agree to when enrolling' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(600)
  consentText?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyDailySummary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyWeeklyDigest?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyStaffInactive?: boolean;
}

export class QrQueryDto {
  @ApiPropertyOptional({ default: 512, description: 'Pixel width of the QR image (128–2048)' })
  @IsOptional()
  size?: string;
}
