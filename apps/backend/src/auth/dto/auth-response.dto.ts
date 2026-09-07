import { ApiProperty } from '@nestjs/swagger';
import { BusinessDto } from '../../businesses/dto/business.dto';
import { ActorRole } from '../auth.types';

export class TokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900 })
  accessTokenExpiresInSec: number;
}

export class SessionActorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['MERCHANT', 'STAFF', 'CUSTOMER'] })
  role: ActorRole;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'owner@brewbean.com' })
  email: string | null;

  @ApiProperty({ nullable: true, type: String, example: '+919876500001' })
  phone: string | null;
}

export class AuthSessionDto {
  @ApiProperty({ type: TokensDto })
  tokens: TokensDto;

  @ApiProperty({ type: SessionActorDto })
  actor: SessionActorDto;

  @ApiProperty({
    type: BusinessDto,
    nullable: true,
    description: 'The actor’s business (merchant: own business or null; staff: employer; customer: null)',
  })
  business: BusinessDto | null;
}

export class OtpRequestedDto {
  @ApiProperty({ example: 300 })
  expiresInSec: number;

  @ApiProperty({ example: 60 })
  resendInSec: number;

  @ApiProperty({ required: false, description: 'Dev-mode only — never present in production' })
  devCode?: string;
}

export class EmailVerificationRequestedDto {
  @ApiProperty({ example: true, description: 'Signup succeeded but the email must be confirmed before sign-in' })
  verificationRequired: true;

  @ApiProperty({ example: 'owner@brewbean.com', description: 'The email the code was sent to' })
  email: string;

  @ApiProperty({ example: 900 })
  expiresInSec: number;

  @ApiProperty({ example: 60 })
  resendInSec: number;

  @ApiProperty({ required: false, description: 'Dev-mode only — never present in production' })
  devCode?: string;
}

export class AuthResultDto {
  @ApiProperty({ enum: ['AUTHENTICATED', 'REGISTRATION_REQUIRED'] })
  status: 'AUTHENTICATED' | 'REGISTRATION_REQUIRED';

  @ApiProperty({ type: AuthSessionDto, nullable: true })
  session: AuthSessionDto | null;

  @ApiProperty({ nullable: true, type: String, description: 'Present when status is REGISTRATION_REQUIRED; pass to /register within 10 minutes' })
  registrationToken: string | null;
}

export class MeBusinessSummaryDto extends BusinessDto {}

export class ImpersonationInfoDto {
  @ApiProperty({ description: 'Admin support session id' })
  sessionId: string;

  @ApiProperty({ example: 'support@stamposa.com', description: 'Who is impersonating' })
  adminLabel: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the support session force-ends' })
  expiresAt: string;
}

export class MeDto {
  @ApiProperty({ enum: ['MERCHANT', 'STAFF', 'CUSTOMER'] })
  role: ActorRole;

  @ApiProperty({ type: SessionActorDto })
  actor: SessionActorDto;

  @ApiProperty({ type: BusinessDto, nullable: true })
  business: BusinessDto | null;

  @ApiProperty({
    type: ImpersonationInfoDto,
    nullable: true,
    description: 'Set when this session is an admin impersonating the merchant',
  })
  impersonation?: ImpersonationInfoDto | null;
}
