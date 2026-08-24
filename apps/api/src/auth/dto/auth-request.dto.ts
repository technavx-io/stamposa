import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+91 98765 00001', description: 'Any format; normalised to E.164 server-side' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(6)
  @MaxLength(20)
  phone: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be the 6-digit number from the SMS.' })
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
