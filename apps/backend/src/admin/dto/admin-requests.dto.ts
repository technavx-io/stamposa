import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class MerchantListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'active', 'silent', 'suspended', 'no-campaign'] })
  @IsOptional()
  @IsIn(['all', 'active', 'silent', 'suspended', 'no-campaign'])
  filter?: 'all' | 'active' | 'silent' | 'suspended' | 'no-campaign';

  @ApiPropertyOptional({ description: 'Business name, slug, owner name or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class SuspendMerchantDto {
  @ApiProperty({ example: 'Chargeback dispute pending resolution' })
  @IsString()
  @Transform(trim)
  @Length(8, 200, { message: 'Give a reason of at least 8 characters.' })
  reason: string;

  @ApiProperty({ description: 'Must match the business name exactly — typed confirmation' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  confirmName: string;
}

export class ImpersonateDto {
  @ApiProperty({ example: 'Investigating reported stamping issue, ticket #412' })
  @IsString()
  @Transform(trim)
  @Length(8, 200, { message: 'Give a reason of at least 8 characters.' })
  reason: string;
}

export class MerchantNotesDto {
  @ApiProperty({ example: 'Owner prefers WhatsApp. Second outlet opening in March.' })
  @IsString()
  @Transform(trim)
  @MaxLength(2000)
  notes: string;
}

export class CustomerEraseDto {
  @ApiProperty({ example: 'DPDP erasure request received by email on 18 Aug' })
  @IsString()
  @Transform(trim)
  @Length(8, 200, { message: 'Give a reason of at least 8 characters.' })
  reason: string;

  @ApiProperty({ example: 'ERASE', description: 'Type ERASE to confirm — this cannot be undone' })
  @IsString()
  confirm: string;
}

export class CustomerLookupDto {
  @ApiProperty({ example: '+91 98765 01101', description: 'Exact phone number — no browsing' })
  @IsString()
  @Transform(trim)
  @MinLength(6)
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 'Customer emailed asking which businesses hold their data' })
  @IsString()
  @Transform(trim)
  @Length(8, 200, { message: 'Give a reason of at least 8 characters.' })
  reason: string;
}

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() adminId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessId?: string;
  @ApiPropertyOptional({ example: 'merchant.' }) @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) search?: string;
}

export class CreateAdminDto {
  @ApiProperty({ example: 'ops@stamposa.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  @Transform(trim)
  @Length(2, 60)
  name: string;

  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  role: AdminRole;
}

export class UpdateAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Transform(trim) @Length(2, 60) name?: string;
  @ApiPropertyOptional({ enum: AdminRole }) @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
