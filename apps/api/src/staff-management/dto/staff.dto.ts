import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Staff, StaffRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
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

  @ApiProperty({ example: 'ravi@brewbean.com', description: 'The email the staff member logs in with' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'password123', description: 'Initial password — share it with the staff member' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(200)
  password: string;

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

  @ApiProperty({ example: 'ravi@brewbean.com', nullable: true, type: String })
  email: string | null;

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
    email: staff.email,
    role: staff.role,
    isActive: staff.isActive,
    stampsIssued: staff._count?.stampsIssued ?? 0,
    createdAt: staff.createdAt,
  };
}
