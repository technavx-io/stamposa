import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PlatformAdmin } from '@prisma/client';
import { Public } from '../auth/decorators/auth.decorators';
import { AdminAuthService } from './admin-auth.service';
import { AdminRoute, CurrentAdmin, RequestContext } from './decorators/admin.decorators';
import {
  AdminLoginDto,
  AdminLoginResultDto,
  AdminProfileDto,
  AdminRefreshDto,
  AdminSessionDto,
  AdminTwoFactorDto,
} from './dto/admin-auth.dto';

/** Admin sign-in is a prime brute-force target; limits are tighter than tenant auth. */
const ADMIN_AUTH_THROTTLE = { default: { limit: 8, ttl: 60_000 } };

interface Meta {
  ipAddress: string | null;
  userAgent: string | null;
}

@ApiTags('Admin · Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Public()
  @Throttle(ADMIN_AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1 — email and password. Always requires a second factor.' })
  @ApiOkResponse({ type: AdminLoginResultDto })
  login(@Body() dto: AdminLoginDto, @RequestContext() meta: Meta) {
    return this.auth.login(dto.email, dto.password, meta);
  }

  @Public()
  @Throttle(ADMIN_AUTH_THROTTLE)
  @Post('2fa/enroll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'First sign-in — confirm the authenticator and receive recovery codes' })
  @ApiOkResponse({ type: AdminSessionDto })
  enroll(@Body() dto: AdminTwoFactorDto, @RequestContext() meta: Meta) {
    return this.auth.enrollTwoFactor(dto.twoFactorToken, dto.code, meta);
  }

  @Public()
  @Throttle(ADMIN_AUTH_THROTTLE)
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2 — authenticator code (or a recovery code)' })
  @ApiOkResponse({ type: AdminSessionDto })
  verify(@Body() dto: AdminTwoFactorDto, @RequestContext() meta: Meta) {
    return this.auth.verifyTwoFactor(dto.twoFactorToken, dto.code, meta);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate an admin refresh token' })
  refresh(@Body() dto: AdminRefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current admin session' })
  async logout(@Body() dto: AdminRefreshDto, @RequestContext() meta: Meta) {
    await this.auth.logout(dto.refreshToken, null, meta);
    return { success: true };
  }

  @AdminRoute()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in admin and what their role permits' })
  @ApiOkResponse({ type: AdminProfileDto })
  me(@CurrentAdmin() admin: PlatformAdmin): AdminProfileDto {
    return this.auth.toDto(admin);
  }
}
