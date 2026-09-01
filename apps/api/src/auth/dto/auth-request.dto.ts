import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '+91 98765 00001',
    description:
      'Phone number or email address. Phones accept any format and are normalised to ' +
      'E.164 server-side; emails are lowercased. Customers may use either — staff and ' +
      'merchants must use a phone here, since they already have email+password sign-in.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3)
  @MaxLength(120)
  identifier: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be the 6-digit number we sent you.' })
  code: string;
}

export class RegisterDto {
  @ApiProperty({ description: 'registrationToken returned by the verify step' })
  @IsString()
  @MinLength(10)
  registrationToken: string;

  @ApiProperty({ example: 'Asha Patel' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 60)
  name: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken: string;
}

export class EmailLoginDto {
  @ApiProperty({ example: 'owner@brewbean.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(200)
  password: string;
}

export class MerchantSignupDto extends EmailLoginDto {
  @ApiProperty({ example: 'Asha Patel' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 60)
  name: string;
}

export class ResendEmailVerificationDto {
  @ApiProperty({ example: 'owner@brewbean.com' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}

export class VerifyEmailDto extends ResendEmailVerificationDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be the 6-digit number from the email.' })
  code: string;
}
