import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentActor, Public } from './decorators/auth.decorators';
import { AuthActor } from './auth.types';
import { AuthService } from './auth.service';
import { RefreshTokenDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './dto/auth-request.dto';
import {
  AuthResultDto,
  AuthSessionDto,
  MeDto,
  OtpRequestedDto,
  TokensDto,
} from './dto/auth-response.dto';

const OTP_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ── Merchant ──────────────────────────────────────────────────────────

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('merchant/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login/registration OTP to a merchant phone' })
  @ApiOkResponse({ type: OtpRequestedDto })
  requestMerchantOtp(@Body() dto: RequestOtpDto): Promise<OtpRequestedDto> {
    return this.auth.requestOtp('MERCHANT', dto.phone);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('merchant/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify merchant OTP — logs in, or returns a registration token for new phones' })
  @ApiOkResponse({ type: AuthResultDto })
  verifyMerchantOtp(@Body() dto: VerifyOtpDto): Promise<AuthResultDto> {
    return this.auth.verifyOtp('MERCHANT', dto.phone, dto.code);
  }

  @Public()
  @Post('merchant/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete merchant registration after OTP verification' })
  @ApiOkResponse({ type: AuthSessionDto })
  registerMerchant(@Body() dto: RegisterDto): Promise<AuthSessionDto> {
    return this.auth.registerMerchant(dto.registrationToken, dto.name);
  }

  // ── Staff ─────────────────────────────────────────────────────────────

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('staff/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a login OTP to a staff phone (account must exist)' })
  @ApiOkResponse({ type: OtpRequestedDto })
  requestStaffOtp(@Body() dto: RequestOtpDto): Promise<OtpRequestedDto> {
    return this.auth.requestOtp('STAFF', dto.phone);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('staff/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify staff OTP and log in' })
  @ApiOkResponse({ type: AuthResultDto })
  verifyStaffOtp(@Body() dto: VerifyOtpDto): Promise<AuthResultDto> {
    return this.auth.verifyOtp('STAFF', dto.phone, dto.code);
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
