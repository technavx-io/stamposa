import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Staff, StaffRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStaffDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  @Transform(trim)
  @Length(2, 60)
  name: string;

  @ApiProperty({ example: '+91 98765 00002', description: 'The phone the staff member logs in with' })
  @IsString()
  @Transform(trim)
  @MinLength(6)
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ enum: StaffRole, default: StaffRole.STAFF, description: 'Managers see team stats and can undo any recent stamp' })
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'Ravi Kumar' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional({ description: 'Set false to deactivate (blocks login immediately)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: StaffRole })
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;
}

export class StaffDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Ravi Kumar' })
  name: string;

  @ApiProperty({ example: '+919876500002' })
  phone: string;

  @ApiProperty({ enum: StaffRole })
  role: StaffRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ example: 128, description: 'Stamps this staff member has issued' })
  stampsIssued: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export function toStaffDto(staff: Staff & { _count?: { stampsIssued: number } }): StaffDto {
  return {
    id: staff.id,
    name: staff.name,
    phone: staff.phone,
    role: staff.role,
    isActive: staff.isActive,
    stampsIssued: staff._count?.stampsIssued ?? 0,
    createdAt: staff.createdAt,
  };
}
