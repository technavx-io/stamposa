import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'owner@stamposa.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;
}

export class AdminTwoFactorDto {
  @ApiProperty({ description: 'twoFactorToken from the login step' })
  @IsString()
  @MinLength(10)
  twoFactorToken: string;

  @ApiProperty({ example: '123456', description: 'Authenticator code, or a recovery code' })
  @IsString()
  @Length(6, 12)
  code: string;
}

export class AdminRefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken: string;
}

export class AdminTokensDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ example: 900 }) accessTokenExpiresInSec: number;
}

export class AdminProfileDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: AdminRole }) role: AdminRole;
  @ApiProperty({ isArray: true, type: String, description: 'What this role may do' })
  capabilities: string[];
  @ApiProperty() twoFactorEnabled: boolean;
  @ApiProperty() recoveryCodesRemaining: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}

export class TwoFactorSetupDto {
  @ApiProperty({ description: 'Base32 secret, for manual entry' }) secret: string;
  @ApiProperty({ description: 'otpauth:// URI' }) otpauthUrl: string;
  @ApiProperty({ description: 'PNG data URL of the enrolment QR' }) qrDataUrl: string;
}

export class AdminLoginResultDto {
  @ApiProperty({ enum: ['TWO_FACTOR_REQUIRED', 'TWO_FACTOR_SETUP_REQUIRED'] })
  status: 'TWO_FACTOR_REQUIRED' | 'TWO_FACTOR_SETUP_REQUIRED';

  @ApiProperty({ description: 'Pass to the verify/enroll step within 5 minutes' })
  twoFactorToken: string;

  @ApiPropertyOptional({ type: TwoFactorSetupDto, description: 'Present on first sign-in only' })
  twoFactorSetup?: TwoFactorSetupDto;
}

export class AdminSessionDto {
  @ApiProperty({ enum: ['AUTHENTICATED'] }) status: 'AUTHENTICATED';
  @ApiProperty({ type: AdminTokensDto }) tokens: AdminTokensDto;
  @ApiProperty({ type: AdminProfileDto }) admin: AdminProfileDto;
  @ApiPropertyOptional({
    isArray: true,
    type: String,
    description: 'Shown once, at enrolment only. Store them somewhere safe.',
  })
  recoveryCodes?: string[];
}
