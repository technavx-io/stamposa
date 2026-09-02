import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Customer } from '@prisma/client';
import type { Response } from 'express';
import { CurrentCustomer, Public, Roles } from '../auth/decorators/auth.decorators';
import { notFound, unauthorized } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

class WalletPlatformDto {
  @ApiProperty()
  available: boolean;
}

class WalletAvailabilityDto {
  @ApiProperty({ type: WalletPlatformDto })
  apple: WalletPlatformDto;

  @ApiProperty({ type: WalletPlatformDto })
  google: WalletPlatformDto;
}

class GoogleSaveLinkDto {
  @ApiProperty({ description: 'Open this to save the card to Google Wallet' })
  saveUrl: string;
}

/** Customer-facing wallet endpoints. */
@ApiTags('Customer')
@ApiBearerAuth()
@Roles('CUSTOMER')
@Controller('customer/cards/:membershipId/wallet')
export class CustomerWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Which wallets this deployment can issue passes for' })
  @ApiOkResponse({ type: WalletAvailabilityDto })
  async availability(
    @CurrentCustomer() customer: Customer,
    @Param('membershipId') membershipId: string,
  ): Promise<WalletAvailabilityDto> {
    // Ownership check even though the answer is deployment-wide.
    await this.wallet.passMembership(membershipId, customer.id);
    return this.wallet.availability();
  }

  @Get('apple.pkpass')
  @ApiOperation({ summary: 'Download the signed Apple Wallet pass for this card' })
  async applePass(
    @CurrentCustomer() customer: Customer,
    @Param('membershipId') membershipId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!this.wallet.availability().apple.available) {
      throw notFound('WALLET_NOT_CONFIGURED', 'Apple Wallet is not enabled on this deployment.');
    }
    const pkpass = await this.wallet.buildApplePass(membershipId, customer.id);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="loyalty-card.pkpass"');
    return new StreamableFile(pkpass);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create/refresh the Google Wallet object and return the save link' })
  @ApiOkResponse({ type: GoogleSaveLinkDto })
  async googleLink(
    @CurrentCustomer() customer: Customer,
    @Param('membershipId') membershipId: string,
  ): Promise<GoogleSaveLinkDto> {
    if (!this.wallet.availability().google.available) {
      throw notFound('WALLET_NOT_CONFIGURED', 'Google Wallet is not enabled on this deployment.');
    }
    return this.wallet.googleSaveLink(membershipId, customer.id);
  }

  /**
   * The stamp-progress banner (Google's hero image). Public and unauthenticated
   * because Google fetches it server-side — it can't present a customer token.
   * It reveals only a stamp count for a hard-to-guess membership id, which the
   * pass already shows; no name or personal data is in the image.
   */
  @Public()
  @Get('hero.png')
  @ApiExcludeEndpoint()
  async heroImage(
    @Param('membershipId') membershipId: string,
    @Res() res: Response,
  ): Promise<void> {
    const png = await this.wallet.heroImage(membershipId);
    res.set({
      'Content-Type': 'image/png',
      // Short cache: the URL is cache-busted per stamp, but a small TTL avoids
      // hammering the renderer if Google retries.
      'Cache-Control': 'public, max-age=300',
    });
    res.send(png);
  }
}

/**
 * Apple's pass web service protocol — called by iOS/watchOS, not by our
 * apps. Devices authenticate with the pass's own token
 * (`Authorization: ApplePass <token>`). Endpoints and shapes are dictated
 * by Apple; the full base URL is {API_PUBLIC_URL}/v1/wallet/apple.
 */
