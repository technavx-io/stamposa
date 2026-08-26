import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentActor, Public } from './decorators/auth.decorators';
import { AuthActor } from './auth.types';
import { AuthService } from './auth.service';
import {
  EmailLoginDto,
  MerchantSignupDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  ResendEmailVerificationDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from './dto/auth-request.dto';
import {
  AuthResultDto,
  AuthSessionDto,
  EmailVerificationRequestedDto,
  MeDto,
  OtpRequestedDto,
  TokensDto,
} from './dto/auth-response.dto';

const OTP_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ── Merchant (email + password) ───────────────────────────────────────

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('merchant/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a merchant account; emails a verification code' })
  @ApiOkResponse({ type: EmailVerificationRequestedDto })
  signupMerchant(@Body() dto: MerchantSignupDto): Promise<EmailVerificationRequestedDto> {
    return this.auth.signupMerchant(dto.email, dto.password, dto.name);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('merchant/verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the emailed code and sign the new merchant in' })
  @ApiOkResponse({ type: AuthSessionDto })
  verifyMerchantEmail(@Body() dto: VerifyEmailDto): Promise<AuthSessionDto> {
    return this.auth.verifyMerchantEmail(dto.email, dto.code);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('merchant/verify-email/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the merchant email verification code' })
  @ApiOkResponse({ type: OtpRequestedDto })
  resendMerchantVerification(@Body() dto: ResendEmailVerificationDto): Promise<OtpRequestedDto> {
    return this.auth.resendMerchantVerification(dto.email);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('merchant/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log a merchant in with email + password' })
  @ApiOkResponse({ type: AuthSessionDto })
  loginMerchant(@Body() dto: EmailLoginDto): Promise<AuthSessionDto> {
    return this.auth.loginMerchant(dto.email, dto.password);
  }

  // ── Staff (email + password, created by the merchant) ─────────────────

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log a staff member in with email + password' })
  @ApiOkResponse({ type: AuthSessionDto })
  loginStaff(@Body() dto: EmailLoginDto): Promise<AuthSessionDto> {
    return this.auth.loginStaff(dto.email, dto.password);
  }

  // ── Customer ──────────────────────────────────────────────────────────

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('customer/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login/registration OTP to a customer phone' })
  @ApiOkResponse({ type: OtpRequestedDto })
  requestCustomerOtp(@Body() dto: RequestOtpDto): Promise<OtpRequestedDto> {
    return this.auth.requestOtp('CUSTOMER', dto.phone);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('customer/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify customer OTP — logs in, or returns a registration token for new phones' })
  @ApiOkResponse({ type: AuthResultDto })
  verifyCustomerOtp(@Body() dto: VerifyOtpDto): Promise<AuthResultDto> {
    return this.auth.verifyOtp('CUSTOMER', dto.phone, dto.code);
  }

  @Public()
  @Post('customer/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete customer registration after OTP verification' })
  @ApiOkResponse({ type: AuthSessionDto })
  registerCustomer(@Body() dto: RegisterDto): Promise<AuthSessionDto> {
    return this.auth.registerCustomer(dto.registrationToken, dto.name);
  }

  // ── Session ───────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token into a new token pair' })
  @ApiOkResponse({ type: TokensDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token (idempotent)' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ success: true }> {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current actor profile (any role)' })
  @ApiOkResponse({ type: MeDto })
  me(@CurrentActor() actor: AuthActor): MeDto {
    return this.auth.me(actor);
  }
}