@ApiTags('Apple Wallet web service')
@Public()
@Controller('wallet/apple/v1')
export class AppleWebServiceController {
  private readonly logger = new Logger('AppleWalletWebService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  @Post('devices/:deviceId/registrations/:passTypeId/:serial')
  @ApiExcludeEndpoint()
  async register(
    @Param('deviceId') deviceId: string,
    @Param('serial') serial: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: { pushToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pass = await this.authedPass(serial, auth);
    if (!body?.pushToken) throw unauthorized('INVALID_REQUEST', 'pushToken required.');
    const existing = await this.prisma.appleWalletRegistration.findUnique({
      where: { deviceLibraryId_walletPassId: { deviceLibraryId: deviceId, walletPassId: pass.id } },
    });
    if (existing) {
      if (existing.pushToken !== body.pushToken) {
        await this.prisma.appleWalletRegistration.update({
          where: { id: existing.id },
          data: { pushToken: body.pushToken },
        });
      }
      res.status(HttpStatus.OK);
      return {};
    }
    await this.prisma.appleWalletRegistration.create({
      data: { deviceLibraryId: deviceId, walletPassId: pass.id, pushToken: body.pushToken },
    });
    res.status(HttpStatus.CREATED);
    return {};
  }

  @Get('devices/:deviceId/registrations/:passTypeId')
  @ApiExcludeEndpoint()
  async registrations(
    @Param('deviceId') deviceId: string,
    @Query('passesUpdatedSince') since: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.prisma.appleWalletRegistration.findMany({
      where: { deviceLibraryId: deviceId },
      include: { walletPass: true },
    });
    const cutoff = since ? new Date(Number(since) * 1000) : null;
    const updated = rows.filter(
      (r) => !cutoff || r.walletPass.appleUpdatedAt.getTime() > cutoff.getTime(),
    );
    if (rows.length === 0 || updated.length === 0) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    const lastUpdated = Math.max(...updated.map((r) => r.walletPass.appleUpdatedAt.getTime()));
    return {
      lastUpdated: String(Math.floor(lastUpdated / 1000)),
      serialNumbers: updated.map((r) => r.walletPass.membershipId),
    };
  }

  @Delete('devices/:deviceId/registrations/:passTypeId/:serial')
  @ApiExcludeEndpoint()
  async unregister(
    @Param('deviceId') deviceId: string,
    @Param('serial') serial: string,
    @Headers('authorization') auth: string | undefined,
  ) {
    const pass = await this.authedPass(serial, auth);
    await this.prisma.appleWalletRegistration.deleteMany({
      where: { deviceLibraryId: deviceId, walletPassId: pass.id },
    });
    return {};
  }

  @Get('passes/:passTypeId/:serial')
  @ApiExcludeEndpoint()
  async latestPass(
    @Param('serial') serial: string,
    @Headers('authorization') auth: string | undefined,
    @Headers('if-modified-since') ifModifiedSince: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pass = await this.authedPass(serial, auth);
    if (ifModifiedSince) {
      const since = new Date(ifModifiedSince).getTime();
      // Last-Modified has second precision — compare at the same grain.
      if (!Number.isNaN(since) && Math.floor(pass.appleUpdatedAt.getTime() / 1000) * 1000 <= since) {
        res.status(HttpStatus.NOT_MODIFIED);
        return;
      }
    }
    const pkpass = await this.wallet.buildApplePass(serial);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Last-Modified', pass.appleUpdatedAt.toUTCString());
    return new StreamableFile(pkpass);
  }

  @Post('log')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  log(@Body() body: { logs?: string[] }) {
    for (const line of body?.logs ?? []) this.logger.warn(`device: ${line}`);
    return {};
  }

  /** Serial + ApplePass token must both match, else 401 (per spec). */
  private async authedPass(serial: string, authHeader: string | undefined) {
    const token = authHeader?.match(/^ApplePass\s+(.+)$/i)?.[1];
    if (!token) throw unauthorized('INVALID_TOKEN', 'ApplePass authorization required.');
    const pass = await this.prisma.walletPass.findUnique({ where: { membershipId: serial } });
    if (!pass || pass.appleAuthToken !== token) {
      throw unauthorized('INVALID_TOKEN', 'Unknown pass.');
    }
    return pass;
  }
}
